// Tests del modulo de backup.
// Como localStorage y el navegador no estan disponibles en Node puro,
// validamos las funciones puras (textoIndicadorBackup, calcularHashEstado,
// timestampArchivo). Para el ciclo completo (descarga, auto-backup) usamos
// los tests visuales en tests.html.

import {
  __test__,
  textoIndicadorBackup,
  getUltimoBackup,
  getIntervaloMinutos,
  setIntervaloMinutos,
} from '../storage/backup.js';

export const testsBackup = [
  {
    nombre: 'backup: getUltimoBackup devuelve null si nunca se hizo backup',
    ejecutar: () => {
      try { localStorage.removeItem('msl.lastBackup'); } catch {}
      const r = getUltimoBackup();
      const ok = r === null;
      return { ok, errores: ok ? [] : ['Debio devolver null'] };
    },
  },
  {
    nombre: 'backup: textoIndicadorBackup maneja estado "nunca"',
    ejecutar: () => {
      try { localStorage.removeItem('msl.lastBackup'); } catch {}
      const r = textoIndicadorBackup();
      const ok = r.nivel === 'never' && r.texto.includes('Nunca');
      return { ok, errores: ok ? [] : ['Nivel/texto incorrecto: ' + JSON.stringify(r)] };
    },
  },
  {
    nombre: 'backup: textoIndicadorBackup muestra "hace X min" cuando es reciente',
    ejecutar: () => {
      const hace5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      try { localStorage.setItem('msl.lastBackup', hace5min); } catch {}
      const r = textoIndicadorBackup();
      const ok = r.nivel === 'recent' && /min/.test(r.texto);
      try { localStorage.removeItem('msl.lastBackup'); } catch {}
      return { ok, errores: ok ? [] : ['Nivel/texto incorrecto: ' + JSON.stringify(r)] };
    },
  },
  {
    nombre: 'backup: textoIndicadorBackup marca "viejo" si > 1 dia',
    ejecutar: () => {
      const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      try { localStorage.setItem('msl.lastBackup', hace2dias); } catch {}
      const r = textoIndicadorBackup();
      const ok = r.nivel === 'old';
      try { localStorage.removeItem('msl.lastBackup'); } catch {}
      return { ok, errores: ok ? [] : ['Debio marcar como viejo: ' + JSON.stringify(r)] };
    },
  },
  {
    nombre: 'backup: textoIndicadorBackup marca "nunca" si > 7 dias',
    ejecutar: () => {
      const hace10dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      try { localStorage.setItem('msl.lastBackup', hace10dias); } catch {}
      const r = textoIndicadorBackup();
      const ok = r.nivel === 'never';
      try { localStorage.removeItem('msl.lastBackup'); } catch {}
      return { ok, errores: ok ? [] : ['Debio marcar rojo: ' + JSON.stringify(r)] };
    },
  },
  {
    nombre: 'backup: getIntervaloMinutos devuelve default si no hay valor guardado',
    ejecutar: () => {
      try { localStorage.removeItem('msl.backupInterval'); } catch {}
      const r = getIntervaloMinutos();
      const ok = r === 5;
      return { ok, errores: ok ? [] : ['Default esperado 5, obtuvo ' + r] };
    },
  },
  {
    nombre: 'backup: setIntervaloMinutos clampea valores invalidos',
    ejecutar: () => {
      // setIntervalo(0) deberia ir a 1 (minimo).
      const r1 = setIntervaloMinutos(0);
      const ok1 = r1 === 1;
      // setIntervalo(-5) tambien clampea a 1.
      const r2 = setIntervaloMinutos(-5);
      const ok2 = r2 === 1;
      // setIntervalo(99999) clampea a 1440 (maximo 1 dia).
      const r3 = setIntervaloMinutos(99999);
      const ok3 = r3 === 1440;
      const ok = ok1 && ok2 && ok3;
      // Reset a default.
      try { localStorage.removeItem('msl.backupInterval'); } catch {}
      return {
        ok,
        errores: ok ? [] : [`Clamping incorrecto: ${r1}, ${r2}, ${r3}`],
      };
    },
  },
  {
    nombre: 'backup: timestampArchivo tiene formato YYYY-MM-DD-HHMM',
    ejecutar: () => {
      const ts = __test__.timestampArchivo();
      const ok = /^\d{4}-\d{2}-\d{2}-\d{4}$/.test(ts);
      return {
        ok,
        errores: ok ? [] : ['Formato incorrecto: ' + ts],
        detalles: { timestamp: ts },
      };
    },
  },
];
