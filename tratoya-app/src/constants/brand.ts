/**
 * Sistema de diseño TratoYa — tokens de marca compartidos con la web.
 * Paleta: verde-oscuro fintech + lima eléctrico (estilo Nu/premium).
 */

export const Brand = {
  // Núcleo de marca
  dark: '#071819',        // fondo oscuro principal (navy-green)
  darkSoft: '#0b2927',    // superficie oscura elevada
  darkDeep: '#061412',    // fondo oscuro profundo
  lime: '#A8C400',        // acento primario
  limeBright: '#dfff60',  // acento brillante (títulos sobre oscuro)
  green: '#479818',       // verde acción
  greenMid: '#5cae1c',

  // Superficies claras
  bg: '#F4F6F8',
  card: '#FFFFFF',
  cream: '#EAF2DC',
  cream2: '#F2F8E6',

  // Texto
  ink: '#07192F',
  inkSoft: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',

  // Estados
  orange: '#E07B00',
  red: '#D9534F',
  redBg: '#FEECEC',
  orangeBg: '#FFF3E0',

  // Sobre oscuro
  onDark: 'rgba(255,255,255,.88)',
  onDarkMuted: 'rgba(255,255,255,.6)',
  limeBorder: 'rgba(168,196,0,.3)',
} as const;

export const Radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#07192F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  glow: {
    shadowColor: '#A8C400',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

/** Gradientes de marca (para expo-linear-gradient) */
export const Gradients = {
  cta: ['#dfff60', '#A8C400'] as const,
  fab: ['#A8C400', '#479818'] as const,
  darkCard: ['#0c2f2a', '#071918'] as const,
} as const;

/** Duraciones de animación consistentes (estilo minimalista fluido) */
export const Motion = {
  fast: 180,
  base: 280,
  slow: 420,
  spring: { damping: 18, stiffness: 220, mass: 0.8 },
  springSoft: { damping: 22, stiffness: 160, mass: 1 },
} as const;
