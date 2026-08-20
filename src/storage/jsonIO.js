// Importación / exportación de JSON a fichero desde el navegador.

import { exportAll, importAll } from './db.js';

export function descargarJSON(data, filename = 'mortgage-strategy-lab.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function seleccionarArchivoJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return reject(new Error('No se seleccionó archivo'));
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}

export async function exportarTodo({ supuestos, configuracionRanking, filename = '' } = {}) {
  const data = await exportAll({ supuestos, configuracionRanking });
  const nombre = filename || `mortgage-strategy-lab-${new Date().toISOString().slice(0, 10)}.json`;
  descargarJSON(data, nombre);
  return data;
}

export async function importarTodo({ mode = 'merge' } = {}) {
  const data = await seleccionarArchivoJSON();
  const imported = await importAll(data, { mode });
  return imported;
}
