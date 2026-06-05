/**
 * TratoYA — Motion Design System
 * Variantes reutilizables para Framer Motion v12.
 * Todas las animaciones respetan prefers-reduced-motion via
 * el wrapper <MotionConfig reducedMotion="user"> en main.
 */

/* ── Viewport trigger (una sola vez, con margen) ─────────── */
export const vp = { once: true, margin: "-72px 0px" };
export const vpEarly = { once: true, margin: "-40px 0px" };

/* ── Durations / easings ─────────────────────────────────── */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1];
export const EASE_SPRING = [0.34, 1.56, 0.64, 1];

/* ── fadeInUp — entrada estándar desde abajo ─────────────── */
export const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: EASE_OUT_EXPO },
  },
};

/* ── fadeInLeft / fadeInRight — role cards ───────────────── */
export const fadeInLeft = {
  hidden: { opacity: 0, x: -48 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

export const fadeInRight = {
  hidden: { opacity: 0, x: 48 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

/* ── scaleIn — íconos, badges ────────────────────────────── */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.78 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_SPRING },
  },
};

/* ── staggerContainer — padre de elementos escalonados ───── */
export const staggerContainer = (stagger = 0.1, delay = 0) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

/* ── staggerItem — hijo de staggerContainer ──────────────── */
export const staggerItem = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

/* ── floatingMotion — imagen hero, app mockup ────────────── */
export const floatingMotion = {
  animate: {
    y: [0, -12, 0],
    transition: { duration: 5.5, ease: "easeInOut", repeat: Infinity },
  },
};

/* ── cardHover — hover premium de cards ─────────────────── */
export const cardHoverVariant = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.018,
    y: -5,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

/* ── buttonHover — botón con glow y scale ───────────────── */
export const buttonHover = {
  rest: {},
  hover: {
    scale: 1.035,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  tap: { scale: 0.96 },
};

/* ── viewportOnce (alias limpio) ─────────────────────────── */
export const viewportOnce = vp;
