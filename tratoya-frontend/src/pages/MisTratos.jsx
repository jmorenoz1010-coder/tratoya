import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, ESTADO, TIPO_ICO, publicTratoUrl } from "../lib/utils";
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

      {/* Filtros + búsqueda */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="pt">
          {[["todos", "Todos"], ["activos", "Activos"], ["completados", "Completados"]].map(([id, l]) => (
            <div key={id} className={`pt-i ${filter === id ? "act" : ""}`} onClick={() => setFilter(id)}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1.5px solid var(--s200)", borderRadius: 9, padding: "0 11px", height: 36, flex: "1 1 140px", maxWidth: 220 }}>
          🔍{" "}
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
                {/* Fila principal */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {/* Ícono */}
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {TIPO_ICO[t.tipo] || "📋"}
                  </div>

                  {/* Contenido */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Código + rol + alerta */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 10.5, color: "var(--g2)" }}>
                        {t.codigo}
                      </span>
                      <span className={`bdg ${rol === "Vendedor" ? "nb" : "or"}`} style={{ fontSize: 9 }}>{rol}</span>
                      {hasAlert && <span style={{ fontSize: 11 }} title="Tienes notificaciones sin leer">⚠️</span>}
                    </div>

                    {/* Título */}
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                      {t.titulo}
                    </div>

                    {/* Estado + fecha + monto */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className={`bdg ${ec.c}`} style={{ fontSize: 10 }}>{ec.l}</span>
                      <span style={{ fontSize: 11, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</span>
                      <span style={{ marginLeft: "auto", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                        {fmt(t.monto)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--s100)" }}>
                  <button
                    className="btn bp bsm"
                    style={{ flex: 1, fontSize: 13 }}
                    onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                  >
                    Ver detalles →
                  </button>
                  {t.link_compartir && (
                    <button
                      className="btn bo bsm"
                      style={{ fontSize: 12, padding: "0 10px", minHeight: 36 }}
                      title="Copiar link"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(publicTratoUrl(t.link_compartir));
                        toast("Link copiado ✓", "success");
                      }}
                    >
                      🔗
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
