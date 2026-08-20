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
import { amortizar, calcCuota } from './loan.js';
import { round2 } from '../core/money.js';

/**
 * TAE real (IRR anualizada) de un préstamo con comisión de apertura.
 * La TAE es la tasa que iguala el capital neto recibido (importe - comisiones,
 * que se descuentan al desembolsar) con el valor presente de las cuotas futuras.
 * Con comisión = 0, TAE ≈ TIN. Con comisión > 0, TAE > TIN siempre.
 *
 * @returns {number|null} TAE anual en %, o null si no converge.
 */
export function calcularTAEReal({ importe, tin, meses, comisionAperturaPct = 0, comisionAperturaFija = 0 }) {
  if (importe <= 0 || meses <= 0) return null;
  const cuota = calcCuota(importe, tin, meses);
  if (cuota <= 0) return null;
  const comision = (importe * comisionAperturaPct) / 100 + comisionAperturaFija;
  const capitalNeto = importe - comision;
  if (capitalNeto <= 0) return null;

  // VAN(r) = cuota * (1 - (1+r)^-meses) / r - capitalNeto ; buscamos la raíz por bisección.
  // VAN es estrictamente decreciente en r, así que la bisección converge siempre.
  const van = (r) => {
    if (Math.abs(r) < 1e-9) return cuota * meses - capitalNeto;
    return (cuota * (1 - Math.pow(1 + r, -meses))) / r - capitalNeto;
  };

  let lo = 0;
  let hi = 5; // 500% mensual: cota de seguridad, muy por encima de cualquier TAE real de mercado.
  if (van(hi) > 0) return null; // no converge en el rango (comisión absurdamente alta)

  let rMensual = 0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const v = van(mid);
    if (Math.abs(v) < 1e-6) { rMensual = mid; break; }
    if (v > 0) lo = mid; else hi = mid;
    rMensual = mid;
  }

  return round2((Math.pow(1 + rMensual, 12) - 1) * 100);
}

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

  // El coste total (intereses + comisiones) solo depende del TIN nominal y de las
  // comisiones del préstamo, así que la bisección busca sobre el TIN. La TAE real
  // (que sí depende también de las comisiones) se calcula aparte, al final.
  const costeConTIN = (tin) => {
    const prestamoCustom = { ...prestamoPersonal, tin, nombre: prestamoPersonal.nombre || 'Personal' };
    const r = analizarEstrategia({
      propiedad,
      hipoteca: hipotecaA,
      prestamos: [prestamoCustom],
      perfil: null,
    });
    return r.totales.totalPagado;
  };

  // Bisección sobre el TIN.
  let lo = taeMin;
  let hi = taeMax;
  let tinMax = null;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const coste = costeConTIN(mid);
    if (Math.abs(coste - costeRef) < tol) {
      tinMax = mid;
      break;
    }
    if (coste > costeRef) {
      // El TIN es demasiado alto: el coste con préstamo supera la referencia.
      // Hay que reducirlo.
      hi = mid;
    } else {
      lo = mid;
    }
    tinMax = mid;
  }

  if (tinMax === null) {
    return {
      taeMax: null,
      viable: false,
      mensaje: 'No se encontró una TAE máxima en el rango de búsqueda.',
    };
  }

  // TAE real correspondiente a ese TIN, incorporando las comisiones del préstamo.
  const taeReal = calcularTAEReal({
    importe: Number(prestamoPersonal.importe) || 0,
    tin: tinMax,
    meses: Number(prestamoPersonal.plazoMeses) || 0,
    comisionAperturaPct: Number(prestamoPersonal.comisionAperturaPct) || 0,
    comisionAperturaFija: Number(prestamoPersonal.comisionAperturaFija) || 0,
  });
  const mejorTae = taeReal !== null ? taeReal : tinMax;
  const conComision = (Number(prestamoPersonal.comisionAperturaPct) || 0) > 0 || (Number(prestamoPersonal.comisionAperturaFija) || 0) > 0;

  // Verificación adicional: comprobamos si la TAE hallada está dentro de los rangos
  // habituales del mercado de préstamos personales.
  const viable = mejorTae >= 4 && mejorTae <= 12;

  const detalleTin = conComision ? ` (TIN nominal equivalente: ${round2(tinMax)} %)` : '';
  let mensaje;
  if (!viable) {
    if (mejorTae < 4) {
      mensaje = `La TAE máxima admisible es ${round2(mejorTae)} %${detalleTin}, inferior al rango habitual de mercado (4-12%). Esta estrategia solo compensa con condiciones muy favorables que probablemente no conseguirás.`;
    } else {
      mensaje = `La TAE máxima admisible es ${round2(mejorTae)} %${detalleTin}, superior al rango habitual de mercado (4-12%). Esta estrategia probablemente no compensa con un préstamo personal estándar.`;
    }
  } else {
    mensaje = `La TAE máxima del préstamo personal para que esta estrategia compense es ${round2(mejorTae)} %${detalleTin}. Está dentro del rango habitual de mercado (4-12%).`;
  }

  return {
    taeMax: round2(mejorTae),
    tinMax: round2(tinMax),
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

  const comisionAperturaPct = Number(prestamoPersonal.comisionAperturaPct) || 0;
  const comisionAperturaFija = Number(prestamoPersonal.comisionAperturaFija) || 0;

  return tares.map(tin => {
    const prestamoCustom = { ...prestamoPersonal, tin };
    const r = analizarEstrategia({
      propiedad,
      hipoteca: hipotecaA,
      prestamos: [prestamoCustom],
      perfil: null,
    });
    const coste = r.totales.totalPagado;
    const taeReal = calcularTAEReal({
      importe: Number(prestamoPersonal.importe) || 0,
      tin,
      meses: Number(prestamoPersonal.plazoMeses) || 0,
      comisionAperturaPct,
      comisionAperturaFija,
    });
    return {
      tin,
      tae: taeReal !== null ? taeReal : tin,
      costeTotal: round2(coste),
      diferencia: round2(coste - costeRef),
      compensa: coste <= costeRef,
    };
  });
}
