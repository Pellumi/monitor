import { tokenizePython, type Token } from './tokenizer';

/**
 * Structural reading of a Python module.
 *
 * The shape here is deliberately close to what the TypeScript analyzers already
 * emit - declarations with positions, imports, calls and decorators - so the
 * graph builders and the instrumenters can treat a `.py` file the same way they
 * treat a `.ts` one, instead of growing a second, parallel notion of what a
 * symbol is.
 */

export type PythonArgument = {
  /** Present for `name=value` arguments. */
  keyword: string | null;
  /** Source text of the value. */
  text: string;
  /** Set when the value is a single string literal. */
  stringValue: string | null;
  line: number;
};

export type PythonDecorator = {
  /** Dotted name being applied, e.g. `app.get`, `router.post`, `task`. */
  name: string;
  /** Full source text of the decorator line, `@` included. */
  text: string;
  /** Empty when the decorator is applied without a call. */
  args: PythonArgument[];
  called: boolean;
  line: number;
};

export type PythonNodeKind = 'module' | 'class' | 'function';

export type PythonNode = {
  kind: PythonNodeKind;
  name: string;
  /** Dotted path from the module root, e.g. `UserView.post`. */
  qualifiedName: string;
  isAsync: boolean;
  /** Class bases, as written. */
  bases: string[];
  /** Parameter names, `self` included. */
  parameters: string[];
  decorators: PythonDecorator[];
  docstring: string | null;
  /** Last line of the docstring, so callers insert after it rather than before. */
  docstringEndLine: number | null;
  startLine: number;
  endLine: number;
  startOffset: number;
  /** First line of the body; equal to `startLine` for an empty module. */
  bodyStartLine: number;
  /** Offset of the first body statement, for insertion. */
  bodyStartOffset: number;
  /** Leading whitespace of the body, so inserted statements line up. */
  bodyIndent: string;
  children: PythonNode[];
  parent: PythonNode | null;
};

export type PythonImport = {
  /** `null` for a bare `import x` form's relative-only imports. */
  module: string | null;
  names: Array<{ name: string; alias: string | null }>;
  /** Leading dots on a `from . import x`. */
  relativeLevel: number;
  /** `import x` rather than `from x import y`. */
  plain: boolean;
  line: number;
  text: string;
};

export type PythonCall = {
  /** Dotted callee, e.g. `requests.get`, `app.add_middleware`. */
  callee: string;
  /** Last segment of the callee. */
  member: string;
  args: PythonArgument[];
  line: number;
  /** Innermost class or function containing the call. */
  scope: PythonNode;
};

export type PythonAssignment = {
  target: string;
  value: string;
  /** Last line of the statement, which is not `line` for a multi-line call. */
  endLine: number;
  /** Set when the value is a single string literal. */
  stringValue: string | null;
  /** Calls made on the right-hand side, in order. */
  calls: PythonCall[];
  line: number;
  scope: PythonNode;
};

export type PythonModule = {
  path: string;
  root: PythonNode;
  imports: PythonImport[];
  calls: PythonCall[];
  assignments: PythonAssignment[];
  /** Every class and function, at any depth. */
  declarations: PythonNode[];
  /** Module-level `__all__`-style string lists are not resolved; text only. */
  source: string;
  lineCount: number;
};

const KEYWORDS_ENDING_BLOCK = new Set(['class', 'def', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'match', 'case']);

function lineStartOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

function indentTextAt(source: string, offset: number): string {
  let start = offset;
  while (start > 0 && source[start - 1] !== '\n') start -= 1;
  let end = start;
  while (end < source.length && (source[end] === ' ' || source[end] === '\t')) end += 1;
  return source.slice(start, end);
}

/** Source text spanned by a token run, with original spacing preserved. */
function textOf(source: string, tokens: Token[], from: number, to: number): string {
  if (from >= to) return '';
  const start = tokens[from].offset;
  const last = tokens[to - 1];
  return source.slice(start, last.offset + last.value.length).trim();
}

/** Index just past the bracket opened at `open`. */
function matchBracket(tokens: Token[], open: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closer = pairs[tokens[open].value];
  if (!closer) return open + 1;
  let depth = 0;
  for (let index = open; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'op') continue;
    if ('([{'.includes(token.value)) depth += 1;
    else if (')]}'.includes(token.value)) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return tokens.length;
}

