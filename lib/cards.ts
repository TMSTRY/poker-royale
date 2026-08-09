export type Suit = "s" | "h" | "d" | "c";

export type Card = {
  /** 2..14 (14 = Aas) */
  r: number;
  s: Suit;
  /** unieke id, bv. "As" */
  id: string;
};

export const SUITS: Suit[] = ["s", "h", "d", "c"];

export const SUIT_GLYPH: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

export const SUIT_NAME: Record<Suit, string> = {
  s: "schoppen",
  h: "harten",
  d: "ruiten",
  c: "klaveren",
};

export const RANK_LABEL: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export const RANK_WORD: Record<number, string> = {
  2: "twee",
  3: "drie",
  4: "vier",
  5: "vijf",
  6: "zes",
  7: "zeven",
  8: "acht",
  9: "negen",
  10: "tien",
  11: "boer",
  12: "dame",
  13: "heer",
  14: "aas",
};

export function isRed(s: Suit): boolean {
  return s === "h" || s === "d";
}

export function cardLabel(c: Card): string {
  return `${RANK_LABEL[c.r]}${SUIT_GLYPH[c.s]}`;
}

export const FULL_DECK: Card[] = (() => {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (let r = 2; r <= 14; r++) {
      deck.push({ r, s, id: `${RANK_LABEL[r]}${s}` });
    }
  }
  return deck;
})();

export function freshDeck(): Card[] {
  return shuffle(FULL_DECK.slice());
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** compacte notatie: 10 wordt T, zodat "T3" niet als "103" leest */
function short(r: number): string {
  return r === 10 ? "T" : RANK_LABEL[r];
}

/** "A♠ K♠" -> korte omschrijving van startkaarten */
export function describeHole(hole: Card[]): string {
  if (hole.length !== 2) return "";
  const [a, b] = hole[0].r >= hole[1].r ? hole : [hole[1], hole[0]];
  if (a.r === b.r) return `pocket ${short(a.r)}'s`;
  const suited = a.s === b.s ? " suited" : " offsuit";
  return `${short(a.r)}${short(b.r)}${suited}`;
}
