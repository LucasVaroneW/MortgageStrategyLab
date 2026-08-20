// charts.js - Modulo de graficos SVG nativo (sin dependencias externas).
// Crea graficos de lineas, areas y barras para visualizar estrategias.
//
// API principal:
//   const chart = createLineChart(container, options);
//   chart.addSeries({ name, color, data: [{x, y}, ...] });
//   chart.render();
//
// Donde data es un array de puntos {x, y}. El modulo escala ejes automaticamente.
//
// Estilos: usa los colores CSS de la app (--accent, --good, --warn, --bad) por defecto.

const COLORS = {
  accent: '#38bdf8',
  accent2: '#0ea5e9',
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
  text: '#e2e8f0',
  muted: '#94a3b8',
  border: '#475569',
  bg: '#1e293b',
  bg2: '#334155',
};

// Series de colores por defecto (cicla si hay mas de N series).
const SERIES_PALETTE = [
  COLORS.accent,
  COLORS.good,
  COLORS.warn,
  '#a78bfa', // purple
  '#f472b6', // pink
  COLORS.bad,
  '#fbbf24', // yellow
  '#34d399', // emerald
];

function el(tag, attrs = {}, children = []) {
  const ns = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v);
  }
  for (const c of [].concat(children || [])) {
    if (c === null || c === undefined || false === c) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function formatNumber(v, precision = 0) {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return v.toFixed(precision);
}

function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const range = max - min;
  const roughStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const ticks = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 0.001; v += step) {
    ticks.push(Math.round(v / step) * step);
  }
  return ticks;
}

class BaseChart {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;
    if (!this.container) throw new Error('charts: container no encontrado');
    this.options = {
      width: options.width ?? 700,
      height: options.height ?? 320,
      padding: { top: 20, right: 20, bottom: 36, left: 70, ...(options.padding || {}) },
      xLabel: options.xLabel ?? '',
      yLabel: options.yLabel ?? '',
      yFormat: options.yFormat ?? ((v) => formatNumber(v)),
      xFormat: options.xFormat ?? ((v) => String(v)),
      showGrid: options.showGrid ?? true,
      showLegend: options.showLegend ?? true,
      stacked: options.stacked ?? false,
      background: options.background ?? null,
      yMin: options.yMin ?? null,
      yMax: options.yMax ?? null,
    };
    this.series = [];
    this.svg = null;
  }

  addSeries(s) {
    this.series.push({
      name: s.name ?? 'Serie',
      color: s.color ?? SERIES_PALETTE[(this.series.length) % SERIES_PALETTE.length],
      data: s.data ?? [],
      area: !!s.area,
      dashed: !!s.dashed,
      points: s.points ?? false,
    });
    return this;
  }

  clear() {
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
    this.svg = null;
    return this;
  }

  computeBounds() {
    if (this.series.length === 0) return null;
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const s of this.series) {
      for (const p of s.data) {
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (this.options.yMin !== null) yMin = Math.min(yMin, this.options.yMin);
    if (this.options.yMax !== null) yMax = Math.max(yMax, this.options.yMax);
    // Margen para legibilidad.
    if (yMin > 0 && yMax > 0) yMin = 0;
    return { xMin, xMax, yMin, yMax };
  }

  buildScales(bounds) {
    const { padding, width, height } = this.options;
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const xSpan = bounds.xMax - bounds.xMin || 1;
    const ySpan = bounds.yMax - bounds.yMin || 1;
    return {
      innerW,
      innerH,
      x: (v) => padding.left + ((v - bounds.xMin) / xSpan) * innerW,
      y: (v) => padding.top + innerH - ((v - bounds.yMin) / ySpan) * innerH,
      bounds,
    };
  }

  buildAxes(svg, scales) {
    const { padding, yFormat, xFormat, showGrid, width, height } = this.options;
    const yTicks = niceTicks(scales.bounds.yMin, scales.bounds.yMax, 5);
    const xTicks = niceTicks(scales.bounds.xMin, scales.bounds.xMax, 6);

    // Grid lines horizontales + etiquetas Y.
    if (showGrid) {
      for (const t of yTicks) {
        const y = scales.y(t);
        svg.appendChild(el('line', {
          x1: padding.left, x2: width - padding.right, y1: y, y2: y,
          stroke: COLORS.border, 'stroke-width': 1, 'stroke-dasharray': '2,4', opacity: 0.5,
        }));
      }
    }
    for (const t of yTicks) {
      const y = scales.y(t);
      svg.appendChild(el('text', {
        x: padding.left - 8, y: y + 4,
        'text-anchor': 'end',
        fill: COLORS.muted, 'font-size': 11,
      }, [yFormat(t)]));
    }

    // Ejes X.
    const baseY = padding.top + (height - padding.top - padding.bottom);
    svg.appendChild(el('line', {
      x1: padding.left, x2: width - padding.right, y1: baseY, y2: baseY,
      stroke: COLORS.border, 'stroke-width': 1,
    }));
    for (const t of xTicks) {
      const x = scales.x(t);
      svg.appendChild(el('text', {
        x, y: baseY + 18, 'text-anchor': 'middle',
        fill: COLORS.muted, 'font-size': 11,
      }, [xFormat(t)]));
    }

    // Labels de ejes.
    if (this.options.yLabel) {
      const g = el('g', { transform: `translate(14, ${height / 2}) rotate(-90)` }, [
        el('text', { 'text-anchor': 'middle', fill: COLORS.text, 'font-size': 12 }, [this.options.yLabel]),
      ]);
      svg.appendChild(g);
    }
    if (this.options.xLabel) {
      svg.appendChild(el('text', {
        x: width / 2, y: height - 6,
        'text-anchor': 'middle',
        fill: COLORS.text, 'font-size': 12,
      }, [this.options.xLabel]));
    }
  }

  buildLegend(svg) {
    if (!this.options.showLegend || this.series.length === 0) return;
    const { width, padding } = this.options;
    let lx = padding.left;
    const ly = padding.top - 12;
    for (const s of this.series) {
      const itemW = 8 + 8 + s.name.length * 7 + 14;
      svg.appendChild(el('rect', {
        x: lx, y: ly - 8, width: 10, height: 10, fill: s.color, rx: 2,
      }));
      svg.appendChild(el('text', {
        x: lx + 14, y: ly, fill: COLORS.text, 'font-size': 11,
      }, [s.name]));
      lx += itemW;
    }
  }

  render() {
    this.clear();
    const { width, height, background } = this.options;
    const svg = el('svg', {
      width, height, viewBox: `0 0 ${width} ${height}`,
      xmlns: 'http://www.w3.org/2000/svg',
      role: 'img',
    });
    if (background) {
      svg.appendChild(el('rect', { width, height, fill: background }));
    }

    const bounds = this.computeBounds();
    if (!bounds || this.series.every(s => s.data.length === 0)) {
      svg.appendChild(el('text', {
        x: width / 2, y: height / 2,
        'text-anchor': 'middle', fill: COLORS.muted, 'font-size': 14,
      }, ['Sin datos']));
      this.container.appendChild(svg);
      this.svg = svg;
      return this;
    }

    const scales = this.buildScales(bounds);
    this.buildAxes(svg, scales);
    this.buildLegend(svg);
    this.renderSeries(svg, scales);

    this.container.appendChild(svg);
    this.svg = svg;
    return this;
  }
}

