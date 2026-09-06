import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(appRoot, 'src', 'content', 'docs');
const generatedRoot = join(appRoot, 'src', 'generated');
const checkOnly = process.argv.includes('--check');
const navigation = JSON.parse(await readFile(join(appRoot, 'src', 'config', 'docs-navigation.json'), 'utf8'));
const legacyUrls = JSON.parse(await readFile(join(appRoot, 'src', 'config', 'legacy-url-map.json'), 'utf8'));
const navigationEntries = navigation.groups.flatMap((group) =>
  group.sections.flatMap((section) =>
    section.pages.map((page) => ({ page, groupId: group.id, sectionId: section.id, sectionTitle: section.title })),
  ),
);
const allExpected = [...navigationEntries.map((entry) => entry.page), ...navigation.standalone];
const expectedById = new Map(allExpected.map((page) => [page.id, page]));
const expectedBySlug = new Map(allExpected.map((page) => [page.slug, page]));
const errors = [];

async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(absolute));
    else if (extname(entry.name) === '.mdx') results.push(absolute);
  }
  return results;
}

function headingId(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function plainText(body) {
  return body
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_\[\]()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateMeta(meta, expected, sourcePath) {
  const required = ['id', 'slug', 'title', 'description', 'version', 'status', 'audiences', 'tags', 'related', 'updatedAt'];
  for (const field of required) if (meta[field] === undefined) errors.push(sourcePath + ': missing frontmatter field ' + field);
  if (meta.version !== 'v1') errors.push(sourcePath + ': unsupported version ' + meta.version);
  if (!['ga', 'beta', 'preview', 'planned'].includes(meta.status)) errors.push(sourcePath + ': unsupported status ' + meta.status);
  if (!Array.isArray(meta.audiences) || meta.audiences.some((value) => !['developer', 'qa', 'engineering-manager', 'product', 'admin'].includes(value))) {
    errors.push(sourcePath + ': invalid audiences');
  }
  if (meta.plans && (!Array.isArray(meta.plans) || meta.plans.some((value) => !['free', 'local', 'solo', 'team', 'business', 'enterprise'].includes(value)))) {
    errors.push(sourcePath + ': invalid plans');
  }
  for (const key of ['id', 'slug', 'title']) {
    if (expected && meta[key] !== expected[key]) errors.push(sourcePath + ': ' + key + ' does not match navigation');
  }
}

const sourceFiles = await walk(contentRoot);
if (sourceFiles.length !== 271) errors.push('Expected exactly 271 MDX pages; found ' + sourceFiles.length);
const docs = [];
const ids = new Set();
const slugs = new Set();

for (const absolute of sourceFiles) {
  const sourcePath = relative(appRoot, absolute).split(sep).join('/');
  const source = await readFile(absolute, 'utf8');
  const parsed = matter(source);
  const meta = parsed.data;
  const content = parsed.content;
  const expected = expectedById.get(meta.id);
  validateMeta(meta, expected, sourcePath);
  if (!expected) errors.push(sourcePath + ': page id is not in navigation: ' + meta.id);
  if (ids.has(meta.id)) errors.push(sourcePath + ': duplicate id ' + meta.id);
  if (slugs.has(meta.slug)) errors.push(sourcePath + ': duplicate slug ' + meta.slug);
  ids.add(meta.id);
  slugs.add(meta.slug);
  if (relative(contentRoot, absolute).split(sep).join('/') !== meta.slug + '.mdx') {
    errors.push(sourcePath + ': file path must match slug ' + meta.slug);
  }
  const text = plainText(content);
  if (text.length < 850) errors.push(sourcePath + ': body is not substantive enough (' + text.length + ' characters)');
  if (/\b(TODO|TBD|lorem ipsum|coming soon)\b/i.test(content)) errors.push(sourcePath + ': placeholder language is not allowed');
  const headings = [...content.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    title: match[2].replace(/[*_]/g, '').trim(),
  }));
  if (headings.filter((item) => item.level === 1).length !== 1) errors.push(sourcePath + ': exactly one H1 is required');
  let previousLevel = 0;
  for (const item of headings) {
    if (previousLevel && item.level > previousLevel + 1) errors.push(sourcePath + ': malformed heading hierarchy at ' + item.title);
    previousLevel = item.level;
  }
  const toc = headings.filter((item) => item.level >= 2).map((item) => ({ id: headingId(item.title), title: item.title, level: item.level }));
  if (new Set(toc.map((item) => item.id)).size !== toc.length) errors.push(sourcePath + ': duplicate heading identifiers');
  for (const relatedId of meta.related || []) {
    if (!expectedById.has(relatedId)) errors.push(sourcePath + ': unknown related page ' + relatedId);
  }
  for (const match of content.matchAll(/\[[^\]]+\]\((\/[^)#?]+)(?:#[^)]+)?\)/g)) {
    const target = match[1].replace(/^\//, '');
    if (!expectedBySlug.has(target) && target !== '') errors.push(sourcePath + ': broken internal link ' + match[1]);
  }
  const navEntry = navigationEntries.find((entry) => entry.page.id === meta.id);
  docs.push({
    ...meta,
    headings: toc,
    groupId: navEntry?.groupId || 'resources',
    sectionId: navEntry?.sectionId || 'resources',
    sectionTitle: navEntry?.sectionTitle || 'Resources',
    sourcePath,
    body: text,
    codeTerms: [...new Set([
      ...[...content.matchAll(/\b[A-Za-z_$][\w$]+\(\)/g)].map((match) => match[0]),
      ...[...content.matchAll(/\b[A-Z][A-Z0-9_]{2,}\b/g)].map((match) => match[0]),
      ...[...content.matchAll(/\b(?:400|401|403|404|409|429|500|502|503)\b/g)].map((match) => match[0]),
    ])],
    endpointTerms: [...new Set([...content.matchAll(/\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s]+)/g)].map((match) => match[0]))],
  });
}

for (const expected of allExpected) if (!ids.has(expected.id)) errors.push('Navigation page has no MDX file: ' + expected.id);
if (ids.size !== 271 || slugs.size !== 271) errors.push('Manifest must contain 271 unique IDs and slugs');
const legacySources = new Set();
for (const entry of legacyUrls) {
  if (legacySources.has(entry.source)) errors.push('Duplicate legacy URL ' + entry.source);
  legacySources.add(entry.source);
  const target = entry.destination.replace(/^\//, '');
  if (!entry.external && entry.source !== entry.destination && !expectedBySlug.has(target)) {
    errors.push('Legacy URL points to unknown destination: ' + entry.source + ' -> ' + entry.destination);
  }
}
if (legacyUrls.length !== 100) errors.push('Expected 100 legacy URL resolutions; found ' + legacyUrls.length);

if (errors.length) {
  console.error('Documentation validation failed with ' + errors.length + ' error(s):\n- ' + errors.join('\n- '));
  process.exit(1);
}

docs.sort((a, b) => allExpected.findIndex((page) => page.id === a.id) - allExpected.findIndex((page) => page.id === b.id));
const imports = docs.map((doc) => '  ' + JSON.stringify(doc.id) + ': () => import(\'../content/docs/' + doc.slug + '.mdx\')').join(',\n');
const manifest = docs.map((doc) => {
  const item = { ...doc };
  delete item.body;
  delete item.codeTerms;
  delete item.endpointTerms;
  return item;
});
const manifestSource = '// Generated by scripts/generate-docs.mjs. Do not edit.\n'
  + 'import type { GeneratedDoc } from \'@/lib/docs-types\';\n\n'
  + 'export const docsManifest = ' + JSON.stringify(manifest, null, 2) + ' as GeneratedDoc[];\n'
  + 'export const docsBySlug = new Map(docsManifest.map((doc) => [doc.slug, doc]));\n'
  + 'export const docsById = new Map(docsManifest.map((doc) => [doc.id, doc]));\n'
  + 'export const docsImporters: Record<string, () => Promise<{ default: React.ComponentType }>> = {\n' + imports + '\n};\n';
const marketingOrigin = (process.env.NEXT_PUBLIC_MARKETING_URL || 'https://tellann.co').replace(/\/$/, '');
const redirects = legacyUrls.filter((entry) => entry.source !== entry.destination).map((entry) => ({
  source: entry.source,
  destination: entry.external ? marketingOrigin + entry.destination : entry.destination,
  permanent: true,
}));
const redirectsSource = '// Generated by scripts/generate-docs.mjs. Do not edit.\nexport const legacyRedirects = ' + JSON.stringify(redirects, null, 2) + ';\n';
const searchIndex = docs.map((doc) => ({
  id: doc.id,
  slug: doc.slug,
  title: doc.title,
  description: doc.description,
  headings: doc.headings.map((heading) => heading.title),
  body: doc.body,
  codeTerms: doc.codeTerms,
  endpointTerms: doc.endpointTerms,
  tags: doc.tags,
}));
const contentHash = createHash('sha256').update(JSON.stringify(searchIndex)).digest('hex').slice(0, 12);

if (!checkOnly) {
  await mkdir(generatedRoot, { recursive: true });
  await writeFile(join(generatedRoot, 'docs-manifest.ts'), manifestSource);
  await writeFile(join(generatedRoot, 'legacy-redirects.ts'), redirectsSource);
  await writeFile(join(appRoot, 'public', 'docs-search-index.json'), JSON.stringify({ version: 'v1', hash: contentHash, documents: searchIndex }));
}
console.log('Validated ' + docs.length + ' pages, ' + navigation.groups.length + ' regions, ' + navigationEntries.length + ' section pages, and ' + legacyUrls.length + ' legacy URLs.');
