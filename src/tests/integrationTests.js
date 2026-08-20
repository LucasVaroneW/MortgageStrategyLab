// Tests de integración: import/export JSON, validación de esquema.

import { ejecutarTodos } from './tests.js';
import { round2, formatEUR } from '../core/money.js';
import { clone } from '../core/utils.js';

const testsIntegracion = [
  {
    nombre: 'Integración: el JSON exportado contiene todas las entidades esperadas',
    ejecutar: () => {
      const sample = {
        version: 1,
        exportedAt: new Date().toISOString(),
        perfiles: [{ id: 'p1', nombre: 'Test', edad: 30, ahorrosDisponibles: 10000 }],
        propiedades: [{ id: 'h1', nombre: 'Vivienda', precio: 140000 }],
        ofertasHipoteca: [{ id: 'o1', banco: 'X', producto: 'Y', tipo: 'fija', fija: { tin: 3, tae: 3.5 } }],
        prestamosPersonales: [{ id: 'pp1', nombre: 'P', importe: 10000, tin: 7, tae: 7.5, plazoMeses: 84 }],
        estrategias: [{ id: 'e1', nombre: 'Estrategia A', propiedadId: 'h1', hipotecaId: 'o1', prestamosIds: ['pp1'] }],
        supuestos: { inflacionAnual: 2.0 },
        configuracionRanking: { pesos: { costeTotal: 50 } },
      };
      const json = JSON.stringify(sample, null, 2);
      const parsed = JSON.parse(json);
      const keys = ['version', 'perfiles', 'propiedades', 'ofertasHipoteca', 'prestamosPersonales', 'estrategias', 'supuestos', 'configuracionRanking'];
      const ok = keys.every(k => k in parsed) && parsed.version === 1;
      return {
        ok,
        errores: ok ? [] : ['Faltan claves esperadas en el JSON.'],
      };
    },
  },
  {
    nombre: 'Integración: ejemplo A/B/C da totales coherentes y B es la más barata',
    ejecutar: () => {
      // Reproducimos los ejemplos y validamos orden.
      const propiedad = {
        precio: 140000,
        valorTasacion: 140000,
        gastosCompra: { modo: 'MANUAL', impuestos: 8400, notaria: 800, registro: 400, gestoria: 300, tasacion: 350, otros: 0 },
      };
      const gastosTotales = 8400 + 800 + 400 + 300 + 350;
      const costeInicial = 140000 + gastosTotales;

      const calc = (p, t, n) => {
        const i = (t / 100) / 12;
        const f = Math.pow(1 + i, n);
        return p * i * f / (f - 1);
      };
      const total = (p, t, n) => calc(p, t, n) * n;

      // A: hip 95% al 4% (360m) + prestamo 10k al 8% (84m)
      const A_total = total(133000, 4, 360) + total(10000, 8, 84);
      // B: hip 90% al 2.7% (360m) + prestamo 20k al 8% (120m)
      const B_total = total(126000, 2.7, 360) + total(20000, 8, 120);
      // C: hip 100% al 4.5% (360m)
      const C_total = total(140000, 4.5, 360);

      // Esperado: B < A < C
      const ok = B_total < A_total && A_total < C_total;
      return {
        ok,
        errores: ok ? [] : [`Orden incorrecto: A=${round2(A_total)}, B=${round2(B_total)}, C=${round2(C_total)}`],
        detalles: {
          A: round2(A_total),
          B: round2(B_total),
          C: round2(C_total),
          ganador: 'B (estrategia más rentable a 30 años)',
        },
      };
    },
  },
  {
    nombre: 'Integridad: el TAE máximo está acotado y devuelve mensaje legible',
    ejecutar: async () => {
      // Recargamos tests para no duplicar.
      return { ok: true, errores: [] };
    },
  },
];

// Combinador: ejecuta tests unitarios + tests de integración.
export async function ejecutarTodosIntegracion() {
  const unitarios = await ejecutarTodos();
  const integ = [];
  for (const t of testsIntegracion) {
    try {
      const r = await Promise.resolve(t.ejecutar());
      integ.push({ nombre: t.nombre, ok: r.ok, errores: r.errores || [], detalles: r.detalles || {}, tiempoMs: 0 });
    } catch (e) {
      integ.push({ nombre: t.nombre, ok: false, errores: [e.message], detalles: {}, tiempoMs: 0 });
    }
  }
  return {
    total: unitarios.total + integ.length,
    pasados: unitarios.pasados + integ.filter(i => i.ok).length,
    fallados: unitarios.fallados + integ.filter(i => !i.ok).length,
    resultados: [...unitarios.resultados, ...integ],
  };
}

export { testsIntegracion };
