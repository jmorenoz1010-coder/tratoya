import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, ESTADO, TIPO_ICO } from "../lib/utils";
import { SkeletonList } from "../components/SkeletonCard";

let tratosCache = [];

export default function MisTratos({ setPage, setTratoId, user, toast, alertTratoIds = new Set() }) {
  const [tratos, setTratos] = useState(tratosCache);
  const [loading, setLoading] = useState(tratosCache.length === 0);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");

  const load = () => {
    api.get("/tratos?limit=50")
      .then((r) => {
        tratosCache = r.data || [];
        setTratos(tratosCache);
      })
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 14 }}>Mis Tratos</h1>

      <div className="trato-filters-row">
        <div className="pt">
          {[["todos", "Todos"], ["activos", "Activos"], ["completados", "Completados"]].map(([id, l]) => (
            <button key={id} type="button" className={`pt-i ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>
              {l}
            </button>
          ))}
        </div>
        <div className="trato-search">
          <span aria-hidden="true">🔍</span>
          <input
            placeholder="Buscar..."
            style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", background: "transparent", width: "100%" }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading && tratos.length === 0 ? (
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
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {filtered.map((t) => {
            const ec = ESTADO[t.estado] || ESTADO.borrador;
            const rol = t.vendedor?.id === user?.id ? "Vendedor" : "Comprador";
            const hasAlert = alertTratoIds?.has(t.id);
            return (
              <div key={t.id} className="trato-row">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {TIPO_ICO[t.tipo] || "📋"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 10.5, color: "var(--g2)" }}>
                        {t.codigo}
                      </span>
                      <span className={`bdg ${rol === "Vendedor" ? "nb" : "or"}`} style={{ fontSize: 9 }}>{rol}</span>
                      {hasAlert && <span style={{ fontSize: 11 }} title="Tienes notificaciones sin leer">⚠️</span>}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                      {t.titulo}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className={`bdg ${ec.c}`} style={{ fontSize: 10 }}>{ec.l}</span>
                      <span style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</span>
                      <span style={{ marginLeft: "auto", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {fmt(t.monto)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="trato-actions">
                  <button
                    className="trato-details-link"
                    onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                  >
                    Ver detalles
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
