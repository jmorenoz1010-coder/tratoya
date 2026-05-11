import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, timeAgo, ESTADO, TIPO_ICO } from "../lib/utils";
import { SkeletonKpiGrid, SkeletonList } from "../components/SkeletonCard";

export default function Dashboard({ setPage, setTratoId, user, toast, setUser }) {
  const [tratos, setTratos] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(user);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, n, me] = await Promise.all([
        api.get("/tratos?limit=6"),
        api.get("/users/notifications"),
        api.get("/auth/me"),
      ]);
      setTratos(t.data || []);
      setNotifs((n.data || []).slice(0, 5));
      if (me.data) { setUserStats(me.data); setUser?.(me.data); }
    } catch (e) {
      if (!silent) toast(e?.message || "Error cargando dashboard", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => loadDashboard(true), 30000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  const activos = tratos.filter((t) => !["completado", "cancelado", "expirado"].includes(t.estado));
  const protegido = activos
    .filter((t) => t.estado === "pago_retenido")
    .reduce((s, t) => s + parseFloat(t.monto || 0), 0);
  const completados = tratos.filter((t) => t.estado === "completado").length || userStats?.tratos_exitosos || 0;

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 2 }}>
            Hola, {userStats?.nombre || user?.nombre} 👋
          </h1>
          <p className="page-sub" style={{ fontSize: 13 }}>Resumen de tu cuenta</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn bo bsm" onClick={() => loadDashboard()} title="Actualizar">↻</button>
          <button className="btn bp blg" onClick={() => setPage("crear")}>➕ Nuevo trato</button>
        </div>
      </div>

      {loading ? (
        <SkeletonKpiGrid />
      ) : (
        <div className="kpi-grid fi">
          {[
            { ico: "📋", bg: "#E6EBF2", l: "Tratos activos",   v: activos.length },
            { ico: "🔒", bg: "var(--cr)", l: "Dinero protegido", v: fmt(protegido) },
            { ico: "✅", bg: "var(--cr)", l: "Completados",      v: completados },
            { ico: "⭐", bg: "var(--cr)", l: "Reputación",       v: parseFloat(userStats?.reputacion || 0).toFixed(1) || "—" },
          ].map((k, i) => (
            <div key={i} className="kpi">
              <div style={{ width: 32, height: 32, borderRadius: 9, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 8 }}>
                {k.ico}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>
                {k.l}
              </div>
              <div className="kpi-val">{k.v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 290px", gap: 14 }}>
        <div className="fi2">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
            <h2 style={{ fontSize: 15 }}>Tratos activos</h2>
            <button className="btn bg_ bsm" onClick={() => setPage("tratos")}>Ver todos →</button>
          </div>
          {loading ? (
            <SkeletonList count={3} />
          ) : activos.length === 0 ? (
            <div className="card" style={{ padding: 32 }}>
              <div className="empty">
                <div className="empty-ico">🤝</div>
                <div className="empty-t">Sin tratos activos</div>
                <div className="empty-d">Crea tu primer trato seguro</div>
                <button className="btn bp" style={{ marginTop: 14 }} onClick={() => setPage("crear")}>
                  Crear trato
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {activos.map((t) => {
                const ec = ESTADO[t.estado] || ESTADO.borrador;
                const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
                return (
                  <div
                    key={t.id}
                    className="tc"
                    onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {TIPO_ICO[t.tipo] || "📋"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                        {t.titulo}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--s600)" }}>
                        {cp ? `${cp.nombre} ${cp.apellido}` : "Esperando contraparte"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, marginBottom: 3 }}>
                        {fmt(t.monto)}
                      </div>
                      <span className={`bdg ${ec.c}`}>{ec.l}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="fi3">
          <h2 style={{ fontSize: 15, marginBottom: 11 }}>Actividad reciente</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifs.length === 0 && !loading && (
              <div className="card" style={{ padding: 18, textAlign: "center", color: "var(--s400)", fontSize: 13 }}>
                Sin movimientos recientes
              </div>
            )}
            {notifs.map((n, i) => (
              <div
                key={i}
                style={{ background: n.leida ? "#fff" : "var(--cr2)", border: "1px solid var(--s100)", borderRadius: 11, padding: "10px 13px" }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 1 }}>{n.titulo}</div>
                <div style={{ fontSize: 12, color: "var(--s600)", marginBottom: 2 }}>{n.cuerpo}</div>
                <div style={{ fontSize: 10.5, color: "var(--s400)" }}>{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>

          <div
            style={{ marginTop: 12, background: "var(--n)", borderRadius: 12, padding: 14, cursor: "pointer", transition: "transform .2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onClick={() => setPage("crear")}
          >
            <div style={{ fontSize: 18, marginBottom: 5 }}>⚡</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, color: "#fff", marginBottom: 3 }}>
              Trato rápido
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.4)", marginBottom: 10 }}>
              Comparte el link con tu contraparte
            </div>
            <div style={{ background: "var(--g)", color: "var(--n)", borderRadius: 7, padding: "6px 13px", fontSize: 12, fontWeight: 700, display: "inline-flex", gap: 5 }}>
              ➕ Crear
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
