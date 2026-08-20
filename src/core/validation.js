// Validaciones puras. Devuelven { ok, errors } para acumular.

export function isFiniteNumber(v) {
  return typeof v === 'number' && isFinite(v);
}

export function isPositive(v) {
  return isFiniteNumber(v) && v > 0;
}

export function isNonNegative(v) {
  return isFiniteNumber(v) && v >= 0;
}

export function isPercentage(v, { min = 0, max = 100 } = {}) {
  return isFiniteNumber(v) && v >= min && v <= max;
}

export function isInteger(v, { min = 0 } = {}) {
  return Number.isInteger(v) && v >= min;
}

export function validateProfile(p) {
  const errors = [];
  if (!isFiniteNumber(p.edad) || p.edad < 16 || p.edad > 100) {
    errors.push('Edad debe estar entre 16 y 100 años.');
  }
  if (!isNonNegative(p.ahorrosDisponibles)) {
    errors.push('Ahorros disponibles debe ser >= 0.');
  }
  if (!isNonNegative(p.colchonMinimo)) {
    errors.push('Colchón mínimo debe ser >= 0.');
  }
  if (!isNonNegative(p.ingresosNetosMensuales)) {
    errors.push('Ingresos netos mensuales debe ser >= 0.');
  }
  if (!isNonNegative(p.ingresosNetosAnuales)) {
    errors.push('Ingresos netos anuales debe ser >= 0.');
  }
  if (!isPercentage(p.crecimientoSalarialAnualEsperado, { min: -10, max: 30 })) {
    errors.push('Crecimiento salarial anual debe estar entre -10% y 30%.');
  }
  if (!isPositive(p.cuotaMaximaDeseada)) {
    errors.push('Cuota máxima deseada debe ser > 0.');
  }
  if (!isInteger(p.plazoMaximoDeseado, { min: 1 }) || p.plazoMaximoDeseado > 50) {
    errors.push('Plazo máximo deseado debe estar entre 1 y 50 años.');
  }
  return { ok: errors.length === 0, errors };
}

export function validatePropiedad(p) {
  const errors = [];
  if (!isPositive(p.precio)) {
    errors.push('Precio debe ser > 0.');
  }
  if (p.valorTasacion !== null && p.valorTasacion !== undefined) {
    if (!isPositive(p.valorTasacion)) errors.push('Valor de tasación debe ser > 0 o vacío.');
  }
  return { ok: errors.length === 0, errors };
}

export function validateHipoteca(oferta) {
  const errors = [];
  if (!oferta.banco) errors.push('Banco es obligatorio.');
  if (!oferta.producto) errors.push('Producto es obligatorio.');
  if (!isPercentage(oferta.financiacion.porcentajeMaximo, { min: 0, max: 200 })) {
    errors.push('Porcentaje máximo debe estar entre 0% y 200%.');
  }
  if (!isPositive(oferta.plazo.meses)) errors.push('Plazo debe ser > 0 meses.');
  const tin = readTIN(oferta);
  if (tin === null || !isPercentage(tin, { min: 0, max: 30 })) {
    errors.push('TIN debe estar entre 0% y 30%.');
  }
  if (oferta.tipo === 'variable' || oferta.tipo === 'mixta') {
    const v = oferta.variable || oferta.mixta?.tramoVariable;
    if (!v) {
      errors.push('Datos de variable incompletos.');
    } else {
      if (!isPercentage(v.euribor, { min: -5, max: 30 })) errors.push('Euríbor debe estar entre -5% y 30%.');
      if (!isPercentage(v.diferencial, { min: -5, max: 30 })) errors.push('Diferencial debe estar entre -5% y 30%.');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function readTIN(oferta) {
  if (oferta.tipo === 'fija') return oferta.fija?.tin ?? null;
  if (oferta.tipo === 'variable') {
    const v = oferta.variable;
    if (!v) return null;
    return (v.euribor || 0) + (v.diferencial || 0);
  }
  if (oferta.tipo === 'mixta') {
    // Para validación rápida usamos el tramo fijo.
    return oferta.mixta?.tinTramoFijo ?? null;
  }
  return null;
}

export function validatePrestamoPersonal(p) {
  const errors = [];
  if (!p.nombre) errors.push('Nombre del préstamo es obligatorio.');
  if (!isPositive(p.importe)) errors.push('Importe debe ser > 0.');
  if (!isPercentage(p.tin, { min: 0, max: 30 })) errors.push('TIN debe estar entre 0% y 30%.');
  if (!isPercentage(p.tae, { min: 0, max: 30 })) errors.push('TAE debe estar entre 0% y 30%.');
  if (!isPositive(p.plazoMeses)) errors.push('Plazo debe ser > 0 meses.');
  return { ok: errors.length === 0, errors };
}

export function validateEstrategia(e) {
  const errors = [];
  if (!e.propiedadId) errors.push('Estrategia necesita una propiedad.');
  if (!e.hipotecaId) errors.push('Estrategia necesita una hipoteca.');
  if (!isNonNegative(e.aportacionAhorros.importe)) errors.push('Aportación de ahorros debe ser >= 0.');
  return { ok: errors.length === 0, errors };
}
