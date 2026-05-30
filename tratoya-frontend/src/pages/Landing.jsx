import { useEffect, useState } from "react";
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

const miniBenefits = [
  ["shield", "Tu dinero protegido", "Nadie recibe el pago hasta que entreguen"],
  ["bolt", "Rápido y fácil", "Crea un trato en minutos"],
  ["check", "Sin riesgos", "Si algo falla, te ayudamos a resolverlo"],
];

const stats = [
  ["users", 50, "+", "K", "Usuarios"],
  ["bolt", 100, "+", "K", "Transacciones realizadas"],
  ["shield", 99.8, "", "%", "Compras exitosas"],
  ["support", null, "", "", "Soporte", "en cada paso"],
];

const stepAssets = {
  payment: stepPaymentProtected,
  delivery: stepServiceDelivery,
  confirmation: stepConfirmation,
  release: stepPaymentRelease,
};

const steps = [
  ["payment",      "Acuerdan el trato",       "Comprador y vendedor acuerdan el precio y las condiciones del negocio."],
  ["delivery",     "El comprador paga",        "El comprador transfiere el dinero a TratoYa. El vendedor sabe que el pago ya está hecho."],
  ["confirmation", "El vendedor entrega",      "Con el pago asegurado, el vendedor entrega el producto o realiza el servicio."],
  ["release",      "Se libera el dinero",      "El comprador confirma que recibió lo acordado y TratoYa transfiere el pago al vendedor."],
];

const benefits = [
  ["shield", "Nadie pierde dinero",     "El pago solo se libera cuando el comprador confirma que recibió lo que pagó."],
  ["bolt",   "Resolución rápida",        "Si algo sale mal, nuestro equipo interviene y media entre las partes."],
  ["check",  "Cero letra pequeña",       "Sin cobros ocultos, sin contratos complicados. Todo queda registrado en el trato."],
  ["support","Soporte real",             "Personas reales que te acompañan si tienes dudas o algún problema."],
];

const testimonials = [
  ["Carlos M.", "Comprador", "Compré un celular de alto valor con TratoYa. Pagué y no solté el dinero hasta tener el equipo en mis manos. Así sí se puede confiar."],
  ["María R.", "Vendedora", "Mis clientes se sienten seguros pagando por TratoYa y yo recibo mi plata en el momento en que confirman. Sin demoras."],
  ["Juan P.", "Emprendedor", "Usé TratoYa para pagar a un freelance. Todo quedó acordado desde el principio y el proceso fue impecable."],
];

const useCases = [
  ["📱", "Compraventa de celulares",          "Vende o compra equipos sin miedo a estafas o productos dañados."],
  ["💼", "Servicios freelance",               "Acuerda el trabajo, paga por adelantado y libera el dinero cuando esté listo."],
  ["🚗", "Vehículos y motos",                 "Negocios de alto valor con la seguridad de que el dinero está protegido."],
  ["🏠", "Remodelaciones y construcción",     "Paga por avance. El contratista recibe al completar cada etapa."],
  ["👗", "Moda y accesorios",                 "Compra ropa, bolsos y más con la garantía de que es lo que pediste."],
  ["🛠️", "Cualquier servicio o producto",    "Si dos personas acuerdan un precio, TratoYa lo hace seguro."],
];

