import assert from 'node:assert/strict';
import test from 'node:test';
import { countAutomatedRuns } from './automated-usage';
import type { AutomatedUsagePrisma } from './automated-usage';

const rows = [
  { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: new Date('2026-01-10T00:00:00Z') },
  { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: new Date('2026-01-31T23:59:59Z') },
  { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: new Date('2026-02-01T00:00:00Z') },
  { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: new Date('2025-12-31T23:59:59Z') },
  { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: null },
  { organizationId: 'org-1', mode: 'GUIDED', startedAt: new Date('2026-01-15T00:00:00Z') },
  { organizationId: 'org-2', mode: 'AUTOMATED', startedAt: new Date('2026-01-15T00:00:00Z') },
];

const fake: AutomatedUsagePrisma = {
  qARun: {
    async count({ where }) {
      return rows.filter((row) => row.organizationId === where.organizationId && row.mode === where.mode
        && row.startedAt !== null && row.startedAt >= where.startedAt.gte && row.startedAt < where.startedAt.lt).length;
    },
  },
};

const JANUARY = { start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-02-01T00:00:00Z') };

test('only Automated runs that started inside the period, for that organisation, are counted', async () => {
  assert.equal(await countAutomatedRuns(fake, 'org-1', JANUARY), 2);
  assert.equal(await countAutomatedRuns(fake, 'org-2', JANUARY), 1);
  assert.equal(await countAutomatedRuns(fake, 'org-3', JANUARY), 0);
});

test('the period is half-open, so a run at the boundary belongs to exactly one period', async () => {
  const february = { start: JANUARY.end, end: new Date('2026-03-01T00:00:00Z') };
  assert.equal(await countAutomatedRuns(fake, 'org-1', february), 1);
  assert.equal((await countAutomatedRuns(fake, 'org-1', JANUARY)) + (await countAutomatedRuns(fake, 'org-1', february)), 3);
});

test('a run that never started used nothing and is not counted', async () => {
  const seen: unknown[] = [];
  await countAutomatedRuns({ qARun: { async count(args) { seen.push(args); return 0; } } }, 'org-1', JANUARY);
  assert.deepEqual(seen[0], { where: { organizationId: 'org-1', mode: 'AUTOMATED', startedAt: { gte: JANUARY.start, lt: JANUARY.end } } });
});
