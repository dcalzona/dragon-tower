/**
 * Le colonne sonore, scritte come musica invece che come pattern.
 *
 * La prima versione stancava presto, per tre motivi precisi: il giro durava solo
 * 8 battute (una dozzina di secondi), l'arpeggio martellava ogni ottavo dall'inizio
 * alla fine, e la melodia stava tutta sulla stessa griglia ritmica senza mai una
 * pausa. Qui si rimedia a tutti e tre:
 *
 * - **giri da 16 battute**, quindi il doppio del respiro prima di ripetersi;
 * - **frasi vere**: note lunghe in chiusura, silenzi fra una frase e l'altra,
 *   durate diverse. Il silenzio è ciò che fa cantare una melodia;
 * - **arrangiamento dinamico**: ogni battuta ha il suo stile, dal quasi-silenzio
 *   al pieno. L'accompagnamento respira invece di macinare.
 */

const STEPS_PER_BAR = 16;
export const BARS = 16;
export const TOTAL_STEPS = STEPS_PER_BAR * BARS;

/** Triade di ogni accordo usato, più la nota di basso. */
const ACCORDI = {
  Am: { note: ['A3', 'C4', 'E4'], radice: 'A' },
  Dm: { note: ['D4', 'F4', 'A4'], radice: 'D' },
  Em: { note: ['E3', 'G3', 'B3'], radice: 'E' },
  Gm: { note: ['G3', 'A#3', 'D4'], radice: 'G' },
  F: { note: ['F3', 'A3', 'C4'], radice: 'F' },
  G: { note: ['G3', 'B3', 'D4'], radice: 'G' },
  C: { note: ['C4', 'E4', 'G4'], radice: 'C' },
  E: { note: ['E3', 'G#3', 'B3'], radice: 'E' },
  A: { note: ['A3', 'C#4', 'E4'], radice: 'A' },
  Bb: { note: ['A#3', 'D4', 'F4'], radice: 'A#' },
  B: { note: ['B3', 'D#4', 'F#4'], radice: 'B' },
  // Diminuito: le tre note a distanza uguale, il suono dell'inquietudine.
  Ddim: { note: ['D4', 'F4', 'G#4'], radice: 'D' },
};

/**
 * Stili di arrangiamento, dal respiro al pieno. Sono la dinamica del pezzo:
 * alternandoli battuta per battuta il brano sale e scende invece di stare
 * sempre allo stesso livello.
 */
const STILI = {
  // quasi silenzio: solo un accordo tenuto, per lasciare spazio alla melodia
  sospeso: { bass: [[0, 8], [8, 8]], ottave: [0], arp: 'pad', kick: [0], snare: [], hatOgni: 8 },
  quieto: { bass: [[0, 8], [8, 8]], ottave: [0], arp: 'pad', kick: [0], snare: [], hatOgni: 8 },
  medio: {
    bass: [[0, 4], [6, 2], [8, 4], [14, 2]],
    ottave: [0, 0, 1, 0],
    arp: 'arp',
    kick: [0, 8],
    snare: [12],
    hatOgni: 4,
  },
  pieno: {
    bass: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    ottave: [0, 0, 1, 0, 0, 0, 1, 0],
    arp: 'arp',
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hatOgni: 2,
  },
};

function costruisci(track) {
  const bass = [];
  const arpeggio = [];
  const drums = [];

  track.giro.forEach((nomeAccordo, bar) => {
    const acc = ACCORDI[nomeAccordo];
    const stile = STILI[track.stili[bar]] || STILI.medio;
    const base = bar * STEPS_PER_BAR;

    stile.bass.forEach(([s, dur], i) => {
      const ottava = stile.ottave[i % stile.ottave.length] ? 3 : 2;
      bass.push([base + s, `${acc.radice}${ottava}`, dur]);
    });

    if (stile.arp === 'pad') {
      // Accordo tenuto: un tappeto, non un motorino. Il quarto valore dice al
      // motore di sostenerlo invece di lasciarlo spegnere a meta' battuta.
      acc.note.forEach((n) => arpeggio.push([base, n, 16, true]));
    } else {
      // arpeggio a passo di quarto, non di ottavo: molto meno insistente
      for (let i = 0; i < 4; i++) {
        arpeggio.push([base + i * 4 + 2, acc.note[i % acc.note.length], 3]);
      }
    }

    stile.kick.forEach((s) => drums.push([base + s, 'kick']));
    stile.snare.forEach((s) => drums.push([base + s, 'snare']));
    if (stile.hatOgni > 0) {
      for (let s = 0; s < STEPS_PER_BAR; s += stile.hatOgni) drums.push([base + s, 'hat']);
    }
  });

  return { ...track, bass, arpeggio, drums };
}

