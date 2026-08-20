// Estado global de la aplicación.
// Se carga desde IndexedDB al inicio y se mantiene en memoria mientras la app está abierta.
// Las pestañas consumen y modifican este estado a través de los métodos.

import * as db from '../storage/db.js';
import { supuestosPorDefecto, configuracionRankingPorDefecto } from '../model/factories.js';

class State {
  constructor() {
    this.perfiles = [];
    this.propiedades = [];
    this.ofertasHipoteca = [];
    this.prestamosPersonales = [];
    this.estrategias = [];
    this.supuestos = supuestosPorDefecto();
    this.configuracionRanking = configuracionRankingPorDefecto();
    this.perfilActivoId = null;
    this.hipotecaSeleccionadaId = null;
    this.listeners = new Set();
  }

  async init() {
    this.perfiles = await db.getAll('perfiles');
    this.propiedades = await db.getAll('propiedades');
    this.ofertasHipoteca = await db.getAll('ofertasHipoteca');
    this.prestamosPersonales = await db.getAll('prestamosPersonales');
    this.estrategias = await db.getAll('estrategias');
    const config = await db.getConfiguracion();
    this.supuestos = { ...supuestosPorDefecto(), ...(config?.supuestos || {}) };
    this.configuracionRanking = { ...configuracionRankingPorDefecto(), ...(config?.configuracionRanking || {}) };
    this.emit();
  }

  async setSupuestos(partial) {
    this.supuestos = { ...this.supuestos, ...partial };
    await db.setConfiguracion({ supuestos: this.supuestos });
    this.emit();
  }

  async setConfiguracionRanking(partial) {
    this.configuracionRanking = { ...this.configuracionRanking, ...partial };
    await db.setConfiguracion({ configuracionRanking: this.configuracionRanking });
    this.emit();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  setPerfiles(items) { this.perfiles = items; this.emit(); }
  setPropiedades(items) { this.propiedades = items; this.emit(); }
  setOfertasHipoteca(items) { this.ofertasHipoteca = items; this.emit(); }
  setPrestamosPersonales(items) { this.prestamosPersonales = items; this.emit(); }
  setEstrategias(items) { this.estrategias = items; this.emit(); }

  // Helpers de búsqueda.
  findPerfil(id) { return this.perfiles.find(p => p.id === id) || null; }
  findPropiedad(id) { return this.propiedades.find(p => p.id === id) || null; }
  findOferta(id) { return this.ofertasHipoteca.find(o => o.id === id) || null; }
  findPrestamo(id) { return this.prestamosPersonales.find(p => p.id === id) || null; }
  findEstrategia(id) { return this.estrategias.find(e => e.id === id) || null; }
}

export const state = new State();

export async function saveEntity(storeName, entity) {
  await db.put(storeName, entity);
  // Refrescar el estado.
  const all = await db.getAll(storeName);
  switch (storeName) {
    case 'perfiles': state.setPerfiles(all); break;
    case 'propiedades': state.setPropiedades(all); break;
    case 'ofertasHipoteca': state.setOfertasHipoteca(all); break;
    case 'prestamosPersonales': state.setPrestamosPersonales(all); break;
    case 'estrategias': state.setEstrategias(all); break;
  }
}

export async function deleteEntity(storeName, id) {
  await db.remove(storeName, id);
  const all = await db.getAll(storeName);
  switch (storeName) {
    case 'perfiles': state.setPerfiles(all); break;
    case 'propiedades': state.setPropiedades(all); break;
    case 'ofertasHipoteca': state.setOfertasHipoteca(all); break;
    case 'prestamosPersonales': state.setPrestamosPersonales(all); break;
    case 'estrategias': state.setEstrategias(all); break;
  }
}
