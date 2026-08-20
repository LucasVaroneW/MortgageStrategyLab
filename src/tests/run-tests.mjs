// Runner de tests para Node.js (CLI).
// Uso: node src/tests/run-tests.mjs

// Mock localStorage para que los tests del modulo de backup funcionen en Node.
const _ls = new Map();
globalThis.localStorage = {
  getItem: k => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: k => _ls.delete(k),
  clear: () => _ls.clear(),
  key: i => [..._ls.keys()][i] || null,
  get length() { return _ls.size; },
};

import { ejecutarTodos } from './tests.js';
import { ejecutarTodosIntegracion } from './integrationTests.js';
import { testsGraficosRankings } from './graficosRankingsTests.js';
import { testsBackup } from './backupTests.js';

const integ = await ejecutarTodosIntegracion();

async function ejecutarArray(testsArray) {
  const resultados = [];
  for (const t of testsArray) {
    const t0 = Date.now();
    try {
      const r = await Promise.resolve(t.ejecutar());
      resultados.push({
        nombre: t.nombre,
        ok: r.ok,
        errores: r.errores || [],
        detalles: r.detalles || {},
        tiempoMs: Date.now() - t0,
      });
    } catch (e) {
      resultados.push({ nombre: t.nombre, ok: false, errores: [e.message], detalles: {}, tiempoMs: 0 });
    }
  }
  return resultados;
}

const gr = await ejecutarArray(testsGraficosRankings);
const bk = await ejecutarArray(testsBackup);
const resultados = [...integ.resultados, ...gr, ...bk];
const total = resultados.length;
const pasados = resultados.filter(x => x.ok).length;
const fallados = total - pasados;

console.log('\n========================================');
console.log('  Mortgage Strategy Lab — Tests');
console.log('========================================\n');

for (const t of resultados) {
  const marca = t.ok ? '✅' : '❌';
  console.log(`${marca} ${t.nombre}  (${t.tiempoMs} ms)`);
  if (t.detalles && Object.keys(t.detalles).length > 0) {
    for (const [k, v] of Object.entries(t.detalles)) {
      console.log(`     · ${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  for (const e of t.errores) {
    console.log(`     ! ${e}`);
  }
}

console.log('\n----------------------------------------');
console.log(`  Total: ${total} · Pasados: ${pasados} · Fallados: ${fallados}`);
console.log('----------------------------------------\n');

if (fallados > 0) {
  process.exit(1);
}
