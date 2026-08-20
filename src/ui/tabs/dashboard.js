// Pestaña: Dashboard / Resumen.

import { el, panel, kpi, alert } from '../dom.js';
import { state } from '../state.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { analizarEstrategia } from '../../finance/strategy.js';

export function renderTabDashboard() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Resumen de tu situación y de las estrategias analizadas. Aquí ves el panorama general antes de profundizar.',
  ]));

  // Situación personal.
  const perfil = state.findPerfil(state.perfilActivoId) || state.perfiles[0];
  root.appendChild(panel({
    title: 'Mi situación',
    subtitle: perfil ? perfil.nombre : 'Sin perfil definido',
    children: [
      el('div', { class: 'kpi-grid' }, [
        kpi({ label: 'Ahorros disponibles', value: formatEUR(perfil?.ahorrosDisponibles || 0) }),
        kpi({ label: 'Colchón mínimo', value: formatEUR(perfil?.colchonMinimo || 0) }),
        kpi({ label: 'Cuota máxima deseada', value: formatEUR(perfil?.cuotaMaximaDeseada || 0) }),
        kpi({ label: 'Plazo máximo deseado', value: `${perfil?.plazoMaximoDeseado || 0} años` }),
        kpi({ label: 'Ingresos netos/mes', value: formatEUR(perfil?.ingresosNetosMensuales || 0) }),
        kpi({ label: 'Crecimiento salarial', value: formatPct(perfil?.crecimientoSalarialAnualEsperado || 0) }),
      ]),
    ],
  }));

  // Estrategias.
  const estrategias = state.estrategias;
  const validas = estrategias.filter(e => {
    const p = state.findPropiedad(e.propiedadId);
    const h = state.findOferta(e.hipotecaId);
    return p && h;
  });
  const analisis = validas.map(e => {
    const propiedad = state.findPropiedad(e.propiedadId);
    const hipoteca = state.findOferta(e.hipotecaId);
    const prestamos = (e.prestamosIds || []).map(id => state.findPrestamo(id)).filter(Boolean);
    const a = analizarEstrategia({ propiedad, hipoteca, prestamos, perfil });
    return { estrategia: e, analisis: a, propiedad, hipoteca };
  });

  root.appendChild(panel({
    title: 'Estrategias',
    children: [
      el('div', { class: 'kpi-grid' }, [
        kpi({ label: 'Analizadas', value: String(estrategias.length) }),
        kpi({ label: 'Válidas (con datos)', value: String(validas.length) }),
        kpi({ label: 'Con préstamo personal', value: String(validas.filter(v => v.prestamosIds?.length > 0).length) }),
        kpi({ label: 'Con alerta de liquidez', value: String(analisis.filter(a => a.analisis.costeInicial.alertaLiquidez).length) }),
      ]),
    ],
  }));

  if (analisis.length === 0) {
    root.appendChild(el('p', { class: 'text-warn' }, ['⚠️ No hay estrategias válidas. Ve a la pestaña "Estrategias" para crear alguna.']));
    return root;
  }

  // Top 3 por coste total.
  const topPorCoste = [...analisis].sort((a, b) => a.analisis.totales.totalPagado - b.analisis.totales.totalPagado).slice(0, 3);
  root.appendChild(panel({
    title: 'Top por coste total',
    subtitle: 'Ordenadas de menor a mayor coste total acumulado.',
    children: topPorCoste.map((d, idx) => renderTarjeta(d, idx + 1)),
  }));

  // Top 3 por liquidez inicial (menor dinero necesario).
  const topPorLiquidez = [...analisis].sort((a, b) => a.analisis.costeInicial.dineroNecesario - b.analisis.costeInicial.dineroNecesario).slice(0, 3);
  root.appendChild(panel({
    title: 'Top por liquidez inicial',
    subtitle: 'Las que menos ahorros consumen el día de la firma.',
    children: topPorLiquidez.map((d, idx) => renderTarjeta(d, idx + 1)),
  }));

  return root;
}

function renderTarjeta(d, rank) {
  const e = d.estrategia;
  const a = d.analisis;
  const medalla = ['🥇', '🥈', '🥉'][rank - 1] || `#${rank}`;
  return el('div', { class: 'list-item', style: { marginBottom: '12px' } }, [
    el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
      el('div', { class: 'list-item-title' }, [`${medalla} ${e.nombre || '—'}`]),
      a.costeInicial.alertaLiquidez
        ? el('span', { class: 'badge badge-descartada' }, ['⚠️ Liquidez insuficiente'])
        : el('span', { class: 'badge badge-activa' }, ['OK']),
    ]),
    el('div', { class: 'list-item-meta' }, [
      `${d.propiedad.nombre} · ${d.hipoteca.banco} ${d.hipoteca.producto}`,
    ]),
    el('div', { class: 'grid grid-4', style: { marginTop: '8px' } }, [
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Dinero hoy']),
        el('div', { style: { fontWeight: 600 } }, [formatEUR(a.costeInicial.dineroNecesario)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Cuota inicial']),
        el('div', { style: { fontWeight: 600 } }, [formatEUR(a.totales.cuotaInicial)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Cuota tras pers.']),
        el('div', { style: { fontWeight: 600 } }, [formatEUR(a.totales.cuotaDespuesPrestamos)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Coste total']),
        el('div', { style: { fontWeight: 600 } }, [formatEUR(a.totales.totalPagado)]),
      ]),
    ]),
  ]);
}
