import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createContactRouter } from './contact-routes';

/**
 * The contact route is pure request handling over two collaborators, so both
 * are stubbed rather than reaching for a database — these tests are about what
 * the endpoint accepts, stores and refuses.
 */
function harness(options: { existingFromIp?: number } = {}) {
  const created: any[] = [];
  const sent: any[] = [];
  const prisma = {
    contactSubmission: {
      count: async () => options.existingFromIp ?? 0,
      create: async ({ data }: any) => {
        const row = { id: `submission-${created.length + 1}`, notifiedAt: null, ...data };
        created.push(row);
        return row;
      },
      update: async ({ data }: any) => ({ ...created[created.length - 1], ...data }),
    },
  };
  const emailService = {
    sendTransactional: async (input: any) => {
      sent.push(input);
      return { status: 'SENT' as const };
    },
  };
  const app = express();
  app.use(express.json());
  app.use(createContactRouter({ prisma: prisma as never, emailService: emailService as never }));
  return { app, created, sent };
}

async function post(app: express.Express, body: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) as any };
  } finally {
    server.close();
  }
}

const VALID = {
  type: 'SALES',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'Ada@Example.COM',
  message: 'We are evaluating Tellann for a team of eight engineers.',
};

test('stores a valid submission and notifies the team', async () => {
  process.env.CONTACT_NOTIFICATION_EMAIL = 'ops@tellann.test';
  const { app, created, sent } = harness();
  const result = await post(app, { ...VALID, organization: 'Analytical Engines' });

  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'RECEIVED');
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'SALES');
  assert.equal(created[0].organization, 'Analytical Engines');
  // Addresses are normalised so the same person is one row, not two.
  assert.equal(created[0].email, 'ada@example.com');

  // The notification is fired without awaiting it, so let the microtask run.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ops@tellann.test');
  assert.equal(sent[0].replyTo, 'ada@example.com');
});

test('keeps only the fields the form actually asks for', async () => {
  const { app, created } = harness();
  await post(app, {
    ...VALID,
    type: 'PARTNERSHIP',
    partnershipType: 'Technology',
    website: 'https://example.test',
    isAdmin: true,
    note: 'unsolicited',
  });

  assert.deepEqual(created[0].details, {
    partnershipType: 'Technology',
    website: 'https://example.test',
  });
});

test('a partnership website is a real answer, not the honeypot', async () => {
  // The honeypot used to be named `website`, which silently discarded every
  // partnership enquiry that filled the field in.
  const { app, created } = harness();
  const result = await post(app, { ...VALID, type: 'PARTNERSHIP', website: 'https://partner.test' });

  assert.equal(result.status, 201);
  assert.equal(created.length, 1);
  assert.equal(created[0].details.website, 'https://partner.test');
});

test('a filled honeypot is accepted and dropped', async () => {
  const { app, created, sent } = harness();
  const result = await post(app, { ...VALID, referralCode: 'bot-was-here' });

  // Same shape a real submission gets, so a bot learns nothing from the reply.
  assert.equal(result.status, 202);
  assert.equal(result.body.status, 'RECEIVED');
  assert.equal(created.length, 0);
  assert.equal(sent.length, 0);
});

test('reports validation failures per field', async () => {
  const { app, created } = harness();
  const result = await post(app, { type: 'SUPPORT', firstName: 'Ada', email: 'not-an-email', message: 'too short' });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'CONTACT_VALIDATION_FAILED');
  assert.equal(result.body.fields.lastName, 'This field is required.');
  assert.equal(result.body.fields.email, 'Enter a valid email address.');
  assert.ok(result.body.fields.message);
  assert.equal(created.length, 0);
});

test('rejects a contact type that is not one of the routes', async () => {
  const { app, created } = harness();
  const result = await post(app, { ...VALID, type: 'CHAIRMAN' });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'CONTACT_TYPE_INVALID');
  assert.equal(created.length, 0);
});

test('refuses a sender who has already flooded the window', async () => {
  const { app, created } = harness({ existingFromIp: 5 });
  const result = await post(app, VALID);

  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'CONTACT_RATE_LIMITED');
  assert.equal(created.length, 0);
});

test('falls back to the built-in address when none is configured', async () => {
  delete process.env.CONTACT_NOTIFICATION_EMAIL;
  const { app, created, sent } = harness();
  const result = await post(app, VALID);

  assert.equal(result.status, 201);
  assert.equal(created.length, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'tellann.technologies@gmail.com');
});

test('storing the message does not depend on the notification going out', async () => {
  process.env.CONTACT_NOTIFICATION_EMAIL = 'ops@tellann.test';
  const { app, created } = harness();
  // A mail provider outage must not cost the sender their message.
  const result = await post(app, VALID);

  assert.equal(result.status, 201);
  assert.equal(created.length, 1);
});