/** Split a bracketed token run on its top-level commas. */
function splitTopLevel(tokens: Token[], from: number, to: number): Array<[number, number]> {
  const parts: Array<[number, number]> = [];
  let depth = 0;
  let start = from;
  for (let index = from; index < to; index += 1) {
    const token = tokens[index];
    if (token.type === 'op') {
      if ('([{'.includes(token.value)) depth += 1;
      else if (')]}'.includes(token.value)) depth -= 1;
      else if (token.value === ',' && depth === 0) {
        if (index > start) parts.push([start, index]);
        start = index + 1;
        continue;
      }
    }
  }
  if (to > start) parts.push([start, to]);
  return parts;
}

function readArguments(source: string, tokens: Token[], from: number, to: number): PythonArgument[] {
  return splitTopLevel(tokens, from, to).map(([start, end]) => {
    let keyword: string | null = null;
    let valueStart = start;
    if (
      end - start > 2
      && tokens[start].type === 'name'
      && tokens[start + 1].type === 'op'
      && tokens[start + 1].value === '='
    ) {
      keyword = tokens[start].value;
      valueStart = start + 2;
    }
    const single = end - valueStart === 1 ? tokens[valueStart] : null;
    return {
      keyword,
      text: textOf(source, tokens, valueStart, end),
      stringValue: single && single.type === 'string' ? (single.stringValue ?? '') : null,
      line: tokens[start].line,
    };
  });
}

/** Read a dotted name ending at `index`, walking backwards through `a.b.c`. */
function dottedNameEndingAt(tokens: Token[], index: number): { name: string; start: number } | null {
  if (tokens[index].type !== 'name') return null;
  let start = index;
  const segments = [tokens[index].value];
  while (
    start >= 2
    && tokens[start - 1].type === 'op'
    && tokens[start - 1].value === '.'
    && tokens[start - 2].type === 'name'
  ) {
    start -= 2;
    segments.unshift(tokens[start].value);
  }
  return { name: segments.join('.'), start };
}

function collectCalls(source: string, tokens: Token[], from: number, to: number, scope: PythonNode): PythonCall[] {
  const calls: PythonCall[] = [];
  for (let index = from; index < to; index += 1) {
    const token = tokens[index];
    if (token.type !== 'op' || token.value !== '(') continue;
    if (index === from) continue;
    const previous = tokens[index - 1];
    if (previous.type !== 'name') continue;
    const dotted = dottedNameEndingAt(tokens, index - 1);
    if (!dotted) continue;
    // `def f(` and `class C(` are declarations, handled by the caller.
    if (dotted.start > from && tokens[dotted.start - 1].type === 'name'
      && ['def', 'class'].includes(tokens[dotted.start - 1].value)) continue;
    const close = matchBracket(tokens, index);
    calls.push({
      callee: dotted.name,
      member: dotted.name.slice(dotted.name.lastIndexOf('.') + 1),
      args: readArguments(source, tokens, index + 1, close - 1),
      line: token.line,
      scope,
    });
  }
  return calls;
}

function readDecorator(source: string, tokens: Token[], from: number, to: number): PythonDecorator | null {
  if (tokens[from].type !== 'op' || tokens[from].value !== '@') return null;
  const nameStart = from + 1;
  if (tokens[nameStart]?.type !== 'name') return null;
  let cursor = nameStart;
  while (
    cursor + 2 < to
    && tokens[cursor + 1].type === 'op'
    && tokens[cursor + 1].value === '.'
    && tokens[cursor + 2].type === 'name'
  ) cursor += 2;
  const dotted = dottedNameEndingAt(tokens, cursor);
  if (!dotted) return null;
  const called = tokens[cursor + 1]?.type === 'op' && tokens[cursor + 1].value === '(';
  const args = called
    ? readArguments(source, tokens, cursor + 2, matchBracket(tokens, cursor + 1) - 1)
    : [];
  return {
    name: dotted.name,
    text: textOf(source, tokens, from, to),
    args,
    called,
    line: tokens[from].line,
  };
}

/** Index of the first top-level `=` that is an assignment, or -1. */
function assignmentOperator(tokens: Token[], from: number, to: number): number {
  let depth = 0;
  for (let index = from; index < to; index += 1) {
    const token = tokens[index];
    if (token.type !== 'op') continue;
    if ('([{'.includes(token.value)) depth += 1;
    else if (')]}'.includes(token.value)) depth -= 1;
    else if (token.value === '=' && depth === 0) return index;
    else if (token.value === 'lambda') return -1;
  }
  return -1;
}

