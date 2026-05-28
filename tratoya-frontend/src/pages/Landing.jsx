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
  ["shield", "100% seguro", "Tu dinero protegido en cada paso"],
  ["bolt", "Rápido", "Transacciones al instante"],
  ["check", "Sin complicaciones", "Fácil, claro y transparente"],
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
  ["payment", "Pago protegido", "El comprador realiza el pago y lo mantenemos seguro hasta cumplir el trato."],
  ["delivery", "Entrega o servicio", "El vendedor entrega el producto o realiza el servicio acordado."],
  ["confirmation", "Confirmación", "El comprador confirma que todo está correcto."],
  ["release", "Liberación del pago", "Liberamos el pago al vendedor. Todos ganan."],
];

const benefits = [
  ["shield", "Máxima seguridad", "Tu dinero está protegido en todo momento."],
  ["bolt", "Rapidez", "Transacciones al instante, sin demoras."],
  ["check", "Sin complicaciones", "Proceso simple, claro y transparente."],
  ["support", "Soporte real", "Estamos contigo en cada paso del proceso."],
];

const testimonials = [
  ["Carlos M.", "Comprador", "TratoYa me dio la confianza que necesitaba para comprar en línea. Mi dinero estuvo protegido hasta que recibí lo que compré."],
  ["María R.", "Vendedora", "Como vendedora, me encanta porque recibo mi pago al instante cuando el comprador confirma. Súper fácil."],
  ["Juan P.", "Emprendedor", "La mejor plataforma para hacer negocios online. Rápida, segura y sin complicaciones."],
];

