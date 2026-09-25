/**
 * Route canonicalisation, shared by everything that groups traffic by endpoint.
 *
 * A route only groups correctly when every producer reduces it the same way.
 * A framework template such as `/schools/<int:pk>/analytics/`, a Next.js
 * `/orders/[id]`, an Express `/orders/:id` and an analysed `/orders/{param}`
 * are the same endpoint, and treating them as four turns one route into four
 * rows — or, worse, turns `/orders/17` and `/orders/18` into two endpoints and
 * an unbounded cardinality problem.
 *
 * Kept free of dependencies on purpose: `@tellann/shared` must not pull in
 * Prisma, so this stays pure string work that any service can import.
 */
export function canonicalRoute(input: string): string {
  let route = input.trim();
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/[?#].*$/, '');
  route = route.replace(/\/+$/, '') || '/';
  route = route
    // Next.js catch-all and optional catch-all: [...slug], [[...slug]]
    .replace(/\[\.{3}[^\]]+\]/g, '{param}')
    // Next.js dynamic segment: [id]
    .replace(/\[\[?([^\]]+)\]?\]/g, '{param}')
    // Express / Rails / Fastify: :id
    .replace(/:[A-Za-z0-9_]+/g, '{param}')
    // Already-templated: {id}
    .replace(/\{[^}]*\}/g, '{param}')
    // Template literal: ${id}
    .replace(/\$\{[^}]*\}/g, '{param}')
    // Django / Flask converters: <int:pk>
    .replace(/<[^>]*>/g, '{param}');
  return route.toLowerCase();
}

/**
 * A numeric or uuid-looking path segment replaced with `{param}`.
 *
 * `canonicalRoute` only normalises segments a framework already marked as
 * dynamic. When the only thing available is the concrete path a client called,
 * the identifiers have to be recognised by shape instead, or every record id
 * becomes its own endpoint.
 */
const IDENTIFIER_SEGMENT =
  /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24}|[0-9a-f]{32})$/i;

export function canonicalRouteFromPath(input: string): string {
  const canonical = canonicalRoute(input);
  if (canonical === '/') return canonical;
  return canonical
    .split('/')
    .map((segment) => (IDENTIFIER_SEGMENT.test(segment) ? '{param}' : segment))
    .join('/');
}
