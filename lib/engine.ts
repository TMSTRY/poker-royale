import { Card, cardLabel, freshDeck } from "./cards";
import { evaluate, HandResult } from "./evaluator";
import { hashSeed, mulberry32 } from "./rng";

export type Stage =
  | "idle"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "handover"
  | "gameover";

export type ActionKind = "fold" | "check" | "call" | "raise" | "allin" | "blind";

export type Action = { kind: ActionKind; amount?: number };

export type Personality = {
  /** hoe vaak er verhoogd wordt met een sterke hand */
  aggression: number;
  /** hoe vaak er gebluft wordt zonder hand */
  bluff: number;
  /** hoger = strakker, speelt minder handen */
  tightness: number;
};

/** Wat de tafel over een speler heeft geleerd, binnen deze sessie. */
export type Read = {
  hands: number;
  /** handen waarin vrijwillig geld in de pot ging */
  vpip: number;
  raises: number;
  actions: number;
  facedRaise: number;
  foldToRaise: number;
  showdowns: number;
};

export const EMPTY_READ: Read = {
  hands: 0,
  vpip: 0,
  raises: 0,
  actions: 0,
  facedRaise: 0,
  foldToRaise: 0,
  showdowns: 0,
};

export type GameConfig = {
  startStack: number;
  handsPerLevel: number;
  /** 0.8 = slordige bots, 1.35 = scherpe bots */
  skill: number;
  /** vast zaadje voor de dagchallenge, of null voor willekeurig */
  seed: number | null;
  tierId: string;
};

export const DEFAULT_CONFIG: GameConfig = {
  startStack: 2000,
  handsPerLevel: 8,
  skill: 1,
  seed: null,
  tierId: "cafe",
};

export type Player = {
  id: number;
  name: string;
  avatar: string;
  color: string;
  tagline: string;
  chips: number;
  /** inzet in de huidige ronde */
  bet: number;
  /** totale inzet in deze hand (voor side pots) */
  committed: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  out: boolean;
  hasActed: boolean;
  human: boolean;
  personality: Personality;
  lastAction: string | null;
  /** voor de +/- chips animatie */
  delta: number;
  /** rang bij uitschakeling (6 = eerst eruit) */
  place: number | null;
  /** wat de tafel over deze speler weet */
  read: Read;
  /** 0..1 — stijgt na een verloren pot, maakt tijdelijk agressiever */
  heat: number;
  /** heeft deze speler deze hand al vrijwillig ingezet? */
  vpipThisHand: boolean;
};

export type PotAward = { amount: number; winners: number[]; side: boolean };

export type Outcome = {
  awards: PotAward[];
  showdown: boolean;
  hands: Record<number, { name: string; best: string[] }>;
  headline: string;
};

export type LogEntry = { id: number; text: string; kind: "action" | "street" | "win" };

export type GameState = {
  players: Player[];
  deck: Card[];
  board: Card[];
  /** chips die al uit de inzetronden verzameld zijn */
  pot: number;
  stage: Stage;
  /** index van de speler aan zet, -1 = niemand */
  turn: number;
  currentBet: number;
  minRaise: number;
  dealer: number;
  level: number;
  handNo: number;
  config: GameConfig;
  /** wie het laatst verhoogde in deze hand */
  lastAggressor: number | null;
  outcome: Outcome | null;
  log: LogEntry[];
  /** telt op zodat de UI weet wanneer er nieuwe kaarten zijn */
  dealToken: number;
  /** true tijdens het "chips naar de pot" moment */
  collecting: boolean;
  winnerIds: number[];
  /** kaarten die de winnende hand vormen (voor highlight) */
  highlight: string[];
};

export const START_STACK = 2000;
export const HANDS_PER_LEVEL = 8;

export const BLIND_LEVELS: { sb: number; bb: number }[] = [
  { sb: 10, bb: 20 },
  { sb: 15, bb: 30 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 75, bb: 150 },
  { sb: 100, bb: 200 },
  { sb: 150, bb: 300 },
  { sb: 250, bb: 500 },
  { sb: 400, bb: 800 },
  { sb: 600, bb: 1200 },
  { sb: 1000, bb: 2000 },
];

export function blinds(level: number) {
  return BLIND_LEVELS[Math.min(level, BLIND_LEVELS.length - 1)];
}

