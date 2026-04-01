#!/usr/bin/env tsx
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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


const indexMjs = readFileSync(join(ROOT, 'dist/index.mjs'));
const indexHashed = `index.${sha8(indexMjs)}.mjs`;

// All plugins imported by app.js
const plugins = ['a11y', 'harmonies', 'hsv', 'hwb', 'lab', 'lch', 'mix', 'p3'];
const pluginHashed: Record<string, string> = {};
for (const name of plugins) {
  const content = readFileSync(join(ROOT, `dist/plugins/${name}.mjs`));
  pluginHashed[name] = `plugins/${name}.${sha8(content)}.mjs`;
}

const stylesCss = readFileSync(join(ROOT, 'playground/styles.css'));
const stylesHashed = `styles.${sha8(stylesCss)}.css`;

const manifest = readFileSync(join(ROOT, 'playground/manifest.webmanifest'));
const manifestHashed = `manifest.${sha8(manifest)}.webmanifest`;


let appJs = readFileSync(join(ROOT, 'playground/app.js'), 'utf-8');
appJs = appJs.replace("'/index.mjs'", `'/${indexHashed}'`);
for (const name of plugins) {
  appJs = appJs.replace(`'/plugins/${name}.mjs'`, `'/${pluginHashed[name]}'`);
}
const appHashed = `app.${sha8(appJs)}.js`;


let html = readFileSync(join(ROOT, 'playground/index.html'), 'utf-8');
html = html.replace('href="/styles.css"', `href="/${stylesHashed}"`);
html = html.replace('href="/manifest.webmanifest"', `href="/${manifestHashed}"`);
html = html.replace('src="/app.js"', `src="/${appHashed}"`);


write(join(OUT, 'index.html'), html);
write(join(OUT, indexHashed), indexMjs);
for (const name of plugins) {
  write(join(OUT, pluginHashed[name]), readFileSync(join(ROOT, `dist/plugins/${name}.mjs`)));
}
write(join(OUT, stylesHashed), stylesCss);
write(join(OUT, manifestHashed), manifest);
write(join(OUT, appHashed), appJs);

// Copy all chunk files from dist/ root — already content-addressed by the bundler,
// referenced via relative paths inside plugin files (e.g. ../chunk-XXXX.mjs).
const chunkFiles = readdirSync(join(ROOT, 'dist')).filter(f => f.startsWith('chunk-') && f.endsWith('.mjs'));
for (const chunk of chunkFiles) {
  write(join(OUT, chunk), readFileSync(join(ROOT, 'dist', chunk)));
}

const files = [indexHashed, ...Object.values(pluginHashed), stylesHashed, manifestHashed, appHashed, ...chunkFiles];
console.log(`Built playground → dist-playground/`);
files.forEach((f) => console.log(`  ${f}`));
