/**
 * @tellann/shared/entitlements — browser-safe entitlement surface.
 *
 * The package root (`@tellann/shared`) re-exports `./metrics`, which pulls in
 * `prom-client` and is Node-only. Client bundles must import from this subpath
 * instead so server-only code never reaches the browser:
 *
 *   import { reportFormatsForTier } from '@tellann/shared/entitlements';
 */

export * from './constants/entitlements';
