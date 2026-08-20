// Pestaña: Propiedades.

import { el, panel, formRow, inputNumber, inputText, inputCheckbox, inputSelect, inputRadio } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { nuevaPropiedad } from '../../model/factories.js';
import { clone, fmtDate } from '../../core/utils.js';
import { formatEUR } from '../../core/money.js';
import { desgloseGastos, costeInicialTotal } from '../../finance/initialCost.js';

const COMUNIDADES = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla y León', 'Castilla-La Mancha', 'Cataluña', 'Comunidad Valenciana',
  'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Ceuta', 'Melilla',
];

export function renderTabPropiedades() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Aquí defines las viviendas que estás valorando. Cada propiedad tiene sus gastos de compra (impuestos, notaría, etc.), que puedes introducir manualmente o estimar como porcentaje.',
  ]));

  const toolbar = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'btn',
      onClick: async () => {
        const nuevo = nuevaPropiedad();
        await saveEntity('propiedades', nuevo);
        state.hipotecaSeleccionadaId = nuevo.id; // reusamos este slot para propiedad seleccionada
        refresh();
      },
    }, ['+ Nueva propiedad']),
  ]);
  root.appendChild(toolbar);

  const lista = el('div', { id: 'propiedades-lista', class: 'grid grid-2' });
  root.appendChild(lista);

  const form = el('div', { id: 'propiedad-form' });
  root.appendChild(form);

  function refresh() {
    renderLista(lista, refresh);
    renderForm(form, refresh);
  }

  refresh();
  return root;
}

function renderLista(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (state.propiedades.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['No hay propiedades. Añade una para empezar.']));
    return;
  }
  for (const p of state.propiedades) {
    const coste = costeInicialTotal(p);
    const item = el('div', { class: 'list-item' + (p.id === state.hipotecaSeleccionadaId ? ' selected' : '') }, [
      el('div', { class: 'list-item-title' }, [p.nombre || 'Sin nombre']),
      el('div', { class: 'list-item-meta' }, [
        `${formatEUR(p.precio)} · ${p.municipio || '—'} · `,
        el('span', { class: 'badge ' + (p.nueva ? 'badge-en-estudio' : 'badge-activa') }, [p.nueva ? 'Nueva' : 'Usada']),
      ]),
      el('div', { class: 'list-item-meta' }, [
        `Coste inicial total: ${formatEUR(coste)}`,
      ]),
      el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
        el('button', {
          class: 'btn btn-small btn-secondary',
          onClick: () => { state.hipotecaSeleccionadaId = p.id; refresh(); },
        }, ['Editar']),
        el('button', {
          class: 'btn btn-small btn-danger',
          onClick: async () => {
            if (confirm(`¿Borrar propiedad "${p.nombre}"?`)) {
              await deleteEntity('propiedades', p.id);
              if (state.hipotecaSeleccionadaId === p.id) state.hipotecaSeleccionadaId = null;
              refresh();
            }
          },
        }, ['Borrar']),
      ]),
    ]);
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      state.hipotecaSeleccionadaId = p.id;
      refresh();
    });
    container.appendChild(item);
  }
}

