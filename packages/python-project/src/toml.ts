/**
 * A TOML subset reader, sized for `pyproject.toml` and `Pipfile`.
 *
 * Pulling a TOML dependency into a package that ships inside an Electron main
 * process and a background worker is a lot of surface for reading a dependency
 * table, and every construct those two files actually use - tables, dotted
 * keys, strings, numbers, booleans, arrays and inline tables - is covered here.
 * Anything richer (dates, arrays of tables beyond append semantics) degrades to
 * a raw string rather than throwing, because a manifest this reader cannot
 * fully model must still yield the dependency list sitting beside it.
 */

export type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue };
export type TomlTable = { [key: string]: TomlValue };

type Cursor = { text: string; index: number };

function skipWhitespace(cursor: Cursor, newlines: boolean): void {
  while (cursor.index < cursor.text.length) {
    const character = cursor.text[cursor.index];
    if (character === ' ' || character === '\t' || character === '\r') {
      cursor.index += 1;
      continue;
    }
    if (newlines && character === '\n') {
      cursor.index += 1;
      continue;
    }
    if (character === '#') {
      while (cursor.index < cursor.text.length && cursor.text[cursor.index] !== '\n') cursor.index += 1;
      continue;
    }
    return;
  }
}

const ESCAPES: Record<string, string> = {
  n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', b: '\b', f: '\f',
};

function readBasicString(cursor: Cursor): string {
  cursor.index += 1;
  let out = '';
  while (cursor.index < cursor.text.length) {
    const character = cursor.text[cursor.index];
    if (character === '\\') {
      const next = cursor.text[cursor.index + 1];
      if (next === 'u' || next === 'U') {
        const width = next === 'u' ? 4 : 8;
        const code = cursor.text.slice(cursor.index + 2, cursor.index + 2 + width);
        out += String.fromCodePoint(Number.parseInt(code, 16) || 0);
        cursor.index += 2 + width;
        continue;
      }
      out += ESCAPES[next] ?? next;
      cursor.index += 2;
      continue;
    }
    if (character === '"') {
      cursor.index += 1;
      return out;
    }
    out += character;
    cursor.index += 1;
  }
  return out;
}

function readLiteralString(cursor: Cursor): string {
  cursor.index += 1;
  const end = cursor.text.indexOf("'", cursor.index);
  const out = end === -1 ? cursor.text.slice(cursor.index) : cursor.text.slice(cursor.index, end);
  cursor.index = end === -1 ? cursor.text.length : end + 1;
  return out;
}

function readMultiline(cursor: Cursor, quote: '"""' | "'''"): string {
  cursor.index += 3;
  if (cursor.text[cursor.index] === '\n') cursor.index += 1;
  const end = cursor.text.indexOf(quote, cursor.index);
  const raw = end === -1 ? cursor.text.slice(cursor.index) : cursor.text.slice(cursor.index, end);
  cursor.index = end === -1 ? cursor.text.length : end + 3;
  return quote === '"""' ? raw.replace(/\\\n\s*/g, '') : raw;
}

function readValue(cursor: Cursor): TomlValue {
  skipWhitespace(cursor, false);
  const text = cursor.text;

  if (text.startsWith('"""', cursor.index)) return readMultiline(cursor, '"""');
  if (text.startsWith("'''", cursor.index)) return readMultiline(cursor, "'''");
  if (text[cursor.index] === '"') return readBasicString(cursor);
  if (text[cursor.index] === "'") return readLiteralString(cursor);

  if (text[cursor.index] === '[') {
    cursor.index += 1;
    const items: TomlValue[] = [];
    for (;;) {
      skipWhitespace(cursor, true);
      if (cursor.index >= text.length) break;
      if (text[cursor.index] === ']') {
        cursor.index += 1;
        break;
      }
      items.push(readValue(cursor));
      skipWhitespace(cursor, true);
      if (text[cursor.index] === ',') cursor.index += 1;
    }
    return items;
  }

  if (text[cursor.index] === '{') {
    cursor.index += 1;
    const table: TomlTable = {};
    for (;;) {
      skipWhitespace(cursor, true);
      if (cursor.index >= text.length) break;
      if (text[cursor.index] === '}') {
        cursor.index += 1;
        break;
      }
      const key = readKey(cursor);
      skipWhitespace(cursor, false);
      if (text[cursor.index] === '=') cursor.index += 1;
      assignPath(table, key, readValue(cursor));
      skipWhitespace(cursor, true);
      if (text[cursor.index] === ',') cursor.index += 1;
    }
    return table;
  }

  let end = cursor.index;
  while (end < text.length && !',]}\n#'.includes(text[end])) end += 1;
  const raw = text.slice(cursor.index, end).trim();
  cursor.index = end;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^[+-]?\d[\d_]*$/.test(raw)) return Number(raw.replace(/_/g, ''));
  if (/^[+-]?(\d[\d_]*)?\.\d[\d_]*([eE][+-]?\d+)?$/.test(raw)) return Number(raw.replace(/_/g, ''));
  return raw;
}

