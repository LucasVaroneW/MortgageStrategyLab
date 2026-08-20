// Préstamo personal: wrapper simple sobre el motor genérico.
// A diferencia de la hipoteca, el préstamo personal suele ser a TIN fijo
// durante toda la vida (sin tramos variables).

import { amortizar, calcCuota } from './loan.js';

export function amortizarPrestamoPersonal(prestamo, opts = {}) {
  const {
    importe,
    tin,
    plazoMeses,
    comisionAperturaPct = 0,
    comisionAperturaFija = 0,
    nombre = 'prestamo personal',
    fechaInicio = null,
  } = prestamo;

  return amortizar({
    principal: Number(importe) || 0,
    tinAnualPct: Number(tin) || 0,
    meses: Number(plazoMeses) || 0,
    comisionAperturaPct,
    comisionAperturaFija,
    nombre,
    fechaInicio,
  });
}

export function calcularCuotaPrestamoPersonal(prestamo) {
  return calcCuota(
    Number(prestamo.importe) || 0,
    Number(prestamo.tin) || 0,
    Number(prestamo.plazoMeses) || 0,
  );
}
