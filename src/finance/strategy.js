// Análisis de una estrategia completa: propiedad + hipoteca + N préstamos personales + aportación.
//
// Genera:
//  - resumenCosteInicial
//  - amortizacionHipoteca
//  - amortizacionesPrestamosPersonales[]
//  - tablaConsolidada (mes a mes): cuota total, intereses totales, saldo total, desglose
//  - resumenAnualConsolidado
//  - totales: totalPagado, totalIntereses, totalPrincipal
//  - alertaLiquidez si la aportación propia es mayor que los ahorros disponibles
//
// NOTA: las cuotas se calculan con TIN. La TAE se muestra como métrica separada.

import { resumenCosteInicial } from './initialCost.js';
import { amortizarHipoteca, calcularImporteHipoteca } from './mortgage.js';
import { amortizarPrestamoPersonal } from './personalLoan.js';
import { round2, sum } from '../core/money.js';

export function analizarEstrategia({ propiedad, hipoteca, prestamos = [], perfil = null }) {
  const colchon = perfil?.colchonMinimo ?? 0;
  const ahorros = perfil?.ahorrosDisponibles ?? 0;

  const costeInicial = resumenCosteInicial(propiedad, hipoteca, prestamos, { colchonMinimo: colchon, ahorrosDisponibles: ahorros });

  // Amortización hipoteca.
  const amortHip = hipoteca ? amortizarHipoteca(propiedad, hipoteca) : null;
  const importeHipoteca = hipoteca ? calcularImporteHipoteca(propiedad, hipoteca) : 0;

  // Amortizaciones préstamos personales.
  const amortPrestamos = prestamos.map(p => ({
    prestamo: p,
    amortizacion: amortizarPrestamoPersonal(p),
  }));

  // Tabla consolidada mes a mes.
  const mesesMax = Math.max(
    amortHip?.tablaMensual.length || 0,
    ...amortPrestamos.map(ap => ap.amortizacion.tablaMensual.length || 0),
    0,
  );
  const tablaConsolidada = [];
  for (let k = 1; k <= mesesMax; k++) {
    const filaHip = amortHip?.tablaMensual[k - 1] || { cuota: 0, interes: 0, principal: 0, saldo: 0, comision: 0 };
    const prestamosMes = amortPrestamos.map(ap => {
      const fila = ap.amortizacion.tablaMensual[k - 1];
      return fila ? { ...fila, prestamoId: ap.prestamo.id, prestamoNombre: ap.prestamo.nombre } : null;
    }).filter(Boolean);

    const cuotaPrest = sum(prestamosMes.map(p => p.cuota + p.comision));
    const interesPrest = sum(prestamosMes.map(p => p.interes));
    const principalPrest = sum(prestamosMes.map(p => p.principal));

    tablaConsolidada.push({
      mes: k,
      anio: Math.ceil(k / 12),
      fecha: filaHip.fecha || (amortPrestamos[0]?.amortizacion.tablaMensual[k - 1]?.fecha) || null,
      cuotaHipoteca: filaHip.cuota,
      cuotaPrestamos: round2(cuotaPrest),
      cuotaTotal: round2(filaHip.cuota + filaHip.comision + cuotaPrest),
      interesHipoteca: filaHip.interes,
      interesPrestamos: round2(interesPrest),
      interesTotal: round2(filaHip.interes + interesPrest),
      principalHipoteca: filaHip.principal,
      principalPrestamos: round2(principalPrest),
      principalTotal: round2(filaHip.principal + principalPrest),
      comision: round2((filaHip.comision || 0) + sum(prestamosMes.map(p => p.comision))),
      saldoHipoteca: filaHip.saldo,
      saldoPrestamos: round2(sum(prestamosMes.map(p => p.saldo))),
      saldoTotal: round2(filaHip.saldo + sum(prestamosMes.map(p => p.saldo))),
      prestamosActivos: prestamosMes.length,
    });
  }

  // Resumen anual.
  const resumenAnual = [];
  let anioActual = null;
  let agg = null;
  for (const fila of tablaConsolidada) {
    if (fila.anio !== anioActual) {
      if (agg) resumenAnual.push(agg);
      anioActual = fila.anio;
      agg = {
        anio: anioActual,
        cuotaTotal: 0,
        cuotaHipoteca: 0,
        cuotaPrestamos: 0,
        interesHipoteca: 0,
        interesPrestamos: 0,
        interesTotal: 0,
        principalHipoteca: 0,
        principalPrestamos: 0,
        principalTotal: 0,
        comision: 0,
        saldoHipoteca: 0,
        saldoPrestamos: 0,
        saldoTotal: 0,
        meses: 0,
      };
    }
    agg.cuotaTotal += fila.cuotaTotal;
    agg.cuotaHipoteca += fila.cuotaHipoteca;
    agg.cuotaPrestamos += fila.cuotaPrestamos;
    agg.interesHipoteca += fila.interesHipoteca;
    agg.interesPrestamos += fila.interesPrestamos;
    agg.interesTotal += fila.interesTotal;
    agg.principalHipoteca += fila.principalHipoteca;
    agg.principalPrestamos += fila.principalPrestamos;
    agg.principalTotal += fila.principalTotal;
    agg.comision += fila.comision;
    agg.saldoHipoteca = fila.saldoHipoteca;
    agg.saldoPrestamos = fila.saldoPrestamos;
    agg.saldoTotal = fila.saldoTotal;
    agg.meses += 1;
  }
  if (agg) resumenAnual.push(agg);

  // Totales.
  const totalPagado = round2(sum(tablaConsolidada.map(f => f.cuotaTotal)));
  const totalIntereses = round2(sum(tablaConsolidada.map(f => f.interesTotal)));
  const totalPrincipal = round2(sum(tablaConsolidada.map(f => f.principalTotal)));
  const totalComisiones = round2(sum(tablaConsolidada.map(f => f.comision)));

  const cuotaInicial = tablaConsolidada[0]?.cuotaTotal || 0;
  // Cuota después del último préstamo personal que termina.
  const cuotaDespuesPrestamos = (() => {
    if (!amortPrestamos.length) return cuotaInicial;
    const mesesPorPrestamo = amortPrestamos.map(ap => ap.amortizacion.tablaMensual.length);
    const maxMeses = Math.max(...mesesPorPrestamo);
    // Buscar el primer mes en el que todos los préstamos han terminado.
    for (let k = 0; k < tablaConsolidada.length; k++) {
      const todosTerminaron = amortPrestamos.every((ap, idx) => k >= mesesPorPrestamo[idx]);
      if (todosTerminaron) {
        return tablaConsolidada[k].cuotaTotal;
      }
    }
    return tablaConsolidada[tablaConsolidada.length - 1]?.cuotaTotal || 0;
  })();

  return {
    costeInicial,
    amortizacionHipoteca: amortHip,
    importeHipoteca,
    amortizacionesPrestamos: amortPrestamos,
    tablaConsolidada,
    resumenAnual,
    totales: {
      totalPagado,
      totalIntereses,
      totalPrincipal,
      totalComisiones,
      cuotaInicial,
      cuotaDespuesPrestamos,
      meses: mesesMax,
    },
  };
}
