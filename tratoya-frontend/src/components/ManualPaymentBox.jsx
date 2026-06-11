import { useState } from "react";
import { fmt } from "../lib/utils";

const PAYMENT_KEY = import.meta.env.VITE_MANUAL_PAYMENT_KEY || "0092187758";
const QR_URL = import.meta.env.VITE_MANUAL_PAYMENT_QR_URL || "/nequi-breb-qr.png";
const PAYMENT_NAME = import.meta.env.VITE_MANUAL_PAYMENT_NAME || "TratoYa";

function CopyField({ label, value, hint, highlight }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* silencioso */ }
  };
  return (
    <div className={`pw-copy${highlight ? " pw-copy--key" : ""}`}>
      <div className="pw-copy-info">
        <span>{label}</span>
        <strong className="wrap-any">{value}</strong>
        {hint && <em>{hint}</em>}
      </div>
      <button type="button" className={`pw-copy-btn${copied ? " is-copied" : ""}`} onClick={copy} aria-label={`Copiar ${label}`}>
        {copied ? "✓ ¡Copiado!" : "⧉ Copiar"}
      </button>
    </div>
  );
}

export default function ManualPaymentBox({ amount, reference, busy, onReport }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("breb");
  const [receipt, setReceipt] = useState(null);
  const [notes, setNotes] = useState("");
  const [showQr, setShowQr] = useState(false);

  const reset = () => { setStep(1); setReceipt(null); setNotes(""); setShowQr(false); };
  const close = () => { setOpen(false); reset(); };

  const submit = () => {
    if (!receipt) return;
    onReport({ method, transactionRef: "", transferConcept: "", receipt, notes });
  };

  if (!open) {
    return (
      <button className="secure-pay-btn" onClick={() => setOpen(true)} disabled={busy}>
        <span className="secure-pay-ico" aria-hidden="true">🔒</span>
        <span className="secure-pay-copy">
          <strong>Pagar de forma segura con TratoYa</strong>
          <em>Transfiere y adjunta tu comprobante</em>
          <small>
            <img src="/brand-nequi.svg" alt="Nequi" />
            <img src="/brand-breb.svg" alt="Bre-B" />
          </small>
        </span>
      </button>
    );
  }

  return (
    <div className="manual-pay-pop">
      <div className="manual-pay-card pw-card">
        <div className="manual-pay-head">
          <div>
            <div className="manual-pay-kicker">Pago protegido · Paso {step} de 3</div>
            <h3>
              {step === 1 && "¿Cómo funciona tu pago?"}
              {step === 2 && "Paga desde tu banco"}
              {step === 3 && "Sube tu comprobante"}
            </h3>
          </div>
          <button className="btn bg_ bsm" onClick={close} aria-label="Cerrar">×</button>
        </div>

        <div className="pw-progress" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`pw-progress-bar${n <= step ? " is-on" : ""}`} />
          ))}
        </div>

        {/* PASO 1 — Confirma a quién pagas */}
        {step === 1 && (
          <div className="pw-body">
            <div className="pw-amount-card">
              <span>Vas a pagar</span>
              <strong>{fmt(amount)}</strong>
              <em>a {PAYMENT_NAME}, no al vendedor</em>
            </div>
            <div className="pw-shield">
              <span className="pw-shield-ico">🔒</span>
              <p>Tu dinero queda <b>protegido en TratoYa</b> hasta que confirmes que recibiste lo acordado. Si algo sale mal, lo recuperas.</p>
            </div>
            <ul className="pw-points">
              <li><span>1</span> Transfieres el monto exacto a la cuenta oficial de TratoYa.</li>
              <li><span>2</span> Subes el comprobante de tu transferencia.</li>
              <li><span>3</span> Verificamos el pago en menos de 1 hora y avisamos al vendedor.</li>
            </ul>
            <button className="btn bp blg" style={{ width: "100%" }} onClick={() => setStep(2)}>
              Tengo claro, ¿cómo pago? →
            </button>
          </div>
        )}

        {/* PASO 2 — Datos para transferir */}
        {step === 2 && (
          <div className="pw-body">
            <div className="pw-warn">⚠️ Paga <b>únicamente</b> a esta cuenta oficial de TratoYa. Nunca transfieras directo al vendedor.</div>
            <CopyField label="Transfiere a esta llave Nequi / Bre-B" value={PAYMENT_KEY} hint="Cópiala y pégala en tu app del banco" highlight />
            <CopyField label="Monto exacto" value={fmt(amount)} />
            <CopyField label="Referencia (ponla en el concepto)" value={reference} />

            <button type="button" className="pw-qr-toggle" onClick={() => setShowQr((v) => !v)}>
              {showQr ? "▾ Ocultar QR" : "▸ Prefiero escanear un código QR"}
            </button>
            {showQr && (
              <div className="pw-qr">
                {QR_URL ? (
                  <>
                    <img src={QR_URL} alt="Código QR para pagar a TratoYa" />
                    <a className="manual-qr-link" href={QR_URL} target="_blank" rel="noreferrer">Abrir QR en grande</a>
                  </>
                ) : (
                  <div className="manual-qr-empty">QR Nequi / Bre-B</div>
                )}
              </div>
            )}

            <div className="pw-nav">
              <button className="btn bo" onClick={() => setStep(1)}>← Atrás</button>
              <button className="btn bp" style={{ flex: 1 }} onClick={() => setStep(3)}>Ya transferí, subir comprobante →</button>
            </div>
          </div>
        )}

        {/* PASO 3 — Subir comprobante */}
        {step === 3 && (
          <div className="pw-body">
            <p className="pw-step-help">Sube la <b>captura o PDF</b> de tu transferencia. Así verificamos tu pago.</p>
            <label className={`pw-drop${receipt ? " has-file" : ""}`}>
              <input type="file" accept="image/*,.pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
              <span className="pw-drop-ico">{receipt ? "✓" : "📎"}</span>
              <strong>{receipt?.name || "Toca para subir tu comprobante"}</strong>
              <em>{receipt ? "Archivo listo · toca para cambiarlo" : "Imagen (JPG, PNG) o PDF · máx 8 MB"}</em>
            </label>

            <div className="fg">
              <label className="fl">¿Con qué pagaste?</label>
              <select className="inp" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="breb">Bre-B</option>
                <option value="nequi">Nequi</option>
                <option value="transferencia">Transferencia bancaria</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Nota (opcional)</label>
              <input className="inp" placeholder="Banco, hora o detalle útil para verificar" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="pw-nav">
              <button className="btn bo" onClick={() => setStep(2)}>← Atrás</button>
              <button className="btn bp" style={{ flex: 1 }} onClick={submit} disabled={busy || !receipt}>
                {busy ? <div className="spin" /> : "Enviar comprobante"}
              </button>
            </div>
            <div className="manual-pay-foot">Revisamos tu pago en menos de 1 hora y te avisamos al instante.</div>
          </div>
        )}
      </div>
    </div>
  );
}
