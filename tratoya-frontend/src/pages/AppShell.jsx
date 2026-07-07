import { useState, useCallback, useEffect, useRef, useTransition, Suspense, lazy } from "react";
import { api, clearSession } from "../lib/api";
import { ESTADO, isSupportNotification } from "../lib/utils";
import { API_URL } from "../lib/api";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Av from "../components/Avatar";

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

function MobileDrawer({ open, onClose, user, onProfile, onLogout, onDisputas }) {
  const nom = `${user?.nombre || ""} ${user?.apellido || ""}`.trim();
  const kycLabel =
    user?.kyc_nivel === "premium" ? "✓ Premium"
    : user?.kyc_nivel === "verificado" ? "✓ Verificado"
    : user?.kyc_nivel === "basico" ? "Básico"
    : "Sin verificar";

  return (
    <>
      <div
        className={`mob-drawer-overlay${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`mob-drawer${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
      >
        <div className="mob-drawer-handle" />
        <div className="mob-drawer-profile">
          <Av name={nom} size={54} />
          <div className="mob-drawer-profile-info">
            <div className="mob-drawer-name">{nom || "Usuario"}</div>
            <div className="mob-drawer-kyc">{kycLabel}</div>
          </div>
        </div>
        <div className="mob-drawer-actions">
          <button
            className="mob-drawer-item"
            onClick={() => { onDisputas?.(); onClose(); }}
          >
            <span aria-hidden="true">⚖️</span>
            Disputas
          </button>
          <button
            className="mob-drawer-item"
            onClick={() => { onProfile(); onClose(); }}
          >
            <span aria-hidden="true">👤</span>
            Mi perfil
          </button>
          <button
            className="mob-drawer-item danger"
            onClick={() => { onLogout(); onClose(); }}
          >
            <span aria-hidden="true">🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}

// FAB "Crear trato": estilizado, con brillo animado y arrastrable — la posición
// elegida se recuerda entre sesiones.
function CreateFab({ onCreate }) {
  const btnRef = useRef(null);
  const dragRef = useRef(null);
  const posRef = useRef(null);
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("ty_fab_pos"));
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    } catch { /* noop */ }
    return null;
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => { posRef.current = pos; }, [pos]);

  const clampPos = (x, y, w, h) => ({
    x: Math.min(Math.max(6, x), window.innerWidth - w - 6),
    y: Math.min(Math.max(6, y), window.innerHeight - h - 6),
  });

  const onPointerDown = (e) => {
    const rect = btnRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, w: rect.width, h: rect.height, moved: false };
    try { btnRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 8) { d.moved = true; setDragging(true); }
    if (d.moved) {
      d.lastPos = clampPos(d.origX + dx, d.origY + dy, d.w, d.h);
      setPos(d.lastPos);
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d?.moved) {
      const final = d.lastPos || posRef.current;
      if (final) try { window.localStorage.setItem("ty_fab_pos", JSON.stringify(final)); } catch { /* noop */ }
    } else {
      onCreate();
    }
  };

  return (
    <button
      ref={btnRef}
      className={`mobile-create-fab${dragging ? " dragging" : ""}`}
      type="button"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
      aria-label="Crear trato"
    >
      <span className="fab-plus" aria-hidden="true">+</span>
      <span className="fab-label">Crear trato</span>
    </button>
  );
}

const PAGE_TITLES = {
  dashboard:  "Inicio",
  tratos:     "Mis Tratos",
  crear:      "Crear trato",
  detalle:    "Detalle",
  pagos:      "Pagos",
  disputas:   "Disputas",
  reputacion: "Reputación",
  perfil:     "Perfil",
};

