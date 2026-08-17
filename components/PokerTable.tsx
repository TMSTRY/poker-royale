"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Action,
  GameState,
  advanceStreet,
  applyAction,
  blinds,
  collectBets,
  handEndedByFolds,
  heroHandName,
  legal,
  livePlayers,
  newGame,
  resolve,
  roundOver,
  startHand,
  totalPot,
} from "@/lib/engine";
import { BotInsight, botDecide, botDelay } from "@/lib/ai";
import { cardLabel, describeHole } from "@/lib/cards";
import { equity } from "@/lib/equity";
import { ChatCtx, chatterFor } from "@/lib/chatter";
import { CoachNote, Decision, coachNote } from "@/lib/coach";
import { dailySeed } from "@/lib/rng";
import { setSound, sfx } from "@/lib/sound";
import { Achievement, achievementById, checkGame, checkHand } from "@/lib/achievements";
import {
  DEFAULT_SETTINGS,
  EMPTY_PROGRESS,
  EMPTY_STATS,
  Progress,
  Settings,
  Stats,
  loadName,
  loadProgress,
  loadSettings,
  loadStats,
  saveName,
  saveProgress,
  saveSettings,
  saveStats,
} from "@/lib/stats";
import { STARTING_BANKROLL, TIERS, Tier, payout } from "@/lib/tiers";
import Seat from "./Seat";
import Controls from "./Controls";
import ChipStack from "./ChipStack";
import PlayingCard from "./PlayingCard";
import StartScreen from "./StartScreen";
import SettingsFields from "./SettingsFields";

type Pos = { x: number; y: number };

/** Zes stoelen rond een ellips, de held onderaan. Staand scherm is smaller,
 *  dus dan liggen de zijkanten dichter naar het midden. */
function seatPositions(portrait: boolean): Pos[] {
  const rx = portrait ? 34 : 40;
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((90 + i * 60) * Math.PI) / 180;
    return { x: 50 + rx * Math.cos(a), y: 50 + (i === 0 ? 34 : 37) * Math.sin(a) };
  });
}

/** Inzetten liggen op een kleinere ellips. De held en de speler bovenaan
 *  krijgen een vaste plek náást hun kaarten, anders vallen de chips erachter. */
function betPositions(seats: Pos[]): Pos[] {
  return seats.map((p, i) => {
    if (i === 0) return { x: 36, y: 80 };
    if (i === 3) return { x: 66, y: 20 };
    return { x: 50 + (p.x - 50) * 0.66, y: 50 + (p.y - 50) * 0.66 };
  });
}

const POT_POS: Pos = { x: 50, y: 33 };

type Flight = { id: number; from: Pos; to: Pos; amount: number; dur: number };

const nf = (n: number) => n.toLocaleString("nl-BE");

