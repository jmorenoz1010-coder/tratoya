import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, ESTADO, calcularComisionUI, openEpaycoCheckout } from "../lib/utils";
import CommissionBreakdown from "../components/CommissionBreakdown";
import EpaycoMark from "../components/EpaycoMark";

export default function PublicTratoPage({ link, session, goAuth, toast }) {
  const [trato, setTrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/tratos/public/${link}`);
      setTrato(r.data);
    } catch (e) { toast(e.message, "error"); setTrato(null); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [link]);

  const aceptar = async () => {
    if (!session) { goAuth("login"); return; }
    setBusy(true);
    try {
      const r = await api.put(`/tratos/public/${link}/activar`);
      setTrato(r.data);
      toast("Trato aceptado. Ahora puedes pagar.", "success");
    } catch (e) { toast(e.message, "error"); }
    setBusy(false);
  };

  const pagar = async () => {
    const pago = calcularComisionUI(parseFloat(trato?.monto || 0), trato?.quien_paga_comision || "comprador");
    if (!window.confirm(`Vas a pagar ${fmt(pago.totalPagar)} COP por este acuerdo en TratoYa. Este pago se procesará por ePayco.`)) return;
    setBusy(true);
    try {
      const r = await api.post(`/payments/epayco/create`, { dealId: trato.id });
      const paymentOrder = r.data || r;
      setOrder(paymentOrder);
      await openEpaycoCheckout(paymentOrder);
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
  const montoTrato = parseFloat(trato.monto || 0);
  const quienComision = trato.quien_paga_comision || "comprador";
  const vendedor = trato.vendedor ? `${trato.vendedor.nombre} ${trato.vendedor.apellido}` : "Vendedor";
  const isSeller = session?.user?.id === trato.vendedor?.id;
  const canAccept = session && !isSeller && trato.estado === "borrador";
  const canPay = session && !isSeller && trato.estado === "pago_pendiente";

  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo-row">
          <button className="btn bg_ back-mini" style={{ color: "rgba(255,255,255,.72)" }} onClick={() => { window.location.href = "/"; }} title="Inicio">←</button>
          <div style={{ width: 28, height: 28, background: "var(--g)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "var(--n)" }}>T</div>
          <span style={{ fontFamily: "Manrope", fontSize: 18, fontWeight: 800, color: "#fff" }}>Trato<span style={{ color: "var(--g)" }}>Ya</span></span>
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
            <CommissionBreakdown monto={montoTrato} quien={quienComision} note="Este es el valor real que se usará para el checkout de ePayco." />
          </div>

          {!session ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn bp blg" onClick={() => goAuth("register")}>Crear cuenta y aceptar</button>
              <button className="btn bo blg" onClick={() => goAuth("login")}>Ya tengo cuenta</button>
            </div>
          ) : isSeller ? (
            <div style={{ background: "var(--cr)", padding: 13, borderRadius: 10, fontSize: 13, color: "var(--s600)" }}>
              <div style={{ fontWeight: 700, color: "var(--n)", marginBottom: 4 }}>Este link es para que tu contraparte acepte y pague.</div>
              <div style={{ marginBottom: 12 }}>Comparte este link con tu comprador para que lo acepte y pague con ePayco.</div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <button className="btn bo" onClick={() => { window.location.href = "/"; }}>Ir a mi dashboard</button>
              </div>
            </div>
          ) : canAccept ? (
            <button className="btn bp blg" onClick={aceptar} disabled={busy}>{busy ? <div className="spin" /> : "Aceptar trato y continuar al pago"}</button>
          ) : canPay ? (
            <div>
              <button className="btn bp blg" style={{ width: "100%" }} onClick={pagar} disabled={busy}>
                {busy ? <div className="spin" /> : <><span>Pagar con</span><EpaycoMark /></>}
              </button>
              {order?.reference && <div style={{ fontSize: 11, color: "var(--s600)", marginTop: 8 }}>Referencia: {order.reference}</div>}
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
