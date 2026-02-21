export const PLACEMENTS_PER_JOB = 6;
export const EARTH_RADIUS_KM = 6371;
export const PERCENTAGE = 100;
const DEGREES_IN_HALF_CIRCLE = 180;
export const DEG_TO_RAD = Math.PI / DEGREES_IN_HALF_CIRCLE;

export const INITIAL_RATING = 1500;
export const K_FACTOR = 32;
export const ELO_DIVISOR = 400;
export const SPREAD_FACTOR = 10;
export const INITIAL_COMPARISONS_IF_MOVED = 3;
export const ADJACENT_PAIR_INITIAL_COUNT = 2;
export const MATCHUP_RANDOM_CANDIDATES = 30;
export const MATCHUP_CLOSENESS_DIVISOR = 100;
export const MATCHUP_FLIP_THRESHOLD = 0.5;
export const HALF_SCORE = 0.5;
export const WEIGHT_SCALE = 0.25;
export const MIN_K_WEIGHT = 0.5;
export const K_DIVISOR = 2;
export const CONFIDENCE_BASE_FACTOR = 0.5;
export const CONFIDENCE_COMP_WEIGHT = 0.7;
export const CONFIDENCE_SPREAD_WEIGHT = 0.3;
export const CONFIDENCE_TARGET_MULTIPLIER = 0.6;
export const CONFIDENCE_SPREAD_TARGET = 200;
export const UNMOVED_BOTH_BOOST = 3;
export const UNMOVED_ONE_BOOST = 2;
export const DEFAULT_WINDOW_SIZE = 7;

export const MIN_WORD_LENGTH = 3;
export const MIN_WORD_OVERLAP = 2;

export const EPSILON = 0.01;
export const MAX_MONTHS = 12;
export const MIN_STDDEV_DIVISOR = 12;
export const MIN_NUDGE = 0.001;
export const SCORE_DECIMAL_PLACES = 4;

export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;
export const LCG_MODULUS = 4294967296;
export const HASH_SHIFT = 5;
export const MIN_REVIEWS = 3;
export const MAX_EXTRA_REVIEWS = 3;
export const POSITIVE_THRESHOLD = 10;
export const NEUTRAL_THRESHOLD = 18;
export const POSITIVE_MIN_RATING = 4;
export const POSITIVE_RATING_RANGE = 2;
export const NEUTRAL_MIN_RATING = 3;
export const NEUTRAL_RATING_RANGE = 2;
export const NEGATIVE_MIN_RATING = 1;
export const NEGATIVE_RATING_RANGE = 2;
export const MAX_REVIEW_MONTHS = 24;
export const BASE_YEAR = 2025;

export const DRAG_MOUSE_DISTANCE = 5;
export const DRAG_TOUCH_DELAY = 250;
export const DRAG_TOUCH_TOLERANCE = 8;

export const GEOLOCATION_TIMEOUT = 10000;
export const COORD_DECIMAL_PLACES = 3;

export const FY1_PLACEMENT_COUNT = 3;
export const PLACEMENTS_PER_FY = 3;
export const STAR_RATING_MAX = 5;

export const ISO_DATE_SLICE_END = 10;

export const MOBILE_BREAKPOINT = 640;

export const SCORE_DISPLAY_DECIMALS = 3;

export const COPY_FEEDBACK_DURATION_MS = 1500;

export const MAP_DEFAULT_ZOOM = 14;
export const MAP_FALLBACK_ZOOM = 6;
export const SCOTLAND_CENTER_LAT = 56.49;
export const SCOTLAND_CENTER_LNG = -4.2;

export const CHART_BAR_RADIUS = 4;
export const CHART_NAME_MAX_LENGTH = 22;
export const CHART_NAME_TRUNCATE_AT = 20;

const TICK_0 = 0;
const TICK_25 = 25;
const TICK_50 = 50;
const TICK_75 = 75;
const TICK_100 = 100;
export const SLIDER_TICK_POSITIONS = [TICK_0, TICK_25, TICK_50, TICK_75, TICK_100] as const;

export const COMPARE_MAX_JOBS = 3;

export const UNDO_HISTORY_LIMIT = 50;
