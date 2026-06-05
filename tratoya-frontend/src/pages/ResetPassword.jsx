import { useState, useEffect } from "react";
import logo from "../assets/tratoya-logo.png";
import { api } from "../lib/api";
import { passwordChecks, strongPasswordOk } from "../lib/utils";

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

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const id = params.get("id") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const checks = passwordChecks(password, {});
  const ok = strongPasswordOk(password, {}) && password === confirm;

  useEffect(() => {
    document.title = "TratoYA / Restablecer contraseña";
    if (!token || !id) setError("Enlace inválido. Solicita uno nuevo desde el inicio de sesión.");
  }, [token, id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, id, password });
      setDone(true);
    } catch (err) {
      setError(err.message || "El enlace expiró o ya fue usado. Solicita uno nuevo.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-pg auth-future">
      <aside className="auth-l">
        <div className="auth-orbit" aria-hidden="true" />
        <div className="auth-brand-panel">
          <a className="auth-logo-link" href="/" aria-label="Ir al inicio">
            <img src={logo} alt="TratoYa" />
          </a>
          <span className="auth-beta">BETA</span>
          <h1>Tu pago seguro<br /><span>hasta el final.</span></h1>
          <p>Intermediación segura para compras y ventas en línea.</p>
        </div>
      </aside>

      <section className="auth-r">
        <div className="auth-w fi">
          <div className="auth-card-head">
            <div>
              <h2>Restablecer contraseña</h2>
              <p>Crea una nueva contraseña segura para tu cuenta.</p>
            </div>
          </div>

          {done ? (
            <div className="auth-forgot-sent">
              <div className="auth-forgot-icon">✅</div>
              <h3>¡Contraseña actualizada!</h3>
              <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <a href="/" className="btn bp blg auth-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Iniciar sesión
              </a>
            </div>
          ) : error && !token ? (
            <div className="auth-forgot-sent">
              <div className="auth-forgot-icon">⚠️</div>
              <p style={{ color: "#c0392b" }}>{error}</p>
              <a href="/" className="btn bp blg auth-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Volver al inicio
              </a>
            </div>
          ) : (
            <form onSubmit={submit}>
              {error && <p className="auth-error-msg">{error}</p>}
              <div className="fg">
                <label className="fl">Nueva contraseña *</label>
                <div className="auth-pass-wrap">
                  <input className="inp" type={showPass ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} aria-label={showPass ? "Ocultar" : "Mostrar"}>
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <div className="auth-checks">
                  {checks.map(([k, label, isOk]) => (
                    <div key={k} className={isOk ? "ok" : ""}><span>{isOk ? "✓" : "○"}</span><span>{label}</span></div>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label className="fl">Confirmar contraseña *</label>
                <div className="auth-pass-wrap">
                  <input className="inp" type={showConfirm ? "text" : "password"} placeholder="Repite tu contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  <button type="button" className="auth-eye" onClick={() => setShowConfirm(v => !v)} aria-label={showConfirm ? "Ocultar" : "Mostrar"}>
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn bp blg auth-primary" disabled={!ok || loading}>
                {loading ? <><div className="spin" /> Actualizando...</> : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
