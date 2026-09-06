import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import MiniSearch from 'minisearch';

const payload = JSON.parse(await readFile(new URL('../public/docs-search-index.json', import.meta.url), 'utf8'));
const search = new MiniSearch({
  fields: ['title', 'description', 'headings', 'body', 'codeTerms', 'endpointTerms', 'tags'],
  storeFields: ['id', 'slug', 'title'],
  searchOptions: { boost: { title: 10, codeTerms: 9, endpointTerms: 9, headings: 5, description: 3, tags: 4, body: 1 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
});
search.addAll(payload.documents);

for (const [query, expected] of [
  ['BUTTON_CLICK', 'events-telemetry-ui-events'],
  ['trackEvent', 'get-started-quickstart'],
  ['/applications/{applicationId}/sessions', 'api-reference-sessions'],
  ['401', 'api-reference-errors'],
  ['429', 'api-reference-errors'],
  ['demontration', 'demonstration-overview'],
]) {
  test('search resolves ' + query, () => {
    const ids = search.search(query).slice(0, 12).map((result) => result.id);
    assert.ok(ids.includes(expected), query + ' should include ' + expected + '; got ' + ids.join(', '));
  });
}
