// Modelo de datos: definiciones de entidades y factories con valores por defecto.
//
// Versión del esquema: 1
// Cada factory devuelve un objeto con id generado y valores por defecto razonables.

import { uuid, nowISO, todayISO } from '../core/utils.js';

export const SCHEMA_VERSION = 1;

export function nuevoPerfil(overrides = {}) {
  return {
    id: uuid(),
    nombre: 'Perfil principal',
    edad: 30,
    comunidadAutonoma: '',
    provincia: '',
    municipio: '',
    primeraVivienda: true,
    viviendaHabitual: true,
    ingresosNetosMensuales: 0,
    ingresosNetosAnuales: 0,
    crecimientoSalarialAnualEsperado: 2.0,
    ahorrosDisponibles: 0,
    colchonMinimo: 2000,
    otrosPrestamos: [],
    cuotasMensualesExistentes: 0,
    cuotaMaximaDeseada: 800,
    plazoMaximoDeseado: 30,
    plazoPreferido: 25,
    metadata: { createdAt: nowISO(), updatedAt: nowISO() },
    ...overrides,
  };
}

export function nuevaPropiedad(overrides = {}) {
  return {
    id: uuid(),
    nombre: 'Vivienda',
    precio: 0,
    ubicacion: '',
    comunidadAutonoma: '',
    provincia: '',
    municipio: '',
    nueva: false,
    valorTasacion: null,
    gastosCompra: {
      modo: 'MANUAL',
      impuestos: 0,
      notaria: 0,
      registro: 0,
      gestoria: 0,
      tasacion: 0,
      otros: 0,
      porcentajeEstimado: 8,
    },
    metadata: { createdAt: nowISO(), updatedAt: nowISO() },
    ...overrides,
  };
}

export function nuevaOfertaHipoteca(overrides = {}) {
  return {
    id: uuid(),
    banco: '',
    producto: '',
    fecha: todayISO(),
    estado: 'activa', // activa | descartada | aceptada | en_estudio
    notas: '',
    financiacion: {
      porcentajeMaximo: 80,
      importeMaximo: null,
      importeSolicitado: null,
      baseCalculo: 'tasacion', // precio | tasacion | menor
    },
    tipo: 'fija', // fija | variable | mixta
    fija: { tin: 0, tae: 0 },
    variable: { euribor: 2.5, diferencial: 0.5, tinInicial: 3.0, tae: 3.6, frecuenciaRevision: 'anual' },
    mixta: {
      aniosTramoFijo: 10,
      tinTramoFijo: 0,
      tae: 0,
      tramoVariable: { euribor: 2.5, diferencial: 0.5 },
    },
    plazo: { anios: 30, meses: 360 },
    cuota: { publicada: null },
    vinculaciones: [],
    comisiones: {
      apertura: 0,
      aperturaFija: 0,
      amortizacionParcial: 0,
      amortizacionTotal: 0,
      amortizacionDuranteAnios: null,
      novacion: null,
      subrogacion: null,
      otras: null,
    },
    metadata: { createdAt: nowISO(), updatedAt: nowISO() },
    ...overrides,
  };
}

export function nuevoPrestamoPersonal(overrides = {}) {
  return {
    id: uuid(),
    nombre: 'Préstamo personal',
    importe: 0,
    tin: 7.5,
    tae: 8.2,
    plazoAnios: 7,
    plazoMeses: 84,
    comisionApertura: 0,
    comisionAperturaFija: 0,
    otrosCostes: 0,
    metadata: { createdAt: nowISO(), updatedAt: nowISO() },
    ...overrides,
  };
}

export function nuevaEstrategia(overrides = {}) {
  return {
    id: uuid(),
    nombre: 'Estrategia',
    perfilId: null,
    propiedadId: null,
    hipotecaId: null,
    prestamosIds: [],
    aportacionAhorros: {
      modo: 'AUTO',
      importe: 0,
      ahorrosRestantes: 0,
      cumpleColchon: true,
      alertaLiquidez: false,
    },
    metadata: { createdAt: nowISO(), updatedAt: nowISO() },
    notas: '',
    ...overrides,
  };
}

export function supuestosPorDefecto(overrides = {}) {
  return {
    inflacionAnual: 2.0,
    crecimientoVivienda: 2.0,
    crecimientoSalario: 2.0,
    euriborProyectado: 2.5,
    ...overrides,
  };
}

export function configuracionRankingPorDefecto(overrides = {}) {
  return {
    pesos: {
      costeTotal: 30,
      liquidezInicial: 25,
      cuota: 20,
      patrimonioFinal: 15,
      riesgo: 10,
    },
    filtros: {
      cuotaMax: null,
      dineroMax: null,
      colchonMin: null,
      plazoMax: null,
      costeMax: null,
      deudaMax: null,
      porcentajeIngresosMax: null,
    },
    ...overrides,
  };
}