function renderForm(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const p = state.findPropiedad(state.hipotecaSeleccionadaId);
  if (!p) {
    container.appendChild(el('p', { class: 'text-muted' }, ['Selecciona una propiedad para editarla.']));
    return;
  }

  const wrap = panel({
    title: `Editando: ${p.nombre}`,
    subtitle: `Coste inicial calculado: ${formatEUR(costeInicialTotal(p))}`,
  });

  function update(field, value) {
    p[field] = value;
    saveEntity('propiedades', clone(p));
  }
  function updateGasto(field, value) {
    p.gastosCompra[field] = value;
    saveEntity('propiedades', clone(p));
  }

  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      el('div', {}, [
        formRow({
          label: 'Nombre',
          control: (() => {
            const inp = inputText({ value: p.nombre, onChange: v => update('nombre', v) });
            return inp;
          })(),
        }),
        formRow({
          label: 'Precio (€)',
          control: inputNumber({ value: p.precio, min: 0, onChange: v => update('precio', v) }),
        }),
        formRow({
          label: 'Valor de tasación (€)',
          control: inputNumber({ value: p.valorTasacion, min: 0, onChange: v => update('valorTasacion', v || null) }),
          help: 'Necesario para calcular el % financiado cuando la base es tasación o menor.',
        }),
        formRow({
          label: 'Ubicación',
          control: inputText({ value: p.ubicacion, onChange: v => update('ubicacion', v) }),
        }),
        formRow({
          label: 'Comunidad autónoma',
          control: inputSelect({
            value: p.comunidadAutonoma,
            options: [{ value: '', label: '—' }, ...COMUNIDADES.map(c => ({ value: c, label: c }))],
            onChange: v => update('comunidadAutonoma', v),
          }),
        }),
        formRow({
          label: 'Provincia',
          control: inputText({ value: p.provincia, onChange: v => update('provincia', v) }),
        }),
        formRow({
          label: 'Municipio',
          control: inputText({ value: p.municipio, onChange: v => update('municipio', v) }),
        }),
        formRow({
          label: '¿Vivienda nueva?',
          control: inputCheckbox({ checked: p.nueva, onChange: v => update('nueva', v), label: 'Nueva (de obra nueva / primera transmisión)' }),
        }),
      ]),
      el('div', {}, [
        formRow({
          label: 'Modo de gastos de compra',
          control: inputRadio({
            name: 'modo-gastos',
            value: p.gastosCompra.modo,
            options: [
              { value: 'MANUAL', label: 'Manual (introducir cada gasto)' },
              { value: 'ESTIMADO', label: 'Estimado (% sobre precio)' },
            ],
            onChange: v => updateGasto('modo', v),
          }),
        }),
        el('div', { id: 'gastos-form' }),
      ]),
    ]),
  );

  container.appendChild(wrap);
  renderGastos(wrap.querySelector('#gastos-form'), p, updateGasto, refresh);
}

function renderGastos(container, p, updateGasto, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const desglose = desgloseGastos(p);
  const modo = p.gastosCompra.modo;

  if (modo === 'ESTIMADO') {
    container.appendChild(el('div', {}, [
      formRow({
        label: 'Porcentaje estimado sobre precio (%)',
        control: inputNumber({
          value: p.gastosCompra.porcentajeEstimado,
          step: 0.1,
          min: 0,
          onChange: v => updateGasto('porcentajeEstimado', v),
        }),
        help: 'Se aplicará sobre el precio para estimar el coste inicial total.',
      }),
      el('div', { class: 'alert alert-good' }, [
        el('span', { class: 'alert-icon' }, ['📊']),
        el('span', { class: 'alert-text' }, [
          `Coste inicial total estimado: ${formatEUR(desglose.estimadoTotal)} (precio + ${formatEUR(desglose.estimadoTotal)} de gastos estimados).`,
        ]),
      ]),
      el('div', { class: 'text-muted small' }, [
        'En modo ESTIMADO no se distingue entre partidas. Cada gasto se considera [ESTIMADO] y no [MANUAL].',
      ]),
    ]));
  } else {
    const g = p.gastosCompra;
    const fields = [
      ['impuestos', 'Impuestos (ITP/IVA+)'],
      ['notaria', 'Notaría'],
      ['registro', 'Registro'],
      ['gestoria', 'Gestoría'],
      ['tasacion', 'Tasación'],
      ['otros', 'Otros gastos'],
    ];
    const rows = [];
    for (const [k, label] of fields) {
      rows.push(formRow({
        label,
        control: inputNumber({ value: g[k], min: 0, onChange: v => updateGasto(k, v) }),
      }));
    }
    rows.push(el('div', { class: 'alert alert-good' }, [
      el('span', { class: 'alert-icon' }, ['💶']),
      el('span', { class: 'alert-text' }, [
        `Coste inicial total: ${formatEUR(desglose.manual.totalManual + p.precio)} (precio ${formatEUR(p.precio)} + gastos manuales ${formatEUR(desglose.manual.totalManual)}).`,
      ]),
    ]));
    container.appendChild(el('div', {}, rows));
  }
}
