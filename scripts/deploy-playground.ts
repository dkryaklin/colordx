#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'dist-playground');

function sha8(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function write(filePath: string, content: string | Buffer) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// Clean output
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

// ── Step 1: Hash stable assets (no internal cross-references) ──

const indexMjs = readFileSync(join(ROOT, 'dist/index.mjs'));
const indexHashed = `index.${sha8(indexMjs)}.mjs`;

const a11yMjs = readFileSync(join(ROOT, 'dist/plugins/a11y.mjs'));
const a11yHashed = `plugins/a11y.${sha8(a11yMjs)}.mjs`;

const stylesCss = readFileSync(join(ROOT, 'playground/styles.css'));
const stylesHashed = `styles.${sha8(stylesCss)}.css`;

const manifest = readFileSync(join(ROOT, 'playground/manifest.webmanifest'));
const manifestHashed = `manifest.${sha8(manifest)}.webmanifest`;

// ── Step 2: Rewrite app.js imports to hashed URLs ──

let appJs = readFileSync(join(ROOT, 'playground/app.js'), 'utf-8');
appJs = appJs.replace("'/index.mjs'", `'/${indexHashed}'`);
appJs = appJs.replace("'/plugins/a11y.mjs'", `'/${a11yHashed}'`);
const appHashed = `app.${sha8(appJs)}.js`;

// ── Step 3: Rewrite index.html asset references ──

let html = readFileSync(join(ROOT, 'playground/index.html'), 'utf-8');
html = html.replace('href="/styles.css"', `href="/${stylesHashed}"`);
html = html.replace('href="/manifest.webmanifest"', `href="/${manifestHashed}"`);
html = html.replace('src="/app.js"', `src="/${appHashed}"`);

// ── Step 4: Write output ──

write(join(OUT, 'index.html'), html);
write(join(OUT, indexHashed), indexMjs);
write(join(OUT, a11yHashed), a11yMjs);
write(join(OUT, stylesHashed), stylesCss);
write(join(OUT, manifestHashed), manifest);
write(join(OUT, appHashed), appJs);

const files = [indexHashed, a11yHashed, stylesHashed, manifestHashed, appHashed];
console.log(`Built playground → dist-playground/`);
files.forEach((f) => console.log(`  ${f}`));
