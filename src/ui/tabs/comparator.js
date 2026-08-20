// Pestaña: Comparador de estrategias (FASE 1).

import { el, panel, formRow, inputSelect, inputCheckbox, alert } from '../dom.js';
import { state } from '../state.js';
import { formatEUR, formatPct } from '../../core/money.js';
import { analizarEstrategia } from '../../finance/strategy.js';
import { encontrarEquilibrio } from '../../finance/breakeven.js';
import { calcularTAEMaximo, tablaSensibilidadTAE } from '../../finance/taeMax.js';

export function renderTabComparador() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Compara todas las estrategias definidas en una tabla. Selecciona dos para ver el punto de equilibrio y el coste comparativo.',
  ]));

  if (state.estrategias.length === 0) {
    root.appendChild(el('p', { class: 'text-warn' }, ['⚠️ No hay estrategias definidas. Crea alguna en la pestaña "Estrategias".']));
    return root;
  }

  // Tabla comparativa.
  root.appendChild(renderTablaComparativa());

  // Punto de equilibrio entre 2.
  root.appendChild(renderEquilibrio());

  // TAE máximo para una estrategia "con préstamo".
  root.appendChild(renderTAEMax());

  return root;
}

function analizarTodas() {
  return state.estrategias.map(e => {
    const propiedad = state.findPropiedad(e.propiedadId);
    const hipoteca = state.findOferta(e.hipotecaId);
    const prestamos = (e.prestamosIds || []).map(id => state.findPrestamo(id)).filter(Boolean);
    const perfil = state.findPerfil(e.perfilId || state.perfilActivoId);
    if (!propiedad || !hipoteca) {
      return { estrategia: e, valida: false };
    }
    const a = analizarEstrategia({ propiedad, hipoteca, prestamos, perfil });
    return { estrategia: e, valida: true, analisis: a, propiedad, hipoteca, prestamos };
  });
}

function renderTablaComparativa() {
  const datos = analizarTodas().filter(d => d.valida);
  if (datos.length === 0) {
    return el('p', { class: 'text-muted' }, ['Ninguna estrategia está completa.']);
  }
  return panel({
    title: 'Tabla comparativa',
    children: [
      el('table', {}, [
        el('thead', {}, [el('tr', {}, [
          el('th', {}, ['Estrategia']),
          el('th', {}, ['Vivienda']),
          el('th', {}, ['Banco / Producto']),
          el('th', { class: 'num' }, ['Importe hipo.']),
          el('th', { class: 'num' }, ['Préstamos']),
          el('th', { class: 'num' }, ['Cuota inicial']),
          el('th', { class: 'num' }, ['Cuota tras pers.']),
          el('th', { class: 'num' }, ['Dinero hoy']),
          el('th', { class: 'num' }, ['Intereses']),
          el('th', { class: 'num' }, ['Coste total']),
          el('th', { class: 'num' }, ['Saldo final']),
        ])]),
        el('tbody', {}, datos.map(d => {
          const e = d.estrategia;
          const a = d.analisis;
          return el('tr', {}, [
            el('td', {}, [e.nombre || '—']),
            el('td', {}, [d.propiedad.nombre]),
            el('td', {}, [`${d.hipoteca.banco} ${d.hipoteca.producto}`]),
            el('td', { class: 'num' }, [formatEUR(a.costeInicial.importeHipoteca)]),
            el('td', { class: 'num' }, [formatEUR(a.costeInicial.importePrestamos)]),
            el('td', { class: 'num' }, [formatEUR(a.totales.cuotaInicial)]),
            el('td', { class: 'num' }, [formatEUR(a.totales.cuotaDespuesPrestamos)]),
            el('td', { class: 'num' }, [formatEUR(a.costeInicial.dineroNecesario)]),
            el('td', { class: 'num' }, [formatEUR(a.totales.totalIntereses)]),
            el('td', { class: 'num' }, [formatEUR(a.totales.totalPagado)]),
            el('td', { class: 'num' }, [formatEUR(a.resumenAnual[a.resumenAnual.length - 1]?.saldoTotal || 0)]),
          ]);
        })),
      ]),
    ],
  });
}

