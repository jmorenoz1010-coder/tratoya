import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate } from "../lib/utils";

const ESTADO_PAGO = {
  aprobado:  { label: "Aprobado",  cls: "gn" },
  pendiente: { label: "Pendiente", cls: "or" },
  creado:    { label: "Iniciado",  cls: "nb" },
  rechazado: { label: "Rechazado", cls: "re" },
  error:     { label: "Error",     cls: "re" },
  anulado:   { label: "Anulado",   cls: "or" },
  procesando:{ label: "Procesando",cls: "or" },
  reembolsado:{ label: "Reembolsado", cls: "nb" },
};
let pagosCache = [];

export default function Pagos({ toast }) {
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
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="modal payment-flow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3>Flujo de la operación</h3>
                <p style={{ fontSize: 12, color: "var(--s500)" }}>{selected.Trato?.codigo || "Trato"} · {selected.Trato?.titulo || ""}</p>
              </div>
              <button className="btn bg_ bsm" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="flow-steps">
              {[
                ["Cargo", "Comprador reporta pago", true],
                ["Retención", "TratoYA revisa y retiene", ["procesando","aprobado"].includes(selected.estado)],
                ["Aprobación", "Pago confirmado", selected.estado === "aprobado"],
                ["Liberación", "Consignación al vendedor", selected.tipo === "liberacion" || selected.Trato?.estado === "completado"],
              ].map(([t, d, ok], i, arr) => (
                <div className={`flow-step ${ok ? "done" : ""}`} key={t}>
                  <div className="flow-dot">{ok ? "✓" : i + 1}</div>
                  <b>{t}</b>
                  <span>{d}</span>
                  {i < arr.length - 1 && <em>→</em>}
                </div>
              ))}
              {selected.estado === "rechazado" && <div className="flow-declined">Declinado: el pago fue marcado como fallido.</div>}
            </div>
            <div style={{ padding: "0 18px 18px", display: "grid", gap: 8 }}>
              <div><b>Monto:</b> {fmt(selected.monto)}</div>
              <div><b>Referencia:</b> {selected.referencia || selected.pasarela_ref || "—"}</div>
              <div><b>Estado:</b> {(ESTADO_PAGO[selected.estado] || {}).label || selected.estado}</div>
            </div>
          </div>
        </div>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Trato</th><th>Tipo</th><th>Monto</th><th>Pasarela</th><th>Estado</th><th>Ref.</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {pagos.map((p, i) => {
                const st = ESTADO_PAGO[p.estado] || { label: p.estado || "—", cls: "or" };
                return (
                  <tr key={i} onClick={() => setSelected(p)} style={{ cursor: "pointer" }}>
                    <td>
                      <div style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{p.Trato?.codigo || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--s400)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.Trato?.titulo || ""}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{p.tipo || "cargo"}</td>
                    <td style={{ fontFamily: "Manrope", fontWeight: 700 }}>{fmt(p.monto)}</td>
                    <td style={{ fontSize: 12 }}>{p.pasarela || "Transferencia"}</td>
                    <td><span className={`bdg ${st.cls}`}>{st.label}</span></td>
                    <td style={{ fontSize: 10, color: "var(--s400)", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.referencia || p.pasarela_ref || "—"}</td>
                    <td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(p.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
