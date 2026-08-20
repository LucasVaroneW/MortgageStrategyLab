// Pestaña: Ofertas hipotecarias.

import { el, panel, formRow, inputNumber, inputText, inputSelect, inputRadio, inputDate, inputCheckbox } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { nuevaOfertaHipoteca } from '../../model/factories.js';
import { clone, fmtDate } from '../../core/utils.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { calcCuota, amortizar } from '../../finance/loan.js';
import { calcularImporteHipoteca, tinEnMes } from '../../finance/mortgage.js';

export function renderTabHipotecas() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Catálogo local de ofertas hipotecarias. Cada oferta tiene un tipo (fija / variable / mixta), TIN, TAE, comisiones y vinculaciones. La aplicación usa el TIN para calcular las cuotas; la TAE se muestra como métrica comparativa.',
  ]));

  const toolbar = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'btn',
      onClick: async () => {
        const nuevo = nuevaOfertaHipoteca();
        await saveEntity('ofertasHipoteca', nuevo);
        state.hipotecaSeleccionadaId = nuevo.id;
        refresh();
      },
    }, ['+ Nueva oferta']),
  ]);
  root.appendChild(toolbar);

  const lista = el('div', { id: 'hipotecas-lista', class: 'grid grid-auto' });
  root.appendChild(lista);

  const form = el('div', { id: 'hipoteca-form' });
  root.appendChild(form);

  function refresh() {
    renderLista(lista, refresh);
    renderForm(form, refresh);
  }

  refresh();
  return root;
}

function badgeTipo(tipo) {
  if (tipo === 'fija') return el('span', { class: 'badge badge-fija' }, ['FIJA']);
  if (tipo === 'variable') return el('span', { class: 'badge badge-variable' }, ['VARIABLE']);
  if (tipo === 'mixta') return el('span', { class: 'badge badge-mixta' }, ['MIXTA']);
  return el('span', { class: 'badge badge-activa' }, [tipo || '']);
}

function badgeEstado(estado) {
  const map = {
    activa: 'badge-activa',
    descartada: 'badge-descartada',
    en_estudio: 'badge-en-estudio',
    aceptada: 'badge-aceptada',
  };
  return el('span', { class: 'badge ' + (map[estado] || 'badge-activa') }, [estado || '']);
}

function renderLista(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (state.ofertasHipoteca.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['No hay ofertas. Añade una para empezar.']));
    return;
  }
  for (const o of state.ofertasHipoteca) {
    const tin = tinEnMes(o, 1);
    const item = el('div', { class: 'list-item' + (o.id === state.hipotecaSeleccionadaId ? ' selected' : '') }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between' } }, [
        el('div', { class: 'list-item-title' }, [`${o.banco} ${o.producto}`.trim() || 'Sin nombre']),
        badgeEstado(o.estado),
      ]),
      el('div', { class: 'list-item-meta' }, [
        badgeTipo(o.tipo), ' ',
        `TIN: ${formatPct(tin)} · `,
        `TAE: ${formatPct(leeTAE(o))} · `,
        `${o.plazo.anios} años (${o.plazo.meses} meses)`,
      ]),
      el('div', { class: 'list-item-meta' }, [
        `Financiación: ${formatPct(o.financiacion.porcentajeMaximo)}% sobre ${o.financiacion.baseCalculo}`,
      ]),
      el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
        el('button', {
          class: 'btn btn-small btn-secondary',
          onClick: () => { state.hipotecaSeleccionadaId = o.id; refresh(); },
        }, ['Editar']),
        el('button', {
          class: 'btn btn-small btn-danger',
          onClick: async () => {
            if (confirm(`¿Borrar oferta "${o.banco} ${o.producto}"?`)) {
              await deleteEntity('ofertasHipoteca', o.id);
              if (state.hipotecaSeleccionadaId === o.id) state.hipotecaSeleccionadaId = null;
              refresh();
            }
          },
        }, ['Borrar']),
      ]),
    ]);
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      state.hipotecaSeleccionadaId = o.id;
      refresh();
    });
    container.appendChild(item);
  }
}

function leeTAE(o) {
  if (o.tipo === 'fija') return o.fija?.tae || 0;
  if (o.tipo === 'variable') return o.variable?.tae || 0;
  if (o.tipo === 'mixta') return o.mixta?.tae || 0;
  return 0;
}

