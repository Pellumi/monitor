import fs from 'node:fs';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';

type GitIgnoreRule = {
  /** Repository-relative directory containing this .gitignore, or empty at root. */
  base: string;
  matcher: Ignore;
};

export type GitIgnoreContext = readonly GitIgnoreRule[];

const slash = (value: string) => value.replaceAll('\\', '/');

/** Add the current directory's rules to the inherited Git ignore context. */
export function extendGitIgnoreContext(
  root: string,
  directory: string,
  inherited: GitIgnoreContext = [],
): GitIgnoreContext {
  const filename = path.join(directory, '.gitignore');
  let source: string;
  try {
    source = fs.readFileSync(filename, 'utf8');
  } catch {
    return inherited;
  }
  return [
    ...inherited,
    {
      base: slash(path.relative(root, directory)),
      matcher: ignore().add(source),
    },
  ];
}

/**
 * Apply root and nested .gitignore files in order, including later negations.
 * Paths are rebased for each file because Git patterns are relative to the
 * directory containing that .gitignore.
 */
export function isGitIgnored(
  repositoryRelativePath: string,
  directory: boolean,
  context: GitIgnoreContext,
): boolean {
  const normalized = slash(repositoryRelativePath).replace(/^\.\//, '');
  let ignored = false;
  for (const rule of context) {
    if (rule.base && normalized !== rule.base && !normalized.startsWith(`${rule.base}/`)) continue;
    const relative = rule.base ? normalized.slice(rule.base.length).replace(/^\//, '') : normalized;
    if (!relative) continue;
    const result = rule.matcher.test(directory ? `${relative.replace(/\/$/, '')}/` : relative);
    if (result.ignored) ignored = true;
    if (result.unignored) ignored = false;
  }
  return ignored;
}
