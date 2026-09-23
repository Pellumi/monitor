/**
 * Whether the workspace behind a run has an outdated Tellann SDK installed.
 *
 * Informational only — an old SDK still reports evidence correctly, so this
 * never blocks a run. It answers "should I update?" once, when a run starts,
 * rather than the operator having to notice a version drift on their own.
 */

import { findInstalledPackage, findInstalledPythonDistribution } from './sdk-installation';
import { npmVersionStatus, pypiVersionStatus, type SdkVersionStatus } from '@tellann/instrumentation-adapters';

const JS_SDK_PACKAGES = ['@tellann/backend-sdk', '@tellann/frontend-sdk'] as const;
const PYTHON_SDK_DISTRIBUTION = 'tellann';

/**
 * Checks every SDK package the workspace actually has installed — never one
 * it does not, which would report "not outdated" for a package the project
 * was never going to use in the first place.
 */
export async function checkSdkVersions(workspaceRoot: string): Promise<SdkVersionStatus[]> {
  const statuses: SdkVersionStatus[] = [];
  for (const packageName of JS_SDK_PACKAGES) {
    const installed = findInstalledPackage(workspaceRoot, packageName);
    if (installed?.version) statuses.push(await npmVersionStatus(packageName, installed.version));
  }
  const python = findInstalledPythonDistribution(workspaceRoot, PYTHON_SDK_DISTRIBUTION);
  if (python?.version) statuses.push(await pypiVersionStatus(PYTHON_SDK_DISTRIBUTION, python.version));
  return statuses;
}