function renderForm(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const o = state.findOferta(state.hipotecaSeleccionadaId);
  if (!o) {
    container.appendChild(el('p', { class: 'text-muted' }, ['Selecciona una oferta para editarla.']));
    return;
  }

  const wrap = panel({ title: `${o.banco || 'Nueva oferta'} ${o.producto}`, subtitle: `Creada ${fmtDate(o.metadata?.createdAt)}` });

  function update(field, value) {
    o[field] = value;
    saveEntity('ofertasHipoteca', clone(o));
  }
  function updateNested(parent, field, value) {
    o[parent][field] = value;
    saveEntity('ofertasHipoteca', clone(o));
  }

  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      // Identificación
      el('div', {}, [
        formRow({ label: 'Banco', control: inputText({ value: o.banco, onChange: v => update('banco', v) }) }),
        formRow({ label: 'Producto', control: inputText({ value: o.producto, onChange: v => update('producto', v) }) }),
        formRow({ label: 'Fecha', control: inputDate({ value: o.fecha, onChange: v => update('fecha', v) }) }),
        formRow({
          label: 'Estado',
          control: inputSelect({
            value: o.estado,
            options: [
              { value: 'activa', label: 'Activa' },
              { value: 'en_estudio', label: 'En estudio' },
              { value: 'aceptada', label: 'Aceptada' },
              { value: 'descartada', label: 'Descartada' },
            ],
            onChange: v => update('estado', v),
          }),
        }),
        formRow({ label: 'Notas', control: (() => {
          const ta = el('textarea', { onChange: e => update('notas', e.target.value) });
          ta.value = o.notas || '';
          return ta;
        })() }),
      ]),
      // Financiación
      el('div', {}, [
        formRow({
          label: 'Porcentaje máximo de financiación (%)',
          control: inputNumber({ value: o.financiacion.porcentajeMaximo, min: 0, max: 200, step: 0.1, onChange: v => updateNested('financiacion', 'porcentajeMaximo', v) }),
        }),
        formRow({
          label: 'Importe máximo (€)',
          control: inputNumber({ value: o.financiacion.importeMaximo, min: 0, onChange: v => updateNested('financiacion', 'importeMaximo', v || null) }),
          help: 'Opcional. Si se define, el importe financiado será el menor entre el % y este tope.',
        }),
        formRow({
          label: 'Importe solicitado (€)',
          control: inputNumber({ value: o.financiacion.importeSolicitado, min: 0, onChange: v => updateNested('financiacion', 'importeSolicitado', v || null) }),
          help: 'Opcional. Si se define, sustituye al cálculo por porcentaje.',
        }),
        formRow({
          label: 'Base para calcular el %',
          control: inputSelect({
            value: o.financiacion.baseCalculo,
            options: [
              { value: 'precio', label: 'Precio de compra' },
              { value: 'tasacion', label: 'Valor de tasación' },
              { value: 'menor', label: 'El menor de los dos' },
            ],
            onChange: v => updateNested('financiacion', 'baseCalculo', v),
          }),
        }),
        formRow({
          label: 'Plazo (años)',
          control: inputNumber({ value: o.plazo.anios, min: 1, max: 50, onChange: v => {
            updateNested('plazo', 'anios', v);
            updateNested('plazo', 'meses', v * 12);
          }}),
        }),
        formRow({
          label: 'Plazo (meses)',
          control: inputNumber({ value: o.plazo.meses, min: 1, onChange: v => {
            updateNested('plazo', 'meses', v);
            updateNested('plazo', 'anios', Math.floor(v / 12));
          }}),
        }),
      ]),
    ]),
  );

  // Tipo
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(
    panel({
      title: 'Tipo de hipoteca',
      children: [
        formRow({
          label: 'Tipo',
          control: inputRadio({
            name: 'tipo-hipoteca',
            value: o.tipo,
            options: [
              { value: 'fija', label: 'Fija' },
              { value: 'variable', label: 'Variable' },
              { value: 'mixta', label: 'Mixta' },
            ],
            onChange: v => update('tipo', v),
          }),
        }),
        el('div', { id: 'tipo-form' }),
      ],
    }),
  );

  // Comisiones
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(
    panel({
      title: 'Comisiones',
      children: [
        formRow({
          label: 'Apertura (% sobre principal)',
          control: inputNumber({ value: o.comisiones.apertura, min: 0, step: 0.01, onChange: v => updateNested('comisiones', 'apertura', v) }),
        }),
        formRow({
          label: 'Apertura fija (€)',
          control: inputNumber({ value: o.comisiones.aperturaFija, min: 0, onChange: v => updateNested('comisiones', 'aperturaFija', v) }),
        }),
        formRow({
          label: 'Amortización parcial (% sobre lo amortizado)',
          control: inputNumber({ value: o.comisiones.amortizacionParcial, min: 0, step: 0.01, onChange: v => updateNested('comisiones', 'amortizacionParcial', v) }),
        }),
        formRow({
          label: 'Amortización total (% sobre lo amortizado)',
          control: inputNumber({ value: o.comisiones.amortizacionTotal, min: 0, step: 0.01, onChange: v => updateNested('comisiones', 'amortizacionTotal', v) }),
        }),
        formRow({
          label: 'Solo durante los primeros (años)',
          control: inputNumber({ value: o.comisiones.amortizacionDuranteAnios, min: 0, onChange: v => updateNested('comisiones', 'amortizacionDuranteAnios', v || null) }),
        }),
      ],
    }),
  );

  // Preview
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(el('div', { id: 'preview-cuota' }));
  renderPreviewCuota(wrap.querySelector('#preview-cuota'), o, refresh);

  container.appendChild(wrap);
  renderTipoForm(wrap.querySelector('#tipo-form'), o, update, updateNested, refresh);
}

