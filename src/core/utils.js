// Utilidades generales: id, deepClone, deepEqual, fecha.

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function nowISO() {
  return new Date().toISOString();
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES');
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
