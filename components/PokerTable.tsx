"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Action,
  GameState,
  START_STACK,
  advanceStreet,
  applyAction,
  blinds,
  collectBets,
  handEndedByFolds,
  heroHandName,
  legal,
  newGame,
  resolve,
  roundOver,
  startHand,
  totalPot,
} from "@/lib/engine";
import { botDecide, botDelay } from "@/lib/ai";
import { describeHole } from "@/lib/cards";
import { setSound, sfx } from "@/lib/sound";
import { EMPTY_STATS, Stats, loadName, loadStats, saveName, saveStats } from "@/lib/stats";
import Seat from "./Seat";
import Controls from "./Controls";
import ChipStack from "./ChipStack";
import PlayingCard from "./PlayingCard";

const SEAT_POS = Array.from({ length: 6 }, (_, i) => {
  const a = ((90 + i * 60) * Math.PI) / 180;
  return { x: 50 + 40 * Math.cos(a), y: 50 + 37 * Math.sin(a) };
});

const BET_POS = SEAT_POS.map((p) => ({
  x: 50 + (p.x - 50) * 0.7,
  y: 50 + (p.y - 50) * 0.64,
}));

const HAND_PAUSE = 3000;

export default function PokerTable() {
  const [game, setGame] = useState<GameState>(() => newGame("Jij"));
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [showLog, setShowLog] = useState(false);
  const [thinkMs, setThinkMs] = useState(1200);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  /* ---------- opstart ---------- */

  useEffect(() => {
    setName(loadName());
    setStats(loadStats());
  }, []);

  useEffect(() => {
    setSound(soundOn);
  }, [soundOn]);

  /* ---------- schaal van de tafel ---------- */

  useEffect(() => {
    const area = areaRef.current;
    const table = tableRef.current;
    if (!area || !table) return;
    // De tafel krijgt een expliciete maat: de grootste rechthoek met de juiste
    // verhouding die nog in de beschikbare ruimte past.
    const apply = () => {
      const r = area.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const portrait = r.height > r.width;
      const ratio = portrait ? 5 / 7 : 8 / 5;
      let w = r.width;
      let h = w / ratio;
      if (h > r.height) {
        h = r.height;
        w = h * ratio;
      }
      table.style.width = `${w}px`;
      table.style.height = `${h}px`;
      const u = portrait ? Math.min(w / 64, h / 76) : Math.min(w / 100, h / 58);
      table.style.setProperty("--u", `${u}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(area);
    return () => ro.disconnect();
  }, [started]);

  /* ---------- spelverloop ---------- */

  useEffect(() => {
    if (!started) return;
    const s = game;
    if (s.stage === "idle" || s.stage === "handover" || s.stage === "gameover") return;

    if (handEndedByFolds(s)) {
      const t = setTimeout(() => setGame((g) => resolve(collectBets(g))), 450);
      return () => clearTimeout(t);
    }

    if (s.stage === "showdown") {
      const t = setTimeout(() => setGame((g) => resolve(g)), 500);
      return () => clearTimeout(t);
    }

    if (roundOver(s)) {
      const t = setTimeout(() => setGame((g) => advanceStreet(collectBets(g))), 700);
      return () => clearTimeout(t);
    }

    const p = s.players[s.turn];
    if (!p) {
      // niemand kan nog inzetten: kaarten uitdelen tot de river
      const t = setTimeout(() => setGame((g) => advanceStreet(collectBets(g))), 900);
      return () => clearTimeout(t);
    }
    if (p.human) return; // wachten op de speler

    const delay = botDelay(s.stage);
    setThinkMs(delay);
    const t = setTimeout(() => {
      setGame((g) => {
        if (g.turn !== s.turn || g.dealToken !== s.dealToken || g.handNo !== s.handNo) return g;
        const a = botDecide(g, g.turn);
        return applyAction(g,g.turn, a);
      });
    }, delay);
    return () => clearTimeout(t);
  }, [game, started]);

  /* ---------- volgende hand ---------- */

  useEffect(() => {
    if (!started || game.stage !== "handover") return;
    const t = setTimeout(() => setGame((g) => nextHand(g)), HAND_PAUSE);
    return () => clearTimeout(t);
  }, [started, game.stage, game.handNo]);

  /* ---------- statistieken ---------- */

  const statHand = useRef(0);
  useEffect(() => {
    if (game.stage !== "handover" || statHand.current === game.handNo) return;
    statHand.current = game.handNo;
    const won = game.winnerIds.includes(0);
    const pot = game.outcome?.awards.reduce((a, x) => a + x.amount, 0) ?? 0;
    setStats((prev) => {
      const next: Stats = {
        ...prev,
        hands: prev.hands + 1,
        handsWon: prev.handsWon + (won ? 1 : 0),
        showdownsWon: prev.showdownsWon + (won && game.outcome?.showdown ? 1 : 0),
        biggestPot: won ? Math.max(prev.biggestPot, pot) : prev.biggestPot,
        streak: won ? prev.streak + 1 : 0,
      };
      next.bestStreak = Math.max(next.bestStreak, next.streak);
      saveStats(next);
      return next;
    });
  }, [game.stage, game.handNo, game.winnerIds, game.outcome]);

  const statGame = useRef(false);
  useEffect(() => {
    if (game.stage !== "gameover") {
      statGame.current = false;
      return;
    }
    if (statGame.current) return;
    statGame.current = true;
    const hero = game.players[0];
    const survivors = game.players.filter((p) => p.chips > 0).length;
    const place = hero.chips > 0 ? 1 : hero.place ?? survivors + 1;
    setStats((prev) => {
      const next: Stats = {
        ...prev,
        tourneys: prev.tourneys + 1,
        victories: prev.victories + (place === 1 ? 1 : 0),
        bestPlace: Math.min(prev.bestPlace, place),
        bankroll: prev.bankroll + (place === 1 ? 5000 : place === 2 ? 2000 : place === 3 ? 800 : 0),
      };
      saveStats(next);
      return next;
    });
  }, [game.stage, game.players]);

  /* ---------- geluid ---------- */

  const prevGame = useRef<GameState | null>(null);
  useEffect(() => {
    const p = prevGame.current;
    prevGame.current = game;
    if (!p || !started) return;

    if (game.handNo !== p.handNo && game.stage === "preflop") {
      for (let i = 0; i < 5; i++) sfx.deal(i);
    }
    if (game.board.length > p.board.length) sfx.flip();

    for (let i = 0; i < game.players.length; i++) {
      const a = game.players[i].lastAction;
      const b = p.players[i]?.lastAction;
      if (!a || a === b) continue;
      if (a === "Fold") sfx.fold();
      else if (a === "Check") sfx.check();
      else if (a === "All-in") sfx.allin();
      else if (a.startsWith("Raise") || a.startsWith("Bet")) sfx.raise();
      else if (a.startsWith("Call")) sfx.chip();
    }

    if (game.stage === "handover" && p.stage !== "handover") {
      if (game.winnerIds.includes(0)) sfx.win();
      else if (!game.players[0].folded) sfx.lose();
    }
    if (game.stage === "gameover" && p.stage !== "gameover") {
      if (game.players[0].chips > 0) sfx.victory();
      else sfx.bust();
    }
  }, [game, started]);

  /* ---------- acties ---------- */

  const act = useCallback((a: Action) => {
    sfx.click();
    setGame((g) => {
      if (g.turn !== 0 || !g.players[0].human) return g;
      return applyAction(g,0, a);
    });
  }, []);

  const start = useCallback(() => {
    sfx.unlock();
    const trimmed = (name || "Jij").slice(0, 14);
    saveName(trimmed);
    setGame(startHand(newGame(trimmed)));
    setStarted(true);
  }, [name]);

  const restart = useCallback(() => {
    sfx.unlock();
    setGame(startHand(newGame(name || "Jij")));
    statHand.current = 0;
  }, [name]);

  /* ---------- afgeleide waarden ---------- */

  const hero = game.players[0];
  const heroTurn = started && game.turn === 0 && !hero.folded && !hero.allIn && !hero.out;
  const heroLegal = useMemo(() => legal(game, 0), [game]);
  const pot = totalPot(game);
  const lvl = blinds(game.level);
  const madeHand = heroHandName(game);
  const revealAll = game.stage === "handover" && !!game.outcome?.showdown;

  const handsToLevel =
    8 - (((game.handNo - 1) % 8) + 1) + 1;

  /* ---------- startscherm ---------- */

  if (!started) {
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

          <div className="intro-card">
            <label className="field">
              <span>Jouw naam</span>
              <input
                type="text"
                value={name}
                maxLength={14}
                placeholder="High Roller"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
              />
            </label>

            <button type="button" className="cta" onClick={start}>
              START TOERNOOI
            </button>

            <div className="intro-meta">
              <div>
                <b>{START_STACK.toLocaleString("nl-BE")}</b>
                <span>startstack</span>
              </div>
              <div>
                <b>10/20</b>
                <span>blinds</span>
              </div>
              <div>
                <b>5</b>
                <span>tegenstanders</span>
              </div>
            </div>
          </div>

          {stats.hands > 0 && (
            <div className="intro-stats">
              <div>
                <b>{stats.hands}</b>
                <span>handen</span>
              </div>
              <div>
                <b>
                  {stats.hands ? Math.round((stats.handsWon / stats.hands) * 100) : 0}%
                </b>
                <span>gewonnen</span>
              </div>
              <div>
                <b>{stats.victories}</b>
                <span>titels</span>
              </div>
              <div>
                <b>{stats.biggestPot.toLocaleString("nl-BE")}</b>
                <span>grootste pot</span>
              </div>
              <div>
                <b>{stats.bestStreak}</b>
                <span>beste reeks</span>
              </div>
            </div>
          )}

          <ul className="intro-hints">
            <li>
              <kbd>F</kbd> fold · <kbd>C</kbd> check/call · <kbd>R</kbd> raise · <kbd>A</kbd> all-in
            </li>
            <li>Blinds gaan elke 8 handen omhoog. Overleef ze allemaal.</li>
          </ul>
        </div>
      </div>
    );
  }

  /* ---------- speelscherm ---------- */

  return (
    <div className="shell playing">
      <header className="hud">
        <div className="hud-left">
          <span className="hud-logo">♠ POKER<b>ROYALE</b></span>
        </div>
        <div className="hud-mid">
          <div className="hud-chip">
            <span>Hand</span>
            <b>{game.handNo}</b>
          </div>
          <div className="hud-chip">
            <span>Blinds</span>
            <b>
              {lvl.sb}/{lvl.bb}
            </b>
          </div>
          <div className="hud-chip">
            <span>Level up</span>
            <b>{handsToLevel}</b>
          </div>
          {stats.streak > 1 && (
            <div className="hud-chip hot">
              <span>Reeks</span>
              <b>🔥 {stats.streak}</b>
            </div>
          )}
        </div>
        <div className="hud-right">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowLog((v) => !v)}
            title="Historiek"
          >
            ☰
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              sfx.unlock();
              setSoundOn((v) => !v);
            }}
            title="Geluid"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <div className="table-area" ref={areaRef}>
        <div className="table" ref={tableRef}>
          <div className="felt">
            <div className="felt-glow" aria-hidden />
            <div className="felt-logo" aria-hidden>
              ♠ ROYALE ♦
            </div>
          </div>

          <div className="center">
            <div className="pot">
              <ChipStack amount={pot} label="POT" big />
            </div>
            <div className="board">
              {game.board.map((c, i) => (
                <PlayingCard
                  key={c.id}
                  card={c}
                  faceUp
                  size="lg"
                  delay={i < 3 ? i * 100 : 0}
                  highlight={revealAll && game.highlight.includes(c.id)}
                />
              ))}
              {Array.from({ length: 5 - game.board.length }).map((_, i) => (
                <div key={`ph-${i}`} className="board-ph" />
              ))}
            </div>
            {game.stage === "handover" && game.outcome && (
              <div className="banner">{game.outcome.headline}</div>
            )}
          </div>

          {game.players.map((p, i) =>
            p.bet > 0 ? (
              <div
                key={`bet-${p.id}`}
                className="bet-spot"
                style={{ left: `${BET_POS[i].x}%`, top: `${BET_POS[i].y}%` }}
              >
                <ChipStack amount={p.bet} />
              </div>
            ) : null
          )}

          {game.players.map((p, i) => (
            <Seat
              key={p.id}
              player={p}
              pos={SEAT_POS[i]}
              isTurn={game.turn === i && game.stage !== "handover"}
              isDealer={game.dealer === i}
              revealCards={revealAll && !p.folded}
              isWinner={game.winnerIds.includes(p.id)}
              highlight={game.highlight}
              dealToken={game.handNo}
              thinkMs={p.human ? 0 : thinkMs}
            />
          ))}
        </div>
      </div>

      <footer className="dock">
        <div className="dock-info">
          <div className="dock-hand">
            {hero.out ? (
              <span className="muted">Uitgeschakeld</span>
            ) : hero.folded ? (
              <span className="muted">Gefold — volgende hand</span>
            ) : madeHand ? (
              <>
                <span className="dock-label">Jouw hand</span>
                <b>{madeHand}</b>
              </>
            ) : hero.hole.length === 2 ? (
              <>
                <span className="dock-label">Startkaarten</span>
                <b>{describeHole(hero.hole)}</b>
              </>
            ) : null}
          </div>
          <div className="dock-stack">
            <span className="dock-label">Stack</span>
            <b>{hero.chips.toLocaleString("nl-BE")}</b>
            <small>{Math.floor(hero.chips / lvl.bb)} bb</small>
          </div>
        </div>

        <Controls
          legal={heroLegal}
          pot={pot}
          bb={lvl.bb}
          heroBet={hero.bet}
          active={heroTurn}
          onAction={act}
        />
      </footer>

      {showLog && (
        <aside className="log">
          <div className="log-head">
            <b>Historiek</b>
            <button type="button" className="icon-btn" onClick={() => setShowLog(false)}>
              ✕
            </button>
          </div>
          <ul>
            {game.log
              .slice()
              .reverse()
              .map((l) => (
                <li key={l.id} className={`log-${l.kind}`}>
                  {l.text}
                </li>
              ))}
          </ul>
        </aside>
      )}

      {game.stage === "gameover" && (
        <div className="modal-wrap">
          <div className="modal">
            {hero.chips > 0 ? (
              <>
                <div className="modal-emoji">🏆</div>
                <h2>Toernooi gewonnen!</h2>
                <p>
                  Je hebt alle vijf de tegenstanders uitgespeeld met{" "}
                  <b>{hero.chips.toLocaleString("nl-BE")}</b> chips.
                </p>
              </>
            ) : (
              <>
                <div className="modal-emoji">💀</div>
                <h2>Uitgeschakeld</h2>
                <p>
                  Je eindigde als <b>{hero.place ?? "?"}e</b> na {game.handNo} handen.
                </p>
              </>
            )}
            <div className="modal-stats">
              <div>
                <b>{stats.hands}</b>
                <span>handen totaal</span>
              </div>
              <div>
                <b>{stats.victories}</b>
                <span>titels</span>
              </div>
              <div>
                <b>{stats.biggestPot.toLocaleString("nl-BE")}</b>
                <span>grootste pot</span>
              </div>
            </div>
            <button type="button" className="cta" onClick={restart}>
              NOG EEN KEER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- kleine helpers ---------- */

function nextHand(g: GameState): GameState {
  const alive = g.players.filter((p) => p.chips > 0);
  if (g.players[0].chips <= 0 || alive.length <= 1) {
    return { ...g, stage: "gameover", turn: -1 };
  }
  return startHand(g);
}
