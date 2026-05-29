import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, ESTADO, TIPO_ICO, publicTratoUrl } from "../lib/utils";
import { SkeletonList } from "../components/SkeletonCard";

let tratosCache = [];

export default function MisTratos({ setPage, setTratoId, user, toast, alertTratoIds = new Set() }) {
  const [tratos, setTratos] = useState(tratosCache);
  const [loading, setLoading] = useState(tratosCache.length === 0);
  const [filter, setFilter] = useState("todos");
  const [q, setQ] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

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

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }} ref={menuRef}>
          {filtered.map((t) => {
            const ec = ESTADO[t.estado] || ESTADO.borrador;
            const rol = t.vendedor?.id === user?.id ? "Vendedor" : "Comprador";
            const isMenuOpen = openMenu === t.id;
            return (
              <div key={t.id} className="trato-row" style={{ position: "relative" }}>
                {/* Fila principal clicable */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", flex: 1, minWidth: 0 }}
                  onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
                    {TIPO_ICO[t.tipo] || "📋"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      {t.titulo}
                      {alertTratoIds?.has(t.id) && <span style={{ color: "var(--or)", fontSize: 13 }} title="Tienes notificaciones sin leer">⚠️</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span className={`bdg ${ec.c}`}>{ec.l}</span>
                      <span style={{ fontSize: 11.5, color: "var(--s400)" }}>{fmtDate(t.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0, marginLeft: 4 }}>
                    {fmt(t.monto)}
                  </div>
                </div>

                {/* Botón de menú ⋮ */}
                <button
                  className="trato-menu-btn"
                  onClick={(e) => { e.stopPropagation(); setOpenMenu(isMenuOpen ? null : t.id); }}
                  aria-label="Más opciones"
                >
                  ⋮
                </button>

                {/* Dropdown */}
                {isMenuOpen && (
                  <div className="trato-dropdown">
                    <div className="trato-dropdown-item" style={{ color: "var(--s600)", cursor: "default", fontSize: 11 }}>
                      <span>🔖</span> {t.codigo}
                    </div>
                    <div className="trato-dropdown-item" style={{ color: "var(--s600)", cursor: "default", fontSize: 11 }}>
                      <span>{rol === "Vendedor" ? "🏷️" : "🛒"}</span> {rol}
                    </div>
                    {t.link_compartir && (
                      <button
                        className="trato-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(publicTratoUrl(t.link_compartir));
                          toast("Link copiado ✓", "success");
                          setOpenMenu(null);
                        }}
                      >
                        <span>🔗</span> Copiar link
                      </button>
                    )}
                    <button
                      className="trato-dropdown-item"
                      onClick={(e) => { e.stopPropagation(); setTratoId(t.id); setPage("detalle"); setOpenMenu(null); }}
                    >
                      <span>👁️</span> Ver detalle
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
