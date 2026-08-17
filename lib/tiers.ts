export type Tier = {
  id: string;
  name: string;
  venue: string;
  icon: string;
  buyIn: number;
  stack: number;
  /** handen per blindniveau — lager = sneller toernooi */
  handsPerLevel: number;
  /** 0.8 = slordige bots, 1.35 = scherpe bots */
  skill: number;
  /** uitbetaling voor plaats 1 */
  prize: number;
};

export const TIERS: Tier[] = [
  {
    id: "cafe",
    name: "Café-avond",
    venue: "achterzaal, plakkerige tafel",
    icon: "🍺",
    buyIn: 50,
    stack: 2000,
    handsPerLevel: 8,
    skill: 0.8,
    prize: 250,
  },
  {
    id: "club",
    name: "Pokerclub",
    venue: "dinsdagavond, iedereen kent iedereen",
    icon: "🎴",
    buyIn: 200,
    stack: 3000,
    handsPerLevel: 9,
    skill: 1,
    prize: 1000,
  },
  {
    id: "casino",
    name: "Casino",
    venue: "vilt, dealer, camera's",
    icon: "🎰",
    buyIn: 750,
    stack: 4000,
    handsPerLevel: 10,
    skill: 1.15,
    prize: 3750,
  },
  {
    id: "highroller",
    name: "High Roller",
    venue: "vijf mensen die niet knipperen",
    icon: "💎",
    buyIn: 2500,
    stack: 5000,
    handsPerLevel: 12,
    skill: 1.35,
    prize: 12500,
  },
];

export function tierById(id: string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

/** Prijzengeld per eindplaats. */
export function payout(tier: Tier, place: number): number {
  if (place === 1) return tier.prize;
  if (place === 2) return Math.round(tier.prize * 0.38);
  if (place === 3) return Math.round(tier.prize * 0.14);
  return 0;
}

/** Een niveau is open zodra het vorige gewonnen is. */
export function isUnlocked(tier: Tier, won: string[]): boolean {
  const i = TIERS.findIndex((t) => t.id === tier.id);
  if (i <= 0) return true;
  return won.includes(TIERS[i - 1].id);
}

export const STARTING_BANKROLL = 500;
