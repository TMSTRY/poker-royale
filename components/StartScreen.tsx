"use client";

import { useState } from "react";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { dailyLabel, dailySeed } from "@/lib/rng";
import { Progress, Settings, Stats } from "@/lib/stats";
import { STARTING_BANKROLL, TIERS, Tier, isUnlocked, payout } from "@/lib/tiers";
import SettingsFields from "./SettingsFields";

type Props = {
  name: string;
  onName: (n: string) => void;
  stats: Stats;
  progress: Progress;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onStart: (tier: Tier, daily: boolean) => void;
  onTopUp: () => void;
};

type Panel = "tiers" | "stats" | "settings";

const nf = (n: number) => n.toLocaleString("nl-BE");

export default function StartScreen({
  name,
  onName,
  stats,
  progress,
  settings,
  onSettings,
  onStart,
  onTopUp,
}: Props) {
  const [panel, setPanel] = useState<Panel>("tiers");
  const seed = dailySeed();
  const dailyDone = progress.daily?.seed === seed;
  const broke = progress.bankroll < TIERS[0].buyIn;

  return (
    <div className="shell">
      <div className="intro">
        <div className="intro-glow" aria-hidden />
        <h1 className="logo">
          <span className="logo-suit s1">♠</span>
          POKER<span className="logo-accent">ROYALE</span>
          <span className="logo-suit s2">♦</span>
        </h1>
        <p className="tagline">Texas Hold&apos;em · 6 spelers · winner takes all</p>

        <div className="bankroll-bar">
          <div>
            <span>Bankroll</span>
            <b>{nf(progress.bankroll)}</b>
          </div>
          <input
            type="text"
            value={name}
            maxLength={14}
            placeholder="Jouw naam"
            onChange={(e) => onName(e.target.value)}
            aria-label="Jouw naam"
          />
        </div>

        {broke && (
          <div className="broke">
            <p>
              Je bankroll is op. De baas schrijft je nog één keer in voor{" "}
              {nf(STARTING_BANKROLL)}.
            </p>
            <button type="button" className="cta small" onClick={onTopUp}>
              AANNEMEN
            </button>
          </div>
        )}

        <nav className="tabs">
          <button
            type="button"
            className={panel === "tiers" ? "on" : ""}
            onClick={() => setPanel("tiers")}
          >
            Toernooien
          </button>
          <button
            type="button"
            className={panel === "stats" ? "on" : ""}
            onClick={() => setPanel("stats")}
          >
            Palmares
          </button>
          <button
            type="button"
            className={panel === "settings" ? "on" : ""}
            onClick={() => setPanel("settings")}
          >
            Instellingen
          </button>
        </nav>

        {panel === "tiers" && (
          <div className="tier-list">
            {TIERS.map((t) => {
              const open = isUnlocked(t, progress.tiersWon);
              const afford = progress.bankroll >= t.buyIn;
              const won = progress.tiersWon.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`tier ${open && afford ? "" : "locked"} ${won ? "won" : ""}`}
                  disabled={!open || !afford}
                  onClick={() => onStart(t, false)}
                >
                  <span className="tier-icon">{t.icon}</span>
                  <span className="tier-body">
                    <b>
                      {t.name}
                      {won && <em className="tier-badge">gewonnen</em>}
                    </b>
                    <small>{t.venue}</small>
                    <small className="tier-nums">
                      inleg {nf(t.buyIn)} · stack {nf(t.stack)} · 1e plaats {nf(payout(t, 1))}
                    </small>
                  </span>
                  <span className="tier-go">
                    {!open ? "🔒" : !afford ? "—" : "▶"}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              className={`tier daily ${dailyDone ? "won" : ""}`}
              onClick={() => onStart(TIERS[1], true)}
            >
              <span className="tier-icon">📅</span>
              <span className="tier-body">
                <b>
                  Dagchallenge
                  {dailyDone && <em className="tier-badge">gespeeld</em>}
                </b>
                <small>{dailyLabel()} — vandaag deelt iedereen dezelfde kaarten</small>
                <small className="tier-nums">
                  gratis ·{" "}
                  {progress.daily?.seed === seed
                    ? `jouw resultaat: ${progress.daily.place}e met ${nf(progress.daily.chips)}`
                    : "nog niet gespeeld"}
                </small>
              </span>
              <span className="tier-go">▶</span>
            </button>
          </div>
        )}

        {panel === "stats" && (
          <div className="panel">
            <div className="intro-stats">
              <div>
                <b>{stats.hands}</b>
                <span>handen</span>
              </div>
              <div>
                <b>{stats.hands ? Math.round((stats.handsWon / stats.hands) * 100) : 0}%</b>
                <span>gewonnen</span>
              </div>
              <div>
                <b>{stats.victories}</b>
                <span>titels</span>
              </div>
              <div>
                <b>{nf(stats.biggestPot)}</b>
                <span>grootste pot</span>
              </div>
              <div>
                <b>{stats.bestStreak}</b>
                <span>beste reeks</span>
              </div>
              <div>
                <b>{stats.tourneys}</b>
                <span>toernooien</span>
              </div>
            </div>

            <h3 className="panel-title">
              Prestaties{" "}
              <em>
                {progress.achievements.length}/{ACHIEVEMENTS.length}
              </em>
            </h3>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => {
                const got = progress.achievements.includes(a.id);
                return (
                  <div key={a.id} className={`ach ${got ? "got" : ""}`} title={a.desc}>
                    <span className="ach-icon">{got ? a.icon : "🔒"}</span>
                    <span>
                      <b>{a.name}</b>
                      <small>{a.desc}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {panel === "settings" && (
          <div className="panel">
            <SettingsFields settings={settings} onChange={onSettings} />
          </div>
        )}

        <ul className="intro-hints">
          <li>
            <kbd>F</kbd> fold · <kbd>C</kbd> check/call · <kbd>R</kbd> raise · <kbd>A</kbd> all-in
          </li>
          <li>Blinds gaan elke paar handen omhoog. Overleef ze allemaal.</li>
        </ul>
      </div>
    </div>
  );
}
