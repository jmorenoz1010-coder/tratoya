import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { ESTADO, calcularComisionUI, parseCopAmount } from "../lib/utils";
import CommissionBreakdown from "../components/CommissionBreakdown";
import ManualPaymentBox from "../components/ManualPaymentBox";
import { ShieldIcon, LockIcon, CashIcon, FlagIcon } from "../components/LandingIcons";
import logo from "../assets/tratoya-logo.png";
import "../styles/auth-slide.css";

const EASE = [0.22, 1, 0.36, 1];

export default function PublicTratoPage({ link, session, goAuth, toast }) {
  const [trato, setTrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paymentReport, setPaymentReport] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/tratos/public/${link}`);
      setTrato(r.data);
    } catch (e) { toast(e.message, "error"); setTrato(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [link]);

  const reportarPago = async ({ method, transactionRef, transferConcept, receipt, notes }, target = trato) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("dealId", target.id);
      fd.append("method", method);
      fd.append("transactionRef", transactionRef);
      fd.append("transferConcept", transferConcept || "");
      fd.append("notes", notes || "");
      if (receipt) fd.append("receipt", receipt);
      const r = await api.upload(`/payments/manual/report`, fd);
      setPaymentReport(r.data || r);
      setTrato((prev) => prev ? { ...prev, estado: "pago_pendiente" } : prev);
      toast("Pago reportado. Lo revisaremos en máximo 1 hora.", "success");
      setTimeout(() => { window.location.href = "/?page=pagos"; }, 650);
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const aceptar = async () => {
    if (!session) { goAuth("login"); return; }
    setBusy(true);
    try {
      const r = await api.put(`/tratos/public/${link}/activar`);
      setTrato(r.data);
      toast("Trato aceptado. Continúa con el pago seguro.", "success");
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="auth-slide-app ty-checkout-app" style={{ display: "grid", placeItems: "center" }}>
        <div className="spin" style={{ color: "var(--auth-neon)" }} />
      </div>
    );
  }

  if (!trato) {
    return (
      <div className="auth-slide-app ty-checkout-app" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <div className="auth-glass-card ty-checkout-card" style={{ textAlign: "center", maxWidth: 400 }}>
          <h2 style={{ marginBottom: 8 }}>Trato no encontrado</h2>
          <p style={{ color: "rgba(255,255,255,.58)", marginBottom: 18 }}>Este link puede haber expirado o ya fue utilizado.</p>
          <button className="auth-neon-btn" type="button" onClick={() => { window.location.href = "/"; }}>Ir al inicio</button>
        </div>
      </div>
    );
  }

  const ec = ESTADO[trato.estado] || ESTADO.borrador;
  const montoTrato = parseCopAmount(trato.monto);
  const quienComision = trato.quien_paga_comision || "comprador";
  const vendedor = trato.vendedor ? `${trato.vendedor.nombre} ${trato.vendedor.apellido}` : "Vendedor";
  const isSeller = session?.user?.id === trato.vendedor?.id;
  const canAccept = session && !isSeller && trato.estado === "borrador";
  const canPay = session && !isSeller && trato.estado === "activo";

  return (
    <div className="auth-slide-app ty-checkout-app">
      <div className="auth-ambient" aria-hidden="true">
        <div className="auth-grid" />
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-scanline" />
      </div>

      <header className="ty-checkout-top">
        <button type="button" className="auth-back-btn ty-checkout-back" onClick={() => { window.location.href = "/"; }} aria-label="Volver">←</button>
        <a className="ty-checkout-logo" href="/" aria-label="TratoYa">
          <img src={logo} alt="TratoYa" />
        </a>
        {!session && (
          <div className="ty-checkout-auth-btns">
            <button type="button" className="ty-checkout-ghost" onClick={() => goAuth("login")}>Iniciar sesión</button>
            <button type="button" className="ty-checkout-neon-sm" onClick={() => goAuth("register")}>Crear cuenta</button>
          </div>
        )}
      </header>

      <main className="ty-checkout-main">
        <motion.div
          className="auth-glass-card ty-checkout-card"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="ty-checkout-head">
            <div>
              <div className="ty-checkout-code">{trato.codigo}</div>
              <h1>{trato.titulo}</h1>
              <p>Creado por {vendedor}</p>
            </div>
            <span className={`bdg ${ec.c} ty-checkout-badge`}>{ec.l}</span>
          </div>

          {trato.descripcion && (
            <p className="ty-checkout-desc">{trato.descripcion}</p>
          )}

          <div className="ty-checkout-breakdown">
            <CommissionBreakdown monto={montoTrato} quien={quienComision} variant="dark" note="Este es el valor exacto que debes transferir para activar el pago protegido TratoYa." />
          </div>

          {!session ? (
            <div className="ty-checkout-actions">
              <button type="button" className="auth-neon-btn" onClick={() => goAuth("register")}>Crear cuenta y aceptar</button>
              <button type="button" className="ty-checkout-ghost-full" onClick={() => goAuth("login")}>Ya tengo cuenta</button>
            </div>
          ) : isSeller ? (
            <div className="ty-checkout-info">
              <strong>Este link es para que tu contraparte acepte y pague.</strong>
              <p>Comparte este link con tu comprador para que lo acepte y pague de forma protegida.</p>
              <button type="button" className="ty-checkout-ghost-full" onClick={() => { window.location.href = "/"; }}>Ir a mi inicio</button>
            </div>
          ) : canAccept ? (
            <div className="accept-panel ty-glass-panel">
              <div className="accept-panel-head">
                <span className="accept-panel-shield" aria-hidden="true"><ShieldIcon /></span>
                <div>
                  <div className="accept-panel-kicker">Trato protegido por TratoYa</div>
                  <h3 className="accept-panel-title">Estás a un paso de tu compra segura</h3>
                </div>
              </div>
              <ul className="accept-panel-list">
                <li><span className="accept-panel-bico" aria-hidden="true"><LockIcon /></span> Tu dinero queda <strong>en custodia</strong>, no se le entrega al vendedor todavía.</li>
                <li><span className="accept-panel-bico" aria-hidden="true"><CashIcon /></span> El vendedor entrega y tú revisas con calma.</li>
                <li><span className="accept-panel-bico" aria-hidden="true"><FlagIcon /></span> El pago se libera <strong>solo cuando confirmas</strong> que recibiste bien.</li>
              </ul>
              <button type="button" className="accept-panel-cta auth-neon-btn" onClick={aceptar} disabled={busy}>
                {busy ? <div className="spin" /> : <>Aceptar y continuar al pago <span aria-hidden="true">→</span></>}
              </button>
              <p className="accept-panel-note">Al aceptar verás los datos para pagar de forma segura a TratoYa. Nunca le transfieras directamente al vendedor.</p>
            </div>
          ) : canPay ? (
            <div className="ty-checkout-pay">
              <ManualPaymentBox amount={calcularComisionUI(montoTrato, quienComision).totalPagar} reference={trato.codigo} busy={busy} onReport={(payload) => reportarPago(payload)} toast={toast} />
              {paymentReport?.reference && <div className="ty-checkout-pay-note">Reporte: {paymentReport.reference}</div>}
            </div>
          ) : (
            <div className="ty-checkout-info">
              <p>Este trato está en estado <strong>{ec.l}</strong>. Puedes verlo desde tu panel.</p>
              <button type="button" className="ty-checkout-ghost-full" onClick={() => { window.location.href = "/"; }}>Ir a mi inicio</button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
