function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || hostname === '[::1]'
      || hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/**
 * The telemetry gateway an application's SDK should send events to.
 *
 * The onboarding service falls back to http://localhost:3000 when its deployment
 * has no TELLANN_PUBLIC_GATEWAY_URL. That only works when the gateway runs on the
 * member's own machine; anywhere else the app's first event is sent to nothing
 * and installation can never be verified. Tellann Desktop already reaches a
 * working gateway at its API URL, so a loopback fallback is replaced with that.
 * An endpoint someone configured for the environment is always kept.
 */
export function resolveTelemetryGateway(input: {
  gatewayEndpoint: string;
  customized: boolean;
  desktopApiUrl: string;
}): string {
  const endpoint = input.gatewayEndpoint.replace(/\/$/, '');
  if (input.customized || !isLoopbackUrl(endpoint)) return endpoint;
  const desktopApiUrl = input.desktopApiUrl.replace(/\/$/, '');
  return desktopApiUrl && !isLoopbackUrl(desktopApiUrl) ? desktopApiUrl : endpoint;
}
