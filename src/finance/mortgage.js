// Hipoteca: importa el motor genérico y aporta:
//  - cálculo del importe financiado según % y base (precio / tasación / menor)
//  - cálculo del TIN efectivo según tipo (fija/variable/mixta)
//  - comisiones de apertura/amortización

import { amortizar, calcCuota } from './loan.js';
import { round2 } from '../core/money.js';

/**
 * Determina la base sobre la que se calcula el porcentaje de financiación.
 * @param {object} propiedad - { precio, valorTasacion }
 * @param {string} base - 'precio' | 'tasacion' | 'menor'
 */
export function baseFinanciacion(propiedad, base) {
  const p = Number(propiedad.precio) || 0;
  const t = Number(propiedad.valorTasacion) || 0;
  switch (base) {
    case 'precio': return p;
    case 'tasacion': return t > 0 ? t : p;
    case 'menor': return (t > 0 ? Math.min(p, t) : p);
    default: return p;
  }
}

/**
 * Calcula el importe solicitado para una hipoteca.
 * @param {object} propiedad
 * @param {object} oferta - ofertaHipotecaria
 */
export function calcularImporteHipoteca(propiedad, oferta) {
  const base = baseFinanciacion(propiedad, oferta.financiacion.baseCalculo);
  let importe = (base * oferta.financiacion.porcentajeMaximo) / 100;
  if (oferta.financiacion.importeMaximo) {
    importe = Math.min(importe, oferta.financiacion.importeMaximo);
  }
  if (oferta.financiacion.importeSolicitado) {
    importe = oferta.financiacion.importeSolicitado;
  }
  return round2(importe);
}

/**
 * Devuelve el TIN aplicable en el mes k (1-indexed).
 * - fija: TIN fijo durante toda la vida
 * - variable: TIN = Euríbor + diferencial durante toda la vida (se asume constante;
 *   en FASE 3 se modelará con escenarios de Euríbor)
 * - mixta: TIN tramo fijo durante X años (X*12 meses), luego TIN = Euríbor + diferencial
 */
export function tinEnMes(oferta, mes) {
  if (oferta.tipo === 'fija') {
    return Number(oferta.fija?.tin) || 0;
  }
  if (oferta.tipo === 'variable') {
    const v = oferta.variable || {};
    return (Number(v.euribor) || 0) + (Number(v.diferencial) || 0);
  }
  if (oferta.tipo === 'mixta') {
    const m = oferta.mixta;
    if (!m) return 0;
    const mesesFijos = (Number(m.aniosTramoFijo) || 0) * 12;
    if (mes <= mesesFijos) return Number(m.tinTramoFijo) || 0;
    const tv = m.tramoVariable || {};
    return (Number(tv.euribor) || 0) + (Number(tv.diferencial) || 0);
  }
  return 0;
}

/**
 * Genera la amortización completa de una hipoteca respetando cambios de TIN
 * en el caso de hipotecas mixtas.
 */
export function amortizarHipoteca(propiedad, oferta, opts = {}) {
  const principal = calcularImporteHipoteca(propiedad, oferta);
  const meses = oferta.plazo.meses;
  const comAperturaPct = Number(oferta.comisiones?.apertura) || 0;
  const comAperturaFija = Number(oferta.comisiones?.aperturaFija) || 0;

  if (oferta.tipo === 'mixta') {
    // Construimos la amortización por tramos para soportar cambio de TIN.
    return amortizarConCambioTIN({
      principal,
      meses,
      tramos: obtenerTramosMixta(oferta),
      comAperturaPct,
      comAperturaFija,
      nombre: `${oferta.banco} ${oferta.producto}`,
      fechaInicio: opts.fechaInicio,
    });
  }

  return amortizar({
    principal,
    tinAnualPct: tinEnMes(oferta, 1),
    meses,
    comisionAperturaPct: comAperturaPct,
    comisionAperturaFija: comAperturaFija,
    nombre: `${oferta.banco} ${oferta.producto}`,
    fechaInicio: opts.fechaInicio,
  });
}

export function obtenerTramosMixta(oferta) {
  if (oferta.tipo !== 'mixta') return [];
  const m = oferta.mixta;
  const mesesFijos = (Number(m.aniosTramoFijo) || 0) * 12;
  const tv = m.tramoVariable || {};
  const tinFijo = Number(m.tinTramoFijo) || 0;
  const tinVariable = (Number(tv.euribor) || 0) + (Number(tv.diferencial) || 0);
  const tramos = [];
  if (mesesFijos > 0) tramos.push({ meses: mesesFijos, tin: tinFijo });
  const mesesVar = (oferta.plazo.meses || 0) - mesesFijos;
  if (mesesVar > 0) tramos.push({ meses: mesesVar, tin: tinVariable });
  return tramos;
}

