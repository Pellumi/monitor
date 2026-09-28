import assert from 'node:assert/strict';
import test from 'node:test';
import { QAEvidenceEventSchema, QA_AUTOMATION_EVENT_TYPES } from '@tellann/desktop-contracts';
import { sanitizeQaMetadata } from './qa-privacy';

/**
 * Evidence from an Automated Run goes through the same ingestion as every other run's: it is validated against the
 * event contract, and every value in its metadata is classified by name and content, with anything that looks like a
 * secret or an identifier replaced by a protected-value placeholder. The report is rebuilt from what is *stored*, so
 * a field the classifier eats is a field the report silently loses. These tests pin that none of what an Automated
 * Run records is eaten.
 */

const ID = '11111111-1111-4111-8111-111111111111';
const base = { schemaVersion: '2.0', eventId: ID, runId: ID, sessionId: ID, traceId: null, applicationId: ID, environmentId: ID, localSequence: 1, timestamp: '2026-01-01T00:00:00.000Z', source: 'DESKTOP_AGENT', scope: 'PRE_BOUNDARY' };

/** One representative payload per event type, in the shape the run manager records. */
const SAMPLES: Record<(typeof QA_AUTOMATION_EVENT_TYPES)[number], Record<string, unknown>> = {
  QA_AUTOMATION_PLAN_CREATED: { initialStateKey: 'course_details', targetStateKey: 'exam_created', targetStateKeys: ['exam_created'], flowVersionId: 'v1', flowHash: 'a'.repeat(64), unresolvedTransitions: [], at: 1_700_000_000_000 },
  QA_AUTOMATION_PROCESS: { process: 'app', phase: 'READY', detail: 'answering on port 5173' },
  QA_AUTOMATION_STATE_EVALUATED: { recognizedStateKey: 'exam_form', confidence: 'HIGH', score: 0.91, evidence: { route: 'MATCH', sdk: 'MATCH', requiredPresent: 2, requiredTotal: 2, optionalPresent: 1, optionalTotal: 3, apiMatched: 0, apiTotal: 0 }, ambiguous: false, candidates: [{ stateKey: 'exam_form', score: 0.91 }], path: '/courses/7/exams/new' },
  QA_AUTOMATION_ACTION_SELECTED: { transitionId: 't-submit', action: 'Save exam', from: 'exam_form', expectedState: 'exam_created', actionClass: 'SERVER_MUTATION', method: 'ACTION_ANCHOR', score: 1, derivation: 'RESOLVED', codeRefs: [{ file: 'src/NewExam.tsx', symbol: 'SaveExamButton', entityId: 'e1' }], resolvedBy: { resolver: 'local', rationale: 'the exam link', agreement: ['destination', 'label'] } },
  QA_AUTOMATION_ACTION_EXECUTED: { transitionId: 't-submit', ok: true, error: null },
  QA_AUTOMATION_ACTION_VERIFIED: { transitionId: 't-submit', ok: true, expectedState: 'exam_created', observedState: 'exam_created', confidence: 'HIGH', errorsSince: 0 },
  QA_AUTOMATION_ACTION_BLOCKED: { reason: 'RESOLVER_PROPOSAL_REJECTED', transitionId: 't-open', from: 'list', expectedState: 'exam_page', detail: 'DESTINATION_DISAGREES: the control links to /help' },
  QA_AUTOMATION_REPLAN: { reason: 'NO_PROGRESS', expected: 'exam_created', observed: null, attempt: 1 },
  QA_AUTOMATION_INITIAL_STATE_REACHED: { stateKey: 'course_details', confidence: 'HIGH' },
  QA_AUTOMATION_TERMINAL_STATE_REACHED: { stateKey: 'exam_created', confidence: 'HIGH', evidence: { route: 'MATCH', sdk: 'MATCH' } },
  QA_AUTOMATION_STOPPED: { stopReason: 'TRANSITION_DID_NOT_ADVANCE', detail: 'Save exam was performed but exam_created did not follow.', steps: 2, replans: 1 },
  QA_AUTOMATION_CODE_EVIDENCE: { subject: { kind: 'TRANSITION', id: 't-submit' }, stateKey: 'exam_form', derivation: 'RESOLVED', refs: [{ file: 'src/NewExam.tsx', symbol: 'SaveExamButton', startLine: 40, endLine: 44, excerptSha256: 'b'.repeat(64) }], calls: ['POST /api/exams'], navigatesTo: [], guards: [{ kind: 'middleware', name: 'middleware', file: 'middleware.ts', requiresAuth: true, roles: ['TEACHER'], route: '/exams/created' }], expectedApi: [{ method: 'POST', route: '/api/exams' }], summary: '"Save exam" is mapped to SaveExamButton (src/NewExam.tsx:40-44). The handler calls POST /api/exams.', reasons: ['ACTION_DID_NOT_ADVANCE'] },
  QA_AUTOMATION_TRACE_RETAINED: { stateKey: 'exam_form', reasons: ['ACTION_DID_NOT_ADVANCE', 'RUNTIME_ERRORS'] },
  QA_AUTOMATION_RENDER_TIMING: { stateKey: 'exam_form', samples: [{ component: 'ExamForm', states: ['exam_form'], mounts: 1, updates: 3, totalMs: 13.3, maxMs: 5 }] },
  QA_AUTOMATION_MANUAL_ACTION_REQUIRED: { kind: 'MFA', detail: 'This page asks for a one-time verification code. That code belongs to the person signing in, so Tellann needs you to enter it.', location: 'app.example.test/login' },
  QA_AUTOMATION_MANUAL_ACTION_COMPLETED: { outcome: 'COMPLETED', waitedMs: 41_000 },
};

