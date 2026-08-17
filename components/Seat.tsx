"use client";

import { Player } from "@/lib/engine";
import PlayingCard from "./PlayingCard";

type Props = {
  player: Player;
  pos: { x: number; y: number };
  isTurn: boolean;
  isDealer: boolean;
  revealCards: boolean;
  isWinner: boolean;
  highlight: string[];
  dealToken: number;
  thinkMs: number;
  /** tafelpraat van deze speler, of null */
  says: string | null;
};

export default function Seat({
  player: p,
  pos,
  isTurn,
  isDealer,
  revealCards,
  isWinner,
  highlight,
  dealToken,
  thinkMs,
  says,
}: Props) {
  const showFace = p.human || revealCards;
  const cls = [
    "seat",
    p.human ? "seat-hero" : "",
    isTurn ? "seat-turn" : "",
    p.folded ? "seat-folded" : "",
    p.out ? "seat-out" : "",
    isWinner ? "seat-winner" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
      {p.hole.length > 0 && !p.out && (
        <div className="seat-cards" key={dealToken}>
          {p.hole.map((c, i) => (
            <PlayingCard
              key={c.id}
              card={c}
              faceUp={showFace}
              delay={i * 90 + (p.human ? 120 : 0)}
              size={p.human ? "md" : "sm"}
              highlight={revealCards && highlight.includes(c.id)}
              dim={p.folded}
              className="seat-card"
            />
          ))}
        </div>
      )}

      <div className="seat-box">
        <div
          className="seat-av"
          style={{ ["--seat-color" as string]: p.color }}
          aria-hidden
        >
          <span>{p.avatar}</span>
          {isDealer && <span className="seat-dealer">D</span>}
        </div>
        <div className="seat-meta">
          <div className="seat-name">{p.name}</div>
          <div className="seat-chips">
            {p.out ? "uit" : p.chips.toLocaleString("nl-BE")}
          </div>
        </div>
        {isTurn && (
          <div className="seat-timer">
            <span style={{ animationDuration: `${thinkMs}ms` }} />
          </div>
        )}
      </div>

      {says && (
        <div className="seat-says" key={says}>
          {says}
        </div>
      )}

      {p.lastAction && !p.out && (
        <div className={`seat-bubble ${p.lastAction === "Fold" ? "is-fold" : ""}`}>
          {p.lastAction}
        </div>
      )}

      {p.delta !== 0 && (
        <div className={`seat-delta ${p.delta > 0 ? "up" : "down"}`}>
          {p.delta > 0 ? "+" : ""}
          {p.delta.toLocaleString("nl-BE")}
        </div>
      )}
    </div>
  );
}
