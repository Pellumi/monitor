import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';

export type StoredDesktopSession = {
  accessToken: string;
  refreshToken: string;
  deviceSessionId: string;
  user: { id: string; email: string; displayName: string | null };
};

const fileName = 'desktop-session.bin';

function sessionPath(): string {
  return path.join(app.getPath('userData'), fileName);
}

export function loadDesktopSession(): StoredDesktopSession | null {
  const file = sessionPath();
  if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(file))) as StoredDesktopSession;
  } catch {
    return null;
  }
}

export function saveDesktopSession(value: StoredDesktopSession): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('WINDOWS_SECURE_STORAGE_UNAVAILABLE');
  fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
  fs.writeFileSync(sessionPath(), safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
}

export function clearDesktopSession(): void {
  const file = sessionPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