export default function Landing({ goAuth }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const register = () => goAuth("register");
  const login = () => goAuth("login");
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <main className="ty-landing" id="inicio">
      <button className="public-back" type="button" onClick={goBack} aria-label="Volver">←</button>
      <section className="ty-top-shell">
        <header className="ty-navbar">
          <a className="ty-brand" href="/" aria-label="TratoYa inicio">
            <img src={logo} alt="TratoYa" />
          </a>
          <nav className="ty-nav" aria-label="Navegacion principal">
            <a className="is-active" href="#inicio">Inicio</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#ventajas">Ventajas</a>
            <a href="#seguridad">Seguridad</a>
            <a href="#faq">Preguntas frecuentes</a>
          </nav>
          <div className="ty-nav-actions">
            <button className="ty-link-btn" type="button" onClick={login}>Iniciar sesión</button>
            <button className="ty-button ty-button-small" type="button" onClick={register}>Regístrate gratis</button>
          </div>
        </header>

        <section className="ty-hero">
          <div className="ty-hero-copy">
            <h1>
              TU PAGO SEGURO
              <br />
              HASTA <span>EL FINAL</span>
            </h1>
            <p>
              Intermediación segura para compras y ventas en línea.
              Protegemos tu dinero hasta que ambas partes cumplan.
            </p>
            <div className="ty-actions">
              <button className="ty-button ty-button-large" type="button" onClick={register}>
                ÚNETE GRATIS <span aria-hidden="true">›</span>
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

        <section className="ty-stats" aria-label="Metricas de confianza">
          {stats.map(([icon, value, prefix, suffix, title, text]) => (
            <StatMini key={title} icon={icon} value={value} prefix={prefix} suffix={suffix} title={title} text={text} />
          ))}
        </section>
      </section>

      <section className="ty-section ty-how" id="como-funciona">
        <p className="ty-eyebrow">ASÍ DE FÁCIL</p>
        <h2>¿Cómo funciona <span>TratoYa?</span></h2>
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

      <section className="ty-section ty-testimonials">
        <div className="ty-title-row">
          <h2>LO QUE DICEN<br /><span>NUESTROS USUARIOS</span></h2>
          <p aria-label="Calificación 4.9 de 5">★★★★★ <small>4.9/5 en más de 2,000 reseñas</small></p>
        </div>
        <div className="ty-cards">
          {testimonials.map(([name, role, text], index) => (
            <article className="ty-card" key={name}>
              <div className="ty-avatar" aria-hidden="true">{index + 1}</div>
              <span className="ty-quote">“</span>
              <p>{text}</p>
              <strong>{name}</strong>
              <small>{role}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="ty-download">
        <div>
          <h2>Lleva tus negocios<br />al <span>siguiente nivel</span></h2>
          <p>Descarga la app y disfruta la experiencia de pagos seguros en cualquier lugar.</p>
        </div>
        <div className="ty-phone" aria-hidden="true">
          <img className="ty-phone-dashboard" src={mobileDashboardPreview} alt="" />
        </div>
        <div className="ty-store-buttons">
          <span>DISPONIBLE PRÓXIMAMENTE EN:</span>
          <button type="button" aria-label="Google Play próximamente">
            <img src={googlePlayBadge} alt="Google Play" />
          </button>
          <button type="button" aria-label="App Store próximamente">
            <img src={appStoreBadge} alt="App Store" />
          </button>
        </div>
      </section>

      <section className="ty-faq" id="faq">
        <h2>Preguntas frecuentes</h2>
        <div>
          <article><h3>¿TratoYa recibe el dinero?</h3><p>Sí. El pago queda protegido hasta que ambas partes confirmen que el trato se cumplió.</p></article>
          <article><h3>¿Puedo registrarme gratis?</h3><p>Sí. Crear cuenta no tiene costo y puedes empezar a publicar o comprar de inmediato.</p></article>
          <article><h3>¿Qué pasa si hay un problema?</h3><p>El equipo de soporte revisa la disputa y acompaña la mediación para proteger el pago.</p></article>
        </div>
      </section>

      <footer className="ty-footer">
        <div className="ty-footer-brand">
          <img src={logo} alt="TratoYa" />
          <p>Plataforma de pagos seguros que protege tu dinero hasta que ambas partes cumplan.</p>
          <div className="ty-socials" aria-label="Redes sociales">
            <a href="https://www.facebook.com/share/18wsfkfi5c/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook TratoYa"><SocialIcon name="facebook" /></a>
            <a href="https://www.instagram.com/tratoya?igsh=MW5ncTJmMTk5NDhpOQ==" target="_blank" rel="noreferrer" aria-label="Instagram TratoYa"><SocialIcon name="instagram" /></a>
          </div>
        </div>
        <div>
          <h4>Enlaces rapidos</h4>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#ventajas">Ventajas</a>
          <a href="#seguridad">Seguridad</a>
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
          <a>Lun - Vie: 9:00 a.m. - 6:00 p.m.</a>
        </div>
        <p className="ty-copy">© 2026 TratoYa. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}

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
    shield: <><path d="M24 5 39 11v11c0 10-6.4 17-15 21-8.6-4-15-11-15-21V11L24 5Z" /><path d="m17 24 5 5 10-12" /></>,
    bolt: <path d="M27 3 10 27h13l-3 18 18-26H25L27 3Z" />,
    check: <><circle cx="24" cy="24" r="17" /><path d="m15 24 6 6 13-14" /></>,
    support: <><path d="M10 28v-5a14 14 0 0 1 28 0v5" /><path d="M10 28h7v10h-7zM31 28h7v10h-7z" /><path d="M31 39c-2 2-5 3-9 3" /></>,
    users: <><path d="M18 22a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM34 23a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" /><path d="M5 40c1-8 6-13 13-13s12 5 13 13M26 31c2-3 5-5 9-5 5 0 9 4 10 11" /></>,
    play: <><circle cx="24" cy="24" r="20" /><path d="m20 16 14 8-14 8V16Z" /></>,
    "user-money": <><circle cx="18" cy="16" r="7" /><path d="M6 39c1.4-8 6-12 12-12s10.6 4 12 12" /><circle cx="35" cy="28" r="9" /><path d="M35 22v12M31.5 25.5h5.2a2.6 2.6 0 0 1 0 5.2h-5.2" /></>,
    box: <><path d="M8 15 24 7l16 8-16 8-16-8Z" /><path d="M10 17v17l14 7 14-7V17M24 23v18" /><path d="m31 30 3.7 3.7L41 26" /></>,
    handshake: <><path d="M7 25 14 13l10 6M41 25 34 13l-10 6" /><path d="m16 25 8-7 8 7 5 5a4.5 4.5 0 0 1-6.4 6.4L24 30" /><path d="m18 30 6 6M13 28l8 8M30 18l-8 7" /></>,
    wallet: <><path d="M8 15h29a5 5 0 0 1 5 5v18H8a4 4 0 0 1-4-4V19a4 4 0 0 1 4-4Z" /><path d="M10 15 34 9v6" /><path d="M31 26h13v9H31a4.5 4.5 0 0 1 0-9Z" /><circle cx="36" cy="30.5" r="1.6" /></>,
  };

  return (
    <svg className="ty-icon" {...common}>
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {paths[name] || paths.check}
      </g>
    </svg>
  );
}
