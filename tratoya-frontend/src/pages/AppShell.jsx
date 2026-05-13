import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { api, clearSession } from "../lib/api";
import { ESTADO, isSupportNotification } from "../lib/utils";
import { API_URL } from "../lib/api";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const Dashboard   = lazy(() => import("./Dashboard"));
const MisTratos   = lazy(() => import("./MisTratos"));
const CrearTrato  = lazy(() => import("./CrearTrato"));
const TratoDetalle = lazy(() => import("./TratoDetalle"));
const Pagos       = lazy(() => import("./Pagos"));
const Disputas    = lazy(() => import("./Disputas"));
const Reputacion  = lazy(() => import("./Reputacion"));
const Perfil      = lazy(() => import("./Perfil"));

// ── Audio helpers ─────────────────────────────────────
let notificationAudioCtx = null;
const getAudioCtx = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!notificationAudioCtx || notificationAudioCtx.state === "closed") notificationAudioCtx = new Ctx();
  return notificationAudioCtx;
};
function unlockSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.00001, ctx.currentTime); g.connect(ctx.destination);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(1, ctx.currentTime); o.connect(g); o.start(); o.stop(ctx.currentTime + 0.02);
    }).catch(() => {});
  } catch { /* silencioso */ }
}
function playBubble() {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.02;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.09, now + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); g.connect(ctx.destination);
      [660, 880, 1180].forEach((freq, i) => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(freq, now + i * 0.075); o.connect(g); o.start(now + i * 0.075); o.stop(now + i * 0.075 + 0.16); });
    }).catch(() => {});
  } catch { /* silencioso */ }
}
function playCelebration() {
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    ready.then(() => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime + 0.02;
      const m = ctx.createGain(); m.gain.setValueAtTime(0.0001, now); m.gain.exponentialRampToValueAtTime(0.12, now + 0.018); m.gain.exponentialRampToValueAtTime(0.0001, now + 0.72); m.connect(ctx.destination);
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => { const o = ctx.createOscillator(); o.type = i === 3 ? "sine" : "triangle"; o.frequency.setValueAtTime(freq, now + i * 0.095); o.connect(m); o.start(now + i * 0.095); o.stop(now + i * 0.095 + 0.22); });
    }).catch(() => {});
  } catch { /* silencioso */ }
}

function FloatingNotification({ note, onOpen, onClose }) {
  if (!note) return null;
  return (
    <div className="float-note" onClick={onOpen}>
      <div className="float-note-ico">{note.icon || "💬"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="float-note-title">{note.titulo || "Nueva actividad"}</div>
        <div className="float-note-body">{note.cuerpo || "Toca para abrir el trato relacionado."}</div>
      </div>
      <button className="btn bg_ bsm" onClick={(e) => { e.stopPropagation(); onClose?.(); }}>×</button>
    </div>
  );
}

function CelebrationOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="celebrate-overlay">
      <div className="celebrate-card">Trato <span>completado</span><div className="celebrate-sub">Pago liberado con éxito</div></div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="page" style={{ textAlign: "center", padding: 60 }}>
      <div className="spin" style={{ margin: "0 auto", color: "var(--s400)" }} />
    </div>
  );
}

const PAGE_TITLES = {
  dashboard:  "Dashboard",
  tratos:     "Mis Tratos",
  crear:      "Crear trato",
  detalle:    "Detalle",
  pagos:      "Pagos",
  disputas:   "Disputas",
  reputacion: "Reputación",
  perfil:     "Perfil",
};

