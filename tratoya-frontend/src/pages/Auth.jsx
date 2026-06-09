import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/tratoya-logo.png";
import { API_URL, api, saveSession } from "../lib/api";
import { passwordChecks, strongPasswordOk, normalizeHandle, DOC_TYPES, FINANCIAL_ENTITIES, getBankType } from "../lib/utils";
import "../styles/auth-slide.css";

const EASE = [0.22, 1, 0.36, 1];
const TRUST = [
  { label: "Pago protegido", icon: TrustShieldIcon },
  { label: "3 min", icon: TrustClockIcon },
  { label: "72 h", icon: TrustScaleIcon },
];

const fieldFade = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

const panelSwitch = {
  enter: (dir) => ({
    opacity: 0,
    x: dir > 0 ? 48 : -48,
    scale: 0.96,
    filter: "blur(6px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: EASE },
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir > 0 ? -40 : 40,
    scale: 0.98,
    filter: "blur(4px)",
    transition: { duration: 0.35, ease: EASE },
  }),
};

function playWelcomeSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime + 0.02;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(ctx.destination);
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.connect(gain);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch { /* silencioso */ }
}

export default function Auth({ setSession, toast, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode === "register" ? "register" : "login");
  const [panelDir, setPanelDir] = useState(1);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const emailRef = useRef(null);
  const [f, setF_] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    confirm_password: "",
    telefono: "",
    tipo_identificacion: "CC",
    cedula: "",
    banco: "",
    tipo_cuenta: "ahorros",
    numero_cuenta: "",
  });

  const sf = (k, v) => setF_((p) => ({ ...p, [k]: v }));
  const checks = passwordChecks(f.password, f);
  const bankKind = getBankType(f.banco);
  const usernamePreview = normalizeHandle(f.email.split("@")[0]);

  const panelKey = forgotMode
    ? "forgot"
    : mode === "login"
      ? "login"
      : `register-${step}`;

  useEffect(() => {
    if (mode === "login" && !forgotMode) {
      const t = setTimeout(() => emailRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mode, forgotMode, panelKey]);

  const login = async (e) => {
    e?.preventDefault();
    if (!f.email || !f.password) { toast("Completa email y contraseña", "error"); return; }
    setLoading(true);
    try {
      const r = await api.post("/auth/login", { email: f.email, password: f.password });
      saveSession(r.token, r.refresh_token, r.user);
      setSession({ user: r.user, token: r.token });
      toast(`Bienvenido, ${r.user.nombre}!`, "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const register = async () => {
    if (!f.nombre || !f.apellido || !f.email || !f.password || !f.cedula) { toast("Completa los campos obligatorios", "error"); return; }
    if (!strongPasswordOk(f.password, f)) { toast("La contraseña todavía no cumple todos los criterios.", "error"); return; }
    if (f.password !== f.confirm_password) { toast("Las contraseñas no coinciden", "error"); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", {
        nombre: f.nombre,
        apellido: f.apellido,
        email: f.email,
        password: f.password,
        telefono: f.telefono,
        cedula: f.cedula,
        tipo_identificacion: f.tipo_identificacion,
      });
      const r = await api.post("/auth/login", { email: f.email, password: f.password });
      saveSession(r.token, r.refresh_token, r.user);
      if (f.banco && f.numero_cuenta) {
        const bkind = getBankType(f.banco);
        let tipo = f.tipo_cuenta;
        if (bkind === "breb") tipo = "breb";
        else if (bkind === "wallet") {
          const wmap = { Nequi: "nequi", Daviplata: "daviplata" };
          tipo = wmap[f.banco] || "nequi";
        }
        await api.post("/users/bank-accounts", { banco: f.banco, tipo, numero: f.numero_cuenta, titular: `${f.nombre} ${f.apellido}` });
      }
      setSession({ user: r.user, token: r.token });
      playWelcomeSound();
      toast("Registro confirmado. Tu cuenta quedó lista.", "success");
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  const switchMode = () => {
    setPanelDir(mode === "login" ? 1 : -1);
    setMode(mode === "login" ? "register" : "login");
    setStep(1);
    setForgotMode(false);
    setF_((p) => ({ ...p, password: "", confirm_password: "" }));
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  const forgotPassword = async (e) => {
    e?.preventDefault();
    if (!forgotEmail) { toast("Ingresa tu email", "error"); return; }
    setForgotLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setForgotSent(true);
    } catch (err) { toast(err.message, "error"); }
    setForgotLoading(false);
  };

  const socialLogin = (provider) => {
    const key = provider.toUpperCase();
    const configuredUrl = import.meta.env[`VITE_${key}_AUTH_URL`];
    if (configuredUrl) {
      window.location.href = configuredUrl;
      return;
    }
    window.location.href = `${API_URL}/auth/oauth/${provider.toLowerCase()}`;
  };

  const goStep = (next) => {
    setPanelDir(next > step ? 1 : -1);
    setStep(next);
  };

  return (
    <div className="auth-slide-app">
      <div className="auth-ambient" aria-hidden="true">
        <div className="auth-grid" />
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-scanline" />
      </div>

      <motion.div
        className="auth-progress"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
      />

      <motion.button
        className="auth-back-btn"
        type="button"
        onClick={goBack}
        aria-label="Volver"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
      >
        ←
      </motion.button>

      <div className="auth-layout">
        <aside className="auth-hero">
          <div className="auth-orbit-ring" aria-hidden="true" />
          <motion.div
            className="auth-hero__main"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.a className="auth-logo-link" href="/" aria-label="Ir al inicio" variants={fadeUp}>
              <img src={logo} alt="TratoYa" />
            </motion.a>
            <motion.p className="auth-kicker auth-text-pulse" variants={fadeUp}>Intermediario de pagos</motion.p>
            <motion.h1 className="auth-mega auth-text-pulse" variants={fadeUp}>
              Tu pago<br /><span>seguro.</span>
            </motion.h1>
            <motion.p className="auth-hero__sub auth-text-pulse auth-text-pulse--delay" variants={fadeUp}>
              Protegemos tu dinero hasta que ambas partes cumplan.
            </motion.p>
          </motion.div>

          <motion.div
            className="auth-trust-pills"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {TRUST.map(({ label, icon: Icon }) => (
              <motion.span className="auth-trust-pill" key={label} variants={fadeUp}>
                <span className="auth-trust-pill__ico" aria-hidden="true"><Icon /></span>
                {label}
              </motion.span>
            ))}
          </motion.div>
        </aside>

        <section className="auth-panel">
          <motion.div
            className="auth-glass-card"
            initial={{ opacity: 0, y: 40, scale: 0.92, filter: "blur(10px)" }}
            animate={{
              opacity: 1,
              y: [0, -6, 0],
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{
              opacity: { duration: 0.6, ease: EASE, delay: 0.08 },
              scale: { duration: 0.6, ease: EASE, delay: 0.08 },
              filter: { duration: 0.6, ease: EASE, delay: 0.08 },
              y: { duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.7 },
            }}
          >
            <div className="auth-card-head">
              <h2 className="auth-text-pulse">
                {forgotMode
                  ? (forgotSent ? "Revisa tu correo" : "Recuperar acceso")
                  : mode === "login"
                    ? "Bienvenido de nuevo"
                    : "Crear cuenta gratis"}
              </h2>
              <p>
                {forgotMode
                  ? (forgotSent ? "Te enviamos el enlace si el email está registrado" : "Te mandamos un enlace para restablecer tu contraseña")
                  : mode === "login"
                    ? "Entra en segundos — Google, Apple o correo"
                    : "Empieza a hacer tratos seguros hoy"}
              </p>
            </div>

            {!forgotMode && (
              <motion.div
                className="auth-social-stack"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.45, ease: EASE }}
              >
                <motion.button
                  type="button"
                  className="auth-social-btn"
                  onClick={() => socialLogin("Google")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ProviderIcon name="google" /> Google
                </motion.button>
                <motion.button
                  type="button"
                  className="auth-social-btn"
                  onClick={() => socialLogin("Apple")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ProviderIcon name="apple" /> Apple
                </motion.button>
              </motion.div>
            )}

            {!forgotMode && <div className="auth-divider"><span>o con tu correo</span></div>}

            {mode === "register" && !forgotMode && (
              <div className="auth-step-dots" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`auth-step-dot${step >= n ? " active" : ""}`} />
                ))}
              </div>
            )}

            <AnimatePresence mode="wait" custom={panelDir}>
              <motion.div
                key={panelKey}
                custom={panelDir}
                variants={panelSwitch}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {mode === "login" ? (
                  forgotMode ? (
                    forgotSent ? (
                      <div className="auth-forgot-sent">
                        <div className="auth-forgot-icon">✉️</div>
                        <h3>Listo</h3>
                        <p>Si <strong>{forgotEmail}</strong> está registrado, recibirás el enlace en unos minutos.</p>
                        <button
                          type="button"
                          className="auth-neon-btn"
                          onClick={() => { setForgotMode(false); setForgotSent(false); }}
                        >
                          Volver al inicio de sesión
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={forgotPassword}>
                        <button type="button" className="auth-ghost-btn" onClick={() => setForgotMode(false)}>← Atrás</button>
                        <div className="auth-forgot-title">
                          <h3>¿Olvidaste tu contraseña?</h3>
                          <p>Ingresa tu email y te enviamos un enlace.</p>
                        </div>
                        <div className="fg">
                          <label className="fl">Email</label>
                          <input
                            className="inp"
                            type="email"
                            autoComplete="email"
                            placeholder="tu@correo.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="auth-neon-btn" disabled={forgotLoading}>
                          {forgotLoading ? <><div className="spin" /> Enviando...</> : "Enviar enlace"}
                        </button>
                      </form>
                    )
                  ) : (
                    <motion.form onSubmit={login} variants={stagger} initial="hidden" animate="show">
                      <motion.div className="fg" variants={fieldFade}>
                        <label className="fl">Email</label>
                        <input
                          ref={emailRef}
                          className="inp"
                          type="email"
                          autoComplete="email"
                          placeholder="tu@correo.com"
                          value={f.email}
                          onChange={(e) => sf("email", e.target.value)}
                        />
                      </motion.div>
                      <motion.div className="fg" variants={fieldFade}>
                        <label className="fl">Contraseña</label>
                        <div className="auth-pass-wrap">
                          <input
                            className="inp"
                            type={showPass ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="Tu contraseña"
                            value={f.password}
                            onChange={(e) => sf("password", e.target.value)}
                          />
                          <button type="button" className="auth-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                            {showPass ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                        <button type="button" className="auth-forgot-link" onClick={() => { setForgotMode(true); setForgotEmail(f.email); }}>
                          ¿Olvidaste tu contraseña?
                        </button>
                      </motion.div>
                      <motion.button
                        type="submit"
                        className="auth-neon-btn"
                        disabled={loading}
                        variants={fieldFade}
                        whileHover={{ scale: loading ? 1 : 1.03, boxShadow: "0 0 48px rgba(158,216,25,0.5)" }}
                        whileTap={{ scale: loading ? 1 : 0.97 }}
                      >
                        {loading ? <><div className="spin" /> Entrando...</> : "Iniciar sesión →"}
                      </motion.button>
                    </motion.form>
                  )
                ) : (
                  <>
                    {step === 1 && (
                      <div>
                        <div className="g2">
                          <div className="fg">
                            <label className="fl">Nombre *</label>
                            <input className="inp" placeholder="Juan" value={f.nombre} onChange={(e) => sf("nombre", e.target.value)} />
                          </div>
                          <div className="fg">
                            <label className="fl">Apellido *</label>
                            <input className="inp" placeholder="Pérez" value={f.apellido} onChange={(e) => sf("apellido", e.target.value)} />
                          </div>
                        </div>
                        <div className="fg">
                          <label className="fl">Email *</label>
                          <input className="inp" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={(e) => sf("email", e.target.value)} />
                        </div>
                        <div className="fg">
                          <label className="fl">WhatsApp</label>
                          <input className="inp" placeholder="+57 300 123 4567" value={f.telefono} onChange={(e) => sf("telefono", e.target.value)} />
                        </div>
                        <div className="g2 auth-tight-grid">
                          <div className="fg">
                            <label className="fl">Tipo de ID *</label>
                            <select className="inp" value={f.tipo_identificacion} onChange={(e) => sf("tipo_identificacion", e.target.value)}>
                              {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </div>
                          <div className="fg">
                            <label className="fl">Número *</label>
                            <input className="inp" placeholder="1234567890" value={f.cedula} onChange={(e) => sf("cedula", e.target.value.replace(/\D/g, ""))} />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="auth-neon-btn"
                          disabled={!f.nombre || !f.apellido || !f.email || !f.cedula}
                          onClick={() => goStep(2)}
                        >
                          Continuar →
                        </button>
                      </div>
                    )}

                    {step === 2 && (
                      <div>
                        <button type="button" className="auth-ghost-btn" onClick={() => goStep(1)}>← Atrás</button>
                        <div className="fg">
                          <label className="fl">Contraseña *</label>
                          <div className="auth-pass-wrap">
                            <input className="inp" type={showPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={f.password} onChange={(e) => sf("password", e.target.value)} />
                            <button type="button" className="auth-eye" onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Ocultar" : "Mostrar"}>
                              {showPass ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                          <div className="auth-checks">
                            {checks.map(([k, label, ok]) => (
                              <div key={k} className={ok ? "ok" : ""}>
                                <span>{ok ? "✓" : "○"}</span>
                                <span>{label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="fg">
                          <label className="fl">Confirmar contraseña *</label>
                          <div className="auth-pass-wrap">
                            <input className="inp" type={showConfirm ? "text" : "password"} placeholder="Repite tu contraseña" value={f.confirm_password} onChange={(e) => sf("confirm_password", e.target.value)} />
                            <button type="button" className="auth-eye" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Ocultar" : "Mostrar"}>
                              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="auth-neon-btn"
                          disabled={!strongPasswordOk(f.password, f) || f.password !== f.confirm_password}
                          onClick={() => goStep(3)}
                        >
                          Continuar →
                        </button>
                      </div>
                    )}

                    {step === 3 && (
                      <div>
                        <button type="button" className="auth-ghost-btn" onClick={() => goStep(2)}>← Atrás</button>

                        {usernamePreview && (
                          <div className="auth-preview">
                            <span>Tu nombre de usuario será: </span>
                            <strong>@{usernamePreview}</strong>
                            <div>Podrás cambiarlo después en tu perfil.</div>
                          </div>
                        )}

                        <p className="auth-helper">Opcional: agrega tu cuenta bancaria para recibir pagos.</p>
                        <div className="fg">
                          <label className="fl">Entidad financiera</label>
                          <select className="inp" value={f.banco} onChange={(e) => { sf("banco", e.target.value); sf("numero_cuenta", ""); }}>
                            <option value="">Omitir por ahora</option>
                            {FINANCIAL_ENTITIES.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>

                        {f.banco && bankKind === "bank" && (
                          <div className="g2 auth-tight-grid">
                            <div className="fg">
                              <label className="fl">Tipo de cuenta</label>
                              <select className="inp" value={f.tipo_cuenta} onChange={(e) => sf("tipo_cuenta", e.target.value)}>
                                <option value="ahorros">Cuenta de ahorros</option>
                                <option value="corriente">Cuenta corriente</option>
                              </select>
                            </div>
                            <div className="fg">
                              <label className="fl">Número de cuenta</label>
                              <input className="inp" placeholder="123456789" value={f.numero_cuenta} onChange={(e) => sf("numero_cuenta", e.target.value.replace(/\D/g, ""))} />
                            </div>
                          </div>
                        )}

                        {f.banco && bankKind === "wallet" && (
                          <div className="fg">
                            <label className="fl">Número de teléfono</label>
                            <input className="inp" placeholder="3001234567" value={f.numero_cuenta} onChange={(e) => sf("numero_cuenta", e.target.value.replace(/\D/g, ""))} />
                          </div>
                        )}

                        {f.banco && bankKind === "breb" && (
                          <div className="fg">
                            <label className="fl">Llave Bre-B</label>
                            <input className="inp" placeholder="@ingresa tu llave" value={f.numero_cuenta} onChange={(e) => sf("numero_cuenta", e.target.value)} />
                            <div className="fh">Puede ser tu número de celular, email o alias con @</div>
                          </div>
                        )}

                        <button type="button" className="auth-neon-btn" onClick={register} disabled={loading}>
                          {loading ? <><div className="spin" /> Creando cuenta...</> : "Crear cuenta →"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {!forgotMode && (
              <p className="auth-switch">
                {mode === "login" ? "¿Sin cuenta? " : "¿Ya tienes cuenta? "}
                <button type="button" onClick={switchMode}>
                  {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
                </button>
              </p>
            )}
          </motion.div>
        </section>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function TrustShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z" fill="#9ed819" />
      <path d="M9 12l2 2 4-4.5" stroke="#0a2e08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrustClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#5eb8ff" />
      <path d="M12 7v5l3.5 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrustScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v16M6 8h12" stroke="#ffb347" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 8l-2 5h4l-2-5ZM19 8l-2 5h4l-2-5Z" fill="#f4a340" />
    </svg>
  );
}

function ProviderIcon({ name }) {
  if (name === "google") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5Z"/>
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.2 4 9.5 8.5 6.3 14.7Z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.3 39.5 16.1 44 24 44Z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.3 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="currentColor" d="M32.9 25.4c0-5.5 4.5-8.2 4.7-8.3-2.6-3.8-6.6-4.3-8-4.4-3.4-.3-6.7 2-8.4 2-1.8 0-4.5-2-7.3-1.9-3.8.1-7.3 2.2-9.2 5.6-3.9 6.8-1 16.8 2.8 22.3 1.9 2.7 4.1 5.7 7 5.6 2.8-.1 3.9-1.8 7.3-1.8 3.4 0 4.4 1.8 7.4 1.8 3.1 0 5-2.7 6.9-5.4 2.2-3.1 3-6.1 3.1-6.3-.1 0-6.3-2.4-6.3-9.2ZM27.3 9.1c1.5-1.8 2.5-4.3 2.2-6.8-2.1.1-4.7 1.4-6.2 3.2-1.4 1.6-2.6 4.2-2.3 6.7 2.3.2 4.7-1.2 6.3-3.1Z"/>
    </svg>
  );
}
