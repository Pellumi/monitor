import ts from 'typescript';
import { CONFIDENCE, evidenceOf, stableId } from './core';
import type { FileContext } from './context';
import {
  canonicalRoute, endpointId, findAncestor, literalAttribute, readableActionLabels, resolveHandler,
} from './frameworks';
import type { Inventory } from './inventory';
import type { GraphBuilder } from './core';

/**
 * The navigation graph's own extractors: React Router's route tables, the links and
 * programmatic calls that lead between routes, route guards, and `<form>` structure.
 *
 * Everything the rest of the analyzer produces (endpoints, `ui_action`s, Next.js file routes) was
 * built to answer "what does the code do"; an Automated Run additionally needs "how does a person
 * get from one page to another", which none of that captures on its own. These adapters run
 * alongside the existing ones (`applyFrameworkAdapters` in `frameworks.ts` calls every adapter on
 * every node), so a link or a `<Route>` is found in the same single AST walk as everything else.
 */

const NAVIGATION_ANALYZER = 'navigation-adapter';

// ── React Router route tables ────────────────────────────────────────────────

const ROUTER_FACTORY = /^(createBrowserRouter|createHashRouter|createMemoryRouter)$/;

/** `<Route path="/courses/:id" element={<CourseDetails/>} />`, including nested `<Route>` children. */
function jsxRouteAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  if (node.tagName.getText(context.source) !== 'Route') return;
  const path = attributeString(context, node, 'path');
  if (path === null) return;
  addReactRouterRoute(context, node, path, elementAttributeComponent(context, node));
}

/** `createBrowserRouter([{ path: '/courses/:id', element: <CourseDetails/>, children: [...] }])`. */
function routerConfigAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  const callee = ts.isIdentifier(node.expression) ? node.expression.text : null;
  if (!callee || !ROUTER_FACTORY.test(callee)) return;
  const routes = node.arguments[0];
  if (routes && ts.isArrayLiteralExpression(routes)) walkRouteConfig(context, routes, '');
}

function walkRouteConfig(context: FileContext, routes: ts.ArrayLiteralExpression, parentPath: string): void {
  for (const route of routes.elements) {
    if (!ts.isObjectLiteralExpression(route)) continue;
    const pathProperty = findProperty(route, 'path');
    const segment = pathProperty && ts.isPropertyAssignment(pathProperty) && ts.isStringLiteralLike(pathProperty.initializer)
      ? pathProperty.initializer.text : pathProperty ? null : ''; // an index route (no `path`) inherits the parent's.
    if (segment !== null) {
      const full = joinRoute(parentPath, segment);
      const elementProperty = findProperty(route, 'element') ?? findProperty(route, 'Component');
      const component = elementProperty && ts.isPropertyAssignment(elementProperty)
        ? elementComponent(context, elementProperty.initializer) : null;
      addReactRouterRoute(context, route, full, component);
      const childrenProperty = findProperty(route, 'children');
      if (childrenProperty && ts.isPropertyAssignment(childrenProperty) && ts.isArrayLiteralExpression(childrenProperty.initializer)) {
        walkRouteConfig(context, childrenProperty.initializer, full);
      }
    }
  }
}

function joinRoute(parent: string, segment: string): string {
  if (segment.startsWith('/')) return segment;
  return `${parent.replace(/\/$/, '')}/${segment}`.replace(/^(?!\/)/, '/');
}

function findProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => property.name && property.name.getText().replace(/['"]/g, '') === name);
}

/** The declaration file behind `element={<CourseDetails/>}` or `Component: CourseDetails`, when the checker can resolve it. */
function elementComponent(context: FileContext, initializer: ts.Expression): { file: string; confidence: number } | null {
  if (ts.isJsxElement(initializer) || ts.isJsxSelfClosingElement(initializer)) {
    const tag = ts.isJsxElement(initializer) ? initializer.openingElement.tagName : initializer.tagName;
    return resolveComponentFile(context, tag);
  }
  return resolveComponentFile(context, initializer);
}

function elementAttributeComponent(context: FileContext, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): { file: string; confidence: number } | null {
  for (const property of node.attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue;
    const name = property.name.getText(context.source);
    if (name !== 'element' && name !== 'Component') continue;
    const initializer = property.initializer;
    const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : initializer;
    if (expression) return elementComponent(context, expression as ts.Expression);
  }
  return null;
}

/**
 * The repo-relative file behind a resolved identifier, read back off the entity the declaration
 * pass already recorded for it — every analyzable declaration has one, so this needs no path
 * conversion of its own, only the same declaration-to-entity lookup the rest of the analyzer uses.
 */
function resolveComponentFile(context: FileContext, expression: ts.Node): { file: string; confidence: number } | null {
  const identifier = ts.isIdentifier(expression) ? expression : undefined;
  if (!identifier) return null;
  try {
    let symbol = context.checker.getSymbolAtLocation(identifier);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      try { symbol = context.checker.getAliasedSymbol(symbol); } catch { /* keep the local symbol */ }
    }
    const declaration = symbol?.declarations?.[0];
    if (!declaration) return null;
    const entityId = context.entityForDeclaration(declaration);
    const path = entityId ? context.graph.entity(entityId)?.path ?? null : null;
    return path ? { file: path, confidence: CONFIDENCE.compilerResolved } : null;
  } catch {
    return null;
  }
}

function addReactRouterRoute(context: FileContext, node: ts.Node, rawPath: string, component: { file: string; confidence: number } | null): void {
  if (!rawPath || rawPath === '*') return; // a catch-all/not-found route is not a state an Automated Run ever targets.
  const canonical = canonicalRoute(rawPath);
  const id = stableId('ui_route', canonical);
  const evidence = context.evidence(node, 'react-router-route', NAVIGATION_ANALYZER, component ? CONFIDENCE.compilerResolved : CONFIDENCE.frameworkConfig);
  // The route's identity is the page it renders (resolved through the checker when possible), so
  // the same same-file lookup that finds a Next.js page's controls finds a React Router page's too.
  const path = component?.file ?? context.file;
  context.graph.addEntity({
    id, type: 'ui_route', name: canonical, path,
    startLine: 1, endLine: null, language: null,
    confidence: component ? CONFIDENCE.compilerResolved : CONFIDENCE.frameworkConfig,
    metadata: { framework: 'react-router', route: canonical },
    evidence: [evidence],
  });
  if (component) {
    context.graph.addEdge({ source: id, target: stableId('file', path), type: 'ROUTES_TO', confidence: component.confidence, evidence: [evidence] });
  }
}

// ── Links and programmatic navigation ────────────────────────────────────────

const NAV_TAGS = new Set(['Link', 'NavLink', 'a']);
const NAV_PROPERTY_OBJECT = /^(router|history|navigation)$/i;
const NAV_FUNCTION_NAME = /^(navigate|redirect)$/;

/** `<Link to="/courses/:id">`, `<NavLink to="...">`, `<a href="...">` (internal links only). */
function linkAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = node.tagName.getText(context.source);
  if (!NAV_TAGS.has(tag)) return;
  const destination = attributeString(context, node, tag === 'a' ? 'href' : 'to');
  if (!destination || !destination.startsWith('/') || destination.startsWith('//')) return;

  const labels = readableActionLabels(context, node);
  const id = stableId('ui_action', `${context.file}:${node.pos}:navigate`);
  const evidence = context.evidence(node, 'link-navigation', NAVIGATION_ANALYZER, CONFIDENCE.ast);
  context.graph.addEntity({
    id, type: 'ui_action', name: `${labels[0] ?? destination} (navigate)`, path: context.file,
    startLine: evidence.startLine, endLine: evidence.endLine, language: null, confidence: CONFIDENCE.ast,
    metadata: {
      event: 'navigate', element: tag, labels,
      testId: literalAttribute(context, node, 'data-testid'),
      domId: literalAttribute(context, node, 'id'),
      href: destination,
      destination,
    },
    evidence: [evidence],
  });
  addNavigatesTo(context, id, destination, evidence);
}