function readImport(source: string, tokens: Token[], from: number, to: number): PythonImport | null {
  const first = tokens[from];
  if (first.type !== 'name') return null;

  if (first.value === 'import') {
    const names: PythonImport['names'] = [];
    for (const [start, end] of splitTopLevel(tokens, from + 1, to)) {
      const asIndex = (() => {
        for (let index = start; index < end; index += 1) {
          if (tokens[index].type === 'name' && tokens[index].value === 'as') return index;
        }
        return -1;
      })();
      const nameEnd = asIndex === -1 ? end : asIndex;
      const name = textOf(source, tokens, start, nameEnd);
      const alias = asIndex === -1 ? null : textOf(source, tokens, asIndex + 1, end);
      if (name) names.push({ name, alias: alias || null });
    }
    if (!names.length) return null;
    return { module: null, names, relativeLevel: 0, plain: true, line: first.line, text: textOf(source, tokens, from, to) };
  }

  if (first.value !== 'from') return null;
  let cursor = from + 1;
  let relativeLevel = 0;
  while (cursor < to && tokens[cursor].type === 'op' && (tokens[cursor].value === '.' || tokens[cursor].value === '...')) {
    relativeLevel += tokens[cursor].value.length;
    cursor += 1;
  }
  const moduleStart = cursor;
  while (cursor < to && !(tokens[cursor].type === 'name' && tokens[cursor].value === 'import')) cursor += 1;
  const module = textOf(source, tokens, moduleStart, cursor) || null;
  if (cursor >= to) return null;

  let listStart = cursor + 1;
  let listEnd = to;
  if (tokens[listStart]?.type === 'op' && tokens[listStart].value === '(') {
    listEnd = matchBracket(tokens, listStart) - 1;
    listStart += 1;
  }
  const names: PythonImport['names'] = [];
  for (const [start, end] of splitTopLevel(tokens, listStart, listEnd)) {
    const asIndex = (() => {
      for (let index = start; index < end; index += 1) {
        if (tokens[index].type === 'name' && tokens[index].value === 'as') return index;
      }
      return -1;
    })();
    const nameEnd = asIndex === -1 ? end : asIndex;
    const name = textOf(source, tokens, start, nameEnd);
    const alias = asIndex === -1 ? null : textOf(source, tokens, asIndex + 1, end);
    if (name) names.push({ name, alias: alias || null });
  }
  return { module, names, relativeLevel, plain: false, line: first.line, text: textOf(source, tokens, from, to) };
}

