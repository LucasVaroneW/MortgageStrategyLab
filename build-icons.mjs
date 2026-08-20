// build-icons.mjs - Genera PNGs y .ico desde assets/icon.svg
// Resultado:
//   assets/favicon-16.png
//   assets/favicon-32.png
//   assets/favicon-48.png
//   assets/favicon-64.png
//   assets/favicon-128.png
//   assets/favicon-256.png
//   assets/icon.ico       (multi-resolución para Windows)
//   styles/favicon.svg    (copia del SVG para usar en <link rel="icon">)

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, 'assets', 'icon.svg');
const svg = fs.readFileSync(svgPath);

// Tamaños estándar para favicons e iconos Windows.
const SIZES = [16, 32, 48, 64, 128, 256];

async function build() {
  console.log('\n  Generando iconos desde assets/icon.svg\n');

  const pngs = {};
  for (const size of SIZES) {
    const out = path.join(__dirname, 'assets', `favicon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    pngs[size] = fs.readFileSync(out);
    console.log(`  [OK] favicon-${size}.png (${(pngs[size].length/1024).toFixed(1)} KB)`);
  }

  // Construir .ico multi-resolución (16, 32, 48, 256) - formato PNG dentro de ICO (Vista+).
  // El formato ICO tiene:
  //  - ICONDIR (6 bytes)
  //  - ICONDIRENTRY (16 bytes × n)
  //  - Datos de cada imagen
  const icoEntries = [];
  const icoImages = [];
  let offset = 6 + 16 * 4; // header + 4 entries

  const icoSizes = [16, 32, 48, 256];
  for (const size of icoSizes) {
    const png = pngs[size];
    icoImages.push(png);
    icoEntries.push({
      width: size === 256 ? 0 : size, // 0 = 256
      height: size === 256 ? 0 : size,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      sizeBytes: png.length,
      offset,
    });
    offset += png.length;
  }

  const icoSize = 6 + 16 * icoSizes.length + icoImages.reduce((a, b) => a + b.length, 0);
  const ico = Buffer.alloc(icoSize);
  let pos = 0;

  // ICONDIR
  ico.writeUInt16LE(0, pos); pos += 2;       // reserved
  ico.writeUInt16LE(1, pos); pos += 2;       // type = 1 (icon)
  ico.writeUInt16LE(icoSizes.length, pos); pos += 2; // count

  // ICONDIRENTRY
  for (const e of icoEntries) {
    ico.writeUInt8(e.width, pos); pos += 1;
    ico.writeUInt8(e.height, pos); pos += 1;
    ico.writeUInt8(e.colorCount, pos); pos += 1;
    ico.writeUInt8(e.reserved, pos); pos += 1;
    ico.writeUInt16LE(e.planes, pos); pos += 2;
    ico.writeUInt16LE(e.bitCount, pos); pos += 2;
    ico.writeUInt32LE(e.sizeBytes, pos); pos += 4;
    ico.writeUInt32LE(e.offset, pos); pos += 4;
  }

  // Datos PNG
  for (const img of icoImages) {
    img.copy(ico, pos);
    pos += img.length;
  }

  fs.writeFileSync(path.join(__dirname, 'assets', 'icon.ico'), ico);
  console.log(`  [OK] icon.ico (${(ico.length/1024).toFixed(1)} KB, ${icoSizes.length} resoluciones)`);

  // Copiar SVG a /styles para servirlo como favicon.
  fs.mkdirSync(path.join(__dirname, 'styles'), { recursive: true });
  fs.copyFileSync(svgPath, path.join(__dirname, 'styles', 'favicon.svg'));
  console.log('  [OK] styles/favicon.svg');

  console.log('\n  Iconos generados en assets/ y styles/\n');
}

build().catch(e => {
  console.error('Error generando iconos:', e);
  process.exit(1);
});
