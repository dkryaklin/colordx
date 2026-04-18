#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { colordx } from '../src/index.js';

const ROOT = join(import.meta.dirname ?? __dirname, '..');
const ASSETS = join(ROOT, 'assets');
const PLAYGROUND_PUBLIC = join(ROOT, 'playground', 'public');
const SCRATCH = mkdtempSync(join(tmpdir(), 'colordx-logos-'));

mkdirSync(ASSETS, { recursive: true });

type OklchTriple = [number, number, number];

function oklchMix(c1: OklchTriple, c2: OklchTriple, t: number) {
  const [l1, ch1, h1] = c1;
  const [l2, ch2, h2] = c2;
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (h1 + dh * t + 360) % 360;
  return { l: l1 + (l2 - l1) * t, c: ch1 + (ch2 - ch1) * t, h };
}

function stops(path: OklchTriple[], count = 30) {
  const segs = path.length - 1;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const s = Math.min(Math.floor(t * segs), segs - 1);
    const localT = t * segs - s;
    const { l, c, h } = oklchMix(path[s], path[s + 1], localT);
    const hex = colordx(`oklch(${l} ${c} ${h})`).toHex();
    return `<stop offset="${(t * 100).toFixed(2)}%" stop-color="${hex}"/>`;
  }).join('');
}

const palette: OklchTriple[] = [
  [0.78, 0.19, 30],   // coral
  [0.85, 0.18, 85],   // amber
  [0.55, 0.22, 290],  // violet
];

// The single master SVG — everything else is rasterized from this file.
function buildMasterSvg() {
  const S = 512;
  const cx = S / 2;
  const cy = S / 2;
  const tri = S * 0.78;
  const h = (tri * Math.sqrt(3)) / 2;
  const topY = cy - h / 2 + 20;
  const baseY = cy + h / 2 + 20;
  const incircleY = topY + (2 / 3) * h;
  const inradius = h / 3;
  const fontSize = Math.round(((2 * inradius) * 0.82) / 1.45);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="g" x1="0" y1="${topY}" x2="0" y2="${baseY}" gradientUnits="userSpaceOnUse">
      ${stops(palette)}
    </linearGradient>
  </defs>
  <path d="M ${cx} ${topY} L ${cx - tri / 2} ${baseY} L ${cx + tri / 2} ${baseY} Z"
        fill="url(#g)"
        stroke="url(#g)" stroke-width="20" stroke-linejoin="round"/>
  <text x="${cx}" y="${incircleY}" text-anchor="middle" dominant-baseline="central"
        font-family="ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-weight="800" font-size="${fontSize}" fill="white" letter-spacing="-4">DX</text>
</svg>`;
}

// Write SVG to both locations (README source + playground favicon).
const masterSvg = buildMasterSvg();
const svgPath = join(ASSETS, 'logo.svg');
writeFileSync(svgPath, masterSvg);
writeFileSync(join(PLAYGROUND_PUBLIC, 'favicon.svg'), masterSvg);
console.log('assets/logo.svg + playground/public/favicon.svg');

function svgToPng(pngPath: string, size: number) {
  execSync(`rsvg-convert -w ${size} -h ${size} ${svgPath} -o ${pngPath}`);
  console.log(`  → ${pngPath.replace(ROOT + '/', '')} (${size}×${size})`);
}

// Playground icons
svgToPng(join(PLAYGROUND_PUBLIC, 'apple-touch-icon.png'), 180);
svgToPng(join(PLAYGROUND_PUBLIC, 'icon-192.png'), 192);
svgToPng(join(PLAYGROUND_PUBLIC, 'icon-512.png'), 512);

// Multi-size favicon.ico (16/32/48) — all from the same SVG
const faviconPngs = [16, 32, 48].map((size) => {
  const p = join(SCRATCH, `favicon-${size}.png`);
  svgToPng(p, size);
  return p;
});
execSync(`magick ${faviconPngs.join(' ')} ${join(PLAYGROUND_PUBLIC, 'favicon.ico')}`);
console.log(`  → playground/public/favicon.ico (16/32/48 packed)`);
rmSync(SCRATCH, { recursive: true, force: true });

console.log('\nBrand palette hex (for shields.io):');
console.log('  coral  #ff806b  (ff806b)');
console.log('  amber  #ffc200  (ffc200)');
console.log('  violet #764be5  (764be5)');
