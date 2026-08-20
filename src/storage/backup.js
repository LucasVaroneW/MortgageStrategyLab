// backup.js - Sistema de auto-backup para que el usuario nunca pierda datos.
//
// Caracteristicas:
//  - Descarga un JSON completo cada vez que detecta cambios Y han pasado
//    mas de N minutos desde el ultimo backup.
//  - Guarda el timestamp del ultimo backup en localStorage.
//  - Permite al usuario forzar un backup manual.
//  - Indicador del estado del ultimo backup (reciente / viejo / nunca).
//
// Los archivos descargados se llaman:
//   mortgage-backup-YYYY-MM-DD-HHMM.json
// y se acumulan en la carpeta de descargas del usuario. Esto le permite
// tener un historial de backups sin sobreescribir.

import { exportAll } from './db.js';
import { state } from '../ui/state.js';

const BACKUP_KEY = 'msl.lastBackup';        // ISO timestamp
const HASH_KEY = 'msl.lastBackupHash';      // hash del estado en el ultimo backup
const INTERVAL_KEY = 'msl.backupInterval';  // minutos entre backups
const DEFAULT_INTERVAL_MIN = 5;

// ──────────────────────────────
//   Estado del backup
// ──────────────────────────────

export function getUltimoBackup() {
  try {
    const ts = localStorage.getItem(BACKUP_KEY);
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

export function getIntervaloMinutos() {
  try {
    const v = parseInt(localStorage.getItem(INTERVAL_KEY), 10);
    return (isFinite(v) && v > 0) ? v : DEFAULT_INTERVAL_MIN;
  } catch { return DEFAULT_INTERVAL_MIN; }
}

export function setIntervaloMinutos(min) {
  // null / undefined / NaN / string vacio -> default.
  // Numero (incluido 0 o negativo) -> clampar a [1, 1440].
  if (min === null || min === undefined || min === '' || (typeof min === 'number' && isNaN(min))) {
    try { localStorage.setItem(INTERVAL_KEY, String(DEFAULT_INTERVAL_MIN)); } catch {}
    return DEFAULT_INTERVAL_MIN;
  }
  const n = Number(min);
  const v = Math.max(1, Math.min(1440, n));
  try { localStorage.setItem(INTERVAL_KEY, String(v)); } catch {}
  return v;
}

// ──────────────────────────────
//   Hash del estado (para detectar cambios)
// ──────────────────────────────

export function calcularHashEstado() {
  // Hash simple. Suficiente para detectar "algo cambio". No es criptografico.
  // Recorre todas las entidades y suma campos clave. Si cambia cualquier
  // campo relevante, el hash cambia.
  const parts = [];
  for (const p of state.perfiles) parts.push('u' + p.id + (p.metadata?.updatedAt || ''));
  for (const x of state.propiedades) parts.push('x' + x.id + (x.metadata?.updatedAt || ''));
  for (const h of state.ofertasHipoteca) parts.push('h' + h.id + (h.metadata?.updatedAt || ''));
  for (const l of state.prestamosPersonales) parts.push('l' + l.id + (l.metadata?.updatedAt || ''));
  for (const e of state.estrategias) parts.push('e' + e.id + (e.metadata?.updatedAt || ''));
  return parts.join('|');
}

// ──────────────────────────────
//   Generacion y descarga
// ──────────────────────────────

function timestampArchivo() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function generarBackupJSON() {
  const data = await exportAll({
    supuestos: state.supuestos,
    configuracionRanking: state.configuracionRanking,
  });
  // Anotamos que este JSON es valido para restaurar.
  data._backupMeta = {
    app: 'MortgageStrategyLab',
    timestamp: new Date().toISOString(),
    itemCounts: {
      perfiles: data.perfiles?.length || 0,
      propiedades: data.propiedades?.length || 0,
      ofertasHipoteca: data.ofertasHipoteca?.length || 0,
      prestamosPersonales: data.prestamosPersonales?.length || 0,
      estrategias: data.estrategias?.length || 0,
    },
  };
  return data;
}

export async function descargarBackup({ silencioso = false } = {}) {
  const data = await generarBackupJSON();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mortgage-backup-${timestampArchivo()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  localStorage.setItem(HASH_KEY, calcularHashEstado());

  if (!silencioso) {
    const counts = data._backupMeta.itemCounts;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    alert(`Backup descargado: ${total} elementos guardados.\n\nArchivo: ${a.download}`);
  }

  // Notificar a listeners (indicador de la UI).
  for (const fn of listeners) fn();
  return a.download;
}

// ──────────────────────────────
//   Auto-backup
// ──────────────────────────────

const listeners = new Set();
let intervalId = null;

export function onBackupChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function autoBackupSiNecesario() {
  if (typeof window === 'undefined') return false;
  const ultimo = getUltimoBackup();
  const intervaloMs = getIntervaloMinutos() * 60 * 1000;
  const ahora = Date.now();
  if (ultimo && (ahora - ultimo.getTime()) < intervaloMs) return false;

  // Comprobar si hubo cambios desde el ultimo backup.
  const hashActual = calcularHashEstado();
  const hashAnterior = localStorage.getItem(HASH_KEY);
  if (ultimo && hashAnterior === hashActual) {
    // No hay cambios: actualizamos timestamp para no seguir preguntando,
    // pero NO descargamos nada.
    localStorage.setItem(BACKUP_KEY, new Date().toISOString());
    return false;
  }

  // Hay cambios (o nunca hubo backup). Descargar.
  descargarBackup({ silencioso: true });
  return true;
}

export function iniciarAutoBackup() {
  if (intervalId) return;
  // Comprobar cada 60 segundos si toca backup.
  // La primera comprobacion es a los 10 segundos (dar tiempo a cargar).
  setTimeout(autoBackupSiNecesario, 10 * 1000);
  intervalId = setInterval(autoBackupSiNecesario, 60 * 1000);
}

export function detenerAutoBackup() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ──────────────────────────────
//   Texto para la UI
// ──────────────────────────────

export function textoIndicadorBackup() {
  const ultimo = getUltimoBackup();
  if (!ultimo) return { texto: 'Nunca has hecho backup', nivel: 'never', hace: null };

  const diff = Date.now() - ultimo.getTime();
  const min = Math.floor(diff / 60000);
  const horas = Math.floor(min / 60);
  const dias = Math.floor(horas / 24);

  let hace, texto;
  if (min < 1)       { hace = 'ahora mismo';   texto = 'hace un momento'; }
  else if (min < 60) { hace = `${min} min`;    texto = `hace ${min} min`; }
  else if (horas < 24){ hace = `${horas} h`;    texto = `hace ${horas} h`; }
  else if (dias < 30){ hace = `${dias} días`;  texto = `hace ${dias} días`; }
  else               { hace = `${dias} días`;  texto = `hace ${dias} días (muy antiguo)`; }

  let nivel;
  if (dias >= 7)       nivel = 'never';   // rojo: mas de una semana
  else if (dias >= 1)  nivel = 'old';     // amarillo: mas de un dia
  else                 nivel = 'recent';  // verde: hoy

  return { texto: `Último backup: ${texto}`, nivel, hace };
}

// Exponer para tests.
export const __test__ = {
  calcularHashEstado,
  timestampArchivo,
  textoIndicadorBackup,
  DEFAULT_INTERVAL_MIN,
};
