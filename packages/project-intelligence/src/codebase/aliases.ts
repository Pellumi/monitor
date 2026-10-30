import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { slash } from './core';
import type { PackageBoundary } from './inventory';

const parseConfigHost: ts.ParseConfigFileHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  getCurrentDirectory: ts.sys.getCurrentDirectory,
  // A config this scan cannot parse contributes no aliases; it is not fatal.
  onUnRecoverableConfigFileDiagnostic: () => { /* ignored */ },
};

/**
 * Path aliases declared by one tsconfig (or jsconfig), following `extends`
 * (which `getParsedCommandLineOfConfigFile` resolves natively) and
 * `references`. The latter matters because the default shape produced by the
 * Vite/React/TS scaffold - and documented by shadcn/ui's own setup guide - is
 * a root tsconfig.json with no compilerOptions of its own, only `references`
 * to tsconfig.app.json and tsconfig.node.json. The real `paths` block lives in
 * the referenced file; reading the root config alone finds nothing.
 */
function readTsConfigPaths(configPath: string, root: string, seen: Set<string>): Record<string, string[]> {
  const normalized = path.resolve(configPath);
  if (seen.has(normalized) || !fs.existsSync(normalized)) return {};
  seen.add(normalized);

  let parsed: ts.ParsedCommandLine | undefined;
  try {
    parsed = ts.getParsedCommandLineOfConfigFile(normalized, {}, parseConfigHost);
  } catch {
    return {};
  }
  if (!parsed) return {};

  const paths: Record<string, string[]> = {};
  if (parsed.options.paths) {
    // baseUrl is already resolved to an absolute path by the TS API when present.
    const base = parsed.options.baseUrl ?? path.dirname(normalized);
    for (const [pattern, targets] of Object.entries(parsed.options.paths)) {
      paths[pattern] = targets.map((target) => slash(path.relative(root, path.resolve(base, target))));
    }
  }

  for (const reference of parsed.projectReferences ?? []) {
    const refConfigPath = ts.resolveProjectReferencePath(reference);
    const nested = readTsConfigPaths(refConfigPath, root, seen);
    for (const [pattern, targets] of Object.entries(nested)) {
      if (!paths[pattern]) paths[pattern] = targets;
    }
  }

  return paths;
}

const BUNDLER_CONFIG_FILES = [
  'vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts', 'vite.config.cts',
  'webpack.config.js', 'webpack.config.ts', 'webpack.config.cjs', 'webpack.config.mjs',
];

/**
 * Statically evaluates the handful of expression shapes real configs use to
 * point an alias at a directory, without ever executing the config file:
 * a string literal, `path.resolve/join(__dirname, ...)`, or the ESM
 * equivalent `fileURLToPath(new URL('./x', import.meta.url))`. Anything else
 * is left unresolved rather than guessed.
 */
function evaluateStaticPathValue(expr: ts.Expression, configDir: string): string | null {
  if (ts.isStringLiteralLike(expr)) return path.resolve(configDir, expr.text);

  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    const calleeName = ts.isPropertyAccessExpression(callee) ? callee.name.text
      : ts.isIdentifier(callee) ? callee.text : null;

    if (calleeName === 'resolve' || calleeName === 'join') {
      const segments: string[] = [];
      for (const argument of expr.arguments) {
        if (ts.isIdentifier(argument) && (argument.text === '__dirname' || argument.text === '__filename')) continue;
        if (ts.isStringLiteralLike(argument)) { segments.push(argument.text); continue; }
        return null; // a dynamic segment this scan cannot evaluate statically
      }
      return path.resolve(configDir, ...segments);
    }

    if (calleeName === 'fileURLToPath' && expr.arguments.length === 1) {
      const inner = expr.arguments[0];
      if (
        ts.isNewExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'URL'
        && inner.arguments && inner.arguments.length >= 1 && ts.isStringLiteralLike(inner.arguments[0])
      ) {
        return path.resolve(configDir, inner.arguments[0].text);
      }
    }
  }

  return null;
}

