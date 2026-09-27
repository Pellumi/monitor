#!/usr/bin/env node
/**
 * Does every column the Prisma schema declares actually get created by a migration?
 *
 * This repository writes its migrations by hand, which is the right call — the prose in them
 * carries reasoning a generated diff cannot — but it removes the one guarantee generated
 * migrations give you for free: that the SQL and the model agree. The failure is silent and
 * late. `prisma generate` reads only the schema, so the client compiles; TypeScript is happy;
 * everything builds. The first sign is a runtime `column "x" does not exist` from a query
 * nobody ran in development.
 *
 * Offline on purpose. `prisma migrate diff` needs a shadow database, and the point of this
 * check is to run in CI and on a laptop with no Postgres at all.
 *
 * It is a lint, not a proof: it matches names textually and cannot see a type mismatch, a
 * missing constraint, or SQL that is valid but wrong. `pnpm --filter @tellann/db migrate:deploy`
 * against a real database remains the only real verification.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'packages/db/prisma/schema.prisma');
const migrationsDir = join(root, 'packages/db/prisma/migrations');

/** Models whose tables predate the migration history, created by `prisma db push`. */
const PRE_HISTORY_NOTE =
  'created by `prisma db push` before the migration history begins, so its base columns '
  + 'appear in no migration file';

function fail(message) {
  console.error(`SESSION_SCHEMA_PARITY_FAILED: ${message}`);
  process.exitCode = 1;
}

// ── Parse the models we care about out of schema.prisma ───────────────────────
// A deliberately small parser: it reads model blocks and scalar field names, and ignores
// relations, attributes and enums. Anything it cannot understand it skips rather than guesses.
function parseModels(schema) {
  const models = new Map();

  // Comments are stripped before any structure is read. A `}` inside a doc comment -- and
  // this schema has several, because the comments quote Prisma predicates like
  // `statistics: { is: null }` -- would otherwise terminate the model block early and the
  // check would report every field after it as missing. Which is exactly what the first
  // version of this script did.
  const stripped = schema.replace(/^[ \t]*\/\/.*$/gm, '');

  const modelRe = /^model\s+(\w+)\s*\{([^}]*)\}/gms;
  let match;
  while ((match = modelRe.exec(stripped))) {
    const [, name, body] = match;
    const fields = [];
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('///') || line.startsWith('@@')) continue;
      const fieldMatch = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(line);
      if (!fieldMatch) continue;
      const [, fieldName, fieldType] = fieldMatch;
      // A relation field is named after another model and has no column of its own.
      const isRelation = /@relation/.test(line) && !/^\w+\s+(String|Int|BigInt|Float|Boolean|DateTime|Json|Decimal|Bytes)/.test(line);
      if (isRelation) continue;
      // A list of another model is the inverse side of a relation: also no column.
      if (fieldMatch[3] && !/^(String|Int|BigInt|Float|Boolean|DateTime|Json|Decimal|Bytes)$/.test(fieldType)) continue;
      fields.push(fieldName);
    }
    models.set(name, fields);
  }
  return models;
}

// ── The models this change introduced or extended ─────────────────────────────
// Scoped to the session subsystem: checking all 120-odd models would flag every table that
// predates the migration history and drown the signal.
const SESSION_MODELS = [
  'SessionCompletionOutbox',
  'WorkflowExecution',
  'SessionFacet',
  'EndUser',
  'EndUserAlias',
  'ApplicationPrivacySetting',
  'ReplayChunk',
  'ApplicationReplaySetting',
  'ObservedStateMetric',
  'ObservedTransitionMetric',
  'JourneyPath',
  'JourneyPathDaily',
  'ObservedFrictionFinding',
];

/** Columns added to tables that predate the migration history. */
const ADDED_COLUMNS = {
  Session: [
    'completedAt', 'facetVersion', 'anonymousId', 'endUserId', 'identifiedAt',
    'deviceType', 'browserName', 'browserVersion', 'osName', 'osVersion',
    'viewportWidth', 'viewportHeight', 'locale', 'timezone', 'releaseVersion',
    'sampleRate', 'agentVersion', 'instrumentationManifestVersion',
  ],
  State: ['environmentId'],
  Transition: ['environmentId'],
  ApplicationPrivacySetting: ['requireConsent', 'honorDoNotTrack'],
};

