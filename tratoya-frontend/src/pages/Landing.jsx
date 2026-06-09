import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calcularComisionUI, fmt } from "../lib/utils";
import logo from "../assets/tratoya-logo.png";
import stepPaymentProtected from "../assets/step-payment-protected.png";
import stepServiceDelivery from "../assets/step-service-delivery.png";
import stepConfirmation from "../assets/step-confirmation.png";
import stepPaymentRelease from "../assets/step-payment-release.png";
import "../styles/landing-nu.css";

const EASE = [0.22, 1, 0.36, 1];
const TOTAL = 8;
const FLOW_SLIDE = 3;

const FLOW = [
  { n: "01", title: "Acuerdan el trato", desc: "Precio, condiciones y plazos. Un link compartido. Listo.", img: stepPaymentProtected },
  { n: "02", title: "El comprador paga", desc: "Nequi, PSE, Bancolombia o Davivienda. El dinero va a TratoYa, no al vendedor.", img: stepServiceDelivery },
  { n: "03", title: "Se entrega", desc: "Con el pago asegurado, el vendedor cumple lo acordado.", img: stepConfirmation },
  { n: "04", title: "Se libera el pago", desc: "El comprador confirma → TratoYa transfiere al vendedor.", img: stepPaymentRelease },
];

const WHAT_IS = [
  { icon: "🛡️", title: "Intermediario de pagos", body: "Retenemos el dinero hasta que ambos cumplan lo acordado." },
  { icon: "⚖️", title: "Neutral y seguro", body: "Más confiable que transferir directo a un desconocido." },
  { icon: "📱", title: "100% digital", body: "Crea, paga y cobra un trato en minutos desde el celular." },
];

const PROBLEM_BAD = [
  { e: "😟", t: "Pagar directo", d: "Cruzas los dedos. Sin respaldo si algo falla." },
  { e: "🚨", t: "Riesgo real", d: "Bloqueos inesperados, dinero retenido y disputas sin intermediario." },
];

const PROBLEM_GOOD = [
  { e: "✅", t: "Con TratoYa", d: "El dinero queda protegido hasta confirmar la entrega." },
  { e: "🤝", t: "Ambos ganan", d: "Comprador seguro. Vendedor cobra al cumplir." },
];

const TRANSFER_BRANDS = [
  { name: "Nequi", src: "/brand-nequi.svg", cls: "ty-pay-logo--nequi" },
  { name: "Bancolombia", src: "/brand-bancolombia.svg", cls: "ty-pay-logo--bancolombia" },
  { name: "PSE", src: "/brand-pse.png", cls: "ty-pay-logo--pse" },
];

const SAFETY = [
  { icon: "🔒", title: "Dinero protegido", body: "No se mueve hasta que ambos cumplan." },
  { icon: "⚖️", title: "Disputas mediadas", body: "Revisamos evidencia y resolvemos en hasta 72 horas." },
  { icon: "👤", title: "Soporte humano", body: "Personas reales te acompañan si algo sale mal." },
];

const MINI_FAQ = [
  ["¿Y si el vendedor no entrega?", "Abres una disputa. TratoYa retiene el dinero hasta resolver."],
  ["¿El dinero está seguro?", "Sí. Queda en custodia y no se libera sin confirmación."],
  ["¿Cuánto cuesta?", "4.5% + IMP por trato exitoso. Sin costos ocultos."],
];

const EARLY_PERKS = [
  "Cuenta gratis, sin tarjeta",
  "Primer trato en minutos",
  "Acceso anticipado al lanzamiento",
  "Historial y reputación desde el día uno",
];

const COMMISSION_PAYERS = [
  { id: "comprador", label: "Comprador" },
  { id: "vendedor", label: "Vendedor" },
  { id: "compartida", label: "50 / 50" },
];

const FLOW_AUTO_MS = 3200;
const FLOW_ENTER_MS = 680;
const FLOW_FADE = { duration: 0.75, ease: [0.4, 0, 0.2, 1] };

const slideVariants = {
  enter: (dir) => ({
    opacity: 0,
    y: dir > 0 ? 80 : -80,
    scale: 0.94,
    filter: "blur(8px)",
  }),
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE },
  },
  exit: (dir) => ({
    opacity: 0,
    y: dir > 0 ? -60 : 60,
    scale: 0.97,
    filter: "blur(6px)",
    transition: { duration: 0.45, ease: EASE },
  }),
};

