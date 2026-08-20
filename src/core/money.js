// Utilidades de formato y redondeo de dinero.
// El motor trabaja SIEMPRE en céntimos internamente para evitar errores de coma flotante.

export function toCents(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return 0;
  return cents / 100;
}

export function round2(amount) {
  return Math.round(amount * 100) / 100;
}

export function formatEUR(amount, opts = {}) {
  const { decimals = 2, withSymbol = true } = opts;
  const n = typeof amount === 'number' ? amount : Number(amount) || 0;
  const formatted = n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withSymbol ? `${formatted} €` : formatted;
}

export function formatPct(rate, decimals = 2) {
  const n = typeof rate === 'number' ? rate : Number(rate) || 0;
  return `${n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`;
}

export function sum(values) {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
}
