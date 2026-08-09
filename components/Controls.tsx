"use client";

import { useEffect, useMemo, useState } from "react";
import { Action, Legal } from "@/lib/engine";

type Props = {
  legal: Legal;
  pot: number;
  bb: number;
  heroBet: number;
  active: boolean;
  onAction: (a: Action) => void;
};

export default function Controls({ legal, pot, bb, heroBet, active, onAction }: Props) {
  const { toCall, canCheck, canRaise, minRaiseTo, maxRaiseTo } = legal;
  const [target, setTarget] = useState(minRaiseTo);

  useEffect(() => {
    if (active) setTarget(Math.min(Math.max(minRaiseTo, Math.round(pot * 0.6)), maxRaiseTo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, minRaiseTo, maxRaiseTo]);

  const presets = useMemo(() => {
    const list: { label: string; value: number }[] = [
      { label: "½ pot", value: Math.round(pot * 0.5) + toCall + heroBet },
      { label: "¾ pot", value: Math.round(pot * 0.75) + toCall + heroBet },
      { label: "Pot", value: pot + toCall + heroBet },
      { label: "All-in", value: maxRaiseTo },
    ];
    return list
      .map((p) => ({ ...p, value: Math.min(Math.max(p.value, minRaiseTo), maxRaiseTo) }))
      .filter((p, i, arr) => arr.findIndex((x) => x.value === p.value) === i);
  }, [pot, toCall, heroBet, minRaiseTo, maxRaiseTo]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
      const k = e.key.toLowerCase();
      if (k === "f") onAction({ kind: "fold" });
      else if (k === "c") onAction(canCheck ? { kind: "check" } : { kind: "call" });
      else if (k === "r" && canRaise) onAction({ kind: "raise", amount: target });
      else if (k === "a" && canRaise) onAction({ kind: "allin", amount: maxRaiseTo });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, canCheck, canRaise, target, maxRaiseTo, onAction]);

  const isAllInRaise = target >= maxRaiseTo;
  const potOdds = toCall > 0 ? Math.round((toCall / (pot + toCall)) * 100) : 0;

  return (
    <div className={`controls ${active ? "" : "controls-off"}`}>
      {canRaise && (
        <div className="raise-row">
          <div className="raise-presets">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`preset ${target === p.value ? "on" : ""}`}
                onClick={() => setTarget(p.value)}
                disabled={!active}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="raise-slider">
            <input
              type="range"
              min={minRaiseTo}
              max={maxRaiseTo}
              step={Math.max(5, Math.floor(bb / 2))}
              value={Math.min(Math.max(target, minRaiseTo), maxRaiseTo)}
              onChange={(e) => setTarget(Number(e.target.value))}
              disabled={!active}
              aria-label="Inzet"
            />
            <output className="raise-value">{target.toLocaleString("nl-BE")}</output>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-fold"
          onClick={() => onAction({ kind: "fold" })}
          disabled={!active}
        >
          <span className="btn-main">Fold</span>
          <span className="btn-sub">F</span>
        </button>

        <button
          type="button"
          className="btn btn-call"
          onClick={() => onAction(canCheck ? { kind: "check" } : { kind: "call" })}
          disabled={!active}
        >
          <span className="btn-main">
            {canCheck ? "Check" : toCall >= legal.maxRaiseTo - heroBet ? "Call all-in" : "Call"}
          </span>
          <span className="btn-sub">
            {canCheck ? "C" : `${toCall.toLocaleString("nl-BE")} · ${potOdds}%`}
          </span>
        </button>

        <button
          type="button"
          className={`btn btn-raise ${isAllInRaise ? "btn-allin" : ""}`}
          onClick={() =>
            onAction(isAllInRaise ? { kind: "allin", amount: maxRaiseTo } : { kind: "raise", amount: target })
          }
          disabled={!active || !canRaise}
        >
          <span className="btn-main">{isAllInRaise ? "ALL-IN" : toCall > 0 ? "Raise" : "Bet"}</span>
          <span className="btn-sub">{target.toLocaleString("nl-BE")}</span>
        </button>
      </div>
    </div>
  );
}
