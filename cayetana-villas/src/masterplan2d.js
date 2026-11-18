// Plano 2D interactivo: polígonos reales de los 190 lotes sobre el mapa del brochure, con pan/zoom táctil.
import { lots, MAP, STATUS, matches } from './store.js';
import { AMENITIES } from './config.js';

const NS = 'http://www.w3.org/2000/svg';

export function createMasterplan2D(root, { onSelect, onHover, money }) {
  root.innerHTML = `
    <div class="mp2d-stage">
      <div class="mp2d-world">
        <img class="mp2d-img" src="img/lot-map-1800.webp" alt="Plano general de lotes de Cayetana" draggable="false" />
        <svg class="mp2d-svg" viewBox="0 0 ${MAP.w} ${MAP.h}" preserveAspectRatio="none"></svg>
      </div>
    </div>
    <div class="mp2d-zoom">
      <button data-z="in" aria-label="Acercar">+</button>
      <button data-z="out" aria-label="Alejar">−</button>
      <button data-z="reset" aria-label="Restablecer vista">⤾</button>
    </div>
    <div class="mp-tip" role="tooltip"></div>`;
  const stage = root.querySelector('.mp2d-stage');
  const world = root.querySelector('.mp2d-world');
  const svg = root.querySelector('svg');
  const img = root.querySelector('.mp2d-img');
  const tip = root.querySelector('.mp-tip');

  // patrón rayado para lotes vendidos
  svg.innerHTML = `<defs>
    <pattern id="hatch" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="22" height="22" fill="${STATUS.vendido.color}" fill-opacity=".55"/>
      <line x1="0" y1="0" x2="0" y2="22" stroke="#fff" stroke-opacity=".45" stroke-width="7"/>
    </pattern></defs>`;
  const gLots = document.createElementNS(NS, 'g'); svg.appendChild(gLots);
  const gAmen = document.createElementNS(NS, 'g'); svg.appendChild(gAmen);

  lots.forEach(l => {
    const p = document.createElementNS(NS, 'polygon');
    p.setAttribute('points', l.pts.map(q => q.join(',')).join(' '));
    p.classList.add('lot');
    p.dataset.n = l.n;
    p.setAttribute('tabindex', '0');
    p.setAttribute('role', 'button');
    p.setAttribute('aria-label', `${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id}, ${l.t}, ${l.a} metros cuadrados, ${STATUS[l.status].label}`);
    l._poly = p; gLots.appendChild(p);
  });
  MAP.amen.forEach(([n, x, y]) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 34);
    c.classList.add('amen'); c.dataset.a = n; gAmen.appendChild(c);
  });

  function paint(l) {
    const p = l._poly, ok = matches(l);
    p.style.fill = !ok ? 'transparent' : l.status === 'vendido' ? 'url(#hatch)' : STATUS[l.status].color;
    p.classList.toggle('dim', !ok);
    p.classList.toggle('st-disponible', l.status === 'disponible');
  }
  function refresh() { lots.forEach(paint); }
  refresh();

  // --- pan / zoom ---
  let z = 1, tx = 0, ty = 0;
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const s = Math.min(r.width / MAP.w, r.height / MAP.h);
    world.style.width = MAP.w * s + 'px'; world.style.height = MAP.h * s + 'px';
    return { r, s };
  };
  let base = fit();
  function clamp() {
    const r = stage.getBoundingClientRect();
    const ww = world.offsetWidth * z, wh = world.offsetHeight * z, m = 60;
    tx = ww <= r.width ? (r.width - ww) / 2 : Math.min(m, Math.max(r.width - ww - m, tx));
    ty = wh <= r.height ? (r.height - wh) / 2 : Math.min(m, Math.max(r.height - wh - m, ty));
  }
  function apply(anim) {
    clamp();
    world.style.transition = anim ? 'transform .6s cubic-bezier(.2,.8,.2,1)' : 'none';
    world.style.transform = `translate(${tx}px,${ty}px) scale(${z})`;
    if (z > 1.8 && !img.dataset.hi) { img.dataset.hi = 1; img.src = 'img/lot-map.webp'; }
    root.style.setProperty('--z', z);
  }
  function reset(anim = true) {
    base = fit(); z = 1;
    tx = (base.r.width - world.offsetWidth) / 2; ty = (base.r.height - world.offsetHeight) / 2; apply(anim);
  }
  function zoomAt(f, px, py, anim) {
    const nz = Math.min(6, Math.max(1, z * f));
    const k = nz / z; tx = px - (px - tx) * k; ty = py - (py - ty) * k; z = nz; apply(anim);
  }
  new ResizeObserver(() => reset(false)).observe(stage);
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const ptrs = new Map(); let pinch = null, moved = 0, last = null;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY];
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z }; }
  });
  stage.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return hover(e);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = stage.getBoundingClientRect();
      zoomAt((pinch.z * d / pinch.d) / z, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      moved += 10; return;
    }
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) { tx += dx; ty += dy; apply(false); stage.classList.add('dragging'); hideTip(); }
  });
  const end = e => {
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    stage.classList.remove('dragging');
    if (e.type === 'pointerup' && moved <= 4) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el?.classList.contains('lot')) onSelect?.(lots.find(l => l.n === +el.dataset.n));
      else if (el?.classList.contains('amen')) showAmen(el, e);
    }
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', hideTip);
  root.querySelector('.mp2d-zoom').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const r = stage.getBoundingClientRect();
    if (b.dataset.z === 'reset') reset(); else zoomAt(b.dataset.z === 'in' ? 1.6 : 1 / 1.6, r.width / 2, r.height / 2, true);
  });
  svg.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('lot')) { e.preventDefault(); onSelect?.(lots.find(l => l.n === +e.target.dataset.n)); }
  });

  // --- tooltip ---
  let hov = null;
  function hover(e) {
    const el = e.target;
    if (el.classList?.contains('lot')) {
      const l = lots.find(q => q.n === +el.dataset.n);
      if (hov !== l) { hov?._poly.classList.remove('hover'); hov = l; el.classList.add('hover'); onHover?.(l); }
      tip.innerHTML = `<b>${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id}</b><span>${l.t} · ${l.a} m²${l.w ? ' · Frente al agua' : ''}</span>
        <strong>${l.status === 'vendido' ? '—' : 'Desde ' + money(l.price)}</strong><i style="--c:${STATUS[l.status].color}">${STATUS[l.status].label}</i>`;
      placeTip(e);
    } else if (el.classList?.contains('amen')) {
      showAmen(el, e);
    } else hideTip();
  }
  function showAmen(el, e) {
    const a = AMENITIES[el.dataset.a];
    tip.innerHTML = `<b>${el.dataset.a} · ${a.name}</b><span>${a.text}</span>`; placeTip(e);
  }
  function placeTip(e) {
    const r = root.getBoundingClientRect();
    let x = e.clientX - r.left + 16, y = e.clientY - r.top + 16;
    tip.classList.add('show');
    if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 16;
    if (y + tip.offsetHeight > r.height - 8) y = e.clientY - r.top - tip.offsetHeight - 16;
    tip.style.transform = `translate(${x}px,${y}px)`;
  }
  function hideTip() { tip.classList.remove('show'); hov?._poly.classList.remove('hover'); hov = null; }

  function focus(l) {
    lots.forEach(q => q._poly.classList.toggle('selected', q === l));
    const r = stage.getBoundingClientRect();
    const s = world.offsetWidth / MAP.w;
    z = 3; tx = r.width / 2 - l.cx * s * z; ty = r.height / 2 - l.cy * s * z;
    apply(true);
  }
  function clearSelection() { lots.forEach(q => q._poly.classList.remove('selected')); }

  return { refresh, focus, reset, clearSelection, paint };
}
