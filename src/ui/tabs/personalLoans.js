// Pestaña: Préstamos personales.

import { el, panel, formRow, inputNumber, inputText, inputDate } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { nuevoPrestamoPersonal } from '../../model/factories.js';
import { clone, fmtDate } from '../../core/utils.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { calcCuota } from '../../finance/loan.js';

export function renderTabPersonales() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Catálogo local de préstamos personales. Cada uno se puede combinar con hipotecas en una estrategia. La cuota se calcula con TIN; la TAE se muestra aparte.',
  ]));

  const toolbar = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'btn',
      onClick: async () => {
        const nuevo = nuevoPrestamoPersonal();
        await saveEntity('prestamosPersonales', nuevo);
        state.hipotecaSeleccionadaId = nuevo.id;
        refresh();
      },
    }, ['+ Nuevo préstamo personal']),
  ]);
  root.appendChild(toolbar);

  const lista = el('div', { id: 'personales-lista', class: 'grid grid-auto' });
  root.appendChild(lista);

  const form = el('div', { id: 'personal-form' });
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
  if (state.prestamosPersonales.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['No hay préstamos personales. Añade uno para combinar con hipotecas.']));
    return;
  }
  for (const p of state.prestamosPersonales) {
    const cuota = calcCuota(p.importe, p.tin, p.plazoMeses);
    const item = el('div', { class: 'list-item' + (p.id === state.hipotecaSeleccionadaId ? ' selected' : '') }, [
      el('div', { class: 'list-item-title' }, [p.nombre || 'Sin nombre']),
      el('div', { class: 'list-item-meta' }, [
        `${formatEUR(p.importe)} · TIN ${formatPct(p.tin)} · TAE ${formatPct(p.tae)} · ${p.plazoAnios} años`,
      ]),
      el('div', { class: 'list-item-meta' }, [
        `Cuota: ${formatEUR(cuota)}/mes`,
      ]),
      el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
        el('button', {
          class: 'btn btn-small btn-secondary',
          onClick: () => { state.hipotecaSeleccionadaId = p.id; refresh(); },
        }, ['Editar']),
        el('button', {
          class: 'btn btn-small btn-danger',
          onClick: async () => {
            if (confirm(`¿Borrar préstamo "${p.nombre}"?`)) {
              await deleteEntity('prestamosPersonales', p.id);
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
  const p = state.findPrestamo(state.hipotecaSeleccionadaId);
  if (!p) {
    container.appendChild(el('p', { class: 'text-muted' }, ['Selecciona un préstamo para editarlo.']));
    return;
  }

  function update(field, value) {
    p[field] = value;
    saveEntity('prestamosPersonales', clone(p));
  }

  const cuota = calcCuota(p.importe, p.tin, p.plazoMeses);
  const wrap = panel({
    title: `Editando: ${p.nombre}`,
    subtitle: `Cuota calculada: ${formatEUR(cuota)}`,
  });

  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      el('div', {}, [
        formRow({ label: 'Nombre', control: inputText({ value: p.nombre, onChange: v => update('nombre', v) }) }),
        formRow({ label: 'Importe (€)', control: inputNumber({ value: p.importe, min: 0, onChange: v => update('importe', v) }) }),
        formRow({ label: 'TIN (%)', control: inputNumber({ value: p.tin, min: 0, step: 0.01, onChange: v => update('tin', v) }), help: 'Tipo de interés nominal anual. Es el que se usa para calcular la cuota.' }),
        formRow({ label: 'TAE (%)', control: inputNumber({ value: p.tae, min: 0, step: 0.01, onChange: v => update('tae', v) }), help: 'Métrica informativa. Suele ser similar al TIN en préstamos personales sin muchas comisiones.' }),
      ]),
      el('div', {}, [
        formRow({ label: 'Plazo (años)', control: inputNumber({ value: p.plazoAnios, min: 1, max: 10, onChange: v => {
          update('plazoAnios', v);
          update('plazoMeses', v * 12);
        }}) }),
        formRow({ label: 'Plazo (meses)', control: inputNumber({ value: p.plazoMeses, min: 1, onChange: v => {
          update('plazoMeses', v);
          update('plazoAnios', Math.floor(v / 12));
        }}) }),
        formRow({ label: 'Comisión apertura (% sobre principal)', control: inputNumber({ value: p.comisionApertura, min: 0, step: 0.01, onChange: v => update('comisionApertura', v) }) }),
        formRow({ label: 'Comisión apertura fija (€)', control: inputNumber({ value: p.comisionAperturaFija, min: 0, onChange: v => update('comisionAperturaFija', v) }) }),
        formRow({ label: 'Otros costes (€)', control: inputNumber({ value: p.otrosCostes, min: 0, onChange: v => update('otrosCostes', v) }) }),
        formRow({
          label: 'Fecha de alta',
          control: inputDate({ value: p.metadata?.fecha || '', onChange: v => {
            p.metadata = { ...p.metadata, fecha: v };
            saveEntity('prestamosPersonales', clone(p));
          }}),
        }),
      ]),
    ]),
  );

  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(panel({
    title: 'Resumen',
    children: [
      el('div', { class: 'grid grid-3' }, [
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Cuota mensual']),
          el('div', { style: { fontSize: '20px', fontWeight: 600, color: 'var(--accent)' } }, [formatEUR(cuota)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Total a devolver']),
          el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [formatEUR(cuota * p.plazoMeses)]),
        ]),
        el('div', {}, [
          el('div', { class: 'text-muted small' }, ['Intereses totales']),
          el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [formatEUR(cuota * p.plazoMeses - p.importe)]),
        ]),
      ]),
    ],
  }));

  container.appendChild(wrap);
}
