const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_LENGTH = 32_768;
const MAX_DETECTIONS = 500;
const TIMEOUT_MS = 120_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const SCREEN_ANALYSIS_REASONS = [
  'INITIAL_STATE_UNRECOGNIZED', 'STATE_UNRECOGNIZED', 'STATE_AMBIGUOUS', 'STATE_LOW_CONFIDENCE',
  'CONTROL_NOT_FOUND', 'CONTROL_AMBIGUOUS',
] as const;
export type ScreenAnalysisReason = (typeof SCREEN_ANALYSIS_REASONS)[number];

export type ScreenAnalysisRequest = {
  requestId: string;
  reason: ScreenAnalysisReason;
  imageBase64: string;
  mimeType: 'image/png';
};

export type ScreenAnalysisResponse = {
  schemaVersion: 'tellann.screen-analysis.v1';
  requestId: string;
  model: string;
  modelRevision: string;
  image: { width: number; height: number };
  text: string;
  detections: Array<{ type: string; text: string; boxPixels: [number, number, number, number] }>;
  latencyMs: number;
};

export class ScreenAnalysisError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

function boundedString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function parseScreenAnalysisRequest(body: unknown): ScreenAnalysisRequest {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const requestId = boundedString(input.requestId, 128);
  const reason = boundedString(input.reason, 64) as ScreenAnalysisReason;
  const mimeType = input.mimeType;
  const imageBase64 = typeof input.imageBase64 === 'string' ? input.imageBase64 : '';
  if (!requestId || !SCREEN_ANALYSIS_REASONS.includes(reason) || mimeType !== 'image/png') {
    throw new ScreenAnalysisError('SCREEN_ANALYSIS_REQUEST_INVALID', 400);
  }
  if (!imageBase64 || imageBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new ScreenAnalysisError('SCREEN_ANALYSIS_IMAGE_INVALID', 400);
  }
  const image = Buffer.from(imageBase64, 'base64');
  if (image.length === 0 || image.length > MAX_IMAGE_BYTES || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new ScreenAnalysisError('SCREEN_ANALYSIS_IMAGE_INVALID', 400);
  }
  return { requestId, reason, imageBase64, mimeType: 'image/png' };
}

function positiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 40_000 ? number : null;
}

function sanitizeModalResponse(value: unknown, fallbackRequestId: string): ScreenAnalysisResponse {
  const response = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const image = response.image && typeof response.image === 'object' && !Array.isArray(response.image)
    ? response.image as Record<string, unknown> : {};
  const width = positiveInt(image.width);
  const height = positiveInt(image.height);
  const model = boundedString(response.model, 200);
  const modelRevision = boundedString(response.model_revision, 200);
  if (!width || !height || !model || !modelRevision) throw new ScreenAnalysisError('SCREEN_ANALYSIS_RESPONSE_INVALID', 502);
  const detections = (Array.isArray(response.detections) ? response.detections : []).slice(0, MAX_DETECTIONS).flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const detection = raw as Record<string, unknown>;
    const box = Array.isArray(detection.box_pixels) ? detection.box_pixels.map(Number) : [];
    if (box.length !== 4 || box.some((part) => !Number.isFinite(part) || part < 0)) return [];
    return [{
      type: boundedString(detection.type, 80),
      text: boundedString(detection.text, 500),
      boxPixels: box.map((part) => Math.round(part)) as [number, number, number, number],
    }];
  });
  return {
    schemaVersion: 'tellann.screen-analysis.v1',
    requestId: boundedString(response.request_id, 128) || fallbackRequestId,
    model,
    modelRevision,
    image: { width, height },
    text: boundedString(response.text, MAX_TEXT_LENGTH),
    detections,
    latencyMs: Math.max(0, Math.round(Number(response.latency_ms) || 0)),
  };
}

export async function proxyScreenAnalysis(
  request: ScreenAnalysisRequest,
  config: { baseUrl?: string; modalKey?: string; modalSecret?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ScreenAnalysisResponse> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '');
  if (!baseUrl || !config.modalKey || !config.modalSecret) throw new ScreenAnalysisError('SCREEN_ANALYSIS_NOT_CONFIGURED', 503);
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/v1/screen/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Modal-Key': config.modalKey,
        'Modal-Secret': config.modalSecret,
      },
      body: JSON.stringify({
        image_base64: request.imageBase64,
        mime_type: request.mimeType,
        request_id: request.requestId,
        prompt: 'Read all visible user-interface text and preserve its spatial layout.',
        max_new_tokens: 2048,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'TimeoutError' || (error as { name?: string }).name === 'AbortError') {
      throw new ScreenAnalysisError('SCREEN_ANALYSIS_TIMEOUT', 504);
    }
    throw new ScreenAnalysisError('SCREEN_ANALYSIS_UPSTREAM_UNAVAILABLE', 502);
  }
  if (!response.ok) throw new ScreenAnalysisError('SCREEN_ANALYSIS_UPSTREAM_REJECTED', 502);
  const payload = await response.json().catch(() => null);
  return sanitizeModalResponse(payload, request.requestId);
}
