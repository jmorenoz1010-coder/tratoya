import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calcularComisionUI, fmt } from "../lib/utils";
import { track } from "../lib/analytics";
import logo from "../assets/tratoya-logo.png";
import stepPaymentProtected from "../assets/step-payment-protected.webp";
import stepServiceDelivery from "../assets/step-service-delivery.webp";
import stepConfirmation from "../assets/step-confirmation.webp";
import stepPaymentRelease from "../assets/step-payment-release.webp";
import "../styles/landing-nu.css";

const EASE = [0.22, 1, 0.36, 1];
const TOTAL = 8;
const FLOW_SLIDE = 3;

// Arranque de la secuencia cinematográfica del hero (rápido: el CTA
// debe ser visible en menos de ~1.7s para no perder tráfico de campañas)
const HERO_T = 0.35;
// Trayectorias de las partículas de la detonación (determinísticas)
const BOOM_PARTICLES = [
  { x: -150, y: -84, s: 1 }, { x: 142, y: -66, s: 0.7 }, { x: -98, y: -120, s: 0.85 },
  { x: 118, y: -116, s: 0.6 }, { x: -170, y: 12, s: 0.65 }, { x: 168, y: 24, s: 0.9 },
  { x: -120, y: 84, s: 0.75 }, { x: 132, y: 92, s: 0.6 }, { x: -52, y: -150, s: 0.7 },
  { x: 58, y: -142, s: 0.95 }, { x: -34, y: 118, s: 0.6 }, { x: 44, y: 128, s: 0.8 },
  { x: -188, y: -40, s: 0.55 }, { x: 192, y: -28, s: 0.7 },
];

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

const TRANSFER_BRANDS = [
  { name: "Nequi", src: "/brand-nequi.svg", cls: "ty-pay-logo--nequi" },
  { name: "Bancolombia", src: "/brand-bancolombia.svg", cls: "ty-pay-logo--bancolombia" },
  { name: "PSE", src: "/brand-pse.png", cls: "ty-pay-logo--pse" },
];

const SAFETY_SHOW = [
  { id: "protegido", icon: "🔒", tab: "Protegido", title: "Dinero protegido", body: "No se mueve hasta que ambos cumplan." },
  { id: "disputas", icon: "⚖️", tab: "Disputas", title: "Disputas mediadas", body: "Revisamos evidencia y resolvemos en hasta 72 horas." },
  { id: "soporte", icon: "👤", tab: "Soporte", title: "Soporte humano", body: "Personas reales te acompañan si algo sale mal." },
];

