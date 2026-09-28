import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Project } from 'ts-morph';
import { applyControlAnchor, checkAnchorTarget, createApprovalHash, getAdapter, locateControlElement, validateInstrumentationPlan } from './index';
import type { ControlAnchorTarget, LocalProjectContext } from './index';

const COURSE = `import { useState } from 'react';
import { Button } from './ui';

export function Course() {
  const [n, setN] = useState(0);
  return (
    <div>
      <h1>Course</h1>
      <button onClick={() => setN(n + 1)}>Create Exam</button>
      <Button onClick={() => setN(n + 2)}>Custom control</Button>
      <a href="/students">Students</a>
      <div>
        <button id="dup">Save</button> <button id="dup2">Save</button>
      </div>
      <button data-tellann-action="someone-elses" onClick={() => setN(0)}>Reset</button>
      <button
        type="button"
        onClick={() => setN(n + 3)}
      >
        Multi-line
      </button>
      <input type="text" name="title" />
    </div>
  );
}
`;

function project(files: Record<string, string> = { 'src/Course.tsx': COURSE }): LocalProjectContext {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-anchor-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { build: 'tsc --noEmit' }, dependencies: { react: '^19.0.0', vite: '^7.0.0' } }, null, 2));
  fs.writeFileSync(path.join(root, 'src/main.tsx'), `import React from 'react';\ncreateRoot(document.body).render(<div />);\n`);
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(root, name), content);
  return {
    workspaceRoot: root, environmentType: 'DEVELOPMENT',
    snapshot: {
      workspaceId: '00000000-0000-4000-8000-000000000001', revision: null, branch: null, dirty: true,
      repositoryFingerprint: 'a'.repeat(64), languages: ['.ts', '.tsx'], packageManager: 'npm', frameworks: [], routes: [], endpoints: [],
      documentation: [], manifestHashes: {}, scannerVersion: 'test', redactionSummary: { excludedFiles: 0, suspectedSecrets: 0 },
    },
  };
}

const lineOf = (needle: string) => COURSE.split('\n').findIndex((line) => line.includes(needle)) + 1;
const target = (id: string, needle: string, element: string | null, endOffset = 0): ControlAnchorTarget => ({
  transitionId: id, value: `tellann:${id}`, file: 'src/Course.tsx', startLine: lineOf(needle), endLine: lineOf(needle) + endOffset, element, label: id,
});
const source = (content = COURSE) => new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true }).createSourceFile('src/Course.tsx', content);

// -- locating ---------------------------------------------------------------

test('a native control is found at the line the analysis gave for it', () => {
  const found = locateControlElement(source(), target('t1', 'Create Exam', 'button'), 'tellann:t1');
  assert.equal(found.ok, true);
  assert.equal(found.ok && found.element.getTagNameNode().getText(), 'button');
});

test('a control whose element starts on a line by itself and spans several is found', () => {
  assert.equal(locateControlElement(source(), target('t', '<button\n', 'button', 6), 'v').ok, false, 'sanity: a search for a newline never matches a line');
  const start = COURSE.split('\n').findIndex((line, index, all) => line.trim() === '<button' && all[index + 1]?.includes('type="button"')) + 1;
  const found = locateControlElement(source(), { file: 'src/Course.tsx', startLine: start, endLine: start + 5, element: 'button' }, 'tellann:m');
  assert.equal(found.ok, true);
});

test('a custom component is never anchored, since it may not pass the attribute to the page', () => {
  const found = locateControlElement(source(), target('t2', 'Custom control', 'Button'), 'tellann:t2');
  assert.deepEqual(found, { ok: false, reason: 'CUSTOM_COMPONENT' });
});

test('two equally good candidates are refused rather than guessed between', () => {
  const start = lineOf('id="dup"');
  const found = locateControlElement(source(), { file: 'src/Course.tsx', startLine: start, endLine: start, element: 'button' }, 'tellann:x');
  assert.deepEqual(found, { ok: false, reason: 'AMBIGUOUS' });
});

test('nothing at that location is reported as not found', () => {
  assert.deepEqual(locateControlElement(source(), target('t', 'Create Exam', 'span'), 'v'), { ok: false, reason: 'NOT_FOUND' });
  assert.deepEqual(locateControlElement(source(), { file: 'x', startLine: 900, endLine: 900, element: null }, 'v'), { ok: false, reason: 'NOT_FOUND' });
});

