import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { fmt, fmtDateTime, PAGO_ESTADO, formatPaymentRef, pagoIconKey } from "../lib/utils";
import EstadoPill from "../components/EstadoPill";

let pagosCache = [];

export default function Pagos({ toast }) {
  const [pagos, setPagos] = useState(pagosCache);
  const [loading, setLoading] = useState(pagosCache.length === 0);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/payments/history")
      .then((r) => {
        pagosCache = r.data || [];
        setPagos(pagosCache);
        setLoadError("");
      })
      .catch((e) => setLoadError(e.message || "No pudimos cargar tus pagos."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page fi pagos-page">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Historial de pagos</h1>

      {selected && createPortal(
        <div className="overlay payment-flow-overlay payment-detail-overlay" onClick={() => setSelected(null)}>
          <div className="modal payment-flow-modal payment-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>Detalle de la operación</h3>
                <p style={{ fontSize: 12, color: "var(--s500)" }}>{formatPaymentRef(selected)} · {selected.Trato?.titulo || ""}</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="payment-detail-scroll">
              {(() => {
                const st = PAGO_ESTADO[selected.estado];
                return st ? (
                  <div className="payment-status-panel payment-status-panel--dark">
                    <EstadoPill label={st.l} icon={pagoIconKey(selected.estado)} tone={st.c} />
                    <p>{st.desc}</p>
                    {st.help && <p className="payment-status-help">{st.help}</p>}
                  </div>
                ) : null;
              })()}
              <div className="flow-steps flow-steps--dark">
                {[
                  ["Pago registrado", "El comprador registró el pago en TratoYa", true],
                  ["Verificando pago", "TratoYa comprueba que el pago fue recibido", ["procesando", "aprobado", "pendiente"].includes(selected.estado)],
                  ["Pago aprobado", "El dinero está protegido en TratoYa", selected.estado === "aprobado"],
                  ["Pago liberado", "El dinero fue enviado al vendedor", selected.tipo === "liberacion" || selected.Trato?.estado === "completado"],
                ].map(([t, d, ok], i, arr) => (
                  <div className={`flow-step ${ok ? "done" : ""}`} key={t}>
                    <div className="flow-dot">{ok ? "✓" : i + 1}</div>
                    <b>{t}</b>
                    <span>{d}</span>
                    {i < arr.length - 1 && <em>→</em>}
                  </div>
                ))}
                {selected.estado === "rechazado" && (
                  <div className="flow-declined">El pago no fue aprobado. El comprador debe intentar nuevamente.</div>
                )}
              </div>
              <div className="payment-detail-meta">
                <div><b>Monto:</b> {fmt(selected.monto)}</div>
                <div><b>Referencia:</b> {formatPaymentRef(selected)}</div>
                <div><b>Fecha:</b> {fmtDateTime(selected.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loadError && (
        <div style={{ background: "#fff4f4", border: "1px solid var(--re)", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "var(--re)" }}>
          {loadError}
          <button className="btn bo bsm" style={{ marginLeft: 10 }} onClick={() => { setLoading(true); setLoadError(""); api.get("/payments/history").then((r) => { pagosCache = r.data || []; setPagos(pagosCache); }).catch((e) => setLoadError(e.message)).finally(() => setLoading(false)); }}>Reintentar</button>
        </div>
      )}

      {loading && pagos.length === 0 && !loadError ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} />
        </div>
      ) : pagos.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">💳</div>
          <div className="empty-t">Sin movimientos</div>
          <div className="empty-d">Tus pagos aparecerán aquí</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {pagos.map((p, i) => {
            const st = PAGO_ESTADO[p.estado] || { l: p.estado || "—", c: "bg", icon: "coin" };
            return (
              <div
                key={i}
                className="pago-card"
                onClick={() => setSelected(p)}
              >
                <div className="pago-card-top">
                  <div className="pago-card-trato-info">
                    <span className="pago-card-codigo">{formatPaymentRef(p)}</span>
                    <span className="pago-card-titulo">{p.Trato?.titulo || "Pago"}</span>
                    <EstadoPill label={st.l} icon={pagoIconKey(p.estado)} tone={st.c} />
                  </div>
                </div>
                <div className="pago-card-bottom">
                  <span className="pago-card-amount">{fmt(p.monto)}</span>
                  <span className="pago-card-date">{fmtDateTime(p.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
