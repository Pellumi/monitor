/**
 * DOM recording, via rrweb.
 *
 * What existed before was an event-log scrubber: no DOM was captured anywhere in the
 * codebase, and the "element preview" in the replay viewer was a mock synthesised from a
 * CSS selector. A support engineer chasing "the user cannot create an exam" saw event
 * names and had to reason about the screen from memory.
 *
 * Three things keep this from being a cost or privacy problem:
 *
 *  - rrweb is loaded with a dynamic import, so an application whose mode is OFF never
 *    downloads it and it stays out of the critical path.
 *  - Default mode is ERROR: nothing is uploaded until something goes wrong, at which
 *    point a ring buffer of the last two full snapshots is flushed. So a broken session
 *    is recorded and the other 99 are not.
 *  - The config is fetched, not configured. The SDK does not choose its own masking, and
 *    does not record at all if the fetch fails — an outage degrades to no capture rather
 *    than to capture under stale rules.
 */

export interface EffectiveReplayConfig {
  mode: 'OFF' | 'ERROR' | 'ALWAYS';
  maskAllInputs: boolean;
  maskAllText: boolean;
  blockSelectors: string[];
  maskSelectors: string[];
  recordCanvas: boolean;
  recordCrossOriginIframes: boolean;
  sampleRate: number;
  maxChunkBytes: number;
  bufferSeconds: number;
  profileHash: string;
}

export interface ReplayController {
  start(): Promise<void>;
  stop(): void;
  /** Flushes the buffer as an ERROR-triggered chunk, and keeps recording for a tail. */
  captureRetroactive(reason: string): Promise<void>;
  /** For diagnostics and tests. */
  state(): { recording: boolean; buffered: number; chunksSent: number; mode: string };
}

export interface ReplayRecorderOptions {
  endpoint: string;
  applicationId: string;
  sessionId: () => string | null;
  /** Ingest headers — the API key and the environment, as the SDK already sends them. */
  headers: () => Record<string, string>;
  config: EffectiveReplayConfig;
  debug?: boolean;
}

/** Flush thresholds, whichever comes first. */
const FLUSH_EVENT_COUNT = 200;
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_BYTES = 512 * 1024;
/** How long to keep recording after an error-triggered flush. */
const ERROR_TAIL_MS = 30_000;
/** How often rrweb is asked to emit a fresh full snapshot. */
const CHECKOUT_EVERY_MS = 30_000;

type RRWebEvent = { type: number; timestamp: number; data?: unknown };

/** rrweb's EventType.FullSnapshot. Inlined so the enum is not needed before the import. */
const FULL_SNAPSHOT = 2;

/**
 * Fetches the config an application must record under.
 *
 * Returns null on any failure, and the caller then does not record. Silence is the
 * correct failure mode: recording under rules that may have been tightened is worse than
 * not recording.
 */
export async function fetchReplayConfig(
  endpoint: string,
  headers: Record<string, string>,
): Promise<EffectiveReplayConfig | null> {
  try {
    const response = await fetch(`${endpoint}/v1/replay/config`, { headers });
    if (!response.ok) return null;
    return (await response.json()) as EffectiveReplayConfig;
  } catch {
    return null;
  }
}

