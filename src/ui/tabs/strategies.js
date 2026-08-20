// Pestaña: Estrategias.

import { el, panel, formRow, inputSelect, inputCheckbox, alert } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { nuevaEstrategia } from '../../model/factories.js';
import { clone } from '../../core/utils.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { analizarEstrategia } from '../../finance/strategy.js';
import { resumenCosteInicial } from '../../finance/initialCost.js';
import { calcCuota } from '../../finance/loan.js';

export function renderTabEstrategias() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Una estrategia es una combinación concreta: una vivienda + una hipoteca + cero o más préstamos personales. La aplicación calcula automáticamente el dinero que necesitas hoy, la cuota, los intereses y el coste total.',
  ]));

  const toolbar = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'btn',
      onClick: async () => {
        if (!state.propiedades.length || !state.ofertasHipoteca.length) {
          alert('Necesitas al menos una propiedad y una oferta hipotecaria antes de crear estrategias.');
          return;
        }
        const nueva = nuevaEstrategia({
          perfilId: state.perfilActivoId || (state.perfiles[0]?.id ?? null),
          propiedadId: state.propiedades[0].id,
          hipotecaId: state.ofertasHipoteca[0].id,
        });
        await saveEntity('estrategias', nueva);
        state.estrategiaSeleccionadaId = nueva.id;
        refresh();
      },
    }, ['+ Nueva estrategia']),
  ]);
  root.appendChild(toolbar);

  const lista = el('div', { id: 'estrategias-lista', class: 'grid grid-auto' });
  root.appendChild(lista);

  const detalle = el('div', { id: 'estrategia-detalle' });
  root.appendChild(detalle);

  function refresh() {
    renderLista(lista, refresh);
    renderDetalle(detalle, refresh);
  }

  refresh();
  return root;
}

function renderLista(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (state.estrategias.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['No hay estrategias. Crea una con el botón superior.']));
    return;
  }
  for (const e of state.estrategias) {
    const propiedad = state.findPropiedad(e.propiedadId);
    const hipoteca = state.findOferta(e.hipotecaId);
    if (!propiedad || !hipoteca) {
      const item = el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item-title text-warn' }, ['⚠️ Estrategia incompleta']),
        el('div', { class: 'list-item-meta' }, ['Faltan referencias a propiedad u oferta hipotecaria.']),
        el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
          el('button', {
            class: 'btn btn-small btn-danger',
            onClick: async () => {
              if (confirm(`¿Borrar estrategia?`)) {
                await deleteEntity('estrategias', e.id);
                refresh();
              }
            },
          }, ['Borrar']),
        ]),
      ]);
      container.appendChild(item);
      continue;
    }
    const analisis = analizarEstrategia({
      propiedad,
      hipoteca,
      prestamos: (e.prestamosIds || []).map(id => state.findPrestamo(id)).filter(Boolean),
      perfil: state.findPerfil(e.perfilId || state.perfilActivoId),
    });
    const cuota = analisis.totales.cuotaInicial;
    const costeTotal = analisis.totales.totalPagado;
    const intereses = analisis.totales.totalIntereses;

    const item = el('div', { class: 'list-item' + (e.id === state.estrategiaSeleccionadaId ? ' selected' : '') }, [
      el('div', { class: 'list-item-title' }, [e.nombre || 'Sin nombre']),
      el('div', { class: 'list-item-meta' }, [
        `${propiedad.nombre} · ${hipoteca.banco} ${hipoteca.producto}`,
      ]),
      el('div', { class: 'list-item-meta' }, [
        `Cuota inicial: ${formatEUR(cuota)} · Coste total: ${formatEUR(costeTotal)} · Intereses: ${formatEUR(intereses)}`,
      ]),
      (e.prestamosIds || []).length > 0 && el('div', { class: 'list-item-meta' }, [
        `${e.prestamosIds.length} préstamo(s) personal(es) incluido(s)`,
      ]),
      el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
        el('button', {
          class: 'btn btn-small btn-secondary',
          onClick: () => { state.estrategiaSeleccionadaId = e.id; refresh(); },
        }, ['Ver detalle']),
        el('button', {
          class: 'btn btn-small btn-danger',
          onClick: async () => {
            if (confirm(`¿Borrar estrategia "${e.nombre}"?`)) {
              await deleteEntity('estrategias', e.id);
              if (state.estrategiaSeleccionadaId === e.id) state.estrategiaSeleccionadaId = null;
              refresh();
            }
          },
        }, ['Borrar']),
      ]),
    ]);
    item.addEventListener('click', (ev) => {
      if (ev.target.tagName === 'BUTTON') return;
      state.estrategiaSeleccionadaId = e.id;
      refresh();
    });
    container.appendChild(item);
  }
}

