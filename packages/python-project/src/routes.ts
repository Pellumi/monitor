import type { PythonArgument, PythonCall, PythonModule, PythonNode } from './structure';

/**
 * Framework facts read out of a parsed Python module.
 *
 * These are the same facts the TypeScript framework adapters produce - routes,
 * data models, background work, outbound calls, configuration reads - so a
 * Python service contributes the same kinds of nodes to the graph as a Node
 * one, and a flow that crosses from a React page into a Django view is a single
 * connected path rather than two disconnected halves.
 */

export type PythonRouteKind =
  | 'fastapi-decorator' | 'flask-decorator' | 'django-url' | 'django-view-method'
  | 'starlette-route' | 'drf-router' | 'flask-add-url-rule' | 'fastapi-add-route';

export type PythonRoute = {
  method: string;
  /** The path exactly as written, prefixes already composed in. */
  route: string;
  handler: string | null;
  kind: PythonRouteKind;
  line: number;
  confidence: number;
  /** Source text that justifies the route. */
  excerpt: string;
};

export type PythonModel = {
  name: string;
  /** `django`, `sqlalchemy`, `pydantic`, `mongoengine`, `tortoise`. */
  orm: string;
  /** Explicit table name, when the model declares one. */
  table: string | null;
  line: number;
  excerpt: string;
};

export type PythonDataAccess = {
  model: string;
  operation: string;
  write: boolean;
  orm: string;
  line: number;
  scope: PythonNode;
};

export type PythonTask = {
  name: string;
  kind: 'celery-task' | 'celery-schedule' | 'rq-job' | 'apscheduler-job' | 'django-command';
  line: number;
  scope: PythonNode;
};

export type PythonOutboundCall = {
  /** Absolute URL, or the relative path for a same-application call. */
  target: string;
  method: string;
  client: string;
  line: number;
  scope: PythonNode;
};

