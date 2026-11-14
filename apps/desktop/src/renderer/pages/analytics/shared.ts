import type { DesktopApplication } from "@tellann/desktop-contracts";

/** Mirrors AppShell's own `tellann:environment:<projectId>` read — the titlebar environment selector writes it. */
export function activeEnvironmentId(application: DesktopApplication | undefined, projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;
  const stored = localStorage.getItem(`tellann:environment:${projectId}`);
  if (stored && application?.environments.some((env) => env.id === stored)) return stored;
  return application?.environments[0]?.id;
}
