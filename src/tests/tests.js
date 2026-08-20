// Tests del motor financiero.
// Estructura: array de { nombre, ejecutar() -> { ok, errores, tiempoMs, detalles } }.
// Se ejecuta tanto en navegador (tests.html) como en Node (run-tests.mjs).

import { amortizar, calcCuota } from '../finance/loan.js';
import {
  amortizarHipoteca,
  calcularImporteHipoteca,
  tinEnMes,
  amortizarConCambioTIN,
  obtenerTramosMixta,
} from '../finance/mortgage.js';
import { amortizarPrestamoPersonal } from '../finance/personalLoan.js';
import { analizarEstrategia } from '../finance/strategy.js';
import { resumenCosteInicial, costeInicialTotal } from '../finance/initialCost.js';
import { encontrarEquilibrio } from '../finance/breakeven.js';
import { calcularTAEMaximo, calcularTAEReal } from '../finance/taeMax.js';
import { round2 } from '../core/money.js';

const casiIgual = (a, b, tol = 0.01) => Math.abs(a - b) < tol;
const casiIgualEur = (a, b, tol = 1) => Math.abs(a - b) < tol;

export const tests = [
  // =====================
  //   CUOTAS AISLADAS
  // =====================
  {
    nombre: 'Cuota: 150.000 € al 2% durante 30 años (360 meses)',
    ejecutar: () => {
      const cuota = calcCuota(150000, 2, 360);
      // Fórmula: 150000 * (0.02/12) * (1+0.02/12)^360 / ((1+0.02/12)^360 - 1) ≈ 554,43 €
      const ok = casiIgual(cuota, 554.43, 0.5);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~554,43 €, obtuvo ${round2(cuota)} €`],
        detalles: { cuotaCalculada: round2(cuota) },
      };
    },
  },
  {
    nombre: 'Cuota: 133.000 € al 4% durante 30 años (360 meses)',
    ejecutar: () => {
      const cuota = calcCuota(133000, 4, 360);
      // ≈ 635,13 €
      const ok = casiIgual(cuota, 635.13, 0.5);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~635,13 €, obtuvo ${round2(cuota)} €`],
        detalles: { cuotaCalculada: round2(cuota) },
      };
    },
  },
  {
    nombre: 'Cuota: 150.000 € al 5% durante 25 años (300 meses)',
    ejecutar: () => {
      const cuota = calcCuota(150000, 5, 300);
      // Fórmula francesa: 150000 * (0.05/12) * (1+0.05/12)^300 / ((1+0.05/12)^300 - 1) = 876,89 €
      const ok = casiIgual(cuota, 876.89, 0.05);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~876,89 €, obtuvo ${round2(cuota)} €`],
        detalles: { cuotaCalculada: round2(cuota) },
      };
    },
  },
  {
    nombre: 'Cuota: 7.000 € préstamo personal al 8% durante 7 años (84 meses)',
    ejecutar: () => {
      const cuota = calcCuota(7000, 8, 84);
      // Fórmula francesa: 7000 * (0.08/12) * (1.006667)^84 / ((1.006667)^84 - 1) = 109,10 €
      const ok = casiIgual(cuota, 109.10, 0.05);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~109,10 €, obtuvo ${round2(cuota)} €`],
        detalles: { cuotaCalculada: round2(cuota) },
      };
    },
  },
  {
    nombre: 'Amortización: total intereses para 150k al 2% a 30 años',
    ejecutar: () => {
      const a = amortizar({ principal: 150000, tinAnualPct: 2, meses: 360 });
      // Total ≈ 49.594 €
      const ok = casiIgualEur(a.totalIntereses, 49594, 50);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~49.594 €, obtuvo ${round2(a.totalIntereses)} €`],
        detalles: { totalIntereses: round2(a.totalIntereses), totalPagado: round2(a.totalPagado) },
      };
    },
  },
  {
    nombre: 'Amortización: total intereses para 133k al 4% a 30 años',
    ejecutar: () => {
      const a = amortizar({ principal: 133000, tinAnualPct: 4, meses: 360 });
      // Cuota exacta = 634,96 €. Total = 634,96 * 360 = 228.585,6 €. Intereses = 95.585,6 €
      const ok = casiIgualEur(a.totalIntereses, 95586, 10);
      return {
        ok,
        errores: ok ? [] : [`Esperado ~95.586 €, obtuvo ${round2(a.totalIntereses)} €`],
        detalles: { totalIntereses: round2(a.totalIntereses), totalPagado: round2(a.totalPagado) },
      };
    },
  },
  {
    nombre: 'Amortización: último mes cuadra saldo exactamente a 0',
    ejecutar: () => {
      const a = amortizar({ principal: 100000, tinAnualPct: 3, meses: 240 });
      const ultimo = a.tablaMensual[a.tablaMensual.length - 1];
      const ok = casiIgual(ultimo.saldo, 0, 0.01);
      return {
        ok,
        errores: ok ? [] : [`Saldo final esperado 0, obtuvo ${round2(ultimo.saldo)} €`],
        detalles: { ultimoSaldo: round2(ultimo.saldo) },
      };
    },
  },
  {
    nombre: 'Amortización: suma de principal = principal inicial',
    ejecutar: () => {
      const a = amortizar({ principal: 50000, tinAnualPct: 2.5, meses: 120 });
      const suma = a.tablaMensual.reduce((acc, f) => acc + f.principal, 0);
      const ok = casiIgual(suma, 50000, 1);
      return {
        ok,
        errores: ok ? [] : [`Suma principal esperado ~50.000 €, obtuvo ${round2(suma)} €`],
        detalles: { sumaPrincipal: round2(suma) },
      };
    },
  },

  // =====================
  //   HIPOTECA
  // =====================
  {
    nombre: 'Hipoteca fija: TIN se mantiene durante toda la vida',
    ejecutar: () => {
      const propiedad = { precio: 140000, valorTasacion: 140000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };
      const oferta = {
        id: 'h1',
        banco: 'BBVA',
        producto: 'Fija',
        tipo: 'fija',
        fija: { tin: 4, tae: 4.87 },
        plazo: { meses: 360 },
        financiacion: { porcentajeMaximo: 95, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null },
        comisiones: { apertura: 0, aperturaFija: 0 },
      };
      const tinInicial = tinEnMes(oferta, 1);
      const tinFinal = tinEnMes(oferta, 360);
      const ok = tinInicial === 4 && tinFinal === 4;
      return {
        ok,
        errores: ok ? [] : [`TIN inicial=${tinInicial}, final=${tinFinal}, esperado 4`],
      };
    },
  },
  {
    nombre: 'Hipoteca mixta: TIN cambia tras los años fijos',
    ejecutar: () => {
      const oferta = {
        tipo: 'mixta',
        mixta: { aniosTramoFijo: 10, tinTramoFijo: 2.8, tae: 3.5, tramoVariable: { euribor: 2.5, diferencial: 0.5 } },
        plazo: { meses: 360 },
      };
      const tinMes1 = tinEnMes(oferta, 1);
      const tinMes120 = tinEnMes(oferta, 120);
      const tinMes121 = tinEnMes(oferta, 121);
      const tinMes360 = tinEnMes(oferta, 360);
      const ok = tinMes1 === 2.8 && tinMes120 === 2.8 && tinMes121 === 3.0 && tinMes360 === 3.0;
      return {
        ok,
        errores: ok ? [] : [`TIN meses 1/120/121/360 = ${tinMes1}/${tinMes120}/${tinMes121}/${tinMes360}, esperado 2.8/2.8/3.0/3.0`],
      };
    },
  },
  {
    nombre: 'Hipoteca: calcularImporteHipoteca según % y base',
    ejecutar: () => {
      const propiedad = { precio: 140000, valorTasacion: 150000 };
      const a1 = { financiacion: { porcentajeMaximo: 80, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null } };
      const a2 = { financiacion: { porcentajeMaximo: 80, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null } };
      const a3 = { financiacion: { porcentajeMaximo: 80, baseCalculo: 'menor', importeMaximo: null, importeSolicitado: null } };
      const imp1 = calcularImporteHipoteca(propiedad, a1);
      const imp2 = calcularImporteHipoteca(propiedad, a2);
      const imp3 = calcularImporteHipoteca(propiedad, a3);
      const ok = imp1 === 112000 && imp2 === 120000 && imp3 === 112000;
      return {
        ok,
        errores: ok ? [] : [`Esperado 112000/120000/112000, obtuvo ${imp1}/${imp2}/${imp3}`],
      };
    },
  },
  {
    nombre: 'Hipoteca mixta: amortización con dos tramos',
    ejecutar: () => {
      const tramos = obtenerTramosMixta({
        tipo: 'mixta',
        mixta: { aniosTramoFijo: 10, tinTramoFijo: 2.8, tramoVariable: { euribor: 2.5, diferencial: 0.5 } },
        plazo: { meses: 360 },
      });
      const a = amortizarConCambioTIN({
        principal: 150000,
        tramos,
        nombre: 'mix',
      });
      // Saldo final debe ser 0.
      const ok = a.tablaMensual.length === 360 && casiIgual(a.tablaMensual[359].saldo, 0, 0.01);
      return {
        ok,
        errores: ok ? [] : [`Saldo final: ${a.tablaMensual[359]?.saldo}, meses: ${a.tablaMensual.length}`],
        detalles: { totalIntereses: round2(a.totalIntereses) },
      };
    },
  },

  // =====================
  //   ESTRATEGIAS
  // =====================
  {
    nombre: 'Ejemplo real: Estrategia A (vivienda 140k, hipoteca 95% al 4%, préstamo 10k al 8%)',
    ejecutar: () => {
      const propiedad = {
        precio: 140000,
        valorTasacion: 140000,
        gastosCompra: { modo: 'MANUAL', impuestos: 8400, notaria: 800, registro: 400, gestoria: 300, tasacion: 350, otros: 0, porcentajeEstimado: 0 },
      };
      const hipoteca = {
        id: 'h',
        banco: 'BBVA',
        producto: '95%',
        tipo: 'fija',
        fija: { tin: 4, tae: 4.87 },
        plazo: { meses: 360 },
        financiacion: { porcentajeMaximo: 95, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null },
        comisiones: { apertura: 0, aperturaFija: 0 },
      };
      const prestamo = { id: 'p', nombre: 'Personal', importe: 10000, tin: 8, tae: 8, plazoMeses: 84 };
      const a = analizarEstrategia({ propiedad, hipoteca, prestamos: [prestamo], perfil: null });
      const ok = a.costeInicial.dineroNecesario >= 0 && a.totales.totalPagado > 0;
      return {
        ok,
        errores: ok ? [] : [`Análisis incompleto`],
        detalles: {
          costeInicial: round2(a.costeInicial.costeInicialTotal),
          importeHipoteca: round2(a.costeInicial.importeHipoteca),
          importePrestamos: round2(a.costeInicial.importePrestamos),
          dineroNecesario: round2(a.costeInicial.dineroNecesario),
          cuotaInicial: round2(a.totales.cuotaInicial),
          cuotaDespues: round2(a.totales.cuotaDespuesPrestamos),
          totalPagado: round2(a.totales.totalPagado),
          totalIntereses: round2(a.totales.totalIntereses),
        },
      };
    },
  },
  {
    nombre: 'Ejemplo real: Estrategia B (hipoteca 90% al 2.7%, préstamo 20k al 8% a 10 años)',
    ejecutar: () => {
      const propiedad = {
        precio: 140000,
        valorTasacion: 140000,
        gastosCompra: { modo: 'MANUAL', impuestos: 8400, notaria: 800, registro: 400, gestoria: 300, tasacion: 350, otros: 0, porcentajeEstimado: 0 },
      };
      const hipoteca = {
        id: 'h', banco: 'X', producto: '90%',
        tipo: 'fija', fija: { tin: 2.7, tae: 3.1 },
        plazo: { meses: 360 },
        financiacion: { porcentajeMaximo: 90, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null },
        comisiones: { apertura: 0, aperturaFija: 0 },
      };
      const prestamo = { id: 'p', nombre: 'Personal', importe: 20000, tin: 8, tae: 8, plazoMeses: 120 };
      const a = analizarEstrategia({ propiedad, hipoteca, prestamos: [prestamo], perfil: null });
      return {
        ok: a.totales.totalPagado > 0,
        detalles: {
          importeHipoteca: round2(a.costeInicial.importeHipoteca),
          dineroNecesario: round2(a.costeInicial.dineroNecesario),
          cuotaInicial: round2(a.totales.cuotaInicial),
          cuotaDespues: round2(a.totales.cuotaDespuesPrestamos),
          totalPagado: round2(a.totales.totalPagado),
          totalIntereses: round2(a.totales.totalIntereses),
        },
      };
    },
  },
  {
    nombre: 'Ejemplo real: Estrategia C (hipoteca 100% al 4.5%, sin préstamo)',
    ejecutar: () => {
      const propiedad = {
        precio: 140000,
        valorTasacion: 140000,
        gastosCompra: { modo: 'MANUAL', impuestos: 8400, notaria: 800, registro: 400, gestoria: 300, tasacion: 350, otros: 0, porcentajeEstimado: 0 },
      };
      const hipoteca = {
        id: 'h', banco: 'Y', producto: '100%',
        tipo: 'fija', fija: { tin: 4.5, tae: 5 },
        plazo: { meses: 360 },
        financiacion: { porcentajeMaximo: 100, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null },
        comisiones: { apertura: 0, aperturaFija: 0 },
      };
      const a = analizarEstrategia({ propiedad, hipoteca, prestamos: [], perfil: null });
      return {
        ok: a.totales.totalPagado > 0,
        detalles: {
          importeHipoteca: round2(a.costeInicial.importeHipoteca),
          dineroNecesario: round2(a.costeInicial.dineroNecesario),
          cuotaInicial: round2(a.totales.cuotaInicial),
          totalPagado: round2(a.totales.totalPagado),
          totalIntereses: round2(a.totales.totalIntereses),
        },
      };
    },
  },

  // =====================
  //   COSTE INICIAL
  // =====================
  {
    nombre: 'costeInicialTotal: MANUAL suma los gastos al precio',
    ejecutar: () => {
      const p = { precio: 140000, gastosCompra: { modo: 'MANUAL', impuestos: 8400, notaria: 800, registro: 400, gestoria: 300, tasacion: 350, otros: 0 } };
      const coste = costeInicialTotal(p);
      const ok = coste === 140000 + 8400 + 800 + 400 + 300 + 350;
      return {
        ok,
        errores: ok ? [] : [`Esperado ${140000 + 8400 + 800 + 400 + 300 + 350}, obtuvo ${coste}`],
      };
    },
  },
  {
    nombre: 'costeInicialTotal: ESTIMADO aplica % sobre precio',
    ejecutar: () => {
      const p = { precio: 100000, gastosCompra: { modo: 'ESTIMADO', porcentajeEstimado: 10 } };
      const coste = costeInicialTotal(p);
      const ok = coste === 110000;
      return {
        ok,
        errores: ok ? [] : [`Esperado 110000, obtuvo ${coste}`],
      };
    },
  },
  {
    nombre: 'resumenCosteInicial: detecta liquidez insuficiente',
    ejecutar: () => {
      const propiedad = {
        precio: 100000,
        gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 },
      };
      const hipoteca = {
        id: 'h', banco: 'X', producto: 'X',
        tipo: 'fija', fija: { tin: 3, tae: 3 },
        plazo: { meses: 360 },
        financiacion: { porcentajeMaximo: 100, baseCalculo: 'precio', importeMaximo: null, importeSolicitado: null },
        comisiones: { apertura: 0, aperturaFija: 0 },
      };
      const r = resumenCosteInicial(propiedad, hipoteca, [], { ahorrosDisponibles: 5000, colchonMinimo: 2000 });
      // coste = 100000, hipoteca = 100000, dineroNecesario = 0, ahorro restante = 5000, OK.
      const ok1 = r.alertaLiquidez === false;
      const r2 = resumenCosteInicial(propiedad, hipoteca, [], { ahorrosDisponibles: 1500, colchonMinimo: 2000 });
      // ahorro restante = 1500 < 2000 → alerta.
      const ok2 = r2.alertaLiquidez === true;
      return {
        ok: ok1 && ok2,
        errores: [
          !ok1 && 'No detectó que con 5000€ hay liquidez suficiente.',
          !ok2 && 'No detectó liquidez insuficiente.',
        ].filter(Boolean),
      };
    },
  },

  // =====================
  //   PUNTO DE EQUILIBRIO
  // =====================
  {
    nombre: 'encontrarEquilibrio: hipoteca barata + personal caro vs hipoteca cara sin personal',
    ejecutar: () => {
      const propiedad = {
        precio: 140000,
        valorTasacion: 140000,
        gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 },
      };
      // Estrategia A: hipoteca barata (90%) + préstamo personal caro.
      const hipA = { id: 'A', banco: 'X', producto: 'X', tipo: 'fija', fija: { tin: 2.7, tae: 3 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 90, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const persA = { id: 'p', nombre: 'P', importe: 14000, tin: 8, tae: 8, plazoMeses: 120 };
      // Estrategia B: hipoteca más cara (95%) sin préstamo.
      const hipB = { id: 'B', banco: 'Y', producto: 'Y', tipo: 'fija', fija: { tin: 4, tae: 4.5 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 95, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const eq = encontrarEquilibrio(
        { _perfil: null, prestamosIds: ['p'], hipotecaId: 'A' },
        { _perfil: null, prestamosIds: [], hipotecaId: 'B' },
        { propiedad, prestamosPorId: [persA], hipotecaPorId: [hipA, hipB] },
      );
      return {
        ok: typeof eq.totalEstrategiaA === 'number' && typeof eq.totalEstrategiaB === 'number',
        detalles: {
          existe: eq.existe,
          mes: eq.mes,
          anio: eq.anio,
          totalA: round2(eq.totalEstrategiaA),
          totalB: round2(eq.totalEstrategiaB),
          mensaje: eq.mensaje,
        },
      };
    },
  },

  // =====================
  //   TAE MAX
  // =====================
  {
    nombre: 'calcularTAEMaximo: encuentra una TAE máxima razonable',
    ejecutar: () => {
      const propiedad = { precio: 140000, valorTasacion: 140000, gastosCompra: { modo: 'MANUAL', impuestos: 0, notaria: 0, registro: 0, gestoria: 0, tasacion: 0, otros: 0 } };
      const hipA = { id: 'A', banco: 'X', producto: 'X', tipo: 'fija', fija: { tin: 2.7, tae: 3 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 90, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const hipB = { id: 'B', banco: 'Y', producto: 'Y', tipo: 'fija', fija: { tin: 4, tae: 4.5 }, plazo: { meses: 360 }, financiacion: { porcentajeMaximo: 95, baseCalculo: 'tasacion', importeMaximo: null, importeSolicitado: null }, comisiones: { apertura: 0, aperturaFija: 0 } };
      const prestamoPersonal = { id: 'p', nombre: 'P', importe: 14000, tin: 7.5, tae: 7.5, plazoMeses: 120 };
      const r = calcularTAEMaximo({ propiedad, hipotecaA: hipA, prestamoPersonal, hipotecaB: hipB });
      return {
        ok: r.taeMax !== null && r.taeMax >= 0 && r.taeMax <= 50,
        detalles: { taeMax: r.taeMax, viable: r.viable, mensaje: r.mensaje },
      };
    },
  },
  {
    nombre: 'calcularTAEReal: sin comisión, TAE queda muy cerca del TIN (solo capitalización mensual)',
    ejecutar: () => {
      // Sin comisiones la TAE sigue siendo ligeramente superior al TIN nominal, porque
      // la TAE anualiza la capitalización mensual: (1+TIN/12/100)^12 - 1 > TIN.
      const tin = 7.5;
      const tae = calcularTAEReal({ importe: 10000, tin, meses: 60 });
      return { ok: tae !== null && tae > tin && casiIgual(tae, tin, 0.5), detalles: { tin, tae } };
    },
  },
  {
    nombre: 'calcularTAEReal: con comisión de apertura, la TAE es mayor que el TIN',
    ejecutar: () => {
      const tin = 7.5;
      const tae = calcularTAEReal({ importe: 10000, tin, meses: 60, comisionAperturaPct: 2 });
      return {
        ok: tae !== null && tae > tin,
        detalles: { tin, tae },
      };
    },
  },
];

// Ejecuta todos los tests y devuelve un resumen.
export async function ejecutarTodos() {
  const resultados = [];
  for (const t of tests) {
    const t0 = performance.now ? performance.now() : Date.now();
    try {
      const r = await Promise.resolve(t.ejecutar());
      const t1 = performance.now ? performance.now() : Date.now();
      resultados.push({
        nombre: t.nombre,
        ok: r.ok,
        errores: r.errores || [],
        detalles: r.detalles || {},
        tiempoMs: round2(t1 - t0),
      });
    } catch (e) {
      resultados.push({
        nombre: t.nombre,
        ok: false,
        errores: [e.message || String(e)],
        detalles: {},
        tiempoMs: 0,
      });
    }
  }
  const total = resultados.length;
  const pasados = resultados.filter(r => r.ok).length;
  const fallados = total - pasados;
  return { total, pasados, fallados, resultados };
}
