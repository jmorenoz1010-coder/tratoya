export default function Landing({ goAuth }) {
  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo-row">
          <div style={{ width: 28, height: 28, background: "var(--g)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
          <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>
            Trato<span style={{ color: "var(--g)" }}>Ya</span>
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--g)", background: "rgba(168,196,0,.15)", padding: "2px 6px", borderRadius: 5 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button className="btn bg_" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => goAuth("login")}>Iniciar sesión</button>
          <button className="btn bp" onClick={() => goAuth("register")}>Crear cuenta gratis</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hbdg fi">
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g)" }} />
          Plataforma beta activa · Colombia 🇨🇴
        </div>
        <h1 className="fi2">Tu pago seguro<br /><span>hasta el final.</span></h1>
        <p className="fi3">Compra y vende sin miedo. TratoYa retiene el dinero hasta que ambas partes confirmen.</p>
        <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }} className="fi3">
          <button className="btn bp blg" onClick={() => goAuth("register")}>🔒 Crear cuenta gratis</button>
          <button className="btn bo blg" onClick={() => goAuth("login")}>Iniciar sesión</button>
        </div>
        <div className="htrust fi3">
          {["PSE y Nequi", "Verificación de identidad", "Mediación en 72h", "Sin cobros ocultos"].map((t) => (
            <div key={t} className="htrust-i">{t}</div>
          ))}
        </div>
      </section>

      <section className="sbar">
        <div className="sgrid">
          {[["$0", "Costo de registro"], ["4.5%", "Comisión promedio"], ["72h", "Resolución de disputas"], ["100%", "Garantía de devolución"]].map(([n, l]) => (
            <div key={l} className="si">
              <div className="snum">{n}</div>
              <div className="slbl">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="stag">Proceso</div>
        <h2 className="sh">5 pasos, <span>un trato seguro</span></h2>
        <div className="sgrd">
          {[
            ["1", "🤝", "Crear trato",  "Define precio y condiciones"],
            ["2", "💳", "Pagar",        "El dinero queda en TratoYa"],
            ["3", "📦", "Entregar",     "Vendedor envía con guía"],
            ["4", "✅", "Confirmar",    "Comprador verifica"],
            ["5", "💰", "Liberar",      "Dinero al vendedor en 24h"],
          ].map(([n, ic, t, d], i) => (
            <div key={i} className="sti">
              <div className="stn">{n}</div>
              <div style={{ fontSize: 24, marginBottom: 11 }}>{ic}</div>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: "var(--s600)", lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--n)", padding: "52px 44px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "Manrope", fontSize: 33, fontWeight: 800, color: "#fff", marginBottom: 11 }}>
          ¿Listo para un trato seguro?
        </h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,.5)", marginBottom: 26 }}>Regístrate gratis. Sin tarjeta requerida.</p>
        <button className="btn bp blg" onClick={() => goAuth("register")}>🔒 Crear cuenta gratis</button>
      </section>

      <footer style={{ background: "#040F1E", padding: "22px 44px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11.5 }}>
          © 2026 TratoYa · NEXEN / Invention Technologies S.A.S. · Cartagena de Indias
        </div>
        <div className="footer-links" style={{ display: "flex", gap: 16 }}>
          {["Términos", "Privacidad", "Soporte"].map((l) => (
            <span key={l} style={{ color: "rgba(255,255,255,.3)", fontSize: 11.5, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
