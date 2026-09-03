import ts from 'typescript';
import { CONFIDENCE, evidenceOf, GraphBuilder, stableId } from './core';
import type { FileContext } from './context';
import { handlerArgument } from './program';
import type { Inventory } from './inventory';

const FRAMEWORK_ANALYZER = 'framework-adapter';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'ALL'];

/**
 * One spelling for a route regardless of which framework wrote it, so a Next.js
 * handler at `app/users/[id]/route.ts`, a Nest `@Get(':id')` and a browser
 * `fetch('/api/users/' + id)` all land on the same endpoint node. That shared
 * identity is what makes the frontend-to-backend path a single graph walk.
 */
export function canonicalRoute(input: string): string {
  let route = input.trim();
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/[?#].*$/, '');
  route = route.replace(/\/+$/, '') || '/';
  route = route
    .replace(/\[\.{3}[^\]]+\]/g, '{param}')
    .replace(/\[\[?([^\]]+)\]?\]/g, '{param}')
    .replace(/:[A-Za-z0-9_]+/g, '{param}')
    .replace(/\{[^}]*\}/g, '{param}')
    .replace(/\$\{[^}]*\}/g, '{param}')
    .replace(/<[^>]*>/g, '{param}');
  return route.toLowerCase();
}

export function endpointId(method: string, route: string): string {
  return stableId('endpoint', `${method.toUpperCase()} ${canonicalRoute(route)}`);
}

function addEndpoint(
  context: FileContext,
  method: string,
  route: string,
  node: ts.Node,
  kind: string,
  confidence: number,
  /** The declaration that actually handles the request, when it is known. */
  target?: string,
): string {
  const canonical = canonicalRoute(route);
  const id = endpointId(method, canonical);
  const evidence = context.evidence(node, kind, FRAMEWORK_ANALYZER, confidence);
  context.graph.addEntity({
    id,
    type: 'endpoint',
    name: `${method.toUpperCase()} ${canonical}`,
    path: context.file,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    language: null,
    confidence,
    metadata: { method: method.toUpperCase(), route: canonical, framework: kind },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: id,
    target: target ?? context.scope(),
    type: 'ROUTES_TO',
    confidence,
    evidence: [evidence],
  });
  return id;
}

/**
 * Resolve a registration call's handler argument to the node that implements it,
 * whether that is an inline callback or a named function passed by reference.
 */
function resolveRegisteredHandler(
  context: FileContext,
  node: ts.CallExpression | ts.NewExpression,
): string | undefined {
  const argument = handlerArgument(node);
  if (!argument) return undefined;
  if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
    return context.entityForDeclaration(argument);
  }
  return resolveHandler(context, argument as ts.Expression);
}

function addExternalService(
  context: FileContext,
  name: string,
  node: ts.Node,
  kind: string,
  confidence: number,
): string {
  const id = stableId('external_service', name.toLowerCase());
  const evidence = context.evidence(node, kind, FRAMEWORK_ANALYZER, confidence);
  context.graph.addEntity({
    id,
    type: 'external_service',
    name,
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence,
    metadata: {},
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: context.scope(),
    target: id,
    type: 'CALLS_EXTERNAL',
    confidence,
    evidence: [evidence],
  });
  return id;
}

function addEvent(context: FileContext, name: string, node: ts.Node, publishes: boolean, confidence: number, target?: string): string {
  const id = stableId('event', name.toLowerCase());
  const evidence = context.evidence(node, publishes ? 'event-publish' : 'event-subscribe', FRAMEWORK_ANALYZER, confidence);
  context.graph.addEntity({
    id,
    type: 'event',
    name,
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence,
    metadata: {},
    evidence: [evidence],
  });
  if (publishes) {
    context.graph.addEdge({ source: context.scope(), target: id, type: 'PUBLISHES', confidence, evidence: [evidence] });
  } else {
    // Both directions are recorded: SUBSCRIBES_TO reads naturally from the
    // consumer, HANDLED_BY lets a forward walk from a publisher reach it.
    context.graph.addEdge({ source: target ?? context.scope(), target: id, type: 'SUBSCRIBES_TO', confidence, evidence: [evidence] });
    context.graph.addEdge({ source: id, target: target ?? context.scope(), type: 'HANDLED_BY', confidence, evidence: [evidence] });
  }
  return id;
}

