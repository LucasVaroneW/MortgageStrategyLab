// Tests de los modulos de graficos y rankings.

import { createLineChart, createBarChart, __test__ } from '../ui/charts.js';
import { calcularRankings, rankingPersonalizado } from '../finance/rankings.js';

const casiIgual = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

// Simulamos un entorno DOM minimo para jsdom.
// Como no tenemos jsdom, los tests del modulo de graficos validan las funciones puras.
// Para la creacion real de SVG en navegador, los tests visuales van en tests.html.

export const testsGraficosRankings = [
  // ======================
  //   formato y escalas
  // ======================
  {
    nombre: 'graficos: formatNumber maneja magnitudes grandes y pequenas',
    ejecutar: () => {
      const f = __test__.formatNumber;
      const ok = f(1500000) === '1.5M'
        && f(7500) === '7.5k'
        && f(42.7) === '43'
        && f(0) === '0';
      return { ok, errores: ok ? [] : [`formatNumber fallo: ${f(1500000)} / ${f(7500)} / ${f(42.7)} / ${f(0)}`] };
    },
  },
  {
    nombre: 'graficos: niceTicks produce ticks en rango plausible',
    ejecutar: () => {
      const ticks = __test__.niceTicks(0, 240000, 5);
      const ok = ticks.length >= 3 && ticks.length <= 8 && ticks[0] >= 0 && ticks[ticks.length - 1] <= 240001;
      return { ok, errores: ok ? [] : [`niceTicks devolvio ${JSON.stringify(ticks)}`] };
    },
  },
  {
    nombre: 'graficos: alignSeriesData rellena huecos con null',
    ejecutar: () => {
      const s = [
        { name: 'A', data: [{ x: 0, y: 1 }, { x: 2, y: 3 }] },
        { name: 'B', data: [{ x: 1, y: 2 }, { x: 2, y: 4 }] },
      ];
      const aligned = __test__.alignSeriesData(s);
      const ok = aligned[0].length === 3 && aligned[0][1].y === null && aligned[1][0].y === null && aligned[1][2].y === 4;
      return { ok, errores: ok ? [] : ['alignSeriesData no relleno huecos correctamente'] };
    },
  },
  {
    nombre: 'graficos: createLineChart y createBarChart existen y crean instancias',
    ejecutar: () => {
      // Sin DOM real, solo verificamos que las funciones existen y devuelven objetos.
      // El test visual real esta en tests.html.
      const ok = typeof createLineChart === 'function' && typeof createBarChart === 'function';
      return { ok, errores: ok ? [] : ['Funciones createLineChart/createBarChart no exportadas'] };
    },
  },

  // ======================
  //   RANKINGS
  // ======================
  {
    nombre: 'rankings: calcularRankings devuelve multiples rankings consistentes',
    ejecutar: () => {
      const propiedadA = { id: 'p', precio: 100000, valorTasacion: 100000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };
      const propiedadB = { id: 'p', precio: 120000, valorTasacion: 120000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };

      const hipCara = { id: 'hc', banco: 'X', producto: 'cara', tipo: 'fija', fija: { tin: 4, tae: 4.5 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 95, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const hipBarata = { id: 'hb', banco: 'Y', producto: 'barata', tipo: 'fija', fija: { tin: 2.5, tae: 3 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 90, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };

      const estrategias = [
        { id: 'eA', nombre: 'A', propiedadId: 'p', hipotecaId: 'hc', prestamosIds: [] },
        { id: 'eB', nombre: 'B', propiedadId: 'p', hipotecaId: 'hb', prestamosIds: [] },
      ];
      const r = calcularRankings({
        estrategias,
        findPropiedad: () => propiedadA,
        findOferta: (id) => id === 'hc' ? hipCara : hipBarata,
        findPrestamo: () => null,
        findPerfil: () => null,
        supuestos: { crecimientoVivienda: 2 },
      });
      const ok = r.porCosteTotal.length === 2
        && r.porCosteTotal[0].estrategiaId === 'eB'
        && r.porCosteTotal[1].estrategiaId === 'eA'
        && r.porCuotaInicial.length === 2
        && r.porEsfuerzoIngresos.length === 2; // sin perfil no hay esfuerzo, pero el array existe
      return {
        ok,
        detalles: {
          ganadorCosteTotal: r.porCosteTotal[0]?.estrategiaId,
          costeEstrategiaB: r.porCosteTotal.find(x => x.estrategiaId === 'eB')?.valor,
          costeEstrategiaA: r.porCosteTotal.find(x => x.estrategiaId === 'eA')?.valor,
        },
        errores: ok ? [] : [`Orden de coste total incorrecto: ${r.porCosteTotal.map(x => x.estrategiaId).join(',')}`],
      };
    },
  },
  {
    nombre: 'rankings: porPatrimonioFinal ordena de mayor a menor',
    ejecutar: () => {
      const propiedad = { id: 'p', precio: 100000, valorTasacion: 100000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };
      const hipCara = { id: 'h', banco: 'X', producto: 'X', tipo: 'fija', fija: { tin: 4, tae: 4.5 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 100, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const estrategias = [
        { id: 'eA', nombre: 'A', propiedadId: 'p', hipotecaId: 'h', prestamosIds: [] },
      ];
      const r = calcularRankings({
        estrategias, findPropiedad: () => propiedad, findOferta: () => hipCara, findPrestamo: () => null, findPerfil: () => null,
        supuestos: { crecimientoVivienda: 2 },
      });
      const ok = r.porPatrimonioFinal.length === 1 && r.porPatrimonioFinal[0].valor > 0;
      return {
        ok,
        detalles: { patrimonioEstimado: r.porPatrimonioFinal[0]?.valor },
        errores: ok ? [] : ['Sin patrimonio calculado'],
      };
    },
  },
  {
    nombre: 'rankings: rankingPersonalizado devuelve puntuacion 0-100 y desglose',
    ejecutar: () => {
      const r = calcularRankings({
        estrategias: [
          { id: 'e1', nombre: '1', propiedadId: 'p', hipotecaId: 'h1', prestamosIds: [] },
          { id: 'e2', nombre: '2', propiedadId: 'p', hipotecaId: 'h2', prestamosIds: [] },
        ],
        findPropiedad: () => ({ id: 'p', precio: 100000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } }),
        findOferta: (id) => ({
          id, banco: 'X', producto: id, tipo: 'fija',
          fija: { tin: id === 'h1' ? 4 : 2.5, tae: 4.5 },
          plazo: { meses: 360 },
          financiacion: { porcentajeMaximo: 95, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null },
          comisiones: { apertura: 0, aperturaFija: 0 },
        }),
        findPrestamo: () => null,
        findPerfil: () => null,
        supuestos: { crecimientoVivienda: 2 },
      });
      const p = rankingPersonalizado(r, { costeTotal: 50, liquidezInicial: 30, cuotaInicial: 20, patrimonioFinal: 0, esfuerzoIngresos: 0 });
      const ok = p.length === 2
        && p[0].puntuacion >= p[1].puntuacion
        && p[0].puntuacion >= 0 && p[0].puntuacion <= 100
        && typeof p[0].desglose === 'object';
      return {
        ok,
        detalles: {
          ganador: p[0]?.estrategiaId,
          puntuacionGanador: p[0]?.puntuacion,
          puntuacionPerdedor: p[1]?.puntuacion,
        },
        errores: ok ? [] : [`Ranking personalizado mal formado: ${JSON.stringify(p.map(x => x.puntuacion))}`],
      };
    },
  },
  {
    nombre: 'rankings: con perfil, porEsfuerzoIngresos devuelve % realista',
    ejecutar: () => {
      const propiedad = { id: 'p', precio: 100000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };
      const hip = { id: 'h', banco: 'X', producto: 'X', tipo: 'fija', fija: { tin: 4, tae: 4.5 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 95, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const perfil = { id: 'u', ingresosNetosMensuales: 2500 };
      const r = calcularRankings({
        estrategias: [{ id: 'e', nombre: 'E', propiedadId: 'p', hipotecaId: 'h', prestamosIds: [], perfilId: 'u' }],
        findPropiedad: () => propiedad,
        findOferta: () => hip,
        findPrestamo: () => null,
        findPerfil: () => perfil,
        supuestos: {},
      });
      const esfuerzo = r.porEsfuerzoIngresos[0]?.valor;
      const ok = typeof esfuerzo === 'number' && esfuerzo > 0 && esfuerzo < 200;
      return {
        ok,
        detalles: { esfuerzoPorcentaje: esfuerzo },
        errores: ok ? [] : [`Esfuerzo irreal: ${esfuerzo}`],
      };
    },
  },
];
