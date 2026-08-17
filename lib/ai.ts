import { Action, GameState, Player, Read, blinds, legal, livePlayers } from "./engine";
import { equity } from "./equity";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function roundChips(v: number, step: number) {
  return Math.max(step, Math.round(v / step) * step);
}

/** Bouwt een raise-actie naar `target` totaalinzet, netjes geklemd. */
function raiseTo(s: GameState, idx: number, target: number): Action {
  const l = legal(s, idx);
  const step = Math.max(5, Math.floor(blinds(s.level).bb / 2));
  let t = clamp(roundChips(target, step), l.minRaiseTo, l.maxRaiseTo);
  // bijna alles in de pot? Dan meteen all-in, dat speelt lekkerder.
  if (t >= l.maxRaiseTo * 0.82) t = l.maxRaiseTo;
  if (t >= l.maxRaiseTo) return { kind: "allin", amount: l.maxRaiseTo };
  return { kind: "raise", amount: t };
}

export type Profile = {
  /** hoeveel handen dit oordeel steunt */
  sample: number;
  /** 0..1, aandeel handen waarin hij vrijwillig meedoet */
  loose: number;
  /** 0..1, aandeel acties dat een verhoging is */
  aggro: number;
  /** 0..1, hoe vaak hij foldt als er verhoogd wordt */
  foldy: number;
};

export function profileOf(r: Read): Profile {
  const hands = Math.max(1, r.hands);
  return {
    sample: r.hands,
    loose: r.vpip / hands,
    aggro: r.raises / Math.max(1, r.actions),
    foldy: r.facedRaise >= 3 ? r.foldToRaise / r.facedRaise : 0.45,
  };
}

/** De speler op wie deze beslissing zich richt: de laatste verhoger, anders
 *  de gevaarlijkste tegenstander die nog meedoet. */
function opponentInFocus(s: GameState, idx: number): Player {
  const live = livePlayers(s).filter((p) => p.id !== s.players[idx].id);
  if (s.lastAggressor != null && s.lastAggressor !== idx) {
    const a = s.players[s.lastAggressor];
    if (a && !a.folded && !a.out) return a;
  }
  const human = live.find((p) => p.human);
  if (human) return human;
  return live.reduce((best, p) => (p.chips > best.chips ? p : best), live[0] ?? s.players[idx]);
}

/**
 * Beslissing van een bot. Combineert een Monte-Carlo winkans met pot odds,
 * het karakter van de bot, wat hij over zijn tegenstander geleerd heeft, en
 * hoeveel frustratie er nog nasmeult van de vorige hand.
 */
