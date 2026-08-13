import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyFlutterwaveWebhook } from './flutterwave';

test('accepts Flutterwave HMAC webhook signatures and rejects altered bodies', () => {
  process.env.FLUTTERWAVE_SECRET_HASH = 'test-webhook-hash';
  const body = Buffer.from('{"event":"charge.completed"}');
  const signature = crypto.createHmac('sha256', process.env.FLUTTERWAVE_SECRET_HASH).update(body).digest('base64');
  assert.equal(verifyFlutterwaveWebhook(body, { 'flutterwave-signature': signature }), true);
  assert.equal(verifyFlutterwaveWebhook(Buffer.from('{}'), { 'flutterwave-signature': signature }), false);
});

test('supports Flutterwave verif-hash compatibility header', () => {
  process.env.FLUTTERWAVE_SECRET_HASH = 'test-webhook-hash';
  assert.equal(verifyFlutterwaveWebhook(Buffer.from('{}'), { 'verif-hash': 'test-webhook-hash' }), true);
  assert.equal(verifyFlutterwaveWebhook(Buffer.from('{}'), { 'verif-hash': 'wrong' }), false);
});