function addDataModel(context: FileContext, model: string, write: boolean, node: ts.Node, orm: string, confidence: number): string {
  const id = stableId('database_model', model.toLowerCase());
  const evidence = context.evidence(node, `${orm}-operation`, FRAMEWORK_ANALYZER, confidence);
  context.graph.addEntity({
    id,
    type: 'database_model',
    name: model,
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence,
    metadata: { orm },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: context.scope(),
    target: id,
    type: write ? 'WRITES' : 'READS',
    confidence,
    evidence: [evidence],
  });
  return id;
}

const decoratorName = (decorator: ts.Decorator): string | null => {
  const expression = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  return ts.isIdentifier(expression) ? expression.text : null;
};

const decoratorArgs = (decorator: ts.Decorator): ts.NodeArray<ts.Expression> | null =>
  ts.isCallExpression(decorator.expression) ? decorator.expression.arguments : null;

const firstStringArgument = (args: ts.NodeArray<ts.Expression> | null): string | null => {
  const first = args?.[0];
  return first && ts.isStringLiteralLike(first) ? first.text : null;
};

/** Nearest enclosing `@Controller('prefix')` value, so route prefixes compose. */
function controllerPrefix(node: ts.Node): string {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isClassDeclaration(current) && ts.canHaveDecorators(current)) {
      for (const decorator of ts.getDecorators(current) ?? []) {
        if (decoratorName(decorator) === 'Controller') {
          return firstStringArgument(decoratorArgs(decorator)) ?? '';
        }
      }
    }
    current = current.parent;
  }
  return '';
}

// ── NestJS ───────────────────────────────────────────────────────────────────

function nestAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.canHaveDecorators(node)) return;
  const decorators = ts.getDecorators(node);
  if (!decorators?.length) return;

  for (const decorator of decorators) {
    const name = decoratorName(decorator);
    if (!name) continue;
    const args = decoratorArgs(decorator);
    const literal = firstStringArgument(args);

    if (HTTP_METHODS.includes(name.toUpperCase()) && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
      const prefix = controllerPrefix(node);
      const route = `${prefix ? `/${prefix.replace(/^\//, '')}` : ''}/${(literal ?? '').replace(/^\//, '')}`;
      addEndpoint(context, name.toUpperCase(), route, node, 'nestjs-route', CONFIDENCE.frameworkConfig);
      continue;
    }

    if ((name === 'OnEvent' || name === 'EventPattern' || name === 'MessagePattern') && literal) {
      addEvent(context, literal, node, false, CONFIDENCE.frameworkConfig);
      continue;
    }

    if (name === 'Cron' || name === 'Interval' || name === 'Timeout') {
      const schedule = literal ?? (args?.[0] && ts.isNumericLiteral(args[0]) ? `${args[0].text}ms` : 'unspecified');
      addJob(context, `${context.file}:${schedule}`, `Scheduled (${schedule})`, node, 'nestjs-schedule');
      continue;
    }

    if (name === 'Process' || name === 'Processor') {
      const queueName = literal ?? 'default';
      addQueueConsumer(context, queueName, node, 'nestjs-queue');
      continue;
    }

    if (name === 'Subscription' && ts.isMethodDeclaration(node)) {
      addGraphQlOperation(context, 'subscription', node.name.getText(context.source), node);
      continue;
    }
    if ((name === 'Query' || name === 'Mutation') && ts.isMethodDeclaration(node)) {
      addGraphQlOperation(context, name.toLowerCase(), node.name.getText(context.source), node);
    }
  }
}

function addJob(context: FileContext, key: string, label: string, node: ts.Node, kind: string, target?: string): string {
  const id = stableId('job', key);
  const evidence = context.evidence(node, kind, FRAMEWORK_ANALYZER, CONFIDENCE.frameworkConfig);
  context.graph.addEntity({
    id,
    type: 'job',
    name: label,
    path: context.file,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    language: null,
    confidence: CONFIDENCE.frameworkConfig,
    metadata: { kind },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: id, target: target ?? context.scope(), type: 'ROUTES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence],
  });
  return id;
}

function addQueueConsumer(context: FileContext, queueName: string, node: ts.Node, kind: string, target?: string): string {
  const id = stableId('queue', queueName.toLowerCase());
  const evidence = context.evidence(node, kind, FRAMEWORK_ANALYZER, CONFIDENCE.frameworkConfig);
  context.graph.addEntity({
    id,
    type: 'queue',
    name: queueName,
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence: CONFIDENCE.frameworkConfig,
    metadata: {},
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: target ?? context.scope(), target: id, type: 'SUBSCRIBES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence],
  });
  context.graph.addEdge({
    source: id, target: target ?? context.scope(), type: 'HANDLED_BY', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence],
  });
  return id;
}

