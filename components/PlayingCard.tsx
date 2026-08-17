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
 * Bewust géén volledig pip-raster: op tafelformaat wordt een kaart met tien
 * kleine symbolen rommelig. Eén grote suit in het midden leest rustiger en
 * blijft ook klein nog herkenbaar.
 */
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
              <span className="pc-rule" aria-hidden />
              <span className="pc-corner pc-tl">
                <b>{RANK_LABEL[card.r]}</b>
                <i>{SUIT_GLYPH[card.s]}</i>
              </span>
              <span className="pc-pip">{SUIT_GLYPH[card.s]}</span>
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
