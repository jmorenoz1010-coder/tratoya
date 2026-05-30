import { useEffect, useState } from "react";
import { calcularComisionUI, fmt } from "../lib/utils";
import logo from "../assets/tratoya-logo.png";
import heroSecureBag from "../assets/hero-secure-bag.png";
import stepPaymentProtected from "../assets/step-payment-protected.png";
import stepServiceDelivery from "../assets/step-service-delivery.png";
import stepConfirmation from "../assets/step-confirmation.png";
import stepPaymentRelease from "../assets/step-payment-release.png";
import whyModelFemale from "../assets/why-model-female.png";
import mobileDashboardPreview from "../assets/mobile-dashboard-preview.svg";
import googlePlayBadge from "../assets/store-google-play.svg";
import appStoreBadge from "../assets/store-app-store.svg";

/* ── Datos ──────────────────────────────────────────────── */
const stats = [
  ["users",   50,   "+", "K",  "Usuarios activos"],
  ["bolt",    100,  "+", "K",  "Transacciones"],
  ["shield",  99.8, "",  "%",  "Tratos exitosos"],
  ["support", null, "",  "",   "Soporte", "en cada paso"],
];

const steps = [
  { img: stepPaymentProtected,  n: "01", title: "Acuerdan el trato",     body: "Comprador y vendedor definen el precio, las condiciones y crean el trato en TratoYa." },
  { img: stepServiceDelivery,   n: "02", title: "El comprador paga",     body: "El comprador transfiere a TratoYa, no al vendedor directamente. El dinero queda protegido." },
  { img: stepConfirmation,      n: "03", title: "El vendedor entrega",   body: "Con el pago asegurado, el vendedor entrega el producto o realiza el servicio." },
  { img: stepPaymentRelease,    n: "04", title: "Se libera el dinero",   body: "El comprador confirma que recibió lo acordado y TratoYa transfiere el pago al vendedor." },
];

const benefits = [
  { ico: "🛡️", title: "Nadie pierde dinero",    body: "El pago solo se libera cuando el comprador confirma que recibió lo que pagó." },
  { ico: "⚡", title: "Resolución rápida",       body: "Si algo sale mal, nuestro equipo interviene y media entre las partes." },
  { ico: "📋", title: "Cero letra pequeña",      body: "Sin cobros ocultos. Todo queda registrado y acordado desde el principio." },
  { ico: "💬", title: "Soporte humano real",     body: "Personas reales que te acompañan si tienes dudas o algún problema." },
];

const useCases = [
  { e: "📱", t: "Celulares y electrónicos",   d: "Compra o vende equipos sin miedo a estafas o productos dañados." },
  { e: "💼", t: "Servicios freelance",         d: "Acuerda el trabajo, el cliente paga y tú recibes al entregar." },
  { e: "🚗", t: "Vehículos y motos",          d: "Negocios de alto valor con el dinero protegido desde el inicio." },
  { e: "🏠", t: "Remodelaciones",             d: "Paga por avance. El contratista cobra al completar cada etapa." },
  { e: "👗", t: "Moda y accesorios",          d: "Garantía de que recibes exactamente lo que acordaste." },
  { e: "🛠️", t: "Cualquier servicio",          d: "Si dos personas acuerdan un precio, TratoYa lo hace seguro." },
];

const testimonials = [
  { name: "Carlos M.", role: "Comprador", text: "Compré un celular de alto valor. Pagué y no solté el dinero hasta tener el equipo en mis manos. Así sí se puede confiar." },
  { name: "María R.",  role: "Vendedora",  text: "Mis clientes se sienten seguros pagando por TratoYa y yo recibo mi plata en el momento en que confirman. Sin demoras." },
  { name: "Juan P.",   role: "Emprendedor",text: "Usé TratoYa para pagar a un freelance. Todo quedó acordado desde el principio y el proceso fue impecable." },
];