function addGraphQlOperation(context: FileContext, operation: string, name: string, node: ts.Node): string {
  const id = endpointId('GRAPHQL', `/${operation}/${name}`);
  const evidence = context.evidence(node, 'graphql-operation', FRAMEWORK_ANALYZER, CONFIDENCE.frameworkConfig);
  context.graph.addEntity({
    id,
    type: 'endpoint',
    name: `GraphQL ${operation} ${name}`,
    path: context.file,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    language: null,
    confidence: CONFIDENCE.frameworkConfig,
    metadata: { protocol: 'graphql', operation, field: name },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: id, target: context.scope(), type: 'ROUTES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence],
  });
  return id;
}

// ── Express / Fastify / Koa ──────────────────────────────────────────────────

const ROUTER_METHOD = /^(?:[A-Za-z0-9_$.]*\b(?:app|router|server|fastify|api|instance)\b)\.(get|post|put|patch|delete|options|head|all)$/i;

function httpServerAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
  const text = node.expression.getText(context.source);
  const match = text.match(ROUTER_METHOD);
  if (!match) return;
  const first = node.arguments[0];
  if (!first || !ts.isStringLiteralLike(first)) return;
  // The handler is the last function argument; route to it when it is a
  // declaration we recorded, otherwise to the enclosing scope.
  addEndpoint(context, match[1], first.text, node, 'express-route', CONFIDENCE.frameworkConfig, resolveRegisteredHandler(context, node));
}

// ── Prisma / ORMs ────────────────────────────────────────────────────────────

