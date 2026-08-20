// Pestaña: Graficos - Visualizacion SVG nativa de multiples estrategias.

import { el, panel, alert } from '../dom.js';
import { state } from '../state.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { analizarEstrategia } from '../../finance/strategy.js';
import { createLineChart } from '../charts.js';

const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#a78bfa', '#f472b6', '#ef4444', '#fbbf24', '#34d399'];

export function renderTabGraficos() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Visualizacion comparativa de las estrategias definidas. Todos los graficos se generan como SVG nativo (sin dependencias externas). Pasa el raton sobre los puntos para ver detalles (si tu navegador soporta hover).',
  ]));

  const completitud = state.estrategias.filter(e => {
    const p = state.findPropiedad(e.propiedadId);
    const h = state.findOferta(e.hipotecaId);
    return p && h;
  });

  if (completitud.length === 0) {
    root.appendChild(alert({ type: 'warn', icon: '⚠️', text: 'No hay estrategias completas. Crea alguna en la pestaña "Estrategias".' }));
    return root;
  }

  const items = completitud.map(e => ({
    estrategia: e,
    analisis: analizarEstrategia({
      propiedad: state.findPropiedad(e.propiedadId),
      hipoteca: state.findOferta(e.hipotecaId),
      prestamos: (e.prestamosIds || []).map(id => state.findPrestamo(id)).filter(Boolean),
      perfil: state.findPerfil(e.perfilId || state.perfilActivoId),
    }),
    propiedad: state.findPropiedad(e.propiedadId),
    hipoteca: state.findOferta(e.hipotecaId),
  }));

  // 1. Coste acumulado (pagado por año).
  root.appendChild(renderChartCosteAcumulado(items));
  // 2. Deuda pendiente (saldo total).
  root.appendChild(renderChartDeudaPendiente(items));
  // 3. Cuota mensual.
  root.appendChild(renderChartCuotaMensual(items));
  // 4. Intereses acumulados.
  root.appendChild(renderChartInteresesAcumulados(items));
  // 5. Patrimonio neto (placeholder - sin inflacion en FASE 1).
  root.appendChild(renderChartPatrimonio(items));

  return root;
}

function chartPanel(title, subtitle) {
  return panel({ title, subtitle, children: [el('div', { class: 'chart-wrap' })] });
}

function renderIn(container, items, opts) {
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  const chart = createLineChart(container, {
    width: opts.width ?? 720,
    height: opts.height ?? 320,
    padding: { top: 30, right: 20, bottom: 40, left: 80 },
    xLabel: opts.xLabel ?? 'Año',
    yLabel: opts.yLabel ?? '€',
    yFormat: opts.yFormat ?? (v => formatEUR(v)),
    xFormat: opts.xFormat ?? (v => `Año ${v}`),
  });
  items.forEach((it, i) => {
    chart.addSeries({
      name: it.estrategia.nombre || `Estrategia ${i + 1}`,
      color: COLORS[i % COLORS.length],
      data: it.data,
      area: opts.area ?? false,
      dashed: opts.dashed ?? false,
    });
  });
  chart.render();
}

function renderChartCosteAcumulado(items) {
  const wrap = chartPanel('Coste acumulado', 'Dinero total pagado cada año (incluye hipoteca + préstamos + comisiones).');
  const datos = items.map(it => ({
    estrategia: it.estrategia,
    data: acumulado(it.analisis.resumenAnual.map(a => ({ x: a.anio, y: a.cuotaTotal }))),
  }));
  const out = wrap.querySelector('.chart-wrap');
  renderIn(out, datos, { area: true });
  return wrap;
}

function renderChartDeudaPendiente(items) {
  const wrap = chartPanel('Deuda pendiente', 'Saldo vivo (hipoteca + préstamos personales) cada año.');
  const datos = items.map(it => ({
    estrategia: it.estrategia,
    data: it.analisis.resumenAnual.map(a => ({ x: a.anio, y: a.saldoTotal })),
  }));
  renderIn(wrap.querySelector('.chart-wrap'), datos, { yLabel: '€ deuda' });
  return wrap;
}

function renderChartCuotaMensual(items) {
  const wrap = chartPanel('Cuota mensual', 'Importe mensual que pagas cada año. Baja mucho tras terminar el préstamo personal.');
  const datos = items.map(it => ({
    estrategia: it.estrategia,
    data: it.analisis.resumenAnual.map(a => ({ x: a.anio, y: a.cuotaTotal / 12 / a.meses * 12 })),
  }));
  // Mas claro: cuotaMedia del resumen anual.
  datos.forEach((d, i) => {
    d.data = items[i].analisis.resumenAnual.map(a => ({ x: a.anio, y: a.cuotaMedia }));
  });
  renderIn(wrap.querySelector('.chart-wrap'), datos, { yLabel: '€/mes' });
  return wrap;
}

function renderChartInteresesAcumulados(items) {
  const wrap = chartPanel('Intereses acumulados', 'Cuanto llevas pagado en intereses al final de cada año.');
  const datos = items.map(it => {
    let acc = 0;
    return {
      estrategia: it.estrategia,
      data: it.analisis.resumenAnual.map(a => {
        acc += a.interesHipoteca + a.interesPrestamos;
        return { x: a.anio, y: acc };
      }),
    };
  });
  renderIn(wrap.querySelector('.chart-wrap'), datos, { area: true, yLabel: '€ intereses' });
  return wrap;
}

function renderChartPatrimonio(items) {
  const wrap = chartPanel('Patrimonio neto en la vivienda', 'Valor estimado de la vivienda menos deuda pendiente. La curva de valor de vivienda es una hipótesis (configurable en FASE 3).');
  const g = (Number(state.supuestos?.crecimientoVivienda) || 0) / 100;
  const datos = items.map(it => {
    const v0 = it.propiedad.precio;
    return {
      estrategia: it.estrategia,
      data: it.analisis.resumenAnual.map(a => {
        const v = v0 * Math.pow(1 + g, a.anio);
        return { x: a.anio, y: v - a.saldoTotal };
      }),
    };
  });
  renderIn(wrap.querySelector('.chart-wrap'), datos, { yLabel: '€ patrimonio' });
  // Aviso de hipotesis.
  wrap.querySelector('.panel-body').appendChild(alert({
    type: 'info', icon: 'ℹ️',
    text: `Crecimiento vivienda supuesto: ${formatPct((g || 0) * 100)}. Modificalo en FASE 3 cuando esté disponible.`,
  }));
  return wrap;
}

// Helper: acumular un array de pares {x, y} en x ascendente.
function acumulado(pairs) {
  const sorted = [...pairs].sort((a, b) => a.x - b.x);
  let acc = 0;
  return sorted.map(p => { acc += p.y; return { x: p.x, y: acc }; });
}
