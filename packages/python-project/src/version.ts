/**
 * PEP 440 versions and PEP 508 specifier sets.
 *
 * The JavaScript adapters answer "is this framework version supported?" with
 * semver, which cannot read `4.2.11`, `2.0.0rc1` or `>=4.2,<6`. Python
 * projects pin with exactly those, so support has to be decided against the
 * scheme the ecosystem actually uses rather than against a semver-shaped
 * approximation of it.
 */

export type PythonVersion = {
  epoch: number;
  release: number[];
  /** `a` | `b` | `rc`, normalized from alpha/beta/c/pre/preview. */
  preKind: string | null;
  preNumber: number;
  postNumber: number | null;
  devNumber: number | null;
  local: string | null;
  raw: string;
};

const VERSION_PATTERN =
  /^\s*v?(?:(\d+)!)?(\d+(?:\.\d+)*)((?:[-_.]?(?:a|b|c|rc|alpha|beta|pre|preview)[-_.]?\d*)?)((?:[-_.]?(?:post|rev|r)[-_.]?\d*|-\d+)?)((?:[-_.]?dev[-_.]?\d*)?)(?:\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?\s*$/i;

const PRE_KINDS: Record<string, string> = {
  a: 'a', alpha: 'a', b: 'b', beta: 'b', c: 'rc', rc: 'rc', pre: 'rc', preview: 'rc',
};

/** Parse a PEP 440 version, or null when the string is not one. */
export function parsePythonVersion(input: string): PythonVersion | null {
  const match = VERSION_PATTERN.exec(input);
  if (!match) return null;
  const [, epoch, release, pre, post, dev, local] = match;

  let preKind: string | null = null;
  let preNumber = 0;
  if (pre) {
    const parsed = /^[-_.]?(a|b|c|rc|alpha|beta|pre|preview)[-_.]?(\d*)$/i.exec(pre);
    if (parsed) {
      preKind = PRE_KINDS[parsed[1].toLowerCase()] ?? null;
      preNumber = parsed[2] ? Number(parsed[2]) : 0;
    }
  }

  let postNumber: number | null = null;
  if (post) {
    const implicit = /^-(\d+)$/.exec(post);
    if (implicit) postNumber = Number(implicit[1]);
    else {
      const parsed = /^[-_.]?(?:post|rev|r)[-_.]?(\d*)$/i.exec(post);
      if (parsed) postNumber = parsed[1] ? Number(parsed[1]) : 0;
    }
  }

  let devNumber: number | null = null;
  if (dev) {
    const parsed = /^[-_.]?dev[-_.]?(\d*)$/i.exec(dev);
    if (parsed) devNumber = parsed[1] ? Number(parsed[1]) : 0;
  }

  return {
    epoch: epoch ? Number(epoch) : 0,
    release: release.split('.').map(Number),
    preKind,
    preNumber,
    postNumber,
    devNumber,
    local: local ?? null,
    raw: input.trim(),
  };
}

function compareRelease(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

/** Ordering rank for the pre/post/dev segment, per PEP 440's sort order. */
function segmentRank(version: PythonVersion): number[] {
  // dev < pre < release < post, so each stage gets its own leading rank.
  if (version.devNumber !== null && !version.preKind && version.postNumber === null) {
    return [0, 0, version.devNumber];
  }
  if (version.preKind) {
    const kindRank = version.preKind === 'a' ? 0 : version.preKind === 'b' ? 1 : 2;
    return [1, kindRank, version.preNumber, version.devNumber === null ? 1 : 0, version.devNumber ?? 0];
  }
  if (version.postNumber !== null) {
    return [3, version.postNumber, version.devNumber === null ? 1 : 0, version.devNumber ?? 0];
  }
  return [2, 0, 0];
}

export function comparePythonVersions(left: PythonVersion, right: PythonVersion): number {
  if (left.epoch !== right.epoch) return left.epoch < right.epoch ? -1 : 1;
  const release = compareRelease(left.release, right.release);
  if (release !== 0) return release;
  const leftRank = segmentRank(left);
  const rightRank = segmentRank(right);
  const length = Math.max(leftRank.length, rightRank.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftRank[index] ?? 0) - (rightRank[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

type Clause = { operator: string; version: string };

function parseSpecifierSet(input: string): Clause[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = /^(===|==|!=|<=|>=|~=|<|>)\s*(.+)$/.exec(part);
      if (!match) return [];
      return [{ operator: match[1], version: match[2].trim() }];
    });
}

/** `1.2.*` matches any version whose leading release segments are `1.2`. */
function matchesWildcard(candidate: PythonVersion, pattern: string): boolean {
  const prefix = pattern.replace(/\.\*$/, '');
  const parsed = parsePythonVersion(prefix);
  if (!parsed) return false;
  return compareRelease(candidate.release.slice(0, parsed.release.length), parsed.release) === 0
    && candidate.epoch === parsed.epoch;
}

function satisfiesClause(candidate: PythonVersion, clause: Clause): boolean {
  const { operator } = clause;

  if (operator === '===') return candidate.raw === clause.version;

  if (operator === '==' || operator === '!=') {
    const wildcard = clause.version.endsWith('.*');
    const equal = wildcard
      ? matchesWildcard(candidate, clause.version)
      : (() => {
          const target = parsePythonVersion(clause.version);
          return target ? comparePythonVersions(candidate, target) === 0 : false;
        })();
    return operator === '==' ? equal : !equal;
  }

  if (operator === '~=') {
    // `~=2.3.1` means `>=2.3.1, ==2.3.*`: the last release component is free.
    const target = parsePythonVersion(clause.version);
    if (!target || target.release.length < 2) return false;
    const floorOk = comparePythonVersions(candidate, target) >= 0;
    const ceiling = target.release.slice(0, -1);
    return floorOk && compareRelease(candidate.release.slice(0, ceiling.length), ceiling) === 0;
  }

  const target = parsePythonVersion(clause.version);
  if (!target) return false;
  const order = comparePythonVersions(candidate, target);
  if (operator === '<=') return order <= 0;
  if (operator === '>=') return order >= 0;
  if (operator === '<') return order < 0;
  if (operator === '>') return order > 0;
  return false;
}

/**
 * Whether a concrete version satisfies a specifier set such as `>=4.2,<6`.
 *
 * Pre-releases are excluded unless the specifier set itself mentions one, which
 * mirrors pip: a project declaring `>=4.2` is not asking to be matched against
 * `5.0rc1`.
 */
export function satisfiesPythonSpecifier(version: string, specifier: string): boolean {
  const candidate = parsePythonVersion(version);
  if (!candidate) return false;
  const clauses = parseSpecifierSet(specifier);
  if (!clauses.length) return true;
  const prerelease = candidate.preKind !== null || candidate.devNumber !== null;
  const specifierMentionsPrerelease = clauses.some((clause) => {
    const parsed = parsePythonVersion(clause.version.replace(/\.\*$/, ''));
    return Boolean(parsed && (parsed.preKind || parsed.devNumber !== null));
  });
  if (prerelease && !specifierMentionsPrerelease) return false;
  return clauses.every((clause) => satisfiesClause(candidate, clause));
}

/**
 * Best concrete version a requirement pin implies, for display and support
 * checks. `Django>=4.2,<6` has no single version, so the lower bound is
 * reported: it is the version the project has actually committed to supporting.
 */
export function resolvePinnedVersion(specifier: string | null | undefined): string | null {
  if (!specifier) return null;
  const trimmed = specifier.trim();
  if (!trimmed) return null;
  const direct = parsePythonVersion(trimmed);
  if (direct) return direct.raw;
  const clauses = parseSpecifierSet(trimmed);
  const exact = clauses.find((clause) => clause.operator === '==' || clause.operator === '===');
  if (exact) {
    const parsed = parsePythonVersion(exact.version.replace(/\.\*$/, ''));
    if (parsed) return parsed.raw;
  }
  const lower = clauses.find((clause) => ['>=', '~=', '>'].includes(clause.operator));
  if (lower) {
    const parsed = parsePythonVersion(lower.version);
    if (parsed) return parsed.raw;
  }
  return null;
}
