import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { fmt, fmtDate, PAGO_ESTADO } from "../lib/utils";

let pagosCache = [];

export default function Pagos() {
  const [pagos, setPagos] = useState(pagosCache);
  const [loading, setLoading] = useState(pagosCache.length === 0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/payments/history")
      .then((r) => {
        pagosCache = r.data || [];
        setPagos(pagosCache);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Historial de pagos</h1>

      {selected && createPortal(
        <div className="overlay payment-flow-overlay payment-detail-overlay" onClick={() => setSelected(null)}>
          <div className="modal payment-flow-modal payment-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>Detalle de la operación</h3>
                <p style={{ fontSize: 12, color: "var(--s500)" }}>{selected.Trato?.codigo || "Trato"} · {selected.Trato?.titulo || ""}</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="payment-detail-scroll">
              {(() => {
                const st = PAGO_ESTADO[selected.estado];
                return st ? (
                  <div className="payment-status-panel">
                    <span className={`bdg ${st.c}`} style={{ marginBottom: 6, display: "inline-block" }}>{st.l}</span>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--s600)", lineHeight: 1.55 }}>{st.desc}</p>
                    {st.help && <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--g2)", fontWeight: 600 }}>{st.help}</p>}
                  </div>
                ) : null;
              })()}
              <div className="flow-steps">
                {[
                  ["Pago registrado", "El comprador registró el pago en TratoYa", true],
                  ["Verificando pago", "TratoYa comprueba que el pago fue recibido", ["procesando", "aprobado"].includes(selected.estado)],
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
              <div style={{ padding: "0 18px 18px", display: "grid", gap: 8 }}>
                <div><b>Monto:</b> {fmt(selected.monto)}</div>
                <div><b>Referencia:</b> {selected.referencia || selected.pasarela_ref || "—"}</div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading && pagos.length === 0 ? (
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
            const st = PAGO_ESTADO[p.estado] || { l: p.estado || "—", c: "or" };
            return (
              <div
                key={i}
                className="pago-card"
                onClick={() => setSelected(p)}
              >
                <div className="pago-card-top">
                  <div className="pago-card-trato-info">
                    <span className="pago-card-codigo">{p.Trato?.codigo || "—"}</span>
                    <span className="pago-card-titulo">{p.Trato?.titulo || "Pago"}</span>
                  </div>
                  <span className={`bdg ${st.c}`}>{st.l}</span>
                </div>
                <div className="pago-card-bottom">
                  <span className="pago-card-amount">{fmt(p.monto)}</span>
                  <span className="pago-card-date">{fmtDate(p.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
