import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { timeAgo, fmt, nextStepFor, ESTADO } from "../lib/utils";

export default function NotificationBell({ setPage, setTratoId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [tratosById, setTratosById] = useState({});
  const [meId, setMeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const unread = items.filter((n) => !n.leida).length;

  const tratoIdOf = (n) => n.datos?.metadata?.trato_id || n.datos?.trato_id || n.metadata?.trato_id;

  const load = async () => {
    setLoading(true);
    try {
      const [notifsR, tratosR, meR] = await Promise.all([
        api.get("/users/notifications"),
        api.get("/tratos?limit=50").catch(() => ({ data: [] })),
        api.get("/auth/me").catch(() => ({ data: null })),
      ]);
      setItems(notifsR.data || []);
      const map = {};
      (tratosR.data || []).forEach((t) => { map[t.id] = t; });
      setTratosById(map);
      if (meR.data?.id) setMeId(meR.data.id);
    } catch { /* silencioso */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 40000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const openItem = async (n) => {
    if (!n.leida) {
      try { await api.put(`/users/notifications/${n.id}/read`); } catch { /* noop */ }
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    }
    const tratoId = tratoIdOf(n);
    if (tratoId && setTratoId) {
      setTratoId(tratoId);
      setPage?.("detalle");
    } else {
      setPage?.("dashboard");
    }
    setOpen(false);
  };

  const markAll = async () => {
    try {
      await api.put("/users/notifications/read-all");
      setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    } catch { /* noop */ }
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
      >
        🔔
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Bandeja de notificaciones">
          <div className="notif-panel-hd">
            <strong>Notificaciones</strong>
            {unread > 0 && (
              <button type="button" className="notif-mark-all" onClick={markAll}>Marcar todas</button>
            )}
          </div>
          <div className="notif-panel-body">
            {loading && items.length === 0 && <div className="notif-empty">Cargando...</div>}
            {!loading && items.length === 0 && <div className="notif-empty">Sin notificaciones aún</div>}
            {items.slice(0, 20).map((n) => {
              const trato = tratosById[tratoIdOf(n)];
              const step = trato ? nextStepFor(trato, meId) : null;
              const ec = trato ? (ESTADO[trato.estado] || null) : null;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.leida ? "" : " unread"}`}
                  onClick={() => openItem(n)}
                >
                  <strong>{n.titulo || n.tipo}</strong>
                  <span>{n.cuerpo || n.mensaje || ""}</span>
                  {trato && (
                    <span className="notif-trato">
                      {ec ? `${ec.l} · ` : ""}{trato.titulo} · {fmt(trato.monto)}
                    </span>
                  )}
                  {step && (
                    <span className="notif-step">{step.ico} Próximo paso: {step.txt}</span>
                  )}
                  <em>{timeAgo(n.createdAt)}</em>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