/** gzip via CompressionStream where available, otherwise uncompressed. */
async function compress(payload: string): Promise<{ body: Uint8Array; encoding: 'gzip' | 'identity' }> {
  const bytes = new TextEncoder().encode(payload);
  const CompressionStreamCtor = (globalThis as Record<string, any>).CompressionStream;
  if (typeof CompressionStreamCtor !== 'function') {
    return { body: bytes, encoding: 'identity' };
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStreamCtor('gzip'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return { body: compressed, encoding: 'gzip' };
  } catch {
    // A runtime that has the constructor but cannot use it (an old Safari, a locked-down
    // worker) still uploads, just larger.
    return { body: bytes, encoding: 'identity' };
  }
}

export async function createReplayRecorder(options: ReplayRecorderOptions): Promise<ReplayController> {
  const { config } = options;
  const log = (...args: unknown[]) => { if (options.debug) console.log('[Tellann/replay]', ...args); };

  let recording = false;
  let stopFn: (() => void) | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let tailTimer: ReturnType<typeof setTimeout> | null = null;

  let buffer: RRWebEvent[] = [];
  /** Indexes in `buffer` where a full snapshot begins. */
  let checkpoints: number[] = [];
  let bufferedBytes = 0;
  let seq = 0;
  let chunksSent = 0;
  let sessionStartedAt = Date.now();
  /** True once an error has forced continuous upload for a while. */
  let inErrorTail = false;
  let profileStale = false;

  function trimBuffer() {
    // Keep from the second-to-last checkpoint onward, so a flush always begins at a full
    // snapshot and is therefore independently playable. Without that, an ERROR flush
    // could start mid-mutation and the player would have nothing to apply it to.
    if (checkpoints.length <= 2) return;
    const keepFrom = checkpoints[checkpoints.length - 2];
    buffer = buffer.slice(keepFrom);
    checkpoints = checkpoints.map((index) => index - keepFrom).filter((index) => index >= 0);
    bufferedBytes = estimateBytes(buffer);
  }

  function estimateBytes(events: RRWebEvent[]): number {
    // An estimate on purpose: serialising the whole buffer to measure it, on every event,
    // is more expensive than the decision it informs.
    return events.length * 512;
  }

  async function upload(events: RRWebEvent[], trigger: 'CONTINUOUS' | 'ERROR' | 'MANUAL'): Promise<void> {
    const sessionId = options.sessionId();
    if (!sessionId || events.length === 0) return;

    const payload = events.map((event) => JSON.stringify(event)).join('\n');
    const { body, encoding } = await compress(payload);

    const hasSnapshot = events.some((event) => event.type === FULL_SNAPSHOT);
    const startOffset = Math.max(0, events[0].timestamp - sessionStartedAt);
    const endOffset = Math.max(startOffset, events[events.length - 1].timestamp - sessionStartedAt);

    const currentSeq = seq;
    seq += 1;

    try {
      const response = await fetch(`${options.endpoint}/v1/replay/chunks`, {
        method: 'POST',
        headers: {
          ...options.headers(),
          'Content-Type': 'application/octet-stream',
          'x-tellann-session-id': sessionId,
          'x-tellann-chunk-seq': String(currentSeq),
          'x-tellann-chunk-start-ms': String(Math.round(startOffset)),
          'x-tellann-chunk-end-ms': String(Math.round(endOffset)),
          'x-tellann-chunk-events': String(events.length),
          'x-tellann-chunk-encoding': encoding,
          'x-tellann-replay-format': 'rrweb-v2',
          'x-tellann-chunk-snapshot': hasSnapshot ? 'true' : 'false',
          'x-tellann-chunk-trigger': trigger,
          'x-tellann-mask-profile-hash': config.profileHash,
        },
        body: body as unknown as BodyInit,
        keepalive: body.byteLength < 60_000,
      });

      if (response.status === 409) {
        // The masking profile was tightened while we were recording. Stop, because
        // continuing would keep producing chunks the server will refuse, and the next
        // initialisation re-fetches the config.
        profileStale = true;
        log('masking profile is stale — stopping until the next initialisation');
        stop();
        return;
      }

      if (!response.ok) {
        // Do not re-buffer. A rejected chunk is usually a quota or an entitlement answer,
        // and holding megabytes in memory hoping it changes is worse than losing it.
        log(`chunk ${currentSeq} rejected with ${response.status}`);
        return;
      }

      chunksSent += 1;
      log(`chunk ${currentSeq} accepted (${body.byteLength} bytes, ${events.length} events)`);
    } catch (error) {
      log('chunk upload failed', error);
    }
  }

  async function flush(trigger: 'CONTINUOUS' | 'ERROR' | 'MANUAL' = 'CONTINUOUS'): Promise<void> {
    if (buffer.length === 0) return;
    const events = buffer;
    buffer = [];
    checkpoints = [];
    bufferedBytes = 0;
    await upload(events, trigger);
  }

  function onEvent(event: RRWebEvent) {
    if (event.type === FULL_SNAPSHOT) checkpoints.push(buffer.length);
    buffer.push(event);
    bufferedBytes += 512;

    // ALWAYS, or the tail after an error: upload as we go.
    if (config.mode === 'ALWAYS' || inErrorTail) {
      if (buffer.length >= FLUSH_EVENT_COUNT || bufferedBytes >= FLUSH_BYTES) {
        void flush('CONTINUOUS');
      }
      return;
    }

    // ERROR mode: hold a bounded window and upload nothing until asked.
    trimBuffer();
  }

  async function start(): Promise<void> {
    if (recording || profileStale) return;
    if (config.mode === 'OFF') {
      log('mode is OFF — rrweb will not be loaded');
      return;
    }

    let record: (options: Record<string, unknown>) => (() => void) | undefined;
    try {
      // Dynamic, so rrweb (~120 KB min+gz) is a separate chunk and an application that
      // does not record never fetches it.
      const rrweb = await import('rrweb');
      record = (rrweb as unknown as { record: typeof record }).record;
    } catch (error) {
      log('rrweb failed to load — not recording', error);
      return;
    }

    sessionStartedAt = Date.now();
    const stop = record({
      emit: onEvent,
      // Guarantees a full snapshot every 30s, which is what makes a retroactive flush
      // independently playable.
      checkoutEveryNms: CHECKOUT_EVERY_MS,
      maskAllInputs: config.maskAllInputs,
      maskTextSelector: config.maskAllText ? '*' : (config.maskSelectors.join(',') || undefined),
      blockSelector: config.blockSelectors.join(',') || undefined,
      recordCanvas: config.recordCanvas,
      recordCrossOriginIframes: config.recordCrossOriginIframes,
      // Never record what the user typed. The server cannot retroactively redact a chunk,
      // so anything sensitive has to be excluded in the page or not at all.
      maskInputOptions: { password: true, email: true, tel: true, text: config.maskAllText },
    });

    stopFn = stop ?? null;
    recording = true;

    if (config.mode === 'ALWAYS') {
      flushTimer = setInterval(() => { void flush('CONTINUOUS'); }, FLUSH_INTERVAL_MS);
    }
    log(`recording in ${config.mode} mode under profile ${config.profileHash.slice(0, 8)}`);
  }

  function stop(): void {
    if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
    if (tailTimer) { clearTimeout(tailTimer); tailTimer = null; }
    if (stopFn) { stopFn(); stopFn = null; }
    recording = false;
    inErrorTail = false;
  }

  async function captureRetroactive(reason: string): Promise<void> {
    if (!recording || config.mode === 'OFF') return;
    log(`retroactive capture: ${reason}`);

    await flush('ERROR');

    // Keep uploading for a bounded tail, so the reader sees what the user did *after* the
    // error -- which is usually how you tell a cosmetic failure from a blocking one.
    inErrorTail = true;
    if (tailTimer) clearTimeout(tailTimer);
    tailTimer = setTimeout(() => {
      inErrorTail = false;
      void flush('CONTINUOUS');
    }, ERROR_TAIL_MS);
  }

  return {
    start,
    stop,
    captureRetroactive,
    state: () => ({ recording, buffered: buffer.length, chunksSent, mode: config.mode }),
  };
}