const faqs = [
  ["¿Cómo funciona exactamente?",            "El comprador paga a TratoYa, no al vendedor. TratoYa retiene ese dinero hasta que el comprador confirme que recibió el producto o servicio. Solo entonces se libera el pago al vendedor."],
  ["¿Quién puede usar TratoYa?",             "Cualquier persona en Colombia. Compradores, vendedores, freelancers, emprendedores... si vas a hacer un negocio con alguien, TratoYa lo hace seguro."],
  ["¿Qué pasa si el vendedor no entrega?",   "Si el vendedor no entrega o entrega algo diferente, el comprador abre una disputa. TratoYa investiga y protege el dinero hasta resolver la situación."],
  ["¿Cuánto cuesta usar TratoYa?",           "Registrarse es totalmente gratis. TratoYa cobra una pequeña comisión (4.5%) por transacción exitosa, visible antes de confirmar el trato. Sin costos ocultos."],
  ["¿El dinero está seguro mientras TratoYa lo retiene?", "Sí. El dinero queda protegido en nuestra plataforma y no se mueve hasta que ambas partes cumplan lo acordado."],
  ["¿Qué pasa si hay una disputa?",          "Nuestro equipo revisa la evidencia, media entre las partes y toma una decisión para proteger a quien tiene la razón."],
];

/* ── Scroll reveal hook ─────────────────────────────────── */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("ty-rv"); }),
      { threshold: 0.07, rootMargin: "0px 0px -44px 0px" }
    );
    document.querySelectorAll(".ty-r").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ── Componente principal ───────────────────────────────── */