/** Finds the `resolve.alias` (or `alias`) object or array literal in a bundler config AST. */
function extractAliasEntries(sourceFile: ts.SourceFile, configDir: string): Record<string, string> {
  const entries: Record<string, string> = {};

  const readKey = (name: ts.PropertyName): string | null => {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return null;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && readKey(node.name) === 'alias') {
      const value = node.initializer;
      if (ts.isObjectLiteralExpression(value)) {
        for (const property of value.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = readKey(property.name);
          if (!key) continue;
          const resolved = evaluateStaticPathValue(property.initializer, configDir);
          if (resolved) entries[key] = resolved;
        }
      } else if (ts.isArrayLiteralExpression(value)) {
        for (const element of value.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          let find: string | null = null;
          let replacement: string | null = null;
          for (const property of element.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const key = readKey(property.name);
            if (key === 'find' && ts.isStringLiteralLike(property.initializer)) find = property.initializer.text;
            if (key === 'replacement') replacement = evaluateStaticPathValue(property.initializer, configDir);
          }
          if (find && replacement) entries[find] = replacement;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return entries;
}

/**
 * Fallback alias source for projects that declare aliases only through their
 * bundler (no tsconfig `paths`, or a jsconfig-less JS project). Read-only:
 * the config is parsed as an AST, never executed.
 */
function readBundlerAliasPaths(directory: string, root: string): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const fileName of BUNDLER_CONFIG_FILES) {
    const configPath = path.join(directory, fileName);
    if (!fs.existsSync(configPath)) continue;
    let text: string;
    try {
      text = fs.readFileSync(configPath, 'utf8');
    } catch {
      continue;
    }
    const scriptKind = /\.[cm]?ts$/.test(fileName) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const sourceFile = ts.createSourceFile(configPath, text, ts.ScriptTarget.Latest, true, scriptKind);
    const entries = extractAliasEntries(sourceFile, directory);
    for (const [key, target] of Object.entries(entries)) {
      const pattern = `${key}/*`;
      if (paths[pattern]) continue;
      paths[pattern] = [`${slash(path.relative(root, target))}/*`];
    }
  }
  return paths;
}

export type AliasResult = {
  /** Patterns in the same shape as `ts.CompilerOptions.paths`. */
  paths: Record<string, string[]>;
  /**
   * True if `specifier` matches one of the repository's declared alias
   * patterns: a prefix match for a wildcard pattern (`@/*` matches
   * `@/lib/foo`), exact equality otherwise (`@tellann/db` does not match
   * `@tellann/db-extra`, which is a different, unrelated package name).
   */
  matchesAliasPattern: (specifier: string) => boolean;
};

/**
 * Path aliases the repository actually uses, gathered from three sources in
 * order of precedence: workspace package names mapped to their entry points,
 * each package's own tsconfig/jsconfig `paths` (following `extends` and
 * `references`), and finally the bundler's own `resolve.alias` for anything
 * still unresolved. An import of `@tellann/db` or `@/lib/foo` then resolves
 * to a real file instead of becoming an unresolved string node.
 */
export function buildAliasPaths(root: string, packages: PackageBoundary[]): AliasResult {
  const paths: Record<string, string[]> = {};

  for (const boundary of packages) {
    if (boundary.root === '.') continue;
    const directory = path.join(root, ...boundary.root.split('/'));
    const manifestPath = path.join(directory, 'package.json');
    let entry: string | null = null;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      const candidate = typeof manifest.types === 'string' ? manifest.types
        : typeof manifest.main === 'string' ? manifest.main : null;
      if (candidate) {
        // A built entry point points at dist/. The sources beside it are what we
        // can actually analyze, so prefer the matching src/ file when present.
        const sourceCandidate = candidate.replace(/^\.?\/?(dist|build|lib)\//, 'src/').replace(/\.d\.ts$|\.js$/, '.ts');
        entry = [sourceCandidate, candidate].find((option) => fs.existsSync(path.join(directory, option))) ?? null;
      }
    } catch { /* boundaries without a readable manifest fall back to src/index */ }
    for (const fallback of ['src/index.ts', 'src/index.tsx', 'index.ts']) {
      if (entry) break;
      if (fs.existsSync(path.join(directory, fallback))) entry = fallback;
    }
    if (!entry) continue;
    const target = slash(path.join(boundary.root, entry));
    paths[boundary.name] = [target];
    paths[`${boundary.name}/*`] = [slash(path.join(boundary.root, 'src')) + '/*'];
  }

  for (const boundary of packages) {
    const directory = path.join(root, ...boundary.root.split('/').filter((part) => part !== '.'));

    for (const configName of ['tsconfig.json', 'jsconfig.json']) {
      const configPath = path.join(directory, configName);
      if (!fs.existsSync(configPath)) continue;
      const discovered = readTsConfigPaths(configPath, root, new Set());
      for (const [pattern, targets] of Object.entries(discovered)) {
        if (!paths[pattern]) paths[pattern] = targets;
      }
    }

    const bundlerAliases = readBundlerAliasPaths(directory, root);
    for (const [pattern, targets] of Object.entries(bundlerAliases)) {
      if (!paths[pattern]) paths[pattern] = targets;
    }
  }

  const patterns = Object.keys(paths);
  const matchesAliasPattern = (specifier: string): boolean => patterns.some((pattern) => (
    pattern.endsWith('*') ? specifier.startsWith(pattern.slice(0, -1)) : specifier === pattern
  ));
  return { paths, matchesAliasPattern };
}