test('an anchor someone else put there is never overwritten, and our own is recognised', () => {
  const theirs = locateControlElement(source(), target('t', 'Reset', 'button'), 'tellann:t');
  assert.deepEqual(theirs, { ok: false, reason: 'ANCHORED_DIFFERENTLY' });
  const ours = locateControlElement(source(), target('t', 'Reset', 'button'), 'someone-elses');
  assert.equal(ours.ok && ours.alreadyAnchored, true);
});

test('a file that is not JSX cannot be anchored', () => {
  const plain = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true }).createSourceFile('src/a.ts', 'export const x = 1;');
  assert.deepEqual(locateControlElement(plain, { file: 'src/a.ts', startLine: 1, endLine: 1, element: null }, 'v'), { ok: false, reason: 'NOT_JSX' });
});

// -- applying ---------------------------------------------------------------

test('the anchor is added to the control, once, and only there', () => {
  const file = source();
  applyControlAnchor(file, target('t1', 'Create Exam', 'button'), 'tellann:t1', 'anchor:t1');
  applyControlAnchor(file, target('t1', 'Create Exam', 'button'), 'tellann:t1', 'anchor:t1');
  const text = file.getFullText();
  assert.equal(text.split('data-tellann-action="tellann:t1"').length - 1, 1, 'idempotent');
  assert.match(text, /<button onClick=\{\(\) => setN\(n \+ 1\)\} data-tellann-action="tellann:t1">Create Exam<\/button>/);
  assert.equal(text.replace(/ data-tellann-action="tellann:t1"/, ''), COURSE, 'nothing else changed');
});

test('an invalid anchor value is refused', () => {
  assert.throws(() => applyControlAnchor(source(), target('t1', 'Create Exam', 'button'), 'has spaces"', 'x'), /INVALID_CONTROL_ANCHOR_VALUE/);
});

test('an element that can no longer be found fails loudly instead of anchoring something else', () => {
  assert.throws(() => applyControlAnchor(source(), target('t1', 'Create Exam', 'span'), 'tellann:t1', 'anchor:t1'), /SAFE_CONTROL_ELEMENT_NOT_FOUND:anchor:t1:NOT_FOUND/);
});

test('a target is checked against a file as it stands', () => {
  assert.deepEqual(checkAnchorTarget('src/Course.tsx', COURSE, target('t1', 'Create Exam', 'button'), 'v'), { ok: true });
  assert.deepEqual(checkAnchorTarget('src/Course.tsx', 'this is not { valid', target('t1', 'Create Exam', 'button'), 'v'), { ok: false, reason: 'NOT_FOUND' });
});

// -- the plan -----------------------------------------------------------------

async function propose(controlAnchors: ControlAnchorTarget[], files?: Record<string, string>) {
  const context = { ...project(files), controlAnchors };
  const adapter = getAdapter('react-vite');
  const plan = await adapter.propose(context);
  return { adapter, context, plan };
}

const task = (plan: Awaited<ReturnType<typeof propose>>['plan']) => ({
  plan, approvedFileScopes: plan.approvedFileScopes, approvedCommandIds: [],
  approvalHash: createApprovalHash(plan, plan.approvedFileScopes, []),
  checkpointDirectory: fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-checkpoint-')),
});

test('a plan proposes an anchor for each control it can identify, and says why it left the others', async () => {
  const { plan } = await propose([
    target('create', 'Create Exam', 'button'),
    target('custom', 'Custom control', 'Button'),
    target('reset', 'Reset', 'button'),
    { ...target('gone', 'Create Exam', 'button'), file: 'src/Missing.tsx' },
  ]);
  const anchors = plan.operations.filter((operation) => operation.transformId === 'tellann.action.anchor');
  assert.deepEqual(anchors.map((operation) => operation.id), ['anchor:create']);
  assert.deepEqual(plan.evidence.controlAnchors, {
    planned: ['create'],
    skipped: [{ transitionId: 'custom', reason: 'CUSTOM_COMPONENT' }, { transitionId: 'reset', reason: 'ANCHORED_DIFFERENTLY' }, { transitionId: 'gone', reason: 'UNREADABLE' }],
  });
  assert.ok(plan.approvedFileScopes.includes('src/Course.tsx'), 'the file is part of what is put in front of the user to approve');
  assert.ok(plan.riskReasons.some((reason) => /1 control gain a data-tellann-action attribute/.test(reason)));
});