const PRISMA_ACCESS = /(?:^|\.)(?:prisma|db|tx|client)\.([A-Za-z][A-Za-z0-9_]*)\.(findUnique|findFirst|findMany|aggregate|groupBy|count|create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const MONGOOSE_ACCESS = /\.([A-Za-z][A-Za-z0-9_]*)\.(find|findOne|findById|aggregate|countDocuments|create|insertMany|updateOne|updateMany|findByIdAndUpdate|deleteOne|deleteMany|save)$/;
const READ_OPERATION = /^(find|aggregate|group|count)/i;

function ormAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
  const text = node.expression.getText(context.source);
  const prisma = text.match(PRISMA_ACCESS);
  if (prisma) {
    addDataModel(context, prisma[1], !READ_OPERATION.test(prisma[2]), node, 'prisma', CONFIDENCE.frameworkConfig);
    return;
  }
  const mongoose = text.match(MONGOOSE_ACCESS);
  if (mongoose && /^[A-Z]/.test(mongoose[1])) {
    addDataModel(context, mongoose[1], !READ_OPERATION.test(mongoose[2]), node, 'mongoose', CONFIDENCE.ast);
    return;
  }
  // Raw SQL, wherever it is issued from.
  if (/\.(query|execute|raw|\$queryRaw|\$executeRaw)$/.test(text)) {
    const argument = node.arguments[0];
    const sql = argument && ts.isStringLiteralLike(argument) ? argument.text
      : argument && ts.isTemplateExpression(argument) ? argument.getText(context.source) : null;
    if (!sql) return;
    const table = sql.match(/\b(?:from|into|update|join)\s+["'`\[]?([A-Za-z_][A-Za-z0-9_.]*)["'`\]]?/i)?.[1];
    if (!table) return;
    const write = /^\s*(insert|update|delete|create|alter|drop|truncate)/i.test(sql);
    const id = stableId('database_table', table.toLowerCase());
    const evidence = context.evidence(node, 'raw-sql', FRAMEWORK_ANALYZER, CONFIDENCE.ast);
    context.graph.addEntity({
      id,
      type: 'database_table',
      name: table,
      path: null,
      startLine: null,
      endLine: null,
      language: null,
      confidence: CONFIDENCE.ast,
      metadata: { via: 'raw-sql' },
      evidence: [evidence],
    });
    context.graph.addEdge({
      source: context.scope(), target: id, type: write ? 'WRITES' : 'READS', confidence: CONFIDENCE.ast, evidence: [evidence],
    });
  }
}

// ── Events, queues and schedules ─────────────────────────────────────────────

const PUBLISH_METHOD = /\.(publish|emit|dispatch|send|enqueue|add|produce)$/i;
const SUBSCRIBE_METHOD = /\.(on|once|subscribe|addListener|consume|process|handle)$/i;

function eventAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
  const text = node.expression.getText(context.source);
  const first = node.arguments[0];
  const name = first && ts.isStringLiteralLike(first) ? first.text : null;
  if (!name) return;

  // A bare `.on('data')` on an arbitrary object is noise; require either an
  // event-bus-shaped receiver or a dotted/namespaced event name.
  const busShaped = /\b(bus|events?|emitter|queue|broker|pubsub|kafka|nats|rabbit|redis|stream|topic|channel|worker)\b/i.test(text);
  const namespaced = /^[a-z0-9_-]+[.:][a-z0-9_.:-]+$/i.test(name);
  if (!busShaped && !namespaced) return;

  if (PUBLISH_METHOD.test(text)) {
    addEvent(context, name, node, true, busShaped ? CONFIDENCE.frameworkConfig : CONFIDENCE.ast);
  } else if (SUBSCRIBE_METHOD.test(text)) {
    addEvent(context, name, node, false, busShaped ? CONFIDENCE.frameworkConfig : CONFIDENCE.ast, resolveRegisteredHandler(context, node));
  }
}

const SCHEDULE_CALL = /\b(cron\.schedule|schedule\.scheduleJob|scheduleJob|CronJob|Cron)\b/;

function scheduleAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return;
  const text = node.expression.getText(context.source);
  if (!SCHEDULE_CALL.test(text)) return;
  const first = node.arguments?.[0];
  const expression = first && ts.isStringLiteralLike(first) ? first.text : 'unspecified';
  addJob(context, `${context.file}:${node.pos}:${expression}`, `Scheduled (${expression})`, node, 'cron-schedule', resolveRegisteredHandler(context, node));
}

const QUEUE_CONSTRUCT = /\b(Worker|Queue|QueueScheduler|Consumer)$/;

function queueAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isNewExpression(node)) return;
  const text = node.expression.getText(context.source);
  if (!QUEUE_CONSTRUCT.test(text)) return;
  const first = node.arguments?.[0];
  if (!first || !ts.isStringLiteralLike(first)) return;
  if (/\bWorker$|\bConsumer$/.test(text)) addQueueConsumer(context, first.text, node, 'queue-worker');
  else {
    const id = stableId('queue', first.text.toLowerCase());
    const evidence = context.evidence(node, 'queue-producer', FRAMEWORK_ANALYZER, CONFIDENCE.frameworkConfig);
    context.graph.addEntity({
      id,
      type: 'queue',
      name: first.text,
      path: null,
      startLine: null,
      endLine: null,
      language: null,
      confidence: CONFIDENCE.frameworkConfig,
      metadata: {},
      evidence: [evidence],
    });
    context.graph.addEdge({
      source: context.scope(), target: id, type: 'PUBLISHES', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence],
    });
  }
}