function renderTipoForm(container, o, update, updateNested, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (o.tipo === 'fija') {
    container.appendChild(el('div', { class: 'grid grid-2' }, [
      formRow({
        label: 'TIN (%)',
        control: inputNumber({ value: o.fija.tin, min: 0, step: 0.01, onChange: v => updateNested('fija', 'tin', v) }),
        help: 'Se usa para calcular la cuota.',
      }),
      formRow({
        label: 'TAE (%)',
        control: inputNumber({ value: o.fija.tae, min: 0, step: 0.01, onChange: v => updateNested('fija', 'tae', v) }),
        help: 'Métrica informativa. Incluye comisiones y vinculaciones. Distinta del TIN.',
      }),
    ]));
  } else if (o.tipo === 'variable') {
    container.appendChild(el('div', { class: 'grid grid-2' }, [
      formRow({
        label: 'Euríbor (%)',
        control: inputNumber({ value: o.variable.euribor, step: 0.01, onChange: v => updateNested('variable', 'euribor', v) }),
      }),
      formRow({
        label: 'Diferencial (%)',
        control: inputNumber({ value: o.variable.diferencial, step: 0.01, onChange: v => updateNested('variable', 'diferencial', v) }),
      }),
      formRow({
        label: 'TIN inicial (%)',
        control: inputNumber({ value: o.variable.tinInicial, step: 0.01, onChange: v => updateNested('variable', 'tinInicial', v) }),
        help: 'Solo informativo (puede ser bonificado).',
      }),
      formRow({
        label: 'TAE (%)',
        control: inputNumber({ value: o.variable.tae, step: 0.01, onChange: v => updateNested('variable', 'tae', v) }),
      }),
      formRow({
        label: 'Frecuencia de revisión',
        control: (() => {
          const sel = el('select', {
            onChange: e => updateNested('variable', 'frecuenciaRevision', e.target.value),
          }, [
            el('option', { value: 'anual' }, ['Anual']),
            el('option', { value: 'semestral' }, ['Semestral']),
            el('option', { value: 'trimestral' }, ['Trimestral']),
          ]);
          sel.value = o.variable.frecuenciaRevision || 'anual';
          return sel;
        })(),
      }),
    ]));
  } else if (o.tipo === 'mixta') {
    container.appendChild(el('div', { class: 'grid grid-2' }, [
      formRow({
        label: 'Años tramo fijo',
        control: inputNumber({ value: o.mixta.aniosTramoFijo, min: 1, max: 30, onChange: v => updateNested('mixta', 'aniosTramoFijo', v) }),
      }),
      formRow({
        label: 'TIN tramo fijo (%)',
        control: inputNumber({ value: o.mixta.tinTramoFijo, step: 0.01, onChange: v => updateNested('mixta', 'tinTramoFijo', v) }),
      }),
      formRow({
        label: 'TAE (%)',
        control: inputNumber({ value: o.mixta.tae, step: 0.01, onChange: v => updateNested('mixta', 'tae', v) }),
      }),
      el('div', {}, [
        el('h3', { style: { fontSize: '14px', color: 'var(--muted)' } }, ['Tramo variable']),
        formRow({
          label: 'Euríbor (%)',
          control: inputNumber({ value: o.mixta.tramoVariable.euribor, step: 0.01, onChange: v => updateNested('mixta', 'tramoVariable', { ...o.mixta.tramoVariable, euribor: v }) }),
        }),
        formRow({
          label: 'Diferencial (%)',
          control: inputNumber({ value: o.mixta.tramoVariable.diferencial, step: 0.01, onChange: v => updateNested('mixta', 'tramoVariable', { ...o.mixta.tramoVariable, diferencial: v }) }),
        }),
      ]),
    ]));
  }
  // Tras cambio de tipo, refrescar preview.
  setTimeout(() => renderPreviewCuota(document.querySelector('#preview-cuota'), o, refresh), 0);
}

function renderPreviewCuota(container, o, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (!state.propiedades.length) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['Añade al menos una propiedad para previsualizar la cuota.']));
    return;
  }
  const propiedad = state.propiedades[0];
  const importe = calcularImporteHipoteca(propiedad, o);
  const tin = tinEnMes(o, 1);
  const meses = o.plazo.meses;
  const cuota = calcCuota(importe, tin, meses);
  container.appendChild(panel({
    title: 'Vista previa (con la primera propiedad)',
    children: [
      el('div', { class: 'grid grid-3' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Importe calculado']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatEUR(importe)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['TIN aplicado']),
          el('div', { style: { fontSize: '18px', fontWeight: 600 } }, [formatPct(tin)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Cuota mensual']),
          el('div', { style: { fontSize: '18px', fontWeight: 600, color: 'var(--accent)' } }, [formatEUR(cuota)]),
        ]),
      ]),
      el('div', { class: 'text-muted small', style: { marginTop: '8px' } }, [
        `Plazo: ${meses} meses (${o.plazo.anios} años). Esta cuota se calcula con el sistema de amortización francesa usando el TIN. La TAE (${formatPct(leeTAE(o))}) se muestra aparte.`,
      ]),
    ],
  }));
}
