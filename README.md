# ♠ Poker Royale

Texas Hold'em toernooipoker in de browser. Jij tegen vijf bots met elk hun eigen
karakter, stijgende blinds en winner-takes-all. Geen backend, geen accounts,
geen afbeeldingen — alles wordt in de browser getekend en berekend.

## Wat zit erin

**Volledige Hold'em-regels**
- Preflop / flop / turn / river met correcte inzetronden, minimum-raises en
  het optierecht van de big blind
- Echte **side pots**: drie spelers all-in voor verschillende bedragen wordt
  correct uitbetaald, inclusief oneven chips
- Heads-up blindregels (knop = small blind) zodra er nog twee spelers over zijn
- Toernooiformat: 2.000 startchips, blinds gaan elke 8 handen omhoog tot 1000/2000

**Handevaluator**
Beste 5 uit 7 kaarten via alle 21 combinaties, met een enkele vergelijkbare score
per hand. Straat met aas-laag (A-2-3-4-5) inbegrepen. Gecontroleerd op alle negen
categorieën plus de onderlinge ordening.

**Bots die echt rekenen**
Elke bot schat zijn winkans met een Monte-Carlo simulatie (180 runs preflop,
320 postflop) tegen het werkelijke aantal tegenstanders, en zet die af tegen de
pot odds. Daarbovenop een karakter — agressie, blufneiging en tightness:

| Bot | Stijl |
|---|---|
| 🦊 Vera | strak, straft hard af |
| 🐗 Mad Mo | elke pot is van hem |
| 🦅 Rook | leest je als een boek |
| 🐢 Nonna | wacht op de nuts |
| 🎲 Dice | gokt op gevoel |

Korte stacks schakelen automatisch over op push-or-fold.

**Presentatie**
- Kaarten in pure CSS met een 3D-flip, gedeald met vertraging per kaart
- Vilt met gouden rail, chipstapels die meekleuren met het bedrag
- Winnende vijf kaarten lichten goud op bij de showdown
- Geluid via WebAudio — chips, kaarten, all-in, fanfare. Nul audiobestanden.
- Alles schaalt op één CSS-variabele mee met het scherm; aparte tafelverhouding
  voor portret en landschap

**Verslavend gemaakt**
Pot odds bij de callknop, je actuele hand in beeld, winreeks-teller, blindteller,
statistieken in localStorage (handen, winratio, grootste pot, titels, beste reeks)
en meteen door naar de volgende hand.

## Bediening

| Toets | Actie |
|---|---|
| `F` | fold |
| `C` | check / call |
| `R` | raise naar het ingestelde bedrag |
| `A` | all-in |

Of gewoon klikken. De schuifbalk en de knoppen ½ pot / ¾ pot / pot / all-in
zetten je inzet.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · handgeschreven CSS.
Geen runtime-dependencies buiten React, geen externe assets, volledig statisch.

## Lokaal

```bash
npm install
npm run dev
```

Typecheck: `npm run typecheck`. Build: `npm run build`.

## Structuur

```
lib/cards.ts       kaarten, deck, schudden
lib/evaluator.ts   beste 5 uit 7, vergelijkbare score
lib/equity.ts      Monte-Carlo winkans
lib/engine.ts      volledige spelstatus + regels + side pots
lib/ai.ts          botbeslissingen
lib/sound.ts       WebAudio-synth
components/        tafel, stoelen, kaarten, chips, knoppen
```

De engine is puur: elke functie neemt een `GameState` en geeft een nieuwe terug.
Daardoor is hij los van React te simuleren — wat ook gebeurd is: 60 volledige
toernooien doorgerekend op chip-conservatie en vastlopers.
