export type Stats = {
  hands: number;
  handsWon: number;
  showdownsWon: number;
  biggestPot: number;
  tourneys: number;
  victories: number;
  bestPlace: number;
  bankroll: number;
  streak: number;
  bestStreak: number;
};

export const EMPTY_STATS: Stats = {
  hands: 0,
  handsWon: 0,
  showdownsWon: 0,
  biggestPot: 0,
  tourneys: 0,
  victories: 0,
  bestPlace: 99,
  bankroll: 0,
  streak: 0,
  bestStreak: 0,
};

const KEY = "poker-royale:stats:v1";

export function loadStats(): Stats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATS;
    return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(s: Stats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: gewoon negeren */
  }
}

const NAME_KEY = "poker-royale:name";

export function loadName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(n: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, n);
  } catch {
    /* negeren */
  }
}
