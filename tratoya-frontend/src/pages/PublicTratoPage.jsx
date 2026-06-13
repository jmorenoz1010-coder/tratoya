import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { ESTADO, calcularComisionUI, parseCopAmount } from "../lib/utils";
import CommissionBreakdown from "../components/CommissionBreakdown";
import ManualPaymentBox from "../components/ManualPaymentBox";
import logo from "../assets/tratoya-logo.png";

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
      const accepted = r.data;
      setTrato(accepted);
      toast("Trato aceptado. Continúa con el pago seguro.", "success");
      setBusy(false);
      return;
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="spin" style={{ color: "var(--s400)" }} />
    </div>
  );

  if (!trato) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ padding: "32px 36px", textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🔍</div>
        <h2>Trato no encontrado</h2>
        <p style={{ color: "var(--s600)", marginTop: 8 }}>Este link puede haber expirado o ya fue utilizado.</p>
        <button className="btn bp" style={{ marginTop: 18 }} onClick={() => window.location.href = "/"}>Ir al inicio</button>
      </div>
    </div>
  );

  const ec = ESTADO[trato.estado] || ESTADO.borrador;
  const montoTrato = parseCopAmount(trato.monto);
  const quienComision = trato.quien_paga_comision || "comprador";
  const vendedor = trato.vendedor ? `${trato.vendedor.nombre} ${trato.vendedor.apellido}` : "Vendedor";
  const isSeller = session?.user?.id === trato.vendedor?.id;
  const canAccept = session && !isSeller && trato.estado === "borrador";
  const canPay = session && !isSeller && trato.estado === "activo";

  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo-row">
          <button className="public-checkout-back" onClick={() => { window.location.href = "/"; }} title="Volver al inicio" aria-label="Volver al inicio">←</button>
          <button className="public-checkout-logo" onClick={() => { window.location.href = "/"; }} title="Ir al inicio">
            <img src={logo} alt="TratoYA" />
          </button>
        </div>
        {!session && (
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn bg_" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => goAuth("login")}>Iniciar sesión</button>
            <button className="btn bp" onClick={() => goAuth("register")}>Crear cuenta</button>
          </div>
        )}
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "38px 20px" }}>
        <div className="card" style={{ padding: "24px 26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "Manrope", fontWeight: 800, color: "var(--g2)", fontSize: 12, marginBottom: 5 }}>{trato.codigo}</div>
              <h1 style={{ fontSize: 27, marginBottom: 7 }}>{trato.titulo}</h1>
              <div style={{ color: "var(--s600)", fontSize: 13 }}>Creado por {vendedor}</div>
            </div>
            <span className={`bdg ${ec.c}`}>{ec.l}</span>
          </div>

          {trato.descripcion && (
            <p style={{ color: "var(--s600)", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>{trato.descripcion}</p>
          )}

          <div style={{ marginBottom: 18 }}>
            <CommissionBreakdown monto={montoTrato} quien={quienComision} note="Este es el valor exacto que debes transferir para activar el pago protegido TratoYa." />
          </div>

          {!session ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn bp blg" onClick={() => goAuth("register")}>Crear cuenta y aceptar</button>
              <button className="btn bo blg" onClick={() => goAuth("login")}>Ya tengo cuenta</button>
            </div>
          ) : isSeller ? (
            <div style={{ background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>
              <div style={{ fontWeight: 700, color: "var(--n)", marginBottom: 4 }}>Este link es para que tu contraparte acepte y pague.</div>
              <div style={{ marginBottom: 12 }}>Comparte este link con tu comprador para que lo acepte y pague de forma protegida.</div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="btn bo" onClick={() => { window.location.href = "/"; }}>Ir a mi inicio</button>
              </div>
            </div>
          ) : canAccept ? (
            <button className="btn bp blg" onClick={aceptar} disabled={busy}>{busy ? <div className="spin" /> : "Aceptar trato y continuar al pago"}</button>
          ) : canPay ? (
            <div>
              <ManualPaymentBox amount={calcularComisionUI(montoTrato, quienComision).totalPagar} reference={trato.codigo} busy={busy} onReport={(payload) => reportarPago(payload)} />
              {paymentReport?.reference && <div style={{ fontSize: 11, color: "var(--s600)", marginTop: 8 }}>Reporte: {paymentReport.reference}</div>}
            </div>
          ) : (
            <div style={{ background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>
              Este trato está en estado {ec.l}. Puedes verlo desde tu panel.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
