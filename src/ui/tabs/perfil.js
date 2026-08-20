// Pestaña: Perfil del comprador.

import { el, panel, formRow, inputNumber, inputText, inputCheckbox, inputSelect } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { nuevoPerfil } from '../../model/factories.js';
import { clone, fmtDate } from '../../core/utils.js';
import { formatEUR } from '../../core/money.js';

const COMUNIDADES = [
  'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
  'Castilla y León', 'Castilla-La Mancha', 'Cataluña', 'Comunidad Valenciana',
  'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarra', 'País Vasco', 'Ceuta', 'Melilla',
];

export function renderTabPerfil() {
  const root = el('div', { class: 'tab-content' });

  const intro = el('p', { class: 'text-muted small' }, [
    'Aquí defines tu situación personal. La aplicación usará estos datos para evaluar el esfuerzo financiero, la liquidez y el cumplimiento de tus límites. Puedes guardar varios perfiles.',
  ]);
  root.appendChild(intro);

  // Supuestos globales (afectan a Gráficos y Rankings: crecimiento de la vivienda, etc.)
  root.appendChild(renderSupuestos());

  // Toolbar
  const toolbar = el('div', { class: 'toolbar' }, [
    el('button', {
      class: 'btn',
      onClick: async () => {
        const nuevo = nuevoPerfil();
        await saveEntity('perfiles', nuevo);
        state.perfilActivoId = nuevo.id;
        refresh();
      },
    }, ['+ Nuevo perfil']),
  ]);
  root.appendChild(toolbar);

  // Lista lateral
  const lista = el('div', { id: 'perfiles-lista' });
  root.appendChild(lista);

  // Form
  const form = el('div', { id: 'perfil-form' });
  root.appendChild(form);

  function refresh() {
    renderLista(lista, refresh);
    renderForm(form, refresh);
  }

  refresh();
  return root;
}

function renderSupuestos() {
  const s = state.supuestos;
  const wrap = panel({
    title: 'Supuestos globales',
    subtitle: 'Hipótesis usadas en Gráficos y Rankings (patrimonio final, etc.). No son predicciones, solo el escenario que quieres simular.',
  });
  const fields = [
    ['inflacionAnual', 'Inflación anual (%)'],
    ['crecimientoVivienda', 'Crecimiento del valor de la vivienda (%/año)'],
    ['crecimientoSalario', 'Crecimiento salarial general (%/año)'],
    ['euriborProyectado', 'Euríbor proyectado (%)'],
  ];
  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-4' }, fields.map(([key, label]) =>
      formRow({
        label,
        control: inputNumber({
          value: s[key],
          step: 0.1,
          onChange: v => state.setSupuestos({ [key]: v }),
        }),
      }),
    )),
  );
  return wrap;
}

function renderLista(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  if (state.perfiles.length === 0) {
    container.appendChild(el('p', { class: 'text-muted small' }, ['No hay perfiles guardados. Crea uno para empezar.']));
    return;
  }
  for (const p of state.perfiles) {
    const item = el('div', { class: 'list-item' + (p.id === state.perfilActivoId ? ' selected' : '') }, [
      el('div', { class: 'list-item-title' }, [p.nombre || 'Sin nombre']),
      el('div', { class: 'list-item-meta' }, [
        `${p.edad} años · ${formatEUR(p.ahorrosDisponibles)} ahorros · ${p.municipio || '—'}`,
      ]),
      el('div', { style: { marginTop: '6px', display: 'flex', gap: '6px' } }, [
        el('button', {
          class: 'btn btn-small btn-secondary',
          onClick: () => { state.perfilActivoId = p.id; refresh(); },
        }, ['Seleccionar']),
        el('button', {
          class: 'btn btn-small btn-danger',
          onClick: async () => {
            if (confirm(`¿Borrar perfil "${p.nombre}"?`)) {
              await deleteEntity('perfiles', p.id);
              if (state.perfilActivoId === p.id) state.perfilActivoId = null;
              refresh();
            }
          },
        }, ['Borrar']),
      ]),
    ]);
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      state.perfilActivoId = p.id;
      refresh();
    });
    container.appendChild(item);
  }
}

