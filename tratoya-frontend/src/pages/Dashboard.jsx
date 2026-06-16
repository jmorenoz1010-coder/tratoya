import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { fmt, fmtDate, timeAgo, ESTADO, TIPO_ICO } from "../lib/utils";
import { SkeletonKpiGrid, SkeletonList } from "../components/SkeletonCard";

let dashboardCache = null; // { tratos, notifs, userStats }

export default function Dashboard({ setPage, setTratoId, user, toast, setUser }) {
  const cached = dashboardCache;
  const [tratos, setTratos] = useState(cached?.tratos || []);
  const [notifs, setNotifs] = useState(cached?.notifs || []);
  const [loading, setLoading] = useState(!cached);
  const [userStats, setUserStats] = useState(cached?.userStats || user);
  const [dismissedKey, setDismissedKey] = useState(() => {
    try { return sessionStorage.getItem("ty_next_dismissed") || ""; } catch { return ""; }
  });

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      const [t, n, me] = await Promise.all([
        api.get("/tratos?limit=6"),
        api.get("/users/notifications"),
        api.get("/auth/me"),
      ]);
      const newTratos = t.data || [];
      const newNotifs = (n.data || []).slice(0, 5);
      const newUserStats = me.data || userStats;
      dashboardCache = { tratos: newTratos, notifs: newNotifs, userStats: newUserStats };
      setTratos(newTratos);
      setNotifs(newNotifs);
      if (me.data) { setUserStats(me.data); setUser?.(me.data); }
    } catch (e) {
      if (!silent) toast(e?.message || "Error cargando inicio", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => loadDashboard(true), 45000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  const activos = tratos.filter((t) => !["completado", "cancelado", "expirado"].includes(t.estado));
  const protegido = activos
    .filter((t) => ["pago_retenido", "en_entrega", "confirmado"].includes(t.estado))
    .reduce((s, t) => s + parseFloat(t.monto || 0), 0);
  const completados = tratos.filter((t) => t.estado === "completado").length || userStats?.tratos_exitosos || 0;

  // Primer trato que requiere una acción del usuario → "Tu próximo paso"
  const nextAction = (() => {
    for (const t of activos) {
      const soyVendedor = t.vendedor?.id === user?.id;
      const soyComprador = t.comprador?.id === user?.id;
      if (t.estado === "borrador" && soyComprador) return { t, ico: "✅", txt: "Acepta el trato para poder pagar", cta: "Aceptar trato" };
      if (t.estado === "borrador" && soyVendedor) return { t, ico: "🔗", txt: "Comparte el link para que acepten tu trato", cta: "Ver trato" };
      if (t.estado === "activo" && soyComprador) return { t, ico: "💰", txt: "Realiza el pago para proteger tu trato", cta: "Ir a pagar" };
      if (t.estado === "pago_pendiente" && soyComprador) return { t, ico: "🔍", txt: "Tu pago está siendo verificado (menos de 1 h)", cta: "Ver estado" };
      if (t.estado === "pago_pendiente" && soyVendedor) return { t, ico: "🔍", txt: "Estamos verificando el pago del comprador", cta: "Ver trato" };
      if (t.estado === "pago_retenido" && soyVendedor) return { t, ico: "📦", txt: "El dinero está protegido: registra el envío", cta: "Registrar envío" };
      if (["en_entrega", "pendiente_confirmacion"].includes(t.estado) && soyComprador) return { t, ico: "✅", txt: "¿Ya recibiste? Confirma para liberar el pago", cta: "Confirmar entrega" };
    }
    return null;
  })();

  const kpis = [
    { ico: "📋", bg: "var(--cr)", l: "Tratos activos",   v: activos.length,   action: () => setPage("tratos") },
    { ico: "🔒", bg: "var(--cr)", l: "Dinero protegido", v: fmt(protegido),   action: () => setPage("tratos") },
    { ico: "✅", bg: "var(--cr)", l: "Completados",      v: completados,       action: () => setPage("tratos") },
    { ico: "⭐", bg: "var(--cr)", l: "Reputación",       v: parseFloat(userStats?.reputacion || 0).toFixed(1) || "—", action: null },
  ];

  return (
    <div className="page dashboard-page">
      <div className="dashboard-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 className="page-hd" style={{ fontSize: 21, marginBottom: 2 }}>
            Hola, {userStats?.nombre || user?.nombre} 👋
          </h1>
          <p className="page-sub" style={{ fontSize: 13 }}>Resumen de tu cuenta</p>
        </div>
        <div className="dashboard-actions" style={{ display: "flex", gap: 8 }}>
          <button className="btn bp blg dashboard-create-btn create-glow-btn" onClick={() => setPage("crear")}>
            <span className="soft-plus" aria-hidden="true" /> Crear trato
          </button>
        </div>
      </div>

      {!loading && (() => {
        // Usuarios que entraron por Google/Apple llegan sin cédula/WhatsApp.
        // Aviso no bloqueante para que completen su perfil y puedan operar bien.
        const u = userStats || user || {};
        const faltaCedula = !u.cedula;
        const faltaTel = !u.telefono;
        if (!faltaCedula && !faltaTel) return null;
        const faltantes = [faltaCedula && "tu número de identificación", faltaTel && "tu WhatsApp"].filter(Boolean).join(" y ");
        return (
          <div className="perfil-incompleto fi" role="button" tabIndex={0}
            onClick={() => setPage("perfil")}
            onKeyDown={(e) => e.key === "Enter" && setPage("perfil")}
          >
            <span className="perfil-incompleto-ico" aria-hidden="true">👤</span>
            <div className="perfil-incompleto-info">
              <strong>Completa tu perfil</strong>
              <span>Agrega {faltantes} para operar con seguridad y recibir tus pagos.</span>
            </div>
            <span className="perfil-incompleto-cta">Completar →</span>
          </div>
        );
      })()}

      {(() => {
        if (loading || !nextAction) return null;
        const key = `${nextAction.t.id}:${nextAction.t.estado}`;
        if (dismissedKey === key) return null;
        const go = () => { setTratoId(nextAction.t.id); setPage("detalle"); };
        const dismiss = (e) => {
          e.stopPropagation();
          setDismissedKey(key);
          try { sessionStorage.setItem("ty_next_dismissed", key); } catch { /* noop */ }
        };
        return (
          <div className="dash-next fi" role="button" tabIndex={0}
            onClick={go}
            onKeyDown={(e) => e.key === "Enter" && go()}
          >
            <span className="dash-next-ico">{nextAction.ico}</span>
            <div className="dash-next-info">
              <span className="dash-next-label">Tu próximo paso</span>
              <strong>{nextAction.txt}</strong>
              <em>{nextAction.t.titulo} · {fmt(nextAction.t.monto)}</em>
            </div>
            <span className="dash-next-cta">{nextAction.cta} →</span>
            <button type="button" className="dash-next-close" onClick={dismiss} aria-label="Ocultar próximo paso">×</button>
          </div>
        );
      })()}

      {loading ? (
        <SkeletonKpiGrid />
      ) : (
        <div className="kpi-grid fi">
          {kpis.map((k, i) => (
            <div
              key={i}
              className={`kpi${k.action ? " kpi-clickable" : ""}`}
              onClick={k.action || undefined}
              role={k.action ? "button" : undefined}
              tabIndex={k.action ? 0 : undefined}
              onKeyDown={k.action ? (e) => e.key === "Enter" && k.action() : undefined}
            >
              <div className="kpi-icon" style={{ width: 32, height: 32, borderRadius: 9, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 8 }}>
                {k.ico}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--s400)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>
                {k.l}
              </div>
              <div className="kpi-val">{k.v}</div>
              {k.action && <div style={{ fontSize: 10, color: "var(--g2)", marginTop: 5, fontWeight: 700 }}>Ver →</div>}
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
            <div className="deal-list" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {activos.map((t) => {
                const ec = ESTADO[t.estado] || ESTADO.borrador;
                const cp = t.vendedor?.id === user?.id ? t.comprador : t.vendedor;
                return (
                  <div
                    key={t.id}
                    className="tc"
                    onClick={() => { setTratoId(t.id); setPage("detalle"); }}
                  >
                    <div className="deal-icon" style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
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
                      <span className={`bdg ${ec.c}`} style={{ fontSize: 10 }}>{ec.l}</span>
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
        </div>
      </div>
    </div>
  );
}
