import type { CodebaseAnalysis, CodeEntity } from '@tellann/desktop-contracts';
import { classifyAction, controlDescriptorFromMetadata, patternSpecificity, routeMatches } from '@tellann/automation-engine';
import type { ControlDescriptor, EdgeGuard, FormInput, NavigationEdge, NavigationGraph } from '@tellann/automation-engine';

/**
 * Bridging the codebase analysis into the shape the automation engine plans over.
 *
 * The extraction (`codebase/navigation.ts`) records what the code says: routes, the links and
 * calls that lead between them, guards, forms. Turning that into a `NavigationGraph` means
 * answering one more question the extractors could not, on their own, answer per-edge: *which*
 * page a click happens on. A `ui_action`'s own metadata never says that — it says what it does,
 * not where it lives — so this walks back from the action to the file it was declared in, and
 * from that file to the `ui_route` whose page is rendered there, the same lookup `detectFileScopedRoutes`
 * already uses to attach a Next.js route to its file.
 */

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function routeOf(entity: CodeEntity): string | null {
  return entity.type === 'ui_route' ? str(entity.metadata.route) : null;
}

/** Every `ui_route` whose page is declared in `path`, most specific first — see the module note on why file identity is what ties an action to a route. */
function routesByFile(analysis: CodebaseAnalysis): Map<string, CodeEntity[]> {
  const byFile = new Map<string, CodeEntity[]>();
  for (const entity of analysis.entities) {
    if (entity.type !== 'ui_route' || !entity.path) continue;
    const list = byFile.get(entity.path);
    if (list) list.push(entity);
    else byFile.set(entity.path, [entity]);
  }
  return byFile;
}

function guardsByRoute(analysis: CodebaseAnalysis): Map<string, EdgeGuard> {
  const guards = new Map(analysis.entities.filter((entity) => entity.type === 'ui_guard').map((entity) => [entity.id, entity]));
  const byRoute = new Map<string, EdgeGuard>();
  for (const edge of analysis.relationships) {
    if (edge.type !== 'GUARDED_BY') continue;
    const route = analysis.entities.find((entity) => entity.id === edge.source && entity.type === 'ui_route');
    const guard = guards.get(edge.target);
    const routePattern = route ? routeOf(route) : null;
    if (!routePattern || !guard) continue;
    const requiresAuth = guard.metadata.requiresAuth !== false;
    const roles = Array.isArray(guard.metadata.roles) ? guard.metadata.roles.filter((role): role is string => typeof role === 'string') : [];
    // The stricter (lowest-confidence-tolerant) reading wins when two guards name the same route,
    // since a route either needs the higher bar or it does not.
    const existing = byRoute.get(routePattern);
    const candidate: EdgeGuard = { requiresAuth, roles, confidence: guard.confidence };
    if (!existing || candidate.confidence > existing.confidence) byRoute.set(routePattern, candidate);
  }
  return byRoute;
}

export function buildNavigationGraph(analysis: CodebaseAnalysis): NavigationGraph {
  const byFile = routesByFile(analysis);
  const guards = guardsByRoute(analysis);
  const nodes = [...new Set(analysis.entities.map(routeOf).filter((route): route is string => route !== null))];

  const navigatesTo = analysis.relationships.filter((edge) => edge.type === 'NAVIGATES_TO');
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));

  const edges: NavigationEdge[] = [];
  for (const relationship of navigatesTo) {
    const action = byId.get(relationship.source);
    // The literal destination almost never equals a declared route's canonical id exactly - a
    // static `to="/courses/7"` names a real course, not the `/courses/{param}` pattern it renders
    // through - so the destination is matched against every known pattern instead of looked up by
    // the edge's own (necessarily approximate) target id. The most specific match wins, the same
    // rule the runtime planner uses when a concrete path fits more than one declared pattern.
    const destination = str(action?.metadata.destination);
    const to = destination ? bestMatchingRoute(nodes, destination) : null;
    const actionFile = action?.path ?? null;
    // No page found for this action's own file: which route it navigates *from* is unknown, so
    // the edge cannot be placed in the graph. The link itself is still real; this is a coverage
    // gap in what the graph can represent, not evidence that nothing is there.
    const from = actionFile ? routesByFileEntry(byFile, actionFile) : null;
    if (!action || !actionFile || !to || !from) continue;

    const control = controlDescriptorFromMetadata(action.metadata);
    const isLinkLike = action.metadata.element === 'a' || action.metadata.element === 'Link' || action.metadata.element === 'NavLink';
    edges.push({
      id: relationship.id,
      from,
      to,
      kind: isLinkLike ? 'LINK' : 'NAVIGATE',
      // A navigation action is a READ by construction: it changes what is on screen, not the
      // server's state. `classifyAction` still runs it through the same rule as every other
      // control, rather than hardcoding the conclusion, so a mislabelled `isNavigation` upstream
      // shows up as a wrong classification here instead of silently agreeing with itself.
      actionClass: classifyAction({ methods: [], labels: control.labels, isNavigation: true, handlerTraced: true, submitsForm: false }),
      confidence: Math.min(action.confidence, relationship.confidence),
      control,
      guard: guards.get(to) ?? null,
      evidence: { file: actionFile, symbol: action.name, line: action.startLine },
    });
  }

  return { nodes, edges };
}