export default function AppShell({ session, setSession, toast }) {
  const [page, setPage] = useState("dashboard");
  const [tratoId, setTratoId] = useState(null);
  const [disputeTratoId, setDisputeTratoId] = useState(null);
  const [floatingNote, setFloatingNote] = useState(null);
  const [celebration, setCelebration] = useState(false);
  const shownNotifIds = useRef(new Set());

  const showFloatingNote = useCallback((note) => {
    setFloatingNote(note);
    if (navigator.vibrate) try { navigator.vibrate(note?.tipo === "trato_completado" ? [45, 28, 45] : [35]); } catch {}
    playBubble();
    setTimeout(() => setFloatingNote((n) => (n === note ? null : n)), 9000);
  }, []);

  const estadoLabel = useCallback(
    (estado) => (ESTADO[estado]?.l || estado || "Actualizado").replace(/[^\p{L}\p{N}\s]/gu, "").trim(),
    []
  );

  const showCompletionCelebration = useCallback(() => {
    setCelebration(true);
    if (navigator.vibrate) try { navigator.vibrate([45, 28, 45]); } catch {}
    playCelebration();
    setTimeout(() => setCelebration(false), 2600);
  }, []);

  const notifyStatusUpdate = useCallback((trato, _prev, nextEstado) => {
    if (nextEstado === "completado") showCompletionCelebration();
    showFloatingNote({
      tipo: "estado_trato",
      icon: nextEstado === "completado" ? "🔔" : "💬",
      titulo: nextEstado === "completado" ? "Trato completado" : "Estado del trato actualizado",
      cuerpo: `${trato.codigo || "Tu trato"} ahora está en ${estadoLabel(nextEstado)}.`,
      trato_id: trato.id,
    });
  }, [showFloatingNote, estadoLabel, showCompletionCelebration]);

  const logout = useCallback((message = "Sesión cerrada") => {
    api.post("/auth/logout").catch(() => {});
    clearSession();
    setSession(null);
    toast(typeof message === "string" ? message : "Sesión cerrada", "info");
  }, [setSession, toast]);

  const updateUser = (u) => setSession((s) => ({ ...s, user: u }));

  // Desbloquear audio en primera interacción
  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "click"];
    const unlock = () => unlockSound();
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  // Cierre por inactividad (30 min)
  useEffect(() => {
    const INACTIVITY_MS = 30 * 60 * 1000;
    let timerId;
    const reset = () => {
      clearTimeout(timerId);
      timerId = setTimeout(() => logout("Sesión cerrada por 30 minutos de inactividad"), INACTIVITY_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timerId); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [logout]);

  // SSE notificaciones en tiempo real
  useEffect(() => {
    if (!session?.token) return;
    const ctrl = new AbortController();
    const connect = async () => {
      try {
        const resp = await fetch(`${API_URL}/users/stream`, {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: ctrl.signal,
        });
        if (!resp.ok) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop();
          for (const chunk of lines) {
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine.slice(5).trim());
              if (evt.tipo !== "conectado") {
                const evtId = evt.id || evt.datos?.id;
                if (evtId) shownNotifIds.current.add(String(evtId));
                const supportNote = isSupportNotification(evt);
                showFloatingNote({
                  tipo: evt.tipo,
                  icon: supportNote || ["pago_liberado", "trato_completado"].includes(evt.tipo) ? "🔔" : "💬",
                  titulo: supportNote ? 'Mensaje de "Soporte - TratoYA"' : (evt.datos?.titulo || evt.tipo),
                  cuerpo: evt.datos?.cuerpo || evt.datos?.mensaje || "Nueva actividad en tu cuenta",
                  trato_id: evt.datos?.metadata?.trato_id || evt.datos?.trato_id,
                });
                if (["pago_liberado", "trato_completado"].includes(evt.tipo)) showCompletionCelebration();
              }
            } catch { /* ignorar */ }
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") setTimeout(connect, 5000);
      }
    };
    connect();
    return () => ctrl.abort();
  }, [session?.token, showFloatingNote, showCompletionCelebration]);

  // Polling fallback: captura notificaciones perdidas cuando SSE se corta (Vercel timeout ~30s)
  useEffect(() => {
    if (!session?.token) return;
    const INTERVAL = 25000; // 25 segundos
    const poll = async () => {
      try {
        const r = await api.get("/users/notifications");
        const notifs = r.data || [];
        const unread = notifs.filter((n) => !n.leida && !shownNotifIds.current.has(String(n.id)));
        // Mostrar solo la más reciente no vista para no saturar
        if (unread.length > 0) {
          const latest = unread[0];
          shownNotifIds.current.add(String(latest.id));
          const supportNote = isSupportNotification(latest);
          const tipo = latest.tipo || "notificacion";
          showFloatingNote({
            tipo,
            icon: supportNote || ["pago_liberado", "trato_completado"].includes(tipo) ? "🔔" : "💬",
            titulo: supportNote ? 'Mensaje de "Soporte - TratoYA"' : (latest.titulo || "Nueva actividad"),
            cuerpo: latest.cuerpo || "Toca para ver el detalle.",
            trato_id: latest.datos?.trato_id || latest.datos?.metadata?.trato_id,
          });
          if (["pago_liberado", "trato_completado"].includes(tipo)) showCompletionCelebration();
          // Marcar como leída para no repetirla
          api.put(`/users/notifications/${latest.id}/read`).catch(() => {});
        }
      } catch { /* silencioso */ }
    };
    const id = setInterval(poll, INTERVAL);
    return () => clearInterval(id);
  }, [session?.token, showFloatingNote, showCompletionCelebration]);

  const openFloatingNote = () => {
    if (floatingNote?.trato_id) { setTratoId(floatingNote.trato_id); setPage("detalle"); }
    else setPage("dashboard");
    setFloatingNote(null);
  };

  const sharedProps = { toast, user: session.user };

  return (
    <div>
      <Sidebar page={page} setPage={setPage} user={session.user} onLogout={logout} />
      <div className="main">
        <Topbar title={PAGE_TITLES[page] || "TratoYa"} user={session.user} page={page} setPage={setPage} />
        <Suspense fallback={<PageLoader />}>
          <div key={page}>
            {page === "dashboard"  && <Dashboard   {...sharedProps} setPage={setPage} setTratoId={setTratoId} setUser={updateUser} />}
            {page === "tratos"     && <MisTratos    {...sharedProps} setPage={setPage} setTratoId={setTratoId} />}
            {page === "crear"      && <CrearTrato   {...sharedProps} setPage={setPage} />}
            {page === "detalle"    && <TratoDetalle {...sharedProps} tratoId={tratoId} setPage={setPage} setDisputeTratoId={setDisputeTratoId} onStatusUpdate={notifyStatusUpdate} />}
            {page === "pagos"      && <Pagos        {...sharedProps} />}
            {page === "disputas"   && <Disputas     {...sharedProps} setPage={setPage} setTratoId={setTratoId} initialTratoId={disputeTratoId} clearInitialTratoId={() => setDisputeTratoId(null)} />}
            {page === "reputacion" && <Reputacion   {...sharedProps} setUser={updateUser} />}
            {page === "perfil"     && <Perfil       {...sharedProps} setUser={updateUser} />}
          </div>
        </Suspense>
      </div>
      <FloatingNotification note={floatingNote} onOpen={openFloatingNote} onClose={() => setFloatingNote(null)} />
      <CelebrationOverlay show={celebration} />
    </div>
  );
}