function renderDetalle(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const e = state.findEstrategia(state.estrategiaSeleccionadaId);
  if (!e) {
    container.appendChild(el('p', { class: 'text-muted' }, ['Selecciona una estrategia para ver su detalle.']));
    return;
  }

  const wrap = panel({ title: `Estrategia: ${e.nombre}` });

  function update(field, value) {
    e[field] = value;
    saveEntity('estrategias', clone(e));
  }
  function updateNested(parent, field, value) {
    e[parent][field] = value;
    saveEntity('estrategias', clone(e));
  }

  // Selector de propiedad, hipoteca, perfil, préstamos.
  const propOpts = state.propiedades.map(p => ({ value: p.id, label: `${p.nombre} · ${formatEUR(p.precio)}` }));
  const hipOpts = state.ofertasHipoteca.map(o => ({ value: o.id, label: `${o.banco} ${o.producto} · ${formatPct(o.fija?.tin || (o.variable?.euribor || 0) + (o.variable?.diferencial || 0))}` }));
  const perfilOpts = [{ value: '', label: '— Sin perfil —' }, ...state.perfiles.map(p => ({ value: p.id, label: p.nombre }))];

  wrap.querySelector('.panel-body').appendChild(el('div', { class: 'grid grid-2' }, [
    formRow({
      label: 'Nombre',
      control: inputSelect({
        value: e.nombre || '',
        options: [
          { value: 'Estrategia A', label: 'Estrategia A' },
          { value: 'Estrategia B', label: 'Estrategia B' },
          { value: 'Estrategia C', label: 'Estrategia C' },
          { value: 'Estrategia D', label: 'Estrategia D' },
          { value: '', label: '— personalizado —' },
        ],
        onChange: v => update('nombre', v),
      }),
    }),
    formRow({
      label: 'Perfil',
      control: inputSelect({
        value: e.perfilId || '',
        options: perfilOpts,
        onChange: v => update('perfilId', v || null),
      }),
    }),
    formRow({
      label: 'Propiedad',
      control: inputSelect({
        value: e.propiedadId || '',
        options: [{ value: '', label: '— Selecciona —' }, ...propOpts],
        onChange: v => update('propiedadId', v),
      }),
    }),
    formRow({
      label: 'Hipoteca',
      control: inputSelect({
        value: e.hipotecaId || '',
        options: [{ value: '', label: '— Selecciona —' }, ...hipOpts],
        onChange: v => update('hipotecaId', v),
      }),
    }),
  ]));

  // Préstamos personales (multi-select via checkboxes).
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(el('h3', { style: { fontSize: '14px', color: 'var(--muted)' } }, ['Préstamos personales incluidos']));
  if (state.prestamosPersonales.length === 0) {
    wrap.querySelector('.panel-body').appendChild(el('p', { class: 'text-muted small' }, ['No hay préstamos personales definidos. Crea alguno en la pestaña "Préstamos personales".']));
  } else {
    for (const p of state.prestamosPersonales) {
      const checked = (e.prestamosIds || []).includes(p.id);
      wrap.querySelector('.panel-body').appendChild(
        el('label', { class: 'checkbox-row' }, [
          el('input', {
            type: 'checkbox',
            onChange: (ev) => {
              const ids = new Set(e.prestamosIds || []);
              if (ev.target.checked) ids.add(p.id); else ids.delete(p.id);
              update('prestamosIds', [...ids]);
            },
          }),
          el('span', {}, [`${p.nombre} · ${formatEUR(p.importe)} · ${formatPct(p.tin)} · ${p.plazoAnios} años (cuota ${formatEUR(calcCuota(p.importe, p.tin, p.plazoMeses))})`]),
        ]),
      );
      if (wrap.querySelector('.panel-body').lastChild.firstChild) {
        wrap.querySelector('.panel-body').lastChild.firstChild.checked = checked;
      }
    }
  }

  // Análisis.
  const propiedad = state.findPropiedad(e.propiedadId);
  const hipoteca = state.findOferta(e.hipotecaId);
  const perfil = state.findPerfil(e.perfilId || state.perfilActivoId);
  if (!propiedad || !hipoteca) {
    container.appendChild(wrap);
    container.appendChild(el('p', { class: 'text-warn' }, ['⚠️ Selecciona propiedad e hipoteca para analizar.']));
    return;
  }

  const prestamos = (e.prestamosIds || []).map(id => state.findPrestamo(id)).filter(Boolean);
  const analisis = analizarEstrategia({ propiedad, hipoteca, prestamos, perfil });

  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(panel({
    title: 'Coste inicial',
    children: [
      el('div', { class: 'grid grid-4' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Coste inicial total']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.costeInicial.costeInicialTotal)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Importe hipoteca']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.costeInicial.importeHipoteca)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Importe préstamos']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.costeInicial.importePrestamos)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Comisión apertura']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.costeInicial.comisionApertura)]),
        ]),
      ]),
      el('hr'),
      el('div', { class: 'grid grid-3' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Dinero necesario hoy']),
          el('div', { style: { fontSize: '20px', fontWeight: 600, color: 'var(--accent)' } }, [formatEUR(analisis.costeInicial.dineroNecesario)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Ahorros disponibles']),
          el('div', { style: { fontSize: '18px' } }, [formatEUR(perfil?.ahorrosDisponibles ?? 0)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Ahorro restante tras compra']),
          el('div', {
            style: { fontSize: '18px', color: analisis.costeInicial.cumpleColchon ? 'var(--good)' : 'var(--bad)' },
          }, [formatEUR(analisis.costeInicial.ahorroRestante)]),
        ]),
      ]),
      !analisis.costeInicial.cumpleColchon && el('div', { class: 'alert alert-bad' }, [
        el('span', { class: 'alert-icon' }, ['⚠️']),
        el('span', { class: 'alert-text' }, [
          `LIQUIDEZ INSUFICIENTE. Esta estrategia te deja con ${formatEUR(analisis.costeInicial.ahorroRestante)}, por debajo del colchón mínimo definido (${formatEUR(analisis.costeInicial.colchon)}). Se permite analizar pero se marca como no viable financieramente.`,
        ]),
      ]),
    ],
  }));

  // Resumen de cuotas y totales.
  wrap.querySelector('.panel-body').appendChild(panel({
    title: 'Cuotas y coste total',
    children: [
      el('div', { class: 'grid grid-4' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Cuota inicial']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.totales.cuotaInicial)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Cuota tras préstamos']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.totales.cuotaDespuesPrestamos)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Intereses totales']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.totales.totalIntereses)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Total pagado']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(analisis.totales.totalPagado)]),
        ]),
      ]),
      el('hr'),
      el('div', { class: 'grid grid-3' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Principal hipoteca']),
          el('div', {}, [formatEUR(analisis.costeInicial.importeHipoteca)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Principal préstamos']),
          el('div', {}, [formatEUR(analisis.costeInicial.importePrestamos)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Comisiones totales']),
          el('div', {}, [formatEUR(analisis.totales.totalComisiones)]),
        ]),
      ]),
    ],
  }));

  // Tabla anual.
  wrap.querySelector('.panel-body').appendChild(panel({
    title: 'Resumen anual (cuotas, intereses, saldo)',
    children: [
      (() => {
        const rows = analisis.resumenAnual.map(a => ({
          cells: [
            a.anio,
            formatEUR(a.cuotaTotal),
            formatEUR(a.interesHipoteca + a.interesPrestamos),
            formatEUR(a.principalHipoteca + a.principalPrestamos),
            formatEUR(a.saldoHipoteca),
            formatEUR(a.saldoPrestamos),
            formatEUR(a.saldoTotal),
          ],
        }));
        return el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', {}, ['Año']),
            el('th', { class: 'num' }, ['Cuota total']),
            el('th', { class: 'num' }, ['Intereses']),
            el('th', { class: 'num' }, ['Principal']),
            el('th', { class: 'num' }, ['Saldo hipo.']),
            el('th', { class: 'num' }, ['Saldo pers.']),
            el('th', { class: 'num' }, ['Saldo total']),
          ])]),
          el('tbody', {}, rows.map(r => el('tr', {}, r.cells.map((c, i) => el('td', { class: i > 0 ? 'num' : '' }, [String(c)]))))),
        ]);
      })(),
    ],
  }));

  container.appendChild(wrap);
}
