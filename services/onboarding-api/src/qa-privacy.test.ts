import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType, MemberRole, QARunMode } from '@tellann/db';
import { canRevealProtectedValue, productionRunModeAllowed } from './desktop-routes';
import {
  assertQaEncryptionConfigured,
  classifyQaValue,
  protectQaValue,
  reclassifyQaProtectedValue,
  revealQaValue,
  sanitizeQaMetadata,
  sanitizeQaUrl,
  strictestQaKind,
} from './qa-privacy';

const DEV = { production: false };
const PROD = { production: true };

/** Restores whatever the surrounding environment had after a mutation. */
function withEnv(values: Record<string, string | undefined>, body: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { body(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('classifies secrets from the key path regardless of value', () => {
  for (const path of [
    'field.password.value', 'requestBody.accessToken', 'headers.authorization',
    'storage.sessionId.newValue', 'form.cvv.value', 'checkout.cardNumber', 'upload.fileContent',
  ]) {
    assert.equal(classifyQaValue(path, 'anything'), 'SECRET', path);
  }
});

test('classifies direct identifiers from key path or value shape', () => {
  assert.equal(classifyQaValue('profile.email', 'x'), 'DIRECT_IDENTIFIER');
  assert.equal(classifyQaValue('contact.phone', 'x'), 'DIRECT_IDENTIFIER');
  assert.equal(classifyQaValue('anything', 'someone@example.com'), 'DIRECT_IDENTIFIER');
  assert.equal(classifyQaValue('anything', '+1 (555) 123-4567'), 'DIRECT_IDENTIFIER');
});

test('a bare digit run is not treated as a phone number', () => {
  // Timestamps, order numbers and numeric ids used to be pseudonymized, which
  // made ordinary values permanently unrevealable.
  for (const value of ['1730000000', '20260905', '000000012345']) {
    assert.notEqual(classifyQaValue('order.reference', value), 'DIRECT_IDENTIFIER', value);
  }
});

test('every leaf below a payload root is protected by default', () => {
  // The point of the payload roots: an ordinary body field must not fall
  // through to cleartext just because its name matches no pattern.
  assert.equal(classifyQaValue('requestBody.address', 'x'), 'ORDINARY');
  assert.equal(classifyQaValue('responseBody.customer.notes', 'x'), 'ORDINARY');
  assert.equal(classifyQaValue('websocketFrame.company', 'x'), 'ORDINARY');
  // QA telemetry outside a payload root needs no protection.
  assert.equal(classifyQaValue('role', 'button'), null);
  assert.equal(classifyQaValue('method', 'POST'), null);
});

test('strictest classification always wins', () => {
  assert.equal(strictestQaKind('ORDINARY', 'SECRET'), 'SECRET');
  assert.equal(strictestQaKind('SECRET', 'ORDINARY'), 'SECRET');
  assert.equal(strictestQaKind('DIRECT_IDENTIFIER', 'ORDINARY'), 'DIRECT_IDENTIFIER');
  assert.equal(strictestQaKind('ORDINARY', 'ORDINARY'), 'ORDINARY');
});

test('a client cannot downgrade a secret to an encrypted, revealable value', () => {
  const result = reclassifyQaProtectedValue({
    keyPath: 'field.password.value',
    kind: 'ORDINARY',
    value: 'hunter2',
    valueLength: 7,
  });
  assert.equal(result.kind, 'SECRET');
  assert.equal(result.value, undefined, 'the value must be dropped, not merely relabelled');
});

test('a client may raise, but never lower, the server classification', () => {
  const raised = reclassifyQaProtectedValue({
    keyPath: 'requestBody.freeform', kind: 'DIRECT_IDENTIFIER', value: 'x', valueLength: 1,
  });
  assert.equal(raised.kind, 'DIRECT_IDENTIFIER');
  const lowered = reclassifyQaProtectedValue({
    keyPath: 'profile.email', kind: 'ORDINARY', value: 'a@b.co', valueLength: 6,
  });
  assert.equal(lowered.kind, 'DIRECT_IDENTIFIER');
});

test('secrets are never encrypted, only recorded as present', () => {
  const envelope = protectQaValue(
    { keyPath: 'field.password.value', kind: 'SECRET', valueLength: 12 },
    DEV,
  );
  assert.equal(envelope.displayValue, '[NOT CAPTURED]');
  assert.equal(envelope.ciphertext, undefined);
  assert.equal(envelope.fingerprint, undefined);
  assert.equal(envelope.valueLength, 12);
});

test('ordinary values round-trip through encryption', () => {
  withEnv({ QA_EVIDENCE_ENCRYPTION_KEY: 'unit-test-key', QA_EVIDENCE_HMAC_KEY: 'unit-test-hmac' }, () => {
    const envelope = protectQaValue(
      { keyPath: 'requestBody.address', kind: 'ORDINARY', value: '10 Downing Street', valueLength: 17 },
      DEV,
    );
    assert.equal(envelope.displayValue, '[PROTECTED · 17 characters]');
    assert.ok(envelope.ciphertext && envelope.iv && envelope.authTag);
    assert.equal(revealQaValue({
      kind: 'ORDINARY', iv: envelope.iv!, ciphertext: envelope.ciphertext!, authTag: envelope.authTag!,
    }), '10 Downing Street');
  });
});

test('pseudonymized identifiers are stable but cannot be revealed', () => {
  withEnv({ QA_EVIDENCE_HMAC_KEY: 'unit-test-hmac' }, () => {
    const input = { keyPath: 'profile.email', kind: 'DIRECT_IDENTIFIER' as const, value: 'a@b.co', valueLength: 6 };
    const first = protectQaValue(input, DEV);
    const second = protectQaValue(input, DEV);
    assert.equal(first.fingerprint, second.fingerprint, 'fingerprints must be stable');
    assert.ok(first.displayValue.startsWith('[PSEUDONYMIZED · '));
    assert.equal(first.ciphertext, undefined);
    assert.equal(revealQaValue({ kind: 'DIRECT_IDENTIFIER', iv: null, ciphertext: null, authTag: null }), null);
  });
});

test('production never retains ordinary values even when asked to', () => {
  const envelope = protectQaValue(
    { keyPath: 'requestBody.address', kind: 'ORDINARY', value: 'secret address', valueLength: 14 },
    PROD,
  );
  assert.equal(envelope.displayValue, '[NOT CAPTURED IN PRODUCTION]');
  assert.equal(envelope.ciphertext, undefined);
});

test('missing key material fails closed on a production deployment', () => {
  withEnv({
    NODE_ENV: 'production',
    QA_EVIDENCE_ENCRYPTION_KEY: undefined,
    QA_EVIDENCE_HMAC_KEY: undefined,
  }, () => {
    assert.throws(() => assertQaEncryptionConfigured(), /QA_EVIDENCE_HMAC_KEY_REQUIRED/);
    assert.throws(
      () => protectQaValue({ keyPath: 'requestBody.a', kind: 'ORDINARY', value: 'x', valueLength: 1 }, DEV),
      /_REQUIRED/,
      'a staging capture running on a production server must not silently use a fallback key',
    );
  });
});

test('missing key material is tolerated outside production', () => {
  withEnv({
    NODE_ENV: 'test',
    QA_EVIDENCE_ENCRYPTION_KEY: undefined,
    QA_EVIDENCE_HMAC_KEY: undefined,
  }, () => {
    assert.doesNotThrow(() => assertQaEncryptionConfigured());
  });
});

test('protect and reveal derive the same key', () => {
  // These previously disagreed: writes used a fallback key while reveal
  // demanded a configured one, so values became undecryptable.
  withEnv({ NODE_ENV: 'test', QA_EVIDENCE_ENCRYPTION_KEY: undefined, QA_EVIDENCE_HMAC_KEY: undefined }, () => {
    const envelope = protectQaValue(
      { keyPath: 'requestBody.note', kind: 'ORDINARY', value: 'round trip', valueLength: 10 },
      DEV,
    );
    assert.equal(revealQaValue({
      kind: 'ORDINARY', iv: envelope.iv!, ciphertext: envelope.ciphertext!, authTag: envelope.authTag!,
    }), 'round trip');
  });
});

test('metadata is redacted recursively and reports its protected values', () => {
  withEnv({ QA_EVIDENCE_ENCRYPTION_KEY: 'unit-test-key', QA_EVIDENCE_HMAC_KEY: 'unit-test-hmac' }, () => {
    const { metadata, protectedValues } = sanitizeQaMetadata({
      method: 'POST',
      requestBody: {
        password: 'hunter2',
        email: 'someone@example.com',
        address: '10 Downing Street',
        nested: { deeper: { note: 'kept safe' } },
      },
    }, DEV);
    const body = (metadata as any).requestBody;
    assert.equal(body.password, '[NOT CAPTURED]');
    assert.ok(String(body.email).startsWith('[PSEUDONYMIZED · '));
    assert.equal(body.address, '[PROTECTED · 17 characters]');
    assert.equal(body.nested.deeper.note, '[PROTECTED · 9 characters]');
    assert.equal((metadata as any).method, 'POST', 'safe telemetry stays readable');
    assert.equal(protectedValues.length, 4);
    assert.equal(protectedValues.find((value) => value.keyPath.endsWith('password'))?.ciphertext, undefined);
  });
});

test('url sanitization keeps parameter names and drops everything sensitive', () => {
  assert.equal(
    sanitizeQaUrl('https://app.example.com/orders/42?token=abc&q=shoes#section'),
    'https://app.example.com/orders/42?q=&token=',
  );
  assert.equal(
    sanitizeQaUrl('https://user:hunter2@app.example.com/x'),
    'https://app.example.com/x',
    'credentials embedded in a URL must never be retained',
  );
  assert.equal(sanitizeQaUrl('not a url'), null);
  assert.equal(sanitizeQaUrl(undefined), null);
});

test('only the run creator and organization owners or admins may reveal', () => {
  const run = { requestingUserId: 'creator', runCreatedByUserId: 'creator' };
  assert.equal(canRevealProtectedValue({ ...run, role: MemberRole.VIEWER }), true, 'creator may reveal');
  assert.equal(canRevealProtectedValue({
    requestingUserId: 'other', runCreatedByUserId: 'creator', role: MemberRole.OWNER,
  }), true);
  assert.equal(canRevealProtectedValue({
    requestingUserId: 'other', runCreatedByUserId: 'creator', role: MemberRole.ADMIN,
  }), true);
  assert.equal(canRevealProtectedValue({
    requestingUserId: 'other', runCreatedByUserId: 'creator', role: MemberRole.MEMBER,
  }), false);
  assert.equal(canRevealProtectedValue({
    requestingUserId: 'other', runCreatedByUserId: 'creator', role: MemberRole.VIEWER,
  }), false);
});

test('a non-member is refused even when they created the run', () => {
  // Losing organization membership must revoke reveal access immediately.
  assert.equal(canRevealProtectedValue({
    requestingUserId: 'creator', runCreatedByUserId: 'creator', role: null,
  }), false);
});

test('cloud policy permits only observation-only QA runs in production', () => {
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.OBSERVATION_ONLY), true);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.GUIDED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.STAGING, QARunMode.GUIDED), true);
});

