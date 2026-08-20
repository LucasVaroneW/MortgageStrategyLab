// postbuild-exe.mjs - Inyecta el icono y verifica el subsystem del .exe.

import * as resedit from 'resedit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exePath = path.join(__dirname, 'dist', 'MortgageStrategyLab.exe');
const icoPath = path.join(__dirname, 'assets', 'icon.ico');

if (!fs.existsSync(exePath)) {
  console.error('[FAIL] No existe:', exePath);
  process.exit(1);
}
if (!fs.existsSync(icoPath)) {
  console.error('[FAIL] No existe:', icoPath);
  process.exit(1);
}

console.log('\n  [POSTBUILD] Aplicando resedit al .exe...');

try {
  let buffer = fs.readFileSync(exePath);

  // === Icono: parsear .ico y reemplazar ===
  const icoBuffer = fs.readFileSync(icoPath);
  const count = icoBuffer.readUInt16LE(4);
  const iconItems = [];
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    const w = icoBuffer.readUInt8(off);
    const h = icoBuffer.readUInt8(off + 1);
    const size = icoBuffer.readUInt32LE(off + 8);
    const dataOff = icoBuffer.readUInt32LE(off + 12);
    const data = icoBuffer.slice(dataOff, dataOff + size);
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    iconItems.push(resedit.Data.RawIconItem.from(ab, w === 0 ? 256 : w, h === 0 ? 256 : h, 32));
  }
  console.log('    .ico: ' + iconItems.length + ' imagen(es) (16, 32, 48, 256)');

  // Cargar .exe y abrir recursos.
  const exe = resedit.NtExecutable.from(buffer);
  const resource = resedit.NtExecutableResource.from(exe);

  // Eliminar iconos previos (type 3 = ICON, type 14 = GROUP_ICON).
  const toRemove = resource.entries.filter(e => e.type === 3 || e.type === 14);
  for (const e of toRemove) {
    resource.removeResourceEntry(e.type, e.id, e.language);
  }
  console.log('    Eliminados ' + toRemove.length + ' iconos placeholder.');

  // Reemplazar usando API de alto nivel.
  resedit.Resource.IconGroupEntry.replaceIconsForResource(
    resource.entries, 1, 1033, iconItems
  );
  const finalIconCount = resource.entries.filter(e => e.type === 3).length;
  const finalGroupCount = resource.entries.filter(e => e.type === 14).length;
  console.log('    Registrados: ' + finalIconCount + ' ICON + ' + finalGroupCount + ' GROUP_ICON');

  // Regenerar .exe.
  let newBuffer = exe.generate();
  if (newBuffer instanceof ArrayBuffer) newBuffer = Buffer.from(newBuffer);

  // === Subsystem: forzar WINDOWS_GUI (3) en el PE header (POST-generate) ===
  const peOffset = newBuffer.readUInt32LE(0x3C);
  const subsystemOffset = peOffset + 4 + 20 + 68;
  const current = newBuffer.readUInt16LE(subsystemOffset);
  newBuffer.writeUInt16LE(3, subsystemOffset);
  console.log('    Subsystem: ' + (current === 2 ? 'CONSOLE' : current) + ' -> WINDOWS_GUI (sin terminal)');

  fs.writeFileSync(exePath, newBuffer);
  console.log('  [OK] .exe regenerado con icono y subsystem correctos.\n');
} catch (e) {
  console.error('  [FAIL]', e.message);
  console.error(e.stack);
  process.exit(1);
}