/**
 * Amortización por tramos con TIN distinto en cada uno.
 */
export function amortizarConCambioTIN(opts) {
  const {
    principal,
    tramos, // [{ meses, tin }]
    comAperturaPct = 0,
    comAperturaFija = 0,
    nombre = 'prestamo',
    fechaInicio = null,
  } = opts;

  if (principal < 0) throw new Error('Principal debe ser >= 0');

  const comisionApertura = (principal * comAperturaPct) / 100 + comAperturaFija;

  let saldo = Math.round(principal * 100); // céntimos
  const tablaMensual = [];
  let totalInteresesCents = 0;
  let totalPrincipalCents = 0;
  const baseDate = fechaInicio ? new Date(fechaInicio) : new Date();
  const fechaPago = (year, month) => new Date(year, month + 1, 1);

  let mesGlobal = 1;
  for (const tramo of tramos) {
    const i = (Number(tramo.tin) || 0) / 100 / 12;
    const n = tramo.meses;
    // La cuota se calcula sobre el saldo pendiente al inicio del tramo.
    // Usamos fórmula estándar asumiendo amortización francesa dentro del tramo.
    const cuotaTramo = calcCuota(saldo / 100, Number(tramo.tin) || 0, n);
    const cuotaCents = Math.round(cuotaTramo * 100);

    for (let k = 1; k <= n; k++) {
      const interesMesCents = Math.round(saldo * i);
      let principalMesCents;
      let cuotaMesCents = cuotaCents;
      // Último mes del tramo o último mes del préstamo en general
      const esUltimoGlobal = mesGlobal === tramos.reduce((acc, t) => acc + t.meses, 0);
      if (esUltimoGlobal) {
        principalMesCents = saldo;
        cuotaMesCents = interesMesCents + principalMesCents;
      } else {
        principalMesCents = cuotaCents - interesMesCents;
        if (principalMesCents > saldo) {
          principalMesCents = saldo;
          cuotaMesCents = interesMesCents + principalMesCents;
        }
      }
      saldo -= principalMesCents;
      if (saldo < 0) saldo = 0;

      totalInteresesCents += interesMesCents;
      totalPrincipalCents += principalMesCents;

      const f = fechaPago(baseDate.getFullYear(), baseDate.getMonth() + mesGlobal - 1);
      tablaMensual.push({
        mes: mesGlobal,
        anio: Math.ceil(mesGlobal / 12),
        fecha: f.toISOString().slice(0, 10),
        cuota: round2(cuotaMesCents / 100),
        interes: round2(interesMesCents / 100),
        principal: round2(principalMesCents / 100),
        saldo: round2(saldo / 100),
        comision: mesGlobal === 1 ? comisionApertura : 0,
        tin: Number(tramo.tin) || 0,
      });
      mesGlobal++;
    }
  }

  const resumenAnual = [];
  let anioActual = null;
  let agg = null;
  for (const fila of tablaMensual) {
    if (fila.anio !== anioActual) {
      if (agg) resumenAnual.push(agg);
      anioActual = fila.anio;
      agg = {
        anio: anioActual,
        cuotaTotal: 0,
        intereses: 0,
        principal: 0,
        comision: 0,
        saldoFinal: 0,
        meses: 0,
      };
    }
    agg.cuotaTotal += fila.cuota + fila.comision;
    agg.intereses += fila.interes;
    agg.principal += fila.principal;
    agg.comision += fila.comision;
    agg.saldoFinal = fila.saldo;
    agg.meses += 1;
  }
  if (agg) resumenAnual.push(agg);
  for (const a of resumenAnual) {
    a.cuotaMedia = a.meses > 0 ? a.cuotaTotal / a.meses : 0;
  }

  return {
    nombre,
    principal,
    meses: tablaMensual.length,
    cuota: tablaMensual[0]?.cuota || 0,
    totalPagado: round2((totalPrincipalCents + totalInteresesCents + Math.round(comisionApertura * 100)) / 100),
    totalPrincipal: round2(totalPrincipalCents / 100),
    totalIntereses: round2(totalInteresesCents / 100),
    totalComisiones: round2(comisionApertura),
    tablaMensual,
    resumenAnual,
  };
}