/** `router.push('/x')`, `history.replace('/x')`, `navigate('/x')`, `redirect('/x')`. */
function programmaticNavigationAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  const destination = firstStringArgument(node);
  if (!destination || !destination.startsWith('/')) return;

  let matched: string | null = null;
  if (ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text;
    if (method !== 'push' && method !== 'replace') return;
    const object = node.expression.expression;
    const objectName = ts.isIdentifier(object) ? object.text : ts.isCallExpression(object) && ts.isIdentifier(object.expression) ? object.expression.text : null;
    if (!objectName || !NAV_PROPERTY_OBJECT.test(objectName)) return;
    matched = `${objectName}.${method}`;
  } else if (ts.isIdentifier(node.expression) && NAV_FUNCTION_NAME.test(node.expression.text)) {
    matched = node.expression.text;
  }
  if (!matched) return;

  const enclosingHandler = findAncestor(node, (candidate) => ts.isJsxAttribute(candidate) && /^on[A-Z]/.test(candidate.name.getText(context.source)));
  const element = enclosingHandler && ts.isJsxAttribute(enclosingHandler)
    ? findAncestor(enclosingHandler, (candidate) => ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate))
    : undefined;
  const labels = readableActionLabels(context, element);

  const id = stableId('ui_action', `${context.file}:${node.pos}:${matched}`);
  const evidence = context.evidence(node, 'programmatic-navigation', NAVIGATION_ANALYZER, CONFIDENCE.namingHeuristic);
  context.graph.addEntity({
    id, type: 'ui_action', name: `${labels[0] ?? matched} (navigate)`, path: context.file,
    startLine: evidence.startLine, endLine: evidence.endLine, language: null, confidence: CONFIDENCE.namingHeuristic,
    metadata: {
      event: matched, element: element && (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) ? element.tagName.getText(context.source) : null,
      labels,
      testId: element ? literalAttribute(context, element, 'data-testid') : null,
      domId: element ? literalAttribute(context, element, 'id') : null,
      destination,
    },
    evidence: [evidence],
  });
  // A resolved handler this action routes to is still useful for the executable-contract compiler.
  if (element) {
    context.graph.addEdge({ source: id, target: context.scope(), type: 'ROUTES_TO', confidence: CONFIDENCE.ast, evidence: [evidence] });
  }
  addNavigatesTo(context, id, destination, evidence);
}

function addNavigatesTo(context: FileContext, actionId: string, destination: string, evidence: ReturnType<FileContext['evidence']>): void {
  const canonical = canonicalRoute(destination);
  context.graph.addEdge({
    source: actionId, target: stableId('ui_route', canonical), type: 'NAVIGATES_TO',
    confidence: evidence.confidence, evidence: [evidence],
  });
}

function firstStringArgument(node: ts.CallExpression): string | null {
  const argument = node.arguments[0];
  return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
}

function attributeString(context: FileContext, node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string): string | null {
  return literalAttribute(context, node, name);
}

// ── Forms ─────────────────────────────────────────────────────────────────────

const FIELD_TAGS = new Set(['input', 'select', 'textarea']);

/** `<form>...</form>`: its fields, and the handler its submission is routed to (already recorded as a `ui_action` by `reactAdapter`). */
function formAdapter(context: FileContext, node: ts.Node): void {
  if (!ts.isJsxElement(node)) return;
  const opening = node.openingElement;
  if (opening.tagName.getText(context.source) !== 'form') return;

  const fields: Array<{ name: string | null; type: string | null; label: string | null }> = [];
  collectFields(context, node, fields);
  // A password field is the one reliable, i18n-proof signal that this is a login form -
  // route names and button text vary too much across applications to trust for that.
  const hasPasswordField = fields.some((field) => field.type === 'password');
  const submitControl = findSubmitControl(context, node);

  const id = stableId('ui_form', `${context.file}:${node.pos}`);
  const evidence = context.evidence(node, 'form-structure', NAVIGATION_ANALYZER, CONFIDENCE.ast);
  context.graph.addEntity({
    id, type: 'ui_form', name: `form (${fields.length} field${fields.length === 1 ? '' : 's'})`, path: context.file,
    startLine: evidence.startLine, endLine: evidence.endLine, language: null, confidence: CONFIDENCE.ast,
    metadata: {
      fields, hasPasswordField, submitControl,
      testId: literalAttribute(context, opening, 'data-testid'), domId: literalAttribute(context, opening, 'id'),
    },
    evidence: [evidence],
  });

  const onSubmit = opening.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText(context.source) === 'onSubmit');
  const initializer = onSubmit?.initializer;
  const expression = initializer && ts.isJsxExpression(initializer) ? initializer.expression : undefined;
  const handler = expression ? resolveHandler(context, expression) : undefined;
  if (handler) {
    context.graph.addEdge({ source: id, target: handler, type: 'HANDLED_BY', confidence: CONFIDENCE.compilerResolved, evidence: [evidence] });
  }
}

