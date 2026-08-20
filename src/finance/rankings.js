// rankings.js - Calcula rankings multiples de estrategias segun criterios configurables.
//
// Rankings soportados (cada uno devuelve una lista ordenada de menor a mejor):
//   - porCosteTotal        : menor coste total acumulado gana
//   - porCosteReal         : menor coste real ajustado por inflacion (si hay datos)
//   - porLiquidezInicial   : menor dinero necesario el dia de la firma gana
//   - porCuotaInicial      : menor cuota mensual inicial gana
//   - porCuotaTrasPrestamos: menor cuota tras terminar los prestamos personales
//   - porIntereses         : menor intereses pagados gana
//   - porPatrimonioFinal   : mayor patrimonio neto al final gana
//   - porEsfuerzoIngresos  : menor % de ingresos destinado a deuda gana
//   - personalizado        : combina varios criterios con pesos del usuario
//
// Cada ranking devuelve: [{ estrategia, estrategiaId, valor, ranking, detalle }]

import { analizarEstrategia } from './strategy.js';
import { round2 } from '../core/money.js';

/**
 * Construye un ranking para todas las estrategias definidas.
 * @param {object} ctx
 * @param {Array} ctx.estrategias
 * @param {Function} ctx.findPropiedad
 * @param {Function} ctx.findOferta
 * @param {Function} ctx.findPrestamo
 * @param {Function} [ctx.findPerfil]
 * @param {object} [ctx.supuestos]  - { inflacionAnual, crecimientoVivienda, ... } - opcional, usado por patrimonio
 * @returns {object} - objeto con cada tipo de ranking
 */
export function calcularRankings(ctx) {
  const {
    estrategias,
    findPropiedad,
    findOferta,
    findPrestamo,
    findPerfil,
    supuestos = {},
  } = ctx;

  // Pre-analisis.
  const items = [];
  for (const e of estrategias) {
    const propiedad = findPropiedad(e.propiedadId);
    const hipoteca = findOferta(e.hipotecaId);
    if (!propiedad || !hipoteca) continue;
    const prestamos = (e.prestamosIds || []).map(id => findPrestamo(id)).filter(Boolean);
    const perfil = findPerfil ? findPerfil(e.perfilId) : null;
    const analisis = analizarEstrategia({ propiedad, hipoteca, prestamos, perfil });
    items.push({ estrategia: e, propiedad, hipoteca, prestamos, analisis, perfil });
  }

  if (items.length === 0) {
    return {
      porCosteTotal: [],
      porCosteReal: [],
      porLiquidezInicial: [],
      porCuotaInicial: [],
      porCuotaTrasPrestamos: [],
      porIntereses: [],
      porPatrimonioFinal: [],
      porEsfuerzoIngresos: [],
    };
  }

  // Helpers.
  const ordAsc = (key) => [...items].sort((a, b) => a.analisis.totales[key] - b.analisis.totales[key]);
  const ordAscCustom = (getter) => [...items].sort((a, b) => getter(a) - getter(b));
  const ordDescCustom = (getter) => [...items].sort((a, b) => getter(b) - getter(a));

  const makeRanking = (sorted, getter) =>
    sorted.map((item, idx) => ({
      estrategiaId: item.estrategia.id,
      estrategia: item.estrategia,
      hipoteca: item.hipoteca,
      propiedad: item.propiedad,
      ranking: idx + 1,
      valor: round2(getter(item)),
    }));

  // Patrimonio final: requiere valor vivienda a horizonte. Para FASE 3 (FASE 2 simplificado).
  const valorViviendaFinalEstimado = (item) => {
    const v0 = item.propiedad.precio || 0;
    const meses = item.analisis.totales.meses;
    const anios = meses / 12;
    const g = (Number(supuestos.crecimientoVivienda) || 0) / 100;
    return v0 * Math.pow(1 + g, anios);
  };

  const patrimonioFinal = (item) => {
    const v = valorViviendaFinalEstimado(item);
    const d = item.analisis.resumenAnual[item.analisis.resumenAnual.length - 1]?.saldoTotal || 0;
    return v - d;
  };

  const esfuerzoIngresos = (item) => {
    const cuota = item.analisis.totales.cuotaInicial;
    const ingresos = item.perfil?.ingresosNetosMensuales || 0;
    if (ingresos <= 0) return Infinity;
    return (cuota / ingresos) * 100;
  };

  return {
    porCosteTotal:        makeRanking(ordAsc('totalPagado'),       x => x.analisis.totales.totalPagado),
    porLiquidezInicial:   makeRanking(ordAscCustom(x => x.analisis.costeInicial.dineroNecesario), x => x.analisis.costeInicial.dineroNecesario),
    porCuotaInicial:      makeRanking(ordAsc('cuotaInicial'),       x => x.analisis.totales.cuotaInicial),
    porCuotaTrasPrestamos: makeRanking(ordAsc('cuotaDespuesPrestamos'), x => x.analisis.totales.cuotaDespuesPrestamos),
    porIntereses:         makeRanking(ordAsc('totalIntereses'),     x => x.analisis.totales.totalIntereses),
    porEsfuerzoIngresos:  makeRanking(ordAscCustom(esfuerzoIngresos), esfuerzoIngresos),
    porPatrimonioFinal:   makeRanking(ordDescCustom(patrimonioFinal), patrimonioFinal),
    // porCosteReal: placeholder - se implementara en FASE 3 con inflacion por estrategia.
    porCosteReal:         makeRanking(ordAsc('totalPagado'),       x => x.analisis.totales.totalPagado),
  };
}

