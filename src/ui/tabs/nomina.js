// Pestaña: Nómina (gestión de ingresos y gastos personales, embebida como app aparte).
// Vive en su propio HTML autocontenido (nomina/nomina.html) con su propio almacenamiento
// (localStorage, namespaced con "nom_"), independiente de las hipotecas en IndexedDB.

import { el } from '../dom.js';

// Sube este número cada vez que cambie nomina.html, para forzar a que el navegador
// pida el archivo de nuevo en vez de servir una copia cacheada (GitHub Pages cachea
// las respuestas hasta 10 minutos, y los navegadores pueden guardarlas más tiempo aún).
const NOMINA_VERSION = 2;

export function renderTabNomina() {
  return el('div', { class: 'nomina-frame-wrap' }, [
    el('iframe', { src: `nomina/nomina.html?v=${NOMINA_VERSION}`, title: 'Nómina' }),
  ]);
}
