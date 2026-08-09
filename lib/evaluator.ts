import { Card, RANK_LABEL } from "./cards";

export type HandResult = {
  /** hoger = beter, direct vergelijkbaar */
  score: number;
  /** 0 = hoge kaart ... 8 = straight flush */
  cat: number;
  name: string;
  /** de 5 kaarten die de hand vormen */
  best: Card[];
};

const CAT_NAMES = [
  "Hoge kaart",
  "Paar",
  "Twee paar",
  "Drie gelijken",
  "Straat",
  "Flush",
  "Full house",
  "Vier gelijken",
  "Straight flush",
];

type Eval5 = { score: number; cat: number; keys: number[] };

function evaluate5(cs: Card[]): Eval5 {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const s0 = cs[0].s;
  const flush = cs[1].s === s0 && cs[2].s === s0 && cs[3].s === s0 && cs[4].s === s0;

  const counts = new Map<number, number>();
  for (const r of rs) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = groups.map((g) => g[0]);

  let straight = false;
  let high = 0;
  if (counts.size === 5) {
    if (rs[0] - rs[4] === 4) {
      straight = true;
      high = rs[0];
    } else if (rs[0] === 14 && rs[1] === 5 && rs[4] === 2) {
      // wiel: A-2-3-4-5
      straight = true;
      high = 5;
    }
  }

  let cat: number;
  let keys: number[];

  if (straight && flush) {
    cat = 8;
    keys = [high];
  } else if (groups[0][1] === 4) {
    cat = 7;
    keys = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    cat = 6;
    keys = [groups[0][0], groups[1][0]];
  } else if (flush) {
    cat = 5;
    keys = rs;
  } else if (straight) {
    cat = 4;
    keys = [high];
  } else if (groups[0][1] === 3) {
    cat = 3;
    keys = [groups[0][0], uniq[1], uniq[2]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    cat = 2;
    keys = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    cat = 1;
    keys = [groups[0][0], uniq[1], uniq[2], uniq[3]];
  } else {
    cat = 0;
    keys = rs;
  }

  let score = cat;
  for (let i = 0; i < 5; i++) score = score * 15 + (keys[i] ?? 0);
  return { score, cat, keys };
}

const COMBOS_7 = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

/** Beste 5-kaart hand uit 5, 6 of 7 kaarten. */
export function evaluate(cards: Card[]): HandResult {
  let bestScore = -1;
  let bestCat = 0;
  let bestKeys: number[] = [];
  let bestCards: Card[] = cards.slice(0, 5);

  if (cards.length === 7) {
    const buf: Card[] = new Array(5);
    for (const combo of COMBOS_7) {
      for (let i = 0; i < 5; i++) buf[i] = cards[combo[i]];
      const r = evaluate5(buf);
      if (r.score > bestScore) {
        bestScore = r.score;
        bestCat = r.cat;
        bestKeys = r.keys;
        bestCards = buf.slice();
      }
    }
  } else if (cards.length === 5) {
    const r = evaluate5(cards);
    bestScore = r.score;
    bestCat = r.cat;
    bestKeys = r.keys;
    bestCards = cards.slice();
  } else {
    // 6 kaarten (of minder dan 5): brute force over alle 5-combinaties
    const n = cards.length;
    if (n < 5) {
      // te weinig kaarten: geef een ruwe score op hoge kaarten
      const rs = cards.map((c) => c.r).sort((a, b) => b - a);
      let score = 0;
      for (let i = 0; i < 5; i++) score = score * 15 + (rs[i] ?? 0);
      return { score, cat: 0, name: CAT_NAMES[0], best: cards.slice() };
    }
    const idx = [0, 1, 2, 3, 4];
    const rec = (start: number, depth: number) => {
      if (depth === 5) {
        const sub = idx.map((i) => cards[i]);
        const r = evaluate5(sub);
        if (r.score > bestScore) {
          bestScore = r.score;
          bestCat = r.cat;
          bestKeys = r.keys;
          bestCards = sub;
        }
        return;
      }
      for (let i = start; i < n; i++) {
        idx[depth] = i;
        rec(i + 1, depth + 1);
      }
    };
    rec(0, 0);
  }

  return {
    score: bestScore,
    cat: bestCat,
    name: handName(bestCat, bestKeys),
    best: bestCards,
  };
}

/** Alleen de score — sneller pad voor de AI-simulaties. */
export function score7(cards: Card[]): number {
  let best = -1;
  const buf: Card[] = new Array(5);
  for (const combo of COMBOS_7) {
    buf[0] = cards[combo[0]];
    buf[1] = cards[combo[1]];
    buf[2] = cards[combo[2]];
    buf[3] = cards[combo[3]];
    buf[4] = cards[combo[4]];
    const s = evaluate5(buf).score;
    if (s > best) best = s;
  }
  return best;
}

function handName(cat: number, keys: number[]): string {
  const L = (r: number) => RANK_LABEL[r] ?? "?";
  switch (cat) {
    case 8:
      return keys[0] === 14 ? "Royal flush" : `Straight flush tot ${L(keys[0])}`;
    case 7:
      return `Vier ${L(keys[0])}'s`;
    case 6:
      return `Full house, ${L(keys[0])}'s vol ${L(keys[1])}'s`;
    case 5:
      return `Flush, ${L(keys[0])} hoog`;
    case 4:
      return `Straat tot ${L(keys[0])}`;
    case 3:
      return `Drie ${L(keys[0])}'s`;
    case 2:
      return `Twee paar, ${L(keys[0])}'s en ${L(keys[1])}'s`;
    case 1:
      return `Paar ${L(keys[0])}'s`;
    default:
      return `Hoge kaart ${L(keys[0])}`;
  }
}

export { CAT_NAMES };
