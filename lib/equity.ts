import { Card, FULL_DECK } from "./cards";
import { score7 } from "./evaluator";

/**
 * Monte-Carlo schatting van de winkans van `hole` tegen `opponents`
 * willekeurige handen, gegeven de huidige `board`.
 * Geeft een waarde tussen 0 en 1 (gelijkspel telt half mee).
 */
export function equity(
  hole: Card[],
  board: Card[],
  opponents: number,
  sims = 260
): number {
  if (opponents <= 0) return 1;
  const dead = new Set<string>();
  for (const c of hole) dead.add(c.id);
  for (const c of board) dead.add(c.id);

  const stock = FULL_DECK.filter((c) => !dead.has(c.id));
  const needBoard = 5 - board.length;
  const need = needBoard + opponents * 2;

  let win = 0;
  let tie = 0;
  const d = stock.slice();

  for (let i = 0; i < sims; i++) {
    // gedeeltelijke Fisher-Yates: alleen de kaarten die we nodig hebben
    for (let j = 0; j < need; j++) {
      const k = j + Math.floor(Math.random() * (d.length - j));
      const t = d[j];
      d[j] = d[k];
      d[k] = t;
    }
    const comm = board.concat(d.slice(0, needBoard));
    const mine = score7([hole[0], hole[1], comm[0], comm[1], comm[2], comm[3], comm[4]]);

    let bestOpp = -1;
    let p = needBoard;
    for (let o = 0; o < opponents; o++) {
      const s = score7([d[p], d[p + 1], comm[0], comm[1], comm[2], comm[3], comm[4]]);
      p += 2;
      if (s > bestOpp) bestOpp = s;
    }
    if (mine > bestOpp) win++;
    else if (mine === bestOpp) tie++;
  }
  return (win + tie * 0.5) / sims;
}

/**
 * Winkansen wanneer álle handen bekend zijn en er alleen nog board moet komen,
 * zoals bij een all-in die uitgerold wordt. Met één of twee kaarten te gaan
 * tellen we elke mogelijkheid uit (exact); met vijf schatten we.
 * Gelijkspel telt evenredig mee.
 */
export function runoutEquities(hands: Card[][], board: Card[]): number[] {
  const n = hands.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0) return out;
  if (n === 1) {
    out[0] = 1;
    return out;
  }

  const dead = new Set<string>();
  for (const h of hands) for (const c of h) dead.add(c.id);
  for (const c of board) dead.add(c.id);
  const stock = FULL_DECK.filter((c) => !dead.has(c.id));
  const need = 5 - board.length;

  let total = 0;
  const tally = (comm: Card[]) => {
    let best = -1;
    let winners: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = hands[i];
      const s = score7([h[0], h[1], comm[0], comm[1], comm[2], comm[3], comm[4]]);
      if (s > best) {
        best = s;
        winners = [i];
      } else if (s === best) {
        winners.push(i);
      }
    }
    const share = 1 / winners.length;
    for (const w of winners) out[w] += share;
    total++;
  };

  if (need <= 0) {
    tally(board);
  } else if (need === 1) {
    for (const c of stock) tally([...board, c]);
  } else if (need === 2) {
    for (let i = 0; i < stock.length; i++) {
      for (let j = i + 1; j < stock.length; j++) tally([...board, stock[i], stock[j]]);
    }
  } else {
    // preflop all-in: vijf kaarten te gaan, uittellen is te duur
    const d = stock.slice();
    for (let s = 0; s < 2000; s++) {
      for (let j = 0; j < need; j++) {
        const k = j + Math.floor(Math.random() * (d.length - j));
        const t = d[j];
        d[j] = d[k];
        d[k] = t;
      }
      tally(board.concat(d.slice(0, need)));
    }
  }

  return out.map((v) => v / Math.max(1, total));
}
