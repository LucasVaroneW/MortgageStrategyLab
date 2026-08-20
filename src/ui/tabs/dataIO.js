// Pestaña: Datos (import/export JSON, gestión del almacenamiento).

import { el, panel, alert } from '../dom.js';
import { state, saveEntity, deleteEntity } from '../state.js';
import { exportarTodo, importarTodo } from '../../storage/jsonIO.js';
import { abrirDB, clearAll, getAll } from '../../storage/db.js';
import { formatEUR } from '../../core/money.js';

export function renderTabDatos() {
  const root = el('div', { class: 'tab-content' });

  root.appendChild(el('p', { class: 'text-muted small' }, [
    'Tus datos se guardan localmente en IndexedDB. Puedes exportar toda la información a un archivo JSON para guardar copias (por ejemplo hipotecas_agosto_2026.json) o importarlas más tarde.',
  ]));

  // Estado del almacenamiento.
  root.appendChild(panel({
    title: 'Estado actual',
    children: [
      el('div', { id: 'datos-stats' }),
    ],
  }));

  // Exportar.
  root.appendChild(panel({
    title: 'Exportar a JSON',
    subtitle: 'Genera un archivo con TODO: perfiles, propiedades, ofertas hipotecarias, préstamos personales, estrategias, supuestos y configuración. Puedes guardarlo con el nombre que quieras (ej.: hipotecas_agosto_2026.json).',
    children: [
      el('div', { class: 'toolbar' }, [
        el('button', {
          class: 'btn',
          onClick: async () => {
            await exportarTodo({ supuestos: state.supuestos, configuracionRanking: state.configuracionRanking });
          },
        }, ['Exportar todo a JSON']),
      ]),
    ],
  }));

  // Importar.
  root.appendChild(panel({
    title: 'Importar desde JSON',
    subtitle: 'Carga un archivo previamente exportado. Por defecto se FUSIONAN los datos con los actuales (no se borra nada).',
    children: [
      el('div', { class: 'toolbar' }, [
        el('button', {
          class: 'btn',
          onClick: async () => {
            try {
              await importarTodo({ mode: 'merge' });
              await state.init();
              renderStats();
              alert('Datos importados correctamente (modo fusión).');
            } catch (e) {
              alert('Error al importar: ' + e.message);
            }
          },
        }, ['Importar (fusionar)']),
        el('button', {
          class: 'btn btn-danger',
          onClick: async () => {
            if (!confirm('Vas a BORRAR todos los datos locales y reemplazarlos por los del archivo. ¿Continuar?')) return;
            try {
              await importarTodo({ mode: 'replace' });
              await state.init();
              renderStats();
              alert('Datos importados (reemplazo total).');
            } catch (e) {
              alert('Error al importar: ' + e.message);
            }
          },
        }, ['Importar (reemplazar todo)']),
      ]),
    ],
  }));

  // Peligro.
  root.appendChild(panel({
    title: 'Borrado total',
    subtitle: '⚠️ Borra TODOS los datos de la base local. No se puede deshacer.',
    children: [
      el('button', {
        class: 'btn btn-danger',
        onClick: async () => {
          if (!confirm('¿Seguro que quieres borrar todos los datos? Esta acción no se puede deshacer.')) return;
          await clearAll();
          await state.init();
          renderStats();
          alert('Todos los datos locales borrados.');
        },
      }, ['Borrar TODO']),
    ],
  }));

  const stats = el('div', { id: 'datos-stats' });
  function renderStats() {
    while (stats.firstChild) stats.removeChild(stats.firstChild);
    stats.appendChild(el('div', { class: 'grid grid-4' }, [
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Perfiles']),
        el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [String(state.perfiles.length)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Propiedades']),
        el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [String(state.propiedades.length)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Ofertas hipoteca']),
        el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [String(state.ofertasHipoteca.length)]),
      ]),
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Préstamos personales']),
        el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [String(state.prestamosPersonales.length)]),
      ]),
    ]));
    stats.appendChild(el('div', { class: 'grid grid-3', style: { marginTop: '8px' } }, [
      el('div', {}, [
        el('div', { class: 'text-muted small' }, ['Estrategias']),
        el('div', { style: { fontSize: '20px', fontWeight: 600 } }, [String(state.estrategias.length)]),
      ]),
    ]));
  }
  setTimeout(renderStats, 0);

  return root;
}