export class LineChart extends BaseChart {
  renderSeries(svg, scales) {
    for (const s of this.series) {
      if (s.data.length === 0) continue;
      const d = s.data.map((p, i) =>
        (i === 0 ? 'M' : 'L') + scales.x(p.x).toFixed(2) + ' ' + scales.y(p.y).toFixed(2)
      ).join(' ');

      // Area rellena (opcional, hasta y=0).
      if (s.area) {
        const baseY = scales.y(Math.max(0, scales.bounds.yMin));
        const last = s.data[s.data.length - 1];
        const first = s.data[0];
        const areaD = d
          + ` L ${scales.x(last.x).toFixed(2)} ${baseY.toFixed(2)}`
          + ` L ${scales.x(first.x).toFixed(2)} ${baseY.toFixed(2)} Z`;
        svg.appendChild(el('path', {
          d: areaD,
          fill: s.color, 'fill-opacity': 0.18, stroke: 'none',
        }));
      }

      svg.appendChild(el('path', {
        d,
        fill: 'none', stroke: s.color, 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'stroke-dasharray': s.dashed ? '5,4' : null,
      }));

      if (s.points) {
        for (const p of s.data) {
          svg.appendChild(el('circle', {
            cx: scales.x(p.x), cy: scales.y(p.y), r: 3,
            fill: s.color, stroke: COLORS.bg, 'stroke-width': 1,
          }));
        }
      }
    }
  }
}

export class BarChart extends BaseChart {
  renderSeries(svg, scales) {
    const seriesCount = this.series.length;
    const groupWidth = scales.innerW / Math.max(1, this.maxLen());
    const barW = seriesCount > 1 ? groupWidth / (seriesCount + 1) : groupWidth * 0.7;
    const allX = [];
    for (const s of this.series) for (const p of s.data) if (!allX.includes(p.x)) allX.push(p.x);
    allX.sort((a, b) => a - b);

    for (let si = 0; si < this.series.length; si++) {
      const s = this.series[si];
      const xs = new Map(s.data.map(p => [p.x, p.y]));
      for (let i = 0; i < allX.length; i++) {
        const xv = allX[i];
        const yv = xs.get(xv);
        if (yv === undefined) continue;
        const xCenter = scales.x(xv);
        const offset = (si - (seriesCount - 1) / 2) * (barW + 1);
        const x = xCenter + offset - barW / 2;
        const yTop = scales.y(yv);
        const yBase = scales.y(Math.max(0, scales.bounds.yMin));
        const h = Math.max(0, yBase - yTop);
        svg.appendChild(el('rect', {
          x: x.toFixed(2), y: yTop.toFixed(2),
          width: barW.toFixed(2), height: h.toFixed(2),
          fill: s.color, rx: 2,
        }));
      }
    }
  }

  maxLen() {
    let m = 0;
    for (const s of this.series) m = Math.max(m, s.data.length);
    return m;
  }
}

// Helper: detecta el rango X comun a todas las series y rellena huecos.
function alignSeriesData(series) {
  const allX = new Set();
  for (const s of series) for (const p of s.data) allX.add(p.x);
  const xs = [...allX].sort((a, b) => a - b);
  return series.map(s => {
    const map = new Map(s.data.map(p => [p.x, p.y]));
    return xs.map(x => ({ x, y: map.get(x) ?? null }));
  });
}

export const __test__ = { formatNumber, niceTicks, alignSeriesData, COLORS, SERIES_PALETTE };

export function createLineChart(container, options) {
  return new LineChart(container, options);
}

export function createBarChart(container, options) {
  return new BarChart(container, options);
}