export default function AppShell({ session, setSession, toast }) {
  const [page, setPage] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("page");
    return PAGE_TITLES[requested] ? requested : "dashboard";
  });
  const [, startTransition] = useTransition();
  const [tratoId, setTratoId] = useState(() => new URLSearchParams(window.location.search).get("trato") || null);
  const [disputeTratoId, setDisputeTratoId] = useState(null);
  const [floatingNote, setFloatingNote] = useState(null);
  const [celebration, setCelebration] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const shownNotifIds = useRef(new Set());
  const sessionLoadTimeRef = useRef(Date.now());
  const [unreadTratoIds, setUnreadTratoIds] = useState(new Set());
  const [pendingTratosAlert, setPendingTratosAlert] = useState(false);
  const [pendingBubble, setPendingBubble] = useState(null);
  const [showSsoRequirements, setShowSsoRequirements] = useState(false);

  // Historial interno: la flecha del navegador y la de la app comparten la misma
  // pila, así "atrás" siempre lleva a la página inmediatamente anterior.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);
  const pageStackRef = useRef([]);

  const navigateTo = useCallback((next) => {
    if (next === pageRef.current) return;
    startTransition(() => {
      pageStackRef.current.push(pageRef.current);
      setPage(next);
      window.history.pushState({ tratoyaPage: next }, "");
    });
  }, []);

  // La flecha de la app usa el historial nativo: mismo comportamiento que el navegador.
  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  // Captura el botón "atrás" nativo del navegador
  useEffect(() => {
    // Sentinela: evita que la primera pulsación de "atrás" saque de la app
    window.history.pushState({ tratoyaPage: pageRef.current }, "");
    const handlePop = () => {
      startTransition(() => {
        const prev = pageStackRef.current.pop();
        if (prev) {
          setPage(prev);
        } else {
          // Pila vacía: quedarse en el dashboard y re-armar la sentinela
          setPage("dashboard");
          window.history.pushState({ tratoyaPage: "dashboard" }, "");
        }
      });
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const showFloatingNote = useCallback((note) => {
    const noteKey = note?.id || note?.notificacion_id || [note?.tipo, note?.trato_id, note?.titulo, note?.cuerpo].filter(Boolean).join("|");
    if (noteKey) {
      const key = String(noteKey);
      if (shownNotifIds.current.has(key)) return;
      shownNotifIds.current.add(key);
    }
    setFloatingNote(note);
    if (navigator.vibrate) try { navigator.vibrate(note?.tipo === "trato_completado" ? [45, 28, 45] : [35]); } catch {}
    playBubble();
    setTimeout(() => setFloatingNote((n) => (n === note ? null : n)), 4000);
  }, []);

  useEffect(() => {
    document.title = `Trato YA / ${PAGE_TITLES[page] || "Inicio"}`;
  }, [page]);

  const estadoLabel = useCallback(
    (estado) => (ESTADO[estado]?.l || estado || "Actualizado").replace(/[^\p{L}\p{N}\s]/gu, "").trim(),
    []
  );

  const showCompletionCelebration = useCallback(() => {
    setCelebration(true);
    if (navigator.vibrate) try { navigator.vibrate([45, 28, 45]); } catch {}
    playCelebration();
    setTimeout(() => {
      setCelebration(false);
      // Después de celebrar, verificar si hay tratos activos pendientes
      import("../lib/api").then(({ api }) => {
        api.get("/tratos?limit=50").then((r) => {
          const active = (r.data || []).filter((t) =>
            !["completado", "cancelado", "expirado"].includes(t.estado)
          );
          if (active.length > 0) {
            setPendingBubble({ count: active.length });
            setTimeout(() => setPendingBubble(null), 12000);
          }
        }).catch(() => {});
      });
    }, 2600);
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
    // Cierre determinista en un solo intento: limpiamos sesión y hacemos una
    // salida dura a la home. Esto evita el "trap" de historial (pushState/popstate)
    // y limpia toda la caché en memoria (dashboard, pagos, intervalos, SSE) que
    // antes obligaba a cerrar sesión dos veces.
    try { api.post("/auth/logout").catch(() => {}); } catch { /* best-effort */ }
    clearSession();
    try {
      const msg = typeof message === "string" ? message : "Sesión cerrada";
      sessionStorage.setItem("ty_logout_msg", msg);
    } catch { /* noop */ }
    setSession(null);
    try { window.history.replaceState(null, "", "/"); } catch { /* noop */ }
    window.location.replace("/");
  }, [setSession]);

  const updateUser = (u) => setSession((s) => ({ ...s, user: u }));

  useEffect(() => {
    if (!session?.token) return;
    (async () => {
      try {
        const r = await api.get("/users/notifications");
        const notifs = r.data || [];
        const tratoIds = [];
        notifs.forEach((n) => {
          if (!n.leida) {
            shownNotifIds.current.add(String(n.id));
            const tid = n.datos?.trato_id || n.datos?.metadata?.trato_id;
            if (tid) tratoIds.push(tid);
          }
        });
        setUnreadTratoIds(new Set(tratoIds));
      } catch { /* silencioso */ }
      try {
        const r2 = await api.get("/tratos?limit=50");
        const tratos = r2.data || [];
        const pendingEstados = ['activo', 'pago_pendiente', 'en_entrega', 'pago_retenido'];
        if (tratos.some((t) => pendingEstados.includes(t.estado))) {
          setPendingTratosAlert(true);
        }
      } catch { /* silencioso */ }
    })();
  }, [session?.token]);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "click"];
    const unlock = () => unlockSound();
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    const INACTIVITY_MS = 15 * 60 * 1000;
    let timerId;
    const reset = () => {
      clearTimeout(timerId);
      timerId = setTimeout(() => logout("Sesión cerrada por 15 minutos de inactividad"), INACTIVITY_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timerId); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [logout]);

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
                const evtId = evt.id || evt.datos?.id || evt.datos?.notificacion_id;
                const supportNote = isSupportNotification(evt);
                showFloatingNote({
                  id: evtId,
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

  useEffect(() => {
    if (!session?.token) return;
    const INTERVAL = 40000;
    const poll = async () => {
      try {
        const r = await api.get("/users/notifications");
        const notifs = r.data || [];
        const unread = notifs.filter((n) => !n.leida && !shownNotifIds.current.has(String(n.id)) && new Date(n.createdAt || n.updatedAt).getTime() > sessionLoadTimeRef.current - 5000);
        if (unread.length > 0) {
          const latest = unread[0];
          shownNotifIds.current.add(String(latest.id));
          const supportNote = isSupportNotification(latest);
          const tipo = latest.tipo || "notificacion";
          showFloatingNote({
            id: latest.id,
            tipo,
            icon: supportNote || ["pago_liberado", "trato_completado"].includes(tipo) ? "🔔" : "💬",
            titulo: supportNote ? 'Mensaje de "Soporte - TratoYA"' : (latest.titulo || "Nueva actividad"),
            cuerpo: latest.cuerpo || "Toca para ver el detalle.",
            trato_id: latest.datos?.trato_id || latest.datos?.metadata?.trato_id,
          });
          if (["pago_liberado", "trato_completado"].includes(tipo)) showCompletionCelebration();
          api.put(`/users/notifications/${latest.id}/read`).catch(() => {});
        }
      } catch { /* silencioso */ }
    };
    const id = setInterval(poll, INTERVAL);
    return () => clearInterval(id);
  }, [session?.token, showFloatingNote, showCompletionCelebration]);

  const openFloatingNote = () => {
    if (floatingNote?.trato_id) { setTratoId(floatingNote.trato_id); navigateTo("detalle"); }
    else navigateTo("dashboard");
    setFloatingNote(null);
  };

  const sharedProps = { toast, user: session.user };

  // Recordatorio para usuarios registrados por SSO: se muestra una vez por sesión
  // mientras falten datos (teléfono, cuenta bancaria o email). Al completar el
  // perfil deja de aparecer de forma definitiva.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const isSso = window.localStorage.getItem("ty_registered_by_sso") === "1";
        if (!isSso) return;
        if (window.sessionStorage.getItem("ty_sso_reminder_shown") === "1") return;
        const [profile, banks] = await Promise.all([
          api.get("/users/profile").catch(() => null),
          api.get("/users/bank-accounts").catch(() => null),
        ]);
        const u = profile?.data || {};
        const hasPhone = u.telefono && String(u.telefono).trim().length >= 7;
        const hasBank = Array.isArray(banks?.data) && banks.data.length > 0;
        if (hasPhone && hasBank && u.email_verificado) {
          // Perfil completo: no volver a recordar
          window.localStorage.removeItem("ty_registered_by_sso");
          window.localStorage.removeItem("ty_sso_modal_shown");
          return;
        }
        if (cancelled) return;
        setShowSsoRequirements(true);
        window.sessionStorage.setItem("ty_sso_reminder_shown", "1");
        playBubble(); // campanita sutil (mejor esfuerzo: el navegador puede requerir interacción previa)
        if (navigator.vibrate) try { navigator.vibrate([25]); } catch { /* noop */ }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <Sidebar
        page={page}
        setPage={(next) => { navigateTo(next); if (next === "tratos") setPendingTratosAlert(false); }}
        user={session.user}
        onLogout={logout}
        onMenuOpen={() => setDrawerOpen(true)}
        hasPendingTratos={pendingTratosAlert}
      />
      <div className="main">
        <Topbar
          title={PAGE_TITLES[page] || "TratoYa"}
          user={session.user}
          page={page}
          setPage={navigateTo}
          onBack={goBack}
          onProfile={() => navigateTo("perfil")}
          onMenuOpen={() => setDrawerOpen(true)}
          setTratoId={setTratoId}
        />
        <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}><div className="spin" /></div>}>
          <div key={page}>
            {page === "dashboard"  && <Dashboard   {...sharedProps} setPage={navigateTo} setTratoId={setTratoId} setUser={updateUser} />}
            {page === "tratos"     && <MisTratos    {...sharedProps} setPage={navigateTo} setTratoId={setTratoId} alertTratoIds={unreadTratoIds} />}
            {page === "crear"      && <CrearTrato   {...sharedProps} setPage={navigateTo} />}
            {page === "detalle"    && <TratoDetalle {...sharedProps} tratoId={tratoId} setPage={navigateTo} setDisputeTratoId={setDisputeTratoId} onStatusUpdate={notifyStatusUpdate} />}
            {page === "pagos"      && <Pagos        {...sharedProps} />}
            {page === "disputas"   && <Disputas     {...sharedProps} setPage={navigateTo} setTratoId={setTratoId} initialTratoId={disputeTratoId} clearInitialTratoId={() => setDisputeTratoId(null)} />}
            {page === "reputacion" && <Reputacion   {...sharedProps} setUser={updateUser} />}
            {page === "perfil"     && <Perfil       {...sharedProps} setUser={updateUser} />}
          </div>
        </Suspense>
      </div>

      {page !== "crear" && <CreateFab onCreate={() => navigateTo("crear")} />}

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={session.user}
        onProfile={() => navigateTo("perfil")}
        onDisputas={() => navigateTo("disputas")}
        onLogout={logout}
      />

      <FloatingNotification note={floatingNote} onOpen={openFloatingNote} onClose={() => setFloatingNote(null)} />
      <CelebrationOverlay show={celebration} />
      {pendingBubble && (
        <button
          className="pending-bubble"
          onClick={() => { navigateTo("tratos"); setPendingBubble(null); }}
          aria-label={`Tienes ${pendingBubble.count} trato${pendingBubble.count > 1 ? "s" : ""} activo${pendingBubble.count > 1 ? "s" : ""}`}
        >
          📋 {pendingBubble.count} trato{pendingBubble.count > 1 ? "s" : ""} activo{pendingBubble.count > 1 ? "s" : ""} →
        </button>
      )}

      {showSsoRequirements && (
        <div style={{ position: "fixed", top: 20, right: 20, maxWidth: 380, zIndex: 999, animation: "slideInRight 0.45s cubic-bezier(.22,1,.36,1)" }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { navigateTo("perfil"); setShowSsoRequirements(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { navigateTo("perfil"); setShowSsoRequirements(false); } }}
            style={{ background: "linear-gradient(135deg, rgba(7,25,25,.96) 0%, rgba(10,35,32,.94) 100%)", border: "1px solid rgba(168,196,0,.3)", borderRadius: 16, padding: "15px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.35), 0 0 0 1px rgba(168,196,0,.06)", backdropFilter: "blur(14px)", display: "flex", gap: 13, alignItems: "flex-start", cursor: "pointer" }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "linear-gradient(140deg,#A8C400,#479818)", boxShadow: "0 4px 12px rgba(168,196,0,.35)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" stroke="#071819" strokeWidth="1.8"/><path d="M12 8v5" stroke="#071819" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16.2" r="1.2" fill="#071819"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#dfff60", marginBottom: 4, letterSpacing: .2 }}>Completa tu perfil</div>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.88)", lineHeight: 1.5, margin: "0 0 8px 0" }}>Recuerda completar tu email, WhatsApp y cuenta bancaria o Llave Bre-B. Es necesario para poder hacer tratos y recibir pagos.</p>
              <span style={{ fontSize: 12, color: "#A8C400", fontWeight: 700 }}>Ir a Mi perfil →</span>
            </div>
            <button
              type="button"
              aria-label="Cerrar recordatorio"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", fontSize: 17, cursor: "pointer", flexShrink: 0, padding: "2px 6px", lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setShowSsoRequirements(false); }}
            >
              ✕
            </button>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(400px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