type BotSeed = Pick<
  Player,
  "id" | "name" | "avatar" | "color" | "tagline" | "human" | "personality"
>;

const BOTS: BotSeed[] = [
  {
    id: 1,
    name: "Vera",
    avatar: "🦊",
    color: "#f97316",
    tagline: "speelt strak, straft hard af",
    human: false,
    personality: { aggression: 0.55, bluff: 0.1, tightness: 0.75 },
  },
  {
    id: 2,
    name: "Mad Mo",
    avatar: "🐗",
    color: "#ef4444",
    tagline: "elke pot is van hem",
    human: false,
    personality: { aggression: 0.85, bluff: 0.4, tightness: 0.2 },
  },
  {
    id: 3,
    name: "Rook",
    avatar: "🦅",
    color: "#38bdf8",
    tagline: "leest je als een boek",
    human: false,
    personality: { aggression: 0.65, bluff: 0.25, tightness: 0.5 },
  },
  {
    id: 4,
    name: "Nonna",
    avatar: "🐢",
    color: "#a3e635",
    tagline: "wacht op de nuts",
    human: false,
    personality: { aggression: 0.35, bluff: 0.05, tightness: 0.85 },
  },
  {
    id: 5,
    name: "Dice",
    avatar: "🎲",
    color: "#c084fc",
    tagline: "gokt op gevoel",
    human: false,
    personality: { aggression: 0.7, bluff: 0.55, tightness: 0.3 },
  },
];

export function newGame(playerName: string, config: GameConfig = DEFAULT_CONFIG): GameState {
  const hero: BotSeed = {
    id: 0,
    name: playerName || "Jij",
    avatar: "😎",
    color: "#fbbf24",
    tagline: "de held",
    human: true,
    personality: { aggression: 0.5, bluff: 0.2, tightness: 0.5 },
  };

  const players: Player[] = [hero, ...BOTS].map((b) => ({
    ...b,
    chips: config.startStack,
    bet: 0,
    committed: 0,
    hole: [] as Card[],
    folded: false,
    allIn: false,
    out: false,
    hasActed: false,
    lastAction: null,
    delta: 0,
    place: null as number | null,
    read: { ...EMPTY_READ },
    heat: 0,
    vpipThisHand: false,
  }));

  return {
    players,
    deck: [],
    board: [],
    pot: 0,
    stage: "idle",
    turn: -1,
    currentBet: 0,
    minRaise: 20,
    dealer:
      config.seed == null
        ? Math.floor(Math.random() * players.length)
        : hashSeed(config.seed) % players.length,
    level: 0,
    handNo: 0,
    config,
    lastAggressor: null,
    outcome: null,
    log: [],
    dealToken: 0,
    collecting: false,
    winnerIds: [],
    highlight: [],
  };
}

/* ---------- helpers ---------- */

function clone(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, hole: p.hole.slice(), read: { ...p.read } })),
    deck: s.deck.slice(),
    board: s.board.slice(),
    log: s.log.slice(),
    winnerIds: s.winnerIds.slice(),
    highlight: s.highlight.slice(),
  };
}

function pushLog(s: GameState, text: string, kind: LogEntry["kind"] = "action") {
  s.log = [...s.log.slice(-40), { id: s.log.length ? s.log[s.log.length - 1].id + 1 : 1, text, kind }];
}

export function activePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.out);
}

export function livePlayers(s: GameState): Player[] {
  return s.players.filter((p) => !p.out && !p.folded);
}

function nextIdx(s: GameState, from: number, pred: (p: Player) => boolean): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (pred(s.players[idx])) return idx;
  }
  return -1;
}

function canAct(p: Player) {
  return !p.out && !p.folded && !p.allIn;
}

export function totalPot(s: GameState): number {
  return s.pot + s.players.reduce((a, p) => a + p.bet, 0);
}

/* ---------- hand starten ---------- */