export default function Landing({ goAuth }) {
  useReveal();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const register = () => goAuth("register");
  const login    = () => goAuth("login");
  const goBack   = () => { if (window.history.length > 1) window.history.back(); else window.location.href = "/"; };

  return (
    <main className="ty-landing" id="inicio">
      <button className="public-back" type="button" onClick={goBack} aria-label="Volver">←</button>

      {/* ── NAVBAR + HERO (bloque oscuro) ───────────────── */}
      <section className="ty-top-shell">
        <header className="ty-navbar">
          <a className="ty-brand" href="/" aria-label="TratoYa inicio"><img src={logo} alt="TratoYa" /></a>
          <nav className="ty-nav" aria-label="Navegación">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#para-quien">Para quién</a>
            <a href="#simula">Simulador</a>
            <a href="#faq">Preguntas</a>
          </nav>
          <div className="ty-nav-actions">
            <button className="ty-link-btn" type="button" onClick={login}>Iniciar sesión</button>
            <button className="ty-button ty-button-small" type="button" onClick={register}>Regístrate gratis</button>
          </div>
        </header>

        {/* HERO */}
        <section className="ty-hero">
          <div className="ty-hero-copy">
            <div className="ty-hero-badge ty-r">Pagos seguros entre personas ✓</div>
            <h1 className="ty-r" style={{ "--td": ".1s" }}>
              COMPRA Y VENDE<br />
              CON <span>CONFIANZA</span>
            </h1>
            <p className="ty-r" style={{ "--td": ".22s" }}>
              TratoYa cuida el dinero hasta que el producto o servicio sea entregado.
              Simple, seguro y sin riesgos para ambas partes.
            </p>
            <div className="ty-actions ty-r" style={{ "--td": ".32s" }}>
              <button className="ty-button ty-button-large" type="button" onClick={register}>
                EMPIEZA GRATIS <span aria-hidden="true">›</span>
              </button>
              <a className="ty-play" href="#simula">⚡ Simula tu trato</a>
            </div>
          </div>
          <div className="ty-hero-visual ty-r" style={{ "--td": ".18s" }} aria-hidden="true">
            <div className="ty-halo" />
            <img className="ty-hero-photo" src={heroSecureBag} alt="" />
          </div>
        </section>

        {/* STATS */}
        <section className="ty-stats" aria-label="Métricas">
          {stats.map(([icon, value, prefix, suffix, title, sub]) => (
            <div className="ty-mini ty-stat-mini" key={title}>
              <LIcon name={icon} />
              <div>
                <strong>{value == null ? title : <Counter value={value} prefix={prefix} suffix={suffix} />}</strong>
                <p>{value == null ? sub : title}</p>
              </div>
            </div>
          ))}
        </section>
      </section>

      {/* ── ¿QUÉ ES TRATOYA? (blanco limpio) ─────────────── */}
      <section className="ty-sec ty-sec-white" id="que-es">
        <div className="ty-sec-inner">
          <p className="ty-eyebrow ty-r">EN POCAS PALABRAS</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s" }}>
            ¿Qué es <span style={{ color: "var(--ty-green-2)" }}>TratoYa?</span>
          </h2>
          <p className="ty-body-lg ty-r" style={{ "--td": ".16s", maxWidth: 580 }}>
            TratoYa es una plataforma donde el comprador paga,
            <strong> TratoYa retiene el dinero</strong>, y solo lo libera cuando
            el producto o servicio fue entregado correctamente.
            Nadie pierde.
          </p>
          <div className="ty-what-cards">
            {[
              { e: "🛒", t: "Si eres comprador",  d: "Pagas y tu dinero no llega al vendedor hasta que confirmes que recibiste lo acordado." },
              { e: "📦", t: "Si eres vendedor",   d: "Sabes que el dinero ya está reservado antes de entregar. Al confirmar la entrega, cobras." },
              { e: "⚖️", t: "Si hay un problema", d: "TratoYa actúa como árbitro neutral, revisa la situación y protege a quien tiene la razón." },
            ].map(({ e, t, d }, i) => (
              <div className={`ty-what-card ty-r`} key={t} style={{ "--td": `${i * 0.1}s` }}>
                <span className="ty-what-ico">{e}</span>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA (oscuro) ────────────────────────── */}
      <section className="ty-sec ty-sec-dark" id="como-funciona">
        <div className="ty-sec-inner">
          <p className="ty-eyebrow ty-r" style={{ color: "rgba(169,235,27,.55)" }}>4 PASOS SIMPLES</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s", color: "#fff" }}>
            Así funciona <span style={{ color: "#dfff36" }}>TratoYa</span>
          </h2>
          <div className="ty-steps-nu">
            {steps.map(({ img, n, title, body }, i) => (
              <div className={`ty-step-nu ty-r`} key={title} style={{ "--td": `${i * 0.12}s` }}>
                <div className="ty-step-nu-num">{n}</div>
                <div className="ty-step-nu-img">
                  <img src={img} alt={title} loading="lazy" />
                </div>
                <div className="ty-step-nu-body">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA COMPRADORES Y VENDEDORES (verde profundo) ── */}
      <section className="ty-sec ty-sec-deep" id="para-quien">
        <div className="ty-sec-inner">
          <p className="ty-eyebrow ty-r" style={{ color: "rgba(169,235,27,.55)" }}>DISEÑADO PARA AMBOS</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s", color: "#fff" }}>
            Para compradores<br />y <span style={{ color: "#9ed819" }}>vendedores</span>
          </h2>
          <div className="ty-two-col" style={{ marginTop: 36 }}>
            {[
              {
                ico: "🛒", title: "Para compradores", accent: "#dfff36",
                items: [
                  "Pagas y tu dinero queda protegido, no va directo al vendedor",
                  "Si el producto no llega o no es lo acordado, no pierdes el dinero",
                  "Confirmas la entrega antes de liberar el pago",
                  "Puedes abrir una disputa si algo sale mal",
                  "Historial de todos tus tratos en un solo lugar",
                ],
                cta: "Comprar con seguridad",
              },
              {
                ico: "📦", title: "Para vendedores", accent: "#9ed819",
                items: [
                  "El comprador ya pagó antes de que entregues. Cero riesgo de no cobrar",
                  "El dinero se libera en cuanto el comprador confirma la entrega",
                  "Comparte un link del trato para que te paguen fácil",
                  "Respaldo ante cualquier disputa injustificada",
                  "Construyes reputación como vendedor confiable",
                ],
                cta: "Vender con garantía",
              },
            ].map(({ ico, title, accent, items, cta }, i) => (
              <div className={`ty-role-nu ty-r`} key={title} style={{ "--td": `${i * 0.14}s`, "--ac": accent }}>
                <div className="ty-role-nu-head">
                  <span>{ico}</span>
                  <h3>{title}</h3>
                </div>
                <ul>
                  {items.map((it) => (
                    <li key={it}><span className="ty-check">✓</span>{it}</li>
                  ))}
                </ul>
                <button className="ty-button ty-role-btn" type="button" onClick={register}>{cta} →</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIMULADOR (claro, alto contraste) ─────────────── */}
      <section className="ty-sec ty-sec-light" id="simula">
        <div className="ty-sec-inner" style={{ textAlign: "center" }}>
          <p className="ty-eyebrow ty-r">SIN SORPRESAS</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s" }}>
            ¿Cuánto cobra <span style={{ color: "var(--ty-green-2)" }}>TratoYa?</span>
          </h2>
          <p className="ty-r" style={{ "--td": ".16s", maxWidth: 480, margin: "0 auto 32px", fontSize: 17, color: "var(--ty-muted)" }}>
            Ingresa el valor de tu trato y ve exactamente cuánto paga cada parte.
          </p>
          <TratoCalculator register={register} />
        </div>
      </section>

      {/* ── USOS FRECUENTES (oscuro, carrusel) ─────────────── */}
      <section className="ty-sec ty-sec-teal" id="usos">
        <div className="ty-sec-inner">
          <p className="ty-eyebrow ty-r" style={{ color: "rgba(169,235,27,.55)" }}>PARA QUÉ SE USA</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s", color: "#fff" }}>
            Usos <span style={{ color: "#9ed819" }}>frecuentes</span>
          </h2>
          <p className="ty-r" style={{ "--td": ".16s", color: "rgba(255,255,255,.6)", fontSize: 16, marginBottom: 32 }}>
            Si acuerdas un precio con alguien, TratoYa lo hace seguro.
          </p>
          {/* Carrusel en mobile, grid en desktop */}
          <div className="ty-use-carousel ty-r" style={{ "--td": ".2s" }}>
            {useCases.map(({ e, t, d }) => (
              <div className="ty-use-card-dark" key={t}>
                <span className="ty-use-ico">{e}</span>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POR QUÉ TRATOYA (blanco) ─────────────────────── */}
      <section className="ty-why" id="ventajas">
        <div className="ty-person">
          <img src={whyModelFemale} alt="Usuaria revisando un trato seguro" />
        </div>
        <div className="ty-why-content" id="seguridad">
          <h2 className="ty-r">¿POR QUÉ ELEGIR <span>TRATOYA?</span></h2>
          <div className="ty-benefit-grid">
            {benefits.map(({ ico, title, body }, i) => (
              <article className={`ty-benefit ty-r`} key={title} style={{ "--td": `${i * 0.1}s` }}>
                <span style={{ fontSize: 26, marginBottom: 8, display: "block" }}>{ico}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── EL PROBLEMA QUE RESOLVEMOS (oscuro split) ───────── */}
      <section className="ty-sec ty-sec-dark">
        <div className="ty-sec-inner">
          <p className="ty-eyebrow ty-r" style={{ color: "rgba(169,235,27,.55)" }}>EL PROBLEMA</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s", color: "#fff" }}>
            Hacer negocios online<br /><span style={{ color: "#dfff36" }}>debería ser seguro</span>
          </h2>
          <div className="ty-problem-grid">
            <div className="ty-problem-side">
              {[
                { e: "😟", t: "Sin TratoYa", d: "Pagas y cruzas los dedos. O entregas y esperas que te paguen. La confianza no puede ser el único mecanismo." },
                { e: "🚨", t: "El riesgo es real", d: "Las estafas en compras entre personas son el problema más común en el comercio digital. Le pasa a cualquiera." },
              ].map(({ e, t, d }) => (
                <div className="ty-problem-item bad ty-r" key={t}>
                  <span>{e}</span>
                  <div><strong>{t}</strong><p>{d}</p></div>
                </div>
              ))}
            </div>
            <div className="ty-problem-side">
              {[
                { e: "✅", t: "Con TratoYa", d: "El dinero queda en manos de TratoYa, no del vendedor. Se libera solo cuando el comprador confirma que recibió lo que pagó." },
                { e: "🤝", t: "Ambos ganan", d: "El comprador tiene certeza de que no pierde. El vendedor tiene certeza de que cobra. Así se hacen buenos negocios." },
              ].map(({ e, t, d }) => (
                <div className="ty-problem-item good ty-r" key={t}>
                  <span>{e}</span>
                  <div><strong>{t}</strong><p>{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS (profundo, carrusel) ─────────────────── */}
      <section className="ty-sec ty-sec-deep">
        <div className="ty-sec-inner">
          <div className="ty-title-row ty-r">
            <h2 style={{ color: "#fff" }}>LO QUE DICEN<br /><span style={{ color: "#9ed819" }}>NUESTROS USUARIOS</span></h2>
            <p style={{ color: "#9ed819" }}>★★★★★ <small style={{ color: "rgba(255,255,255,.5)", fontWeight: 600 }}>4.9/5 · 2,000+ reseñas</small></p>
          </div>
          <div className="ty-testi-carousel ty-r" style={{ "--td": ".14s" }}>
            {testimonials.map(({ name, role, text }, i) => (
              <article className="ty-testi-card" key={name}>
                <div className="ty-avatar" aria-hidden="true">{i + 1}</div>
                <span className="ty-quote">"</span>
                <p style={{ color: "rgba(255,255,255,.85)" }}>{text}</p>
                <strong style={{ color: "#fff" }}>{name}</strong>
                <small style={{ color: "rgba(255,255,255,.45)" }}>{role}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA PRINCIPAL (lima → máximo impacto) ──────────── */}
      <section className="ty-sec ty-sec-lime ty-cta-hero">
        <div className="ty-sec-inner" style={{ textAlign: "center" }}>
          <p className="ty-eyebrow ty-r" style={{ color: "rgba(7,24,25,.5)" }}>EMPIEZA HOY</p>
          <h2 className="ty-display ty-r" style={{ "--td": ".08s", color: "#071819", lineHeight: 1.04 }}>
            Haz tu próximo<br />negocio sin miedo.
          </h2>
          <p className="ty-r" style={{ "--td": ".18s", fontSize: 19, color: "rgba(7,24,25,.7)", margin: "18px auto 32px", maxWidth: 480 }}>
            Regístrate gratis y crea tu primer trato en minutos.
          </p>
          <button className="ty-cta-dark-btn ty-r" style={{ "--td": ".26s" }} type="button" onClick={register}>
            CREAR MI CUENTA GRATIS →
          </button>
        </div>
      </section>

      {/* ── DESCARGA ──────────────────────────────────────────── */}
      <section className="ty-download">
        <div>
          <h2>Lleva tus negocios<br />al <span>siguiente nivel</span></h2>
          <p>Descarga la app y disfruta de pagos seguros en cualquier lugar.</p>
        </div>
        <div className="ty-phone" aria-hidden="true">
          <img className="ty-phone-dashboard" src={mobileDashboardPreview} alt="" />
        </div>
        <div className="ty-store-buttons">
          <span>APP DISPONIBLE PRÓXIMAMENTE:</span>
          <button type="button" aria-label="Google Play próximamente"><img src={googlePlayBadge} alt="Google Play" /></button>
          <button type="button" aria-label="App Store próximamente"><img src={appStoreBadge} alt="App Store" /></button>
        </div>
      </section>

      {/* ── FAQ (blanco, accordion) ───────────────────────────── */}
      <section className="ty-sec ty-sec-white" id="faq">
        <div className="ty-sec-inner" style={{ maxWidth: 720, margin: "0 auto" }}>
          <p className="ty-eyebrow ty-r">RESOLVEMOS TUS DUDAS</p>
          <h2 className="ty-headline ty-r" style={{ "--td": ".08s", marginBottom: 36 }}>
            Preguntas <span style={{ color: "var(--ty-green-2)" }}>frecuentes</span>
          </h2>
          <FAQAccordion faqs={faqs} />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="ty-footer">
        <div className="ty-footer-brand">
          <img src={logo} alt="TratoYa" />
          <p>Plataforma de intermediación segura donde el dinero solo se libera cuando ambas partes cumplen lo acordado.</p>
          <div className="ty-socials" aria-label="Redes sociales">
            <a href="https://www.facebook.com/share/18wsfkfi5c/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook"><SocialIcon name="facebook" /></a>
            <a href="https://www.instagram.com/tratoya?igsh=MW5ncTJmMTk5NDhpOQ==" target="_blank" rel="noreferrer" aria-label="Instagram"><SocialIcon name="instagram" /></a>
          </div>
        </div>
        <div>
          <h4>Navegar</h4>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#para-quien">Para compradores y vendedores</a>
          <a href="#simula">Simulador</a>
          <a href="#faq">Preguntas frecuentes</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="/legal/terminos">Términos y condiciones</a>
          <a href="/legal/privacidad">Política de privacidad</a>
          <a href="/legal/cookies">Política de cookies</a>
        </div>
        <div>
          <h4>¿Necesitas ayuda?</h4>
          <a>soporte@tratoya.com</a>
          <a>Lun – Vie: 9:00 a.m. – 6:00 p.m.</a>
        </div>
        <p className="ty-copy">© 2026 TratoYa. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}

/* ── Sub-componentes ─────────────────────────────────────── */

function FAQAccordion({ faqs }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="ty-faq-list">
      {faqs.map(([q, a], i) => (
        <div className="ty-faq-item ty-r" key={q} style={{ "--td": `${i * 0.06}s` }}>
          <button
            className={`ty-faq-q${open === i ? " open" : ""}`}
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{q}</span>
            <span className={`ty-faq-toggle${open === i ? " open" : ""}`}>+</span>
          </button>
          <div className={`ty-faq-a${open === i ? " open" : ""}`}>
            <p>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TratoCalculator({ register }) {
  const [rawMonto, setRawMonto] = useState("");
  const [quien, setQuien] = useState("comprador");
  const monto = Number(String(rawMonto).replace(/\D/g, "")) || 0;
  const calc = monto >= 50000 ? calcularComisionUI(monto, quien) : null;
  const fmtCOP = (n) => (n ? fmt(n) : "—");

  return (
    <div className="ty-calc-box ty-r" style={{ "--td": ".12s" }}>
      <div className="ty-calc-form">
        <div className="ty-calc-field">
          <label>Valor del trato (COP)</label>
          <input
            type="text" inputMode="numeric" className="ty-calc-input"
            placeholder="Ej: 500.000"
            value={rawMonto ? Number(rawMonto).toLocaleString("es-CO") : ""}
            onChange={(e) => setRawMonto(e.target.value.replace(/\D/g, ""))}
          />
          {rawMonto && monto < 50000 && <span className="ty-calc-warn">Mínimo $50.000</span>}
        </div>
        <div className="ty-calc-field">
          <label>¿Quién paga la comisión?</label>
          <select className="ty-calc-input" value={quien} onChange={(e) => setQuien(e.target.value)}>
            <option value="comprador">El comprador</option>
            <option value="vendedor">El vendedor</option>
            <option value="compartida">50% cada uno</option>
          </select>
        </div>
      </div>
      {calc ? (
        <div className="ty-calc-result">
          <div className="ty-calc-row"><span>Valor acordado</span><strong>{fmtCOP(monto)}</strong></div>
          <div className="ty-calc-row"><span>Comisión TratoYa (4.5%)</span><strong>{fmtCOP(calc.comision)}</strong></div>
          <div className="ty-calc-divider" />
          <div className="ty-calc-row ty-calc-highlight"><span>🛒 Comprador paga en total</span><strong>{fmtCOP(calc.totalPagar)}</strong></div>
          <div className="ty-calc-row ty-calc-highlight green"><span>📦 Vendedor recibe</span><strong>{fmtCOP(calc.vendedorRecibe)}</strong></div>
          <p className="ty-calc-note">TratoYa retiene el dinero hasta confirmar la entrega.</p>
          <button className="ty-button" type="button" onClick={register} style={{ width: "100%", minHeight: 48, marginTop: 4, fontSize: 16 }}>
            Crear un trato gratis →
          </button>
        </div>
      ) : (
        <div className="ty-calc-empty">
          <span>💡</span> Ingresa el valor del trato para ver el desglose
        </div>
      )}
    </div>
  );
}

function Counter({ value, prefix = "", suffix = "" }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const duration = 1400, start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      setCurrent(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{prefix}{Number.isInteger(value) ? Math.round(current) : current.toFixed(1)}{suffix}</>;
}

function SocialIcon({ name }) {
  const paths = {
    facebook: <path d="M29 15h5V7h-6c-7 0-11 4-11 11v5h-6v8h6v17h9V31h7l1-8h-8v-4c0-2 1-4 3-4Z" />,
    instagram: <><rect x="8" y="8" width="32" height="32" rx="10" /><circle cx="24" cy="24" r="8" /><circle cx="33" cy="15" r="2" /></>,
  };
  return (
    <svg className="ty-social-icon" viewBox="0 0 48 48" aria-hidden="true">
      <g fill={name === "facebook" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </g>
    </svg>
  );
}

function LIcon({ name }) {
  const paths = {
    shield:  <><path d="M24 5 39 11v11c0 10-6.4 17-15 21-8.6-4-15-11-15-21V11L24 5Z" /><path d="m17 24 5 5 10-12" /></>,
    bolt:    <path d="M27 3 10 27h13l-3 18 18-26H25L27 3Z" />,
    support: <><path d="M10 28v-5a14 14 0 0 1 28 0v5" /><path d="M10 28h7v10h-7zM31 28h7v10h-7z" /><path d="M31 39c-2 2-5 3-9 3" /></>,
    users:   <><path d="M18 22a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM34 23a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" /><path d="M5 40c1-8 6-13 13-13s12 5 13 13M26 31c2-3 5-5 9-5 5 0 9 4 10 11" /></>,
  };
  return (
    <svg className="ty-icon" fill="none" viewBox="0 0 48 48" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</g>
    </svg>
  );
}
