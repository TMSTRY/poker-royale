export type Achievement = {
  id: string;
  name: string;
  desc: string;
  icon: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-pot", name: "Eerste bloed", desc: "Win je eerste pot", icon: "🩸" },
  { id: "full-house", name: "Vol huis", desc: "Win een pot met een full house", icon: "🏠" },
  { id: "quads", name: "Vier op een rij", desc: "Win een pot met vier gelijken", icon: "🧱" },
  { id: "royal", name: "Koninklijk", desc: "Win een pot met een royal flush", icon: "👑" },
  { id: "bluff", name: "Pokerface", desc: "Win zonder showdown een pot van 800+ na een raise", icon: "🎭" },
  { id: "seven-deuce", name: "Zeven-twee", desc: "Win een hand met 7-2 offsuit", icon: "🃏" },
  { id: "streak5", name: "Op dreef", desc: "Win vijf handen op rij", icon: "🔥" },
  { id: "bigpot", name: "Monsterpot", desc: "Win een pot van 5.000 of meer", icon: "🐋" },
  { id: "comeback", name: "Uit de as", desc: "Win een toernooi nadat je onder 8 blinds zat", icon: "🕊️" },
  { id: "ironman", name: "Zitvlees", desc: "Speel 200 handen in totaal", icon: "🪑" },
  { id: "daily", name: "Dagkoers", desc: "Win een dagchallenge", icon: "📅" },
  { id: "tier-club", name: "Clubkampioen", desc: "Win de Pokerclub", icon: "🎴" },
  { id: "tier-casino", name: "Huisvriend", desc: "Win het Casino", icon: "🎰" },
  { id: "tier-highroller", name: "High Roller", desc: "Win de High Roller", icon: "💎" },
  { id: "bankroll", name: "Zakenman", desc: "Kom boven 10.000 bankroll", icon: "💰" },
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export type HandContext = {
  won: boolean;
  showdown: boolean;
  potWon: number;
  handCat: number | null;
  handName: string | null;
  holeLabel: string;
  raisedThisHand: boolean;
  streak: number;
  totalHands: number;
};

export function checkHand(c: HandContext, unlocked: string[]): string[] {
  const out: string[] = [];
  const add = (id: string, cond: boolean) => {
    if (cond && !unlocked.includes(id) && !out.includes(id)) out.push(id);
  };

  add("first-pot", c.won);
  add("full-house", c.won && c.handCat === 6);
  add("quads", c.won && c.handCat === 7);
  add("royal", c.won && c.handName === "Royal flush");
  add("bluff", c.won && !c.showdown && c.potWon >= 800 && c.raisedThisHand);
  add("seven-deuce", c.won && /^72 (off|suit)/.test(c.holeLabel));
  add("streak5", c.streak >= 5);
  add("bigpot", c.won && c.potWon >= 5000);
  add("ironman", c.totalHands >= 200);

  return out;
}

export type GameContext = {
  place: number;
  tierId: string;
  wasShort: boolean;
  daily: boolean;
  bankroll: number;
};

export function checkGame(c: GameContext, unlocked: string[]): string[] {
  const out: string[] = [];
  const add = (id: string, cond: boolean) => {
    if (cond && !unlocked.includes(id) && !out.includes(id)) out.push(id);
  };
  const won = c.place === 1;

  add("comeback", won && c.wasShort);
  add("daily", won && c.daily);
  add(`tier-${c.tierId}`, won && c.tierId !== "cafe");
  add("bankroll", c.bankroll >= 10000);

  return out;
}
