import data from './data/masterplan.json';
import { CONFIG, VILLAS, LOT_SIZES } from './config.js';

// ---------- util ----------
const safeGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// Pseudo-aleatorio determinístico: la simulación de disponibilidad es estable entre visitas.
function hash(n) { let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

export const STATUS = {
  disponible: { label: 'Disponible', color: '#2f9e6e' },
  reservado: { label: 'Reservado', color: '#e0a235' },
  vendido: { label: 'Vendido', color: '#b0503f' },
};

function simulatedStatus(n, etapa) {
  const r = hash(n);
  if (etapa === 1) return r < 0.42 ? 'vendido' : r < 0.56 ? 'reservado' : 'disponible';
  return r < 0.28 ? 'vendido' : r < 0.40 ? 'reservado' : 'disponible';
}

export function sizeClass(l) { return LOT_SIZES.find(s => s.t === l.t) || LOT_SIZES[0]; }

// Precios de referencia (MM COP) construidos a partir de los "desde" del brochure.
function priceFor(l) {
  if (l.etapa === 1) {
    const v = VILLAS[l.t];
    return Math.round(v.priceFrom + Math.max(0, l.a - v.minLot) * 1.1);
  }
  const s = sizeClass(l);
  const base = s.from + Math.max(0, l.a - s.min) * 0.6;
  return Math.round(base * (l.w ? 1.08 : 1));
}

const overrides = safeGet('cv-status-overrides', {});

export const lots = data.lots.map(l => {
  const etapa = l.n <= 60 ? 1 : 2;
  const pts = [];
  for (let i = 0; i < l.p.length; i += 2) pts.push([l.p[i], l.p[i + 1]]);
  // centroide del polígono
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0; A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  A /= 2; cx /= (6 * A); cy /= (6 * A);
  // eje principal (PCA) para orientar la villa en 3D
  let sxx = 0, syy = 0, sxy = 0;
  pts.forEach(([x, y]) => { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); });
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const lot = {
    n: l.n, id: String(l.n).padStart(2, '0'), t: l.t, a: l.a, w: !!l.w, etapa,
    kind: etapa === 1 ? 'villa' : 'lote', pts, cx, cy, mx: l.cx, my: l.cy, angle,
  };
  lot.status = overrides[l.n] || simulatedStatus(l.n, etapa);
  lot.price = priceFor(lot);
  return lot;
});

export const byNum = n => lots.find(l => l.n === Number(n));
export const MAP = { w: data.w, h: data.h, pxPerM: data.pxPerM, trees: data.trees, amen: data.amen };

// ---------- eventos ----------
const listeners = {};
export const on = (ev, fn) => ((listeners[ev] ||= []).push(fn));
export const emit = (ev, p) => (listeners[ev] || []).forEach(fn => fn(p));

// ---------- moneda ----------
export const state = {
  currency: safeGet('cv-currency', 'COP'),
  favs: new Set(safeGet('cv-favs', [])),
  filters: { etapa: 'all', types: new Set(), status: new Set(['disponible', 'reservado', 'vendido']), water: false, maxPrice: null, sizeId: null },
  admin: new URLSearchParams(location.search).has('asesor'),
};

export function setCurrency(c) { state.currency = c; safeSet('cv-currency', c); emit('currency', c); }

// mm = millones de COP
export function money(mm, opts = {}) {
  const c = opts.currency || state.currency;
  if (c === 'COP') return `$${Math.round(mm).toLocaleString('es-CO')} MM`;
  const usd = (mm * 1e6) / CONFIG.trm;
  const val = c === 'EUR' ? usd * CONFIG.eur : usd;
  const sym = c === 'EUR' ? '€' : 'USD ';
  if (val >= 1e6) return `${sym}${(val / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 2 })} M`;
  return `${sym}${Math.round(val / 1000).toLocaleString('es-CO')} K`;
}
export function moneyAlt(mm) {
  // equivalente secundario
  if (state.currency === 'COP') return '≈ ' + money(mm, { currency: 'USD' });
  return '≈ ' + money(mm, { currency: 'COP', full: true }) + ' COP';
}

// ---------- favoritos ----------
export function toggleFav(n) {
  state.favs.has(n) ? state.favs.delete(n) : state.favs.add(n);
  safeSet('cv-favs', [...state.favs]);
  emit('favs', state.favs);
}

// ---------- modo asesor (?asesor) ----------
export function cycleStatus(n) {
  const l = byNum(n); const order = ['disponible', 'reservado', 'vendido'];
  l.status = order[(order.indexOf(l.status) + 1) % 3];
  overrides[n] = l.status; safeSet('cv-status-overrides', overrides);
  emit('status', l);
}
export function exportStatuses() {
  return JSON.stringify(Object.fromEntries(lots.map(l => [l.n, l.status])), null, 1);
}

// ---------- filtros ----------
export function matches(l) {
  const f = state.filters;
  if (f.etapa !== 'all' && String(l.etapa) !== f.etapa) return false;
  if (f.types.size && !f.types.has(l.t)) return false;
  if (!f.status.has(l.status)) return false;
  if (f.water && !l.w) return false;
  if (f.maxPrice && l.price > f.maxPrice) return false;
  if (f.sizeId && !(l.etapa === 2 && sizeClass(l).id === f.sizeId)) return false;
  return true;
}
export function counts() {
  const c = { disponible: 0, reservado: 0, vendido: 0 };
  lots.forEach(l => c[l.status]++);
  return c;
}