export function startHand(prev: GameState): GameState {
  const s = clone(prev);

  for (const p of s.players) {
    if (p.chips <= 0) p.out = true;
    p.bet = 0;
    p.committed = 0;
    p.hole = [];
    p.folded = p.out;
    p.allIn = false;
    p.hasActed = false;
    p.lastAction = null;
    p.delta = 0;
    p.vpipThisHand = false;
    // opgebouwde frustratie zakt langzaam weg
    p.heat = Math.max(0, p.heat * 0.72 - 0.02);
    if (!p.out) p.read = { ...p.read, hands: p.read.hands + 1 };
  }

  s.board = [];
  s.pot = 0;
  s.outcome = null;
  s.winnerIds = [];
  s.highlight = [];
  s.collecting = false;
  s.lastAggressor = null;
  s.handNo = prev.handNo + 1;
  // met een zaadje is elke hand exact reproduceerbaar, los van de volgorde
  // waarin React deze functie aanroept
  s.deck = freshDeck(
    s.config.seed == null ? Math.random : mulberry32(hashSeed(s.config.seed, s.handNo))
  );
  s.level = Math.floor((s.handNo - 1) / s.config.handsPerLevel);
  s.dealToken = prev.dealToken + 1;

  const seats = activePlayers(s);
  if (seats.length < 2) {
    s.stage = "gameover";
    s.turn = -1;
    return s;
  }

  // knop doorschuiven naar de volgende speler die nog meedoet
  s.dealer = nextIdx(s, prev.dealer, (p) => !p.out);

  const { sb, bb } = blinds(s.level);
  s.currentBet = 0;
  s.minRaise = bb;

  const headsUp = seats.length === 2;
  const sbIdx = headsUp ? s.dealer : nextIdx(s, s.dealer, (p) => !p.out);
  const bbIdx = nextIdx(s, sbIdx, (p) => !p.out);

  postBlind(s, sbIdx, sb, "SB");
  postBlind(s, bbIdx, bb, "BB");
  s.currentBet = Math.max(bb, s.players[sbIdx].bet, s.players[bbIdx].bet);

  // kaarten delen
  for (let round = 0; round < 2; round++) {
    let idx = s.dealer;
    for (let i = 0; i < seats.length; i++) {
      idx = nextIdx(s, idx, (p) => !p.out);
      const card = s.deck.pop();
      if (card) s.players[idx].hole.push(card);
    }
  }

  s.stage = "preflop";
  s.turn = nextIdx(s, bbIdx, canAct);
  if (s.turn === -1) s.turn = -1;

  pushLog(s, `— Hand ${s.handNo} · blinds ${sb}/${bb} —`, "street");
  return s;
}

function postBlind(s: GameState, idx: number, amount: number, label: string) {
  const p = s.players[idx];
  const amt = Math.min(amount, p.chips);
  p.chips -= amt;
  p.bet += amt;
  p.committed += amt;
  if (p.chips === 0) p.allIn = true;
  p.lastAction = label;
}

/* ---------- legale acties ---------- */

export type Legal = {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  potIfCall: number;
};

export function legal(s: GameState, idx: number): Legal {
  const p = s.players[idx];
  const toCall = Math.min(Math.max(0, s.currentBet - p.bet), p.chips);
  const maxRaiseTo = p.bet + p.chips;
  const minRaiseTo = Math.min(maxRaiseTo, s.currentBet + s.minRaise);
  return {
    toCall,
    canCheck: s.currentBet - p.bet <= 0,
    canRaise: maxRaiseTo > s.currentBet,
    minRaiseTo,
    maxRaiseTo,
    potIfCall: totalPot(s) + toCall,
  };
}

/* ---------- actie toepassen ---------- */

