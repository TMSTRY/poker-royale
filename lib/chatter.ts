export type ChatCtx =
  | "shove"
  | "bluffRaise"
  | "valueRaise"
  | "fold"
  | "winShowdown"
  | "winFold"
  | "lostBig"
  | "bust"
  | "heroShove"
  | "heroWinBig"
  | "levelUp";

type Lines = Partial<Record<ChatCtx, string[]>>;

const VOICES: Record<string, Lines> = {
  Vera: {
    shove: ["Alles.", "Dan doen we het zo."],
    bluffRaise: ["Betaal maar.", "Ik zit hier goed."],
    valueRaise: ["Dat wordt duur.", "Ik verhoog. Denk rustig na."],
    fold: ["Niet vandaag.", "Weg ermee."],
    winShowdown: ["Netjes.", "Zoals verwacht."],
    winFold: ["Verstandig van jullie.", "Ook goed."],
    lostBig: ["Vervelend.", "Genoteerd."],
    bust: ["Tot ziens dan.", "Dat was dat."],
    heroShove: ["Interessant.", "Je bent er klaar mee, hè?"],
    heroWinBig: ["Goed gespeeld. Eén keer.", "Geniet ervan."],
    levelUp: ["Nu wordt het serieus."],
  },
  "Mad Mo": {
    shove: ["ALLES ERIN!", "KOM DAN!", "Ik ruik bloed."],
    bluffRaise: ["Die pot is van mij.", "Durf je?", "Betalen!"],
    valueRaise: ["Meer, meer, meer.", "Dit wordt mijn hand."],
    fold: ["Bah.", "Hou maar."],
    winShowdown: ["ZEI IK TOCH!", "Van mij, van mij, van mij."],
    winFold: ["Bangeriken.", "Te makkelijk."],
    lostBig: ["Dat is niet eerlijk!", "Onmogelijk!"],
    bust: ["Dit was doorgestoken kaart.", "Ik wil een hertelling."],
    heroShove: ["Eindelijk iemand met lef!", "Oeh, spannend."],
    heroWinBig: ["Geluk. Puur geluk.", "Dat pak ik terug."],
    levelUp: ["Hogere blinds, meer plezier."],
  },
  Rook: {
    shove: ["De wiskunde zegt alles.", "Dit is het moment."],
    bluffRaise: ["Je range is te zwak hier.", "Ik zet je onder druk."],
    valueRaise: ["Je zit vast, vrees ik.", "Ik verhoog voor waarde."],
    fold: ["Je hebt het. Ik geloof je.", "Verkeerde prijs."],
    winShowdown: ["Voorspelbaar.", "Precies zoals berekend."],
    winFold: ["Je twijfelde te lang.", "Je timing verraadde je."],
    lostBig: ["Variantie.", "Statistisch gezien pech."],
    bust: ["De kansen keerden niet.", "Ik had gelijk, alleen niet vaak genoeg."],
    heroShove: ["Dat is een grote hint.", "Nu weet ik iets."],
    heroWinBig: ["Correct gespeeld, dat geef ik toe.", "Genoteerd voor later."],
    levelUp: ["De blinds dwingen actie af."],
  },
  Nonna: {
    shove: ["Vooruit dan maar.", "Op mijn leeftijd wacht je niet meer."],
    bluffRaise: ["Ach, waarom niet.", "Even kijken wat je doet."],
    valueRaise: ["Ik heb wat, lieverd.", "Dit is een goeie."],
    fold: ["Ik wacht wel op een betere.", "Geduld, altijd geduld."],
    winShowdown: ["Zie je wel, wachten loont.", "Dank je, jongen."],
    winFold: ["Lief van jullie.", "Da's ook een manier."],
    lostBig: ["Zo gaat dat soms.", "Het is maar een spel."],
    bust: ["Ik ga een kopje thee zetten.", "Het was gezellig."],
    heroShove: ["Rustig maar, jongen.", "Zo'n haast."],
    heroWinBig: ["Goed gedaan, hoor.", "Mooi gespeeld."],
    levelUp: ["Het gaat wat snel nu."],
  },
  Dice: {
    shove: ["Waarom niet.", "Gevoel zegt ja.", "Alles of niets, hè."],
    bluffRaise: ["Ik voel iets.", "Gokje.", "Dit lijkt me een goed idee."],
    valueRaise: ["Toevallig heb ik dit keer wat.", "Verhogen dan maar."],
    fold: ["Nee, gevoel is weg.", "Volgende."],
    winShowdown: ["Zie je, intuïtie!", "Wist ik het toch."],
    winFold: ["Werkt ook.", "Zonder kaarten te laten zien, nog leuker."],
    lostBig: ["Foutje.", "Volgende keer beter."],
    bust: ["Was leuk zolang het duurde.", "Ik hou het hierbij."],
    heroShove: ["Oeh, we gaan ervoor.", "Ik hou van deze energie."],
    heroWinBig: ["Nette pot.", "Mag ik wat lenen?"],
    levelUp: ["Sneller, sneller."],
  },
};

const FALLBACK: Lines = {
  shove: ["All-in."],
  fold: ["Ik pas."],
  winShowdown: ["Die is van mij."],
};

/**
 * Geeft een zin terug, of null als deze bot in deze situatie niets zegt.
 * `chance` bepaalt hoe spraakzaam het is.
 */
export function chatterFor(name: string, ctx: ChatCtx, chance = 0.3): string | null {
  if (Math.random() > chance) return null;
  const lines = VOICES[name]?.[ctx] ?? FALLBACK[ctx];
  if (!lines || lines.length === 0) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}