export default function Landing({ goAuth }) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);
  const [flowStep, setFlowStep] = useState(0);
  const [flowSlideReady, setFlowSlideReady] = useState(false);
  const [flowManual, setFlowManual] = useState(false);
  const [monto, setMonto] = useState("");
  const [quienComision, setQuienComision] = useState("comprador");
  const touchRef = useRef({ y: 0, t: 0 });
  const flowTouchRef = useRef({ x: 0, y: 0 });
  const wheelLock = useRef(false);
  const flowManualRef = useRef(false);
  const flowManualTimerRef = useRef(null);

  const register = () => goAuth("register");
  const login = () => goAuth("login");

  const go = useCallback((next) => {
    let target = next;
    if (next >= TOTAL) target = 0;
    if (next < 0) target = TOTAL - 1;
    const forward = slide < target || (slide === TOTAL - 1 && target === 0);
    setDir(forward ? 1 : -1);
    setSlide(target);
  }, [slide]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    FLOW.forEach(({ img }) => {
      const pre = new Image();
      pre.src = img;
    });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(slide + 1);
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        go(slide - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, go]);

  useEffect(() => {
    const onWheel = (e) => {
      if (wheelLock.current) return;
      if (Math.abs(e.deltaY) < 30) return;
      wheelLock.current = true;
      go(e.deltaY > 0 ? slide + 1 : slide - 1);
      setTimeout(() => { wheelLock.current = false; }, 700);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [slide, go]);

  const onTouchStart = (e) => {
    touchRef.current = { y: e.touches[0].clientY, t: Date.now() };
  };

  const onTouchEnd = (e) => {
    const dy = touchRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 50) return;
    go(dy > 0 ? slide + 1 : slide - 1);
  };

  const amount = Number(monto.replace(/\D/g, "")) || 0;
  const calc = amount >= 50000 ? calcularComisionUI(amount, quienComision) : null;
  const enableFlowManual = useCallback(() => {
    flowManualRef.current = true;
    setFlowManual(true);
    if (flowManualTimerRef.current) clearTimeout(flowManualTimerRef.current);
    flowManualTimerRef.current = setTimeout(() => {
      flowManualRef.current = false;
      setFlowManual(false);
    }, FLOW_AUTO_MS);
  }, []);

  const setFlow = useCallback((next) => {
    if (next === flowStep) return;
    setFlowStep(next);
    enableFlowManual();
  }, [flowStep, enableFlowManual]);

  const nextFlow = useCallback(() => {
    setFlowStep((s) => (s + 1) % FLOW.length);
  }, []);

  const prevFlow = useCallback(() => {
    setFlowStep((s) => (s - 1 + FLOW.length) % FLOW.length);
  }, []);

  const nextFlowManual = useCallback(() => {
    enableFlowManual();
    nextFlow();
  }, [enableFlowManual, nextFlow]);

  const prevFlowManual = useCallback(() => {
    enableFlowManual();
    prevFlow();
  }, [enableFlowManual, prevFlow]);

  const onFlowTouchStart = (e) => {
    flowTouchRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const onFlowTouchEnd = (e) => {
    const dx = flowTouchRef.current.x - e.changedTouches[0].clientX;
    const dy = flowTouchRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) nextFlowManual();
    else prevFlowManual();
  };

  useEffect(() => {
    if (slide !== FLOW_SLIDE) {
      setFlowSlideReady(false);
      setFlowManual(false);
      flowManualRef.current = false;
      return undefined;
    }

    setFlowStep(0);
    setFlowSlideReady(false);
    setFlowManual(false);
    flowManualRef.current = false;

    const readyTimer = setTimeout(() => setFlowSlideReady(true), FLOW_ENTER_MS);

    let intervalId;
    const startTimer = setTimeout(() => {
      intervalId = setInterval(() => {
        if (flowManualRef.current) return;
        nextFlow();
      }, FLOW_AUTO_MS);
    }, FLOW_AUTO_MS);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
      if (flowManualTimerRef.current) clearTimeout(flowManualTimerRef.current);
    };
  }, [slide, nextFlow]);

  return (
    <div
      className="ty-slide-app"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="ty-ambient" aria-hidden="true">
        <div className="ty-grid" />
        <div className="ty-orb ty-orb--1" />
        <div className="ty-orb ty-orb--2" />
        <div className="ty-scanline" />
      </div>

      <div className="ty-progress" style={{ width: `${((slide + 1) / TOTAL) * 100}%` }} />

      <header className="ty-topbar">
        <img src={logo} alt="TratoYa" />
        <div className="ty-topbar__actions">
          <button className="ty-ghost-btn" type="button" onClick={login}>Entrar</button>
          <button className="ty-neon-btn" type="button" onClick={register}>Crear cuenta</button>
        </div>
      </header>

      <nav className="ty-nav-rail" aria-label="Slides">
        {Array.from({ length: TOTAL }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`ty-nav-dot${slide === i ? " active" : ""}`}
            aria-label={`Slide ${i + 1}`}
            aria-current={slide === i}
            onClick={() => go(i)}
          />
        ))}
      </nav>

      <div className="ty-viewport">
        <AnimatePresence mode="wait" custom={dir}>
          {slide === 0 && (
            <SlideWrap key="s0" dir={dir} fullBleed>
              <div className="ty-slide ty-slide--hero">
                <p className="ty-kicker ty-text-pulse">Intermediario de pagos</p>
                <h1 className="ty-mega ty-mega--hero ty-text-pulse">
                  Compra y vende<br /><span>sin miedo.</span>
                </h1>
                <HeroShowcase />
                <p className="ty-sub ty-sub--hero ty-text-pulse ty-text-pulse--delay">
                  TratoYa retiene el dinero hasta que el trato se cumple.
                </p>
                <div className="ty-cta-stack ty-cta-stack--hero">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega"
                    type="button"
                    onClick={register}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Empezar gratis →
                  </motion.button>
                </div>
              </div>
            </SlideWrap>
          )}

          {slide === 1 && (
            <SlideWrap key="s1" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Qué es TratoYa</p>
                <h2 className="ty-mega ty-text-pulse">
                  Tu trato,<br /><span>protegido.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  Plataforma colombiana que custodia el pago entre comprador y vendedor.
                </p>
                <InfoGrid items={WHAT_IS} />
                <TransferBrands />
              </div>
            </SlideWrap>
          )}

          {slide === 2 && (
            <SlideWrap key="s2" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">El problema</p>
                <h2 className="ty-mega ty-text-pulse">
                  Pagar directo<br /><span>es un riesgo.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  La confianza no basta cuando hay dinero de por medio.
                </p>
                <ContrastGrid bad={PROBLEM_BAD} good={PROBLEM_GOOD} />
                <div className="ty-shield-viz">
                  <ShieldNode label="Comprador" icon={<BuyerIcon />} />
                  <span className="ty-shield-arrow" aria-hidden="true">→</span>
                  <ShieldNode label="TratoYa" logoSrc={logo} core />
                  <span className="ty-shield-arrow" aria-hidden="true">→</span>
                  <ShieldNode label="Vendedor" icon={<SellerIcon />} />
                </div>
              </div>
            </SlideWrap>
          )}

          {slide === 3 && (
            <SlideWrap key="s3" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Cómo funciona</p>
                <h2 className="ty-mega ty-mega--compact ty-text-pulse">
                  4 pasos.<br /><span>Un trato seguro.</span>
                </h2>
                <div className="ty-flow-tabs" role="tablist" aria-label="Pasos del flujo">
                  {FLOW.map((s, i) => (
                    <button
                      key={s.n}
                      type="button"
                      role="tab"
                      aria-selected={flowStep === i}
                      className={`ty-flow-tab${flowStep === i ? " active" : ""}`}
                      onClick={() => setFlow(i)}
                    >
                      {s.n}
                    </button>
                  ))}
                </div>
                <div className={`ty-flow-carousel${flowManual ? " ty-flow-carousel--manual" : ""}`}>
                  <button
                    type="button"
                    className="ty-flow-arrow ty-flow-arrow--prev"
                    aria-label="Paso anterior"
                    onClick={prevFlowManual}
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <div
                    className="ty-flow-stage"
                    onTouchStart={onFlowTouchStart}
                    onTouchEnd={onFlowTouchEnd}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={flowStep}
                        className="ty-holo ty-holo--flow"
                        initial={flowSlideReady ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={FLOW_FADE}
                      >
                        <img src={FLOW[flowStep].img} alt="" decoding="async" />
                        <h3 className="ty-flow-title ty-text-pulse">{FLOW[flowStep].title}</h3>
                        <p className="ty-flow-desc ty-text-pulse ty-text-pulse--delay">{FLOW[flowStep].desc}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    className="ty-flow-arrow ty-flow-arrow--next"
                    aria-label="Paso siguiente"
                    onClick={nextFlowManual}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
              </div>
            </SlideWrap>
          )}

          {slide === 4 && (
            <SlideWrap key="s4" dir={dir}>
              <div className="ty-slide ty-slide--compact">
                <p className="ty-kicker ty-text-pulse">Si algo sale mal</p>
                <h2 className="ty-mega ty-mega--compact ty-text-pulse">
                  No estás<br /><span>solo.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  Tu dinero queda protegido mientras resolvemos.
                </p>
                <InfoGrid items={SAFETY} columns={3} />
                <MiniFaq items={MINI_FAQ} />
              </div>
            </SlideWrap>
          )}

          {slide === 5 && (
            <SlideWrap key="s5" dir={dir}>
              <div className="ty-slide ty-slide--compact">
                <p className="ty-kicker ty-kicker--bolt ty-text-pulse">
                  <span aria-hidden="true">⚡</span> Simula tu trato
                </p>
                <h2 className="ty-mega ty-text-pulse">
                  <span>4.5%</span> + IMP.
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">Sin sorpresas. Simula tu trato ahora.</p>
                <div className="ty-mini-calc">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="$ 500.000"
                    value={monto ? Number(monto).toLocaleString("es-CO") : ""}
                    onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
                  />
                  <div className="ty-commission-pickers" role="group" aria-label="Quién paga la comisión">
                    <span className="ty-commission-pickers__label">La comisión la paga</span>
                    <div className="ty-commission-pickers__opts">
                      {COMMISSION_PAYERS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          className={`ty-commission-opt${quienComision === id ? " active" : ""}`}
                          aria-pressed={quienComision === id}
                          onClick={() => setQuienComision(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {calc && (
                    <motion.div
                      className="ty-calc-out"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={`${amount}-${quienComision}`}
                    >
                      <div className="ty-calc-out__note">
                        {quienComision === "comprador" && "Comisión incluida en lo que paga el comprador"}
                        {quienComision === "vendedor" && "Comisión descontada de lo que recibe el vendedor"}
                        {quienComision === "compartida" && "Comisión dividida 50% comprador · 50% vendedor"}
                      </div>
                      <div><span>Comprador paga</span><strong>{fmt(calc.totalPagar)}</strong></div>
                      <div><span>Vendedor recibe</span><strong>{fmt(calc.vendedorRecibe)}</strong></div>
                    </motion.div>
                  )}
                </div>
              </div>
            </SlideWrap>
          )}

          {slide === 6 && (
            <SlideWrap key="s6" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Antes del lanzamiento</p>
                <h2 className="ty-mega ty-text-pulse">
                  Regístrate<br /><span>ahora.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  Sé de los primeros en usar pagos protegidos entre personas en Colombia.
                </p>
                <EarlyList items={EARLY_PERKS} />
                <div className="ty-cta-stack">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega"
                    type="button"
                    onClick={register}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Crear cuenta gratis →
                  </motion.button>
                </div>
              </div>
            </SlideWrap>
          )}

          {slide === 7 && (
            <SlideWrap key="s7" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Listo para tu primer trato</p>
                <h2 className="ty-mega ty-text-pulse">
                  Haz el negocio.<br /><span>Nosotros cuidamos.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  Registro gratis. Tu primer trato en minutos.
                </p>
                <div className="ty-cta-stack">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega"
                    type="button"
                    onClick={register}
                    whileHover={{ scale: 1.04, boxShadow: "0 0 60px rgba(158,216,25,0.55)" }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Crear cuenta gratis →
                  </motion.button>
                  <div className="ty-cta-links">
                    <a href="/legal/terminos">Términos</a>
                    <a href="/legal/privacidad">Privacidad</a>
                    <a href="mailto:soporte@tratoya.com">Soporte</a>
                  </div>
                </div>
              </div>
            </SlideWrap>
          )}
        </AnimatePresence>
      </div>

      <div className="ty-nav-arrows">
        <button
          type="button"
          className="ty-arrow"
          aria-label="Anterior"
          onClick={() => go(slide - 1)}
        >
          ↑
        </button>
        <span className="ty-slide-counter">
          <em>{String(slide + 1).padStart(2, "0")}</em> / {String(TOTAL).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="ty-arrow"
          aria-label="Siguiente"
          onClick={() => go(slide + 1)}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

function TransferBrands() {
  return (
    <motion.div
      className="ty-transfer-block"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5, ease: EASE }}
    >
      <p className="ty-transfer-block__title">
        Tan fácil como transferir a las cuentas oficiales de TratoYa
      </p>
      <div className="ty-transfer-block__logos" aria-label="Métodos de pago de TratoYa">
        {TRANSFER_BRANDS.map(({ name, src, cls }) => (
          <div className={`ty-pay-logo ${cls}`} key={name}>
            <img src={src} alt={name} loading="lazy" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function HeroShowcase() {
  return (
    <motion.div
      className="ty-hero-showcase"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.65, ease: EASE }}
    >
      <div className="ty-hero-showcase__glow" aria-hidden="true" />
      <img
        src="/hero-app-mockup.png"
        alt="App TratoYa: tratos activos, dinero protegido y pagos seguros"
        loading="eager"
        decoding="async"
      />
    </motion.div>
  );
}

function InfoGrid({ items, columns = 3 }) {
  return (
    <div className={`ty-info-grid ty-info-grid--${columns}`}>
      {items.map((item, i) => (
        <motion.div
          key={item.title}
          className="ty-info-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 + i * 0.08, duration: 0.5, ease: EASE }}
        >
          <span className="ty-info-card__ico" aria-hidden="true">{item.icon}</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

function ContrastGrid({ bad, good }) {
  return (
    <div className="ty-contrast-grid">
      <div className="ty-contrast-col">
        {bad.map((item, i) => (
          <motion.div
            key={item.t}
            className="ty-contrast-card ty-contrast-card--bad"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.45, ease: EASE }}
          >
            <span aria-hidden="true">{item.e}</span>
            <div>
              <strong>{item.t}</strong>
              <p>{item.d}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="ty-contrast-col">
        {good.map((item, i) => (
          <motion.div
            key={item.t}
            className="ty-contrast-card ty-contrast-card--good"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.45, ease: EASE }}
          >
            <span aria-hidden="true">{item.e}</span>
            <div>
              <strong>{item.t}</strong>
              <p>{item.d}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MiniFaq({ items }) {
  return (
    <div className="ty-mini-faq">
      {items.map(([q, a], i) => (
        <motion.div
          key={q}
          className="ty-mini-faq__item"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.07, duration: 0.45, ease: EASE }}
        >
          <strong>{q}</strong>
          <p>{a}</p>
        </motion.div>
      ))}
    </div>
  );
}

function EarlyList({ items }) {
  return (
    <ul className="ty-early-list">
      {items.map((item, i) => (
        <motion.li
          key={item}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.14 + i * 0.07, duration: 0.45, ease: EASE }}
        >
          <span className="ty-check">✓</span>
          {item}
        </motion.li>
      ))}
    </ul>
  );
}

function ShieldNode({ label, icon, logoSrc, core = false }) {
  return (
    <motion.span
      className={`ty-shield-node${core ? " ty-shield-node--core" : ""}`}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="ty-shield-node__icon" aria-hidden="true">
        {logoSrc ? <img src={logoSrc} alt="" /> : icon}
      </span>
      <span className="ty-shield-node__label">{label}</span>
    </motion.span>
  );
}

function BuyerIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="16" fill="rgba(158,216,25,0.14)" />
      <circle cx="20" cy="15" r="4.5" stroke="#9ed819" strokeWidth="2" />
      <path d="M12 29c0-4.5 3.6-7.5 8-7.5s8 3 8 7.5" stroke="#9ed819" strokeWidth="2" strokeLinecap="round" />
      <path d="M25 22l3.5 3.5L33 21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SellerIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="32" height="32" rx="16" fill="rgba(158,216,25,0.14)" />
      <path d="M13 17h14l-1.4 11H14.4L13 17z" stroke="#9ed819" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13 17l2-5h10l2 5" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 21h4" stroke="#9ed819" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SlideWrap({ children, dir, fullBleed = false }) {
  return (
    <motion.div
      className={fullBleed ? "ty-slide-wrap--bleed" : undefined}
      style={{ width: fullBleed ? "100%" : "min(1080px, 100%)" }}
      custom={dir}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