function routesByFileEntry(byFile: Map<string, CodeEntity[]>, file: string): string | null {
  const routes = byFile.get(file);
  return routes && routes.length > 0 ? routeOf(routes[0]!) : null;
}

/** The most specific declared route pattern a concrete (or already-canonical) destination fits, if any. */
function bestMatchingRoute(nodes: string[], destination: string): string | null {
  const matches = nodes.filter((node) => routeMatches(node, destination));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => patternSpecificity(b) - patternSpecificity(a))[0]!;
}

/**
 * The login edge for a Flow whose initial state sits behind authentication.
 *
 * Deliberately separate from `buildNavigationGraph`: the code can say *how* a login form is
 * submitted (which control, which fields), but never *where* it leads on success — that is a
 * runtime fact about the application, not a static one, and guessing it would put a wrong
 * destination in a graph the planner otherwise treats as ground truth. Both routes are supplied by
 * the caller, which is expected to already know the login page (from the workspace scan or the
 * developer) and the destination (from wherever the Flow's own entry investigation established it).
 *
 * Returns null when `loginRoute` has no form with a password field: there is nothing here to
 * build a login step out of, and a caller should fall back to whatever else it has (an Entry
 * Recipe, or simply reporting the route unreachable).
 */
export function buildLoginEdge(analysis: CodebaseAnalysis, loginRoute: string, destinationRoute: string): NavigationEdge | null {
  const form = analysis.entities.find((entity) => {
    if (entity.type !== 'ui_form' || !entity.metadata.hasPasswordField) return false;
    const routes = analysis.entities.filter((route) => route.type === 'ui_route' && route.path === entity.path);
    return routes.some((route) => routeOf(route) === loginRoute);
  });
  if (!form || !form.path) return null;
  const formPath = form.path;

  const fields = Array.isArray(form.metadata.fields) ? form.metadata.fields as Array<{ name: string | null; label: string | null }> : [];
  const inputs: FormInput[] = fields
    .filter((field): field is { name: string; label: string | null } => typeof field.name === 'string' && field.name.length > 0)
    .map((field) => ({ name: field.name, label: field.label, dataKey: field.name }));

  const submit = form.metadata.submitControl as { labels?: string[]; testId?: string | null; domId?: string | null } | null | undefined;
  const control: ControlDescriptor = submit
    ? { labels: submit.labels ?? [], testId: submit.testId ?? null, domId: submit.domId ?? null, element: 'button', event: 'submit', actionAnchor: null, href: null }
    : { labels: [], testId: str(form.metadata.testId), domId: str(form.metadata.domId), element: 'form', event: 'submit', actionAnchor: null, href: null };

  return {
    id: `login:${form.id}`,
    from: loginRoute,
    to: destinationRoute,
    kind: 'FORM_SUBMIT',
    actionClass: 'SERVER_MUTATION',
    confidence: form.confidence,
    control,
    guard: null,
    login: inputs,
    evidence: { file: formPath, symbol: null, line: form.startLine },
  };
}
