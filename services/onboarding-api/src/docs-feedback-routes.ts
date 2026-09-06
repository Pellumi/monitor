import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import { DOCS_V1_PAGE_ID_SET } from '@tellann/shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = new Set(['feedbackId', 'pageId', 'docsVersion', 'helpful']);
const processRateSecret = crypto.randomBytes(32);

export const docsFeedbackMetrics = {
  successful: 0,
  rejected: 0,
  rateLimited: 0,
  failed: 0,
};

function numberSetting(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createDocsFeedbackRouter(deps: {
  prisma: PrismaClient;
  docsOrigin?: string;
  hashSecret?: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}): Router {
  const router = Router();
  const docsOrigin = (deps.docsOrigin || process.env.DOCS_ORIGIN || process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.tellann.co').replace(/\/$/, '');
  const hashSecret = deps.hashSecret || process.env.DOCS_FEEDBACK_HASH_SECRET;
  const rateLimitMax = deps.rateLimitMax || numberSetting(process.env.DOCS_FEEDBACK_RATE_LIMIT_MAX, 30);
  const rateLimitWindowMs = deps.rateLimitWindowMs || numberSetting(process.env.DOCS_FEEDBACK_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000);
  const memoryRateBuckets = new Map<string, { count: number; resetAt: number }>();

  function cors(req: Request, res: Response) {
    const origin = req.headers.origin;
    if (!origin) return true;
    const localAllowed = process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:3021$/.test(origin);
    if (origin !== docsOrigin && !localAllowed) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return true;
  }

  router.options('/docs/feedback', (req, res) => {
    if (!cors(req, res)) return res.status(403).json({ error: 'DOCS_FEEDBACK_ORIGIN_REJECTED' });
    return res.sendStatus(204);
  });

  router.post('/docs/feedback', async (req: Request, res: Response) => {
    if (!cors(req, res)) {
      docsFeedbackMetrics.rejected += 1;
      return res.status(403).json({ error: 'DOCS_FEEDBACK_ORIGIN_REJECTED' });
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const unknown = Object.keys(body).filter((field) => !FIELDS.has(field));
    if (unknown.length || !UUID.test(String(body.feedbackId || '')) || body.docsVersion !== 'v1' || typeof body.helpful !== 'boolean' || typeof body.pageId !== 'string' || body.pageId.length > 100 || !DOCS_V1_PAGE_ID_SET.has(body.pageId)) {
      docsFeedbackMetrics.rejected += 1;
      return res.status(400).json({ error: 'DOCS_FEEDBACK_INVALID', message: 'The feedback payload is invalid.' });
    }

    const feedbackId = String(body.feedbackId);
    const pageId = body.pageId;
    const docsVersion = 'v1';
    const requestAddress = req.ip || req.socket.remoteAddress || '';
    const memoryHash = crypto.createHmac('sha256', hashSecret || processRateSecret).update(requestAddress).digest('hex');
    const persistedIpHash = hashSecret ? memoryHash : null;

    try {
      let recent = 0;
      if (persistedIpHash) {
        recent = await deps.prisma.docsPageFeedback.count({
          where: { ipHash: persistedIpHash, createdAt: { gt: new Date(Date.now() - rateLimitWindowMs) } },
        });
      } else {
        const now = Date.now();
        const bucket = memoryRateBuckets.get(memoryHash);
        if (!bucket || bucket.resetAt <= now) {
          memoryRateBuckets.set(memoryHash, { count: 0, resetAt: now + rateLimitWindowMs });
        } else {
          recent = bucket.count;
        }
      }
      if (recent >= rateLimitMax) {
        docsFeedbackMetrics.rateLimited += 1;
        res.setHeader('Retry-After', String(Math.ceil(rateLimitWindowMs / 1000)));
        return res.status(429).json({ error: 'DOCS_FEEDBACK_RATE_LIMITED' });
      }
      if (!persistedIpHash) {
        const bucket = memoryRateBuckets.get(memoryHash);
        if (bucket) bucket.count += 1;
      }

      const existing = await deps.prisma.docsPageFeedback.findUnique({
        where: { feedbackId_pageId_docsVersion: { feedbackId, pageId, docsVersion } },
      });
      if (!existing) {
        await deps.prisma.docsPageFeedback.create({ data: { feedbackId, pageId, docsVersion, helpful: body.helpful, ipHash: persistedIpHash } });
        docsFeedbackMetrics.successful += 1;
        return res.status(201).json({ status: 'RECORDED' });
      }
      if (existing.helpful !== body.helpful) {
        await deps.prisma.docsPageFeedback.update({ where: { id: existing.id }, data: { helpful: body.helpful } });
        docsFeedbackMetrics.successful += 1;
        return res.status(200).json({ status: 'UPDATED' });
      }
      docsFeedbackMetrics.successful += 1;
      return res.status(200).json({ status: 'RECORDED' });
    } catch {
      docsFeedbackMetrics.failed += 1;
      console.error('[DocsFeedback] Submission storage failed');
      return res.status(500).json({ error: 'DOCS_FEEDBACK_STORE_FAILED' });
    }
  });

  return router;
}