export function botDecide(s: GameState, idx: number, out?: BotInsight): Action {
  const p = s.players[idx];
  const l = legal(s, idx);
  const live = livePlayers(s).length;
  const opponents = Math.max(1, live - 1);
  const bb = blinds(s.level).bb;
  const skill = s.config?.skill ?? 1;

  const sims = Math.round((s.stage === "preflop" ? 150 : 260) * skill);
  const eq = equity(p.hole, s.board, opponents, Math.max(60, sims));
  /** 1.0 = gemiddelde hand voor dit aantal spelers */
  const norm = eq * live;
  if (out) {
    out.eq = eq;
    out.norm = norm;
  }

  const pot = s.pot + s.players.reduce((a, x) => a + x.bet, 0);
  const toCall = l.toCall;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const r = Math.random();

  /* --- karakter, aangepast aan de tegenstander en aan de eigen frustratie --- */
  const foe = opponentInFocus(s, idx);
  const pr = profileOf(foe.read);
  const trust = Math.min(1, pr.sample / 10);

  // tegen iemand die snel weglegt loont bluffen; tegen een station niet
  const bluffBoost = clamp(1 + trust * (pr.foldy - 0.45) * 1.8, 0.35, 2.1);
  /** > 0 = deze tegenstander legt te vaak weg, dus er valt druk te zetten */
  const pressure = trust * (pr.foldy - 0.48);
  // een agressieve tegenstander bluft vaker, dus zijn bet betekent minder
  const aggroCredit = trust * (pr.aggro - 0.2) * 0.14;
  // een losse tegenstander heeft een bredere range, dus jij mag lichter callen
  const looseCredit = trust * (pr.loose - 0.38) * 0.1;
  const eqAdj = clamp(eq + aggroCredit + looseCredit, 0, 1);

  const heat = p.heat;
  const aggression = clamp(p.personality.aggression + heat * 0.3, 0, 1);
  const bluff = clamp(p.personality.bluff * bluffBoost + heat * 0.2, 0, 0.9);
  const tightness = clamp(p.personality.tightness - heat * 0.25, 0, 1);
  // scherpere bots hebben minder veiligheidsmarge nodig
  const margin = (tightness - 0.5) * 0.09 - (skill - 1) * 0.04;

  /* --- korte stack: push-or-fold --- */
  const stackBB = (p.chips + p.bet) / bb;
  if (stackBB <= 11 && s.stage === "preflop" && l.canRaise) {
    const pushLine = 1.15 + tightness * 0.45 - (11 - stackBB) * 0.045;
    if (norm > pushLine) return { kind: "allin", amount: l.maxRaiseTo };
  }

  /* --- niemand heeft ingezet --- */
  if (toCall === 0) {
    if (!l.canRaise) return { kind: "check" };
    let betChance: number;
    if (norm > 1.75) betChance = 0.55 + aggression * 0.45;
    else if (norm > 1.25) betChance = aggression * 0.6 + pressure * 0.5;
    else if (norm < 0.8) betChance = bluff * 0.55 + pressure * 0.8;
    else betChance = aggression * 0.25 + pressure * 0.65;
    betChance = clamp(betChance, 0.02, 0.95);

    if (r < betChance) {
      const frac = norm > 1.75 ? 0.7 : norm < 0.8 ? 0.55 : 0.5;
      const base = s.stage === "preflop" ? bb * (2.2 + aggression) : pot * frac;
      return raiseTo(s, idx, s.currentBet + Math.max(bb, base));
    }
    return { kind: "check" };
  }

  /* --- er staat een inzet --- */
  const commitFrac = toCall / Math.max(1, p.chips + p.bet);

  // monsterhand: bijna altijd verhogen
  if (norm > 2.1 && l.canRaise && r < 0.45 + aggression * 0.5) {
    return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.8));
  }

  // sterke hand: value raise of call
  if (norm > 1.5) {
    if (l.canRaise && r < aggression * 0.45) {
      return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.6));
    }
    return { kind: "call" };
  }

  // genoeg equity voor de pot odds
  if (eqAdj > potOdds + 0.045 + margin) {
    if (l.canRaise && norm > 1.2 && r < aggression * 0.28) {
      return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.55));
    }
    return { kind: "call" };
  }

  // grensgeval
  if (eqAdj > potOdds - 0.02 && commitFrac < 0.35) {
    return r < 0.55 - tightness * 0.25 ? { kind: "call" } : { kind: "fold" };
  }

  // zwak: soms bluffen tegen een kleine inzet
  const bluffRaise = clamp(bluff * 0.3 + pressure * 0.45, 0, 0.55);
  if (l.canRaise && toCall < pot * 0.55 && r < bluffRaise) {
    return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.7));
  }

  // spotcall voor een habbekrats
  if (toCall <= bb && eqAdj > 0.2 && r < 0.4) return { kind: "call" };

  return { kind: "fold" };
}

/** Denk-tijd zodat het menselijk aanvoelt. */
export function botDelay(stage: GameState["stage"], speed = 1): number {
  const base = stage === "preflop" ? 550 : 750;
  return (base + Math.random() * 700) / speed;
}

/** Wat de bot dacht toen hij besloot — voor de tafelpraat. */
export type BotInsight = { eq: number; norm: number };
