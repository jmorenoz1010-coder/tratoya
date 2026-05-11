import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate } from "../lib/utils";

export default function Pagos({ toast }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/payments/history")
      .then((r) => setPagos(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page fi">
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 18 }}>Historial de pagos</h1>
      {loading ? (
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
              <tr><th>Trato</th><th>Tipo</th><th>Monto</th><th>Pasarela</th><th>Estado</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {pagos.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>{p.Trato?.codigo || "—"}</td>
                  <td>{p.tipo}</td>
                  <td style={{ fontFamily: "Manrope", fontWeight: 700 }}>{fmt(p.monto)}</td>
                  <td>{p.pasarela}</td>
                  <td><span className={`bdg ${p.estado === "aprobado" ? "gn" : "or"}`}>{p.estado}</span></td>
                  <td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