// ── External services ────────────────────────────────────────────────────────

const EXTERNAL_HOSTS: Array<[RegExp, string]> = [
  [/api\.stripe\.com|\bstripe\b/i, 'Stripe'],
  [/api\.paystack\.co|paystack/i, 'Paystack'],
  [/flutterwave/i, 'Flutterwave'],
  [/sendgrid|api\.sendgrid\.com/i, 'SendGrid'],
  [/api\.twilio\.com|twilio/i, 'Twilio'],
  [/api\.openai\.com|openai/i, 'OpenAI'],
  [/api\.anthropic\.com|anthropic/i, 'Anthropic'],
  [/amazonaws\.com|@aws-sdk|S3Client|DynamoDB/i, 'AWS'],
  [/firebase|googleapis\.com/i, 'Google Cloud'],
  [/cloudinary/i, 'Cloudinary'],
  [/slack\.com|@slack\//i, 'Slack'],
  [/api\.github\.com|octokit/i, 'GitHub'],
  [/sentry/i, 'Sentry'],
  [/mailgun/i, 'Mailgun'],
  [/postmark/i, 'Postmark'],
  [/algolia/i, 'Algolia'],
  [/elastic(?:search)?\.co/i, 'Elasticsearch'],
];

const ENVIRONMENT_SERVICE: Array<[RegExp, string]> = [
  [/^STRIPE_/i, 'Stripe'], [/^PAYSTACK_/i, 'Paystack'], [/^SENDGRID_/i, 'SendGrid'],
  [/^TWILIO_/i, 'Twilio'], [/^OPENAI_/i, 'OpenAI'], [/^ANTHROPIC_/i, 'Anthropic'],
  [/^AWS_/i, 'AWS'], [/^FIREBASE_|^GOOGLE_/i, 'Google Cloud'], [/^CLOUDINARY_/i, 'Cloudinary'],
  [/^SLACK_/i, 'Slack'], [/^SENTRY_/i, 'Sentry'], [/^REDIS_/i, 'Redis'],
  [/^DATABASE_URL|^POSTGRES_/i, 'PostgreSQL'], [/^NEO4J_/i, 'Neo4j'], [/^KAFKA_/i, 'Kafka'],
  [/^MONGO/i, 'MongoDB'], [/^CLICKHOUSE_/i, 'ClickHouse'], [/^GITHUB_/i, 'GitHub'],
];

const HTTP_CLIENT = /^(?:fetch|axios(?:\.(get|post|put|patch|delete|request))?|got|superagent|ky|request)$/i;

/**
 * HTTP calls. A call to an absolute URL is an external dependency; a call to a
 * relative path is the browser half of an internal endpoint, and is attached to
 * the shared endpoint node so the frontend-to-backend path connects.
 */
function httpClientAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  const callee = node.expression.getText(context.source);
  const isClient = HTTP_CLIENT.test(callee)
    || /\.(get|post|put|patch|delete|request)$/i.test(callee) && /\b(api|client|http|axios|request)\b/i.test(callee);
  if (!isClient) return;

  const first = node.arguments[0];
  let url: string | null = null;
  if (first && ts.isStringLiteralLike(first)) url = first.text;
  else if (first && ts.isTemplateExpression(first)) {
    url = first.head.text + first.templateSpans.map((span) => `{param}${span.literal.text}`).join('');
  } else if (first && ts.isBinaryExpression(first)) {
    const left = first.left;
    if (ts.isStringLiteralLike(left)) url = `${left.text}{param}`;
  }
  if (!url) return;

  if (/^https?:\/\//i.test(url)) {
    const known = EXTERNAL_HOSTS.find(([pattern]) => pattern.test(url!));
    let host = known?.[1] ?? null;
    if (!host) {
      try { host = new URL(url).host; } catch { host = null; }
    }
    if (host) addExternalService(context, host, node, 'external-http-call', known ? CONFIDENCE.frameworkConfig : CONFIDENCE.ast);
    return;
  }
  if (!url.startsWith('/')) return;

  const methodFromCallee = callee.match(/\.(get|post|put|patch|delete)$/i)?.[1];
  const methodFromOptions = node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])
    ? node.arguments[1].properties.find((property) =>
      ts.isPropertyAssignment(property) && property.name.getText(context.source).replace(/['"]/g, '') === 'method')
    : undefined;
  const optionMethod = methodFromOptions && ts.isPropertyAssignment(methodFromOptions)
    && ts.isStringLiteralLike(methodFromOptions.initializer)
    ? methodFromOptions.initializer.text : null;
  const method = (optionMethod ?? methodFromCallee ?? 'GET').toUpperCase();

  const canonical = canonicalRoute(url);
  const id = endpointId(method, canonical);
  const evidence = context.evidence(node, 'frontend-api-call', FRAMEWORK_ANALYZER, CONFIDENCE.ast);
  context.graph.addEntity({
    id,
    type: 'endpoint',
    name: `${method} ${canonical}`,
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence: CONFIDENCE.ast,
    metadata: { method, route: canonical, calledFromClient: true },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: context.scope(), target: id, type: 'CALLS', confidence: CONFIDENCE.ast, evidence: [evidence],
  });
}

function sdkAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isNewExpression(node) && !ts.isCallExpression(node)) return;
  const text = node.expression.getText(context.source);
  if (text.length > 80) return;
  const known = EXTERNAL_HOSTS.find(([pattern]) => pattern.test(text));
  if (!known) return;
  addExternalService(context, known[1], node, 'external-sdk', CONFIDENCE.ast);
}

function environmentAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return;
  const text = node.getText(context.source);
  const match = text.match(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\])/);
  const key = match?.[1] ?? match?.[2];
  if (!key) return;
  context.environmentKeys.add(key);
  const service = ENVIRONMENT_SERVICE.find(([pattern]) => pattern.test(key));
  if (!service) return;
  // Configuration is supporting evidence for an integration, never proof of a
  // call, so it is recorded as CONFIGURES at heuristic confidence.
  const id = stableId('external_service', service[1].toLowerCase());
  const evidence = context.evidence(node, 'environment-configuration', FRAMEWORK_ANALYZER, CONFIDENCE.namingHeuristic);
  context.graph.addEntity({
    id,
    type: 'external_service',
    name: service[1],
    path: null,
    startLine: null,
    endLine: null,
    language: null,
    confidence: CONFIDENCE.namingHeuristic,
    metadata: {},
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: context.fileId, target: id, type: 'CONFIGURES', confidence: CONFIDENCE.namingHeuristic, evidence: [evidence],
  });
}

// ── React / UI ───────────────────────────────────────────────────────────────

const UI_EVENT_ATTRIBUTE = /^on(Click|Submit|Change|Input|KeyDown|KeyUp|Blur|Focus|Drop|Toggle|Select)$/;

function reactAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isJsxAttribute(node)) return;
  const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(context.source);
  if (!UI_EVENT_ATTRIBUTE.test(name)) return;

  const element = findAncestor(node, (candidate) =>
    ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate));
  const tag = element && (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element))
    ? element.tagName.getText(context.source) : 'element';
  const label = readableActionLabel(context, element) ?? tag;

  const id = stableId('ui_action', `${context.file}:${node.pos}:${name}`);
  const evidence = context.evidence(node, 'ui-event-handler', FRAMEWORK_ANALYZER, CONFIDENCE.ast);
  context.graph.addEntity({
    id,
    type: 'ui_action',
    name: `${label} (${name})`,
    path: context.file,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    language: null,
    confidence: CONFIDENCE.ast,
    metadata: { event: name, element: tag },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: id, target: context.scope(), type: 'ROUTES_TO', confidence: CONFIDENCE.ast, evidence: [evidence],
  });

  // Point the action at the handler it names, when that handler is a
  // declaration the checker already recorded.
  const initializer = node.initializer;
  const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : undefined;
  if (!expression) return;
  const target = resolveHandler(context, expression);
  if (target) {
    context.graph.addEdge({
      source: id, target, type: 'ROUTES_TO', confidence: CONFIDENCE.compilerResolved, evidence: [evidence],
    });
  }
}

