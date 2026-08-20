// Wrapper simple de IndexedDB.
// Cada "tabla" es un object store. Operaciones CRUD básicas por entidad.

const DB_NAME = 'MortgageStrategyLabDB';
const DB_VERSION = 1;
const STORES = ['perfiles', 'propiedades', 'ofertasHipoteca', 'prestamosPersonales', 'estrategias', 'configuracion'];
const CONFIG_ID = 'app';

let dbPromise = null;

export function abrirDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
      // Almacén para un único registro de configuración/supuestos.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then(r => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function getAll(storeName) {
  return tx(storeName, 'readonly', store => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function getById(storeName, id) {
  return tx(storeName, 'readonly', store => new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

export async function put(storeName, item) {
  if (item.metadata) {
    item.metadata = { ...item.metadata, updatedAt: new Date().toISOString() };
  }
  return tx(storeName, 'readwrite', store => new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  }));
}

export async function getConfiguracion() {
  return getById('configuracion', CONFIG_ID);
}

// Fusiona con lo ya guardado (put no borra las claves que no se pasan aquí).
export async function setConfiguracion(partial) {
  const existente = (await getById('configuracion', CONFIG_ID)) || { id: CONFIG_ID };
  return put('configuracion', { ...existente, ...partial, id: CONFIG_ID });
}

export async function remove(storeName, id) {
  return tx(storeName, 'readwrite', store => new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }));
}

export async function clearAll() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite');
    for (const store of STORES) {
      t.objectStore(store).clear();
    }
    t.oncomplete = () => resolve(true);
    t.onerror = () => reject(t.error);
  });
}

export async function exportAll({ supuestos, configuracionRanking } = {}) {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    perfiles: await getAll('perfiles'),
    propiedades: await getAll('propiedades'),
    ofertasHipoteca: await getAll('ofertasHipoteca'),
    prestamosPersonales: await getAll('prestamosPersonales'),
    estrategias: await getAll('estrategias'),
    supuestos: supuestos || null,
    configuracionRanking: configuracionRanking || null,
  };
  return data;
}

export async function importAll(data, { mode = 'merge' } = {}) {
  if (!data || data.version !== 1) {
    throw new Error('JSON no compatible (version != 1)');
  }
  if (mode === 'replace') {
    await clearAll();
  }
  for (const p of (data.perfiles || [])) await put('perfiles', p);
  for (const p of (data.propiedades || [])) await put('propiedades', p);
  for (const p of (data.ofertasHipoteca || [])) await put('ofertasHipoteca', p);
  for (const p of (data.prestamosPersonales || [])) await put('prestamosPersonales', p);
  for (const p of (data.estrategias || [])) await put('estrategias', p);
  if (data.supuestos || data.configuracionRanking) {
    await setConfiguracion({
      ...(data.supuestos ? { supuestos: data.supuestos } : {}),
      ...(data.configuracionRanking ? { configuracionRanking: data.configuracionRanking } : {}),
    });
  }
  return data;
}

export const STORE_NAMES = STORES;