function collectFields(context: FileContext, node: ts.Node, out: Array<{ name: string | null; type: string | null; label: string | null }>): void {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && FIELD_TAGS.has(node.tagName.getText(context.source))) {
    out.push({
      name: literalAttribute(context, node, 'name'),
      type: literalAttribute(context, node, 'type'),
      label: readableActionLabels(context, node)[0] ?? literalAttribute(context, node, 'placeholder'),
    });
  }
  ts.forEachChild(node, (child) => collectFields(context, child, out));
}

/**
 * The control that submits a form, whether or not it has an explicit event handler.
 * `reactAdapter` only records a `ui_action` for a control with an `onClick`/`onSubmit`
 * attribute, so a plain `<button type="submit">Log in</button>` relying on native form
 * submission — the ordinary way to write a login form — would otherwise leave the form
 * with no control at all to point to.
 */
function findSubmitControl(context: FileContext, node: ts.Node): { labels: string[]; testId: string | null; domId: string | null } | null {
  let found: { labels: string[]; testId: string | null; domId: string | null } | null = null;
  const visit = (candidate: ts.Node): void => {
    if (found) return;
    if ((ts.isJsxOpeningElement(candidate) || ts.isJsxSelfClosingElement(candidate))) {
      const tag = candidate.tagName.getText(context.source);
      const type = literalAttribute(context, candidate, 'type');
      const isSubmit = (tag === 'button' && (type === 'submit' || type === null)) || (tag === 'input' && type === 'submit');
      if (isSubmit) {
        found = {
          labels: readableActionLabels(context, candidate),
          testId: literalAttribute(context, candidate, 'data-testid'),
          domId: literalAttribute(context, candidate, 'id'),
        };
        return;
      }
    }
    ts.forEachChild(candidate, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export const NAVIGATION_ADAPTERS = [jsxRouteAdapter, routerConfigAdapter, linkAdapter, programmaticNavigationAdapter, formAdapter];

export function applyNavigationAdapters(context: FileContext, node: ts.Node): void {
  for (const adapter of NAVIGATION_ADAPTERS) {
    try {
      adapter(context, node);
    } catch {
      // Consistent with applyFrameworkAdapters: one malformed construct shows up as unresolved
      // coverage, not a failed analysis.
    }
  }
}


/**
 * Whether a route pattern is the guarded prefix itself, or nests under it. A matcher (or a
 * layout's directory) names a section of the application, not one exact route, so `/dashboard`
 * must be covered by a guard on `/dashboard` just as much as `/dashboard/settings` is.
 */
function routeUnderPrefix(routePattern: string, prefix: string): boolean {
  const trimmed = prefix.replace(/\/$/, '') || '/';
  if (routePattern === trimmed) return true;
  return routePattern.startsWith(trimmed === '/' ? '/' : `${trimmed}/`);
}

// ── Guards (middleware matchers, layout redirects) ───────────────────────────

const AUTH_KEYWORDS = /\b(session|user|auth|isAuthenticated|loggedIn|currentUser)\b/i;
const ROLE_LITERAL = /['"]([A-Z][A-Z0-9_]{1,30})['"]/g;
const MIDDLEWARE_FILE = /(^|\/)middleware\.[cm]?[jt]s$/;
const LAYOUT_FILE = /(^|\/)app\/(.*\/)?layout\.[cm]?[jt]sx?$/;

/**
 * Route guards, found lexically rather than through the checker: a middleware's `matcher` config
 * and a layout's conditional redirect are both small, conventional shapes, and reading them as
 * text keeps this pass independent of whether the file even type-checks. Confidence is capped at
 * `frameworkConfig` for the structured middleware case and `namingHeuristic` for the redirect
 * heuristic, so a low-confidence guess about roles never vetoes a route outright — see
 * `guardSatisfied` in `@tellann/automation-engine`, which treats a doubtful guard as passable.
 */
export function detectGuards(readFile: (path: string) => string | null, inventory: Inventory, graph: GraphBuilder): void {
  for (const file of inventory.files) {
    if (!file.analyzable || file.generated) continue;
    if (MIDDLEWARE_FILE.test(file.path)) detectMiddlewareGuard(readFile, file.path, graph);
    else if (LAYOUT_FILE.test(file.path)) detectLayoutGuard(readFile, file.path, graph);
  }
}

function detectMiddlewareGuard(readFile: (path: string) => string | null, path: string, graph: GraphBuilder): void {
  const content = readFile(path);
  if (!content) return;
  const configMatch = content.match(/export\s+const\s+config\s*=\s*\{[^}]*matcher\s*:\s*(\[[^\]]*\]|['"][^'"]*['"])/s);
  if (!configMatch) return;
  const patterns = [...configMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => canonicalRoute(match[1]!));
  if (patterns.length === 0) return;

  const guardId = stableId('ui_guard', `middleware:${path}`);
  const evidence = evidenceOf({ kind: 'middleware-matcher', path, startLine: 1, symbol: null, analyzer: NAVIGATION_ANALYZER, confidence: CONFIDENCE.frameworkConfig });
  graph.addEntity({
    id: guardId, type: 'ui_guard', name: `middleware (${path})`, path, startLine: 1, endLine: null, language: null,
    confidence: CONFIDENCE.frameworkConfig, metadata: { requiresAuth: true, roles: [], source: 'middleware', matcher: patterns }, evidence: [evidence],
  });
  for (const route of graph.ofType('ui_route')) {
    const routePattern = typeof route.metadata.route === 'string' ? route.metadata.route : null;
    if (routePattern && patterns.some((pattern) => routeUnderPrefix(routePattern, pattern.replace(/\{param\}.*/, '')))) {
      graph.addEdge({ source: route.id, target: guardId, type: 'GUARDED_BY', confidence: CONFIDENCE.frameworkConfig, evidence: [evidence] });
    }
  }
}

function detectLayoutGuard(readFile: (path: string) => string | null, path: string, graph: GraphBuilder): void {
  const content = readFile(path);
  if (!content) return;
  // A conditional redirect whose condition mentions an auth concept: `if (!session) redirect('/login')`.
  const conditionMatch = /if\s*\(([^)]{0,200})\)\s*\{?[\s\S]{0,120}?redirect\(/.exec(content);
  if (!conditionMatch) return;
  const condition = conditionMatch[1]!;
  if (!AUTH_KEYWORDS.test(condition)) return;

  const roles = condition.toLowerCase().includes('role') ? [...condition.matchAll(ROLE_LITERAL)].map((m) => m[1]!) : [];
  const directory = path.slice(0, path.lastIndexOf('/') + 1).replace(/\([^)]*\)\//g, '');
  const routePrefix = canonicalRoute(directory.slice(directory.indexOf('app/') + 4) || '/');

  const guardId = stableId('ui_guard', `layout:${path}`);
  const evidence = evidenceOf({ kind: 'layout-redirect-guard', path, startLine: 1, symbol: null, analyzer: NAVIGATION_ANALYZER, confidence: CONFIDENCE.namingHeuristic });
  graph.addEntity({
    id: guardId, type: 'ui_guard', name: `layout guard (${path})`, path, startLine: 1, endLine: null, language: null,
    confidence: CONFIDENCE.namingHeuristic, metadata: { requiresAuth: true, roles, source: 'layout', routePrefix }, evidence: [evidence],
  });
  for (const route of graph.ofType('ui_route')) {
    const routePattern = typeof route.metadata.route === 'string' ? route.metadata.route : null;
    if (routePattern && routeUnderPrefix(routePattern, routePrefix)) {
      graph.addEdge({ source: route.id, target: guardId, type: 'GUARDED_BY', confidence: CONFIDENCE.namingHeuristic, evidence: [evidence] });
    }
  }
}
