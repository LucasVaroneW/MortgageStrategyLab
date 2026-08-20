// TAE Máximo: dado un préstamo personal con importe y plazo, encuentra la TAE máxima
// a la que el coste total de la estrategia A (con préstamo personal) iguala el coste total
// de la estrategia B (sin préstamo personal o con otro préstamo).
//
// Uso típico:
//   - Referencia: hipoteca al 95% (sin préstamo personal)
//   - Alternativa: hipoteca al 90% + préstamo personal de X euros a Y años
//   - Resultado: ¿a qué TAE máxima el préstamo personal sigue compensando?
//
// Método: bisección numérica sobre el rango plausible de TAEs.

import { analizarEstrategia } from './strategy.js';
import { amortizar } from './loan.js';
import { round2 } from '../core/money.js';

/**
 * Encuentra la TAE máxima del préstamo personal para que la estrategia A (con préstamo)
 * tenga un coste total igual al de la estrategia B (sin préstamo).
 *
 * @param {object} opts
 * @param {object} opts.propiedad
 * @param {object} opts.hipotecaA         - Hipoteca de la estrategia alternativa (con préstamo)
 * @param {object} opts.prestamoPersonal  - Préstamo personal { importe, plazoMeses, ... }
 * @param {object} opts.hipotecaB         - Hipoteca de la estrategia de referencia (sin préstamo)
 * @param {number} [opts.taeMin]          - TAE mínima de búsqueda (default 0)
 * @param {number} [opts.taeMax]          - TAE máxima de búsqueda (default 30)
 * @param {number} [opts.tol]             - Tolerancia en euros para la bisección (default 1)
 * @returns {{ taeMax: number|null, viable: boolean, mensaje: string, costeIgualdad?: number }}
 */
export function calcularTAEMaximo(opts) {
  const {
    propiedad,
    hipotecaA,
    prestamoPersonal,
    hipotecaB,
    taeMin = 0,
    taeMax = 50,
    tol = 1,
  } = opts;

  // Coste total de la estrategia de referencia (sin préstamo personal).
  const ref = analizarEstrategia({
    propiedad,
    hipoteca: hipotecaB,
    prestamos: [],
    perfil: null,
  });
  const costeRef = ref.totales.totalPagado;

  // Función: dado un TIN (la TAE ≈ TIN para personal loans simples sin comisiones),
  // calcula el coste total de la estrategia con préstamo personal.
  const costeConTIN = (tin) => {
    const prestamoCustom = { ...prestamoPersonal, tin, tae: tin, nombre: prestamoPersonal.nombre || 'Personal' };
    const r = analizarEstrategia({
      propiedad,
      hipoteca: hipotecaA,
      prestamos: [prestamoCustom],
      perfil: null,
    });
    return r.totales.totalPagado;
  };

  // Bisección.
  let lo = taeMin;
  let hi = taeMax;
  let mejorTae = null;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const coste = costeConTIN(mid);
    if (Math.abs(coste - costeRef) < tol) {
      mejorTae = mid;
      break;
    }
    if (coste > costeRef) {
      // El TIN es demasiado alto: el coste con préstamo supera la referencia.
      // Hay que reducirlo.
      hi = mid;
    } else {
      lo = mid;
    }
    mejorTae = mid;
  }

  if (mejorTae === null) {
    return {
      taeMax: null,
      viable: false,
      mensaje: 'No se encontró una TAE máxima en el rango de búsqueda.',
    };
  }

  // Verificación adicional: comprobamos si la TAE hallada está dentro de los rangos
  // habituales del mercado de préstamos personales.
  const viable = mejorTae >= 4 && mejorTae <= 12;

  let mensaje;
  if (!viable) {
    if (mejorTae < 4) {
      mensaje = `La TAE máxima admisible es ${round2(mejorTae)} %, inferior al rango habitual de mercado (4-12%). Esta estrategia solo compensa con condiciones muy favorables que probablemente no conseguirás.`;
    } else {
      mensaje = `La TAE máxima admisible es ${round2(mejorTae)} %, superior al rango habitual de mercado (4-12%). Esta estrategia probablemente no compensa con un préstamo personal estándar.`;
    }
  } else {
    mensaje = `La TAE máxima del préstamo personal para que esta estrategia compense es ${round2(mejorTae)} %. Está dentro del rango habitual de mercado (4-12%).`;
  }

  return {
    taeMax: round2(mejorTae),
    viable,
    mensaje,
    costeReferencia: round2(costeRef),
    rangoMercado: { min: 4, max: 12, tipico: 7.5 },
  };
}

/**
 * Versión "rango": para un préstamo personal, calcula el coste total en un rango
 * de TAEs. Útil para visualizar "a partir de qué TAE deja de compensar".
 *
 * @returns {Array<{tae, costeTotal, diferencia, compensa}>}
 */
export function tablaSensibilidadTAE(opts) {
  const {
    propiedad,
    hipotecaA,
    prestamoPersonal,
    hipotecaB,
    tares = [0, 4, 5, 6, 7, 7.5, 8, 9, 10, 11, 12, 14, 16, 20, 25, 30, 40],
  } = opts;

  const ref = analizarEstrategia({
    propiedad,
    hipoteca: hipotecaB,
    prestamos: [],
    perfil: null,
  });
  const costeRef = ref.totales.totalPagado;

  return tares.map(tae => {
    const prestamoCustom = { ...prestamoPersonal, tin: tae, tae };
    const r = analizarEstrategia({
      propiedad,
      hipoteca: hipotecaA,
      prestamos: [prestamoCustom],
      perfil: null,
    });
    const coste = r.totales.totalPagado;
    return {
      tae,
      costeTotal: round2(coste),
      diferencia: round2(coste - costeRef),
      compensa: coste <= costeRef,
    };
  });
}
