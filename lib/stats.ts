import { STARTING_BANKROLL } from "./tiers";

export type Stats = {
  hands: number;
  handsWon: number;
  showdownsWon: number;
  biggestPot: number;
  tourneys: number;
  victories: number;
  bestPlace: number;
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
  streak: 0,
  bestStreak: 0,
};

export type Progress = {
  bankroll: number;
  /** ids van gewonnen toernooiniveaus */
  tiersWon: string[];
  achievements: string[];
  /** beste resultaat van de dagchallenge: { seed, place, chips } */
  daily: { seed: number; place: number; chips: number } | null;
};

export const EMPTY_PROGRESS: Progress = {
  bankroll: STARTING_BANKROLL,
  tiersWon: [],
  achievements: [],
  daily: null,
};

export type Settings = {
  sound: boolean;
  /** 0.6 = traag, 1 = normaal, 1.7 = snel */
  speed: number;
  /** bedenktijd in seconden, 0 = geen klok */
  clock: number;
  coach: boolean;
  /** live winkans tonen tijdens jouw beurt */
  equityMeter: boolean;
  chatter: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  speed: 1,
  clock: 30,
  coach: true,
  equityMeter: false,
  chatter: true,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: gewoon negeren */
  }
}

const STATS_KEY = "poker-royale:stats:v1";
const PROGRESS_KEY = "poker-royale:progress:v1";
const SETTINGS_KEY = "poker-royale:settings:v1";
const NAME_KEY = "poker-royale:name";

export const loadStats = () => read(STATS_KEY, EMPTY_STATS);
export const saveStats = (s: Stats) => write(STATS_KEY, s);

export const loadProgress = () => read(PROGRESS_KEY, EMPTY_PROGRESS);
export const saveProgress = (p: Progress) => write(PROGRESS_KEY, p);

export const loadSettings = () => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

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
