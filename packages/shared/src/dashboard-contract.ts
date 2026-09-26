/**
 * @tellann/shared/dashboard-contract — browser-safe dashboard overview contract.
 *
 * The package root (`@tellann/shared`) re-exports `./metrics`, which pulls in
 * `prom-client` and is Node-only. The contract carries runtime values as well
 * as types (`DASHBOARD_RANGES`, `isDashboardRange`), so client bundles must
 * import it from this subpath rather than from the root:
 *
 *   import { isDashboardRange } from '@tellann/shared/dashboard-contract';
 */

export * from './contracts/dashboard-overview';
