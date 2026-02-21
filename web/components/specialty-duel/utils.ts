import {
  CONFETTI_ANGLE_MIN, CONFETTI_ANGLE_RANGE, CONFETTI_DIST_BASE,
  CONFETTI_DIST_RANGE, CONFETTI_SIZE_BASE, CONFETTI_SIZE_RANGE,
  CONFETTI_DELAY_SCALE, CONFETTI_ROTATE_RANGE, CONFETTI_ROTATE_OFFSET,
  CONFETTI_RECT_THRESHOLD, CONFETTI_COLORS,
  GLOW_SCALE_FACTOR, GLOW_RADIUS_BASE, GLOW_RADIUS_SCALE, GLOW_SPREAD_SCALE,
  PRIMARY_L_DARK, PRIMARY_L_LIGHT, PRIMARY_CHROMA, HUE,
  L_DARK_BASE, L_LIGHT_BASE,
  BORDER_L_DARK_BASE, BORDER_L_DARK_RANGE, BORDER_L_LIGHT_BASE,
  BORDER_CHROMA_BOOST,
  GLOW_L_DARK_BASE, GLOW_L_DARK_RANGE, GLOW_L_LIGHT_BASE, GLOW_L_LIGHT_RANGE,
  TEXT_L_THRESHOLD, TEXT_L_DARK, TEXT_L_LIGHT, TEXT_C_DARK, TEXT_C_LIGHT,
  PULSE_DURATION_BASE, PULSE_DURATION_SCALE,
  CARD_SHADOW_OPACITY_BASE, CARD_SHADOW_OPACITY_SCALE,
  INSET_SHADOW_SCALE, CARD_SHADOW_INNER_SCALE, CARD_SHADOW_OUTER_SCALE,
  CARD_INNER_SHADOW_OPACITY_SCALE,
  GRADIENT_L_OFFSET, GRADIENT_C_OFFSET, GRADIENT_H_OFFSET,
} from "./constants";

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function computeRanks(ratings: Map<string, number>): Map<string, number> {
  return new Map(
    Array.from(ratings.entries())
      .sort((x, y) => y[1] - x[1])
      .map(([name], i) => [name, i + 1])
  );
}

export interface ConfettiParticle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  rotate: number;
  shape: "rect" | "circle";
}

export function makeConfettiParticles(count: number): ConfettiParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: CONFETTI_ANGLE_MIN + Math.random() * CONFETTI_ANGLE_RANGE,
    distance: CONFETTI_DIST_BASE + Math.random() * CONFETTI_DIST_RANGE,
    size: CONFETTI_SIZE_BASE + Math.random() * CONFETTI_SIZE_RANGE,
    color: randomPick(CONFETTI_COLORS),
    delay: Math.random() * CONFETTI_DELAY_SCALE,
    rotate: Math.random() * CONFETTI_ROTATE_RANGE - CONFETTI_ROTATE_OFFSET,
    shape: Math.random() > CONFETTI_RECT_THRESHOLD ? "rect" : ("circle" as const),
  }));
}

export interface CardStyle {
  card: Record<string, string>;
  text: Record<string, string>;
}

function computeGlowColors(t: number, isDark: boolean) {
  const primaryL = isDark ? PRIMARY_L_DARK : PRIMARY_L_LIGHT;
  const C = t * PRIMARY_CHROMA;
  const L = isDark
    ? L_DARK_BASE + t * (primaryL - L_DARK_BASE)
    : L_LIGHT_BASE + t * (primaryL - L_LIGHT_BASE);
  const borderL = isDark
    ? BORDER_L_DARK_BASE + t * BORDER_L_DARK_RANGE
    : BORDER_L_LIGHT_BASE + t * (primaryL - BORDER_L_LIGHT_BASE);
  const borderC = t * (PRIMARY_CHROMA + BORDER_CHROMA_BOOST);
  const glowL = isDark
    ? GLOW_L_DARK_BASE + t * GLOW_L_DARK_RANGE
    : GLOW_L_LIGHT_BASE + t * GLOW_L_LIGHT_RANGE;
  const textL = L > TEXT_L_THRESHOLD ? TEXT_L_DARK : TEXT_L_LIGHT;
  const textC = L > TEXT_L_THRESHOLD ? TEXT_C_DARK : TEXT_C_LIGHT;

  return { L, C, borderL, borderC, glowL, textL, textC };
}

interface ShadowParams { t: number; glowL: number; C: number }

function buildCardShadow({ t, glowL, C }: ShadowParams): string {
  const glowRadius = GLOW_RADIUS_BASE + t * GLOW_RADIUS_SCALE;
  const glowSpread = t * GLOW_SPREAD_SCALE;
  const outer = `0 0 ${glowRadius}px ${glowSpread}px oklch(${glowL} ${C * CARD_SHADOW_OUTER_SCALE} ${HUE} / ${CARD_SHADOW_OPACITY_BASE + t * CARD_SHADOW_OPACITY_SCALE})`;
  const inner = `inset 0 0 ${t * INSET_SHADOW_SCALE}px oklch(${glowL} ${C * CARD_SHADOW_INNER_SCALE} ${HUE} / ${t * CARD_INNER_SHADOW_OPACITY_SCALE})`;
  return `${outer}, ${inner}`;
}

export function getCardStyle(intensity: number, isDark: boolean): CardStyle | null {
  if (intensity <= 0) return null;

  const t = intensity * intensity;
  const { L, C, borderL, borderC, glowL, textL, textC } = computeGlowColors(t, isDark);
  const scale = 1 + t * GLOW_SCALE_FACTOR;
  const pulseDuration = PULSE_DURATION_BASE - t * PULSE_DURATION_SCALE;

  return {
    card: {
      boxShadow: buildCardShadow({ t, glowL, C }),
      borderColor: `oklch(${borderL} ${borderC} ${HUE})`,
      background: `linear-gradient(135deg, oklch(${L} ${C} ${HUE}) 0%, oklch(${L + GRADIENT_L_OFFSET} ${Math.max(0, C - GRADIENT_C_OFFSET)} ${HUE + GRADIENT_H_OFFSET}) 100%)`,
      transform: `scale(${scale})`,
      animation: `card-pulse ${pulseDuration}s ease-in-out infinite`,
    },
    text: {
      color: `oklch(${textL} ${textC} ${HUE})`,
    },
  };
}
