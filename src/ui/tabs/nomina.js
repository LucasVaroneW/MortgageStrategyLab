// Pestaña: Nómina (gestión de ingresos y gastos personales, embebida como app aparte).
// Vive en su propio HTML autocontenido (nomina/nomina.html) con su propio almacenamiento
// (localStorage, namespaced con "nom_"), independiente de las hipotecas en IndexedDB.

import { el } from '../dom.js';

export function renderTabNomina() {
  return el('div', { class: 'nomina-frame-wrap' }, [
    el('iframe', { src: 'nomina/nomina.html', title: 'Nómina' }),
  ]);
}
