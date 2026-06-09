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
const TOTAL = 5;

const FLOW = [
  { n: "01", title: "Acuerdan", desc: "Precio y condiciones. Un link. Listo.", img: stepPaymentProtected },
  { n: "02", title: "Paga", desc: "Paga fácil por Nequi, PSE o Bancolombia. El dinero va a TratoYa, no al vendedor.", img: stepServiceDelivery },
  { n: "03", title: "Entrega", desc: "Con el pago asegurado, se cumple el trato.", img: stepConfirmation },
  { n: "04", title: "Cobra", desc: "Confirmada la entrega → dinero liberado.", img: stepPaymentRelease },
];

const COMMISSION_PAYERS = [
  { id: "comprador", label: "Comprador" },
  { id: "vendedor", label: "Vendedor" },
  { id: "compartida", label: "50 / 50" },
];

const FLOW_AUTO_MS = 3000;
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

  const register = () => goAuth("register");
  const login = () => goAuth("login");

  const go = useCallback((next) => {
    if (next < 0 || next >= TOTAL) return;
    setDir(next > slide ? 1 : -1);
    setSlide(next);
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
    if (Math.abs(dy) > 50) go(dy > 0 ? slide + 1 : slide - 1);
  };

  const amount = Number(monto.replace(/\D/g, "")) || 0;
  const calc = amount >= 50000 ? calcularComisionUI(amount, quienComision) : null;
  const flow = FLOW[flowStep];

  const enableFlowManual = useCallback(() => {
    flowManualRef.current = true;
    setFlowManual(true);
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
    if (slide !== 2) {
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
            <SlideWrap key="s0" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Intermediario de pagos</p>
                <h1 className="ty-mega ty-text-pulse">
                  Compra y vende<br /><span>sin miedo.</span>
                </h1>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">
                  TratoYa retiene el dinero hasta que el trato se cumple. Nadie pierde.
                </p>
                <PaymentMethods />
                <div className="ty-cta-stack">
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
                <p className="ty-kicker ty-text-pulse">El problema</p>
                <h2 className="ty-mega ty-text-pulse">
                  Pagar directo<br /><span>es un riesgo.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">Estafas, no-shows, disputas sin respaldo. La confianza no basta.</p>
                <div className="ty-shield-viz">
                  <ShieldNode label="Comprador" icon={<BuyerIcon />} />
                  <span className="ty-shield-arrow" aria-hidden="true">→</span>
                  <ShieldNode label="TratoYa" logoSrc={logo} core />
                  <span className="ty-shield-arrow" aria-hidden="true">→</span>
                  <ShieldNode label="Vendedor" icon={<SellerIcon />} />
                </div>
                <p className="ty-sub" style={{ marginTop: 28, color: "var(--ty-neon)", fontWeight: 800 }}>
                  El dinero solo se mueve cuando ambos cumplen.
                </p>
              </div>
            </SlideWrap>
          )}

          {slide === 2 && (
            <SlideWrap key="s2" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Cómo funciona</p>
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
                        <img src={flow.img} alt="" decoding="async" />
                        <h3 className="ty-flow-title ty-text-pulse">{flow.title}</h3>
                        <p className="ty-flow-desc ty-text-pulse ty-text-pulse--delay">{flow.desc}</p>
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

          {slide === 3 && (
            <SlideWrap key="s3" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Transparente</p>
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

          {slide === 4 && (
            <SlideWrap key="s4" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker ty-text-pulse">Listo para tu primer trato</p>
                <h2 className="ty-mega ty-text-pulse">
                  Haz el negocio.<br /><span>Nosotros cuidamos.</span>
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">Registro gratis. Primer trato en minutos.</p>
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
          disabled={slide === 0}
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
          disabled={slide === TOTAL - 1}
          onClick={() => go(slide + 1)}
        >
          ↓
        </button>
      </div>
    </div>
  );
}

const PAYMENT_BRANDS = [
  { name: "Nequi", src: "/brand-nequi.svg", cls: "ty-pay-logo--nequi" },
  { name: "Bancolombia", src: "/brand-bancolombia.svg", cls: "ty-pay-logo--bancolombia" },
  { name: "Davivienda", src: "/brand-davivienda.png", cls: "ty-pay-logo--davivienda" },
  { name: "PSE — Pagos Seguros en Línea", src: "/brand-pse.png", cls: "ty-pay-logo--pse" },
];

function PaymentMethods() {
  const track = [...PAYMENT_BRANDS, ...PAYMENT_BRANDS];

  return (
    <div className="ty-pay-methods">
      <p className="ty-pay-methods__title">Paga fácil con</p>
      <div className="ty-pay-marquee" aria-label="Métodos de pago disponibles">
        <div className="ty-pay-marquee__track">
          {track.map(({ name, src, cls }, i) => (
            <div className={`ty-pay-logo ${cls}`} key={`${name}-${i}`}>
              <img src={src} alt={name} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="#1a4a6e" />
      <circle cx="20" cy="14.5" r="6" fill="#7ec8ff" />
      <path d="M9 33c0-6 4.9-10 11-10s11 4 11 10" fill="#5eb8ff" />
    </svg>
  );
}

function SellerIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="#5c3a10" />
      <circle cx="15" cy="14" r="4.5" fill="#ffcc80" />
      <path d="M8 30c0-4.5 3.2-7.5 7-7.5s7 3 7 7.5" fill="#ffb74d" />
      <path d="M24 22h9l-1.5 9H18.5L17 22h7z" fill="#f4a340" stroke="#fff3e0" strokeWidth="1" />
      <path d="M24 22l1.8-5.5h5.4L33 22" fill="#e87828" />
      <circle cx="27.5" cy="29" r="1.2" fill="#fff" />
      <circle cx="31.5" cy="29" r="1.2" fill="#fff" />
    </svg>
  );
}

function SlideWrap({ children, dir }) {
  return (
    <motion.div
      style={{ width: "min(1080px, 100%)" }}
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
