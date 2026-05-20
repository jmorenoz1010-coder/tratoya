import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, ESTADO, TIPO_ICO, publicTratoUrl } from "../lib/utils";
import { SkeletonList } from "../components/SkeletonCard";

export default function MisTratos({ setPage, setTratoId, user, toast, alertTratoIds = new Set() }) {
  const [tratos, setTratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [qrModal, setQrModal] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/tratos?limit=50")
      .then((r) => setTratos(r.data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tratos.filter((t) => {
    if (filter === "activos" && ["completado", "cancelado", "expirado"].includes(t.estado)) return false;
    if (filter === "completados" && t.estado !== "completado") return false;
    if (q) {
      const s = q.toLowerCase();
      return t.titulo.toLowerCase().includes(s) || (t.codigo || "").toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="page fi">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="page-hd" style={{ fontSize: 21 }}>Mis Tratos</h1>
        <div style={{ display: "flex", gap: 7 }}>
          <button className="btn bg_ bsm" onClick={load}>↻</button>
          <button className="btn bp" onClick={() => setPage("crear")}>➕ Nuevo</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="pt">
          {[["todos", "Todos"], ["activos", "Activos"], ["completados", "Completados"]].map(([id, l]) => (
            <div key={id} className={`pt-i ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid var(--s200)", borderRadius: 9, padding: "0 11px", height: 36, flex: "1 1 160px", maxWidth: 240 }}>
          🔍{" "}
          <input
            placeholder="Buscar..."
            style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "Inter", background: "transparent", width: "100%" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">📋</div>
          <div className="empty-t">Sin tratos {filter !== "todos" ? `en "${filter}"` : ""}</div>
          <div className="empty-d">Los tratos que crees o aceptes aparecerán aquí.</div>
          <button className="btn bp" style={{ marginTop: 14 }} onClick={() => setPage("crear")}>
            Crear trato
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Rol</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const ec = ESTADO[t.estado] || ESTADO.borrador;
                const rol = t.vendedor?.id === user?.id ? "Vendedor" : "Comprador";
                return (
                  <tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                  >
                    <td>
                      <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 11, color: "var(--g2)" }}>
                        {t.codigo}
                      </span>
                      {alertTratoIds?.has(t.id) && <span style={{color:"var(--or)", fontSize:14, marginLeft:4}} title="Tienes notificaciones sin leer sobre este trato">⚠️</span>}
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: 220 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                        {TIPO_ICO[t.tipo] || "📋"} {t.titulo}
                      </div>
                    </td>
                    <td>
                      <span className={`bdg ${rol === "Vendedor" ? "nb" : "or"}`}>{rol}</span>
                    </td>
                    <td style={{ fontFamily: "Manrope", fontWeight: 700 }}>{fmt(t.monto)}</td>
                    <td><span className={`bdg ${ec.c}`}>{ec.l}</span></td>
                    <td style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</td>
                    <td>
                      {t.link_compartir && (
                        <button
                          className="btn bo bsm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(publicTratoUrl(t.link_compartir));
                            toast("Link copiado ✓", "success");
                          }}
                        >
                          🔗
                        </button>
                      )}
                    </td>
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
