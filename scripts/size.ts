#!/usr/bin/env tsx
// Reports the gzipped size of the published bundle the way a real consumer sees it:
// esbuild re-bundles the ESM entry, minifies, then gzips the single stream. This
// matches what tools like bundlejs.com show and is the honest per-user-download
// number — not the misleading per-file gzip you'd get from `ls -l dist/*.mjs`.
//
// For plugins we report *incremental* size: (core + plugin) bundled together,
// minus core alone. That's what adding a plugin actually costs you at runtime,
// since the shared helpers are already paid for by core.

import { build } from 'esbuild';
import { statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(import.meta.dirname, '..', 'dist');
const CORE = join(DIST, 'index.mjs');

interface Plugin {
  name: string;
  entry: string;
}

const PLUGINS: Plugin[] = [
  { name: 'a11y', entry: join(DIST, 'plugins', 'a11y.mjs') },
  { name: 'cmyk', entry: join(DIST, 'plugins', 'cmyk.mjs') },
  { name: 'harmonies', entry: join(DIST, 'plugins', 'harmonies.mjs') },
  { name: 'hsv', entry: join(DIST, 'plugins', 'hsv.mjs') },
  { name: 'hwb', entry: join(DIST, 'plugins', 'hwb.mjs') },
  { name: 'lab', entry: join(DIST, 'plugins', 'lab.mjs') },
  { name: 'lch', entry: join(DIST, 'plugins', 'lch.mjs') },
  { name: 'minify', entry: join(DIST, 'plugins', 'minify.mjs') },
  { name: 'mix', entry: join(DIST, 'plugins', 'mix.mjs') },
  { name: 'names', entry: join(DIST, 'plugins', 'names.mjs') },
  { name: 'p3', entry: join(DIST, 'plugins', 'p3.mjs') },
  { name: 'rec2020', entry: join(DIST, 'plugins', 'rec2020.mjs') },
];

async function bundle(entries: string[]): Promise<{ raw: number; gzip: number }> {
  for (const e of entries) {
    try {
      statSync(e);
    } catch {
      throw new Error(`Missing build output: ${e}. Run \`yarn build\` first.`);
    }
  }
  // Single synthetic entry that re-exports every target — forces esbuild to bundle
  // them into one artifact so we can measure combined gzipped size (the shape a real
  // consumer's bundle would take when importing core + plugins together).
  const synthetic = join(tmpdir(), `colordx-size-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(synthetic, entries.map((e, i) => `export * as _${i} from ${JSON.stringify(e)};`).join('\n'));
  const result = await build({
    entryPoints: [synthetic],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]!.contents;
  return { raw: code.byteLength, gzip: gzipSync(code).byteLength };
}

function fmt(bytes: number): string {
  if (bytes < 0) return '-' + fmt(-bytes);
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KB`;
}

async function main(): Promise<void> {
  const core = await bundle([CORE]);

  type Row = { label: string; raw: number; gzip: number };
  const rows: Row[] = [{ label: 'core', ...core }];

  for (const p of PLUGINS) {
    const combined = await bundle([CORE, p.entry]);
    rows.push({
      label: `+ ${p.name}`,
      raw: combined.raw - core.raw,
      gzip: combined.gzip - core.gzip,
    });
  }

  const labelW = Math.max(...rows.map((r) => r.label.length));
  console.log(`${'target'.padEnd(labelW)}  ${'raw (min)'.padStart(11)}  ${'gzipped'.padStart(10)}`);
  console.log(`${'-'.repeat(labelW)}  ${'-'.repeat(11)}  ${'-'.repeat(10)}`);
  for (const r of rows) {
    console.log(`${r.label.padEnd(labelW)}  ${fmt(r.raw).padStart(11)}  ${fmt(r.gzip).padStart(10)}`);
  }

  console.log();
  console.log(`Core bundle (what \`import '@colordx/core'\` ships): ${fmt(core.gzip)} gzipped`);
  console.log(`Plugin rows show *incremental* cost on top of core.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
