export type DesktopUpdatePolicy =
  | { enabled: false; reason: 'DEVELOPMENT_BUILD' | 'UPDATE_URL_NOT_CONFIGURED' | 'HTTPS_UPDATE_URL_REQUIRED' | 'INVALID_UPDATE_CHANNEL' }
  | { enabled: true; url: string; channel: 'stable' | 'beta' | 'internal' };

export function resolveDesktopUpdatePolicy(input: { packaged: boolean; updateUrl?: string; channel?: string }): DesktopUpdatePolicy {
  if (!input.packaged) return { enabled: false, reason: 'DEVELOPMENT_BUILD' };
  if (!input.updateUrl) return { enabled: false, reason: 'UPDATE_URL_NOT_CONFIGURED' };
  let parsed: URL;
  try {
    parsed = new URL(input.updateUrl);
  } catch {
    return { enabled: false, reason: 'HTTPS_UPDATE_URL_REQUIRED' };
  }
  if (parsed.protocol !== 'https:') return { enabled: false, reason: 'HTTPS_UPDATE_URL_REQUIRED' };
  const channel = input.channel ?? 'stable';
  if (!['stable', 'beta', 'internal'].includes(channel)) return { enabled: false, reason: 'INVALID_UPDATE_CHANNEL' };
  return { enabled: true, url: parsed.toString(), channel: channel as 'stable' | 'beta' | 'internal' };
}