test('every automation event type is one the ingestion contract accepts', () => {
  for (const eventType of QA_AUTOMATION_EVENT_TYPES) {
    const parsed = QAEvidenceEventSchema.safeParse({ ...base, eventType, metadata: SAMPLES[eventType] });
    assert.equal(parsed.success, true, `${eventType}: ${parsed.success ? '' : JSON.stringify(parsed.error.flatten())}`);
  }
});

test('there is a sample for every event type, so a new one cannot slip in untested', () => {
  assert.deepEqual(Object.keys(SAMPLES).sort(), [...QA_AUTOMATION_EVENT_TYPES].sort());
});

test('ingestion stores everything an automation event says, with nothing turned into a protected value', () => {
  for (const eventType of QA_AUTOMATION_EVENT_TYPES) {
    const sanitized = sanitizeQaMetadata(SAMPLES[eventType], { production: false });
    assert.deepEqual(sanitized.protectedValues, [], `${eventType} produced a protected value`);
    assert.deepEqual(sanitized.metadata, SAMPLES[eventType], `${eventType} was altered on the way in`);
  }
});

test('the same events are stored intact in production too', () => {
  for (const eventType of QA_AUTOMATION_EVENT_TYPES) {
    assert.deepEqual(sanitizeQaMetadata(SAMPLES[eventType], { production: true }).metadata, SAMPLES[eventType], eventType);
  }
});

test('an automation event that carried something that looks like a secret would be protected, not stored', () => {
  const leaky = sanitizeQaMetadata({ ...SAMPLES.QA_AUTOMATION_ACTION_SELECTED, password: 'hunter2', typedEmail: 'teacher@lms.test' }, { production: false });
  assert.ok(leaky.protectedValues.length >= 1);
  assert.ok(!JSON.stringify(leaky.metadata).includes('hunter2'));
});

test('an event with an unknown type is still refused', () => {
  assert.equal(QAEvidenceEventSchema.safeParse({ ...base, eventType: 'QA_AUTOMATION_TELEPORTED', metadata: {} }).success, false);
});