function resolveHandler(context: FileContext, expression: ts.Expression): string | undefined {
  const identifier = ts.isIdentifier(expression) ? expression
    : ts.isPropertyAccessExpression(expression) ? expression.name : null;
  if (!identifier) return undefined;
  let symbol = context.checker.getSymbolAtLocation(identifier);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    try { symbol = context.checker.getAliasedSymbol(symbol); } catch { /* keep the local symbol */ }
  }
  const declaration = symbol?.declarations?.[0];
  return declaration ? context.entityForDeclaration(declaration) : undefined;
}

/** Human-readable text inside a control, used to name the action. */
function readableActionLabel(context: FileContext, element: ts.Node | undefined): string | null {
  const parent = element?.parent;
  if (!parent || !ts.isJsxElement(parent)) return null;
  for (const child of parent.children) {
    if (ts.isJsxText(child)) {
      const text = child.text.trim();
      if (text) return text.slice(0, 40);
    }
  }
  return null;
}

function findAncestor(node: ts.Node, predicate: (candidate: ts.Node) => boolean): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const TEST_FUNCTION = /^(?:describe|it|test)(?:\.(?:only|skip|concurrent|each|failing|todo))?$/;

function testAdapter(context: FileContext, node: ts.Node): void {
  if (!context.isTest || !ts.isCallExpression(node)) return;
  const callee = node.expression.getText(context.source);
  if (!TEST_FUNCTION.test(callee)) return;
  const first = node.arguments[0];
  const title = first && ts.isStringLiteralLike(first) ? first.text : null;
  if (!title) return;

  const id = stableId('test', `${context.file}:${node.pos}`);
  const evidence = context.evidence(node, 'test-declaration', FRAMEWORK_ANALYZER, CONFIDENCE.testAssertion);
  context.graph.addEntity({
    id,
    type: 'test',
    name: title,
    path: context.file,
    startLine: evidence.startLine,
    endLine: evidence.endLine,
    language: null,
    confidence: CONFIDENCE.testAssertion,
    metadata: { suite: callee.startsWith('describe') },
    evidence: [evidence],
  });
  context.graph.addEdge({
    source: context.fileId, target: id, type: 'DEFINES', confidence: CONFIDENCE.testAssertion, evidence: [],
  });
}

/**
 * Link a test to what it exercises. Imports of a test file are the subjects it
 * pulled in, which is a far better signal than the test's own title.
 */
