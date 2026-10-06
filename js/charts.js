/**
 * js/charts.js — tiny dependency-free SVG chart helpers.
 * Everything animates in, respects prefers-reduced-motion, and is responsive
 * via viewBox + preserveAspectRatio.
 */

const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- bar chart */
/**
 * @param {Array<{label:string, value:number, display?:string}>} data
 * @param {{max?:number, unit?:string, height?:number}} opts
 */
export function barChart(data, opts = {}) {
  const max = opts.max || Math.max(1, ...data.map((d) => d.value));
  const cells = data
    .map((d, i) => {
      const h = max ? Math.max(2, (d.value / max) * 100) : 0;
      const disp = d.display ?? String(d.value);
      return `<div class="cb">
        <div class="val">${esc(disp)}</div>
        <div class="fillbar${d.value ? '' : ' zero'}" data-h="${h.toFixed(1)}" title="${esc(d.label)}: ${esc(disp)}"></div>
        <div class="lbl">${esc(d.label)}</div>
      </div>`;
    })
    .join('');
  return `<div class="chart"><div class="chart-bars" style="height:${opts.height || 170}px">${cells}</div></div>`;
}

export function animateCharts(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('.fillbar[data-h]').forEach((el, i) => {
      setTimeout(() => { el.style.height = `${el.dataset.h}%`; }, i * 40);
    });
  });
}

/* ------------------------------------------------------------ line chart */
/**
 * @param {Array<number>} values
 * @param {{labels?:string[], height?:number, unit?:string, area?:boolean}} opts
 */
export function lineChart(values, opts = {}) {
  const H = opts.height || 190;
  const W = 640;
  const pad = { t: 14, r: 12, b: 26, l: 34 };
  const vals = values.length ? values : [0, 0];
  const max = Math.max(1, ...vals);
  const n = vals.length;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;

  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const path = pts.length ? `M${pts.join('L')}` : '';
  const area = path ? `${path}L${x(n - 1).toFixed(1)},${(pad.t + ih).toFixed(1)}L${x(0).toFixed(1)},${(pad.t + ih).toFixed(1)}Z` : '';

  const gridLines = [0, 0.5, 1]
    .map((f) => {
      const gy = pad.t + ih * f;
      return `<line class="grid" x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${W - pad.r}" y2="${gy.toFixed(1)}"/>
              <text class="lbl" x="${pad.l - 6}" y="${(gy + 3).toFixed(1)}" text-anchor="end">${Math.round(max * (1 - f))}</text>`;
    })
    .join('');

  const xLabels = (opts.labels || [])
    .map((l, i) => {
      const every = Math.ceil(n / 10);
      if (i % every !== 0 && i !== n - 1) return '';
      return `<text class="lbl" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`;
    })
    .join('');

  const dots = opts.showDots === false ? '' :
    vals.map((v, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"><title>${esc(String(v))}</title></circle>`).join('');

  return `<svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="${esc(opts.aria || 'Line chart')}">
    <defs><linearGradient id="areaOrange" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,122,0,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,122,0,0)"/>
    </linearGradient></defs>
    ${gridLines}
    ${area ? `<path class="area" d="${area}"/>` : ''}
    <path class="line" d="${path}"/>
    ${dots}
    ${xLabels}
  </svg>`;
}

/* --------------------------------------------------------------- donut  */
export function donut(segments, { size = 160, thickness = 18, centerTop = '', centerSub = '' } = {}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / total) * c;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}"
        stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"
        stroke-linecap="butt"><title>${esc(s.label)}: ${s.value}</title></circle>`;
      offset += len;
      return el;
    })
    .join('');

  return `<div class="donut" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>
      ${arcs}
    </svg>
    <div class="donut-center">
      <b>${esc(centerTop)}</b>
      <span>${esc(centerSub)}</span>
    </div>
  </div>`;
}

export function legend(segments) {
  return `<div class="chart-legend">${segments
    .map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)} <b>${s.value}</b></span>`)
    .join('')}</div>`;
}

/* ------------------------------------------------------ activity heatmap */
/**
 * GitHub-style contribution grid of daily minutes for the last `weeks` weeks.
 */
export function heatmap(days, { cell = 13, gap = 3 } = {}) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const cols = Math.ceil(days.length / 7);
  const w = cols * (cell + gap);
  const h = 7 * (cell + gap);
  const level = (m) => (m <= 0 ? 0 : m < max * 0.25 ? 1 : m < max * 0.5 ? 2 : m < max * 0.75 ? 3 : 4);
  const colors = ['var(--surface-2)', 'rgba(255,122,0,0.28)', 'rgba(255,122,0,0.48)', 'rgba(255,122,0,0.72)', '#ff7a00'];

  const rects = days
    .map((d, i) => {
      const col = Math.floor(i / 7);
      const row = i % 7;
      return `<rect x="${col * (cell + gap)}" y="${row * (cell + gap)}" width="${cell}" height="${cell}" rx="3"
        fill="${colors[level(d.minutes)]}"><title>${d.label}: ${d.minutes} min</title></rect>`;
    })
    .join('');

  return `<div class="heatmap-wrap"><svg class="heatmap" viewBox="0 0 ${w} ${h}" width="${Math.min(w, 340)}" role="img"
    aria-label="Daily study activity">${rects}</svg></div>`;
}

/* ------------------------------------------------------------ sparkline */
export function sparkline(values, { height = 44 } = {}) {
  const max = Math.max(1, ...values);
  return `<div class="spark" style="height:${height}px">${values
    .map((v) => `<i style="height:${Math.max(3, (v / max) * 100)}%;opacity:${v ? 0.9 : 0.25}"></i>`)
    .join('')}</div>`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export { prefersReduced };
