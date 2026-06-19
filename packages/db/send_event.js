const crypto = require('crypto');

const event = {
  eventId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  tenantId: "ce779481-04fb-4ea7-a452-d0fb04b85fe0",
  applicationId: "aaa06a95-df13-4d67-9d4d-802476dd1bf2",
  source: "curl-test",
  eventVersion: "1.0",
  eventType: "SOTS_ONBOARDING_TEST",
  timestamp: new Date().toISOString(),
  metadata: {}
};

async function main() {
  const url = 'http://localhost:3000/v1/events';
  const apiKey = '1e381fd8716b66ce7ba9b089d23fa8ddc42e74c09b1e0e5e5f2c6ca9b1987a1f';
  
  console.log('Sending event to SOTS API Gateway...');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(event)
  });

  console.log('Response Status:', res.status);
  const data = await res.text();
  console.log('Response Body:', data);
}

main().catch(console.error);