const faqs = [
  ["¿Cómo funciona exactamente?",
   "El comprador paga a TratoYa, no al vendedor directamente. TratoYa retiene ese dinero hasta que el comprador confirme que recibió el producto o servicio. Solo entonces se libera el pago al vendedor."],
  ["¿Quién puede usar TratoYa?",
   "Cualquier persona en Colombia. Compradores, vendedores, freelancers, emprendedores... si vas a hacer un negocio con alguien, TratoYa lo hace seguro."],
  ["¿Qué pasa si el vendedor no entrega?",
   "Si el vendedor no entrega o entrega algo diferente a lo acordado, el comprador abre una disputa. TratoYa investiga y protege el dinero hasta resolver la situación."],
  ["¿Cuánto cuesta usar TratoYa?",
   "Registrarse es totalmente gratis. TratoYa cobra una pequeña comisión por transacción exitosa, visible antes de confirmar el trato. Sin costos ocultos."],
  ["¿El dinero está seguro mientras TratoYa lo retiene?",
   "Sí. El dinero queda protegido en nuestra plataforma y no se mueve hasta que ambas partes cumplan lo acordado. TratoYa actúa como árbitro neutral."],
  ["¿Qué pasa si hay una disputa?",
   "Si comprador y vendedor no llegan a un acuerdo, el equipo de soporte de TratoYa revisa la evidencia, media entre las partes y toma una decisión para proteger a quien tiene la razón."],
];