export function applyAction(prev: GameState, idx: number, action: Action): GameState {
  const s = clone(prev);
  const p = s.players[idx];
  if (!p || !canAct(p)) return s;

  const l = legal(s, idx);

  // --- meelezen: wat leert de tafel van deze actie? ---
  const bbNow = blinds(s.level).bb;
  // preflop telt alleen een échte verhoging boven de big blind
  const facingRaise =
    l.toCall > 0 && (s.stage !== "preflop" || s.currentBet > bbNow);
  const putsInMoney =
    action.kind === "raise" || action.kind === "allin" || (action.kind === "call" && l.toCall > 0);
  p.read.actions += 1;
  if (facingRaise) p.read.facedRaise += 1;
  if (action.kind === "fold" && facingRaise) p.read.foldToRaise += 1;
  if (putsInMoney && !p.vpipThisHand) {
    p.vpipThisHand = true;
    p.read.vpip += 1;
  }
  if (action.kind === "raise" || action.kind === "allin") p.read.raises += 1;

  if (action.kind === "fold") {
    p.folded = true;
    p.hasActed = true;
    p.lastAction = "Fold";
    pushLog(s, `${p.name} folded.`);
  } else if (action.kind === "check") {
    p.hasActed = true;
    p.lastAction = "Check";
    pushLog(s, `${p.name} checkt.`);
  } else if (action.kind === "call") {
    const amt = l.toCall;
    p.chips -= amt;
    p.bet += amt;
    p.committed += amt;
    p.hasActed = true;
    if (p.chips === 0) {
      p.allIn = true;
      p.lastAction = "All-in";
      pushLog(s, `${p.name} gaat all-in met ${p.bet}.`);
    } else {
      p.lastAction = amt === 0 ? "Check" : `Call ${amt}`;
      pushLog(s, amt === 0 ? `${p.name} checkt.` : `${p.name} callt ${amt}.`);
    }
  } else {
    // raise / all-in: `amount` is het totaalbedrag waar we naartoe gaan
    let target = Math.round(action.amount ?? l.minRaiseTo);
    if (action.kind === "allin") target = l.maxRaiseTo;
    target = Math.max(Math.min(target, l.maxRaiseTo), Math.min(l.minRaiseTo, l.maxRaiseTo));

    const amt = target - p.bet;
    const fullRaise = target >= s.currentBet + s.minRaise;
    const wasOpen = s.currentBet === 0;

    p.chips -= amt;
    p.bet = target;
    p.committed += amt;
    p.hasActed = true;
    if (p.chips === 0) p.allIn = true;

    if (target > s.currentBet) {
      if (fullRaise) s.minRaise = target - s.currentBet;
      s.currentBet = target;
      s.lastAggressor = idx;
      // inzetronde heropenen voor iedereen die nog kan handelen
      if (fullRaise) {
        for (const o of s.players) if (o.id !== p.id && canAct(o)) o.hasActed = false;
      }
    }

    if (p.allIn) {
      p.lastAction = "All-in";
      pushLog(s, `${p.name} gaat ALL-IN met ${target}.`);
    } else if (wasOpen) {
      p.lastAction = `Bet ${target}`;
      pushLog(s, `${p.name} bet ${target}.`);
    } else {
      p.lastAction = `Raise ${target}`;
      pushLog(s, `${p.name} verhoogt naar ${target}.`);
    }
  }

  s.turn = nextIdx(s, idx, canAct);
  return s;
}

/* ---------- ronde-einde ---------- */

export function roundOver(s: GameState): boolean {
  const live = livePlayers(s);
  if (live.length <= 1) return true;
  const actionable = live.filter((p) => !p.allIn);
  if (actionable.length === 0) return true;
  if (actionable.length === 1) {
    const p = actionable[0];
    // enkel nog één speler die kan handelen: klaar zodra die gematcht heeft
    return p.hasActed && p.bet >= s.currentBet;
  }
  return actionable.every((p) => p.hasActed && p.bet === s.currentBet);
}

/** Iedereen behalve één speler is gefold. */
export function handEndedByFolds(s: GameState): boolean {
  return livePlayers(s).length <= 1;
}

/** Geen inzetten meer mogelijk: kaarten gewoon uitdelen. */
export function isRunout(s: GameState): boolean {
  return livePlayers(s).filter((p) => !p.allIn).length <= 1 && !handEndedByFolds(s);
}

export function collectBets(prev: GameState): GameState {
  const s = clone(prev);
  for (const p of s.players) {
    s.pot += p.bet;
    p.bet = 0;
    p.hasActed = false;
    if (p.lastAction !== "All-in") p.lastAction = null;
  }
  s.currentBet = 0;
  s.minRaise = blinds(s.level).bb;
  s.collecting = false;
  return s;
}

const NEXT_STAGE: Record<string, Stage> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: "showdown",
};

export function advanceStreet(prev: GameState): GameState {
  const s = clone(prev);
  const next = NEXT_STAGE[s.stage] ?? "showdown";
  s.stage = next;
  s.dealToken += 1;

  if (next === "flop") {
    s.deck.pop();
    for (let i = 0; i < 3; i++) {
      const c = s.deck.pop();
      if (c) s.board.push(c);
    }
    pushLog(s, `Flop: ${s.board.map(cardLabel).join(" ")}`, "street");
  } else if (next === "turn" || next === "river") {
    s.deck.pop();
    const c = s.deck.pop();
    if (c) s.board.push(c);
    pushLog(s, next === "turn" ? "Turn." : "River.", "street");
  }

  if (next !== "showdown") {
    s.turn = isRunout(s) ? -1 : nextIdx(s, s.dealer, canAct);
  } else {
    s.turn = -1;
  }
  return s;
}