function main() {
  if (!existsSync(schemaPath)) return fail(`schema not found at ${schemaPath}`);

  const schema = readFileSync(schemaPath, 'utf8');
  const models = parseModels(schema);

  const migrationFiles = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(migrationsDir, entry.name, 'migration.sql'))
    .filter(existsSync);

  if (migrationFiles.length === 0) return fail('no migration files found');

  const allSql = migrationFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

  let checked = 0;
  const problems = [];

  // ── New tables: every column must appear in the SQL ─────────────────────────
  for (const modelName of SESSION_MODELS) {
    const fields = models.get(modelName);
    if (!fields) {
      problems.push(`${modelName}: declared in the check list but absent from schema.prisma`);
      continue;
    }

    if (!new RegExp(`CREATE TABLE IF NOT EXISTS "${modelName}"`).test(allSql)) {
      problems.push(`${modelName}: no CREATE TABLE in any migration`);
      continue;
    }

    for (const field of fields) {
      checked += 1;
      // Generated columns are added by ALTER after the CREATE, so either form counts.
      if (!allSql.includes(`"${field}"`)) {
        problems.push(`${modelName}.${field}: no column of that name in any migration`);
      }
    }
  }

  // ── Extended tables: the added columns must appear in an ALTER ──────────────
  for (const [modelName, columns] of Object.entries(ADDED_COLUMNS)) {
    const fields = models.get(modelName);
    if (!fields) {
      problems.push(`${modelName}: absent from schema.prisma`);
      continue;
    }
    for (const column of columns) {
      checked += 1;
      if (!fields.includes(column)) {
        problems.push(`${modelName}.${column}: in the check list but not in schema.prisma`);
        continue;
      }
      const added = new RegExp(
        `ALTER TABLE "${modelName}"[\\s\\S]{0,120}?ADD COLUMN(?: IF NOT EXISTS)? "${column}"`,
      ).test(allSql);
      if (!added) {
        problems.push(`${modelName}.${column}: declared in the schema but no migration adds it`);
      }
    }
  }

  // ── The indexes whose absence is a silent performance cliff ────────────────
  // Not exhaustive: these are the ones whose absence caused a real problem, so their presence
  // is asserted rather than assumed.
  const REQUIRED_INDEXES = [
    // The one SessionEvent never had. Built concurrently by the schema-bootstrap job rather
    // than here, so the provenance migration is what has to mention it.
    ['SessionEvent_sessionId_timestamp_idx', 'the index SessionEvent never had'],
    ['Session_incomplete_idx', 'the completion sweep candidate query'],
    ['SessionFacet_scope_keyset_idx', 'keyset pagination'],
    ['SessionFacet_searchVector_gin_idx', 'free-text session search'],
    ['EndUser_applicationId_externalIdHash_key', 'end-user identity'],
    ['State_applicationId_environmentId_name_key', 'observed state identity'],
    ['StateObservation_sessionId_eventId_stateId_key', 'projection idempotency'],
    ['ReplayChunk_sessionId_seq_key', 'replay chunk retry safety'],
    ['JourneyPath_app_env_pathHash_key', 'journey identity'],
  ];

  for (const [indexName, why] of REQUIRED_INDEXES) {
    checked += 1;
    if (!allSql.includes(indexName)) {
      problems.push(`index ${indexName} (${why}): not mentioned in any migration`);
    }
  }

  // ── Retention must delete everything keyed by sessionId ────────────────────
  const retentionPath = join(root, 'services/background-workers/src/retention-worker.ts');
  if (existsSync(retentionPath)) {
    const retention = readFileSync(retentionPath, 'utf8');
    const SESSION_SCOPED = [
      'sessionEvent', 'sessionStatistic', 'sessionFacet', 'sessionCompletionOutbox',
      'workflowExecution', 'replayChunk', 'stateObservation', 'transitionObservation',
    ];
    for (const table of SESSION_SCOPED) {
      checked += 1;
      if (!retention.includes(`prisma.${table}.deleteMany`)) {
        problems.push(
          `retention-worker does not delete ${table}: a table keyed by sessionId that is not `
          + 'in the delete set outlives its retention window invisibly',
        );
      }
    }
  }

  console.log(`Checked ${checked} schema/migration/retention assertions across ${migrationFiles.length} migrations.`);
  console.log(`(Session, State and Transition are ${PRE_HISTORY_NOTE}; only their added columns are checked.)`);

  if (problems.length > 0) {
    for (const problem of problems) fail(problem);
    console.error(`\n${problems.length} problem(s). This is a lint: a real apply is still required.`);
    return;
  }

  console.log(JSON.stringify({
    success: true,
    migrations: migrationFiles.length,
    assertions: checked,
    note: 'Static parity only. Run `pnpm --filter @tellann/db migrate:deploy` against a real database to verify the SQL executes.',
  }, null, 2));
}

main();
