/**
 * Runs the README's code examples. Every top-level `expr; // <value>` line in a ```ts block is
 * evaluated and compared with the value in its comment, so an example cannot drift from the code.
 *
 * - Each block runs in its own scope, with every export of core, fn, tinycolor and all plugins in
 *   scope and every plugin extended. `import` and `extend()` lines are skipped.
 * - Top-level `const` / `let` lines run, so later lines can use them. Indented lines (loop bodies,
 *   multi-line functions) do not.
 * - A line starting with `.` runs on `colordx('#ff0000')`, the README's running example.
 * - The comment must start with a literal: a string, number, boolean, `null`, `undefined`, an
 *   object or array literal, a `#hex` or a `[#hex, …]` list. Anything else (`// → Colordx at the
 *   sRGB boundary`, `// ~1`) is prose and is not checked.
 * - A number in the comment is compared at its own printed precision.
 */
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as fn from '../src/fn.js';
import * as core from '../src/index.js';
import tinycolor from '../src/tinycolor.js';

const { Colordx, extend } = core;

const plugins: Record<string, Record<string, unknown>> = {};
for (const file of readdirSync(new URL('../src/plugins/', import.meta.url))) {
  plugins[file] = await import(`../src/plugins/${file}`);
}
extend(Object.values(plugins).map((p) => p.default as Parameters<typeof extend>[0][number]));

const scope: Record<string, unknown> = { ...fn, ...core, tinycolor };
for (const p of Object.values(plugins)) {
  for (const [k, v] of Object.entries(p)) if (k !== 'default') scope[k] = v;
}
const scopeNames = Object.keys(scope);
const scopeValues = scopeNames.map((k) => scope[k]);

interface Check {
  line: number;
  source: string;
  expected: string;
}

interface Block {
  line: number;
  statements: string[];
  checks: Check[];
}

const LITERAL =
  /^(\[\s*#[0-9a-f]+(?:\s*,\s*#[0-9a-f]+)*\s*\]|#[0-9a-f]+|'[^']*'|-?\d[\d.e+-]*(?=[\s,]|$)|true|false|null|undefined|\{.*?\}(?=\s|$)|\[.*?\](?=\s|$))/i;

const parseReadme = (): Block[] => {
  const lines = readFileSync(new URL('../README.md', import.meta.url), 'utf8').split('\n');
  const blocks: Block[] = [];
  let block: Block | null = null;
  lines.forEach((text, i) => {
    if (text.startsWith('```')) {
      if (block) blocks.push(block);
      block = text === '```ts' ? { line: i + 1, statements: [], checks: [] } : null;
      return;
    }
    if (!block || /^\s/.test(text) || /^(import|extend\(|for |\}|\/\/)/.test(text)) return;
    if (/^(const|let) .*;(\s*\/\/.*)?$/.test(text)) {
      block.statements.push(text.replace(/\s*\/\/.*$/, ''));
      return;
    }
    const m = text.match(/^(.+?);?\s*\/\/\s*(.*)$/);
    const expected = m?.[2].match(LITERAL)?.[1];
    if (!m || !expected) return;
    const source = m[1].trim().replace(/;$/, '');
    block.checks.push({
      line: i + 1,
      source: source.startsWith('.') ? `colordx('#ff0000')${source}` : source,
      expected,
    });
  });
  return blocks;
};

const toJs = (src: string) =>
  ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

// Runs a block's statements, then each check, in one scope. Returns each check's value or error.
const runBlock = (block: Block): { value?: unknown; error?: unknown }[] => {
  const checks = block.checks.map(
    (c, i) => `try { __out[${i}] = { value: (${c.source}) }; } catch (e) { __out[${i}] = { error: e }; }`
  );
  const body = toJs(`{\n${block.statements.join('\n')}\n${checks.join('\n')}\n}`);
  const out: { value?: unknown; error?: unknown }[] = [];
  new Function(...scopeNames, '__out', body)(...scopeValues, out);
  return out;
};

// Comment values are plain JS literals; no TS transpile, so `0.6279…` or `0°` fail and read as prose.
const evalLiteral = (expected: string): unknown => new Function(`return (${expected})`)();

const decimals = (n: string) => (n.split('.')[1] ?? '').replace(/e.*$/i, '').length;

// Normalizes an actual value to what the README comment prints.
const present = (actual: unknown): unknown =>
  actual instanceof Colordx ? actual.toHex() : Array.isArray(actual) ? actual.map(present) : actual;

const assertMatches = (actual: unknown, expected: string) => {
  if (expected.startsWith('#')) return expect(present(actual)).toBe(expected);
  if (/^\[\s*#/.test(expected))
    return expect(present(actual)).toEqual(
      expected
        .slice(1, -1)
        .split(/\s*,\s*/)
        .map((s) => s.trim())
    );
  if (/^-?\d/.test(expected)) return expect(actual).toBeCloseTo(Number(expected), decimals(expected));
  const want = evalLiteral(expected);
  if (Array.isArray(want) && want.every((x) => typeof x === 'number')) {
    const printed = expected
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim());
    expect(actual).toHaveLength(want.length);
    want.forEach((w, i) => expect((actual as number[])[i]).toBeCloseTo(w, decimals(printed[i])));
    return;
  }
  expect(present(actual)).toEqual(want);
};

// A literal that references names (`[r, g, b]`, `{ r, g, b, alpha } or null`) is prose, not a value.
const isValueLiteral = (expected: string) => {
  if (expected.startsWith('#') || /^\[\s*#/.test(expected)) return true;
  try {
    evalLiteral(expected);
    return true;
  } catch {
    return false;
  }
};

const blocks = parseReadme()
  .map((b) => ({ ...b, checks: b.checks.filter((c) => isValueLiteral(c.expected)) }))
  .filter((b) => b.checks.length > 0);

describe('README examples', () => {
  it('finds the examples', () => {
    expect(blocks.reduce((n, b) => n + b.checks.length, 0)).toBeGreaterThan(180);
  });

  for (const block of blocks) {
    describe(`block at README.md:${block.line}`, () => {
      let results: ReturnType<typeof runBlock> | undefined;
      let blockError: unknown;
      try {
        results = runBlock(block);
      } catch (e) {
        blockError = e;
      }
      block.checks.forEach((check, i) => {
        it(`README.md:${check.line} ${check.source} → ${check.expected}`, () => {
          if (blockError) throw blockError;
          const { value, error } = results![i];
          if (error) throw error;
          assertMatches(value, check.expected);
        });
      });
    });
  }
});
