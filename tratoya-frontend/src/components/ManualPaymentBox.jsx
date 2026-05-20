import { useState } from "react";
import { fmt } from "../lib/utils";

const PAYMENT_KEY = import.meta.env.VITE_MANUAL_PAYMENT_KEY || "soporte@tratoya.com";
const QR_URL = import.meta.env.VITE_MANUAL_PAYMENT_QR_URL || `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(PAYMENT_KEY)}`;
const PAYMENT_NAME = import.meta.env.VITE_MANUAL_PAYMENT_NAME || "TratoYa";

export default function ManualPaymentBox({ amount, reference, busy, onReport }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("breb");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!transactionRef.trim()) return;
    onReport({ method, transactionRef: transactionRef.trim(), notes });
  };

  if (!open) {
    return (
      <button className="secure-pay-btn" onClick={() => setOpen(true)} disabled={busy}>
        <span className="secure-pay-ico">🔒</span>
        <span>
          <strong>Pago seguro TratoYa</strong>
          <small>
            <img src="/brand-nequi.svg" alt="Nequi" />
            <img src="/brand-breb.svg" alt="Bre-B" />
          </small>
        </span>
      </button>
    );
  }

  return (
    <div className="manual-pay-card">
      <div className="manual-pay-head">
        <div>
          <div className="manual-pay-kicker">Pago protegido</div>
          <h3>Transfiere a TratoYa</h3>
        </div>
        <button className="btn bg_ bsm" onClick={() => setOpen(false)}>×</button>
      </div>

      <div className="manual-pay-grid">
        <div className="manual-qr">
          {QR_URL ? (
            <>
              <img src={QR_URL} alt="QR de pago TratoYa" />
              <a className="manual-qr-link" href={QR_URL} target="_blank" rel="noreferrer">Abrir QR</a>
            </>
          ) : (
            <div className="manual-qr-empty">QR Nequi / Bre-B</div>
          )}
        </div>
        <div className="manual-pay-data">
          <div className="manual-pay-row"><span>Monto exacto</span><strong>{fmt(amount)}</strong></div>
          <div className="manual-pay-row"><span>Referencia</span><strong>{reference}</strong></div>
          <div className="manual-pay-row"><span>Llave</span><strong className="wrap-any">{PAYMENT_KEY}</strong></div>
          <div className="manual-pay-row"><span>Recibe</span><strong>{PAYMENT_NAME}</strong></div>
        </div>
      </div>

      <div className="manual-pay-note">
        Incluye la referencia <strong>{reference}</strong> en el concepto de la transferencia si tu banco lo permite.
      </div>

      <div className="g2 manual-pay-form">
        <div className="fg">
          <label className="fl">Método usado</label>
          <select className="inp" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="breb">Bre-B</option>
            <option value="nequi">Nequi</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Número de transacción</label>
          <input className="inp" placeholder="Ej: 94857231" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
        </div>
      </div>
      <div className="fg">
        <label className="fl">Nota opcional</label>
        <input className="inp" placeholder="Banco, hora o detalle útil para verificar" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn bp blg" style={{ width: "100%" }} onClick={submit} disabled={busy || !transactionRef.trim()}>
        {busy ? <div className="spin" /> : "Ya realicé el pago"}
      </button>
      <div className="manual-pay-foot">Pago en revisión. Te avisamos en máximo 1 hora.</div>
    </div>
  );
}
