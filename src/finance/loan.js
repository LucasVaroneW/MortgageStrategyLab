// Motor genérico de amortización francesa.
// Entrada: principal (P), TIN anual en % (ej. 4 para 4%), meses (n), comisiones opcionales.
// Salida: { cuota, totalPagado, totalIntereses, totalComisiones, tablaMensual, resumenAnual }
//
// Amortización francesa:
//   cuota = P * i * (1+i)^n / ((1+i)^n - 1)
//   donde i = TIN_anual / 12 / 100, n = meses
// En cada mes k:
//   interes_k = saldo_k * i
//   principal_k = cuota - interes_k
//   saldo_{k+1} = saldo_k - principal_k
//
// Todos los importes se exponen en euros (no céntimos) redondeados a 2 decimales
// para presentación, pero los cálculos se hacen en céntimos para evitar derivas.

import { toCents, fromCents, round2 } from '../core/money.js';

export function calcCuota(principal, tinAnualPct, meses) {
  if (principal <= 0 || meses <= 0) return 0;
  const i = (tinAnualPct / 100) / 12;
  if (i === 0) return principal / meses;
  const factor = Math.pow(1 + i, meses);
  return (principal * i * factor) / (factor - 1);
}

/**
 * Genera la tabla de amortización completa.
 *
 * @param {object} opts
 * @param {number} opts.principal        - Principal en euros
 * @param {number} opts.tinAnualPct      - TIN anual en %
 * @param {number} opts.meses            - Número de meses
 * @param {number} [opts.comisionAperturaPct] - % sobre principal (se añade a la primera cuota)
 * @param {number} [opts.comisionAperturaFija] - Comisión fija en euros (se añade a la primera cuota)
 * @param {string} [opts.nombre]         - Nombre para identificación
 * @param {Date}   [opts.fechaInicio]    - Fecha de inicio del préstamo
 * @returns {object}
 */
export function amortizar(opts) {
  const {
    principal,
    tinAnualPct,
    meses,
    comisionAperturaPct = 0,
    comisionAperturaFija = 0,
    nombre = 'prestamo',
    fechaInicio = null,
  } = opts;

  if (principal < 0 || meses < 0) {
    throw new Error('Principal y meses deben ser >= 0');
  }

  const cuota = calcCuota(principal, tinAnualPct, meses);
  const comisionApertura = (principal * comisionAperturaPct) / 100 + comisionAperturaFija;

  // Trabajamos en céntimos para evitar derivas de coma flotante.
  let saldo = toCents(principal);
  const cuotaCents = Math.round(toCents(cuota));
  const i = (tinAnualPct / 100) / 12;
  const tablaMensual = [];
  let totalInteresesCents = 0;
  let totalPrincipalCents = 0;

  // Cálculo de la fecha del primer pago.
  const baseDate = fechaInicio ? new Date(fechaInicio) : new Date();
  // El primer pago se hace al mes siguiente de la fecha de inicio.
  const fechaPago = (year, month) => new Date(year, month + 1, 1);

  for (let k = 1; k <= meses; k++) {
    const interesMesCents = Math.round(saldo * i);
    // La cuota se ajusta en el último mes para liquidar el saldo exacto.
    let principalMesCents;
    let cuotaMesCents = cuotaCents;
    if (k === meses) {
      principalMesCents = saldo;
      cuotaMesCents = interesMesCents + principalMesCents;
    } else {
      principalMesCents = cuotaCents - interesMesCents;
      // Si principalMesCents > saldo (improbable pero por seguridad)
      if (principalMesCents > saldo) {
        principalMesCents = saldo;
        cuotaMesCents = interesMesCents + principalMesCents;
      }
    }
    saldo -= principalMesCents;
    if (saldo < 0) saldo = 0;

    totalInteresesCents += interesMesCents;
    totalPrincipalCents += principalMesCents;

    const f = fechaPago(baseDate.getFullYear(), baseDate.getMonth() + k - 1);
    tablaMensual.push({
      mes: k,
      anio: Math.ceil(k / 12),
      fecha: f.toISOString().slice(0, 10),
      cuota: fromCents(cuotaMesCents),
      interes: fromCents(interesMesCents),
      principal: fromCents(principalMesCents),
      saldo: fromCents(saldo),
      comision: k === 1 ? comisionApertura : 0,
    });
  }

  // Resumen anual: agregamos por año natural.
  const resumenAnual = [];
  let anioActual = null;
  let agg = null;
  for (const fila of tablaMensual) {
    if (fila.anio !== anioActual) {
      if (agg) resumenAnual.push(agg);
      anioActual = fila.anio;
      agg = {
        anio: anioActual,
        cuotaMedia: 0,
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
    tinAnualPct,
    meses,
    cuota: round2(cuota),
    totalPagado: fromCents(totalPrincipalCents + totalInteresesCents + toCents(comisionApertura)),
    totalPrincipal: fromCents(totalPrincipalCents),
    totalIntereses: fromCents(totalInteresesCents),
    totalComisiones: round2(comisionApertura),
    tablaMensual,
    resumenAnual,
  };
}
