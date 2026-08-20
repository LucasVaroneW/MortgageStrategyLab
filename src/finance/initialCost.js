// Cálculo del coste inicial de una operación de compra.
//
// COSTE_INICIAL_TOTAL = precio_vivienda + gastos_compra
// APORTACION_PROPIA_NECESARIA = COSTE_INICIAL_TOTAL - hipoteca - prestamos_adicionales
//
// Cada gasto puede estar marcado como MANUAL (valor introducido) o ESTIMADO (% sobre precio).
// Si la suma de financiaciones (hipoteca + préstamos personales) cubre el coste inicial,
// la aportación propia es 0. Si no llega, se muestra la cantidad que falta.

import { round2, sum } from '../core/money.js';
import { calcularImporteHipoteca } from './mortgage.js';

export function desgloseGastos(propiedad) {
  const g = propiedad.gastosCompra || {};
  const modo = g.modo || 'MANUAL';
  const pct = Number(g.porcentajeEstimado) || 0;
  const precio = Number(propiedad.precio) || 0;

  const valores = {
    impuestos: Number(g.impuestos) || 0,
    notaria: Number(g.notaria) || 0,
    registro: Number(g.registro) || 0,
    gestoria: Number(g.gestoria) || 0,
    tasacion: Number(g.tasacion) || 0,
    otros: Number(g.otros) || 0,
  };

  if (modo === 'ESTIMADO') {
    const estimado = (precio * pct) / 100;
    // Repartimos el porcentaje estimado proporcionalmente sobre los gastos.
    // En ESTIMADO se sobrescribe todo con un único valor "estimadoTotal".
    return {
      modo,
      porcentajeEstimado: pct,
      estimadoTotal: round2(estimado),
      manual: { ...valores, totalManual: round2(sum(Object.values(valores))) },
      valores,
    };
  }
  return {
    modo,
    porcentajeEstimado: pct,
    estimadoTotal: null,
    manual: {
      ...valores,
      totalManual: round2(sum(Object.values(valores))),
    },
    valores,
  };
}

export function costeInicialTotal(propiedad) {
  const g = desgloseGastos(propiedad);
  if (g.modo === 'ESTIMADO') return round2(Number(propiedad.precio) + g.estimadoTotal);
  return round2(Number(propiedad.precio) + g.manual.totalManual);
}

/**
 * Calcula el dinero que el comprador tiene que aportar de su bolsillo.
 *
 * @param {object} propiedad
 * @param {object} ofertaHipoteca
 * @param {Array}  prestamosPersonales
 * @param {number} comisionAperturaHipoteca - se añade al coste inicial (lo paga el comprador al firmar)
 */
export function aportacionPropiaNecesaria(propiedad, ofertaHipoteca, prestamosPersonales = [], comisionAperturaHipoteca = 0) {
  const coste = costeInicialTotal(propiedad);
  const importeHipoteca = ofertaHipoteca ? calcularImporteHipoteca(propiedad, ofertaHipoteca) : 0;
  const importePrestamos = prestamosPersonales.reduce((acc, p) => acc + (Number(p.importe) || 0), 0);
  const comision = Number(comisionAperturaHipoteca) || 0;
  return round2(Math.max(0, coste - importeHipoteca - importePrestamos + comision));
}

/**
 * Resultado completo del análisis del dinero necesario.
 */
export function resumenCosteInicial(propiedad, ofertaHipoteca, prestamosPersonales = [], opts = {}) {
  const gastos = desgloseGastos(propiedad);
  const coste = costeInicialTotal(propiedad);
  const importeHipoteca = ofertaHipoteca ? calcularImporteHipoteca(propiedad, ofertaHipoteca) : 0;
  const importePrestamos = prestamosPersonales.reduce((acc, p) => acc + (Number(p.importe) || 0), 0);
  const comision = ofertaHipoteca
    ? ((importeHipoteca * (Number(ofertaHipoteca.comisiones?.apertura) || 0)) / 100)
      + (Number(ofertaHipoteca.comisiones?.aperturaFija) || 0)
    : 0;

  const totalFinanciado = round2(importeHipoteca + importePrestamos);
  const dineroNecesario = round2(Math.max(0, coste + comision - totalFinanciado));
  const colchon = Number(opts.colchonMinimo) || 0;
  const ahorros = Number(opts.ahorrosDisponibles) || 0;
  const ahorroRestante = round2(ahorros - dineroNecesario);
  const cumple = ahorroRestante >= colchon;
  return {
    costeInicialTotal: coste,
    desglose: gastos,
    importeHipoteca: round2(importeHipoteca),
    importePrestamos: round2(importePrestamos),
    comisionApertura: round2(comision),
    totalFinanciado,
    dineroNecesario,
    ahorros,
    ahorroRestante,
    colchon,
    cumpleColchon: cumple,
    alertaLiquidez: !cumple,
  };
}
