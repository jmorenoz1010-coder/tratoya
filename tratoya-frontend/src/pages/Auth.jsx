import { useState } from "react";
import { api, saveSession } from "../lib/api";
import { passwordChecks, strongPasswordOk, normalizeHandle, DOC_TYPES, FINANCIAL_ENTITIES, getBankType, BREB_ENTITY } from "../lib/utils";

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

export default function Auth({ setSession, toast }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [f, setF_] = useState({ nombre: "", apellido: "", email: "", password: "", confirm_password: "", telefono: "", tipo_identificacion: "CC", cedula: "", banco: "", tipo_cuenta: "ahorros", numero_cuenta: "" });
  const sf = (k, v) => setF_((p) => ({ ...p, [k]: v }));
  const checks = passwordChecks(f.password, f);
  const bankKind = getBankType(f.banco); // "bank" | "wallet" | "breb"
  const usernamePreview = normalizeHandle(f.email.split("@")[0]);

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
      await api.post("/auth/register", { nombre: f.nombre, apellido: f.apellido, email: f.email, password: f.password, telefono: f.telefono, cedula: f.cedula, tipo_identificacion: f.tipo_identificacion });
      const r = await api.post("/auth/login", { email: f.email, password: f.password });
      saveSession(r.token, r.refresh_token, r.user);
      if (f.banco && f.numero_cuenta) {
        const bkind = getBankType(f.banco);
        let tipo = f.tipo_cuenta;
        if (bkind === "breb") tipo = "breb";
        else if (bkind === "wallet") {
          const wmap = { "Nequi": "nequi", "Daviplata": "daviplata" };
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

  return (
    <div className="auth-pg">
      <div className="auth-l">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 42 }}>
            <div style={{ width: 29, height: 29, background: "var(--g)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
            <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 5 }}>BETA</span>
          </div>
          <div style={{ fontSize: 33, fontFamily: "Manrope", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 13 }}>
            Tu pago seguro<br /><span style={{ color: "var(--g)" }}>hasta el final.</span>
          </div>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, lineHeight: 1.6, maxWidth: 290 }}>
            Intermediaciones seguras para cualquier trato entre personas.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          {["🔒 Dinero en custodia fiduciaria", "⚡ Trato en 3 minutos", "⭐ Mediación en 72 horas"].map((t) => (
            <div key={t} style={{ marginBottom: 8 }}><span className="bdg gn" style={{ fontSize: 11.5 }}>{t}</span></div>
          ))}
        </div>
      </div>

      <div className="auth-r">
        <div className="auth-w fi">
          <h2 style={{ fontSize: 24, marginBottom: 5 }}>{mode === "login" ? "Bienvenido de nuevo" : "Crear cuenta gratis"}</h2>
          <p style={{ color: "var(--s600)", fontSize: 13, marginBottom: 24 }}>
            {mode === "login" ? "Ingresa a tu cuenta TratoYa" : "Empieza a hacer tratos seguros"}
          </p>

          {mode === "login" ? (
            <form onSubmit={login}>
              <div className="fg"><label className="fl">Email</label><input className="inp" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={(e) => sf("email", e.target.value)} /></div>
              <div className="fg"><label className="fl">Contraseña</label><input className="inp" type="password" autoComplete="current-password" placeholder="Tu contraseña" value={f.password} onChange={(e) => sf("password", e.target.value)} /></div>
              <button type="submit" className="btn bp blg" style={{ width: "100%", marginTop: 4 }} disabled={loading}>
                {loading ? <><div className="spin" /> Entrando...</> : "Iniciar sesión"}
              </button>
            </form>
          ) : (
            <>
              {step === 1 && (
                <div className="fi">
                  <div className="g2">
                    <div className="fg"><label className="fl">Nombre *</label><input className="inp" placeholder="Juan" value={f.nombre} onChange={(e) => sf("nombre", e.target.value)} /></div>
                    <div className="fg"><label className="fl">Apellido *</label><input className="inp" placeholder="Pérez" value={f.apellido} onChange={(e) => sf("apellido", e.target.value)} /></div>
                  </div>
                  <div className="fg"><label className="fl">Email *</label><input className="inp" type="email" autoComplete="email" placeholder="tu@correo.com" value={f.email} onChange={(e) => sf("email", e.target.value)} /></div>
                  <div className="fg"><label className="fl">WhatsApp</label><input className="inp" placeholder="+57 300 123 4567" value={f.telefono} onChange={(e) => sf("telefono", e.target.value)} /></div>
                  <div className="g2" style={{ gap: 10 }}>
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
                  <button className="btn bp blg" style={{ width: "100%" }} disabled={!f.nombre || !f.apellido || !f.email || !f.cedula} onClick={() => setStep(2)}>
                    Continuar →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="fi">
                  <button className="btn bg_ bsm" style={{ marginBottom: 16 }} onClick={() => setStep(1)}>← Atrás</button>
                  <div className="fg">
                    <label className="fl">Contraseña *</label>
                    <input className="inp" type="password" placeholder="Mínimo 12 caracteres" value={f.password} onChange={(e) => sf("password", e.target.value)} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                      {checks.map(([k, label, ok]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                          <span style={{ color: ok ? "var(--g2)" : "var(--s400)", fontSize: 14 }}>{ok ? "✓" : "○"}</span>
                          <span style={{ color: ok ? "var(--g2)" : "var(--s400)" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="fg">
                    <label className="fl">Confirmar contraseña *</label>
                    <input className="inp" type="password" placeholder="Repite tu contraseña" value={f.confirm_password} onChange={(e) => sf("confirm_password", e.target.value)} />
                  </div>
                  <button className="btn bp blg" style={{ width: "100%" }} disabled={!strongPasswordOk(f.password, f) || f.password !== f.confirm_password} onClick={() => setStep(3)}>
                    Continuar →
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="fi">
                  <button className="btn bg_ bsm" style={{ marginBottom: 16 }} onClick={() => setStep(2)}>← Atrás</button>

                  {usernamePreview && (
                    <div style={{ background: "var(--s50)", border: "1px solid var(--s100)", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
                      <span style={{ color: "var(--s500)" }}>Tu nombre de usuario será: </span>
                      <strong style={{ color: "var(--g2)" }}>@{usernamePreview}</strong>
                      <div style={{ fontSize: 11.5, color: "var(--s400)", marginTop: 3 }}>Podrás cambiarlo después en tu perfil.</div>
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: "var(--s600)", marginBottom: 14 }}>Opcional: agrega tu cuenta bancaria para recibir pagos.</p>
                  <div className="fg">
                    <label className="fl">Entidad financiera</label>
                    <select className="inp" value={f.banco} onChange={(e) => { sf("banco", e.target.value); sf("numero_cuenta", ""); }}>
                      <option value="">— Omitir por ahora —</option>
                      {FINANCIAL_ENTITIES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  {f.banco && bankKind === "bank" && (
                    <div className="g2" style={{ gap: 10 }}>
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
                      <input className="inp" placeholder="@ingresa tu llave" value={f.numero_cuenta} onChange={(e) => sf("numero_cuenta", e.target.value)} style={{ color: f.numero_cuenta ? undefined : "var(--s400)" }} />
                      <div className="fh">Puede ser tu número de celular, email o alias con @</div>
                    </div>
                  )}

                  <button className="btn bp blg" style={{ width: "100%" }} onClick={register} disabled={loading}>
                    {loading ? <><div className="spin" /> Creando cuenta...</> : "✅ Crear cuenta"}
                  </button>
                </div>
              )}
            </>
          )}

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13.5, color: "var(--s600)" }}>
            {mode === "login" ? "¿Sin cuenta? " : "¿Ya tienes cuenta? "}
            <span style={{ color: "var(--g2)", fontWeight: 700, cursor: "pointer" }} onClick={() => { setMode(mode === "login" ? "register" : "login"); setStep(1); setF_((p) => ({ ...p, password: "" })); }}>
              {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