function renderEquilibrio() {
  const wrap = panel({ title: 'Punto de equilibrio entre dos estrategias' });
  const idA = el('select', { id: 'eq-a' });
  const idB = el('select', { id: 'eq-b' });
  for (const e of state.estrategias) {
    const label = `${e.nombre || '—'} · ${state.findPropiedad(e.propiedadId)?.nombre || '?'}`;
    idA.appendChild(el('option', { value: e.id }, [label]));
    idB.appendChild(el('option', { value: e.id }, [label]));
  }
  if (state.estrategias.length >= 2) {
    idB.children[1].selected = true;
  }

  const out = el('div', { id: 'eq-out' });

  const calc = () => {
    while (out.firstChild) out.removeChild(out.firstChild);
    if (!idA.value || !idB.value || idA.value === idB.value) {
      out.appendChild(el('p', { class: 'text-warn' }, ['Selecciona dos estrategias distintas.']));
      return;
    }
    const eA = state.findEstrategia(idA.value);
    const eB = state.findEstrategia(idB.value);
    const propiedadA = state.findPropiedad(eA.propiedadId);
    const propiedadB = state.findPropiedad(eB.propiedadId);
    if (!propiedadA || !propiedadB) {
      out.appendChild(el('p', { class: 'text-warn' }, ['Ambas estrategias deben tener una propiedad asociada.']));
      return;
    }
    if (propiedadA.id !== propiedadB.id) {
      out.appendChild(el('p', { class: 'text-warn' }, ['Las dos estrategias deben estar sobre la MISMA vivienda para comparar (hoy se usa la primera).']));
    }
    const perfilA = state.findPerfil(eA.perfilId || state.perfilActivoId);
    const eq = encontrarEquilibrio(
      { ...eA, _perfil: perfilA },
      { ...eB, _perfil: perfilA },
      {
        propiedad: propiedadA,
        prestamosPorId: state.prestamosPersonales,
        hipotecaPorId: state.ofertasHipoteca,
      },
    );

    out.appendChild(panel({
      title: 'Resultado',
      children: [
        eq.existe
          ? alert({ type: 'good', icon: '✅', text: eq.mensaje })
          : alert({ type: 'warn', icon: '⚠️', text: eq.mensaje }),
        el('div', { class: 'grid grid-4', style: { marginTop: '12px' } }, [
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Mes de cruce']),
            el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [eq.existe ? eq.mes : 'No existe']),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Año de cruce']),
            el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [eq.existe ? eq.anio : '—']),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Total estrategia A']),
            el('div', {}, [formatEUR(eq.totalEstrategiaA)]),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Total estrategia B']),
            el('div', {}, [formatEUR(eq.totalEstrategiaB)]),
          ]),
        ]),
      ],
    }));
  };

  const btn = el('button', { class: 'btn', onClick: calc }, ['Calcular']);
  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      formRow({ label: 'Estrategia A', control: idA }),
      formRow({ label: 'Estrategia B', control: idB }),
    ]),
  );
  wrap.querySelector('.panel-body').appendChild(btn);
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(out);
  setTimeout(calc, 0);
  return wrap;
}

