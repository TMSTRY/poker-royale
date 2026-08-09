import { Action, GameState, blinds, legal, livePlayers } from "./engine";
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

/**
 * Beslissing van een bot. Combineert een Monte-Carlo winkans met
 * pot odds en een beetje karakter (agressie, bluf, tightness).
 */
export function botDecide(s: GameState, idx: number): Action {
  const p = s.players[idx];
  const l = legal(s, idx);
  const live = livePlayers(s).length;
  const opponents = Math.max(1, live - 1);
  const bb = blinds(s.level).bb;

  const sims = s.stage === "preflop" ? 180 : 320;
  const eq = equity(p.hole, s.board, opponents, sims);
  /** 1.0 = gemiddelde hand voor dit aantal spelers */
  const norm = eq * live;

  const pot = s.pot + s.players.reduce((a, x) => a + x.bet, 0);
  const toCall = l.toCall;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const r = Math.random();
  const pers = p.personality;
  const margin = (pers.tightness - 0.5) * 0.09;

  // korte stack: push-or-fold
  const stackBB = (p.chips + p.bet) / bb;
  if (stackBB <= 11 && s.stage === "preflop" && l.canRaise) {
    const pushLine = 1.15 + pers.tightness * 0.45 - (11 - stackBB) * 0.045;
    if (norm > pushLine) return { kind: "allin", amount: l.maxRaiseTo };
  }

  /* --- niemand heeft ingezet --- */
  if (toCall === 0) {
    if (!l.canRaise) return { kind: "check" };
    let betChance: number;
    if (norm > 1.75) betChance = 0.55 + pers.aggression * 0.45;
    else if (norm > 1.25) betChance = pers.aggression * 0.6;
    else if (norm < 0.8) betChance = pers.bluff * 0.55;
    else betChance = pers.aggression * 0.25;

    if (r < betChance) {
      const frac = norm > 1.75 ? 0.7 : norm < 0.8 ? 0.55 : 0.5;
      const base = s.stage === "preflop" ? bb * (2.2 + pers.aggression) : pot * frac;
      return raiseTo(s, idx, s.currentBet + Math.max(bb, base));
    }
    return { kind: "check" };
  }

  /* --- er staat een inzet --- */
  const commitFrac = toCall / Math.max(1, p.chips + p.bet);

  // monsterhand: bijna altijd verhogen
  if (norm > 2.1 && l.canRaise && r < 0.45 + pers.aggression * 0.5) {
    return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.8));
  }

  // sterke hand: value raise of call
  if (norm > 1.5) {
    if (l.canRaise && r < pers.aggression * 0.45) {
      return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.6));
    }
    return { kind: "call" };
  }

  // genoeg equity voor de pot odds
  if (eq > potOdds + 0.045 + margin) {
    if (l.canRaise && norm > 1.2 && r < pers.aggression * 0.28) {
      return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.55));
    }
    return { kind: "call" };
  }

  // grensgeval
  if (eq > potOdds - 0.02 && commitFrac < 0.35) {
    return r < 0.55 - pers.tightness * 0.25 ? { kind: "call" } : { kind: "fold" };
  }

  // zwak: soms bluffen tegen een kleine inzet
  if (l.canRaise && toCall < pot * 0.55 && r < pers.bluff * 0.3) {
    return raiseTo(s, idx, s.currentBet + Math.max(bb * 2, pot * 0.7));
  }

  // spotcall voor een habbekrats
  if (toCall <= bb && eq > 0.2 && r < 0.4) return { kind: "call" };

  return { kind: "fold" };
}

/** Denk-tijd zodat het menselijk aanvoelt. */
export function botDelay(stage: GameState["stage"]): number {
  const base = stage === "preflop" ? 550 : 750;
  return base + Math.random() * 700;
}
