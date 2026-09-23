import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extendGitIgnoreContext, isGitIgnored } from './gitignore';

test('applies nested gitignore rules and later negations with Git path semantics', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-ignore-rules-'));
  const app = path.join(root, 'app');
  fs.mkdirSync(app);
  fs.writeFileSync(path.join(root, '.gitignore'), '*.generated.js\n!keep.generated.js\n');
  fs.writeFileSync(path.join(app, '.gitignore'), '*.log\n!important.log\n');

  const rootRules = extendGitIgnoreContext(root, root);
  const appRules = extendGitIgnoreContext(root, app, rootRules);

  assert.equal(isGitIgnored('drop.generated.js', false, rootRules), true);
  assert.equal(isGitIgnored('keep.generated.js', false, rootRules), false);
  assert.equal(isGitIgnored('app/debug.log', false, appRules), true);
  assert.equal(isGitIgnored('app/important.log', false, appRules), false);
  fs.rmSync(root, { recursive: true, force: true });
});
