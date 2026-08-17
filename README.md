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

**Bots die echt rekenen — en die jou lezen**
Elke bot schat zijn winkans met een Monte-Carlo simulatie tegen het werkelijke
aantal tegenstanders, en zet die af tegen de pot odds. Daarbovenop een karakter —
agressie, blufneiging en tightness:

| Bot | Stijl |
|---|---|
| 🦊 Vera | strak, straft hard af |
| 🐗 Mad Mo | elke pot is van hem |
| 🦅 Rook | leest je als een boek |
| 🐢 Nonna | wacht op de nuts |
| 🎲 Dice | gokt op gevoel |

Ze houden bij hoe jij speelt — hoe vaak je vrijwillig meedoet, hoe vaak je
verhoogt, en vooral hoe vaak je weglegt tegen een raise — en verschuiven hun
bluf- en callgrenzen daarop. Gemeten in simulatie: tegen een tegenstander die
bijna altijd foldt vallen ze in **65%** van de gevallen aan; tegen een station
dat nooit weglegt nog maar **16%**.

Daarnaast onthouden ze frustratie: wie net een dure pot verloor speelt een paar
handen agressiever. Korte stacks schakelen over op push-or-fold, en op hogere
toernooiniveaus rekenen de bots met meer simulaties en minder veiligheidsmarge.

Ze praten ook. Elke bot heeft een eigen stem, en wat ze zeggen hangt af van wat
ze werkelijk deden — een bluf-raise klinkt anders dan een waarderaise.

**Coach**
Na elke hand één zin over je leerzaamste beslissing, met de winkans en de pot
odds die je op dat moment écht had: *"Je foldde op de turn met 62% winkans,
terwijl 31% al genoeg was om te callen."* Optioneel een live winkansmeter
tijdens je beurt.

**Carrière en dagchallenge**
Een ladder van vier toernooien — Café-avond, Pokerclub, Casino, High Roller —
met eigen inleg, stack, prijzengeld en steeds scherpere bots. Je bankroll,
gewonnen niveaus en 15 prestaties staan in localStorage. De dagchallenge leidt
de shuffle af van de datum, dus iedereen speelt vandaag dezelfde kaarten; het
resultaat is met één klik te kopiëren.

**Presentatie**
- Echte kaartbeelden in pure CSS: pip-raster van 3×9 per rang met de onderste
  helft omgekeerd, één grote pip voor de aas, monogram voor boer/dame/heer
- 3D-flip bij het omdraaien, gedeald met vertraging per kaart
- Chips glijden naar de pot aan het eind van elke inzetronde, en van de pot naar
  de winnaar
- Vilt met gouden rail, chipstapels die meekleuren met het bedrag
- Winnende vijf kaarten lichten goud op bij de showdown
- Geluid via WebAudio — chips, kaarten, all-in, fanfare. Nul audiobestanden.
- Alles schaalt op één CSS-variabele mee met het scherm; aparte tafelverhouding
  voor portret en landschap

**Bediening en comfort**
- Instelbaar tempo (traag / normaal / snel) en een bedenktijdklok (uit / 30s / 15s)
- Check/Fold en Call any vooraf aanvinken terwijl de bots nog denken
- Pot odds bij de callknop, je actuele hand in beeld, winreeks- en blindteller
- Hand kopiëren naar het klembord om te delen

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
lib/cards.ts         kaarten, deck, schudden (met injecteerbare RNG)
lib/rng.ts           deterministische generator + zaadje van de dag
lib/evaluator.ts     beste 5 uit 7, vergelijkbare score
lib/equity.ts        Monte-Carlo winkans
lib/engine.ts        volledige spelstatus + regels + side pots + spelersreads
lib/ai.ts            botbeslissingen, aangepast aan de tegenstander
lib/chatter.ts       tafelpraat per bot
lib/coach.ts         beoordeling van je beslissingen
lib/tiers.ts         toernooiladder en prijzengeld
lib/achievements.ts  prestaties
lib/stats.ts         localStorage: statistieken, voortgang, instellingen
lib/sound.ts         WebAudio-synth
components/          tafel, stoelen, kaarten, chips, knoppen, lobby
```

De engine is puur: elke functie neemt een `GameState` en geeft een nieuwe terug.
Daardoor is hij los van React te simuleren — wat ook gebeurd is. De laatste
controle: 48 volledige toernooien over alle vier de niveaus, 752 handen, zonder
chip-lekken, zonder vastlopers, met consistente spelersreads en correcte side
pots. Het zaadje van de dag gaf in Node dezelfde eerste hand als in de browser.
