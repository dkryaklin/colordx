import { colordx } from './lib.js';
import { check, fix } from './a11y.js';
import { f } from './utils.js';

// Mirrors `colordx theme` from @colordx/cli: shadcn roles, light and dark, every fg moved until it passes both gates.

const hex = (base, l, cMax) => {
  const { c, h } = colordx(base).toOklch(6);
  return colordx({ l, c: cMax === undefined ? c : Math.min(c, cMax), h }).mapSrgb().toHex();
};

export const ROLES = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
];

/** shadcn pairs: `x-foreground` on `x`; border, input and ring are ui on background. */
export const PAIRS = [
  ['foreground', 'background', 'body'],
  ['card-foreground', 'card', 'body'],
  ['popover-foreground', 'popover', 'body'],
  ['primary-foreground', 'primary', 'body'],
  ['secondary-foreground', 'secondary', 'body'],
  ['muted-foreground', 'muted', 'body'],
  ['accent-foreground', 'accent', 'body'],
  ['destructive-foreground', 'destructive', 'body'],
  ['border', 'background', 'ui'],
  ['input', 'background', 'ui'],
  ['ring', 'background', 'ui'],
];

export function defaultNeutral(primary) {
  return hex(primary, 0.5, 0.02);
}

export function solveTheme({ primary, neutral, destructive = '#e7000b', level = 'AA' }) {
  const notes = {};
  const fitOr = (fg, bg, use) => fix(fg, bg, use, level) ?? fg;
  const role = (name, bg, fg, use) => {
    const fitted = fix(fg, bg, use, level);
    if (fitted !== null) return [bg, fitted];
    const moved = fix(bg, fg, use, level) ?? bg;
    notes[name] = `${name} moved so a foreground can pass`;
    return [moved, fix(fg, moved, use, level) ?? fg];
  };

  const solve = (mode) => {
    const dark = mode === 'dark';
    const n = (l) => hex(neutral, l, 0.02);
    const background = dark ? n(0.145) : n(1);
    const foreground = fitOr(dark ? n(0.985) : n(0.145), background, 'body');
    const card = dark ? n(0.205) : background;
    const soft = dark ? n(0.269) : n(0.97);
    const [primaryBg, primaryFg] = role('primary', dark ? hex(primary, 0.75) : primary, dark ? n(0.145) : n(0.985), 'body');
    const [destructiveBg, destructiveFg] = role('destructive', dark ? hex(destructive, 0.7) : destructive, n(0.985), 'body');
    return {
      background,
      foreground,
      card,
      'card-foreground': fitOr(foreground, card, 'body'),
      popover: card,
      'popover-foreground': fitOr(foreground, card, 'body'),
      primary: primaryBg,
      'primary-foreground': primaryFg,
      secondary: soft,
      'secondary-foreground': fitOr(dark ? n(0.985) : n(0.205), soft, 'body'),
      muted: soft,
      'muted-foreground': fitOr(dark ? n(0.708) : n(0.556), soft, 'body'),
      accent: soft,
      'accent-foreground': fitOr(dark ? n(0.985) : n(0.205), soft, 'body'),
      destructive: destructiveBg,
      'destructive-foreground': destructiveFg,
      border: fitOr(dark ? n(0.3) : n(0.922), background, 'ui'),
      input: fitOr(dark ? n(0.3) : n(0.922), background, 'ui'),
      ring: fitOr(dark ? n(0.556) : n(0.708), background, 'ui'),
    };
  };

  const out = {};
  for (const mode of ['light', 'dark']) {
    const t = solve(mode);
    const records = PAIRS.map(([fg, bg, use]) => ({
      fg,
      bg,
      use,
      ...check(t[fg], t[bg], use, level),
      note: notes[bg] ?? null,
    }));
    out[mode] = { values: t, records };
    for (const k of Object.keys(notes)) delete notes[k];
  }
  return out;
}

// ── export ──

export const fmtValue = (hexValue, format) => {
  if (format === 'hex') return hexValue;
  const { l, c, h } = colordx(hexValue).toOklch();
  return `oklch(${f(l, 4)} ${f(c, 4)} ${f(h, 2)})`;
};

const block = (values, format, indent = '  ') =>
  ROLES.map((r) => `${indent}--${r}: ${fmtValue(values[r], format)};`).join('\n');

export function themeToCss(theme, format) {
  return [
    ':root {',
    block(theme.light.values, format),
    '}',
    '',
    '.dark {',
    block(theme.dark.values, format),
    '}',
    '',
    '/* Tailwind v4 + shadcn: expose the roles as utilities */',
    '@theme inline {',
    ROLES.map((r) => `  --color-${r}: var(--${r});`).join('\n'),
    '}',
    '',
  ].join('\n');
}

export function themeToTailwind(theme, format) {
  return [
    '@import "tailwindcss";',
    '',
    '@theme {',
    ROLES.map((r) => `  --color-${r}: ${fmtValue(theme.light.values[r], format)};`).join('\n'),
    '}',
    '',
    '@layer base {',
    '  .dark {',
    ROLES.map((r) => `    --color-${r}: ${fmtValue(theme.dark.values[r], format)};`).join('\n'),
    '  }',
    '}',
    '',
  ].join('\n');
}

export function themeToJson(theme, format) {
  const group = (values) =>
    Object.fromEntries(ROLES.map((r) => [r, { $type: 'color', $value: fmtValue(values[r], format) }]));
  return JSON.stringify({ light: group(theme.light.values), dark: group(theme.dark.values) }, null, 2) + '\n';
}
