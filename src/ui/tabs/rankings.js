// Pestaña: Rankings - Rankings multiples de estrategias segun criterios configurables.

import { el, panel, formRow, inputNumber } from '../dom.js';
import { state } from '../state.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { calcularRankings, rankingPersonalizado } from '../../finance/rankings.js';

const RANKING_DEFS = [
  { key: 'porCosteTotal',         titulo: 'Menor coste total',          subtitulo: 'Menor dinero total devuelto al final del préstamo.' },
  { key: 'porLiquidezInicial',    titulo: 'Menor dinero necesario hoy', subtitulo: 'Cuanto menos ahorros propios necesitas para la firma, mejor.' },
  { key: 'porCuotaInicial',       titulo: 'Menor cuota inicial',        subtitulo: 'La cuota del primer mes, cuando aún tienes préstamos personales activos.' },
  { key: 'porCuotaTrasPrestamos', titulo: 'Menor cuota tras préstamos', subtitulo: 'La cuota una vez han terminado los préstamos personales (suele ser menor).' },
  { key: 'porIntereses',          titulo: 'Menor intereses pagados',    subtitulo: 'Solo intereses (sin principal).' },
  { key: 'porPatrimonioFinal',    titulo: 'Mayor patrimonio final',     subtitulo: 'Valor vivienda estimado a horizonte menos deuda pendiente (mayor = mejor).' },
  { key: 'porEsfuerzoIngresos',   titulo: 'Menor esfuerzo sobre ingresos', subtitulo: 'Cuota inicial como % de tus ingresos netos mensuales.' },
];

export function renderTabRankings() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Cada ranking ordena las estrategias de mejor (🥇) a peor, según un criterio concreto. El ranking "Mejor para mi situación" combina varios con pesos personalizables.',
  ]));

  const items = state.estrategias.filter(e => {
    const p = state.findPropiedad(e.propiedadId);
    const h = state.findOferta(e.hipotecaId);
    return p && h;
  });

  if (items.length === 0) {
    root.appendChild(el('p', { class: 'text-warn' }, ['�️ No hay estrategias. Crea alguna en la pestaña "Estrategias".']));
    return root;
  }

  const rankings = calcularRankings({
    estrategias: state.estrategias,
    findPropiedad: (id) => state.findPropiedad(id),
    findOferta: (id) => state.findOferta(id),
    findPrestamo: (id) => state.findPrestamo(id),
    findPerfil: (id) => state.findPerfil(id),
    supuestos: state.supuestos,
  });

  // Pesos personalizables.
  const pesos = { ...(state.configuracionRanking?.pesos || {}) };
  const pesosWrap = panel({
    title: 'Pesos para "Mejor para mi situación"',
    subtitle: 'Personaliza cómo se combinan los criterios. La suma de los 5 pesos da 100%.',
  });
  const fields = [
    ['costeTotal', 'Coste total'],
    ['liquidezInicial', 'Liquidez inicial'],
    ['cuotaInicial', 'Cuota inicial'],
    ['patrimonioFinal', 'Patrimonio final'],
    ['esfuerzoIngresos', 'Esfuerzo (cuota/ingresos)'],
  ];
  const inputs = {};
  for (const [k, label] of fields) {
    const ctrl = inputNumber({
      value: pesos[k] ?? 20,
      min: 0, max: 100, step: 1,
      onChange: () => refresh(),
    });
    inputs[k] = ctrl;
    pesosWrap.querySelector('.panel-body').appendChild(
      formRow({ label, control: ctrl, help: 'Peso en % (0-100).' }),
    );
  }
  const personalizado = el('div', { id: 'ranking-personalizado' });
  pesosWrap.querySelector('.panel-body').appendChild(el('hr'));
  pesosWrap.querySelector('.panel-body').appendChild(personalizado);
  root.appendChild(pesosWrap);

  function refresh() {
    for (const k of Object.keys(inputs)) {
      pesos[k] = Number(inputs[k].value) || 0;
    }
    state.setConfiguracionRanking({ pesos: { ...pesos } });
    renderPersonalizado(personalizado, rankings, pesos);
  }
  setTimeout(refresh, 0);

  // Rankings predefinidos.
  for (const def of RANKING_DEFS) {
    const wrap = panel({ title: def.titulo, subtitle: def.subtitulo });
    const list = rankings[def.key] || [];
    if (list.length === 0) {
      wrap.querySelector('.panel-body').appendChild(el('p', { class: 'text-muted small' }, ['Sin datos suficientes.']));
    } else {
      wrap.querySelector('.panel-body').appendChild(renderTabla(list, def.key));
    }
    root.appendChild(wrap);
  }

  return root;
}

function renderTabla(list, key) {
  return el('table', {}, [
    el('thead', {}, [el('tr', {}, [
      el('th', { class: 'num' }, ['#']),
      el('th', {}, ['Estrategia']),
      el('th', {}, ['Banco / Producto']),
      el('th', { class: 'num' }, formatea(key)),
    ])]),
    el('tbody', {}, list.map(r => el('tr', {}, [
      el('td', { class: 'num' }, [medalla(r.ranking)]),
      el('td', {}, [r.estrategia.nombre || '—']),
      el('td', {}, [`${r.hipoteca.banco} ${r.hipoteca.producto}`]),
      el('td', { class: 'num' }, [formatea(key, r.valor)]),
    ]))),
  ]);
}

function medalla(r) {
  return ['🥇', '🥈', '🥉'][r - 1] || `#${r}`;
}

function formatea(key, val) {
  if (val === undefined) return ['Valor'];
  if (key === 'porEsfuerzoIngresos') return `${formatPct(val, 1)} de ingresos`;
  return formatEUR(val);
}

function renderPersonalizado(container, rankings, pesos) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const personalizado = rankingPersonalizado(rankings, pesos);
  if (personalizado.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['Sin datos.']));
    return;
  }
  const wrap = el('div', {}, personalizado.map(p => {
    const detalles = Object.entries(p.desglose)
      .filter(([k, v]) => v !== null)
      .map(([k, v]) => el('div', { class: 'small text-muted' }, [
        `${humanKey(k)}: ${v.puntos}/100 (peso ${v.peso}%, valor ${v.valor.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)`,
      ]));
    return el('div', { class: 'list-item' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        el('div', {}, [
          el('span', { style: { fontWeight: 600, color: 'var(--accent)', marginRight: '8px' } }, [medalla(p.ranking)]),
          el('span', { style: { fontWeight: 600 } }, [p.estrategiaId]),
        ]),
        el('div', { style: { fontSize: '20px', fontWeight: 700, color: p.puntuacion >= 70 ? 'var(--good)' : p.puntuacion >= 40 ? 'var(--warn)' : 'var(--bad)' } }, [
          `${p.puntuacion}/100`,
        ]),
      ]),
      el('div', { class: 'list-item-meta' }, [
        ...detalles,
      ]),
    ]);
  }));
  container.appendChild(wrap);
}

function humanKey(k) {
  const m = {
    costeTotal: 'Coste total',
    liquidezInicial: 'Liquidez inicial',
    cuotaInicial: 'Cuota inicial',
    patrimonioFinal: 'Patrimonio final',
    esfuerzoIngresos: 'Esfuerzo / ingresos',
  };
  return m[k] || k;
}