const MINI_FAQ = [
  ["¿Y si el vendedor no entrega?", "Abres una disputa, revisamos la evidencia y si tienes razón te devolvemos el 100% de tu dinero."],
  ["¿El dinero está seguro?", "Sí. Queda en custodia y no se libera sin confirmación."],
  ["¿Cuánto cuesta?", "4.5% + 4×1000 por trato exitoso. Sin costos ocultos."],
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
  const [flowDir, setFlowDir] = useState(1);
  const [flowSlideReady, setFlowSlideReady] = useState(false);
  const [flowManual, setFlowManual] = useState(false);
  const [monto, setMonto] = useState("");
  const [quienComision, setQuienComision] = useState("comprador");
  const touchRef = useRef({ y: 0, t: 0 });
  const flowTouchRef = useRef({ x: 0, y: 0 });
  const wheelLock = useRef(false);
  const flowManualRef = useRef(false);
  const flowManualTimerRef = useRef(null);

  const register = () => {
    track("cta_register_click", { slide });
    goAuth("register");
  };
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

  // ── Simulación automática (slide 6): teclea 500.000, muestra el
  //    desglose, espera, limpia y deja la barra al usuario ──────────
  const AUTO_SIM_VALUE = "500000";
  const autoSimDoneRef = useRef(false);
  const autoSimTimersRef = useRef([]);
  const [autoSimRunning, setAutoSimRunning] = useState(false);

  const cancelAutoSim = useCallback((clearInput = false) => {
    autoSimTimersRef.current.forEach(clearTimeout);
    autoSimTimersRef.current = [];
    autoSimDoneRef.current = true;
    setAutoSimRunning(false);
    if (clearInput) setMonto("");
  }, []);

  useEffect(() => {
    if (slide !== 5 || autoSimDoneRef.current) return undefined;
    const timers = autoSimTimersRef.current;
    setAutoSimRunning(true);
    // Tecleo suave dígito a dígito (240ms por tecla)
    const TYPE_MS = 240;
    AUTO_SIM_VALUE.split("").forEach((_, i) => {
      timers.push(setTimeout(() => setMonto(AUTO_SIM_VALUE.slice(0, i + 1)), 1200 + i * TYPE_MS));
    });
    const typedAt = 1200 + AUTO_SIM_VALUE.length * TYPE_MS;
    // Recorre los 3 escenarios de comisión, con pausa para leer cada uno
    const SCENARIO_MS = 1900;
    timers.push(setTimeout(() => setQuienComision("vendedor"), typedAt + SCENARIO_MS));
    timers.push(setTimeout(() => setQuienComision("compartida"), typedAt + SCENARIO_MS * 2));
    timers.push(setTimeout(() => setQuienComision("comprador"), typedAt + SCENARIO_MS * 3));
    // Cierra: limpia la barra y le entrega el control al usuario
    timers.push(setTimeout(() => {
      setMonto("");
      autoSimDoneRef.current = true;
      setAutoSimRunning(false);
    }, typedAt + SCENARIO_MS * 3 + 900));
    return () => {
      timers.forEach(clearTimeout);
      autoSimTimersRef.current = [];
      setAutoSimRunning(false);
    };
  }, [slide]);

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
    setFlowDir(next > flowStep ? 1 : -1);
    setFlowStep(next);
    enableFlowManual();
  }, [flowStep, enableFlowManual]);

  const nextFlow = useCallback(() => {
    setFlowDir(1);
    setFlowStep((s) => (s + 1) % FLOW.length);
  }, []);

  const prevFlow = useCallback(() => {
    setFlowDir(-1);
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
                <HeroBoom />

                <motion.p
                  className="ty-kicker"
                  initial={{ opacity: 0, y: -16, letterSpacing: "0.55em" }}
                  animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
                  transition={{ delay: HERO_T + 1.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  Intermediario de pagos
                </motion.p>

                {/* Titular con sacudida de cámara al impactar las palabras */}
                <motion.h1
                  className="ty-mega ty-mega--hero"
                  animate={{ x: [0, -7, 6, -4, 2, 0], y: [0, 3, -2, 2, -1, 0] }}
                  transition={{ delay: HERO_T + 0.35, duration: 0.45, ease: "easeOut" }}
                >
                  <span className="ty-heroline">
                    {["Compra", "y", "vende"].map((w, i) => (
                      <motion.span
                        key={`${w}-${i}`}
                        className="ty-zoomword"
                        initial={{ opacity: 0, scale: 3.4, filter: "blur(18px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        transition={{ delay: HERO_T + 0.05 + i * 0.11, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {w}
                      </motion.span>
                    ))}
                  </span>
                  <br />
                  <span className="ty-hero-accent">
                    {"sin miedo.".split("").map((ch, i) => (
                      <motion.span
                        key={`ch-${i}`}
                        className="ty-glitchletter"
                        initial={{ opacity: 0, y: 28, skewX: -20, filter: "blur(9px)" }}
                        animate={{ opacity: 1, y: 0, skewX: 0, filter: "blur(0px)" }}
                        transition={{ delay: HERO_T + 0.5 + i * 0.035, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {ch === " " ? " " : ch}
                      </motion.span>
                    ))}
                    <motion.span
                      className="ty-laser"
                      aria-hidden="true"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: HERO_T + 0.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                </motion.h1>

                <HeroShowcase />

                <motion.p
                  className="ty-sub ty-sub--hero"
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: HERO_T + 1.05, duration: 0.45, ease: EASE }}
                >
                  TratoYa retiene el dinero hasta que el trato se cumple.
                </motion.p>

                <div className="ty-cta-stack ty-cta-stack--hero">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega ty-cta-finale"
                    type="button"
                    onClick={register}
                    initial={{ opacity: 0, scale: 0.45, y: 24 }}
                    animate={{ opacity: 1, scale: [0.45, 1.1, 1], y: 0 }}
                    transition={{ delay: HERO_T + 1.2, duration: 0.5, times: [0, 0.7, 1], ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                <OrbitShield />
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
                <RiskDemo />
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
                <div className="ty-flow-progress" aria-hidden="true">
                  <motion.span
                    key={`prog-${flowStep}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: FLOW_AUTO_MS / 1000, ease: "linear" }}
                  />
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
                        initial={flowSlideReady
                          ? { opacity: 0, x: flowDir > 0 ? 74 : -74, rotateY: flowDir > 0 ? 30 : -30, scale: 0.88, filter: "blur(8px)" }
                          : false}
                        animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, x: flowDir > 0 ? -54 : 54, rotateY: flowDir > 0 ? -20 : 20, scale: 0.93, filter: "blur(6px)" }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <motion.span
                          className="ty-flow-stamp"
                          aria-hidden="true"
                          initial={{ opacity: 0, scale: 2.6, rotate: -16 }}
                          animate={{ opacity: 1, scale: 1, rotate: -8 }}
                          transition={{ delay: 0.22, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {FLOW[flowStep].n}
                        </motion.span>
                        <motion.img
                          src={FLOW[flowStep].img}
                          alt=""
                          decoding="async"
                          initial={{ scale: 1.18, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        />
                        <h3 className="ty-flow-title">
                          {FLOW[flowStep].title.split(" ").map((w, i) => (
                            <motion.span
                              key={`${w}-${i}`}
                              className="ty-zoomword"
                              initial={{ opacity: 0, y: 16 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.18 + i * 0.06, duration: 0.35, ease: EASE }}
                            >
                              {w}
                            </motion.span>
                          ))}
                        </h3>
                        <motion.p
                          className="ty-flow-desc"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.32, duration: 0.4, ease: EASE }}
                        >
                          {FLOW[flowStep].desc}
                        </motion.p>
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
                <SafetyShowcase />
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
                  <span>4.5%</span> + 4×1000.
                </h2>
                <p className="ty-sub ty-text-pulse ty-text-pulse--delay">La única comisión, solo si el trato se cumple. Simula el tuyo.</p>
                <div className="ty-mini-calc">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="$ 500.000"
                    className={autoSimRunning ? "ty-sim-typing" : ""}
                    value={monto ? Number(monto).toLocaleString("es-CO") : ""}
                    onPointerDown={() => { if (autoSimRunning) cancelAutoSim(true); }}
                    onChange={(e) => {
                      if (autoSimRunning) cancelAutoSim();
                      setMonto(e.target.value.replace(/\D/g, ""));
                    }}
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
                          onClick={() => {
                            if (autoSimRunning) cancelAutoSim();
                            setQuienComision(id);
                          }}
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
              <div className="ty-slide ty-slide--finale">
                {/* Onda expansiva tras el impacto del titular */}
                <motion.span
                  className="ty-finale-flash"
                  aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.2 }}
                  animate={{ opacity: [0, 0.55, 0], scale: [0.2, 1.6, 2.1] }}
                  transition={{ delay: 1.25, duration: 1.1, ease: "easeOut" }}
                />

                {/* Logo 3D: reveal con rebote y flotación permanente */}
                <motion.div
                  className="ty-finale-logo"
                  animate={{ y: [0, -9, 0] }}
                  transition={{ delay: 1.3, duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.img
                    src="/finale-icon.webp"
                    alt=""
                    initial={{ opacity: 0, scale: 0.15, rotate: -22, filter: "blur(12px)" }}
                    animate={{ opacity: 1, scale: [0.15, 1.14, 1], rotate: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.1, duration: 0.75, times: [0, 0.68, 1], ease: [0.16, 1, 0.3, 1] }}
                  />
                  <motion.span
                    className="ty-finale-logo__halo"
                    aria-hidden="true"
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1.7, 2.2] }}
                    transition={{ delay: 0.55, duration: 1, ease: "easeOut" }}
                  />
                </motion.div>

                <motion.p
                  className="ty-kicker"
                  initial={{ opacity: 0, letterSpacing: "0.6em" }}
                  animate={{ opacity: 1, letterSpacing: "0.18em" }}
                  transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  Listo para tu primer trato
                </motion.p>

                <h2 className="ty-mega ty-mega--finale">
                  <WordZoom text="Haz el negocio." delay={0.65} />
                  <br />
                  <motion.span
                    className="ty-finale-accent"
                    initial={{ opacity: 0, scale: 3.2, filter: "blur(20px)" }}
                    animate={{ opacity: 1, scale: [3.2, 0.96, 1.04, 1], filter: "blur(0px)" }}
                    transition={{ delay: 1.05, duration: 0.7, times: [0, 0.6, 0.82, 1], ease: [0.16, 1, 0.3, 1] }}
                  >
                    <motion.span
                      animate={{
                        "--fin-c": ["#dfff36", "#ffffff", "#dfff36"],
                        textShadow: [
                          "0 0 38px rgba(159,224,25,0.45)",
                          "0 0 42px rgba(255,255,255,0.4)",
                          "0 0 38px rgba(159,224,25,0.45)",
                        ],
                      }}
                      transition={{ delay: 2.3, duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      Nosotros cuidamos.
                    </motion.span>
                  </motion.span>
                </h2>

                <motion.p
                  className="ty-sub"
                  initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 1.7, duration: 0.55, ease: EASE }}
                >
                  Registro gratis. Tu primer trato en minutos.
                </motion.p>

                <div className="ty-cta-stack">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega ty-cta-finale"
                    type="button"
                    onClick={register}
                    initial={{ opacity: 0, scale: 0.5, y: 26 }}
                    animate={{ opacity: 1, scale: [0.5, 1.08, 1], y: 0 }}
                    transition={{ delay: 1.7, duration: 0.55, times: [0, 0.7, 1], ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.05, boxShadow: "0 0 70px rgba(158,216,25,0.6)" }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Crear cuenta gratis →
                  </motion.button>
                  <motion.div
                    className="ty-cta-links"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.4, duration: 0.5 }}
                  >
                    <a href="/legal/terminos">Términos</a>
                    <a href="/legal/privacidad">Privacidad</a>
                    <a href="mailto:soporte@tratoya.com">Soporte</a>
                  </motion.div>
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
      style={{ transformPerspective: 900 }}
      initial={{ opacity: 0, y: 64, rotateX: 26, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      transition={{ delay: HERO_T + 0.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ty-hero-showcase__glow" aria-hidden="true" />
      <img
        src="/hero-app-mockup.webp"
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

/* ── RiskDemo: comparador animado "Sin TratoYa / Con TratoYa" ──
   Reemplaza las cards estáticas del problema con una demo en vivo:
   el dinero viaja directo y falla (✕) o pasa por la custodia
   TratoYa y llega seguro (✓). Auto-alterna; el toque manual pausa. */
const RISK_MODES = {
  sin: {
    tab: "Sin TratoYa",
    caption: "Pagas directo y cruzas los dedos. Si algo falla, no hay respaldo.",
    badge: "✕ Dinero en riesgo",
  },
  con: {
    tab: "Con TratoYa",
    caption: "El pago queda en custodia y solo se libera al confirmar la entrega.",
    badge: "✓ Dinero protegido",
  },
};

const RISK_CYCLE = { duration: 2.6, repeat: Infinity, repeatDelay: 1.1, ease: "easeInOut" };
// Coreografía: 1.2s de espera al entrar → "sin" 2 ciclos → "con" 2 ciclos → loop
const RISK_START_DELAY_MS = 1200;
const RISK_PLAYS_PER_MODE_MS = 2 * (2600 + 1100);

function RiskDemo() {
  const [modo, setModo] = useState("sin");
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const pauseRef = useRef(false);

  // Arranque automático al montar (la slide 3 monta este componente)
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), RISK_START_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Tras 2 reproducciones completas, cambia de modo
  useEffect(() => {
    if (!started) return undefined;
    const t = setTimeout(() => {
      if (!pauseRef.current) setModo((m) => (m === "sin" ? "con" : "sin"));
    }, RISK_PLAYS_PER_MODE_MS);
    return () => clearTimeout(t);
  }, [modo, started, tick]);

  const pick = (m) => {
    pauseRef.current = true;
    setModo(m);
    setStarted(true);
    setTimeout(() => {
      pauseRef.current = false;
      setTick((x) => x + 1); // re-arma el temporizador de cambio de modo
    }, 9000);
  };

  const sin = modo === "sin";
  const coin = sin
    ? { left: ["8%", "8%", "78%", "78%", "78%"], opacity: [0, 1, 1, 1, 0] }
    : { left: ["8%", "44%", "44%", "78%", "78%"], opacity: [0, 1, 1, 1, 0] };
  const coinTimes = sin ? [0, 0.08, 0.8, 0.92, 1] : [0, 0.4, 0.6, 0.92, 1];

  return (
    <div className="ty-riskdemo">
      <div className="ty-riskdemo__tabs" role="tablist" aria-label="Comparar con y sin TratoYa">
        {Object.entries(RISK_MODES).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={modo === key}
            className={`ty-riskdemo__tab${modo === key ? ` active--${key}` : ""}`}
            onClick={() => pick(key)}
          >
            {cfg.tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={modo}
          className={`ty-riskdemo__panel ty-riskdemo__panel--${modo}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="ty-riskdemo__stage">
            <span className={`ty-riskdemo__line ty-riskdemo__line--${modo}`} aria-hidden="true" />

            <motion.span
              className="ty-riskdemo__coin"
              aria-hidden="true"
              animate={started ? coin : { opacity: 0 }}
              transition={started ? { ...RISK_CYCLE, times: coinTimes } : { duration: 0.2 }}
            >
              💸
            </motion.span>

            <motion.span
              className={`ty-riskdemo__burst ty-riskdemo__burst--${modo}`}
              aria-hidden="true"
              animate={started ? { opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1.25, 1, 1] } : { opacity: 0 }}
              transition={started ? { ...RISK_CYCLE, times: [0, 0.78, 0.86, 0.95, 1] } : { duration: 0.2 }}
            >
              {sin ? "✕" : "✓"}
            </motion.span>

            <ShieldNode label="Comprador" icon={<BuyerIcon />} />
            {sin ? (
              <span className="ty-riskdemo__ghost" aria-hidden="true">?</span>
            ) : (
              <span className="ty-riskdemo__core">
                <ShieldNode label="TratoYa" logoSrc={logo} core />
              </span>
            )}
            <ShieldNode label="Vendedor" icon={<SellerIcon />} />
          </div>

          <div className="ty-riskdemo__foot">
            <span className={`ty-riskdemo__badge ty-riskdemo__badge--${modo}`}>
              {RISK_MODES[modo].badge}
            </span>
            <p className="ty-riskdemo__caption">{RISK_MODES[modo].caption}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── OrbitShield (slide 2): los 3 pilares orbitan el logo TratoYa.
   Tocar un satélite lo fija y muestra su descripción; auto-rota. ── */
const ORBIT_ROTATE_MS = 3400;

function OrbitShield() {
  const [active, setActive] = useState(0);
  const pinRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pinRef.current) setActive((a) => (a + 1) % WHAT_IS.length);
    }, ORBIT_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const pin = (i) => {
    pinRef.current = true;
    setActive(i);
    setTimeout(() => { pinRef.current = false; }, 8000);
  };

  const item = WHAT_IS[active];

  return (
    <motion.div
      className="ty-orbit"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, duration: 0.6, ease: EASE }}
    >
      <div className="ty-orbit__stage" aria-hidden="true">
        <span className="ty-orbit__ring" />
        <span className="ty-orbit__ring ty-orbit__ring--2" />
        <motion.span
          className="ty-orbit__center"
          animate={{ scale: [1, 1.07, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src={logo} alt="" />
        </motion.span>
        <div className="ty-orbit__spinner">
          {WHAT_IS.map((it, i) => (
            <button
              key={it.title}
              type="button"
              tabIndex={-1}
              className={`ty-orbit__sat ty-orbit__sat--${i}${active === i ? " active" : ""}`}
              onClick={() => pin(i)}
            >
              <span className="ty-orbit__satin">{it.icon}</span>
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.title}
          className="ty-orbit__caption"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <strong>{item.icon} {item.title}</strong>
          <p>{item.body}</p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ── SafetyShowcase: las 3 garantías como demo animada por pestañas ──
   Auto-rota cada 3.6s; tocar una pestaña la fija 8s. Cada garantía
   tiene su propia micro-escena en loop. */
const SAFETY_ROTATE_MS = 3600;

function SafetyStage({ id }) {
  if (id === "protegido") {
    return (
      <div className="ty-safety__scene">
        <motion.span
          className="ty-safety__ring"
          aria-hidden="true"
          animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.span
          className="ty-safety__drop"
          aria-hidden="true"
          animate={{ y: [-46, 0, 0], opacity: [0, 1, 0], scale: [1, 0.55, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.5, times: [0, 0.55, 1], ease: "easeIn" }}
        >
          💸
        </motion.span>
        <motion.span
          className="ty-safety__big"
          aria-hidden="true"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.5, times: [0.5, 0.62, 0.8] }}
        >
          🔒
        </motion.span>
      </div>
    );
  }
  if (id === "disputas") {
    return (
      <div className="ty-safety__scene">
        <motion.span
          className="ty-safety__big"
          aria-hidden="true"
          animate={{ rotate: [0, -9, 9, -5, 5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.7, ease: "easeInOut" }}
        >
          ⚖️
        </motion.span>
        <motion.span
          className="ty-safety__stamp"
          aria-hidden="true"
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.2, 1, 1] }}
          transition={{ duration: 2.9, repeat: Infinity, times: [0, 0.62, 0.72, 0.9, 1] }}
        >
          72h
        </motion.span>
      </div>
    );
  }
  return (
    <div className="ty-safety__scene">
      <motion.span className="ty-safety__big" aria-hidden="true">👤</motion.span>
      <span className="ty-safety__bubble" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.i
            key={i}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </span>
      <motion.span
        className="ty-safety__stamp ty-safety__stamp--ok"
        aria-hidden="true"
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.2, 1, 1] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.6, 0.7, 0.9, 1] }}
      >
        ✓
      </motion.span>
    </div>
  );
}

function SafetyShowcase() {
  const [active, setActive] = useState(0);
  const pinRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pinRef.current) setActive((a) => (a + 1) % SAFETY_SHOW.length);
    }, SAFETY_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const pin = (i) => {
    pinRef.current = true;
    setActive(i);
    setTimeout(() => { pinRef.current = false; }, 8000);
  };

  const item = SAFETY_SHOW[active];

  return (
    <div className="ty-safety">
      <div className="ty-safety__tabs" role="tablist" aria-label="Garantías TratoYa">
        {SAFETY_SHOW.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={`ty-safety__tab${active === i ? " active" : ""}`}
            onClick={() => pin(i)}
          >
            <span aria-hidden="true">{s.icon}</span> {s.tab}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.id}
          className="ty-safety__panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: EASE }}
        >
          <SafetyStage id={item.id} />
          <strong className="ty-safety__title">{item.title}</strong>
          <p className="ty-safety__caption">{item.body}</p>
        </motion.div>
      </AnimatePresence>
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

/* ── EarlyList interactiva: recorre los beneficios uno a uno con
   resaltado neón y check que "se firma" en cada pasada. Tocar un
   beneficio lo fija 7s. ── */
function EarlyList({ items }) {
  const [active, setActive] = useState(0);
  const pinRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pinRef.current) setActive((a) => (a + 1) % items.length);
    }, 2300);
    return () => clearInterval(id);
  }, [items.length]);

  const pin = (i) => {
    pinRef.current = true;
    setActive(i);
    setTimeout(() => { pinRef.current = false; }, 7000);
  };

  return (
    <ul className="ty-early-list">
      {items.map((item, i) => {
        const on = active === i;
        return (
          <motion.li
            key={item}
            className={on ? "ty-early-active" : ""}
            onClick={() => pin(i)}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0, scale: on ? 1.03 : 1 }}
            transition={{ delay: 0.14 + i * 0.07, duration: 0.4, ease: EASE, scale: { duration: 0.3, ease: EASE } }}
          >
            <motion.span
              className="ty-check"
              animate={on ? { scale: [0.3, 1.35, 1], rotate: [-100, 12, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              ✓
            </motion.span>
            {item}
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ── HeroBoom: detonación de apertura — flash, 3 ondas expansivas
   y 14 partículas que salen disparadas del centro del titular. ── */
function HeroBoom() {
  return (
    <span className="ty-boom" aria-hidden="true">
      <motion.span
        className="ty-boom__flash"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ delay: HERO_T, duration: 0.55, times: [0, 0.18, 1], ease: "easeOut" }}
      />
      {[0, 1, 2].map((i) => (
        <motion.span
          key={`ring-${i}`}
          className="ty-boom__ring"
          initial={{ opacity: 0, scale: 0.1 }}
          animate={{ opacity: [0, 0.75, 0], scale: [0.1, 2.3 + i * 0.8] }}
          transition={{ delay: HERO_T + i * 0.1, duration: 0.95, ease: "easeOut" }}
        />
      ))}
      {BOOM_PARTICLES.map((p, i) => (
        <motion.span
          key={`p-${i}`}
          className="ty-boom__p"
          style={{ width: Math.round(7 * p.s), height: Math.round(7 * p.s) }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [1, 1, 0.3] }}
          transition={{ delay: HERO_T + 0.03, duration: 0.85 + (i % 3) * 0.18, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ── WordZoom: palabras que llegan desde la profundidad (zoom-in
   agresivo con blur) en cascada. Para el cierre de la slide 8. ── */
function WordZoom({ text, delay = 0, step = 0.11, className = "" }) {
  return (
    <span className={`ty-zoomline ${className}`}>
      {text.split(" ").map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="ty-zoomword"
          initial={{ opacity: 0, scale: 2.6, y: 22, filter: "blur(16px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: delay + i * step, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
        </motion.span>
      ))}
    </span>
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
