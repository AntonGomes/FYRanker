import type { SortableItem } from "@/components/sortable-list";
import {
  INITIAL_RATING,
  K_FACTOR,
  ELO_DIVISOR,
  SPREAD_FACTOR,
  INITIAL_COMPARISONS_IF_MOVED,
  ADJACENT_PAIR_INITIAL_COUNT,
  MATCHUP_RANDOM_CANDIDATES,
  MATCHUP_CLOSENESS_DIVISOR,
  MATCHUP_FLIP_THRESHOLD,
  HALF_SCORE,
  WEIGHT_SCALE,
  MIN_K_WEIGHT,
  K_DIVISOR,
  CONFIDENCE_BASE_FACTOR,
  CONFIDENCE_COMP_WEIGHT,
  CONFIDENCE_SPREAD_WEIGHT,
  CONFIDENCE_TARGET_MULTIPLIER,
  CONFIDENCE_SPREAD_TARGET,
  UNMOVED_BOTH_BOOST,
  UNMOVED_ONE_BOOST,
  DEFAULT_WINDOW_SIZE,
} from "@/lib/constants";

export interface ComparisonRecord {
  a: string;
  b: string;
  weight: number;
}

export interface EloState {
  ratings: Map<string, number>;
  comparisons: Map<string, number>;
  pairCounts: Map<string, number>;
  history: ComparisonRecord[];
}

export interface RankingEntry {
  id: string;
  label: string;
  rating: number;
  rank: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function initElo(specialties: string[]): EloState {
  const ratings = new Map<string, number>();
  const comparisons = new Map<string, number>();
  for (const s of specialties) {
    ratings.set(s, INITIAL_RATING);
    comparisons.set(s, 0);
  }
  return {
    ratings,
    comparisons,
    pairCounts: new Map(),
    history: [],
  };
}

export function initEloFromRanking(
  items: SortableItem[],
  movedIds: Set<string>
): EloState {
  const n = items.length;
  const ratings = new Map<string, number>();
  const comparisons = new Map<string, number>();
  const pairCounts = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const id = items[i].id;
    const rating = INITIAL_RATING + (n / 2 - i) * SPREAD_FACTOR;
    ratings.set(id, rating);
    comparisons.set(id, movedIds.has(id) ? INITIAL_COMPARISONS_IF_MOVED : 0);
  }

  for (let i = 0; i < n - 1; i++) {
    const a = items[i].id;
    const b = items[i + 1].id;
    if (movedIds.has(a) && movedIds.has(b)) {
      const pk = pairKey(a, b);
      pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + ADJACENT_PAIR_INITIAL_COUNT);
    }
  }

  return {
    ratings,
    comparisons,
    pairCounts,
    history: [],
  };
}

export function updateElo(
  state: EloState,
  a: string,
  b: string,
  weight: number
): EloState {
  const rA = state.ratings.get(a) ?? INITIAL_RATING;
  const rB = state.ratings.get(b) ?? INITIAL_RATING;

  const eA = 1 / (1 + Math.pow(10, (rB - rA) / ELO_DIVISOR));
  const eB = 1 - eA;

  const sA = HALF_SCORE - weight * WEIGHT_SCALE;
  const sB = 1 - sA;

  const kScaled = K_FACTOR * Math.max(Math.abs(weight), MIN_K_WEIGHT) / K_DIVISOR;

  const newRA = rA + kScaled * (sA - eA);
  const newRB = rB + kScaled * (sB - eB);

  const ratings = new Map(state.ratings);
  const comparisons = new Map(state.comparisons);
  const pairCounts = new Map(state.pairCounts);

  ratings.set(a, newRA);
  ratings.set(b, newRB);
  comparisons.set(a, (comparisons.get(a) ?? 0) + 1);
  comparisons.set(b, (comparisons.get(b) ?? 0) + 1);

  const pk = pairKey(a, b);
  pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 1);

  return {
    ratings,
    comparisons,
    pairCounts,
    history: [...state.history, { a, b, weight }],
  };
}

export function selectNextMatchup(
  state: EloState,
  movedIds?: Set<string>
): [string, string] {
  const items = Array.from(state.ratings.entries());
  if (items.length < 2) throw new Error("Need at least 2 items");

  items.sort((a, b) => b[1] - a[1]);
  const names = items.map(([name]) => name);

  const candidates: [string, string][] = [];

  for (let i = 0; i < names.length - 1; i++) {
    candidates.push([names[i], names[i + 1]]);
  }

  for (let k = 0; k < MATCHUP_RANDOM_CANDIDATES; k++) {
    const i = Math.floor(Math.random() * names.length);
    let j = Math.floor(Math.random() * (names.length - 1));
    if (j >= i) j++;
    candidates.push([names[i], names[j]]);
  }

  let bestScore = -Infinity;
  let bestPair: [string, string] = [names[0], names[1]];

  for (const [a, b] of candidates) {
    const pk = pairKey(a, b);
    const pc = state.pairCounts.get(pk) ?? 0;
    const rA = state.ratings.get(a) ?? INITIAL_RATING;
    const rB = state.ratings.get(b) ?? INITIAL_RATING;

    let score = 1 / (pc + 1) + 1 / (1 + Math.abs(rA - rB) / MATCHUP_CLOSENESS_DIVISOR);

    if (movedIds) {
      const aUnmoved = !movedIds.has(a);
      const bUnmoved = !movedIds.has(b);
      if (aUnmoved || bUnmoved) {
        score *= aUnmoved && bUnmoved ? UNMOVED_BOTH_BOOST : UNMOVED_ONE_BOOST;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPair = [a, b];
    }
  }

  if (Math.random() < MATCHUP_FLIP_THRESHOLD) {
    return [bestPair[1], bestPair[0]];
  }
  return bestPair;
}

export function getConfidence(
  state: EloState,
  movedCount?: number
): number {
  const n = state.ratings.size;
  if (n <= 1) return 1;

  const baseConfidence = movedCount != null ? (movedCount / n) * CONFIDENCE_BASE_FACTOR : 0;

  const totalComps = state.history.length;
  const targetComps = n * Math.log2(n) * CONFIDENCE_TARGET_MULTIPLIER;
  const compRatio = Math.min(totalComps / targetComps, 1);

  const ratings = Array.from(state.ratings.values());
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((a, r) => a + (r - mean) ** 2, 0) / ratings.length;
  const stddev = Math.sqrt(variance);
  const spreadRatio = Math.min(stddev / CONFIDENCE_SPREAD_TARGET, 1);

  const eloConfidence = CONFIDENCE_COMP_WEIGHT * compRatio + CONFIDENCE_SPREAD_WEIGHT * spreadRatio;

  return Math.min(baseConfidence + (1 - baseConfidence) * eloConfidence, 1);
}

export function toRankedList(state: EloState): SortableItem[] {
  return Array.from(state.ratings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({ id: name, label: name }));
}

export function getFocusedNeighbourhood(
  state: EloState,
  focal: string,
  windowSize = DEFAULT_WINDOW_SIZE
): RankingEntry[] {
  const sorted = Array.from(state.ratings.entries())
    .sort((x, y) => y[1] - x[1])
    .map(([name, rating], i) => ({
      id: name,
      label: name,
      rating: Math.round(rating),
      rank: i + 1,
    }));

  const idx = sorted.findIndex((e) => e.id === focal);
  if (idx === -1) return sorted.slice(0, windowSize);

  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(idx - half, sorted.length - windowSize));
  const end = Math.min(sorted.length, start + windowSize);

  return sorted.slice(start, end);
}