export default function Landing({ goAuth }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const register = () => goAuth("register");
  const login    = () => goAuth("login");
  const goBack   = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <main className="ty-landing" id="inicio">
      <button className="public-back" type="button" onClick={goBack} aria-label="Volver">←</button>

      {/* ── TOP SHELL (dark bg: nav + hero + stats) ─────────── */}
      <section className="ty-top-shell">
        <header className="ty-navbar">
          <a className="ty-brand" href="/" aria-label="TratoYa inicio">
            <img src={logo} alt="TratoYa" />
          </a>
          <nav className="ty-nav" aria-label="Navegación principal">
            <a className="is-active" href="#inicio">Inicio</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#para-quien">Para quién</a>
            <a href="#ventajas">Ventajas</a>
            <a href="#faq">Preguntas frecuentes</a>
          </nav>
          <div className="ty-nav-actions">
            <button className="ty-link-btn" type="button" onClick={login}>Iniciar sesión</button>
            <button className="ty-button ty-button-small" type="button" onClick={register}>Regístrate gratis</button>
          </div>
        </header>

        {/* HERO */}
        <section className="ty-hero">
          <div className="ty-hero-copy">
            <h1>
              COMPRA Y VENDE<br />
              CON <span>CONFIANZA</span>
            </h1>
            <p>
              TratoYa cuida el dinero hasta que el producto o servicio sea entregado.
              Simple, seguro y sin riesgos para comprador y vendedor.
            </p>
            <div className="ty-actions">
              <button className="ty-button ty-button-large" type="button" onClick={register}>
                EMPIEZA GRATIS <span aria-hidden="true">›</span>
              </button>
              <a className="ty-play" href="#como-funciona">
                <Icon name="play" /> Cómo funciona
              </a>
            </div>
            <div className="ty-mini-benefits">
              {miniBenefits.map(([icon, title, text]) => (
                <Mini key={title} icon={icon} title={title} text={text} />
              ))}
            </div>
          </div>

          <div className="ty-hero-visual" aria-hidden="true">
            <div className="ty-halo" />
            <img className="ty-hero-photo" src={heroSecureBag} alt="" />
          </div>
        </section>

        {/* STATS */}
        <section className="ty-stats" aria-label="Métricas de confianza">
          {stats.map(([icon, value, prefix, suffix, title, text]) => (
            <StatMini key={title} icon={icon} value={value} prefix={prefix} suffix={suffix} title={title} text={text} />
          ))}
        </section>
      </section>

      {/* ── ¿QUÉ ES TRATOYA? ─────────────────────────────────── */}
      <section className="ty-section ty-what" id="que-es">
        <p className="ty-eyebrow">EN POCAS PALABRAS</p>
        <h2>¿Qué es <span>TratoYa?</span></h2>
        <p className="ty-what-desc">
          TratoYa es una plataforma donde comprador y vendedor pueden hacer negocios sin riesgo.
          El comprador paga, <strong>TratoYa retiene el dinero</strong>, y solo lo libera
          cuando el producto o servicio fue entregado correctamente.
          Nadie sale perjudicado.
        </p>
        <div className="ty-what-cards">
          <div className="ty-what-card">
            <span className="ty-what-ico">🛒</span>
            <strong>Si eres comprador</strong>
            <p>Pagas con seguridad. Tu dinero no llega al vendedor hasta que confirmes que recibiste lo acordado.</p>
          </div>
          <div className="ty-what-card">
            <span className="ty-what-ico">📦</span>
            <strong>Si eres vendedor</strong>
            <p>Sabes que el dinero ya está reservado antes de entregar. Cuando entregues, se te paga de inmediato.</p>
          </div>
          <div className="ty-what-card">
            <span className="ty-what-ico">⚖️</span>
            <strong>Si hay un problema</strong>
            <p>TratoYa actúa como árbitro neutral, revisa la situación y protege a quien tiene la razón.</p>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ─────────────────────────────────────── */}
      <section className="ty-section ty-how" id="como-funciona">
        <p className="ty-eyebrow">4 PASOS SIMPLES</p>
        <h2>Así funciona <span>TratoYa</span></h2>
        <div className="ty-steps">
          {steps.map(([icon, title, text], index) => (
            <article className="ty-step" key={title}>
              <b>{index + 1}</b>
              <div className="ty-step-icon ty-step-image">
                <img src={stepAssets[icon]} alt="" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── PARA COMPRADORES Y VENDEDORES ────────────────────── */}
      <section className="ty-section ty-for-who" id="para-quien">
        <p className="ty-eyebrow">PARA TODOS</p>
        <h2>Diseñado para <span>ambas partes</span></h2>
        <div className="ty-two-col" style={{ marginTop: 32 }}>
          <div className="ty-role-card ty-role-buyer">
            <div className="ty-role-header">
              <span className="ty-role-ico">🛒</span>
              <h3>Para compradores</h3>
            </div>
            <ul className="ty-role-list">
              <li>✅ Pagas y tu dinero queda protegido, no va directo al vendedor</li>
              <li>✅ Si el producto no llega o no es lo que acordaste, no pierdes tu dinero</li>
              <li>✅ Confirmas la entrega antes de liberar el pago</li>
              <li>✅ Puedes abrir una disputa si algo sale mal</li>
              <li>✅ Historial de todos tus tratos en un solo lugar</li>
            </ul>
            <button className="ty-button" type="button" onClick={() => goAuth("register")} style={{ marginTop: 20, minHeight: 48, padding: "0 22px", fontSize: 15 }}>
              Comprar con seguridad
            </button>
          </div>
          <div className="ty-role-card ty-role-seller">
            <div className="ty-role-header">
              <span className="ty-role-ico">📦</span>
              <h3>Para vendedores</h3>
            </div>
            <ul className="ty-role-list">
              <li>✅ El comprador ya pagó antes de que entregues. Cero riesgo de no cobrar</li>
              <li>✅ El dinero se libera en cuanto el comprador confirma la entrega</li>
              <li>✅ Puedes compartir un link del trato para que te paguen fácil</li>
              <li>✅ Respaldo ante cualquier disputa injustificada</li>
              <li>✅ Construyes reputación como vendedor confiable</li>
            </ul>
            <button className="ty-button" type="button" onClick={() => goAuth("register")} style={{ marginTop: 20, minHeight: 48, padding: "0 22px", fontSize: 15 }}>
              Vender con garantía
            </button>
          </div>
        </div>
      </section>

      {/* ── USOS FRECUENTES ──────────────────────────────────── */}
      <section className="ty-section ty-uses" id="usos">
        <p className="ty-eyebrow">PARA QUÉ SE USA</p>
        <h2>Usos <span>frecuentes</span></h2>
        <p className="ty-uses-desc">Si acuerdas un precio con alguien, TratoYa lo hace seguro.</p>
        <div className="ty-use-grid">
          {useCases.map(([emoji, title, text]) => (
            <div className="ty-use-card" key={title}>
              <span className="ty-use-ico">{emoji}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ¿POR QUÉ TRATOYA? (VENTAJAS) ─────────────────────── */}
      <section className="ty-why" id="ventajas">
        <div className="ty-person">
          <img src={whyModelFemale} alt="Usuaria revisando un trato seguro" />
        </div>
        <div className="ty-why-content" id="seguridad">
          <h2>¿POR QUÉ ELEGIR <span>TRATOYA?</span></h2>
          <div className="ty-benefit-grid">
            {benefits.map(([icon, title, text], index) => (
              <article className="ty-benefit" key={title} style={{ animationDelay: `${index * 0.22}s` }}>
                <Icon name={icon} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── EL PROBLEMA QUE RESOLVEMOS ───────────────────────── */}
      <section className="ty-section ty-problem">
        <p className="ty-eyebrow">EL PROBLEMA</p>
        <h2>Hacer negocios online<br /><span>debería ser seguro</span></h2>
        <div className="ty-problem-grid">
          <div className="ty-problem-side">
            <div className="ty-problem-item bad">
              <span>😟</span>
              <div>
                <strong>Sin TratoYa</strong>
                <p>Pagas y cruzas los dedos. O entregas y esperas que te paguen. La confianza no debería ser el único mecanismo de seguridad.</p>
              </div>
            </div>
            <div className="ty-problem-item bad">
              <span>🚨</span>
              <div>
                <strong>El riesgo es real</strong>
                <p>Las estafas en compras y ventas entre personas son el problema más común en el comercio digital. Le pasa a cualquiera.</p>
              </div>
            </div>
          </div>
          <div className="ty-problem-side">
            <div className="ty-problem-item good">
              <span>✅</span>
              <div>
                <strong>Con TratoYa</strong>
                <p>El dinero queda en manos de TratoYa, no del vendedor. Se libera solo cuando el comprador confirma que recibió lo que pagó.</p>
              </div>
            </div>
            <div className="ty-problem-item good">
              <span>🤝</span>
              <div>
                <strong>Ambos ganan</strong>
                <p>El comprador tiene la certeza de que no pierde. El vendedor tiene la certeza de que cobra. Así se hacen buenos negocios.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ──────────────────────────────────────── */}
      <section className="ty-section ty-testimonials">
        <div className="ty-title-row">
          <h2>LO QUE DICEN<br /><span>NUESTROS USUARIOS</span></h2>
          <p aria-label="Calificación 4.9 de 5">★★★★★ <small>4.9/5 en más de 2,000 reseñas</small></p>
        </div>
        <div className="ty-cards">
          {testimonials.map(([name, role, text], index) => (
            <article className="ty-card" key={name}>
              <div className="ty-avatar" aria-hidden="true">{index + 1}</div>
              <span className="ty-quote">"</span>
              <p>{text}</p>
              <strong>{name}</strong>
              <small>{role}</small>
            </article>
          ))}
        </div>
      </section>

      {/* ── DESCARGA / CTA ───────────────────────────────────── */}
      <section className="ty-download">
        <div>
          <h2>Haz tu próximo negocio<br />con <span>total seguridad</span></h2>
          <p>Regístrate gratis y crea tu primer trato en minutos. Sin complicaciones.</p>
          <button className="ty-button" type="button" onClick={register} style={{ marginTop: 22, minHeight: 52, padding: "0 28px", fontSize: 17 }}>
            CREAR MI CUENTA GRATIS <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="ty-phone" aria-hidden="true">
          <img className="ty-phone-dashboard" src={mobileDashboardPreview} alt="" />
        </div>
        <div className="ty-store-buttons">
          <span>APP DISPONIBLE PRÓXIMAMENTE:</span>
          <button type="button" aria-label="Google Play próximamente">
            <img src={googlePlayBadge} alt="Google Play" />
          </button>
          <button type="button" aria-label="App Store próximamente">
            <img src={appStoreBadge} alt="App Store" />
          </button>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="ty-faq" id="faq">
        <h2>Preguntas frecuentes</h2>
        <div>
          {faqs.map(([q, a]) => (
            <article key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="ty-footer">
        <div className="ty-footer-brand">
          <img src={logo} alt="TratoYa" />
          <p>Plataforma de intermediación segura donde el dinero solo se libera cuando ambas partes cumplen lo acordado.</p>
          <div className="ty-socials" aria-label="Redes sociales">
            <a href="https://www.facebook.com/share/18wsfkfi5c/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook TratoYa"><SocialIcon name="facebook" /></a>
            <a href="https://www.instagram.com/tratoya?igsh=MW5ncTJmMTk5NDhpOQ==" target="_blank" rel="noreferrer" aria-label="Instagram TratoYa"><SocialIcon name="instagram" /></a>
          </div>
        </div>
        <div>
          <h4>Navegar</h4>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#para-quien">Para compradores y vendedores</a>
          <a href="#ventajas">Ventajas</a>
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

/* ── Sub-componentes ─────────────────────────────────────────── */

function StatMini({ icon, value, prefix = "", suffix = "", title, text }) {
  return (
    <div className="ty-mini ty-stat-mini">
      <Icon name={icon} />
      <div>
        <strong>{value == null ? title : <Counter value={value} prefix={prefix} suffix={suffix} />}</strong>
        <p>{value == null ? text : title}</p>
      </div>
    </div>
  );
}

function Counter({ value, prefix = "", suffix = "" }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const duration = 1400;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const formatted = Number.isInteger(value) ? Math.round(current) : current.toFixed(1);
  return <>{prefix}{formatted}{suffix}</>;
}

function Mini({ icon, title, text }) {
  return (
    <div className="ty-mini">
      <Icon name={icon} />
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
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

function Icon({ name }) {
  const common = {
    fill: "none",
    viewBox: "0 0 48 48",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
  };
  const paths = {
    shield:     <><path d="M24 5 39 11v11c0 10-6.4 17-15 21-8.6-4-15-11-15-21V11L24 5Z" /><path d="m17 24 5 5 10-12" /></>,
    bolt:       <path d="M27 3 10 27h13l-3 18 18-26H25L27 3Z" />,
    check:      <><circle cx="24" cy="24" r="17" /><path d="m15 24 6 6 13-14" /></>,
    support:    <><path d="M10 28v-5a14 14 0 0 1 28 0v5" /><path d="M10 28h7v10h-7zM31 28h7v10h-7z" /><path d="M31 39c-2 2-5 3-9 3" /></>,
    users:      <><path d="M18 22a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM34 23a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" /><path d="M5 40c1-8 6-13 13-13s12 5 13 13M26 31c2-3 5-5 9-5 5 0 9 4 10 11" /></>,
    play:       <><circle cx="24" cy="24" r="20" /><path d="m20 16 14 8-14 8V16Z" /></>,
    "user-money":<><circle cx="18" cy="16" r="7" /><path d="M6 39c1.4-8 6-12 12-12s10.6 4 12 12" /><circle cx="35" cy="28" r="9" /><path d="M35 22v12M31.5 25.5h5.2a2.6 2.6 0 0 1 0 5.2h-5.2" /></>,
    box:        <><path d="M8 15 24 7l16 8-16 8-16-8Z" /><path d="M10 17v17l14 7 14-7V17M24 23v18" /><path d="m31 30 3.7 3.7L41 26" /></>,
    handshake:  <><path d="M7 25 14 13l10 6M41 25 34 13l-10 6" /><path d="m16 25 8-7 8 7 5 5a4.5 4.5 0 0 1-6.4 6.4L24 30" /><path d="m18 30 6 6M13 28l8 8M30 18l-8 7" /></>,
    wallet:     <><path d="M8 15h29a5 5 0 0 1 5 5v18H8a4 4 0 0 1-4-4V19a4 4 0 0 1 4-4Z" /><path d="M10 15 34 9v6" /><path d="M31 26h13v9H31a4.5 4.5 0 0 1 0-9Z" /><circle cx="36" cy="30.5" r="1.6" /></>,
  };
  return (
    <svg className="ty-icon" {...common}>
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {paths[name] || paths.check}
      </g>
    </svg>
  );
}