export type PythonEventUse = {
  name: string;
  publishes: boolean;
  channel: string;
  line: number;
  scope: PythonNode;
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

function firstPositional(args: PythonArgument[]): PythonArgument | undefined {
  return args.find((argument) => argument.keyword === null);
}

function stringArgument(args: PythonArgument[], keyword: string): string | null {
  const named = args.find((argument) => argument.keyword === keyword);
  return named?.stringValue ?? null;
}

/** `["GET", "POST"]` written as a literal list of string arguments. */
function methodListArgument(args: PythonArgument[], keyword: string): string[] {
  const named = args.find((argument) => argument.keyword === keyword);
  if (!named) return [];
  return [...named.text.matchAll(/['"]([A-Za-z]+)['"]/g)].map((match) => match[1].toUpperCase());
}

function joinRoute(prefix: string, route: string): string {
  const left = prefix.replace(/\/+$/, '');
  const right = route.startsWith('/') ? route : `/${route}`;
  const joined = `${left}${right}`;
  return joined || '/';
}

/**
 * Router prefixes declared in this module.
 *
 * `APIRouter(prefix="/users")` and `include_router(router, prefix="/api")` both
 * change what a decorated path actually serves. Ignoring them produces routes
 * that look right and match nothing, which is worse than no route at all.
 */
function routerPrefixes(module: PythonModule): Map<string, string> {
  const prefixes = new Map<string, string>();

  for (const assignment of module.assignments) {
    const constructor = assignment.calls.find((call) => /(^|\.)(APIRouter|Blueprint)$/.test(call.callee));
    if (!constructor) continue;
    const name = assignment.target.trim();
    const prefix = stringArgument(constructor.args, 'prefix')
      ?? stringArgument(constructor.args, 'url_prefix')
      ?? '';
    if (name) prefixes.set(name, prefix);
  }

  for (const call of module.calls) {
    if (!/(^|\.)(include_router|register_blueprint)$/.test(call.callee)) continue;
    const target = firstPositional(call.args)?.text.trim();
    if (!target) continue;
    const prefix = stringArgument(call.args, 'prefix') ?? stringArgument(call.args, 'url_prefix') ?? '';
    if (!prefix) continue;
    prefixes.set(target, joinRoute(prefix, prefixes.get(target) ?? ''));
  }

  return prefixes;
}

/** Django path converters (`<int:pk>`) and regex groups both mean "a parameter". */
export function normalizePythonRoute(route: string): string {
  return route
    .replace(/<[^:>]+:([^>]+)>/g, '{$1}')
    .replace(/<([^>]+)>/g, '{$1}')
    .replace(/\(\?P<([^>]+)>[^)]*\)/g, '{$1}')
    .replace(/\[<[^>]*>\]/g, '{param}');
}

const DJANGO_URL_CALL = /(^|\.)(path|re_path|url)$/;
const DJANGO_VIEW_BASES = /(^|\.)(View|TemplateView|ListView|DetailView|CreateView|UpdateView|DeleteView|FormView|RedirectView|APIView|GenericAPIView|ViewSet|ModelViewSet|ReadOnlyModelViewSet|GenericViewSet)$/;

export function extractPythonRoutes(module: PythonModule): PythonRoute[] {
  const routes: PythonRoute[] = [];
  const prefixes = routerPrefixes(module);

  // Decorator-driven routes: FastAPI, Flask, Starlette, Sanic, Bottle.
  for (const declaration of module.declarations) {
    if (declaration.kind !== 'function') continue;
    for (const decorator of declaration.decorators) {
      if (!decorator.called) continue;
      const segments = decorator.name.split('.');
      const member = segments[segments.length - 1].toLowerCase();
      const owner = segments.slice(0, -1).join('.');
      const prefix = prefixes.get(owner) ?? '';

      if (HTTP_METHODS.includes(member) && segments.length >= 2) {
        const route = firstPositional(decorator.args)?.stringValue ?? stringArgument(decorator.args, 'path');
        if (route === null) continue;
        routes.push({
          method: member.toUpperCase(),
          route: normalizePythonRoute(joinRoute(prefix, route)),
          handler: declaration.qualifiedName,
          kind: 'fastapi-decorator',
          line: decorator.line,
          confidence: 0.95,
          excerpt: decorator.text,
        });
        continue;
      }

      if (member === 'route' || member === 'add_route') {
        const route = firstPositional(decorator.args)?.stringValue ?? stringArgument(decorator.args, 'rule');
        if (route === null) continue;
        const methods = methodListArgument(decorator.args, 'methods');
        for (const method of methods.length ? methods : ['GET']) {
          routes.push({
            method,
            route: normalizePythonRoute(joinRoute(prefix, route)),
            handler: declaration.qualifiedName,
            kind: 'flask-decorator',
            line: decorator.line,
            confidence: 0.95,
            excerpt: decorator.text,
          });
        }
        continue;
      }

      // FastAPI's `@router.api_route("/x", methods=[...])`.
      if (member === 'api_route') {
        const route = firstPositional(decorator.args)?.stringValue;
        if (!route) continue;
        for (const method of methodListArgument(decorator.args, 'methods').length
          ? methodListArgument(decorator.args, 'methods')
          : ['GET']) {
          routes.push({
            method,
            route: normalizePythonRoute(joinRoute(prefix, route)),
            handler: declaration.qualifiedName,
            kind: 'fastapi-decorator',
            line: decorator.line,
            confidence: 0.95,
            excerpt: decorator.text,
          });
        }
      }
    }
  }

  for (const call of module.calls) {
    // Django `path("users/<int:pk>/", views.detail)` in a urlpatterns list.
    if (DJANGO_URL_CALL.test(call.callee)) {
      const positional = call.args.filter((argument) => argument.keyword === null);
      const route = positional[0]?.stringValue;
      if (route === null || route === undefined) continue;
      const handlerText = positional[1]?.text ?? null;
      const included = handlerText ? /(^|\.)include\s*\(/.test(handlerText) : false;
      routes.push({
        method: 'ALL',
        route: normalizePythonRoute(joinRoute('', route)),
        handler: included ? null : handlerText?.replace(/\.as_view\(\s*\)$/, '') ?? null,
        kind: 'django-url',
        line: call.line,
        confidence: included ? 0.7 : 0.95,
        excerpt: `${call.callee}(${positional.map((item) => item.text).join(', ')})`,
      });
      continue;
    }

    // DRF `router.register(r"users", UserViewSet)` expands into a route set.
    if (/(^|\.)register$/.test(call.callee)) {
      const positional = call.args.filter((argument) => argument.keyword === null);
      const prefix = positional[0]?.stringValue;
      const viewset = positional[1]?.text;
      if (!prefix || !viewset) continue;
      const base = joinRoute('', prefix);
      for (const [method, suffix] of [['GET', ''], ['POST', ''], ['GET', '/{pk}'], ['PUT', '/{pk}'], ['PATCH', '/{pk}'], ['DELETE', '/{pk}']] as const) {
        routes.push({
          method,
          route: normalizePythonRoute(`${base}${suffix}`),
          handler: viewset,
          kind: 'drf-router',
          line: call.line,
          confidence: 0.8,
          excerpt: `router.register('${prefix}', ${viewset})`,
        });
      }
      continue;
    }

    // Starlette `Route("/x", endpoint, methods=["GET"])`.
    if (/(^|\.)(Route|WebSocketRoute|Mount)$/.test(call.callee)) {
      const positional = call.args.filter((argument) => argument.keyword === null);
      const route = positional[0]?.stringValue;
      if (!route) continue;
      const methods = methodListArgument(call.args, 'methods');
      for (const method of methods.length ? methods : [call.member === 'WebSocketRoute' ? 'GET' : 'ALL']) {
        routes.push({
          method,
          route: normalizePythonRoute(joinRoute('', route)),
          handler: positional[1]?.text ?? null,
          kind: 'starlette-route',
          line: call.line,
          confidence: 0.9,
          excerpt: `${call.member}('${route}')`,
        });
      }
      continue;
    }

    // Flask `app.add_url_rule("/x", view_func=handler, methods=[...])`.
    if (/(^|\.)add_url_rule$/.test(call.callee)) {
      const route = firstPositional(call.args)?.stringValue ?? stringArgument(call.args, 'rule');
      if (!route) continue;
      const methods = methodListArgument(call.args, 'methods');
      for (const method of methods.length ? methods : ['GET']) {
        routes.push({
          method,
          route: normalizePythonRoute(joinRoute('', route)),
          handler: stringArgument(call.args, 'endpoint')
            ?? call.args.find((argument) => argument.keyword === 'view_func')?.text
            ?? null,
          kind: 'flask-add-url-rule',
          line: call.line,
          confidence: 0.9,
          excerpt: `add_url_rule('${route}')`,
        });
      }
      continue;
    }

    // FastAPI `app.add_api_route("/x", handler, methods=[...])`.
    if (/(^|\.)add_api_route$/.test(call.callee)) {
      const route = firstPositional(call.args)?.stringValue ?? stringArgument(call.args, 'path');
      if (!route) continue;
      const owner = call.callee.slice(0, call.callee.lastIndexOf('.'));
      const methods = methodListArgument(call.args, 'methods');
      for (const method of methods.length ? methods : ['GET']) {
        routes.push({
          method,
          route: normalizePythonRoute(joinRoute(prefixes.get(owner) ?? '', route)),
          handler: call.args.filter((argument) => argument.keyword === null)[1]?.text ?? null,
          kind: 'fastapi-add-route',
          line: call.line,
          confidence: 0.9,
          excerpt: `add_api_route('${route}')`,
        });
      }
    }
  }

  // Class-based views contribute one endpoint per HTTP method they implement.
  for (const declaration of module.declarations) {
    if (declaration.kind !== 'class') continue;
    if (!declaration.bases.some((base) => DJANGO_VIEW_BASES.test(base))) continue;
    for (const child of declaration.children) {
      if (child.kind !== 'function') continue;
      const method = child.name.toLowerCase();
      if (!HTTP_METHODS.includes(method)) continue;
      routes.push({
        method: method.toUpperCase(),
        route: `{${declaration.name}}`,
        handler: child.qualifiedName,
        kind: 'django-view-method',
        line: child.startLine,
        // The path lives in `urls.py`; this records the handler, not the URL.
        confidence: 0.6,
        excerpt: `class ${declaration.name}(${declaration.bases.join(', ')}): def ${child.name}`,
      });
    }
  }

  return routes;
}

const DJANGO_MODEL_BASE = /(^|\.)(Model|AbstractUser|AbstractBaseUser)$/;
const SQLALCHEMY_BASE = /(^|\.)(Base|DeclarativeBase|Model)$/;
const PYDANTIC_BASE = /(^|\.)(BaseModel|BaseSettings)$/;

export function extractPythonModels(module: PythonModule): PythonModel[] {
  const models: PythonModel[] = [];
  const djangoImported = module.imports.some((item) => (item.module ?? '').startsWith('django'));
  const sqlalchemyImported = module.imports.some((item) =>
    (item.module ?? '').startsWith('sqlalchemy') || item.names.some((name) => name.name === 'sqlalchemy'));

  for (const declaration of module.declarations) {
    if (declaration.kind !== 'class') continue;
    const tableAssignment = declaration.children.length === 0
      ? null
      : null;
    const table = module.assignments.find((assignment) =>
      assignment.scope === declaration && assignment.target.trim() === '__tablename__')?.stringValue ?? tableAssignment;

    if (declaration.bases.some((base) => DJANGO_MODEL_BASE.test(base)) && (djangoImported || declaration.bases.some((base) => base.includes('models.')))) {
      models.push({ name: declaration.name, orm: 'django', table, line: declaration.startLine, excerpt: `class ${declaration.name}(${declaration.bases.join(', ')})` });
      continue;
    }
    if (table !== null || (sqlalchemyImported && declaration.bases.some((base) => SQLALCHEMY_BASE.test(base)))) {
      models.push({ name: declaration.name, orm: 'sqlalchemy', table, line: declaration.startLine, excerpt: `class ${declaration.name}(${declaration.bases.join(', ')})` });
      continue;
    }
    if (declaration.bases.some((base) => PYDANTIC_BASE.test(base))) {
      models.push({ name: declaration.name, orm: 'pydantic', table: null, line: declaration.startLine, excerpt: `class ${declaration.name}(${declaration.bases.join(', ')})` });
      continue;
    }
    if (declaration.bases.some((base) => /(^|\.)Document$/.test(base))) {
      models.push({ name: declaration.name, orm: 'mongoengine', table: null, line: declaration.startLine, excerpt: `class ${declaration.name}(${declaration.bases.join(', ')})` });
    }
  }

  for (const call of module.calls) {
    if (!/(^|\.)Table$/.test(call.callee)) continue;
    const name = firstPositional(call.args)?.stringValue;
    if (!name) continue;
    models.push({ name, orm: 'sqlalchemy', table: name, line: call.line, excerpt: `Table('${name}', …)` });
  }

  return models;
}

const DJANGO_QUERY = /^([A-Z][A-Za-z0-9_]*)\.objects\.([a-z_]+)$/;
const DJANGO_INSTANCE_WRITE = /^([a-z_][A-Za-z0-9_]*)\.(save|delete)$/;
const SQLALCHEMY_SESSION = /(^|\.)(session|db\.session)\.(add|add_all|delete|merge|commit|execute|query|get|scalars|scalar)$/;
const WRITE_OPERATION = /^(create|bulk_create|update|bulk_update|update_or_create|get_or_create|delete|save|add|add_all|merge|insert|upsert)$/;

export function extractPythonDataAccess(module: PythonModule): PythonDataAccess[] {
  const access: PythonDataAccess[] = [];

  for (const call of module.calls) {
    const django = DJANGO_QUERY.exec(call.callee);
    if (django) {
      access.push({
        model: django[1],
        operation: django[2],
        write: WRITE_OPERATION.test(django[2]),
        orm: 'django',
        line: call.line,
        scope: call.scope,
      });
      continue;
    }

    const instanceWrite = DJANGO_INSTANCE_WRITE.exec(call.callee);
    if (instanceWrite) {
      access.push({
        model: instanceWrite[1],
        operation: instanceWrite[2],
        write: true,
        orm: 'django',
        line: call.line,
        scope: call.scope,
      });
      continue;
    }

    if (SQLALCHEMY_SESSION.test(call.callee)) {
      const operation = call.member;
      const model = firstPositional(call.args)?.text.replace(/\(.*$/, '').trim() || 'session';
      access.push({
        model,
        operation,
        write: WRITE_OPERATION.test(operation) || operation === 'commit',
        orm: 'sqlalchemy',
        line: call.line,
        scope: call.scope,
      });
    }
  }

  return access;
}

const TASK_DECORATOR = /(^|\.)(task|shared_task|periodic_task|job|scheduled_job)$/;

export function extractPythonTasks(module: PythonModule): PythonTask[] {
  const tasks: PythonTask[] = [];
  for (const declaration of module.declarations) {
    if (declaration.kind !== 'function') continue;
    for (const decorator of declaration.decorators) {
      if (!TASK_DECORATOR.test(decorator.name)) continue;
      const scheduled = /scheduled_job|periodic_task/.test(decorator.name);
      tasks.push({
        name: declaration.qualifiedName,
        kind: scheduled ? 'apscheduler-job' : decorator.name.includes('job') ? 'rq-job' : 'celery-task',
        line: declaration.startLine,
        scope: declaration,
      });
    }
  }
  for (const declaration of module.declarations) {
    // `class Command(BaseCommand)` is Django's management-command contract.
    if (declaration.kind === 'class' && declaration.name === 'Command'
      && declaration.bases.some((base) => /(^|\.)BaseCommand$/.test(base))) {
      tasks.push({ name: module.path, kind: 'django-command', line: declaration.startLine, scope: declaration });
    }
  }
  return tasks;
}

const HTTP_CLIENT_CALL =
  /^(requests|httpx|session|client|http|aiohttp|urllib3)?\.?(get|post|put|patch|delete|head|options|request|stream)$/;
const URLLIB_CALL = /(^|\.)urlopen$/;

export function extractPythonOutboundCalls(module: PythonModule): PythonOutboundCall[] {
  const calls: PythonOutboundCall[] = [];
  const clientImported = module.imports.some((item) =>
    ['requests', 'httpx', 'aiohttp', 'urllib', 'urllib3'].some((name) =>
      (item.module ?? '').startsWith(name) || item.names.some((entry) => entry.name.startsWith(name))));

  for (const call of module.calls) {
    const segments = call.callee.split('.');
    const owner = segments.length > 1 ? segments[0] : '';
    const isKnownClient = ['requests', 'httpx', 'aiohttp', 'urllib3'].includes(owner);
    if (URLLIB_CALL.test(call.callee)) {
      const target = firstPositional(call.args)?.stringValue;
      if (target) calls.push({ target, method: 'GET', client: 'urllib', line: call.line, scope: call.scope });
      continue;
    }
    if (!HTTP_CLIENT_CALL.test(call.callee)) continue;
    // A bare `client.get(...)` is only an HTTP call when an HTTP client is in
    // scope; otherwise it is any dictionary-like `get`.
    if (!isKnownClient && !clientImported) continue;
    const positional = call.args.filter((argument) => argument.keyword === null);
    const method = call.member === 'request' || call.member === 'stream'
      ? (positional[0]?.stringValue ?? 'GET').toUpperCase()
      : call.member.toUpperCase();
    const target = (call.member === 'request' || call.member === 'stream' ? positional[1] : positional[0])?.stringValue
      ?? stringArgument(call.args, 'url');
    if (!target) continue;
    calls.push({ target, method, client: isKnownClient ? owner : 'http', line: call.line, scope: call.scope });
  }

  return calls;
}

const PUBLISH_CALL = /(^|\.)(publish|send|send_task|apply_async|delay|enqueue|produce|dispatch|emit)$/;
const SUBSCRIBE_CALL = /(^|\.)(subscribe|consume|listen|receive|on_message)$/;

export function extractPythonEvents(module: PythonModule): PythonEventUse[] {
  const events: PythonEventUse[] = [];
  for (const call of module.calls) {
    const publishes = PUBLISH_CALL.test(call.callee);
    const subscribes = !publishes && SUBSCRIBE_CALL.test(call.callee);
    if (!publishes && !subscribes) continue;
    const name = firstPositional(call.args)?.stringValue
      ?? stringArgument(call.args, 'routing_key')
      ?? stringArgument(call.args, 'topic')
      ?? stringArgument(call.args, 'queue')
      ?? call.callee.split('.').slice(0, -1).join('.')
      ?? call.member;
    if (!name) continue;
    events.push({
      name,
      publishes,
      channel: call.member === 'delay' || call.member === 'apply_async' ? 'celery' : call.member,
      line: call.line,
      scope: call.scope,
    });
  }
  return events;
}

const ENVIRONMENT_SUBSCRIPT = /\bos\.environ\s*\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g;

/** Configuration keys the module reads, for the environment view of the graph. */
export function extractPythonEnvironmentKeys(module: PythonModule): string[] {
  const keys = new Set<string>();
  for (const call of module.calls) {
    if (!/(^|\.)(getenv|get)$/.test(call.callee)) continue;
    if (!/^(os\.getenv|os\.environ\.get|environ\.get|getenv)$/.test(call.callee)) continue;
    const key = firstPositional(call.args)?.stringValue;
    if (key) keys.add(key);
  }
  for (const match of module.source.matchAll(ENVIRONMENT_SUBSCRIPT)) keys.add(match[1]);
  return [...keys].sort();
}

const TEST_FUNCTION = /^test_/;

/** Test declarations, matching pytest and unittest conventions. */
export function extractPythonTests(module: PythonModule): PythonNode[] {
  const tests: PythonNode[] = [];
  for (const declaration of module.declarations) {
    if (declaration.kind === 'function' && TEST_FUNCTION.test(declaration.name)) {
      tests.push(declaration);
      continue;
    }
    if (declaration.kind === 'class' && declaration.bases.some((base) => /(^|\.)(TestCase|IsolatedAsyncioTestCase|SimpleTestCase|TransactionTestCase|APITestCase)$/.test(base))) {
      tests.push(declaration);
    }
  }
  return tests;
}

/** Every call in the module, indexed by the declaration that makes it. */
export function callsByScope(module: PythonModule): Map<PythonNode, PythonCall[]> {
  const index = new Map<PythonNode, PythonCall[]>();
  for (const call of module.calls) {
    const bucket = index.get(call.scope);
    if (bucket) bucket.push(call);
    else index.set(call.scope, [call]);
  }
  return index;
}
