import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, TIPO_ICO, accionPendiente } from "../lib/utils";
import { SkeletonList } from "../components/SkeletonCard";
import CaducidadAviso from "../components/CaducidadAviso";
import EstadoPill from "../components/EstadoPill";

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
    <div className="page mis-tratos-page fi">
      <h1 className="page-hd mis-tratos-title">Mis Tratos</h1>

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
          {filtered.map((t, idx) => {
            const rol = t.vendedor?.id === user?.id ? "Vendedor" : "Comprador";
            const hasAlert = alertTratoIds?.has(t.id);
            const pendiente = accionPendiente(t, user?.id);
            return (
              <div
                key={t.id}
                className="trato-row trato-row--tap fi"
                style={{ animationDelay: `${Math.min(idx, 8) * 0.04}s` }}
                role="button"
                tabIndex={0}
                onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                onKeyDown={(e) => e.key === "Enter" && (setTratoId(t.id), setPage("detalle"))}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {TIPO_ICO[t.tipo] || "📋"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        {t.titulo}
                      </div>
                      {hasAlert && <span style={{ fontSize: 11, flexShrink: 0 }} title="Tienes notificaciones sin leer">⚠️</span>}
                      <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {fmt(t.monto)}
                      </span>
                    </div>

                    {pendiente
                      ? <EstadoPill label={pendiente} estado={t.estado} />
                      : <EstadoPill estado={t.estado} />}

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      <CaducidadAviso trato={t} compact />
                      <span style={{ fontSize: 11, color: "var(--s400)" }}>{rol} · {fmtDate(t.createdAt)}</span>
                      <span className="trato-row-arrow" aria-hidden="true">→</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