/** A dotted key, returned as its path segments. */
function readKey(cursor: Cursor): string[] {
  const segments: string[] = [];
  for (;;) {
    skipWhitespace(cursor, false);
    const character = cursor.text[cursor.index];
    if (character === '"') segments.push(readBasicString(cursor));
    else if (character === "'") segments.push(readLiteralString(cursor));
    else {
      let end = cursor.index;
      while (end < cursor.text.length && /[A-Za-z0-9_-]/.test(cursor.text[end])) end += 1;
      segments.push(cursor.text.slice(cursor.index, end));
      cursor.index = end;
    }
    skipWhitespace(cursor, false);
    if (cursor.text[cursor.index] === '.') {
      cursor.index += 1;
      continue;
    }
    return segments;
  }
}

function assignPath(root: TomlTable, path: string[], value: TomlValue): void {
  let target = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const existing = target[key];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) target[key] = {};
    target = target[key] as TomlTable;
  }
  target[path[path.length - 1]] = value;
}

function tableAt(root: TomlTable, path: string[], arrayOfTables: boolean): TomlTable {
  let target = root;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    const last = index === path.length - 1;
    let existing = target[key];
    if (last && arrayOfTables) {
      if (!Array.isArray(existing)) {
        existing = [];
        target[key] = existing;
      }
      const created: TomlTable = {};
      (existing as TomlValue[]).push(created);
      return created;
    }
    if (Array.isArray(existing)) {
      const tail = existing[existing.length - 1];
      if (tail && typeof tail === 'object' && !Array.isArray(tail)) {
        target = tail as TomlTable;
        continue;
      }
    }
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      existing = {};
      target[key] = existing;
    }
    target = existing as TomlTable;
  }
  return target;
}

/** Parse TOML text. Malformed input yields whatever parsed cleanly before it. */
export function parseToml(text: string): TomlTable {
  const root: TomlTable = {};
  const cursor: Cursor = { text, index: 0 };
  let current = root;

  while (cursor.index < text.length) {
    skipWhitespace(cursor, true);
    if (cursor.index >= text.length) break;

    if (text[cursor.index] === '[') {
      const arrayOfTables = text[cursor.index + 1] === '[';
      cursor.index += arrayOfTables ? 2 : 1;
      const path = readKey(cursor);
      skipWhitespace(cursor, false);
      if (text[cursor.index] === ']') cursor.index += 1;
      if (arrayOfTables && text[cursor.index] === ']') cursor.index += 1;
      current = tableAt(root, path, arrayOfTables);
      continue;
    }

    const before = cursor.index;
    const key = readKey(cursor);
    skipWhitespace(cursor, false);
    if (text[cursor.index] !== '=') {
      // Not a key/value line; skip it rather than stall on unmodelled syntax.
      cursor.index = Math.max(before + 1, text.indexOf('\n', before) + 1 || text.length);
      continue;
    }
    cursor.index += 1;
    assignPath(current, key, readValue(cursor));
  }

  return root;
}

/** Read a dotted path out of a parsed table, or undefined. */
export function tomlPath(table: TomlTable | undefined, ...path: string[]): TomlValue | undefined {
  let current: TomlValue | undefined = table;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as TomlTable)[key];
  }
  return current;
}
