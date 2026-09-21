/**
 * A Python tokenizer, sufficient for reading structure.
 *
 * Structure is the whole requirement here: which classes and functions exist,
 * what decorates them, what they import and what they call. That needs correct
 * handling of the three things a regular expression gets wrong about Python -
 * strings (including triple-quoted and prefixed ones), comments, and
 * indentation with implicit line joining inside brackets - and nothing beyond
 * it. Expressions are kept as source text rather than parsed into a tree,
 * because every consumer wants the text back anyway.
 */

export type TokenType = 'name' | 'number' | 'string' | 'op' | 'newline' | 'indent' | 'dedent' | 'eof';

export type Token = {
  type: TokenType;
  /** Source text exactly as written. */
  value: string;
  /** For `string` tokens: the decoded-ish contents, prefix and quotes removed. */
  stringValue?: string;
  /** For `string` tokens: the lowercase prefix, e.g. `f`, `rb`. */
  prefix?: string;
  line: number;
  column: number;
  offset: number;
};

const STRING_PREFIX = /^(?:[rRbBuUfF]{0,3})$/;

/** Python's own rule: a tab advances to the next multiple of eight. */
function indentWidth(text: string): number {
  let width = 0;
  for (const character of text) {
    if (character === '\t') width += 8 - (width % 8);
    else width += 1;
  }
  return width;
}

function isNameStart(character: string): boolean {
  return /[A-Za-z_]/.test(character) || character.charCodeAt(0) > 127;
}

function isNamePart(character: string): boolean {
  return /[A-Za-z0-9_]/.test(character) || character.charCodeAt(0) > 127;
}

export function tokenizePython(source: string): Token[] {
  const tokens: Token[] = [];
  const indents: number[] = [0];
  let index = 0;
  let line = 1;
  let lineStart = 0;
  let depth = 0;
  let atLineStart = true;

  const push = (type: TokenType, value: string, offset: number, extra?: Partial<Token>) => {
    tokens.push({ type, value, line, column: offset - lineStart, offset, ...extra });
  };

  const advanceLine = () => {
    line += 1;
    lineStart = index;
  };

  while (index < source.length) {
    if (atLineStart && depth === 0) {
      // Measure the indentation, but only for a line that has real content.
      let probe = index;
      while (probe < source.length && (source[probe] === ' ' || source[probe] === '\t')) probe += 1;
      const character = source[probe];
      if (character === undefined) {
        index = source.length;
        break;
      }
      if (character === '\n' || character === '\r' || character === '#') {
        // Blank or comment-only: emits no INDENT/DEDENT in Python either.
        index = probe;
        atLineStart = false;
        continue;
      }
      const width = indentWidth(source.slice(index, probe));
      const current = indents[indents.length - 1];
      if (width > current) {
        indents.push(width);
        push('indent', source.slice(index, probe), index);
      } else if (width < current) {
        while (indents.length > 1 && indents[indents.length - 1] > width) {
          indents.pop();
          push('dedent', '', probe);
        }
      }
      index = probe;
      atLineStart = false;
      continue;
    }

    const character = source[index];

    if (character === '\r') {
      index += 1;
      continue;
    }

    if (character === '\n') {
      index += 1;
      if (depth === 0) {
        push('newline', '\n', index - 1);
        atLineStart = true;
      }
      advanceLine();
      continue;
    }

    if (character === ' ' || character === '\t' || character === '\f') {
      index += 1;
      continue;
    }

    if (character === '#') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    if (character === '\\' && (source[index + 1] === '\n' || (source[index + 1] === '\r' && source[index + 2] === '\n'))) {
      index += source[index + 1] === '\r' ? 3 : 2;
      advanceLine();
      continue;
    }

    // A string, possibly with a prefix already consumed as a name.
    const quote = character === '"' || character === "'" ? character : null;
    if (quote) {
      const previous = tokens[tokens.length - 1];
      let prefix = '';
      let start = index;
      if (
        previous
        && previous.type === 'name'
        && previous.offset + previous.value.length === index
        && STRING_PREFIX.test(previous.value)
        && previous.value.length <= 3
      ) {
        prefix = previous.value.toLowerCase();
        start = previous.offset;
        tokens.pop();
      }
      const triple = source.startsWith(quote.repeat(3), index);
      const terminator = triple ? quote.repeat(3) : quote;
      const raw = prefix.includes('r');
      let cursor = index + terminator.length;
      let contents = '';
      while (cursor < source.length) {
        if (!raw && source[cursor] === '\\') {
          contents += source.slice(cursor, cursor + 2);
          if (source[cursor + 1] === '\n') advanceLine();
          cursor += 2;
          continue;
        }
        if (source.startsWith(terminator, cursor)) {
          cursor += terminator.length;
          break;
        }
        if (source[cursor] === '\n') {
          if (!triple) break;
          advanceLine();
        }
        contents += source[cursor];
        cursor += 1;
      }
      const startLine = line;
      push('string', source.slice(start, cursor), start, { prefix, stringValue: contents, line: startLine });
      index = cursor;
      continue;
    }

    if (isNameStart(character)) {
      let cursor = index;
      while (cursor < source.length && isNamePart(source[cursor])) cursor += 1;
      push('name', source.slice(index, cursor), index);
      index = cursor;
      continue;
    }

    if (/[0-9]/.test(character) || (character === '.' && /[0-9]/.test(source[index + 1] ?? ''))) {
      let cursor = index;
      while (cursor < source.length && /[0-9a-fA-FxXoObB._+-]/.test(source[cursor])) {
        // `+`/`-` belong to the number only right after an exponent marker.
        if ((source[cursor] === '+' || source[cursor] === '-') && !/[eE]/.test(source[cursor - 1] ?? '')) break;
        cursor += 1;
      }
      push('number', source.slice(index, cursor), index);
      index = cursor;
      continue;
    }

    if ('([{'.includes(character)) depth += 1;
    if (')]}'.includes(character)) depth = Math.max(0, depth - 1);

    // Longest-match operators, so `//=`, `**`, `->`, `:=` stay single tokens.
    const three = source.slice(index, index + 3);
    const two = source.slice(index, index + 2);
    if (['**=', '//=', '>>=', '<<=', '...'].includes(three)) {
      push('op', three, index);
      index += 3;
      continue;
    }
    if (['**', '//', '>>', '<<', '<=', '>=', '==', '!=', '->', ':=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@='].includes(two)) {
      push('op', two, index);
      index += 2;
      continue;
    }
    push('op', character, index);
    index += 1;
  }

  if (tokens.length && tokens[tokens.length - 1].type !== 'newline') push('newline', '\n', index);
  while (indents.length > 1) {
    indents.pop();
    push('dedent', '', index);
  }
  push('eof', '', index);
  return tokens;
}