export function linkTestSubjects(graph: GraphBuilder): void {
  for (const test of graph.ofType('test')) {
    if (!test.path) continue;
    const fileId = stableId('file', test.path);
    for (const edge of graph.outgoingOf(fileId)) {
      if (edge.type !== 'IMPORTS') continue;
      const target = graph.entity(edge.target);
      if (!target || target.type !== 'file') continue;
      for (const defined of graph.outgoingOf(target.id)) {
        if (defined.type !== 'EXPORTS') continue;
        graph.addEdge({
          source: test.id,
          target: defined.target,
          type: 'TESTS',
          confidence: CONFIDENCE.testAssertion,
          evidence: test.evidence.slice(0, 1),
        });
      }
    }
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

const ADAPTERS = [
  nestAdapter, httpServerAdapter, ormAdapter, eventAdapter, scheduleAdapter,
  queueAdapter, httpClientAdapter, sdkAdapter, environmentAdapter, reactAdapter, testAdapter,
];

export function applyFrameworkAdapters(context: FileContext, node: ts.Node): void {
  for (const adapter of ADAPTERS) {
    try {
      adapter(context, node);
    } catch {
      // One malformed construct must not abort the file. The missing edge shows
      // up as unresolved coverage rather than as a failed analysis.
    }
  }
}

// ── File-scoped conventions (Next.js, Remix, SvelteKit) ──────────────────────

const NEXT_APP_ROUTE = /(^|\/)app\/(.*\/)?(page|route|layout|template|default)\.[cm]?[jt]sx?$/;
const NEXT_PAGES_ROUTE = /(^|\/)pages\/(.+)\.[cm]?[jt]sx?$/;

function nextRouteFromPath(file: string): { route: string; kind: 'ui' | 'api'; segment: string } | null {
  const appMatch = file.match(NEXT_APP_ROUTE);
  if (appMatch) {
    const segment = appMatch[3];
    if (segment === 'layout' || segment === 'template' || segment === 'default') return null;
    const afterApp = file.slice(file.indexOf('app/') + 4);
    const directory = afterApp.slice(0, afterApp.lastIndexOf('/') + 1);
    // Route groups such as (marketing) organise files without affecting the URL.
    const route = `/${directory.replace(/\([^)]*\)\//g, '').replace(/\/$/, '')}`;
    return { route, kind: segment === 'route' ? 'api' : 'ui', segment };
  }
  const pagesMatch = file.match(NEXT_PAGES_ROUTE);
  if (pagesMatch) {
    const rest = pagesMatch[2].replace(/\/index$/, '').replace(/^index$/, '');
    const isApi = /^api(\/|$)/.test(rest);
    if (/^_(app|document|error)$/.test(rest)) return null;
    return { route: `/${rest}`, kind: isApi ? 'api' : 'ui', segment: 'page' };
  }
  return null;
}

/**
 * Routes that exist because of where a file sits rather than because of a call
 * expression. Without this, a Next.js application looks like it has no
 * entrypoints at all.
 */
export function detectFileScopedRoutes(inventory: Inventory, graph: GraphBuilder): void {
  for (const file of inventory.files) {
    if (!file.analyzable || file.generated) continue;
    const detected = nextRouteFromPath(file.path);
    if (!detected) continue;
    const fileId = stableId('file', file.path);
    if (!graph.has(fileId)) continue;
    const canonical = canonicalRoute(detected.route);
    const evidence = evidenceOf({
      kind: 'nextjs-file-route',
      path: file.path,
      startLine: 1,
      symbol: null,
      analyzer: FRAMEWORK_ANALYZER,
      confidence: CONFIDENCE.frameworkConfig,
    });

    if (detected.kind === 'ui') {
      const id = stableId('ui_route', canonical);
      graph.addEntity({
        id,
        type: 'ui_route',
        name: canonical,
        path: file.path,
        startLine: 1,
        endLine: null,
        language: null,
        confidence: CONFIDENCE.frameworkConfig,
        metadata: { framework: 'Next.js', route: canonical },
        evidence: [evidence],
      });
      graph.addEdge({ source: id, target: fileId, type: 'ROUTES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence] });
      continue;
    }

    // A route handler file exports one function per HTTP method.
    for (const exported of graph.outgoingOf(fileId)) {
      if (exported.type !== 'EXPORTS') continue;
      const entity = graph.entity(exported.target);
      if (!entity || !HTTP_METHODS.includes(entity.name.toUpperCase())) continue;
      const id = endpointId(entity.name, canonical);
      graph.addEntity({
        id,
        type: 'endpoint',
        name: `${entity.name.toUpperCase()} ${canonical}`,
        path: file.path,
        startLine: entity.startLine,
        endLine: entity.endLine,
        language: null,
        confidence: CONFIDENCE.frameworkConfig,
        metadata: { method: entity.name.toUpperCase(), route: canonical, framework: 'Next.js' },
        evidence: [evidence],
      });
      graph.addEdge({ source: id, target: entity.id, type: 'ROUTES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence] });
    }
    // Pages-router API files export a single default handler.
    if (NEXT_PAGES_ROUTE.test(file.path)) {
      const id = endpointId('ALL', canonical);
      graph.addEntity({
        id,
        type: 'endpoint',
        name: `ALL ${canonical}`,
        path: file.path,
        startLine: 1,
        endLine: null,
        language: null,
        confidence: CONFIDENCE.frameworkConfig,
        metadata: { method: 'ALL', route: canonical, framework: 'Next.js' },
        evidence: [evidence],
      });
      graph.addEdge({ source: id, target: fileId, type: 'ROUTES_TO', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence] });
    }
  }
}
