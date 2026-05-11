import { useState, useEffect } from "react";
import { api } from "../lib/api";

const STATUS_COPY = {
  PAID:             ["✅", "Pago recibido",      "Tus fondos quedaron registrados en TratoYA."],
  PAYMENT_PENDING:  ["⏳", "Pago pendiente",     "Tu pago está pendiente de confirmación."],
  CREATED:          ["⏳", "Verificando pago",   "Estamos verificando tu pago con ePayco..."],
  PAYMENT_DECLINED: ["❌", "Pago rechazado",     "El pago fue rechazado. Puedes intentar nuevamente."],
  PAYMENT_ERROR:    ["⚠️", "Error en el pago",  "Hubo un error procesando el pago."],
  PAYMENT_VOIDED:   ["↩️", "Pago anulado",      "El pago fue anulado por ePayco."],
};

export default function PaymentResultPage({ session, goAuth, toast }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("x_id_invoice") || params.get("x_extra3") || params.get("invoice");

  useEffect(() => {
    if (!session || !reference) { setLoading(false); return; }
    const check = () =>
      api.get(`/payments/status?reference=${encodeURIComponent(reference)}`)
        .then((r) => setResult(r.data))
        .catch((e) => toast(e.message, "error"))
        .finally(() => setLoading(false));
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [session, reference]);

  const status = result?.status;
  const [icon, title, body] = STATUS_COPY[status] || ["💳", "Resultado del pago", "Estamos verificando tu pago con ePayco..."];

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--s50)", padding: 20 }}>
      <div className="card" style={{ padding: "26px 28px", maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>{icon}</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h1>
        {!session ? (
          <p style={{ color: "var(--s600)", marginBottom: 16 }}>Inicia sesión para verificar el estado de la transacción.</p>
        ) : loading ? (
          <div className="spin" style={{ margin: "18px auto" }} />
        ) : !reference ? (
          <p style={{ color: "var(--s600)" }}>ePayco no envió una referencia de pago.</p>
        ) : (
          <p style={{ color: "var(--s600)" }}>{body}</p>
        )}
        {reference && (
          <div style={{ fontSize: 11, color: "var(--s400)", wordBreak: "break-all", marginTop: 10 }}>
            Referencia: {reference}
          </div>
        )}
        {!session && <button className="btn bp" style={{ marginTop: 16 }} onClick={() => goAuth("login")}>Iniciar sesión</button>}
        {session && <button className="btn bp" style={{ marginTop: 16 }} onClick={() => { window.location.href = "/"; }}>Volver al dashboard</button>}
      </div>
    </div>
  );
}