export function parsePythonModule(source: string, filePath: string): PythonModule {
  const tokens = tokenizePython(source);
  const offsets = lineStartOffsets(source);
  const lineCount = offsets.length;

  const root: PythonNode = {
    kind: 'module',
    name: filePath.split('/').pop()?.replace(/\.py$/i, '') ?? filePath,
    qualifiedName: '',
    isAsync: false,
    bases: [],
    parameters: [],
    decorators: [],
    docstring: null,
    docstringEndLine: null,
    startLine: 1,
    endLine: lineCount,
    startOffset: 0,
    bodyStartLine: 1,
    bodyStartOffset: 0,
    bodyIndent: '',
    children: [],
    parent: null,
  };

  const module: PythonModule = {
    path: filePath,
    root,
    imports: [],
    calls: [],
    assignments: [],
    declarations: [],
    source,
    lineCount,
  };

  /** One entry per open indentation level; the node it introduced, if any. */
  const blocks: Array<PythonNode | null> = [];
  let pendingOwner: PythonNode | null = null;
  let pendingDecorators: PythonDecorator[] = [];

  const scope = (): PythonNode => {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const owner = blocks[index];
      if (owner) return owner;
    }
    return root;
  };

  let index = 0;
  while (index < tokens.length && tokens[index].type !== 'eof') {
    const token = tokens[index];

    if (token.type === 'indent') {
      blocks.push(pendingOwner);
      pendingOwner = null;
      index += 1;
      continue;
    }
    if (token.type === 'dedent') {
      const closed = blocks.pop();
      if (closed) closed.endLine = Math.max(closed.startLine, token.line - 1);
      index += 1;
      continue;
    }
    if (token.type === 'newline') {
      index += 1;
      continue;
    }

    // One logical statement: everything up to the next NEWLINE token.
    let end = index;
    while (end < tokens.length && tokens[end].type !== 'newline' && tokens[end].type !== 'eof') end += 1;
    const statementStart = index;
    const statementEnd = end;
    index = end;

    if (statementEnd <= statementStart) continue;
    const head = tokens[statementStart];

    if (head.type === 'op' && head.value === '@') {
      const decorator = readDecorator(source, tokens, statementStart, statementEnd);
      if (decorator) pendingDecorators.push(decorator);
      continue;
    }

    if (head.type === 'name' && (head.value === 'import' || head.value === 'from')) {
      const parsed = readImport(source, tokens, statementStart, statementEnd);
      if (parsed) module.imports.push(parsed);
      pendingDecorators = [];
      continue;
    }

    const isAsync = head.type === 'name' && head.value === 'async';
    const keywordIndex = isAsync ? statementStart + 1 : statementStart;
    const keyword = tokens[keywordIndex];

    if (keyword?.type === 'name' && (keyword.value === 'def' || keyword.value === 'class')) {
      const nameToken = tokens[keywordIndex + 1];
      if (nameToken?.type !== 'name') {
        pendingDecorators = [];
        continue;
      }
      const parent = scope();
      const node: PythonNode = {
        kind: keyword.value === 'class' ? 'class' : 'function',
        name: nameToken.value,
        qualifiedName: parent.qualifiedName ? `${parent.qualifiedName}.${nameToken.value}` : nameToken.value,
        isAsync,
        bases: [],
        parameters: [],
        decorators: pendingDecorators,
        docstring: null,
        docstringEndLine: null,
        startLine: (pendingDecorators[0]?.line ?? head.line),
        endLine: tokens[statementEnd - 1].line,
        startOffset: head.offset,
        bodyStartLine: tokens[statementEnd - 1].line + 1,
        bodyStartOffset: tokens[statementEnd]?.offset ?? head.offset,
        bodyIndent: `${indentTextAt(source, head.offset)}    `,
        children: [],
        parent,
      };
      pendingDecorators = [];

      const openIndex = keywordIndex + 2;
      if (tokens[openIndex]?.type === 'op' && tokens[openIndex].value === '(') {
        const close = matchBracket(tokens, openIndex);
        const parts = splitTopLevel(tokens, openIndex + 1, close - 1);
        if (node.kind === 'class') {
          node.bases = parts.map(([start, stop]) => textOf(source, tokens, start, stop)).filter(Boolean);
        } else {
          node.parameters = parts
            .map(([start]) => (tokens[start].type === 'name' ? tokens[start].value : textOf(source, tokens, start, start + 1)))
            .filter(Boolean);
        }
      }

      parent.children.push(node);
      module.declarations.push(node);
      pendingOwner = node;
      continue;
    }

    pendingDecorators = [];
    const currentScope = scope();

    // A leading string statement in a definition body is its docstring.
    if (
      tokens[statementStart].type === 'string'
      && statementEnd - statementStart === 1
      && currentScope.docstring === null
      && currentScope.bodyStartLine >= tokens[statementStart].line
    ) {
      const token = tokens[statementStart];
      currentScope.docstring = (token.stringValue ?? '').trim().slice(0, 500);
      // A triple-quoted docstring spans lines; anything inserted into a body
      // must land after its final line, or the string stops being the
      // docstring and the inserted statement becomes unreachable prose.
      currentScope.docstringEndLine = token.line + (token.value.match(/\n/g)?.length ?? 0);
    }

    const calls = collectCalls(source, tokens, statementStart, statementEnd, currentScope);
    module.calls.push(...calls);

    const operator = assignmentOperator(tokens, statementStart, statementEnd);
    if (operator > statementStart) {
      const valueSingle = statementEnd - operator === 2 ? tokens[operator + 1] : null;
      module.assignments.push({
        target: textOf(source, tokens, statementStart, operator),
        value: textOf(source, tokens, operator + 1, statementEnd),
        endLine: tokens[statementEnd - 1].line,
        stringValue: valueSingle && valueSingle.type === 'string' ? (valueSingle.stringValue ?? '') : null,
        calls: calls.filter((call) => call.line >= tokens[operator].line),
        line: head.line,
        scope: currentScope,
      });
    }
  }

  for (const open of blocks) {
    if (open) open.endLine = Math.max(open.endLine, lineCount);
  }
  root.endLine = lineCount;

  // The body indent of a definition is only truly known once a body statement
  // has been seen; recover it from the first child or the first body line.
  for (const declaration of module.declarations) {
    const bodyLineIndex = declaration.bodyStartLine - 1;
    if (bodyLineIndex >= 0 && bodyLineIndex < offsets.length) {
      const text = source.slice(offsets[bodyLineIndex], offsets[bodyLineIndex + 1] ?? source.length);
      const measured = /^[ \t]*/.exec(text)?.[0] ?? '';
      if (measured.length > indentTextAt(source, declaration.startOffset).length) {
        declaration.bodyIndent = measured;
        declaration.bodyStartOffset = offsets[bodyLineIndex];
      }
    }
  }

  return module;
}

/** Depth-first walk of a node and its descendants. */
export function walkPython(node: PythonNode, visit: (item: PythonNode) => void): void {
  visit(node);
  for (const child of node.children) walkPython(child, visit);
}

/** Whether a statement keyword opens a block; used by callers inserting code. */
export function opensBlock(keyword: string): boolean {
  return KEYWORDS_ENDING_BLOCK.has(keyword);
}
