const required = {
  common: ['BILLING_ENCRYPTION_KEY', 'BILLING_CATALOG_ENV'],
  paystack: ['PAYSTACK_SECRET_KEY', 'PAYSTACK_SUCCESS_URL'],
  flutterwave: ['FLUTTERWAVE_PUBLIC_KEY', 'FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_HASH', 'FLUTTERWAVE_SUCCESS_URL'],
};

let failed = false;
for (const [provider, keys] of Object.entries(required)) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  console.log(`${provider}: ${missing.length ? `missing ${missing.join(', ')}` : 'configured'}`);
  failed ||= missing.length > 0;
}
if (process.env.BILLING_CATALOG_ENV !== 'test') {
  console.error('BILLING_CATALOG_ENV must be test for local real-provider testing.'); failed = true;
}
for (const key of ['PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY']) {
  const value = process.env[key] ?? '';
  if (/live/i.test(value) && !/test/i.test(value)) { console.error(`${key} appears to be a live key.`); failed = true; }
}
if (failed) process.exitCode = 1;