test('the anchor operation survives the plan being validated and sent on', async () => {
  const { plan } = await propose([target('create', 'Create Exam', 'button')]);
  const operation = validateInstrumentationPlan(JSON.parse(JSON.stringify(plan))).operations.find((item) => item.id === 'anchor:create')!;
  assert.deepEqual(operation.anchorAttribute, { name: 'data-tellann-action', value: 'tellann:create', element: 'button' });
  assert.equal(operation.startLine, target('create', 'Create Exam', 'button').startLine);
});

test('applying writes the anchor, validates, and rolling back restores the file exactly', async () => {
  const { adapter, context, plan } = await propose([target('create', 'Create Exam', 'button')]);
  const result = await adapter.apply(context, task(plan));
  const written = fs.readFileSync(path.join(context.workspaceRoot, 'src/Course.tsx'), 'utf8');
  assert.match(written, /<button onClick=\{\(\) => setN\(n \+ 1\)\} data-tellann-action="tellann:create">Create Exam/);
  assert.ok(result.changedFiles.includes('src/Course.tsx'));
  const validation = await adapter.validate(context, result);
  assert.equal(validation.valid, true, JSON.stringify(validation.checks.filter((check) => !check.passed)));
  assert.ok(validation.checks.some((check) => check.name === 'control-anchor:create' && check.passed));
  const rollback = await adapter.rollback(context, result);
  assert.equal(rollback.verified, true);
  assert.equal(fs.readFileSync(path.join(context.workspaceRoot, 'src/Course.tsx'), 'utf8'), COURSE);
});

test('proposing again after the anchor is in place is harmless', async () => {
  const { adapter, context, plan } = await propose([target('create', 'Create Exam', 'button')]);
  await adapter.apply(context, task(plan));
  const again = await adapter.propose({ ...context, snapshot: { ...context.snapshot } });
  const anchorOps = again.operations.filter((operation) => operation.transformId === 'tellann.action.anchor');
  assert.equal(anchorOps.length, 1);
  const before = fs.readFileSync(path.join(context.workspaceRoot, 'src/Course.tsx'), 'utf8');
  const applied = await adapter.apply(context, task(again));
  assert.equal(fs.readFileSync(path.join(context.workspaceRoot, 'src/Course.tsx'), 'utf8').split('data-tellann-action="tellann:create"').length - 1, 1, 'still exactly one');
  assert.ok(before.length > 0 && applied.planId === again.id);
});

test('a plan that asks for no anchors is exactly what it was before', async () => {
  const withoutContext = project();
  const plan = await getAdapter('react-vite').propose(withoutContext);
  assert.equal(plan.operations.some((operation) => operation.transformId === 'tellann.action.anchor'), false);
  assert.equal(plan.evidence.controlAnchors, undefined);
});

test('a control in another package is left to that package', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-anchor-mono-'));
  fs.mkdirSync(path.join(root, 'apps/web/src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps/admin/src'), { recursive: true });
  for (const app of ['web', 'admin']) {
    fs.writeFileSync(path.join(root, `apps/${app}/package.json`), JSON.stringify({ name: app, dependencies: { react: '^19.0.0', vite: '^7.0.0' } }));
    fs.writeFileSync(path.join(root, `apps/${app}/src/main.tsx`), `createRoot(document.body).render(<div />);\n`);
    fs.writeFileSync(path.join(root, `apps/${app}/src/Course.tsx`), COURSE);
  }
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'mono', private: true, workspaces: ['apps/*'] }));
  const base = project();
  const plan = await getAdapter('react-vite').propose({
    ...base, workspaceRoot: root,
    controlAnchors: [{ ...target('create', 'Create Exam', 'button'), file: 'apps/web/src/Course.tsx' }, { ...target('other', 'Create Exam', 'button'), file: 'apps/admin/src/Course.tsx' }],
  });
  const planned = plan.evidence.controlAnchors!;
  assert.equal(planned.planned.length + planned.skipped.filter((item) => item.reason === 'OUTSIDE_FRAMEWORK_PACKAGE').length, 2, 'each is either anchored here or left to its own package');
});
