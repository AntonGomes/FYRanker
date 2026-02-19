import type { SortableItem } from "@/components/sortable-list";

export interface ComparisonRecord {
  a: string;
  b: string;
  weight: number; // -2..+2: negative favours a, positive favours b
}

export interface EloState {
  ratings: Map<string, number>;
  comparisons: Map<string, number>; // per-specialty comparison count
  pairCounts: Map<string, number>; // "a::b" sorted key -> count
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
    ratings.set(s, 1500);
    comparisons.set(s, 0);
  }
  return {
    ratings,
    comparisons,
    pairCounts: new Map(),
    history: [],
  };
}

/**
 * Seed ELO state from a DnD ranking + which items the user manually moved.
 * Moved items get a higher virtual comparison count (more "settled"),
 * while unmoved items stay at 0 so active sampling prioritises them.
 */
export function initEloFromRanking(
  items: SortableItem[],
  movedIds: Set<string>
): EloState {
  const n = items.length;
  const spreadFactor = 10;
  const ratings = new Map<string, number>();
  const comparisons = new Map<string, number>();
  const pairCounts = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const id = items[i].id;
    // Rank 1 gets highest rating, rank n gets lowest
    const rating = 1500 + (n / 2 - i) * spreadFactor;
    ratings.set(id, rating);
    // Moved items start with virtual comparisons (more settled)
    comparisons.set(id, movedIds.has(id) ? 3 : 0);
  }

  // Inject virtual pair comparisons between adjacent moved items
  // to avoid re-asking questions the user already answered via DnD
  for (let i = 0; i < n - 1; i++) {
    const a = items[i].id;
    const b = items[i + 1].id;
    if (movedIds.has(a) && movedIds.has(b)) {
      const pk = pairKey(a, b);
      pairCounts.set(pk, (pairCounts.get(pk) ?? 0) + 2);
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
  const rA = state.ratings.get(a) ?? 1500;
  const rB = state.ratings.get(b) ?? 1500;

  // Expected scores
  const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const eB = 1 - eA;

  // Actual scores from weight: -2 = full win for A, +2 = full win for B
  const sA = 0.5 - weight * 0.25;
  const sB = 1 - sA;

  // K-factor scales with preference strength (draws still cause a small update)
  const kBase = 32;
  const kScaled = kBase * Math.max(Math.abs(weight), 0.5) / 2;

  const newRA = rA + kScaled * (sA - eA);
  const newRB = rB + kScaled * (sB - eB);

  // Clone maps
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

  // Sort by rating for adjacent-pair candidates
  items.sort((a, b) => b[1] - a[1]);
  const names = items.map(([name]) => name);

  // Build candidate set: adjacent pairs (close ratings) + random sample + uncompared
  const candidates: [string, string][] = [];

  // Adjacent pairs in rating order (top-10 closest gaps)
  for (let i = 0; i < names.length - 1; i++) {
    candidates.push([names[i], names[i + 1]]);
  }

  // Random sample of ~30 pairs
  for (let k = 0; k < 30; k++) {
    const i = Math.floor(Math.random() * names.length);
    let j = Math.floor(Math.random() * (names.length - 1));
    if (j >= i) j++;
    candidates.push([names[i], names[j]]);
  }

  // Score each candidate and pick the best
  let bestScore = -Infinity;
  let bestPair: [string, string] = [names[0], names[1]];

  for (const [a, b] of candidates) {
    const pk = pairKey(a, b);
    const pc = state.pairCounts.get(pk) ?? 0;
    const rA = state.ratings.get(a) ?? 1500;
    const rB = state.ratings.get(b) ?? 1500;

    // Uncertainty score: prefer uncompared pairs + close ratings
    let score = 1 / (pc + 1) + 1 / (1 + Math.abs(rA - rB) / 100);

    // Boost uncertainty for items that were never manually moved in DnD
    if (movedIds) {
      const aUnmoved = !movedIds.has(a);
      const bUnmoved = !movedIds.has(b);
      if (aUnmoved || bUnmoved) {
        score *= aUnmoved && bUnmoved ? 3 : 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPair = [a, b];
    }
  }

  // Randomly swap order so left/right isn't biased
  if (Math.random() < 0.5) {
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

  // Base confidence from DnD manual moves
  const baseConfidence = movedCount != null ? (movedCount / n) * 0.5 : 0;

  const totalComps = state.history.length;
  const targetComps = n * Math.log2(n) * 0.6;
  const compRatio = Math.min(totalComps / targetComps, 1);

  // Rating spread: higher spread = more differentiation
  const ratings = Array.from(state.ratings.values());
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const variance =
    ratings.reduce((a, r) => a + (r - mean) ** 2, 0) / ratings.length;
  const stddev = Math.sqrt(variance);
  const spreadRatio = Math.min(stddev / 200, 1);

  const eloConfidence = 0.7 * compRatio + 0.3 * spreadRatio;

  // Combine: base from DnD + remaining from ELO comparisons
  return Math.min(baseConfidence + (1 - baseConfidence) * eloConfidence, 1);
}

export function toRankedList(state: EloState): SortableItem[] {
  return Array.from(state.ratings.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => ({ id: name, label: name }));
}

export function getRankingNeighbourhood(
  state: EloState,
  a: string,
  b: string,
  windowSize = 7
): RankingEntry[] {
  const sorted = Array.from(state.ratings.entries())
    .sort((x, y) => y[1] - x[1])
    .map(([name, rating], i) => ({
      id: name,
      label: name,
      rating: Math.round(rating),
      rank: i + 1,
    }));

  const idxA = sorted.findIndex((e) => e.id === a);
  const idxB = sorted.findIndex((e) => e.id === b);

  if (idxA === -1 || idxB === -1) return sorted.slice(0, windowSize);

  const midpoint = Math.floor((idxA + idxB) / 2);
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(0, Math.min(midpoint - halfWindow, sorted.length - windowSize));
  const end = Math.min(sorted.length, start + windowSize);

  return sorted.slice(start, end);
}
