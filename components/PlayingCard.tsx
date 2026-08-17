"use client";

import { Card, RANK_LABEL, SUIT_GLYPH, isRed } from "@/lib/cards";

type Props = {
  card?: Card | null;
  faceUp: boolean;
  /** vertraging voor de deal-animatie in ms */
  delay?: number;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
  dim?: boolean;
  className?: string;
};

/**
 * Pip-posities als [kolom, rij] in een raster van 3 × 9.
 * Rij 1 = boven, 5 = midden, 9 = onder. Alles onder rij 5 staat op zijn kop,
 * precies zoals op een echte kaart.
 */
const PIPS: Record<number, [number, number][]> = {
  2: [
    [2, 1],
    [2, 9],
  ],
  3: [
    [2, 1],
    [2, 5],
    [2, 9],
  ],
  4: [
    [1, 1],
    [3, 1],
    [1, 9],
    [3, 9],
  ],
  5: [
    [1, 1],
    [3, 1],
    [2, 5],
    [1, 9],
    [3, 9],
  ],
  6: [
    [1, 1],
    [3, 1],
    [1, 5],
    [3, 5],
    [1, 9],
    [3, 9],
  ],
  7: [
    [1, 1],
    [3, 1],
    [2, 3],
    [1, 5],
    [3, 5],
    [1, 9],
    [3, 9],
  ],
  8: [
    [1, 1],
    [3, 1],
    [2, 3],
    [1, 5],
    [3, 5],
    [2, 7],
    [1, 9],
    [3, 9],
  ],
  9: [
    [1, 1],
    [3, 1],
    [1, 3],
    [3, 3],
    [2, 5],
    [1, 7],
    [3, 7],
    [1, 9],
    [3, 9],
  ],
  10: [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
    [1, 7],
    [3, 7],
    [2, 8],
    [1, 9],
    [3, 9],
  ],
};

function CardFace({ card }: { card: Card }) {
  const glyph = SUIT_GLYPH[card.s];
  const pips = PIPS[card.r];

  if (pips) {
    return (
      <span className="pc-pips">
        {pips.map(([col, row], i) => (
          <span
            key={i}
            className={`pc-pip-cell ${row > 5 ? "flip" : ""}`}
            style={{ gridColumn: col, gridRow: row }}
          >
            {glyph}
          </span>
        ))}
      </span>
    );
  }

  if (card.r === 14) {
    return <span className="pc-ace">{glyph}</span>;
  }

  // boer, dame, heer: een net monogram in plaats van een half getekende figuur
  return (
    <span className="pc-court">
      <span className="pc-court-frame" aria-hidden />
      <b>{RANK_LABEL[card.r]}</b>
      <i>{glyph}</i>
    </span>
  );
}

export default function PlayingCard({
  card,
  faceUp,
  delay = 0,
  size = "md",
  highlight = false,
  dim = false,
  className = "",
}: Props) {
  const showFace = faceUp && !!card;
  const red = card ? isRed(card.s) : false;

  return (
    <div
      className={[
        "pc",
        `pc-${size}`,
        showFace ? "pc-up" : "",
        highlight ? "pc-hi" : "",
        dim ? "pc-dim" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ animationDelay: `${delay}ms`, ["--pc-delay" as string]: `${delay}ms` }}
    >
      <div className="pc-inner">
        <div className={`pc-face pc-front ${red ? "pc-red" : "pc-black"}`}>
          {card ? (
            <>
              <span className="pc-corner pc-tl">
                <b>{RANK_LABEL[card.r]}</b>
                <i>{SUIT_GLYPH[card.s]}</i>
              </span>
              <CardFace card={card} />
              <span className="pc-corner pc-br">
                <b>{RANK_LABEL[card.r]}</b>
                <i>{SUIT_GLYPH[card.s]}</i>
              </span>
            </>
          ) : null}
        </div>
        <div className="pc-face pc-back">
          <div className="pc-back-art">
            <span>♠</span>
          </div>
        </div>
      </div>
    </div>
  );
}
