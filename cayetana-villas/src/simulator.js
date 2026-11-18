// Simulador de inversión: plan de pagos, renta corta proyectada y patrimonio a 10 años.
import { VILLAS, CONFIG } from './config.js';
import { money, on } from './store.js';

const $ = s => document.querySelector(s);

export function initSimulator() {
  const products = { ...Object.fromEntries(Object.entries(VILLAS).map(([k, v]) => [k, v.priceFrom])), Lote: 300 };
  const seg = $('#simProduct');
  seg.innerHTML = Object.keys(products).map((k, i) => `<button data-p="${k}" class="${i === 1 ? 'on' : ''}">${k === 'Lote' ? 'Lote Etapa 2' : 'Villa ' + k}</button>`).join('');
  const el = id => $('#' + id);
  const inputs = ['simPrice', 'simDown', 'simTerm', 'simOcc', 'simRate', 'simApp'].reduce((o, k) => (o[k] = el(k), o), {});
  let product = 'Eivissa';

  function setProduct(p, price) {
    product = p;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
    inputs.simPrice.value = price ?? products[p];
    const isLot = p === 'Lote';
    document.querySelectorAll('.sim-in .rent').forEach(l => l.classList.toggle('hide', isLot));
    inputs.simDown.value = isLot ? 10 : 30;
    inputs.simTerm.value = isLot ? 48 : 36;
    if (!isLot) inputs.simRate.value = VILLAS[p].nightUSD;
    calc();
  }
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setProduct(b.dataset.p); });
  Object.values(inputs).forEach(i => i.addEventListener('input', calc));
  on('currency', calc);

  function calc() {
    const price = +inputs.simPrice.value, down = +inputs.simDown.value / 100, term = +inputs.simTerm.value;
    const occ = +inputs.simOcc.value / 100, rate = +inputs.simRate.value, app = +inputs.simApp.value / 100;
    const isLot = product === 'Lote';
    const sep = 5; // MM separación
    const initial = Math.max(price * down, sep);
    const monthly = (price - initial) / term;
    el('simPriceOut').textContent = money(price);
    el('simDownOut').textContent = `${Math.round(down * 100)}% · ${money(initial)}`;
    el('simTermOut').textContent = `${term} meses`;
    el('simOccOut').textContent = `${Math.round(occ * 100)}% · ${Math.round(occ * 365)} noches/año`;
    el('simRateOut').textContent = `USD ${rate.toLocaleString('es-CO')}`;
    el('simAppOut').textContent = `${app * 100}%`;

    let netMonthly = 0, admin = 0, maint = 0;
    if (!isLot) {
      const v = VILLAS[product];
      const grossMonthlyMM = (rate * 30.4 * occ * CONFIG.trm) / 1e6;
      admin = v.adminMM; maint = v.maintMM;
      netMonthly = grossMonthlyMM * 0.8 - admin - maint;
    }
    const netYear = netMonthly * 12;
    const yieldPct = isLot ? 0 : (netYear / price) * 100;
    // proyección 10 años (inicio a la entrega)
    const years = 10, rows = [];
    let cum = 0;
    for (let y = 1; y <= years; y++) {
      const asset = price * Math.pow(1 + app, y);
      cum += isLot ? 0 : netYear * Math.pow(1.03, y - 1);
      rows.push({ y, asset, cum });
    }
    const last = rows[years - 1];
    const totalGain = last.asset + last.cum - price;
    el('simKpis').innerHTML = `
      <div><b>${money(initial)}</b><span>Cuota inicial</span></div>
      <div><b>${money(monthly)}</b><span>Cuota mensual × ${term}</span></div>
      ${isLot
        ? `<div><b>${money(price * Math.pow(1 + app, 3))}</b><span>Valor estimado a la entrega (3 años)</span></div>`
        : `<div><b>${money(netMonthly)}</b><span>Renta neta mensual estimada</span></div>`}
      ${isLot ? `<div><b>${Math.round(app * 100 * 10) / 10}%</b><span>Valorización anual supuesta</span></div>` : `<div><b>${yieldPct.toFixed(1)}%</b><span>Rentabilidad neta anual</span></div>`}
      ${isLot ? `<div><b>48</b><span>Cuotas máx. para lotes</span></div>` : `<div><b>${(price / Math.max(netYear, 0.01)).toFixed(1)} años</b><span>Recuperación vía rentas</span></div>`}
      <div class="hl"><b>${money(totalGain)}</b><span>Ganancia patrimonial a 10 años</span></div>`;
    drawChart(rows, price);
  }

  function drawChart(rows, price) {
    const svg = el('simChart');
    const W = 600, H = 220, pad = 34;
    const max = Math.max(...rows.map(r => r.asset + r.cum)) * 1.08;
    const bw = (W - pad) / rows.length;
    const y = v => H - (v / max) * (H - 20);
    let s = '';
    [0.25, 0.5, 0.75, 1].forEach(f => { s += `<line x1="${pad}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#e5dac8" stroke-dasharray="3 4"/><text x="0" y="${y(max * f) + 4}">${money(max * f).replace(' MM', '')}</text>`; });
    rows.forEach((r, i) => {
      const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
      s += `<rect x="${x}" y="${y(r.asset)}" width="${w}" height="${H - y(r.asset)}" rx="4" fill="#b48e6c"><animate attributeName="height" from="0" to="${H - y(r.asset)}" dur=".6s" fill="freeze"/><animate attributeName="y" from="${H}" to="${y(r.asset)}" dur=".6s" fill="freeze"/></rect>`;
      if (r.cum > 0) s += `<rect x="${x}" y="${y(r.asset + r.cum)}" width="${w}" height="${y(r.asset) - y(r.asset + r.cum)}" rx="4" fill="#2c2420"/>`;
      s += `<text x="${x + w / 2}" y="${H + 16}" text-anchor="middle">A${r.y}</text>`;
    });
    s += `<line x1="${pad}" x2="${W}" y1="${y(price)}" y2="${y(price)}" stroke="#2f9e6e" stroke-width="2"/><text x="${W}" y="${y(price) - 6}" text-anchor="end" fill="#2f9e6e">Inversión inicial</text>`;
    svg.innerHTML = s;
  }

  setProduct('Eivissa');
  return {
    load(l) {
      if (l.etapa === 1) setProduct(l.t, l.price); else setProduct('Lote', l.price);
      document.querySelector('#simulador').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
}
