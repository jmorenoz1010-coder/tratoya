import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { hydrateIcons, icon } from './icons.js';
import { CONFIG, VILLAS, LOT_TYPES, LOT_SIZES } from './config.js';
import { lots, byNum, STATUS, state, on, money, moneyAlt, setCurrency, toggleFav, matches, counts, sizeClass, cycleStatus, exportStatuses, MAP } from './store.js';
import { createMasterplan2D } from './masterplan2d.js';
import { initSimulator } from './simulator.js';
import { initConcierge } from './concierge.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

hydrateIcons();

// ---------- toast ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

// ---------- scroll suave ----------
const lenis = reduced ? null : new Lenis({ duration: 1.15, smoothWheel: true });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function goTo(target) {
  const el = typeof target === 'string' ? $(target) : target; if (!el) return;
  lenis ? lenis.scrollTo(el, { offset: -60, duration: 1.6 }) : el.scrollIntoView({ behavior: 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const t = $(a.getAttribute('href')); if (!t) return;
  e.preventDefault(); closeMenu(); goTo(t);
});
// el panel y el concierge necesitan scroll nativo
['.ld-body', '.fav-body', '.cg-log', '#viewList', '.mobile-menu'].forEach(s => $(s)?.setAttribute('data-lenis-prevent', ''));

// ---------- loader + intro ----------
function splitWords(el) {
  if (el.dataset.split) return; el.dataset.split = 1;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          const o = document.createElement('span'); o.className = 'w';
          const i = document.createElement('span'); i.textContent = w; o.appendChild(i); frag.appendChild(o);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
}
$$('.split').forEach(splitWords);

const loader = $('#loader'), bar = $('.loader-bar span');
let prog = 0;
const progT = setInterval(() => { prog = Math.min(90, prog + Math.random() * 18); bar.style.width = prog + '%'; }, 180);
const heroImg = $('.hero-media img');
Promise.race([
  Promise.all([heroImg.decode?.().catch(() => {}) ?? Promise.resolve(), document.fonts?.ready]),
  new Promise(r => setTimeout(r, 3500)),
]).then(() => {
  clearInterval(progT); bar.style.width = '100%';
  setTimeout(() => {
    loader.classList.add('done');
    const tl = gsap.timeline();
    tl.to('.hero-title .w > span', { y: 0, duration: 1.3, stagger: 0.08, ease: 'expo.out' })
      .from('.hero .eyebrow, .hero-sub, .hero-ctas, .hero-live', { opacity: 0, y: 30, duration: 1, stagger: 0.1, ease: 'power3.out' }, '-=0.9')
      .from('.hero-stats > div', { opacity: 0, y: 40, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, '-=0.8')
      .from('.nav', { y: -80, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=1');
    $$('.hero-stats [data-count]').forEach(countUp);
  }, 350);
});

// ---------- animaciones de scroll ----------
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
  const o = { v: 0 };
  gsap.to(o, { v: to, duration: 2, ease: 'power2.out', onUpdate: () => (el.textContent = o.v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })) });
}
if (!reduced) {
  $$('.reveal').forEach(el => gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
  $$('.split').filter(el => !el.closest('.hero')).forEach(el => gsap.to($$('.w > span', el), { y: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
  $$('.reveal-img').forEach(el => gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 80%' } }));
  $$('.bg-parallax img, .concept-media img, .water-band > img, .villa-hero > img').forEach(img => gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  gsap.to('.hero-media', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  $$('.cards6 .card-i, .amen-icons > div, .partners article, .why-grid article, .flow4 article, .steps7 li').forEach((el, i) =>
    gsap.from(el, { opacity: 0, y: 50, duration: 1, delay: (i % 4) * 0.08, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%' } }));
} else {
  $$('.reveal').forEach(el => (el.style.opacity = 1));
}
$$('[data-count]').filter(el => !el.closest('.hero')).forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => countUp(el) }));
$$('.ring, .timeline').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('in') }));

// scroll horizontal "Un día en Cayetana"
ScrollTrigger.matchMedia({
  '(min-width: 801px)': () => {
    const track = $('.hscroll-track');
    const dist = () => track.scrollWidth - innerWidth + $('.hscroll-intro').offsetWidth * 0;
    gsap.to(track, { x: () => -(track.scrollWidth - (innerWidth - $('.hscroll-intro').offsetWidth)), ease: 'none',
      scrollTrigger: { trigger: '.hscroll', pin: '.hscroll-pin', start: 'top top', end: () => '+=' + dist(), scrub: 1, invalidateOnRefresh: true } });
  },
});

// ---------- navegación ----------
const nav = $('#nav');
let lastY = 0;
function onScroll(y) {
  nav.classList.toggle('scrolled', y > 60);
  nav.classList.toggle('hide', y > lastY && y > 700 && !$('.mobile-menu.open'));
  lastY = y;
}
lenis ? lenis.on('scroll', e => onScroll(e.scroll)) : addEventListener('scroll', () => onScroll(scrollY), { passive: true });
$$('.nav-links a').forEach(a => {
  const sec = $(a.getAttribute('href'));
  sec && ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: s => s.isActive && ($$('.nav-links a').forEach(x => x.classList.remove('active')), a.classList.add('active')) });
});
const burger = $('#burger'), menu = $('#mobileMenu');
function closeMenu() { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('lock'); }
burger.addEventListener('click', () => {
  const o = !menu.classList.contains('open');
  menu.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); document.body.classList.toggle('lock', o);
});

// ---------- cursor, magnéticos y tilt ----------
if (fine && !reduced) {
  const cur = $('.cursor');
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener('pointerover', e => cur.classList.toggle('big', !!e.target.closest('a, button, .pillar, .tipo, .hscroll figure, .lot')));
  $$('.magnetic').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4 }); });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,.4)' }));
  });
  $$('.tilt').forEach(f => {
    f.addEventListener('pointermove', e => { const r = f.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; f.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`; });
    f.addEventListener('pointerleave', () => (f.style.transform = ''));
  });
}

// ---------- moneda ----------
const curSeg = $('#currency');
function paintMoney() {
  $$('#currency button').forEach(b => b.classList.toggle('on', b.dataset.c === state.currency));
  $$('[data-money]').forEach(el => (el.textContent = money(+el.dataset.money)));
  $$('[data-money-alt]').forEach(el => (el.textContent = moneyAlt(+el.dataset.moneyAlt)));
}
curSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCurrency(b.dataset.c); });
on('currency', () => { paintMoney(); renderTipos(); renderSizes(); refreshMaps(); renderList(); if (current) renderLot(current); renderFavs(); });

// ---------- sonido ambiente (olas sintetizadas con WebAudio) ----------
let audio = null;
$('#soundBtn').addEventListener('click', () => {
  const btn = $('#soundBtn');
  if (!audio) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const gain = ctx.createGain(); gain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
    lfo.connect(lfoG).connect(gain.gain);
    const master = ctx.createGain(); master.gain.value = 0;
    src.connect(lp).connect(gain).connect(master).connect(ctx.destination);
    const base = ctx.createConstantSource ? ctx.createConstantSource() : null;
    if (base) { base.offset.value = 0.22; base.connect(gain.gain); base.start(); }
    src.start(); lfo.start();
    audio = { ctx, master, on: false };
  }
  audio.on = !audio.on; audio.ctx.resume();
  audio.master.gain.setTargetAtTime(audio.on ? 0.5 : 0, audio.ctx.currentTime, 0.6);
  btn.innerHTML = icon(audio.on ? 'sound' : 'mute');
  toast(audio.on ? 'Sonido del mar activado 🌊' : 'Sonido desactivado');
});

// ---------- ubicación ----------
$('#mapsLink').href = CONFIG.mapsUrl;
$('.route-switch').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('.route-switch button').forEach(x => x.classList.toggle('on', x === b));
  $$('.ubi-times > div').forEach(d => d.classList.toggle('on', d.dataset.r === b.dataset.route));
  $('#routeCar').classList.toggle('on', b.dataset.route === 'car');
  $('#routeBoat').classList.toggle('on', b.dataset.route === 'boat');
  $$('.ubi-times > div.on [data-count]').forEach(el => { el.dataset.done = ''; countUp(el); });
});

// ---------- pilares ----------
$$('.pillar').forEach(p => {
  const act = () => $$('.pillar').forEach(x => x.classList.toggle('on', x === p));
  p.addEventListener('mouseenter', act); p.addEventListener('click', act);
});

// ---------- comparador antes/después ----------
const ba = $('#beforeAfter');
ba.querySelector('input').addEventListener('input', e => ba.style.setProperty('--x', e.target.value + '%'));

// ---------- tipologías ----------
const availBy = t => lots.filter(l => l.t === t && l.status === 'disponible').length;
function renderTipos() {
  $('#tipoCards').innerHTML = ['Savina', 'Eivissa', 'Macarella'].map(k => {
    const v = VILLAS[k];
    return `<article class="tipo">
      <div class="tipo-img"><img src="${v.img}" alt="Villa ${k}" loading="lazy" /><span class="badge">${v.count} villas</span><span class="badge av">${availBy(k)} disponibles</span></div>
      <div class="tipo-b">
        <h3>${k}</h3><span class="m2">${v.built} m² + ${v.outdoor} m²</span>
        <ul>${v.features.map(f => `<li>${f}</li>`).join('')}</ul>
        <div class="tipo-meta"><span>${icon('bed')} ${v.rooms} hab.</span><span>${icon('bath')} ${v.baths} baños</span><span>${icon('layers')} ${v.floors}</span></div>
        <div class="price"><small>DESDE</small><b>${money(v.priceFrom)}</b><em>${moneyAlt(v.priceFrom)}</em></div>
        <div class="tipo-actions">
          <button class="btn btn-sm btn-ghost-d" data-studio="${k}">${icon('cube')} Ver en 3D</button>
          <button class="btn btn-sm btn-gold" data-filter="${k}">Ver disponibles</button>
        </div>
      </div></article>`;
  }).join('');
}
function renderSizes() {
  const c2 = lots.filter(l => l.etapa === 2);
  $('#sizeCards').innerHTML = LOT_SIZES.map((s, i) => {
    const list = c2.filter(l => sizeClass(l) === s);
    const av = list.filter(l => l.status === 'disponible').length;
    const lo = Math.min(...list.map(l => l.a)), hi = Math.max(...list.map(l => l.a));
    const left = ((lo - 250) / 730) * 100, width = Math.max(4, ((hi - lo) / 730) * 100);
    return `<article class="size ${i === 2 ? 'dark' : ''}">
      <small>${s.id}</small><h3>${s.name}</h3><span class="rng">${s.range} m² · ${s.t}</span>
      <div class="bar"><span style="left:${left}%;width:${width}%"></span></div>
      <div class="cnt">${list.length} <small>lotes</small></div><div class="avail">● ${av} disponibles hoy</div>
      <div class="price"><small>DESDE</small><b>${money(s.from)}</b><em>${moneyAlt(s.from)}</em></div>
      <button class="btn btn-sm ${i === 2 ? 'btn-gold' : 'btn-ghost-d'}" data-size="${s.id}">Ver en la maqueta</button></article>`;
  }).join('');
}
renderTipos(); renderSizes(); paintMoney();
document.addEventListener('click', e => {
  const f = e.target.closest('[data-filter]');
  if (f) { setFilter({ types: [f.dataset.filter], etapa: 'all' }); goTo('#maqueta'); }
  const s = e.target.closest('[data-size]');
  if (s) { state.filters.sizeId = s.dataset.size; setFilter({ etapa: '2', types: [] }); goTo('#maqueta'); }
  const st = e.target.closest('[data-studio]');
  if (st) { goTo('#estudio3d'); setTimeout(() => studioType(st.dataset.studio), 600); }
});

// ---------- MAQUETA: filtros ----------
const typeChips = $('#typeChips'), statusChips = $('#statusChips');
const TYPE_COL = { Eivissa: '#3e6a35', Macarella: '#80a65b', Savina: '#c8dca6', Aqua: '#f3edaf', Vista: '#e8d97a', Altezza: '#d3b94a' };
typeChips.innerHTML = Object.keys(TYPE_COL).map(t => `<button class="chip" data-t="${t}" style="--c:${TYPE_COL[t]}"><i></i>${t}</button>`).join('');
statusChips.innerHTML = Object.entries(STATUS).map(([k, v]) => `<button class="chip on" data-s="${k}" style="--c:${v.color}"><i></i>${v.label}</button>`).join('');

function setFilter({ types, etapa } = {}) {
  if (types) state.filters.types = new Set(types);
  if (etapa) state.filters.etapa = etapa;
  if (types && types.length) state.filters.sizeId = null;
  syncFilterUI(); refreshMaps(); renderList(); renderKpis();
}
function syncFilterUI() {
  $$('#typeChips .chip').forEach(c => c.classList.toggle('on', state.filters.types.has(c.dataset.t)));
  $$('#statusChips .chip').forEach(c => { const on_ = state.filters.status.has(c.dataset.s); c.classList.toggle('on', on_); c.classList.toggle('off', !on_); });
  $$('#etapaSeg button').forEach(b => b.classList.toggle('on', b.dataset.etapa === state.filters.etapa));
}
typeChips.addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  const s = state.filters.types; s.has(c.dataset.t) ? s.delete(c.dataset.t) : s.add(c.dataset.t);
  state.filters.sizeId = null; setFilter();
});
statusChips.addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  const s = state.filters.status; s.has(c.dataset.s) ? s.delete(c.dataset.s) : s.add(c.dataset.s);
  if (!s.size) s.add(c.dataset.s);
  setFilter();
});
$('#etapaSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.filters.sizeId = null; setFilter({ etapa: b.dataset.etapa }); } });
$('#waterOnly').addEventListener('change', e => { state.filters.water = e.target.checked; setFilter(); });
$('#maxPrice').addEventListener('input', e => {
  const v = +e.target.value; state.filters.maxPrice = v >= 4000 ? null : v;
  $('#maxPriceOut').textContent = state.filters.maxPrice ? money(v) : 'Todos'; setFilter();
});

function renderKpis() {
  const c = counts();
  const shown = lots.filter(matches).length;
  $('#mqKpis').innerHTML = `
    <div><b>${shown}</b><span>en vista</span></div>
    <div><b>${c.disponible}</b><span><i style="--c:${STATUS.disponible.color}"></i>Disponibles</span></div>
    <div><b>${c.reservado}</b><span><i style="--c:${STATUS.reservado.color}"></i>Reservados</span></div>
    <div><b>${c.vendido}</b><span><i style="--c:${STATUS.vendido.color}"></i>Vendidos</span></div>`;
  $('#liveAvail').textContent = c.disponible;
}

const mp2d = createMasterplan2D($('#view2d'), { onSelect: selectLot, money });
let mp3d = null;
function refreshMaps() { mp2d.refresh(); mp3d?.refresh(); }

function selectLot(l) {
  if (state.admin) { cycleStatus(l.n); return; }
  openLot(l);
}
on('status', l => { mp2d.paint(l); mp3d?.refresh(); renderKpis(); renderList(); renderTipos(); renderSizes(); });

// vistas
$('#viewSeg').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#viewSeg button').forEach(x => x.classList.toggle('on', x === b));
  const v = b.dataset.view;
  $('#view2d').classList.toggle('on', v === '2d');
  $('#view3d').classList.toggle('on', v === '3d');
  $('#viewList').classList.toggle('on', v === 'list');
  $('.mq-legend').style.display = v === 'list' ? 'none' : '';
  if (v === '3d' && !mp3d) {
    const { createMasterplan3D } = await import('./masterplan3d.js');
    mp3d = createMasterplan3D($('#mp3d'), { onSelect: selectLot });
  }
});
$('.mq-stage').classList.add('by-estado');
$('#colorSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#colorSeg button').forEach(x => x.classList.toggle('on', x === b));
  $('.mq-stage').classList.toggle('by-estado', b.dataset.c === 'estado');
  $('.mq-stage').classList.toggle('by-tipo', b.dataset.c === 'tipo');
});
$('#modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !mp3d) return; $$('#modeSeg button').forEach(x => x.classList.toggle('on', x === b)); mp3d.setMode(b.dataset.mode); });
$('#builtToggle').addEventListener('change', e => mp3d?.setBuilt(e.target.checked));
$('#reset3d').addEventListener('click', () => mp3d?.resetView());

// lista
let sortK = 'n', sortAsc = true;
function renderList() {
  const rows = lots.filter(matches).sort((a, b) => {
    const x = a[sortK], y = b[sortK]; return (x > y ? 1 : x < y ? -1 : 0) * (sortAsc ? 1 : -1);
  });
  $('#lotTable tbody').innerHTML = rows.map(l => `<tr>
    <td><b>${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id}</b></td><td>${l.etapa}</td><td>${l.t}</td><td>${l.a} m²</td><td>${l.w ? '✓' : ''}</td>
    <td>${l.status === 'vendido' ? '—' : money(l.price)}</td><td><span class="st" style="--c:${STATUS[l.status].color}">${STATUS[l.status].label}</span></td>
    <td><button data-open="${l.n}">Ver →</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">Sin resultados con estos filtros.</td></tr>';
  $$('#lotTable th').forEach(th => { th.classList.toggle('sorted', th.dataset.k === sortK); th.classList.toggle('asc', th.dataset.k === sortK && sortAsc); });
}
$('#lotTable thead').addEventListener('click', e => { const th = e.target.closest('th[data-k]'); if (!th) return; sortAsc = sortK === th.dataset.k ? !sortAsc : true; sortK = th.dataset.k; renderList(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openLot(byNum(b.dataset.open)); });

syncFilterUI(); renderKpis(); refreshMaps(); renderList();

// modo asesor
if (state.admin) {
  $('#adminBar').hidden = false;
  $('#adminExport').addEventListener('click', () => {
    const blob = new Blob([exportStatuses()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cayetana-disponibilidad.json'; a.click();
  });
}

// ---------- ESTUDIO 3D (configurador) ----------
let studio = null, studioMod = null;
const studioEl = $('#studio');
async function ensureStudio() {
  if (studio) return studio;
  studioMod = await import('./villa3d.js');
  studioEl.innerHTML = '';
  studio = studioMod.createVillaViewer(studioEl, { typology: 'Eivissa' });
  const sw = (id, kind, def) => {
    const box = $(id);
    box.innerHTML = Object.entries(studioMod.FINISHES[kind]).map(([n, c]) => `<button data-n="${n}" class="${n === def ? 'on' : ''}" style="--c:#${c.toString(16).padStart(6, '0')}"><i></i>${n}</button>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', box).forEach(x => x.classList.toggle('on', x === b)); studio.setFinish(kind, b.dataset.n); });
  };
  sw('#stFacade', 'facade', 'Estuco arena'); sw('#stWood', 'wood', 'Teca');
  return studio;
}
ScrollTrigger.create({ trigger: '#estudio3d', start: 'top 120%', once: true, onEnter: ensureStudio });
function renderSpec(t) {
  const v = VILLAS[t];
  $('#stSpec').innerHTML = `<div><b>${v.built}</b><span>m² construidos</span></div><div><b>${v.outdoor}</b><span>m² exteriores</span></div><div><b>${v.rooms}</b><span>habitaciones</span></div>`;
}
renderSpec('Eivissa');
async function studioType(t) {
  $$('#stType button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  renderSpec(t); (await ensureStudio()).setTypology(t);
}
$('#stType').addEventListener('click', e => { const b = e.target.closest('button'); if (b) studioType(b.dataset.t); });
const fmtH = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
$('#stHour').addEventListener('input', async e => { $('#stHourOut').textContent = fmtH(+e.target.value); (await ensureStudio()).setTime(+e.target.value); });
$('#stCams').addEventListener('click', async e => { const b = e.target.closest('button'); if (b) (await ensureStudio()).preset(b.dataset.p); });
$('#stInterior').addEventListener('click', async e => { const on_ = (await ensureStudio()).toggleInterior(); e.currentTarget.classList.toggle('on', on_); toast(on_ ? 'Vista interior: planta alta elevada' : 'Vista exterior'); });
$('#stShot').addEventListener('click', async () => {
  const url = (await ensureStudio()).snapshot(); const a = document.createElement('a'); a.href = url; a.download = 'mi-villa-cayetana.jpg'; a.click(); toast('Imagen descargada');
});

// ---------- PANEL DE LOTE ----------
const drawer = $('#lotDrawer');
let current = null, ldViewer = null, ldModel = null;
const imgsFor = l => l.etapa === 1
  ? [VILLAS[l.t].img, 'img/day-pool.webp', 'img/luz-natural.webp', 'img/day-rooftop.webp', 'img/acabados.webp']
  : ['img/lote-agua.webp', 'img/aerial-lake.webp', 'img/lake-beach.webp', 'img/aerial-canal.webp', 'img/lake-sunset.webp'];

function miniMap(l) {
  const pad = 300;
  const xs = l.pts.map(p => p[0]), ys = l.pts.map(p => p[1]);
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const near = lots.filter(q => q.cx > x0 && q.cx < x0 + w && q.cy > y0 && q.cy < y0 + h);
  return `<svg class="mini-map" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <image href="img/lot-map-1800.webp" x="0" y="0" width="${MAP.w}" height="${MAP.h}" opacity=".9"/>
    ${near.map(q => `<polygon class="${q === l ? 'me' : ''}" points="${q.pts.map(p => p.join(',')).join(' ')}" ${q === l ? '' : 'fill-opacity="0"'}/>`).join('')}</svg>`;
}

function renderLot(l) {
  const v = l.etapa === 1 ? VILLAS[l.t] : null;
  const st = STATUS[l.status];
  const fav = state.favs.has(l.n);
  $('#ldEyebrow').textContent = l.etapa === 1 ? `Etapa 1 · Cayetana Villas` : `Etapa 2 · Cayetana Lotes · ${LOT_TYPES[l.t].name}`;
  $('#ldTitle').textContent = `${l.etapa === 1 ? 'Villa ' + l.t : 'Lote ' + l.t} · ${l.id}`;
  $('#ldFav').classList.toggle('on', fav);
  const facts = l.etapa === 1 ? [
    ['ruler', `${l.a} m²`, 'Área de lote'], ['home', `${v.built} m²`, 'Construidos'], ['sun', `${v.outdoor} m²`, 'Terrazas y exteriores'],
    ['bed', v.rooms, 'Habitaciones'], ['layers', v.floors, 'Plantas'], ['calendar', 'Oct 2028', 'Entrega estimada'],
  ] : [
    ['ruler', `${l.a} m²`, 'Área de lote'], ['waves', l.w ? 'Sí' : 'Vista al agua', 'Frente al lago'], ['layers', `${sizeClass(l).id} · ${sizeClass(l).name}`, 'Tamaño'],
    ['umbrella', 'Incluido', 'Beach club'], ['key', 'Inmediata', 'Escrituración'], ['calendar', 'Oct 2029', 'Urbanismo Etapa 2'],
  ];
  $('#ldRes').innerHTML = `
    <div class="ld-hero" id="ldHero"><img src="${imgsFor(l)[0]}" alt="" /><span class="st-pill" style="--c:${st.color}">${st.label}</span></div>
    <div class="facts">${facts.map(([i, b, s]) => `<div>${icon(i)}<b>${b}</b><span>${s}</span></div>`).join('')}</div>
    <div class="ld-price"><div><small>${l.status === 'vendido' ? 'UNIDAD VENDIDA' : 'PRECIO DE REFERENCIA'}</small><b>${l.status === 'vendido' ? '—' : money(l.price)}</b><em>${l.status === 'vendido' ? 'Consulte unidades similares' : moneyAlt(l.price)}</em></div>
      <button class="btn btn-sm btn-gold" id="ldSim">Simular inversión</button></div>
    <p class="eyebrow">Ubicación en el masterplan</p>${miniMap(l)}
    <p class="fine">${l.etapa === 1 ? (v.features.join(' · ')) : LOT_TYPES[l.t].desc} Precio de referencia sujeto a cotización personalizada.</p>`;
  const hero = $('#ldHero');
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; hero.querySelector('img').style.transform = `scale(1.12) translate(${-x * 4}%, ${-y * 4}%) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`; });
  hero.addEventListener('pointerleave', () => (hero.querySelector('img').style.transform = ''));
  $('#ldSim').addEventListener('click', () => { closeDrawer(drawer); sim.load(l); });

  $('#ldImg').innerHTML = `<div class="gal">${imgsFor(l).map(s => `<img src="${s}" alt="" loading="lazy" />`).join('')}</div><p class="fine">Renders ilustrativos de la tipología.</p>`;

  // financiación
  const isV = l.etapa === 1, P = l.price;
  const sep = 5, ini = isV ? P * 0.3 : sep, n = isV ? 36 : 48, cuota = (P - ini) / n;
  $('#ldFin').innerHTML = `
    <p class="eyebrow">Plan de pagos sugerido</p>
    <div class="fin-bar"><span style="--c:#b48e6c;flex:${ini}"></span><span style="--c:#2c2420;flex:${P - ini}"></span></div>
    <div class="fin-leg"><span><i style="--c:#b48e6c"></i>${isV ? 'Cuota inicial 30%' : 'Separación'}</span><span><i style="--c:#2c2420"></i>Saldo en ${n} cuotas</span></div>
    <table class="fin-table">
      <tr><td>Precio de referencia</td><td>${money(P)}</td></tr>
      ${isV ? `<tr><td>Separación (incluida en la inicial)</td><td>${money(sep)}</td></tr>` : ''}
      <tr><td>${isV ? 'Cuota inicial (30%)' : 'Separación'}</td><td>${money(ini)}</td></tr>
      <tr><td>Cuota mensual × ${n}</td><td>${money(cuota)}</td></tr>
      <tr class="t"><td>Escrituración</td><td>Inmediata</td></tr>
    </table>
    ${isV ? `<p>Con renta corta operada por Soy Local (65% de ocupación), la villa ${l.t} proyecta ingresos netos estimados en el rango de $25 – 45 MM COP mensuales según tipología.</p>` : '<p>Asegure el activo hoy con una entrada ágil y construya cuando usted decida, dentro del manual arquitectónico de Cayetana.</p>'}
    <button class="btn btn-sm btn-ghost-d" id="ldSim2">Abrir simulador completo →</button>`;
  $('#ldSim2').addEventListener('click', () => { closeDrawer(drawer); sim.load(l); });

  // selector de modelo 3D
  const models = l.etapa === 1 ? [l.t] : ['Solo lote', 'Savina', 'Eivissa', 'Macarella'];
  ldModel = l.etapa === 1 ? l.t : (ldModel && models.includes(ldModel) ? ldModel : 'Eivissa');
  $('#ldModel').innerHTML = models.map(m => `<button data-m="${m}" class="${m === ldModel ? 'on' : ''}">${m}</button>`).join('');
  $('#ldModel').style.display = l.etapa === 1 ? 'none' : '';

  $('#ldFoot').innerHTML = l.status === 'vendido'
    ? `<button class="btn btn-gold" id="ldSimilar">Ver unidades similares</button>`
    : `<button class="btn btn-gold" id="ldReserve">${l.status === 'reservado' ? 'Unirme a lista de espera' : 'Separar esta unidad'}</button>
       <a class="btn btn-ghost-d" target="_blank" rel="noopener" href="${waHref(`Hola, me interesa la ${l.etapa === 1 ? 'Villa ' + l.t : 'Lote ' + l.t} ${l.id} (${l.a} m²) de Cayetana Villas.`)}">${icon('whatsapp')} WhatsApp</a>`;
  $('#ldReserve')?.addEventListener('click', () => { closeDrawer(drawer); prefillContact(l); goTo('#contacto'); });
  $('#ldSimilar')?.addEventListener('click', () => {
    closeDrawer(drawer); state.filters.status = new Set(['disponible']); setFilter({ types: [l.t], etapa: 'all' }); goTo('#maqueta');
  });
}

function setTab(name) {
  $$('.ld-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $$('.ld-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
  if (name === '3d') mount3D();
}
$('.ld-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });

async function mount3D() {
  if (!current) return;
  const { createVillaViewer } = await import('./villa3d.js');
  const t = ldModel === 'Solo lote' ? 'Eivissa' : ldModel;
  if (!ldViewer) ldViewer = createVillaViewer($('#ld3d'), { typology: t, lot: current });
  else { ldViewer.setLot(current); ldViewer.setTypology(t); }
  ldViewer.showVilla(ldModel !== 'Solo lote');
}
$('#ldModel').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ldModel = b.dataset.m; $$('#ldModel button').forEach(x => x.classList.toggle('on', x === b)); mount3D(); });
$('#ldCams').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ldViewer?.preset(b.dataset.p); });
$('#ldHour').addEventListener('input', e => { $('#ldHourOut').textContent = fmtH(+e.target.value); ldViewer?.setTime(+e.target.value); });
$('#ldInterior').addEventListener('click', e => { const on_ = ldViewer?.toggleInterior(); e.currentTarget.classList.toggle('on', !!on_); });

function openLot(l) {
  if (typeof l === 'number') l = byNum(l);
  if (!l) return;
  current = l; renderLot(l); setTab('res');
  openDrawer(drawer);
  mp2d.focus(l); mp3d?.focus(l);
  history.replaceState(null, '', '#lote-' + l.n);
}
function openDrawer(d) { d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); document.body.classList.add('lock'); lenis?.stop(); setTimeout(() => d.querySelector('[data-close]:not(.drawer-bg)')?.focus(), 400); }
function closeDrawer(d) {
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); document.body.classList.remove('lock'); lenis?.start();
  if (d === drawer) { mp2d.clearSelection(); mp3d?.clearSelection(); history.replaceState(null, '', location.pathname + location.search); }
}
$$('.drawer').forEach(d => d.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDrawer(d); }));
addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.drawer.open').forEach(closeDrawer); $('#concierge').classList.remove('open'); closeMenu(); } });

$('#ldFav').addEventListener('click', () => { toggleFav(current.n); $('#ldFav').classList.toggle('on', state.favs.has(current.n)); toast(state.favs.has(current.n) ? 'Guardado en favoritos ♥' : 'Quitado de favoritos'); });
$('#ldShare').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#lote-${current.n}`;
  const title = `${current.etapa === 1 ? 'Villa' : 'Lote'} ${current.id} · Cayetana Villas`;
  try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } } catch { /* cancelado */ }
});

// ---------- favoritos ----------
const favDrawer = $('#favDrawer');
$('#favOpen').addEventListener('click', () => { renderFavs(); openDrawer(favDrawer); });
function renderFavs() {
  const list = [...state.favs].map(byNum).filter(Boolean);
  const c = $('#favCount'); c.textContent = list.length || ''; c.classList.toggle('zero', !list.length);
  $('#favBody').innerHTML = !list.length ? `<div class="empty">${icon('heart')}<p>Aún no tiene favoritos.<br>Toque ♥ en cualquier lote para compararlo aquí.</p></div>` :
    list.map(l => `<div class="fav-item"><img src="${imgsFor(l)[0]}" alt="" /><div><b>${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id}</b><small>${l.t} · ${l.a} m² · ${STATUS[l.status].label}</small><div class="p">${money(l.price)}</div></div><button class="btn btn-sm btn-ghost-d" data-open="${l.n}">Ver</button></div>`).join('') +
    (list.length > 1 ? `<p class="eyebrow" style="margin-top:20px">Comparador</p><div class="table-wrap"><table class="fav-cmp"><tr><th></th>${list.map(l => `<th>${l.id}</th>`).join('')}</tr>
      <tr><td>Tipología</td>${list.map(l => `<td>${l.t}</td>`).join('')}</tr>
      <tr><td>Área</td>${list.map(l => `<td>${l.a} m²</td>`).join('')}</tr>
      <tr><td>Agua</td>${list.map(l => `<td>${l.w ? '✓' : '—'}</td>`).join('')}</tr>
      <tr><td>Precio</td>${list.map(l => `<td>${money(l.price)}</td>`).join('')}</tr>
      <tr><td>$/m²</td>${list.map(l => `<td>${money(l.price / l.a)}</td>`).join('')}</tr></table></div>
      <a class="btn btn-gold w100" style="margin-top:16px" href="#contacto" id="favContact">Cotizar mis favoritos</a>` : '');
  $('#favContact')?.addEventListener('click', () => { closeDrawer(favDrawer); $('#msg').value = `Me interesa cotizar: ${list.map(l => (l.kind === 'villa' ? 'Villa ' : 'Lote ') + l.id).join(', ')}.`; });
}
on('favs', renderFavs); renderFavs();
$('#favBody').addEventListener('click', e => { if (e.target.closest('[data-open]')) closeDrawer(favDrawer); });

// ---------- contacto ----------
function waHref(text) { return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`; }
$('#waLink').href = waHref('Hola, quiero información sobre Cayetana Villas en Barú.');
$('#fecha').min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
let visitType = 'Visita presencial';
$('#visitType').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; visitType = b.dataset.v; $$('#visitType button').forEach(x => x.classList.toggle('on', x === b)); });
function prefillContact(l) {
  const sel = $('#interes'); sel.value = l.etapa === 1 ? `Villa ${l.t}` : 'Lote Etapa 2';
  $('#msg').value = `Quiero separar la ${l.etapa === 1 ? 'Villa ' + l.t : 'unidad Lote ' + l.t} ${l.id} (${l.a} m²).`;
}
$('#contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target; let ok = true;
  $$('input[required]', f).forEach(i => { const bad = i.type === 'checkbox' ? !i.checked : !i.value.trim() || (i.type === 'email' && !/^\S+@\S+\.\S+$/.test(i.value)); i.classList.toggle('invalid', bad); if (bad) ok = false; });
  if (!ok) { toast('Revise los campos marcados'); return; }
  const d = Object.fromEntries(new FormData(f));
  const body = `Tipo: ${visitType}\nNombre: ${d.nombre}\nTeléfono: ${d.tel}\nCorreo: ${d.email}\nInterés: ${d.interes}\nFecha preferida: ${d.fecha || '—'}\n\n${d.msg || ''}`;
  // Sin backend: se abre el correo del usuario con la solicitud prellenada.
  location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Solicitud de visita · ' + d.interes)}&body=${encodeURIComponent(body)}`;
  $('.form-ok', f).hidden = false; toast('¡Solicitud lista! Le contactaremos pronto.');
});

// ---------- simulador y concierge ----------
const sim = initSimulator();
initConcierge({ openLot: n => openLot(n), goTo });

// ---------- enlace profundo #lote-NN ----------
const m = location.hash.match(/^#lote-(\d+)/);
if (m) setTimeout(() => { goTo('#maqueta'); setTimeout(() => openLot(+m[1]), 900); }, 1600);

addEventListener('load', () => ScrollTrigger.refresh());
