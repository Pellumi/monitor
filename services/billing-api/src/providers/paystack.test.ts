import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyPaystackWebhook } from './paystack';

test('Paystack webhook verification uses the integration secret key and raw bytes', () => {
  const previousSecret = process.env.PAYSTACK_SECRET_KEY;
  const previousWebhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  try {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_acceptance_secret';
    process.env.PAYSTACK_WEBHOOK_SECRET = 'must-not-be-used';
    const payload = Buffer.from('{"event":"charge.success","data":{"reference":"ref-1"}}');
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(payload).digest('hex');
    assert.equal(verifyPaystackWebhook(payload, signature), true);
    assert.equal(verifyPaystackWebhook(Buffer.from(`${payload.toString()} `), signature), false);
  } finally {
    if (previousSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousSecret;
    if (previousWebhookSecret === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET;
    else process.env.PAYSTACK_WEBHOOK_SECRET = previousWebhookSecret;
  }
});

