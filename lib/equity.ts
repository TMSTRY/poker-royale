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
