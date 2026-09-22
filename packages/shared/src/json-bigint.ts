/**
 * BigInt-safe JSON responses.
 *
 * Several columns are `BigInt` - an artifact's size, a snapshot's byte total, a
 * storage ledger entry - and `JSON.stringify` throws on a BigInt rather than
 * skipping it. Express 4 does not catch an async handler's rejection, so one
 * unconverted value does not mangle a field: it fails the request, ends the
 * process, and takes every other caller down with it. That is exactly how a
 * single artifact size in one QA-run route stopped the whole onboarding API.
 *
 * Routes still convert deliberately where the wire shape matters. This is the
 * floor under them, not a substitute: a missed spot then costs a wrong-looking
 * field instead of an outage.
 */

/**
 * Serializes a BigInt as the decimal string the hand-written converters emit,
 * so a value is shaped the same whether it was converted at the route or here.
 *
 * A string rather than a number because that is what BigInt is for: past
 * `Number.MAX_SAFE_INTEGER` a JSON number silently loses precision, which is a
 * worse failure than an obvious type change.
 */
export function bigIntJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

/** The subset of an Express application this needs, so `express` stays out of the dependency list. */
type JsonReplacerHost = { set(setting: 'json replacer', value: typeof bigIntJsonReplacer): unknown };

/**
 * Installs the replacer on an Express app. Call it before the routes are
 * mounted; `res.json` reads the setting per response, so ordering is not
 * critical, but keeping it beside the other app settings is.
 */
export function useBigIntJson(app: JsonReplacerHost): void {
  app.set('json replacer', bigIntJsonReplacer);
}