/**
 * Ranking "Mejor para mi situacion" con pesos personalizables.
 * Cada criterio se normaliza a 0-100 (mayor = mejor), luego se pondera.
 *
 * Pesos por defecto:
 *   costeTotal: 30, liquidezInicial: 25, cuotaInicial: 20, patrimonioFinal: 15, esfuerzoIngresos: 10
 *
 * @param {object} rankings - salida de calcularRankings()
 * @param {object} pesos - { costeTotal, liquidezInicial, cuotaInicial, patrimonioFinal, esfuerzoIngresos }
 * @returns {Array<{ estrategiaId, ranking, puntuacion, desglose }>}
 */
export function rankingPersonalizado(rankings, pesos = {}) {
  const w = {
    costeTotal: 30,
    liquidezInicial: 25,
    cuotaInicial: 20,
    patrimonioFinal: 15,
    esfuerzoIngresos: 10,
    ...pesos,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(w)) w[k] = w[k] / total; // normalizar a suma = 1

  const criterios = [
    { key: 'costeTotal', src: rankings.porCosteTotal, menorEsMejor: true },
    { key: 'liquidezInicial', src: rankings.porLiquidezInicial, menorEsMejor: true },
    { key: 'cuotaInicial', src: rankings.porCuotaInicial, menorEsMejor: true },
    { key: 'patrimonioFinal', src: rankings.porPatrimonioFinal, menorEsMejor: false },
    { key: 'esfuerzoIngresos', src: rankings.porEsfuerzoIngresos, menorEsMejor: true },
  ];

  // Recolectar IDs únicos (algunos rankings pueden tener menos items).
  const idsSet = new Set();
  for (const c of criterios) for (const r of c.src) idsSet.add(r.estrategiaId);
  const ids = [...idsSet];

  const score = new Map();
  for (const id of ids) {
    const desglose = {};
    let total2 = 0;
    for (const c of criterios) {
      const item = c.src.find(r => r.estrategiaId === id);
      if (!item) { desglose[c.key] = null; continue; }
      // Puntuacion: 100 si es el mejor, 0 si es el peor, interpolacion lineal.
      const n = c.src.length;
      let pos;
      if (c.menorEsMejor) pos = (item.ranking - 1) / Math.max(1, n - 1); // 0 mejor, 1 peor
      else pos = (n - item.ranking) / Math.max(1, n - 1);
      const puntos = Math.round((1 - pos) * 100);
      desglose[c.key] = { puntos, peso: Math.round(w[c.key] * 100), valor: item.valor };
      total2 += puntos * w[c.key];
    }
    score.set(id, { estrategiaId: id, puntuacion: Math.round(total2), desglose });
  }

  const sorted = [...score.values()].sort((a, b) => b.puntuacion - a.puntuacion);
  return sorted.map((s, idx) => ({ ...s, ranking: idx + 1 }));
}
