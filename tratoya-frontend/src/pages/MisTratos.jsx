import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, ESTADO, TIPO_ICO, accionPendiente, accionTono } from "../lib/utils";
import { SkeletonList } from "../components/SkeletonCard";
import CaducidadAviso from "../components/CaducidadAviso";

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
    <div className="page page-list fi">
      <div className="page-band">
        <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 0 }}>Mis Tratos</h1>
        <p className="page-sub">Seguimiento y gestión de todos tus tratos</p>
      </div>

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
        <div className="list-stack">
          {filtered.map((t, idx) => {
            const ec = ESTADO[t.estado] || ESTADO.borrador;
            const rol = t.vendedor?.id === user?.id ? "Vendedor" : "Comprador";
            const hasAlert = alertTratoIds?.has(t.id);
            const pendiente = accionPendiente(t, user?.id);
            const tono = accionTono(t, user?.id);
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
                  <div className="trato-row-icon ico-dark">
                    {TIPO_ICO[t.tipo] || "📋"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <div className="trato-row-title" style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                        {t.titulo}
                      </div>
                      {hasAlert && <span style={{ fontSize: 11, flexShrink: 0 }} title="Tienes notificaciones sin leer">⚠️</span>}
                      <span className="trato-row-amount" style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {fmt(t.monto)}
                      </span>
                    </div>

                    <div className="trato-row-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {/* Si hay acción pendiente mostramos solo el chip animado (evita el duplicado con el estado) */}
                      {pendiente
                        ? <span className={`bdg trato-chip-action tono-${tono}`} style={{ fontSize: 10 }}>{pendiente}</span>
                        : <span className={`bdg ${ec.c}`} style={{ fontSize: 10 }}>{ec.l}</span>}
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
