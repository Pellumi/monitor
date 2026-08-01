import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

export type DesktopUpdateStatus =
  | { state: 'DISABLED'; reason: string }
  | { state: 'CHECKING'; channel: string };

export async function initializeUpdater(): Promise<DesktopUpdateStatus> {
  if (!app.isPackaged) return { state: 'DISABLED', reason: 'DEVELOPMENT_BUILD' };
  const updateUrl = process.env.TELLANN_UPDATE_URL;
  if (!updateUrl) return { state: 'DISABLED', reason: 'UPDATE_URL_NOT_CONFIGURED' };
  const parsed = new URL(updateUrl);
  if (parsed.protocol !== 'https:') return { state: 'DISABLED', reason: 'HTTPS_UPDATE_URL_REQUIRED' };

  const channel = process.env.TELLANN_UPDATE_CHANNEL ?? 'stable';
  if (!['stable', 'beta', 'internal'].includes(channel)) {
    return { state: 'DISABLED', reason: 'INVALID_UPDATE_CHANNEL' };
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = channel;
  autoUpdater.setFeedURL({ provider: 'generic', url: parsed.toString() });
  await autoUpdater.checkForUpdates();
  return { state: 'CHECKING', channel };
}
