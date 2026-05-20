export default function Landing({ goAuth }) {
  return (
    <div className="land escrow-land">
      <nav className="escrow-nav">
        <div className="logo-row">
          <div className="brand-mark">T</div>
          <span className="brand-word">Trato<span>Ya</span></span>
        </div>
        <div className="escrow-menu">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#proteccion">Protección</a>
          <a href="#tarifas">Tarifas</a>
          <a href="#soporte">Soporte</a>
        </div>
        <div className="escrow-actions">
          <button className="btn bg_" onClick={() => goAuth("login")}>Iniciar sesión</button>
          <button className="btn bp" onClick={() => goAuth("register")}>Crear cuenta</button>
        </div>
      </nav>

      <section className="escrow-hero">
        <div className="escrow-copy">
          <div className="hbdg">Pago seguro para Colombia</div>
          <h1>Compra y vende con dinero protegido hasta el final.</h1>
          <p>TratoYA retiene el pago, valida el comprobante y libera los fondos al vendedor cuando la operación se completa.</p>
          <div className="escrow-cta">
            <button className="btn bp blg create-glow-btn" onClick={() => goAuth("register")}>Crear trato seguro</button>
            <button className="btn bo blg" onClick={() => goAuth("login")}>Entrar a mi cuenta</button>
          </div>
          <div className="escrow-trust">
            {["Transferencias Nequi / Bre-B", "Comprobantes adjuntos", "Admin verifica pagos", "Liberación manual segura"].map((t) => <span key={t}>{t}</span>)}
          </div>
        </div>
        <div className="escrow-visual" aria-label="Flujo animado de TratoYA">
          <div className="deal-phone">
            <div className="deal-phone-top">Trato en progreso</div>
            <img src="/nequi-breb-qr.png" alt="QR Nequi Bre-B TratoYA" />
            <div className="deal-step active"><b>1</b><span>Comprador paga</span></div>
            <div className="deal-arrow">↓</div>
            <div className="deal-step"><b>2</b><span>TratoYA verifica</span></div>
            <div className="deal-arrow">↓</div>
            <div className="deal-step"><b>3</b><span>Fondos liberados</span></div>
          </div>
        </div>
      </section>

      <section className="escrow-stats" id="tarifas">
        {[["$0", "Registro"], ["4.5% + IMP", "Comisión base"], ["1 hora", "Verificación objetivo"], ["100%", "Trazabilidad del trato"]].map(([n, l]) => (
          <div key={l}><strong>{n}</strong><span>{l}</span></div>
        ))}
      </section>

      <section className="escrow-section" id="como-funciona">
        <div className="stag">Cómo funciona</div>
        <h2>Un flujo simple para operaciones reales.</h2>
        <div className="escrow-cards">
          {[
            ["Crear trato", "Define monto, contraparte y condiciones."],
            ["Pagar seguro", "El comprador transfiere a la llave TratoYA y adjunta comprobante."],
            ["Verificar", "El panel admin revisa el pago y activa la entrega."],
            ["Liberar", "Cuando todo está correcto, se consigna al vendedor con comprobante."],
          ].map(([t, d], i) => (
            <div className="escrow-card" key={t}>
              <b>{i + 1}</b>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="escrow-protect" id="proteccion">
        <h2>Diseñado para reducir riesgo, no para complicar el trato.</h2>
        <p>TratoYA registra cada paso: reporte de pago, comprobante, aprobación, entrega, confirmación y liberación de fondos.</p>
        <button className="btn bp blg" onClick={() => goAuth("register")}>Empezar ahora</button>
      </section>

      <footer id="soporte">
        <span>© 2026 TratoYA · Invention Technologies S.A.S.</span>
        <span>soporte@tratoya.com</span>
      </footer>
    </div>
  );
}
