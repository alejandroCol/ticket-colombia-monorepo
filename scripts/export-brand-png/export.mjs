import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const appRoots = ['bitcomedia-main-app', 'bitcomedia-web-admin'];

const specs = [
  { base: 'ticket-colombia-icon', width: 1024 },
  { base: 'ticket-colombia-lockup', width: 2000 },
];

for (const app of appRoots) {
  for (const { base, width } of specs) {
    const svgPath = join(root, `${app}/src/assets/brand/${base}.svg`);
    const pngPath = join(root, `${app}/src/assets/brand/${base}.png`);
    const svg = await readFile(svgPath, 'utf8');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      font: { loadSystemFonts: true },
    });
    const out = resvg.render();
    await writeFile(pngPath, out.asPng());
    console.log('wrote', pngPath, `${out.width}x${out.height}`);
  }
}
