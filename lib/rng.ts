export type Rng = () => number;

/** Snelle, deterministische generator (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mengt een reeks getallen tot één zaadje (FNV-achtig). */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    let x = p >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 16777619);
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/** yyyymmdd van vandaag, als zaadje voor de dagchallenge. */
export function dailySeed(d: Date = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function dailyLabel(d: Date = new Date()): string {
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}
