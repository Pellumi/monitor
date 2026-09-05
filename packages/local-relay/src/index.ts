import crypto from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';

export type RelayCorrelation = {
  runId: string;
  sessionId: string;
  traceId: string;
  organizationId: string;
  applicationId: string;
  environmentId: string;
};

export type BufferedRelayRequest = {
  id: string;
  path: '/v1/events' | '/v1/events/batch';
  body: unknown;
  createdAt: string;
  attempts: number;
};

export type LocalRelayOptions = {
  collectorBaseUrl: string;
  runCredential: string;
  allowedOrigin: string;
  correlation: RelayCorrelation;
  initialQueue?: BufferedRelayRequest[];
  onQueueChanged?: (queue: BufferedRelayRequest[]) => void;
  onEvents?: (events: Array<Record<string, unknown>>) => Promise<void> | void;
};

const SENSITIVE_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|private[-_]?key|credit[-_]?card|card[-_]?number|cvv|ssn)/i;

export function redactRelayValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[TRUNCATED_DEPTH]';
  if (typeof value === 'string') return value.slice(0, 16_384);
  if (Array.isArray(value)) return value.slice(0, 1_000).map((item) => redactRelayValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactRelayValue(item, depth + 1),
  ]));
}

function timingSafeToken(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function enrich(value: unknown, correlation: RelayCorrelation): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return {
    ...redactRelayValue(value) as Record<string, unknown>,
    runId: correlation.runId,
    sessionId: correlation.sessionId,
    traceId: correlation.traceId,
    tenantId: correlation.organizationId,
    applicationId: correlation.applicationId,
    environmentId: correlation.environmentId,
  };
}

function payloadFor(pathname: BufferedRelayRequest['path'], body: unknown, correlation: RelayCorrelation): unknown {
  if (pathname === '/v1/events/batch') {
    const record = body as { events?: unknown[] } | unknown[];
    if (Array.isArray(record)) return record.map((event) => enrich(event, correlation));
    if (Array.isArray(record?.events)) return { ...record, events: record.events.map((event) => enrich(event, correlation)) };
    return body;
  }
  return enrich(body, correlation);
}

export class LocalRunRelay {
  private server: http.Server | null = null;
  private relayToken: string | null = null;
  private queue: BufferedRelayRequest[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private options: LocalRelayOptions | null = null;
  private flushPromise: Promise<void> | null = null;
  private paused = false;

  async start(options: LocalRelayOptions): Promise<{ endpoint: string; relayToken: string }> {
    if (this.server) throw new Error('LOCAL_RELAY_ALREADY_RUNNING');
    const origin = new URL(options.allowedOrigin).origin;
    this.options = { ...options, allowedOrigin: origin, collectorBaseUrl: options.collectorBaseUrl.replace(/\/$/, '') };
    this.queue = [...(options.initialQueue ?? [])].slice(-5_000);
    this.relayToken = crypto.randomBytes(32).toString('base64url');
    this.paused = false;
    this.server = http.createServer((request, response) => void this.handle(request, response));
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('LOCAL_RELAY_ADDRESS_UNAVAILABLE');
    this.retryTimer = setInterval(() => void this.flush(), 5_000);
    this.retryTimer.unref?.();
    void this.flush();
    return { endpoint: `http://127.0.0.1:${address.port}`, relayToken: this.relayToken };
  }

  async stop(): Promise<void> {
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = null;
    this.paused = false;
    await this.flush();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
    this.server = null;
    this.relayToken = null;
    this.options = null;
  }

  getQueue(): BufferedRelayRequest[] {
    return this.queue.map((item) => ({ ...item }));
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) void this.flush();
  }

  async emit(eventType: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (!this.options) throw new Error('LOCAL_RELAY_NOT_RUNNING');
    const item: BufferedRelayRequest = {
      id: crypto.randomUUID(), path: '/v1/events', createdAt: new Date().toISOString(), attempts: 0,
      body: enrich({
        eventId: crypto.randomUUID(), eventVersion: '1.0', source: 'DESKTOP_AGENT',
        eventType, timestamp: new Date().toISOString(), metadata,
      }, this.options.correlation),
    };
    await this.options.onEvents?.([item.body as Record<string, unknown>]);
    if (this.paused || !await this.forward(item)) {
      this.queue.push(item);
      this.queue = this.queue.slice(-5_000);
      this.options.onQueueChanged?.(this.getQueue());
    }
  }

  private cors(response: ServerResponse): void {
    if (!this.options) return;
    response.setHeader('access-control-allow-origin', this.options.allowedOrigin);
    response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    response.setHeader('access-control-allow-headers', 'authorization, content-type, x-tellann-run-id, x-tellann-session-id, x-tellann-trace-id');
    response.setHeader('vary', 'Origin');
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    this.cors(response);
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    if (!this.options || !this.relayToken || request.method !== 'POST' || !['/v1/events', '/v1/events/batch'].includes(request.url ?? '')) {
      response.writeHead(404).end(); return;
    }
    if (request.headers.origin && request.headers.origin !== this.options.allowedOrigin) { response.writeHead(403).end(); return; }
    const authorization = request.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ') || !timingSafeToken(authorization.slice(7), this.relayToken)) {
      response.writeHead(401).end(); return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > 5 * 1024 * 1024) { response.writeHead(413).end(); return; }
      chunks.push(buffer);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { response.writeHead(400).end(); return; }
    const item: BufferedRelayRequest = {
      id: crypto.randomUUID(), path: request.url as BufferedRelayRequest['path'],
      body: payloadFor(request.url as BufferedRelayRequest['path'], body, this.options.correlation),
      createdAt: new Date().toISOString(), attempts: 0,
    };
    const record = item.body as { events?: unknown[] } | Record<string, unknown>[];
    const events = Array.isArray(record) ? record : Array.isArray(record?.events) ? record.events : [record];
    await this.options.onEvents?.(events.filter((event): event is Record<string, unknown> => Boolean(event) && typeof event === 'object' && !Array.isArray(event)));
    const delivered = this.paused ? false : await this.forward(item);
    if (!delivered) {
      this.queue.push(item);
      this.queue = this.queue.slice(-5_000);
      this.options.onQueueChanged?.(this.getQueue());
    }
    response.setHeader('content-type', 'application/json');
    response.writeHead(delivered ? 202 : 202).end(JSON.stringify({ accepted: true, buffered: !delivered }));
  }

  private async forward(item: BufferedRelayRequest): Promise<boolean> {
    if (!this.options) return false;
    try {
      const response = await fetch(`${this.options.collectorBaseUrl}${item.path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.runCredential}`, 'x-tellann-relay-request-id': item.id },
        body: JSON.stringify(item.body),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async flush(): Promise<void> {
    if (this.paused) return;
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.flushQueue().finally(() => { this.flushPromise = null; });
    return this.flushPromise;
  }

  private async flushQueue(): Promise<void> {
    if (!this.options || !this.queue.length) return;
    const remaining: BufferedRelayRequest[] = [];
    for (const item of this.queue) {
      const next = { ...item, attempts: item.attempts + 1 };
      if (!await this.forward(next)) remaining.push(next);
    }
    this.queue = remaining;
    this.options.onQueueChanged?.(this.getQueue());
  }
}
