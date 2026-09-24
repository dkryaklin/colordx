/**
 * Extract the web-platform-tests css/css-color parsing cases into tests/fixtures/wpt-css-color.json.
 *
 *   pnpm tsx scripts/wpt-extract.ts            # pins the current WPT master commit
 *   pnpm tsx scripts/wpt-extract.ts <sha>      # re-extract at a given commit
 *
 * The WPT files build their cases with loops and template strings, so rather than pattern-match the
 * source, each inline <script> runs in a node:vm sandbox whose test helpers only record their
 * arguments. The helpers mirror css/support/{parsing,computed,color}-testcommon.js:
 *
 *   test_valid_value(prop, value, serialized?)       serialized defaults to value (arguments.length < 3)
 *   test_invalid_value(prop, value)
 *   test_computed_value(prop, specified, computed?)  computed defaults to specified (falsy check)
 *   fuzzy_test_computed_color(specified, computed?, epsilon?)
 *   fuzzy_test_valid_color(specified, parsed?, epsilon?)
 *   fuzzy_test_*_property(prop, ...)
 *
 * `serialized` / `computed` may be an array of acceptable serializations.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = 'web-platform-tests/wpt';
const DIR = 'css/css-color/parsing';

// Files colordx can be held to. Excluded on purpose (colordx does not implement these features, see
// the README roadmap): color-mix(), relative color syntax (`from`), contrast-color(), color-layers(),
// CSS Color 5 alpha(), and color-computed-none / color-computed-powerless, which test `none` only
// through relative color syntax and color-mix().
const FILES = [
  'color-computed.html',
  'color-computed-color-function.html',
  'color-computed-hex-color.html',
  'color-computed-hsl.html',
  'color-computed-hwb.html',
  'color-computed-lab.html',
  'color-computed-named-color.html',
  'color-computed-rgb.html',
  'color-invalid.html',
  'color-invalid-color-function.html',
  'color-invalid-hex-color.html',
  'color-invalid-hsl.html',
  'color-invalid-hwb.html',
  'color-invalid-lab.html',
  'color-invalid-named-color.html',
  'color-invalid-rgb.html',
  'color-valid.html',
  'color-valid-color-function.html',
  'color-valid-hsl.html',
  'color-valid-hwb.html',
  'color-valid-lab.html',
  'color-valid-rgb.html',
  'color-valid-system-color.html',
];

const EXCLUDED = [
  'alpha-color-computed.html',
  'alpha-color-parsing-invalid.html',
  'alpha-color-parsing-valid.html',
  'color-computed-color-mix-function.html',
  'color-computed-contrast-color-function.html',
  'color-computed-none.html',
  'color-computed-powerless.html',
  'color-computed-relative-color.html',
  'color-invalid-color-layers-function.html',
  'color-invalid-color-mix-function.html',
  'color-invalid-contrast-color-function.html',
  'color-invalid-relative-color.html',
  'color-mix-out-of-gamut.html',
  'color-valid-color-layers-function.html',
  'color-valid-color-mix-function.html',
  'color-valid-contrast-color-function.html',
  'color-valid-relative-color-opaque-alpha.html',
  'color-valid-relative-color.html',
  'contrast-color-function-calc-container.html',
  'opacity-computed.html',
  'opacity-invalid.html',
  'opacity-valid.html',
  'relative-color-out-of-gamut.html',
];

type Kind = 'valid' | 'invalid' | 'computed';
interface Case {
  file: string;
  kind: Kind;
  property: string;
  input: string;
  /** Expected serialization(s); null for invalid cases. */
  expected: string | string[] | null;
}

const fetchText = async (url: string, accept?: string): Promise<string> => {
  const res = await fetch(url, { headers: accept ? { accept } : {} });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.text();
};

const resolveSha = async (): Promise<string> => {
  const arg = process.argv[2];
  if (arg) return arg;
  const body = JSON.parse(await fetchText(`https://api.github.com/repos/${REPO}/commits/master`)) as { sha: string };
  return body.sha;
};

const inlineScripts = (html: string): string[] =>
  [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc\s*=/.test(m[1] ?? ''))
    .map((m) => m[2]!);

const extract = (file: string, html: string): Case[] => {
  const cases: Case[] = [];
  const push = (kind: Kind, property: string, input: string, expected: string | string[] | null) =>
    cases.push({ file, kind, property, input, expected });

  const element = () => ({ style: {} as Record<string, string> });
  const sandbox = {
    document: { getElementById: element, createElement: element, querySelector: element },
    test_valid_value(property: string, value: string, serialized?: string | string[]) {
      // Mirrors parsing-testcommon.js: an omitted argument (not an undefined one) means "same as input".
      push('valid', property, value, arguments.length < 3 ? value : (serialized as string | string[]));
    },
    test_invalid_value(property: string, value: string) {
      push('invalid', property, value, null);
    },
    test_computed_value(property: string, specified: string, computed?: string | string[]) {
      push('computed', property, specified, computed || specified);
    },
    fuzzy_test_computed_color(specified: string, computed?: string) {
      push('computed', 'color', specified, computed || specified);
    },
    fuzzy_test_computed_color_property(property: string, specified: string, computed?: string) {
      push('computed', property, specified, computed || specified);
    },
    fuzzy_test_valid_color(specified: string, parsed?: string) {
      push('valid', 'color', specified, parsed || specified);
    },
    fuzzy_test_valid_color_property(property: string, specified: string, parsed?: string) {
      push('valid', property, specified, parsed || specified);
    },
  };
  const context = vm.createContext(sandbox);
  for (const script of inlineScripts(html)) vm.runInContext(script, context, { filename: file });
  return cases;
};

const main = async () => {
  const sha = await resolveSha();
  const cases: Case[] = [];
  for (const file of FILES) {
    const html = await fetchText(`https://raw.githubusercontent.com/${REPO}/${sha}/${DIR}/${file}`);
    const found = extract(file, html);
    if (found.length === 0) throw new Error(`no cases extracted from ${file}`);
    cases.push(...found);
  }

  const fixture = {
    source: `https://github.com/${REPO}/tree/${sha}/${DIR}`,
    commit: sha,
    license:
      'Test data extracted from web-platform-tests, (c) web-platform-tests contributors, licensed under the ' +
      '3-Clause BSD License: https://github.com/web-platform-tests/wpt/blob/master/LICENSE.md',
    generatedBy: 'scripts/wpt-extract.ts',
    files: FILES,
    excludedFiles: EXCLUDED,
    cases,
  };

  const out = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/wpt-css-color.json');
  // One case per line: diffs stay readable across WPT bumps and the file stays compact.
  const { cases: _, ...header } = fixture;
  const head = JSON.stringify(header, null, 2).replace(/\n}$/, '');
  writeFileSync(out, `${head},\n  "cases": [\n${cases.map((c) => `    ${JSON.stringify(c)}`).join(',\n')}\n  ]\n}\n`);
  const byKind = cases.reduce<Record<string, number>>((acc, c) => ((acc[c.kind] = (acc[c.kind] ?? 0) + 1), acc), {});
  console.log(`WPT ${sha.slice(0, 12)}: ${cases.length} cases`, byKind, `→ ${out}`);
};

await main();
