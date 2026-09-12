import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const navigation = JSON.parse(await readFile(new URL('src/config/docs-navigation.json', root), 'utf8'));
const legacy = JSON.parse(await readFile(new URL('src/config/legacy-url-map.json', root), 'utf8'));

test('canonical information architecture contains 5 regions, 21 sections, and 277 pages', () => {
  const sections = navigation.groups.flatMap((group) => group.sections);
  const pages = [...sections.flatMap((section) => section.pages), ...navigation.standalone];
  assert.equal(navigation.groups.length, 5);
  assert.equal(sections.length, 21);
  assert.equal(pages.length, 277);
  assert.equal(new Set(pages.map((page) => page.id)).size, 277);
  assert.equal(new Set(pages.map((page) => page.slug)).size, 277);
});

test('product footer exposes four external destinations', () => {
  assert.deepEqual(navigation.external.map((link) => link.id), ['changelog', 'roadmap', 'status', 'support']);
});

test('all 100 legacy URLs resolve once', () => {
  assert.equal(legacy.length, 100);
  assert.equal(new Set(legacy.map((entry) => entry.source)).size, 100);
  assert.equal(legacy.filter((entry) => entry.external).length, 4);
});
