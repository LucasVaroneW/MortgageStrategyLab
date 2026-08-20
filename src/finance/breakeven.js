// Punto de equilibrio entre dos estrategias.
//
// Compara mes a mes el dinero PAGADO acumulado por cada estrategia.
// Si en el mes M, estrategiaB empieza a ser mejor (acumulado menor) que estrategiaA,
// y en el mes M-1 era peor (o igual), ese es el punto de equilibrio.
//
// Devuelve:
//  - { existe, mes, anio, fecha }
//  - { diferenciaInicial, ventajaFinalA, ventajaFinalB } — importes en EUR
//  Si no existe cruce, devuelve existe=false con la información de cuál gana siempre.

import { analizarEstrategia } from './strategy.js';
import { round2 } from '../core/money.js';

export function encontrarEquilibrio(estrategiaA, estrategiaB, { propiedad, prestamosPorId = [], hipotecaPorId = [] } = {}) {
  const a = analizarEstrategia({
    propiedad,
    hipoteca: hipotecaPorId.find(h => h.id === estrategiaA.hipotecaId),
    prestamos: (estrategiaA.prestamosIds || []).map(id => prestamosPorId.find(p => p.id === id)).filter(Boolean),
    perfil: estrategiaA._perfil || null,
  });
  const b = analizarEstrategia({
    propiedad,
    hipoteca: hipotecaPorId.find(h => h.id === estrategiaB.hipotecaId),
    prestamos: (estrategiaB.prestamosIds || []).map(id => prestamosPorId.find(p => p.id === id)).filter(Boolean),
    perfil: estrategiaB._perfil || null,
  });

  const tablaA = a.tablaConsolidada;
  const tablaB = b.tablaConsolidada;
  const mesesMax = Math.max(tablaA.length, tablaB.length);

  // Acumulado de dinero pagado por cada estrategia.
  let acumA = 0;
  let acumB = 0;
  let mesEquilibrio = null;
  let cruzamientoDetectado = false;

  // Calculamos la diferencia (acumB - acumA) en cada mes.
  // Si la diferencia pasa de positivo a negativo, hay cruce.
  let difAnterior = null;
  for (let k = 0; k < mesesMax; k++) {
    acumA += tablaA[k]?.cuotaTotal || 0;
    acumB += tablaB[k]?.cuotaTotal || 0;
    const dif = acumB - acumA;
    if (k > 0 && difAnterior !== null) {
      // Cruce: difAnterior > 0 (B más cara) y dif <= 0 (B igual o más barata).
      if (difAnterior > 0 && dif <= 0) {
        mesEquilibrio = k + 1; // 1-indexed
        break;
      }
      // Cruce inverso: difAnterior <= 0 y dif > 0 (B vuelve a ser más cara).
      // Lo registramos pero seguimos buscando.
    }
    difAnterior = dif;
  }

  const totalA = a.totales.totalPagado;
  const totalB = b.totales.totalPagado;
  const diferenciaInicial = round2(Math.abs((tablaA[0]?.cuotaTotal || 0) - (tablaB[0]?.cuotaTotal || 0)));
  const ventajaFinalA = round2(totalB - totalA);
  const ventajaFinalB = round2(totalA - totalB);

  if (mesEquilibrio === null) {
    // No hay cruce. Determinamos quién gana siempre.
    const gana = totalA <= totalB ? 'A' : 'B';
    return {
      existe: false,
      mensaje: `No existe punto de equilibrio bajo estos supuestos. La estrategia ${gana} es ${round2(Math.abs(totalA - totalB))} € más barata en coste total.`,
      estrategiaGanadora: gana,
      totalEstrategiaA: totalA,
      totalEstrategiaB: totalB,
      diferenciaInicial,
      ventajaFinalA,
      ventajaFinalB,
    };
  }

  // Construir la explicación en lenguaje natural.
  const masCaraInicialmente = tablaB[0].cuotaTotal > tablaA[0].cuotaTotal ? 'B' : 'A';
  return {
    existe: true,
    mes: mesEquilibrio,
    anio: Math.ceil(mesEquilibrio / 12),
    fecha: tablaA[mesEquilibrio - 1]?.fecha || tablaB[mesEquilibrio - 1]?.fecha || null,
    mensaje: `El escenario ${masCaraInicialmente} empieza siendo ${diferenciaInicial} € más caro en cuota inicial. El escenario opuesto alcanza el punto de equilibrio en el mes ${mesEquilibrio} (año ${Math.ceil(mesEquilibrio / 12)}).`,
    diferenciaInicial,
    ventajaFinalA,
    ventajaFinalB,
    totalEstrategiaA: totalA,
    totalEstrategiaB: totalB,
  };
}