export const TRACKS = [
  {
    id: 'soglia',
    name: 'La Soglia',
    floors: 'piani 1-10',
    bpm: 128,
    leadType: 'square',
    leadFilter: 2600,
    // La minore. Prima frase che sale e ricade, seconda che risponde più in alto.
    giro: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'E', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'E'],
    stili: [
      'quieto', 'quieto', 'medio', 'medio', 'medio', 'medio', 'pieno', 'sospeso',
      'medio', 'medio', 'pieno', 'sospeso', 'pieno', 'pieno', 'pieno', 'sospeso',
    ],
    melody: [
      [0, 'A4', 4], [4, 'C5', 4], [8, 'E5', 6], [14, 'D5', 2],
      [16, 'C5', 8], [24, 'B4', 4], [28, 'A4', 4],
      [32, 'F5', 4], [36, 'E5', 4], [40, 'C5', 8],
      [48, 'D5', 6], [54, 'B4', 2], [56, 'G4', 6],
      [64, 'A4', 4], [68, 'C5', 4], [72, 'E5', 4], [76, 'A5', 4],
      [80, 'G#5', 8], [88, 'E5', 4], [92, 'C5', 4],
      [96, 'B4', 4], [100, 'D#5', 4], [104, 'E5', 6],
      [112, 'A4', 7],
      [128, 'C6', 4], [132, 'A5', 4], [136, 'F5', 6], [142, 'G5', 2],
      [144, 'E5', 8], [152, 'G5', 4], [156, 'C6', 4],
      [160, 'B5', 4], [164, 'A5', 4], [168, 'G5', 6], [174, 'D5', 2],
      [176, 'A5', 7],
      [192, 'F5', 4], [196, 'A5', 4], [200, 'C6', 4], [204, 'A5', 4],
      [208, 'G5', 4], [212, 'B5', 4], [216, 'D6', 8],
      [224, 'C6', 4], [228, 'B5', 4], [232, 'G#5', 8],
      [240, 'B4', 6],
    ],
  },
  {
    id: 'cripte',
    name: 'Le Cripte',
    floors: 'piani 11-20',
    bpm: 140,
    leadType: 'square',
    leadFilter: 3000,
    // Re minore: più mossa e inquieta della prima, ma sempre a frasi.
    giro: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'F', 'Gm', 'A', 'Dm', 'Bb', 'A', 'A'],
    stili: [
      'medio', 'medio', 'pieno', 'pieno', 'pieno', 'pieno', 'pieno', 'sospeso',
      'medio', 'medio', 'pieno', 'sospeso', 'pieno', 'pieno', 'pieno', 'sospeso',
    ],
    melody: [
      [0, 'D5', 4], [4, 'F5', 4], [8, 'A5', 6], [14, 'G5', 2],
      [16, 'F5', 8], [24, 'E5', 4], [28, 'D5', 4],
      [32, 'A#5', 4], [36, 'A5', 4], [40, 'F5', 8],
      [48, 'E5', 6], [54, 'C#5', 2], [56, 'A4', 6],
      [64, 'D5', 4], [68, 'F5', 4], [72, 'A5', 4], [76, 'D6', 4],
      [80, 'A#5', 8], [88, 'A5', 4], [92, 'G5', 4],
      [96, 'C#5', 4], [100, 'E5', 4], [104, 'A5', 8],
      [112, 'D5', 7],
      [128, 'F5', 4], [132, 'A#5', 4], [136, 'D6', 6], [142, 'C6', 2],
      [144, 'A5', 8], [152, 'C6', 4], [156, 'A5', 4],
      [160, 'G5', 4], [164, 'A#5', 4], [168, 'D6', 6], [174, 'C6', 2],
      [176, 'C#6', 7],
      [192, 'D6', 4], [196, 'A5', 4], [200, 'F5', 4], [204, 'D5', 4],
      [208, 'A#4', 4], [212, 'D5', 4], [216, 'F5', 8],
      [224, 'E5', 4], [228, 'C#5', 4], [232, 'A4', 8],
      [240, 'A4', 6],
    ],
  },
  {
    id: 'cristallo',
    name: 'Il Cristallo',
    floors: 'piani 21-30',
    bpm: 112,
    leadType: 'triangle', // timbro più morbido: è il brano più lungo da ascoltare
    leadFilter: 2300,
    // Mi minore, ampia e solenne: note lunghe, molta aria.
    giro: ['Em', 'Em', 'C', 'B', 'Em', 'Am', 'B', 'Em', 'C', 'G', 'Am', 'B', 'Em', 'C', 'B', 'Em'],
    stili: [
      'quieto', 'quieto', 'quieto', 'medio', 'medio', 'medio', 'medio', 'sospeso',
      'medio', 'medio', 'pieno', 'sospeso', 'pieno', 'medio', 'medio', 'sospeso',
    ],
    melody: [
      [0, 'E5', 6], [6, 'F#5', 2], [8, 'G5', 8],
      [16, 'B5', 8], [24, 'A5', 4], [28, 'G5', 4],
      [32, 'E5', 4], [36, 'G5', 4], [40, 'C6', 8],
      [48, 'B5', 6], [54, 'A5', 2], [56, 'F#5', 6],
      [64, 'E5', 4], [68, 'G5', 4], [72, 'B5', 8],
      [80, 'C6', 8], [88, 'B5', 4], [92, 'A5', 4],
      [96, 'F#5', 4], [100, 'D#5', 4], [104, 'B4', 6],
      [112, 'E5', 7],
      [128, 'G5', 4], [132, 'C6', 4], [136, 'E6', 6], [142, 'D6', 2],
      [144, 'B5', 8], [152, 'D6', 4], [156, 'B5', 4],
      [160, 'A5', 4], [164, 'C6', 4], [168, 'E6', 8],
      [176, 'D#6', 7],
      [192, 'E6', 4], [196, 'B5', 4], [200, 'G5', 4], [204, 'E5', 4],
      [208, 'C5', 4], [212, 'E5', 4], [216, 'G5', 8],
      [224, 'F#5', 4], [228, 'D#5', 4], [232, 'B4', 8],
      [240, 'E5', 6],
    ],
  },
  {
    id: 'guardiano',
    name: 'Il Guardiano',
    floors: 'scontro col boss',
    bpm: 160,
    leadType: 'square',
    leadFilter: 3400,
    // Re minore col diminuito e il Sol# a tritono dal Re: l'intervallo che da
    // secoli si usa per dire che qualcosa non va. Nessuna battuta di riposo,
    // ma la melodia ha comunque una forma, non è una raffica.
    giro: ['Dm', 'Dm', 'Ddim', 'A', 'Dm', 'Dm', 'Bb', 'A', 'Dm', 'Ddim', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A'],
    // Nessuna battuta di riposo, ma un arco c'e': si parte raccolti e si cresce.
    stili: [
      'medio', 'medio', 'pieno', 'pieno', 'pieno', 'pieno', 'pieno', 'medio',
      'pieno', 'pieno', 'pieno', 'pieno', 'pieno', 'pieno', 'pieno', 'medio',
    ],
    melody: [
      [0, 'D5', 2], [2, 'D5', 2], [4, 'F5', 4], [8, 'D5', 2], [10, 'A4', 2], [12, 'D5', 4],
      [16, 'A5', 4], [20, 'G5', 2], [22, 'F5', 2], [24, 'E5', 4], [28, 'D5', 4],
      [32, 'G#5', 4], [36, 'F5', 4], [40, 'D5', 8],
      [48, 'C#5', 4], [52, 'E5', 4], [56, 'A5', 8],
      [64, 'D6', 2], [66, 'C6', 2], [68, 'A#5', 2], [70, 'A5', 2], [72, 'F5', 4], [76, 'D5', 4],
      [80, 'A5', 4], [84, 'F5', 4], [88, 'D5', 8],
      [96, 'A#5', 4], [100, 'A5', 4], [104, 'F5', 8],
      [112, 'A5', 4], [116, 'G#5', 4], [120, 'A5', 5],
      [128, 'D5', 2], [130, 'F5', 2], [132, 'A5', 2], [134, 'D6', 2], [136, 'C#6', 8],
      [144, 'D6', 4], [148, 'G#5', 4], [152, 'F5', 8],
      [160, 'A#5', 2], [162, 'D6', 2], [164, 'F6', 4], [168, 'D6', 8],
      [176, 'E6', 4], [180, 'C#6', 4], [184, 'A5', 8],
      [192, 'D6', 4], [196, 'A5', 4], [200, 'F5', 4], [204, 'D5', 4],
      [208, 'G5', 4], [212, 'A#5', 4], [216, 'D6', 8],
      [224, 'C#6', 4], [228, 'E6', 4], [232, 'A5', 8],
      [240, 'A5', 4], [244, 'G#5', 4], [248, 'A5', 5],
    ],
  },
].map(costruisci);

/** I primi tre brani seguono i piani; l'ultimo è riservato agli scontri. */
const DEPTH_TRACKS = 3;
export const BOSS_TRACK = 3;
export const TRACK_COUNT = TRACKS.length;

export function trackIndexForDepth(depth) {
  return Math.max(0, Math.min(DEPTH_TRACKS - 1, Math.floor((depth - 1) / 10)));
}
