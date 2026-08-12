import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { resolveDesktopUpdatePolicy } from './update-policy';

export type DesktopUpdateStatus =
  | { state: 'DISABLED'; reason: string }
  | { state: 'CHECKING'; channel: string };

export async function initializeUpdater(): Promise<DesktopUpdateStatus> {
  const policy = resolveDesktopUpdatePolicy({ packaged: app.isPackaged, updateUrl: process.env.TELLANN_UPDATE_URL, channel: process.env.TELLANN_UPDATE_CHANNEL });
  if (!policy.enabled) return { state: 'DISABLED', reason: policy.reason };

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = policy.channel;
  autoUpdater.setFeedURL({ provider: 'generic', url: policy.url });
  await autoUpdater.checkForUpdates();
  return { state: 'CHECKING', channel: policy.channel };
}