function renderForm(container, refresh) {
  while (container.firstChild) container.removeChild(container.firstChild);
  const p = state.findPerfil(state.perfilActivoId);
  if (!p) {
    container.appendChild(el('p', { class: 'text-muted' }, ['Selecciona un perfil para editarlo.']));
    return;
  }

  const wrap = panel({
    title: `Editando: ${p.nombre}`,
    subtitle: `Creado ${fmtDate(p.metadata?.createdAt)} · Actualizado ${fmtDate(p.metadata?.updatedAt)}`,
  });

  function update(field, value) {
    p[field] = value;
    saveEntity('perfiles', clone(p));
  }

  function updateNested(parent, field, value) {
    p[parent][field] = value;
    saveEntity('perfiles', clone(p));
  }

  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      // Nombre
      el('div', {}, [
        formRow({
          label: 'Nombre del perfil',
          control: inputText({ value: p.nombre, onChange: v => update('nombre', v) }),
        }),
      ]),
      // Edad
      el('div', {}, [
        formRow({
          label: 'Edad',
          control: inputNumber({ value: p.edad, min: 16, max: 100, onChange: v => update('edad', v) }),
        }),
      ]),
      // Comunidad autónoma
      el('div', {}, [
        formRow({
          label: 'Comunidad autónoma',
          control: inputSelect({
            value: p.comunidadAutonoma,
            options: [{ value: '', label: '— Selecciona —' }, ...COMUNIDADES.map(c => ({ value: c, label: c }))],
            onChange: v => update('comunidadAutonoma', v),
          }),
        }),
      ]),
      // Provincia
      el('div', {}, [
        formRow({
          label: 'Provincia',
          control: inputText({ value: p.provincia, onChange: v => update('provincia', v) }),
        }),
      ]),
      // Municipio
      el('div', {}, [
        formRow({
          label: 'Municipio',
          control: inputText({ value: p.municipio, onChange: v => update('municipio', v) }),
        }),
      ]),
      // Primera vivienda / vivienda habitual
      el('div', {}, [
        formRow({
          label: '¿Primera vivienda?',
          control: inputCheckbox({ checked: p.primeraVivienda, onChange: v => update('primeraVivienda', v), label: 'Sí' }),
        }),
        formRow({
          label: '¿Vivienda habitual?',
          control: inputCheckbox({ checked: p.viviendaHabitual, onChange: v => update('viviendaHabitual', v), label: 'Sí' }),
        }),
      ]),
      // Ingresos
      el('div', {}, [
        formRow({
          label: 'Ingresos netos mensuales',
          control: inputNumber({ value: p.ingresosNetosMensuales, min: 0, onChange: v => update('ingresosNetosMensuales', v) }),
          help: 'Tras impuestos.',
        }),
        formRow({
          label: 'Ingresos netos anuales',
          control: inputNumber({ value: p.ingresosNetosAnuales, min: 0, onChange: v => update('ingresosNetosAnuales', v) }),
        }),
        formRow({
          label: 'Crecimiento salarial esperado (%)',
          control: inputNumber({ value: p.crecimientoSalarialAnualEsperado, step: 0.1, onChange: v => update('crecimientoSalarialAnualEsperado', v) }),
          help: 'Hipótesis personal, no una predicción.',
        }),
      ]),
      // Ahorros
      el('div', {}, [
        formRow({
          label: 'Ahorros disponibles',
          control: inputNumber({ value: p.ahorrosDisponibles, min: 0, onChange: v => update('ahorrosDisponibles', v) }),
          help: 'Capital propio que puedes aportar a la compra.',
        }),
        formRow({
          label: 'Colchón mínimo a conservar',
          control: inputNumber({ value: p.colchonMinimo, min: 0, onChange: v => update('colchonMinimo', v) }),
          help: 'Si una estrategia te deja con menos, mostrará una alerta.',
        }),
        formRow({
          label: 'Cuotas mensuales existentes',
          control: inputNumber({ value: p.cuotasMensualesExistentes, min: 0, onChange: v => update('cuotasMensualesExistentes', v) }),
          help: 'Otros préstamos o deudas en curso.',
        }),
      ]),
      // Límites
      el('div', {}, [
        formRow({
          label: 'Cuota máxima deseada',
          control: inputNumber({ value: p.cuotaMaximaDeseada, min: 0, onChange: v => update('cuotaMaximaDeseada', v) }),
          help: 'Cuota máxima que estás dispuesto a pagar.',
        }),
        formRow({
          label: 'Plazo máximo deseado (años)',
          control: inputNumber({ value: p.plazoMaximoDeseado, min: 1, max: 50, onChange: v => update('plazoMaximoDeseado', v) }),
        }),
        formRow({
          label: 'Plazo preferido (años)',
          control: inputNumber({ value: p.plazoPreferido, min: 1, max: 50, onChange: v => update('plazoPreferido', v) }),
        }),
      ]),
    ]),
  );

  container.appendChild(wrap);
}