export default function PokerTable() {
  const [game, setGame] = useState<GameState>(() => newGame("Jij"));
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tier, setTier] = useState<Tier>(TIERS[0]);
  const [isDaily, setIsDaily] = useState(false);

  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [thinkMs, setThinkMs] = useState(1200);
  const [portrait, setPortrait] = useState(false);

  const [chatter, setChatter] = useState<{ id: number; text: string; key: number } | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [heroEq, setHeroEq] = useState<number | null>(null);
  const [note, setNote] = useState<CoachNote | null>(null);
  const [toasts, setToasts] = useState<{ key: number; ach: Achievement }[]>([]);
  const [auto, setAuto] = useState<"off" | "checkfold" | "callany">("off");
  const [copied, setCopied] = useState(false);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  const decisionsRef = useRef<Decision[]>([]);
  const flightKeyRef = useRef("");
  const flightId = useRef(1);
  const wasShortRef = useRef(false);
  const raisedRef = useRef(false);
  const statHand = useRef(0);
  const statGame = useRef(false);
  const chatKey = useRef(1);

  const seatPos = useMemo(() => seatPositions(portrait), [portrait]);
  const betPos = useMemo(() => betPositions(seatPos), [seatPos]);
  const sp = settings.speed;

  /* ---------- opstart ---------- */

  useEffect(() => {
    setName(loadName());
    setStats(loadStats());
    setProgress(loadProgress());
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    setSound(settings.sound);
  }, [settings.sound]);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

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
      const p = r.height > r.width;
      setPortrait(p);
      const ratio = p ? 5 / 7 : 8 / 5;
      let w = r.width;
      let h = w / ratio;
      if (h > r.height) {
        h = r.height;
        w = h * ratio;
      }
      table.style.width = `${w}px`;
      table.style.height = `${h}px`;
      const u = p ? Math.min(w / 64, h / 76) : Math.min(w / 100, h / 58);
      table.style.setProperty("--u", `${u}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(area);
    return () => ro.disconnect();
  }, [started]);

  /* ---------- vliegende chips ---------- */

  const launch = useCallback((items: { from: Pos; to: Pos; amount: number }[], dur: number) => {
    if (items.length === 0) return;
    const batch = items.map((it) => ({ ...it, id: flightId.current++, dur }));
    setFlights((f) => [...f, ...batch]);
    const ids = new Set(batch.map((b) => b.id));
    window.setTimeout(() => setFlights((f) => f.filter((x) => !ids.has(x.id))), dur + 60);
  }, []);

  /* ---------- tafelpraat ---------- */

  const say = useCallback(
    (playerId: number, ctx: ChatCtx, chance = 0.3) => {
      if (!settings.chatter) return;
      const p = gameRef.current.players[playerId];
      if (!p || p.human || p.out) return;
      const text = chatterFor(p.name, ctx, chance);
      if (!text) return;
      const key = chatKey.current++;
      setChatter({ id: playerId, text, key });
      window.setTimeout(
        () => setChatter((c) => (c && c.key === key ? null : c)),
        2600 / sp
      );
    },
    [settings.chatter, sp]
  );

  /* ---------- spelverloop ---------- */

  useEffect(() => {
    if (!started) return;
    const s = game;
    if (s.stage === "idle" || s.stage === "handover" || s.stage === "gameover") return;

    if (handEndedByFolds(s)) {
      const t = setTimeout(() => setGame((g) => resolve(collectBets(g))), 450 / sp);
      return () => clearTimeout(t);
    }

    if (s.stage === "showdown") {
      const t = setTimeout(() => setGame((g) => resolve(g)), 500 / sp);
      return () => clearTimeout(t);
    }

    if (roundOver(s)) {
      // chips naar de pot laten glijden, één keer per straat
      const key = `${s.handNo}:${s.stage}:collect`;
      if (flightKeyRef.current !== key) {
        flightKeyRef.current = key;
        launch(
          s.players
            .map((p, i) => ({ from: betPos[i], to: POT_POS, amount: p.bet }))
            .filter((x) => x.amount > 0),
          420 / sp
        );
      }
      const t = setTimeout(() => setGame((g) => advanceStreet(collectBets(g))), 700 / sp);
      return () => clearTimeout(t);
    }

    const p = s.players[s.turn];
    if (!p) {
      // niemand kan nog inzetten: kaarten uitdelen tot de river
      const t = setTimeout(() => setGame((g) => advanceStreet(collectBets(g))), 900 / sp);
      return () => clearTimeout(t);
    }
    if (p.human) return; // wachten op de speler

    const delay = botDelay(s.stage, sp);
    setThinkMs(delay);
    const t = setTimeout(() => {
      const cur = gameRef.current;
      if (cur.turn !== s.turn || cur.dealToken !== s.dealToken || cur.handNo !== s.handNo) return;
      const idx = cur.turn;
      const insight: BotInsight = { eq: 0, norm: 0 };
      const action = botDecide(cur, idx, insight);
      const toCall = legal(cur, idx).toCall;

      setGame((g) =>
        g.turn === idx && g.handNo === cur.handNo && g.dealToken === cur.dealToken
          ? applyAction(g, idx, action)
          : g
      );

      if (action.kind === "allin") say(idx, "shove", 0.5);
      else if (action.kind === "raise")
        say(idx, insight.norm < 1 ? "bluffRaise" : "valueRaise", 0.22);
      else if (action.kind === "fold" && toCall > blinds(cur.level).bb * 2)
        say(idx, "fold", 0.18);
    }, delay);
    return () => clearTimeout(t);
  }, [game, started, sp, betPos, launch, say]);

  /* ---------- volgende hand ---------- */

  useEffect(() => {
    if (!started || game.stage !== "handover") return;
    const t = setTimeout(() => setGame((g) => nextHand(g)), 3200 / sp);
    return () => clearTimeout(t);
  }, [started, game.stage, game.handNo, sp]);

  /* ---------- einde hand: pot naar de winnaar, coach, statistieken ---------- */

  useEffect(() => {
    if (!started || game.stage !== "handover" || statHand.current === game.handNo) return;
    statHand.current = game.handNo;

    const hero = game.players[0];
    const won = game.winnerIds.includes(0);
    const pot = game.outcome?.awards.reduce((a, x) => a + x.amount, 0) ?? 0;

    // pot naar de winnaars
    const share = Math.max(1, Math.round(pot / Math.max(1, game.winnerIds.length)));
    launch(
      game.winnerIds.map((id) => ({ from: POT_POS, to: seatPos[id], amount: share })),
      520 / sp
    );

    // coach
    if (settings.coach) setNote(coachNote(decisionsRef.current));
    else setNote(null);

    // reacties van de bots
    const mainWinner = game.winnerIds[0];
    if (won) {
      const live = game.players.filter((p) => !p.human && !p.out);
      const who = live[Math.floor(Math.random() * live.length)];
      if (who && pot > 600) say(who.id, "heroWinBig", 0.4);
    } else if (mainWinner != null && mainWinner !== 0) {
      say(mainWinner, game.outcome?.showdown ? "winShowdown" : "winFold", 0.28);
    }
    for (const p of game.players) {
      if (!p.human && p.chips <= 0 && p.place != null) say(p.id, "bust", 0.9);
    }

    // statistieken
    const nextStats: Stats = {
      ...stats,
      hands: stats.hands + 1,
      handsWon: stats.handsWon + (won ? 1 : 0),
      showdownsWon: stats.showdownsWon + (won && game.outcome?.showdown ? 1 : 0),
      biggestPot: won ? Math.max(stats.biggestPot, pot) : stats.biggestPot,
      streak: won ? stats.streak + 1 : 0,
    };
    nextStats.bestStreak = Math.max(nextStats.bestStreak, nextStats.streak);
    setStats(nextStats);
    saveStats(nextStats);

    // prestaties
    const heroHand = game.outcome?.hands[0];
    const unlocked = checkHand(
      {
        won,
        showdown: !!game.outcome?.showdown,
        potWon: pot,
        handCat: heroHand ? catFromName(heroHand.name) : null,
        handName: heroHand?.name ?? null,
        holeLabel: describeHole(hero.hole),
        raisedThisHand: raisedRef.current,
        streak: nextStats.streak,
        totalHands: nextStats.hands,
      },
      progress.achievements
    );
    if (unlocked.length) grantAchievements(unlocked);

    decisionsRef.current = [];
    raisedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, game.stage, game.handNo]);

  /* ---------- einde toernooi ---------- */

  useEffect(() => {
    if (game.stage !== "gameover") {
      statGame.current = false;
      return;
    }
    if (statGame.current || !started) return;
    statGame.current = true;

    const hero = game.players[0];
    const survivors = game.players.filter((p) => p.chips > 0).length;
    const place = hero.chips > 0 ? 1 : hero.place ?? survivors + 1;

    const prize = isDaily ? 0 : payout(tier, place);
    const nextProgress: Progress = {
      ...progress,
      bankroll: progress.bankroll + prize,
      tiersWon:
        place === 1 && !isDaily && !progress.tiersWon.includes(tier.id)
          ? [...progress.tiersWon, tier.id]
          : progress.tiersWon,
      daily: isDaily
        ? { seed: dailySeed(), place, chips: Math.max(hero.chips, 0) }
        : progress.daily,
    };

    const nextStats: Stats = {
      ...stats,
      tourneys: stats.tourneys + 1,
      victories: stats.victories + (place === 1 ? 1 : 0),
      bestPlace: Math.min(stats.bestPlace, place),
    };

    setProgress(nextProgress);
    saveProgress(nextProgress);
    setStats(nextStats);
    saveStats(nextStats);

    const unlocked = checkGame(
      {
        place,
        tierId: tier.id,
        wasShort: wasShortRef.current,
        daily: isDaily,
        bankroll: nextProgress.bankroll,
      },
      nextProgress.achievements
    );
    if (unlocked.length) grantAchievements(unlocked, nextProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.stage, started]);

  const grantAchievements = useCallback(
    (ids: string[], base?: Progress) => {
      setProgress((prev) => {
        const src = base ?? prev;
        const merged = {
          ...src,
          achievements: Array.from(new Set([...src.achievements, ...ids])),
        };
        saveProgress(merged);
        return merged;
      });
      setToasts((t) => [
        ...t,
        ...ids
          .map((id) => achievementById(id))
          .filter((a): a is Achievement => !!a)
          .map((ach) => ({ key: chatKey.current++, ach })),
      ]);
      sfx.win();
      window.setTimeout(() => setToasts((t) => t.slice(ids.length)), 4200);
    },
    []
  );

  /* ---------- winkans van de held ---------- */

  useEffect(() => {
    if (!started) return;
    const hero = game.players[0];
    if (game.turn !== 0 || hero.folded || hero.out || hero.hole.length < 2) {
      setHeroEq(null);
      return;
    }
    const opp = Math.max(1, livePlayers(game).length - 1);
    const id = window.setTimeout(
      () => setHeroEq(equity(hero.hole, game.board, opp, 420)),
      0
    );
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, game.turn, game.handNo, game.board.length, game.stage]);

  /* ---------- korte stack onthouden (voor de comeback-prestatie) ---------- */

  useEffect(() => {
    if (!started || game.stage === "idle") return;
    const hero = game.players[0];
    if (hero.chips > 0 && hero.chips < blinds(game.level).bb * 8) wasShortRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, game.handNo, game.stage]);

  /* ---------- geluid ---------- */

  const prevGame = useRef<GameState | null>(null);
  useEffect(() => {
    const p = prevGame.current;
    prevGame.current = game;
    if (!p || !started) return;

    if (game.handNo !== p.handNo && game.stage === "preflop") {
      for (let i = 0; i < 5; i++) sfx.deal(i);
      if (game.level > p.level) {
        const live = game.players.filter((x) => !x.human && !x.out);
        const who = live[Math.floor(Math.random() * live.length)];
        if (who) say(who.id, "levelUp", 0.5);
      }
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
  }, [game, started, say]);

  /* ---------- acties van de speler ---------- */

  const act = useCallback(
    (a: Action) => {
      const g = gameRef.current;
      if (g.turn !== 0 || !g.players[0].human) return;
      sfx.click();

      const hero = g.players[0];
      const l = legal(g, 0);
      const pot = totalPot(g);
      const opp = Math.max(1, livePlayers(g).length - 1);
      const eq = heroEq ?? equity(hero.hole, g.board, opp, 300);
      const kind = decisionKind(a, l.toCall);
      if (
        kind &&
        (g.stage === "preflop" || g.stage === "flop" || g.stage === "turn" || g.stage === "river")
      ) {
        decisionsRef.current.push({
          stage: g.stage,
          eq,
          potOdds: l.toCall > 0 ? l.toCall / (pot + l.toCall) : 0,
          toCall: l.toCall,
          pot,
          kind,
          amount: a.amount ?? 0,
          opponents: opp,
        });
      }
      if (a.kind === "raise" || a.kind === "allin") raisedRef.current = true;
      if (a.kind === "allin") {
        const live = g.players.filter((x) => !x.human && !x.out && !x.folded);
        const who = live[Math.floor(Math.random() * live.length)];
        if (who) say(who.id, "heroShove", 0.45);
      }

      setGame((cur) => (cur.turn === 0 ? applyAction(cur, 0, a) : cur));
    },
    [heroEq, say]
  );

  /* ---------- automatische acties ---------- */

  const hero = game.players[0];
  const heroTurn = started && game.turn === 0 && !hero.folded && !hero.allIn && !hero.out;

  useEffect(() => {
    if (!heroTurn || auto === "off") return;
    const l = legal(gameRef.current, 0);
    const t = setTimeout(() => {
      if (auto === "checkfold") act(l.canCheck ? { kind: "check" } : { kind: "fold" });
      else act(l.canCheck ? { kind: "check" } : { kind: "call" });
      setAuto("off");
    }, 220);
    return () => clearTimeout(t);
  }, [heroTurn, auto, act]);

  /* ---------- bedenktijd ---------- */

  const clockKey = `${game.handNo}:${game.stage}:${game.currentBet}:${hero.bet}`;
  useEffect(() => {
    if (!heroTurn || settings.clock <= 0 || auto !== "off") return;
    const t = setTimeout(() => {
      const l = legal(gameRef.current, 0);
      act(l.canCheck ? { kind: "check" } : { kind: "fold" });
    }, settings.clock * 1000);
    return () => clearTimeout(t);
  }, [heroTurn, clockKey, settings.clock, auto, act]);

  /* ---------- starten en herstarten ---------- */

  const beginRun = useCallback(
    (t: Tier, daily: boolean, prog: Progress) => {
      sfx.unlock();
      const trimmed = (name || "Jij").slice(0, 14);
      saveName(trimmed);
      const cfg = {
        startStack: t.stack,
        handsPerLevel: t.handsPerLevel,
        skill: t.skill,
        seed: daily ? dailySeed() : null,
        tierId: t.id,
      };
      setTier(t);
      setIsDaily(daily);
      setGame(startHand(newGame(trimmed, cfg)));
      setStarted(true);
      setNote(null);
      decisionsRef.current = [];
      wasShortRef.current = false;
      raisedRef.current = false;
      statHand.current = 0;
      statGame.current = false;
      if (!daily) {
        const next = { ...prog, bankroll: prog.bankroll - t.buyIn };
        setProgress(next);
        saveProgress(next);
      }
    },
    [name]
  );

  const onStart = useCallback(
    (t: Tier, daily: boolean) => beginRun(t, daily, progress),
    [beginRun, progress]
  );

  const onTopUp = useCallback(() => {
    const next = { ...progress, bankroll: STARTING_BANKROLL };
    setProgress(next);
    saveProgress(next);
  }, [progress]);

  const backToLobby = useCallback(() => {
    setStarted(false);
    setShowSettings(false);
  }, []);

  const playAgain = useCallback(() => {
    if (isDaily) {
      setStarted(false);
      return;
    }
    if (progress.bankroll < tier.buyIn) {
      setStarted(false);
      return;
    }
    beginRun(tier, false, progress);
  }, [beginRun, isDaily, progress, tier]);

  /* ---------- afgeleide waarden ---------- */

  const heroLegal = useMemo(() => legal(game, 0), [game]);
  const pot = totalPot(game);
  const lvl = blinds(game.level);
  const madeHand = heroHandName(game);
  const revealAll = game.stage === "handover" && !!game.outcome?.showdown;
  const handsToLevel = game.config.handsPerLevel - ((game.handNo - 1) % game.config.handsPerLevel);

  const shareText = useMemo(() => buildShare(game, tier, isDaily), [game, tier, isDaily]);

  const copyShare = useCallback(() => {
    if (!shareText) return;
    void navigator.clipboard?.writeText(shareText).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      },
      () => setCopied(false)
    );
  }, [shareText]);

  /* ---------- startscherm ---------- */

  if (!started) {
    return (
      <StartScreen
        name={name}
        onName={setName}
        stats={stats}
        progress={progress}
        settings={settings}
        onSettings={updateSettings}
        onStart={onStart}
        onTopUp={onTopUp}
      />
    );
  }

  /* ---------- speelscherm ---------- */

  return (
    <div className="shell playing">
      <header className="hud">
        <div className="hud-left">
          <button type="button" className="hud-logo" onClick={backToLobby} title="Terug naar de lobby">
            ♠ {tier.icon} {isDaily ? "DAGCHALLENGE" : tier.name.toUpperCase()}
          </button>
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
          <button type="button" className="icon-btn" onClick={() => setShowLog((v) => !v)} title="Historiek">
            ☰
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSettings((v) => !v)}
            title="Instellingen"
          >
            ⚙
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              sfx.unlock();
              updateSettings({ ...settings, sound: !settings.sound });
            }}
            title="Geluid"
          >
            {settings.sound ? "🔊" : "🔇"}
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
                style={{ left: `${betPos[i].x}%`, top: `${betPos[i].y}%` }}
              >
                <ChipStack amount={p.bet} />
              </div>
            ) : null
          )}

          {flights.map((f) => (
            <div
              key={f.id}
              className="flight"
              style={{
                left: `${f.from.x}%`,
                top: `${f.from.y}%`,
                ["--tx" as string]: `${f.to.x}%`,
                ["--ty" as string]: `${f.to.y}%`,
                animationDuration: `${f.dur}ms`,
              }}
            >
              <ChipStack amount={f.amount} />
            </div>
          ))}

          {game.players.map((p, i) => (
            <Seat
              key={p.id}
              player={p}
              pos={seatPos[i]}
              isTurn={game.turn === i && game.stage !== "handover"}
              isDealer={game.dealer === i}
              revealCards={revealAll && !p.folded}
              isWinner={game.winnerIds.includes(p.id)}
              highlight={game.highlight}
              dealToken={game.handNo}
              thinkMs={p.human ? 0 : thinkMs}
              says={chatter && chatter.id === p.id ? chatter.text : null}
            />
          ))}
        </div>
      </div>

      <footer className="dock">
        {note && game.stage === "handover" && (
          <div className={`coach coach-${note.tone}`}>
            <span className="coach-icon">
              {note.tone === "good" ? "✅" : note.tone === "bad" ? "⚠️" : "💡"}
            </span>
            <span>{note.text}</span>
            {shareText && (
              <button type="button" className="coach-share" onClick={copyShare}>
                {copied ? "gekopieerd" : "kopieer hand"}
              </button>
            )}
          </div>
        )}
        {!note && game.stage === "handover" && shareText && (
          <div className="coach coach-info">
            <span className="coach-icon">🃏</span>
            <span>{game.outcome?.headline}</span>
            <button type="button" className="coach-share" onClick={copyShare}>
              {copied ? "gekopieerd" : "kopieer hand"}
            </button>
          </div>
        )}

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

          {settings.equityMeter && heroEq != null && heroTurn && (
            <div className="eq-meter" title="Geschatte winkans">
              <div className="eq-bar">
                <span style={{ width: `${Math.round(heroEq * 100)}%` }} />
              </div>
              <b>{Math.round(heroEq * 100)}%</b>
            </div>
          )}

          {!heroTurn && !hero.out && !hero.folded && game.stage !== "handover" && (
            <div className="auto-row">
              <button
                type="button"
                className={auto === "checkfold" ? "on" : ""}
                onClick={() => setAuto((a) => (a === "checkfold" ? "off" : "checkfold"))}
              >
                Check/Fold
              </button>
              <button
                type="button"
                className={auto === "callany" ? "on" : ""}
                onClick={() => setAuto((a) => (a === "callany" ? "off" : "callany"))}
              >
                Call any
              </button>
            </div>
          )}

          <div className="dock-stack">
            <span className="dock-label">Stack</span>
            <b>{nf(hero.chips)}</b>
            <small>{Math.floor(hero.chips / lvl.bb)} bb</small>
          </div>
        </div>

        {heroTurn && settings.clock > 0 && (
          <div className="dock-clock" key={clockKey}>
            <span style={{ animationDuration: `${settings.clock}s` }} />
          </div>
        )}

        <Controls
          legal={heroLegal}
          pot={pot}
          bb={lvl.bb}
          heroBet={hero.bet}
          active={heroTurn}
          onAction={act}
        />
      </footer>

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.key} className="toast">
              <span className="toast-icon">{t.ach.icon}</span>
              <span>
                <b>{t.ach.name}</b>
                <small>{t.ach.desc}</small>
              </span>
            </div>
          ))}
        </div>
      )}

      {showSettings && (
        <div className="modal-wrap" onClick={() => setShowSettings(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Instellingen</h2>
            <SettingsFields settings={settings} onChange={updateSettings} />
            <button type="button" className="cta" onClick={() => setShowSettings(false)}>
              SLUITEN
            </button>
            <button type="button" className="link-btn" onClick={backToLobby}>
              Toernooi verlaten
            </button>
          </div>
        </div>
      )}

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
                <h2>{isDaily ? "Dagchallenge gewonnen!" : `${tier.name} gewonnen!`}</h2>
                <p>
                  Je speelde alle vijf tegenstanders uit met <b>{nf(hero.chips)}</b> chips
                  {!isDaily && (
                    <>
                      {" "}
                      en verdiende <b>{nf(payout(tier, 1))}</b>
                    </>
                  )}
                  .
                </p>
              </>
            ) : (
              <>
                <div className="modal-emoji">💀</div>
                <h2>Uitgeschakeld</h2>
                <p>
                  Je eindigde als <b>{hero.place ?? "?"}e</b> na {game.handNo} handen
                  {!isDaily && payout(tier, hero.place ?? 6) > 0 && (
                    <>
                      {" "}
                      — dat is nog <b>{nf(payout(tier, hero.place ?? 6))}</b> prijzengeld
                    </>
                  )}
                  .
                </p>
              </>
            )}
            <div className="modal-stats">
              <div>
                <b>{nf(progress.bankroll)}</b>
                <span>bankroll</span>
              </div>
              <div>
                <b>{stats.victories}</b>
                <span>titels</span>
              </div>
              <div>
                <b>{nf(stats.biggestPot)}</b>
                <span>grootste pot</span>
              </div>
            </div>
            <button type="button" className="cta" onClick={playAgain}>
              {isDaily || progress.bankroll < tier.buyIn ? "NAAR DE LOBBY" : "NOG EEN KEER"}
            </button>
            <button type="button" className="link-btn" onClick={backToLobby}>
              Lobby
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

/** Vertaalt een spelactie naar wat de coach ervan moet onthouden. */
function decisionKind(a: Action, toCall: number): Decision["kind"] | null {
  if (a.kind === "blind") return null;
  if (a.kind === "call") return toCall === 0 ? "check" : "call";
  return a.kind;
}

/** Categorienummer terugvinden uit de Nederlandse handnaam. */
function catFromName(name: string): number {
  if (name.startsWith("Royal") || name.startsWith("Straight flush")) return 8;
  if (name.startsWith("Vier")) return 7;
  if (name.startsWith("Full house")) return 6;
  if (name.startsWith("Flush")) return 5;
  if (name.startsWith("Straat")) return 4;
  if (name.startsWith("Drie")) return 3;
  if (name.startsWith("Twee paar")) return 2;
  if (name.startsWith("Paar")) return 1;
  return 0;
}

function buildShare(g: GameState, tier: Tier, daily: boolean): string | null {
  if (g.stage !== "handover" || !g.outcome) return null;
  const lines: string[] = [];
  lines.push(`♠ POKER ROYALE — ${daily ? "dagchallenge" : tier.name}, hand ${g.handNo}`);
  if (g.board.length) lines.push(`Board: ${g.board.map(cardLabel).join(" ")}`);
  for (const p of g.players) {
    if (p.out || p.folded) continue;
    const shown = p.human || g.outcome.showdown;
    if (!shown || p.hole.length < 2) continue;
    const h = g.outcome.hands[p.id];
    lines.push(
      `${p.human ? "Jij" : p.name}: ${p.hole.map(cardLabel).join(" ")}${h ? ` — ${h.name}` : ""}`
    );
  }
  lines.push(g.outcome.headline);
  lines.push("poker-royale-zeta.vercel.app");
  return lines.join("\n");
}
