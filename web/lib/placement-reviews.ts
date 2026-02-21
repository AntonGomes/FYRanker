import {
  LCG_MULTIPLIER,
  LCG_INCREMENT,
  LCG_MODULUS,
  HASH_SHIFT,
  MIN_REVIEWS,
  MAX_EXTRA_REVIEWS,
  POSITIVE_THRESHOLD,
  NEUTRAL_THRESHOLD,
  POSITIVE_MIN_RATING,
  POSITIVE_RATING_RANGE,
  NEUTRAL_MIN_RATING,
  NEUTRAL_RATING_RANGE,
  NEGATIVE_MIN_RATING,
  NEGATIVE_RATING_RANGE,
  MAX_REVIEW_MONTHS,
  BASE_YEAR,
} from "@/lib/constants";

export interface PlacementReview {
  author: string;
  rating: number; // 1-5
  text: string;
  date: string;
}

const AUTHORS = [
  "Dr. A. Smith", "Dr. R. Patel", "Dr. J. Chen", "Dr. S. MacLeod",
  "Dr. K. Williams", "Dr. M. Ahmed", "Dr. L. Brown", "Dr. E. Taylor",
  "Dr. N. Singh", "Dr. C. Murray", "Dr. F. Hassan", "Dr. D. Campbell",
];

const REVIEW_SNIPPETS = [
  // positive (0-9)
  "Excellent teaching and very supportive consultants. Highly recommend.",
  "Great variety of cases. You get a lot of hands-on experience here.",
  "Friendly team, good work-life balance. Rota was fair and well-organised.",
  "Brilliant learning environment. Regular teaching sessions and audit opportunities.",
  "Supportive department with approachable seniors. Felt well-prepared for exams.",
  "Good mix of acute and elective work. Never felt unsupported on calls.",
  "Outstanding supervision. Consultants genuinely invested in trainee development.",
  "Well-staffed department so workload is manageable. Good morale overall.",
  "Fantastic placement — the best of my foundation year by far.",
  "Lots of clinic exposure and procedural skills opportunities. Very educational.",
  // neutral (10-17)
  "Decent placement overall. Teaching was hit-or-miss depending on the week.",
  "Average experience. Some weeks were very busy, others quieter. Rota could be better.",
  "Fine placement. Nothing exceptional but solid clinical exposure.",
  "Reasonable workload. Teaching happened occasionally. Supervisors were available when needed.",
  "Mixed experience — some rotations within the placement were better than others.",
  "Okay overall. IT systems were frustrating but the team was supportive.",
  "Standard placement. Got good experience but didn't feel stretched.",
  "Adequate supervision. Would have liked more structured teaching.",
  // negative (18-24)
  "Very busy department. Often felt stretched thin, especially on nights.",
  "Understaffed at times which put pressure on juniors. Teaching was sparse.",
  "Challenging rota with frequent weekend shifts. Limited teaching time.",
  "Workload was heavy and supervision variable. Some consultants better than others.",
  "Difficult to get time for clinics due to ward commitments.",
  "The department was going through changes during my placement — felt somewhat chaotic.",
  "Not the best-organised placement. Induction was minimal and expectations unclear.",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << HASH_SHIFT) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * LCG_MULTIPLIER + LCG_INCREMENT) | 0;
    return (s >>> 0) / LCG_MODULUS;
  };
}

function ratingForSnippet(snippetIdx: number, rand: () => number): number {
  if (snippetIdx < POSITIVE_THRESHOLD) return POSITIVE_MIN_RATING + Math.floor(rand() * POSITIVE_RATING_RANGE);
  if (snippetIdx < NEUTRAL_THRESHOLD) return NEUTRAL_MIN_RATING + Math.floor(rand() * NEUTRAL_RATING_RANGE);
  return NEGATIVE_MIN_RATING + Math.floor(rand() * NEGATIVE_RATING_RANGE);
}

export function getPlacementReviews(site: string, specialty: string): PlacementReview[] {
  const seed = hashStr(site + "|" + specialty);
  const rand = seededRandom(seed);

  const count = MIN_REVIEWS + Math.floor(rand() * MAX_EXTRA_REVIEWS);
  const reviews: PlacementReview[] = [];
  const usedSnippets = new Set<number>();
  const usedAuthors = new Set<number>();

  for (let i = 0; i < count; i++) {
    let authorIdx: number;
    do { authorIdx = Math.floor(rand() * AUTHORS.length); } while (usedAuthors.has(authorIdx) && usedAuthors.size < AUTHORS.length);
    usedAuthors.add(authorIdx);

    let snippetIdx: number;
    do { snippetIdx = Math.floor(rand() * REVIEW_SNIPPETS.length); } while (usedSnippets.has(snippetIdx) && usedSnippets.size < REVIEW_SNIPPETS.length);
    usedSnippets.add(snippetIdx);

    const rating = ratingForSnippet(snippetIdx, rand);

    const monthsAgo = Math.floor(rand() * MAX_REVIEW_MONTHS);
    const d = new Date(BASE_YEAR, 0, 1);
    d.setMonth(d.getMonth() - monthsAgo);
    const date = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

    reviews.push({ author: AUTHORS[authorIdx], rating, text: REVIEW_SNIPPETS[snippetIdx], date });
  }

  return reviews;
}

export function getAverageRating(reviews: PlacementReview[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
