export type CoachStage = "preflop" | "flop" | "turn" | "river";

export type Decision = {
  stage: CoachStage;
  /** winkans 0..1 op het moment van beslissen */
  eq: number;
  /** benodigde winkans om te callen, 0..1 */
  potOdds: number;
  toCall: number;
  pot: number;
  kind: "fold" | "check" | "call" | "raise" | "allin";
  amount: number;
  opponents: number;
};

export type CoachNote = { tone: "good" | "bad" | "info"; text: string };

const STAGE_NL: Record<CoachStage, string> = {
  preflop: "preflop",
  flop: "de flop",
  turn: "de turn",
  river: "de river",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const chips = (v: number) => v.toLocaleString("nl-BE");

/**
 * Kiest de leerzaamste beslissing van de hand en zet er één zin over.
 * Geeft null als er niets opvallends te melden was.
 */
export function coachNote(decisions: Decision[]): CoachNote | null {
  const scored: { sev: number; note: CoachNote }[] = [];

  for (const d of decisions) {
    const s = STAGE_NL[d.stage];
    const gap = d.eq - d.potOdds;

    if (d.kind === "fold" && d.toCall > 0) {
      if (gap > 0.07) {
        scored.push({
          sev: 1.5 + gap * 3,
          note: {
            tone: "bad",
            text: `Je foldde op ${s} met ${pct(d.eq)} winkans, terwijl ${pct(
              d.potOdds
            )} al genoeg was om te callen. Die ${chips(d.toCall)} had je moeten betalen.`,
          },
        });
      } else if (gap < -0.06) {
        scored.push({
          sev: 0.6 - gap,
          note: {
            tone: "good",
            text: `Nette fold op ${s}: ${pct(d.eq)} winkans tegen ${pct(
              d.potOdds
            )} die je nodig had.`,
          },
        });
      }
    }

    if (d.kind === "call" && d.toCall > 0) {
      if (gap < -0.07) {
        scored.push({
          sev: 1.5 - gap * 3,
          note: {
            tone: "bad",
            text: `Je callde ${chips(d.toCall)} op ${s} met maar ${pct(
              d.eq
            )} winkans; daarvoor had je ${pct(d.potOdds)} nodig.`,
          },
        });
      } else if (gap > 0.12) {
        scored.push({
          sev: 0.7 + gap,
          note: {
            tone: "good",
            text: `Goeie call op ${s}: ${pct(d.eq)} winkans tegen ${pct(
              d.potOdds
            )} die je moest halen.`,
          },
        });
      }
    }

    if (d.kind === "check" && d.toCall === 0 && d.eq > 0.7 && d.stage !== "preflop") {
      scored.push({
        sev: 1.1,
        note: {
          tone: "info",
          text: `Je checkte op ${s} met ${pct(
            d.eq
          )} winkans. Daar lag waarde: tegen zo'n hand betaalt een bet zichzelf terug.`,
        },
      });
    }

    if ((d.kind === "raise" || d.kind === "allin") && d.eq < 0.3 && d.pot > 0) {
      scored.push({
        sev: 0.9,
        note: {
          tone: "info",
          text: `Je verhoogde op ${s} met ${pct(
            d.eq
          )} winkans — een bluff dus. Die werkt zolang je hem niet te vaak laat zien.`,
        },
      });
    }

    if (d.kind === "allin" && d.eq > 0.75) {
      scored.push({
        sev: 1.0,
        note: {
          tone: "good",
          text: `All-in op ${s} met ${pct(d.eq)} winkans — precies waarvoor je stack bedoeld is.`,
        },
      });
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.sev - a.sev);
  return scored[0].note;
}
