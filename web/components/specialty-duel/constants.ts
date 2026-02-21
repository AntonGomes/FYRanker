export const CONFETTI_COLORS = [
  "#a855f7", "#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#ef4444",
  "#facc15", "#f472b6", "#818cf8",
];

export const CONFETTI_ANGLE_MIN = -140;
export const CONFETTI_ANGLE_RANGE = 140;
export const CONFETTI_DIST_BASE = 50;
export const CONFETTI_DIST_RANGE = 70;
export const CONFETTI_SIZE_BASE = 4;
export const CONFETTI_SIZE_RANGE = 5;
export const CONFETTI_DELAY_SCALE = 0.12;
export const CONFETTI_ROTATE_RANGE = 540;
export const CONFETTI_ROTATE_OFFSET = 270;
export const CONFETTI_RECT_THRESHOLD = 0.4;
export const CONFETTI_SCALE_END = 0.2;
export const HALF = 0.5;
export const DEG_HALF_CIRCLE = 180;

export const GLOW_SCALE_FACTOR = 0.06;
export const GLOW_RADIUS_BASE = 15;
export const GLOW_RADIUS_SCALE = 50;
export const GLOW_SPREAD_SCALE = 20;
export const PRIMARY_L_DARK = 0.72;
export const PRIMARY_L_LIGHT = 0.52;
export const PRIMARY_CHROMA = 0.26;
export const HUE = 300;
export const L_DARK_BASE = 0.3;
export const L_LIGHT_BASE = 0.92;
export const BORDER_L_DARK_BASE = 0.5;
export const BORDER_L_DARK_RANGE = 0.3;
export const BORDER_L_LIGHT_BASE = 0.55;
export const BORDER_CHROMA_BOOST = 0.05;
export const GLOW_L_DARK_BASE = 0.6;
export const GLOW_L_DARK_RANGE = 0.2;
export const GLOW_L_LIGHT_BASE = 0.6;
export const GLOW_L_LIGHT_RANGE = 0.1;
export const TEXT_L_THRESHOLD = 0.6;
export const TEXT_L_DARK = 0.12;
export const TEXT_L_LIGHT = 0.95;
export const TEXT_C_DARK = 0.02;
export const TEXT_C_LIGHT = 0.01;
export const PULSE_DURATION_BASE = 2;
export const PULSE_DURATION_SCALE = 1.6;
export const CARD_SHADOW_OPACITY_BASE = 0.2;
export const CARD_SHADOW_OPACITY_SCALE = 0.5;
export const INSET_SHADOW_SCALE = 35;
export const CARD_SHADOW_INNER_SCALE = 0.6;
export const CARD_SHADOW_OUTER_SCALE = 0.8;
export const CARD_INNER_SHADOW_OPACITY_SCALE = 0.2;
export const GRADIENT_L_OFFSET = 0.03;
export const GRADIENT_C_OFFSET = 0.02;
export const GRADIENT_H_OFFSET = 10;

export const FLY_DIR_LEFT = -180;
export const FLY_DIR_RIGHT = 180;
export const ENTER_DIR_LEFT = -30;
export const ENTER_DIR_RIGHT = 30;
export const FLY_ROTATE_LEFT = -15;
export const FLY_ROTATE_RIGHT = 15;

export const NEIGHBOURHOOD_SIZE = 7;
export const LOSER_FLY_DELAY_MS = 600;
export const NEXT_MATCHUP_DELAY_MS = 1400;
export const SLIDER_RANGE = 4;
export const SLIDER_HALF = 2;
export const PERCENTAGE = 100;

export const LOSER_EMOJIS = ["😢", "😤", "💀", "😵", "🫠", "😭"];

export const TICK_LABELS = [
  { label: "Strong", sublabel: "left" },
  { label: "Slight", sublabel: "left" },
  { label: "Equal", sublabel: "" },
  { label: "Slight", sublabel: "right" },
  { label: "Strong", sublabel: "right" },
] as const;