function renderTAEMax() {
  const wrap = panel({
    title: '¿A qué TAE máxima compensa el préstamo personal?',
    subtitle: 'Introduce dos estrategias: una "sin préstamo" (referencia) y otra con un préstamo personal hipotético. La aplicación busca la TAE máxima admisible.',
  });
  const idRef = el('select', { id: 'tae-ref' });
  const idAlt = el('select', { id: 'tae-alt' });
  const idProp = el('select', { id: 'tae-prop' });
  for (const p of state.propiedades) {
    idProp.appendChild(el('option', { value: p.id }, [`${p.nombre} · ${formatEUR(p.precio)}`]));
  }
  for (const e of state.estrategias) {
    const lbl = `${e.nombre || '—'} · ${state.findPropiedad(e.propiedadId)?.nombre || '?'}`;
    idRef.appendChild(el('option', { value: e.id }, [lbl]));
    idAlt.appendChild(el('option', { value: e.id }, [lbl]));
  }

  const importeInp = el('input', { type: 'number', value: 10000, min: 0 });
  const plazoInp = el('input', { type: 'number', value: 84, min: 1 });
  const out = el('div', { id: 'tae-out' });

  const calc = () => {
    while (out.firstChild) out.removeChild(out.firstChild);
    const eRef = state.findEstrategia(idRef.value);
    const eAlt = state.findEstrategia(idAlt.value);
    if (!eRef || !eAlt) {
      out.appendChild(el('p', { class: 'text-warn' }, ['Selecciona referencia y alternativa.']));
      return;
    }
    const propiedad = state.findPropiedad(idProp.value) || state.findPropiedad(eAlt.propiedadId);
    const hipotecaRef = state.findOferta(eRef.hipotecaId);
    const hipotecaAlt = state.findOferta(eAlt.hipotecaId);
    if (!propiedad || !hipotecaRef || !hipotecaAlt) {
      out.appendChild(el('p', { class: 'text-warn' }, ['Faltan datos para calcular.']));
      return;
    }
    const prestamoPersonal = {
      id: '__temp',
      nombre: 'Personal',
      importe: Number(importeInp.value) || 0,
      plazoMeses: Number(plazoInp.value) || 84,
      tin: 7.5, tae: 7.5,
    };
    const resultado = calcularTAEMaximo({
      propiedad,
      hipotecaA: hipotecaAlt,
      prestamoPersonal,
      hipotecaB: hipotecaRef,
    });
    const tabla = tablaSensibilidadTAE({
      propiedad,
      hipotecaA: hipotecaAlt,
      prestamoPersonal,
      hipotecaB: hipotecaRef,
    });

    out.appendChild(panel({
      title: 'Resultado',
      children: [
        el('div', { class: 'alert ' + (resultado.viable ? 'alert-good' : 'alert-warn') }, [
          el('span', { class: 'alert-icon' }, [resultado.viable ? '✅' : '⚠️']),
          el('span', { class: 'alert-text' }, [resultado.mensaje]),
        ]),
        el('div', { class: 'grid grid-4' }, [
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['TAE máxima admisible']),
            el('div', { style: { fontSize: '22px', fontWeight: 600, color: resultado.viable ? 'var(--good)' : 'var(--warn)' } }, [resultado.taeMax !== null ? formatPct(resultado.taeMax) : '—']),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Rango de mercado']),
            el('div', {}, [resultado.rangoMercado ? `${resultado.rangoMercado.min}% – ${resultado.rangoMercado.max}% (típico ${resultado.rangoMercado.tipico}%)` : '—']),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['¿Viable?']),
            el('div', {}, [resultado.viable ? 'Sí' : 'No']),
          ]),
          el('div', {}, [
            el('div', { class: 'text-muted small' }, ['Coste referencia']),
            el('div', {}, [formatEUR(resultado.costeReferencia)]),
          ]),
        ]),
        el('hr'),
        el('h3', { style: { fontSize: '14px', color: 'var(--muted)' } }, ['Tabla de sensibilidad (coste total según TAE)']),
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [
            el('th', { class: 'num' }, ['TAE']),
            el('th', { class: 'num' }, ['Coste total']),
            el('th', { class: 'num' }, ['Diferencia vs ref.']),
            el('th', {}, ['¿Compensa?']),
          ])]),
          el('tbody', {}, tabla.map(t => el('tr', {}, [
            el('td', { class: 'num' }, [formatPct(t.tae)]),
            el('td', { class: 'num' }, [formatEUR(t.costeTotal)]),
            el('td', { class: 'num', style: { color: t.diferencia > 0 ? 'var(--bad)' : 'var(--good)' } }, [(t.diferencia > 0 ? '+' : '') + formatEUR(t.diferencia)]),
            el('td', {}, [t.compensa ? el('span', { class: 'text-good' }, ['Sí']) : el('span', { class: 'text-bad' }, ['No'])]),
          ]))),
        ]),
      ],
    }));
  };

  wrap.querySelector('.panel-body').appendChild(
    el('div', { class: 'grid grid-2' }, [
      formRow({ label: 'Vivienda', control: idProp }),
      formRow({ label: 'Estrategia de referencia (sin préstamo)', control: idRef }),
      formRow({ label: 'Estrategia alternativa (con préstamo)', control: idAlt }),
      formRow({ label: 'Importe del préstamo personal', control: importeInp }),
      formRow({ label: 'Plazo del préstamo (meses)', control: plazoInp }),
    ]),
  );
  wrap.querySelector('.panel-body').appendChild(el('button', { class: 'btn', onClick: calc }, ['Calcular TAE máxima']));
  wrap.querySelector('.panel-body').appendChild(el('hr'));
  wrap.querySelector('.panel-body').appendChild(out);
  setTimeout(calc, 0);
  return wrap;
}
