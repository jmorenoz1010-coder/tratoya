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
  { n: "02", title: "Paga", desc: "El dinero va a TratoYa, no al vendedor.", img: stepServiceDelivery },
  { n: "03", title: "Entrega", desc: "Con el pago asegurado, se cumple el trato.", img: stepConfirmation },
  { n: "04", title: "Cobra", desc: "Confirmada la entrega → dinero liberado.", img: stepPaymentRelease },
];

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
  const [monto, setMonto] = useState("");
  const touchRef = useRef({ y: 0, t: 0 });
  const wheelLock = useRef(false);

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
  const calc = amount >= 50000 ? calcularComisionUI(amount, "comprador") : null;
  const flow = FLOW[flowStep];

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
                <p className="ty-kicker">Pagos seguros · Colombia</p>
                <h1 className="ty-mega">
                  Compra y vende<br /><span>sin miedo.</span>
                </h1>
                <p className="ty-sub">
                  TratoYa retiene el dinero hasta que el trato se cumple. Nadie pierde.
                </p>
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
                <p className="ty-kicker">El problema</p>
                <h2 className="ty-mega">
                  Pagar directo<br /><span>es un riesgo.</span>
                </h2>
                <p className="ty-sub">Estafas, no-shows, disputas sin respaldo. La confianza no basta.</p>
                <div className="ty-shield-viz">
                  <span className="ty-shield-node">Comprador</span>
                  <span className="ty-shield-arrow">→</span>
                  <span className="ty-shield-node ty-shield-node--core">TratoYa</span>
                  <span className="ty-shield-arrow">→</span>
                  <span className="ty-shield-node">Vendedor</span>
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
                <p className="ty-kicker">Cómo funciona</p>
                <div className="ty-flow-tabs" role="tablist">
                  {FLOW.map((s, i) => (
                    <button
                      key={s.n}
                      type="button"
                      role="tab"
                      aria-selected={flowStep === i}
                      className={`ty-flow-tab${flowStep === i ? " active" : ""}`}
                      onClick={() => setFlowStep(i)}
                    >
                      {s.n}
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={flowStep}
                    className="ty-holo"
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <img src={flow.img} alt="" />
                    <h3 className="ty-flow-title">{flow.title}</h3>
                    <p className="ty-flow-desc">{flow.desc}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </SlideWrap>
          )}

          {slide === 3 && (
            <SlideWrap key="s3" dir={dir}>
              <div className="ty-slide">
                <p className="ty-kicker">Transparente</p>
                <h2 className="ty-mega">
                  <span>4.5%</span> + IMP.
                </h2>
                <p className="ty-sub">Sin sorpresas. Simula tu trato ahora.</p>
                <div className="ty-mini-calc">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="$ 500.000"
                    value={monto ? Number(monto).toLocaleString("es-CO") : ""}
                    onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
                  />
                  {calc && (
                    <motion.div
                      className="ty-calc-out"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
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
                <p className="ty-kicker">Listo para tu primer trato</p>
                <h2 className="ty-mega">
                  Haz el negocio.<br /><span>Nosotros cuidamos.</span>
                </h2>
                <p className="ty-sub">Registro gratis. Primer trato en minutos.</p>
                <div className="ty-cta-stack">
                  <motion.button
                    className="ty-neon-btn ty-cta-mega"
                    type="button"
                    onClick={register}
                    whileHover={{ scale: 1.04, boxShadow: "0 0 60px rgba(223,255,54,0.55)" }}
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

      <p className="ty-hint">Scroll · swipe · flechas</p>

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
