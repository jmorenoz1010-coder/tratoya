// Cayetana Concierge: asistente conversacional que responde con la información del brochure
// y consulta la disponibilidad real del masterplan. Funciona 100% en el navegador; puede
// conectarse luego a un modelo de lenguaje (p. ej. Claude) desde un backend propio.
import { lots, money, STATUS } from './store.js';
import { VILLAS } from './config.js';

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function initConcierge({ openLot, goTo }) {
  const root = document.getElementById('concierge');
  const log = document.getElementById('cgLog');
  const form = document.getElementById('cgForm');
  const input = document.getElementById('cgInput');
  const quick = document.getElementById('cgQuick');
  let greeted = false;

  const open = () => {
    root.classList.add('open');
    if (!greeted) { greeted = true; bot(`¡Hola! Soy el concierge de <b>Cayetana Villas</b> 🌴. Puedo mostrarle unidades disponibles, precios, plan de pagos, rentabilidad o agendar su visita. ¿Qué le gustaría saber?`); }
    setTimeout(() => input.focus(), 300);
  };
  document.getElementById('cgFab').addEventListener('click', open);
  document.getElementById('cgClose').addEventListener('click', () => root.classList.remove('open'));

  const QUICK = ['Villas disponibles', 'Lotes frente al lago', '¿Cuánto cuesta?', 'Plan de pagos', 'Rentabilidad', '¿Cuándo entregan?', 'Ubicación', 'Agendar visita'];
  quick.innerHTML = QUICK.map(q => `<button type="button">${q}</button>`).join('');
  quick.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; ask(v); } });
  log.addEventListener('click', e => {
    const a = e.target.closest('[data-lot]'); if (a) { openLot(+a.dataset.lot); return; }
    const g = e.target.closest('[data-go]'); if (g) { root.classList.remove('open'); goTo(g.dataset.go); }
  });

  function add(html, who) {
    const d = document.createElement('div'); d.className = 'msg ' + who; d.innerHTML = html; log.appendChild(d);
    log.scrollTop = log.scrollHeight; return d;
  }
  function bot(html) {
    const t = add('<span class="typing"><span></span><span></span><span></span></span>', 'bot');
    setTimeout(() => { t.innerHTML = html; log.scrollTop = log.scrollHeight; }, 550 + Math.min(900, html.length * 2));
  }
  function ask(q) { add(q.replace(/</g, '&lt;'), 'me'); bot(answer(q)); }

  const lotLinks = list => list.map(l => `<a href="#" class="lotlink" data-lot="${l.n}">${l.kind === 'villa' ? 'Villa' : 'Lote'} ${l.id} · ${l.a} m² · ${money(l.price)}</a>`).join('');

  function answer(raw) {
    const q = norm(raw);
    const has = (...w) => w.some(x => q.includes(x));
    // filtros desde lenguaje natural
    const types = ['savina', 'eivissa', 'macarella', 'aqua', 'vista', 'altezza'].filter(t => q.includes(t)).map(t => t[0].toUpperCase() + t.slice(1));
    const maxM = q.match(/(menos de|hasta|maximo|max|bajo|por debajo de)\s*\$?\s*([\d.,]+)\s*(mm|millones|m)?/);
    let maxPrice = null;
    if (maxM) { let n = parseFloat(maxM[2].replace(/\./g, '').replace(',', '.')); if (n < 20) n *= 1000; maxPrice = n; }
    const wantsList = has('disponib', 'quedan', 'hay ', 'mostrar', 'muestr', 'busco', 'quiero', 'lotes', 'villas', 'opciones') && !has('cuanto cuesta', 'precio de', 'plan de pago');

    if (has('hola', 'buenas', 'buenos dias', 'hello', 'hi ')) return '¡Bienvenido! ¿Busca una villa lista para habitar (Etapa 1) o un lote a borde de agua para construir después (Etapa 2)?';

    if (wantsList || types.length || maxPrice || has('frente al agua', 'frente al lago', 'borde de agua', 'lago')) {
      let r = lots.filter(l => l.status === 'disponible');
      if (types.length) r = r.filter(l => types.includes(l.t));
      else if (has('villa')) r = r.filter(l => l.etapa === 1);
      else if (has('lote')) r = r.filter(l => l.etapa === 2);
      if (has('frente al agua', 'frente al lago', 'borde de agua', 'vista al lago', 'lago')) r = r.filter(l => l.w);
      if (maxPrice) r = r.filter(l => l.price <= maxPrice);
      if (has('grande', 'amplio', 'mas grande')) r.sort((a, b) => b.a - a.a); else r.sort((a, b) => a.price - b.price);
      if (!r.length) return 'No encontré unidades disponibles con esos criterios. ¿Probamos ampliando el presupuesto o la tipología? También puede <a href="#" data-go="#maqueta">explorar la maqueta</a>.';
      return `Encontré <b>${r.length}</b> unidades disponibles${types.length ? ' ' + types.join(', ') : ''}${maxPrice ? ' por debajo de ' + money(maxPrice) : ''}. Estas son las más convenientes:<br>${lotLinks(r.slice(0, 5))}<br><small>Toque una para verla en 3D.</small>`;
    }
    if (has('precio', 'cuanto', 'cuesta', 'valor', 'costo', 'vale')) {
      return `Valores de entrada (COP, referencia):<br>• Lotes Etapa 2: desde <b>${money(300)}</b><br>• Villa Savina: desde <b>${money(VILLAS.Savina.priceFrom)}</b><br>• Villa Eivissa: desde <b>${money(VILLAS.Eivissa.priceFrom)}</b><br>• Villa Macarella: desde <b>${money(VILLAS.Macarella.priceFrom)}</b><br>Puede cambiar la moneda arriba (COP/USD/EUR). <a href="#" data-go="#simulador">Simular mi inversión →</a>`;
    }
    if (has('pago', 'financ', 'cuota', 'credito', 'separ', 'inicial')) {
      return 'Plan de pagos:<br>• <b>Villas</b>: cuota inicial del 30% y saldo hasta en 36 cuotas.<br>• <b>Lotes</b>: separación de $5 MM COP (≈ USD 1.560) y saldo hasta en 48 cuotas.<br>Escrituración inmediata. <a href="#" data-go="#simulador">Calcular mis cuotas →</a>';
    }
    if (has('renta', 'rentab', 'airbnb', 'retorno', 'roi', 'ingreso', 'ocupacion', 'invertir', 'inversion')) {
      return 'Su villa puede trabajar para usted: Soy Local (parte del grupo) opera la renta corta. Con <b>65% de ocupación</b> esperada, los ingresos netos proyectados van de <b>$25 a 45 MM COP</b> mensuales según tipología (≈ USD 7.800–14.100). Administración $1–2 MM y mantenimiento $0,9–1,7 MM. <a href="#" data-go="#simulador">Ver proyección a 10 años →</a><br><small>Proyecciones estimadas, no garantizadas.</small>';
    }
    if (has('entrega', 'cuando', 'avance', 'obra', 'listo', 'fecha')) {
      return 'Estado a octubre 2026: licencias y desenglobe listos, <b>30% de urbanismo</b> y punto de equilibrio superado. Próximo hito: vías y portería (ago. 2027). Entrega Etapa 1: <b>octubre 2028</b> (primeras villas dic. 2028). Etapa 2: urbanismo y beach club, oct. 2029. <a href="#" data-go="#avance">Ver avance →</a>';
    }
    if (has('donde', 'ubicacion', 'aeropuerto', 'llegar', 'distancia', 'cartagena', 'baru', 'bote')) {
      return 'Estamos en la <b>Ensenada de los Vásquez, Punta Nativa – Barú</b>: 55 min en vehículo desde el aeropuerto Rafael Núñez y 35 min en bote desde Bocagrande. Rodeados por Four Seasons, Sofitel Calablanca y Marina Argos. <a href="#" data-go="#ubicacion">Ver ruta →</a>';
    }
    if (has('amenidad', 'club', 'piscina', 'spa', 'gimnasio', 'padel', 'tenis', 'playa', 'kayak', 'muelle')) {
      return 'Amenidades: lago privado de 13.260 m² con beach club, club de playa de 3.800 m² en la ciénaga, piscinas infinitas privadas, spa & wellness, gimnasio, pádel y tenis, golf cage, muelle de lanchas, canal de kayaks, senderos ecológicos, zona niños, lounge café y watersports. <a href="#" data-go="#amenidades">Ver todas →</a>';
    }
    if (has('quien', 'constructor', 'respaldo', 'empresa', 'brau', 'figo', 'ch2', 'confian')) {
      return 'Respaldo: <b>Brau Group</b> (desarrollo y ventas), <b>X.Form</b> (diseño), <b>CH2</b> (gerencia y construcción, +20 años), <b>FIGO Investment Group</b> (promoción, USD 249 MM en activos) y <b>Soy Local</b> (operador hotelero, 13 hoteles). <a href="#" data-go="#respaldo">Conocer más →</a>';
    }
    if (has('habitacion', 'cuartos', 'm2', 'metros', 'tamano', 'diferencia', 'tipolog')) {
      return Object.values(VILLAS).map(v => `• <b>${v.name}</b>: ${v.built} m² + ${v.outdoor} m² · ${v.floors} · ${v.rooms} habitaciones (${v.count} villas)`).join('<br>') + '<br>Lotes Etapa 2: Compacto 250–320 m², Mediano 321–379 m², Grande 380–980 m².';
    }
    if (has('visita', 'agendar', 'cita', 'asesor', 'contacto', 'llamar', 'whatsapp', 'tour')) {
      return 'Con gusto. Puede agendar una visita presencial, una videollamada con tour 3D en vivo o una llamada con un asesor. <a href="#" data-go="#contacto">Agendar ahora →</a>';
    }
    if (has('disponible', 'vendid', 'reservad')) {
      const c = { disponible: 0, reservado: 0, vendido: 0 }; lots.forEach(l => c[l.status]++);
      return `Hoy: <b style="color:${STATUS.disponible.color}">${c.disponible} disponibles</b>, ${c.reservado} reservadas y ${c.vendido} vendidas de 190 unidades.`;
    }
    return 'Puedo ayudarle con <b>disponibilidad</b> (ej. "Eivissa disponibles bajo 3.000 MM"), <b>precios</b>, <b>plan de pagos</b>, <b>rentabilidad</b>, <b>entrega</b> o <b>agendar una visita</b>. ¿Qué le interesa?';
  }
  return { open, ask };
}
