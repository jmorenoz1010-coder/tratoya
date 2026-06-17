import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "ty_create_fab_pos";
const FAB = 70;
const NAV_H = 72;
const TOPBAR_H = 56;
const MARGIN = 12;
const DRAG_THRESHOLD = 8;

function readSavedPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
  } catch { /* noop */ }
  return null;
}

function defaultPos() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: w - FAB - MARGIN,
    y: h - FAB - NAV_H - MARGIN,
  };
}

function clampPos(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minY = TOPBAR_H + MARGIN;
  const maxY = h - FAB - NAV_H - MARGIN;
  return {
    x: Math.min(Math.max(MARGIN, x), w - FAB - MARGIN),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

export default function MobileCreateFab({ onClick }) {
  const [pos, setPos] = useState(() => {
    const base = readSavedPos() || defaultPos();
    return clampPos(base.x, base.y);
  });
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, px: 0, py: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const persist = useCallback((next) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      px: posRef.current.x,
      py: posRef.current.y,
    };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (!drag.current.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      drag.current.moved = true;
    }
    setPos(clampPos(drag.current.px + dx, drag.current.py + dy));
  };

  const onPointerUp = (e) => {
    if (!drag.current.active) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasMoved = drag.current.moved;
    if (wasMoved) {
      const dx = e.clientX - drag.current.sx;
      const dy = e.clientY - drag.current.sy;
      const finalPos = clampPos(drag.current.px + dx, drag.current.py + dy);
      setPos(finalPos);
      persist(finalPos);
    }
    drag.current.active = false;
    setDragging(false);
    if (!wasMoved) onClick?.();
  };

  const onPointerCancel = () => {
    if (!drag.current.active) return;
    if (drag.current.moved) persist(posRef.current);
    drag.current.active = false;
    setDragging(false);
  };

  return (
    <button
      className={`mobile-create-fab${dragging ? " is-dragging" : ""}`}
      type="button"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label="Crear trato. Arrastra para mover."
    >
      <span className="fab-plus" aria-hidden="true">+</span>
      <span className="fab-label">Crear trato</span>
    </button>
  );
}