/* ---------- showdown & side pots ---------- */

export function resolve(prev: GameState): GameState {
  const s = clone(prev);
  const live = livePlayers(s);
  const showdown = live.length > 1;

  const hands: Record<number, { name: string; best: string[] }> = {};
  const results = new Map<number, HandResult>();

  if (showdown) {
    for (const p of live) {
      const r = evaluate([...p.hole, ...s.board]);
      results.set(p.id, r);
      hands[p.id] = { name: r.name, best: r.best.map((c) => c.id) };
      p.read.showdowns += 1;
    }
  }

  // side pots opbouwen uit de totale inzetten
  const contributions = s.players.map((p) => p.committed);
  const levels = Array.from(new Set(contributions.filter((c) => c > 0))).sort((a, b) => a - b);

  const awards: PotAward[] = [];
  let prevLevel = 0;
  for (let li = 0; li < levels.length; li++) {
    const lvl = levels[li];
    let amount = 0;
    for (const p of s.players) {
      amount += Math.min(p.committed, lvl) - Math.min(p.committed, prevLevel);
    }
    prevLevel = lvl;
    if (amount <= 0) continue;

    const eligible = live.filter((p) => p.committed >= lvl);
    if (eligible.length === 0) {
      // niemand meer over: geef terug aan de laatste bijdrager
      const back = s.players.find((p) => p.committed >= lvl);
      if (back) {
        back.chips += amount;
        back.delta += amount;
      }
      continue;
    }

    let winners: Player[];
    if (!showdown) {
      winners = eligible;
    } else {
      let best = -1;
      winners = [];
      for (const p of eligible) {
        const sc = results.get(p.id)?.score ?? -1;
        if (sc > best) {
          best = sc;
          winners = [p];
        } else if (sc === best) {
          winners.push(p);
        }
      }
    }

    const share = Math.floor(amount / winners.length);
    let rest = amount - share * winners.length;
    for (const w of winners) {
      let give = share;
      if (rest > 0) {
        give += 1;
        rest -= 1;
      }
      w.chips += give;
      w.delta += give;
    }
    awards.push({ amount, winners: winners.map((w) => w.id), side: li > 0 });
  }

  for (const p of s.players) p.delta -= p.committed;

  // een dure verloren pot maakt een speler tijdelijk agressiever
  for (const p of s.players) {
    const stackBefore = p.chips - p.delta;
    if (stackBefore <= 0) continue;
    const loss = -p.delta / stackBefore;
    if (loss > 0.22) p.heat = Math.min(1, p.heat + 0.25 + loss * 0.5);
    else if (p.delta > 0) p.heat = p.heat * 0.4;
  }

  const winnerIds = Array.from(new Set(awards.flatMap((a) => a.winners)));
  s.winnerIds = winnerIds;

  const mainWinner = s.players.find((p) => p.id === winnerIds[0]);
  let headline: string;
  if (!showdown) {
    headline = `${mainWinner?.name ?? "?"} wint de pot — iedereen foldde.`;
  } else if (winnerIds.length > 1) {
    headline = `Split pot: ${winnerIds
      .map((id) => s.players.find((p) => p.id === id)?.name)
      .join(" & ")}`;
  } else {
    headline = `${mainWinner?.name ?? "?"} wint met ${hands[winnerIds[0]]?.name ?? "de beste hand"}.`;
  }

  s.highlight = showdown && winnerIds.length ? hands[winnerIds[0]]?.best ?? [] : [];
  s.outcome = { awards, showdown, hands, headline };
  s.pot = 0;
  s.stage = "handover";
  s.turn = -1;
  pushLog(s, headline, "win");

  // uitgeschakelde spelers een plaats geven
  const survivors = s.players.filter((p) => p.chips > 0).length;
  for (const p of s.players) {
    if (p.chips <= 0 && p.place === null) p.place = survivors + 1;
  }

  return s;
}

export function heroHandName(s: GameState): string | null {
  const hero = s.players[0];
  if (!hero || hero.hole.length < 2) return null;
  if (s.board.length < 3) return null;
  return evaluate([...hero.hole, ...s.board]).name;
}
