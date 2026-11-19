/**
 * Preload for the Session Replay window only. Deliberately NOT the main
 * `preload.ts` bridge — this window renders recorded, untrusted DOM content
 * (via rrweb's Replayer), so it gets no `window.tellann`, no file access, no
 * IPC beyond the one narrow channel it needs to receive the already-fetched,
 * already-decompressed event array from the main process.
 */
import { contextBridge, ipcRenderer } from 'electron';

const REPLAY_EVENTS_CHANNEL = 'tellann:replay:events';
const REPLAY_READY_CHANNEL = 'tellann:replay:ready';

contextBridge.exposeInMainWorld('replayBridge', {
  ready: () => ipcRenderer.send(REPLAY_READY_CHANNEL),
  onEvents: (callback: (events: unknown[]) => void) => {
    const subscription = (_: unknown, events: unknown[]) => callback(events);
    ipcRenderer.on(REPLAY_EVENTS_CHANNEL, subscription);
    return () => ipcRenderer.removeListener(REPLAY_EVENTS_CHANNEL, subscription);
  },
});