test('values already redacted upstream are not protected a second time', () => {
  // The browser observer redacts before upload and sends the real value
  // separately. Re-protecting the marker would encrypt the placeholder text and
  // emit a duplicate protected value beside the genuine one.
  const { metadata, protectedValues } = sanitizeQaMetadata({
    requestBody: {
      password: '[NOT CAPTURED]',
      email: '[PSEUDONYMIZED · abc123]',
      address: '[PROTECTED · 17 characters]',
      note: '[TRUNCATED]',
    },
  }, DEV);
  assert.equal(protectedValues.length, 0, 'no placeholder should become a protected value');
  assert.deepEqual((metadata as any).requestBody, {
    password: '[NOT CAPTURED]',
    email: '[PSEUDONYMIZED · abc123]',
    address: '[PROTECTED · 17 characters]',
    note: '[TRUNCATED]',
  });
});

test('client-state shape metadata is not mistaken for a captured value', () => {
  // `previous`/`next` carry only {type, length, populated} descriptors; only an
  // explicit *Value path is real captured data.
  const { protectedValues } = sanitizeQaMetadata({
    store: 'redux', key: 'CART_UPDATED',
    previous: { type: 'object', populated: true },
    next: { type: 'object', populated: true },
  }, DEV);
  assert.equal(protectedValues.length, 0);
});

test('an explicit captured-value path is still protected', () => {
  const { protectedValues } = sanitizeQaMetadata({
    clientState: { cartTotal: { newValue: '42.00', previousValue: '0.00' } },
  }, DEV);
  assert.equal(protectedValues.length, 2);
  assert.ok(protectedValues.every((value) => value.kind === 'ORDINARY'));
});
