// Motore audio: colonne sonore gotiche in stile Castlevania, generate nota per nota,
// più gli effetti sonori. Nessun file audio esterno: tutto sintetizzato con la Web Audio API.

const SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = SEMITONES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const STEPS_PER_BAR = 16;
const BARS = 8;
const TOTAL_STEPS = STEPS_PER_BAR * BARS;

// Basso "a galoppo": il motore ritmico. 1 = salto d'ottava sopra.
function buildBass(roots, shape) {
  const out = [];
  roots.forEach((root, bar) => {
    shape.forEach((oct, i) => {
      out.push([bar * STEPS_PER_BAR + i * 2, `${root}${oct ? 3 : 2}`, 2]);
    });
  });
  return out;
}

// Arpeggio d'accompagnamento, tipo clavicembalo, sotto la melodia.
function buildArpeggio(roots, chords) {
  const out = [];
  roots.forEach((root, bar) => {
    const chord = chords[root];
    for (let i = 0; i < 8; i++) {
      out.push([bar * STEPS_PER_BAR + i * 2 + 1, chord[i % chord.length], 2]);
    }
  });
  return out;
}

/**
 * Tre colonne sonore, una ogni dieci piani: la Torre cambia carattere man mano
 * che si scende. Tutte in minore armonica — è la scala che dà il colore gotico —
 * ma in tonalità, tempi e cadenze diverse, così si riconoscono subito.
 */
const TRACKS = [
  {
    id: 'soglia',
    name: 'La Soglia',
    floors: 'piani 1-10',
    bpm: 152,
    // La minore armonica su cadenza andalusa discendente Am · G · F · E.
    roots: ['A', 'G', 'F', 'E', 'A', 'G', 'F', 'E'],
    chords: { A: ['A4', 'C5', 'E5'], G: ['G4', 'B4', 'D5'], F: ['F4', 'A4', 'C5'], E: ['E4', 'G#4', 'B4'] },
    bassShape: [0, 0, 1, 0, 0, 0, 1, 0],
    kick: [0, 7, 8],
    snare: [4, 12],
    leadFilter: 2900,
    melody: [
      [0, 'E5', 4], [4, 'A5', 2], [6, 'G#5', 2], [8, 'A5', 4], [12, 'E5', 2], [14, 'C5', 2],
      [16, 'D5', 4], [20, 'G5', 2], [22, 'F#5', 2], [24, 'G5', 4], [28, 'D5', 2], [30, 'B4', 2],
      [32, 'C5', 4], [36, 'F5', 2], [38, 'E5', 2], [40, 'F5', 4], [44, 'C5', 2], [46, 'A4', 2],
      [48, 'B4', 4], [52, 'E5', 2], [54, 'D#5', 2], [56, 'E5', 8],
      [64, 'A5', 2], [66, 'B5', 2], [68, 'C6', 2], [70, 'B5', 2], [72, 'A5', 4], [76, 'G#5', 4],
      [80, 'G5', 2], [82, 'A5', 2], [84, 'B5', 2], [86, 'A5', 2], [88, 'G5', 4], [92, 'F#5', 4],
      [96, 'F5', 2], [98, 'G5', 2], [100, 'A5', 2], [102, 'G5', 2], [104, 'F5', 4], [108, 'E5', 4],
      [112, 'E5', 2], [114, 'F5', 2], [116, 'G#5', 2], [118, 'B5', 2], [120, 'E5', 8],
    ],
  },
  {
    id: 'cripte',
    name: 'Le Cripte',
    floors: 'piani 11-20',
    bpm: 168,
    // Re minore armonica, cadenza i · VI · iv · V. Più veloce e incalzante:
    // il basso batte tutti gli ottavi senza respiro.
    roots: ['D', 'A#', 'G', 'A', 'D', 'A#', 'G', 'A'],
    chords: {
      D: ['D4', 'F4', 'A4'],
      'A#': ['A#3', 'D4', 'F4'],
      G: ['G3', 'A#3', 'D4'],
      A: ['A3', 'C#4', 'E4'],
    },
    bassShape: [0, 1, 0, 1, 0, 1, 0, 1],
    kick: [0, 3, 8, 11],
    snare: [4, 12],
    leadFilter: 3300,
    melody: [
      [0, 'D5', 2], [2, 'A5', 2], [4, 'F5', 2], [6, 'D5', 2], [8, 'C#5', 4], [12, 'D5', 4],
      [16, 'A#4', 2], [18, 'F5', 2], [20, 'D5', 2], [22, 'A#4', 2], [24, 'A4', 4], [28, 'A#4', 4],
      [32, 'G4', 2], [34, 'D5', 2], [36, 'A#4', 2], [38, 'G5', 2], [40, 'F5', 4], [44, 'D5', 4],
      [48, 'A4', 2], [50, 'E5', 2], [52, 'C#5', 2], [54, 'A5', 2], [56, 'A5', 8],
      [64, 'D6', 2], [66, 'C#6', 2], [68, 'A5', 2], [70, 'F5', 2], [72, 'D5', 4], [76, 'A5', 4],
      [80, 'A#5', 2], [82, 'A5', 2], [84, 'F5', 2], [86, 'D5', 2], [88, 'A#4', 4], [92, 'F5', 4],
      [96, 'G5', 2], [98, 'F5', 2], [100, 'D5', 2], [102, 'A#4', 2], [104, 'G4', 4], [108, 'D5', 4],
      [112, 'E5', 2], [114, 'F5', 2], [116, 'A5', 2], [118, 'C#6', 2], [120, 'D6', 8],
    ],
  },
  {
    id: 'cristallo',
    name: 'Il Cristallo',
    floors: 'piani 21-30',
    bpm: 138,
    // Mi minore armonica, i · VI · iv · V. Più lenta e solenne delle altre due:
    // note lunghe e tenute, per chiudere in tono grandioso invece che frenetico.
    roots: ['E', 'C', 'A', 'B', 'E', 'C', 'A', 'B'],
    chords: {
      E: ['E4', 'G4', 'B4'],
      C: ['C4', 'E4', 'G4'],
      A: ['A3', 'C4', 'E4'],
      B: ['B3', 'D#4', 'F#4'],
    },
    bassShape: [0, 0, 0, 1, 0, 0, 1, 0],
    kick: [0, 8],
    snare: [4, 12],
    leadFilter: 2500,
    melody: [
      [0, 'B4', 4], [4, 'E5', 2], [6, 'G5', 2], [8, 'F#5', 4], [12, 'E5', 4],
      [16, 'C5', 4], [20, 'G5', 2], [22, 'E5', 2], [24, 'D5', 4], [28, 'C5', 4],
      [32, 'A4', 4], [36, 'E5', 2], [38, 'C5', 2], [40, 'B4', 4], [44, 'A4', 4],
      [48, 'B4', 4], [52, 'D#5', 2], [54, 'F#5', 2], [56, 'B5', 8],
      [64, 'E6', 2], [66, 'D#6', 2], [68, 'B5', 2], [70, 'G5', 2], [72, 'E5', 4], [76, 'B5', 4],
      [80, 'C6', 2], [82, 'B5', 2], [84, 'G5', 2], [86, 'E5', 2], [88, 'C5', 4], [92, 'G5', 4],
      [96, 'A5', 2], [98, 'G5', 2], [100, 'E5', 2], [102, 'C5', 2], [104, 'A4', 4], [108, 'E5', 4],
      [112, 'F#5', 2], [114, 'G5', 2], [116, 'B5', 2], [118, 'D#6', 2], [120, 'E6', 8],
    ],
  },
].map((t) => ({
  ...t,
  bass: buildBass(t.roots, t.bassShape),
  arpeggio: buildArpeggio(t.roots, t.chords),
}));

export const TRACK_COUNT = TRACKS.length;

/** Un brano ogni dieci piani; oltre l'ultimo scaglione resta il terzo. */
export function trackIndexForDepth(depth) {
  return Math.max(0, Math.min(TRACKS.length - 1, Math.floor((depth - 1) / 10)));
}

const MUSIC_LEVEL = 0.34;
const SFX_LEVEL = 0.6;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.mode = 'full'; // 'full' = musica + effetti · 'sfx' = solo effetti · 'off' = muto
    this.trackIndex = 0;
    this.playing = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.timer = null;
    this.intensity = 1;
  }

  /** Va chiamato da un gesto dell'utente (le policy dei browser bloccano l'audio automatico). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? MUSIC_LEVEL : 0;
    this.musicBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? SFX_LEVEL : 0;
    this.sfxBus.connect(this.master);

    this.noiseBuffer = this._makeNoise();
  }

  get musicOn() {
    return this.mode === 'full';
  }

  get sfxOn() {
    return this.mode !== 'off';
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  startMusic() {
    if (!this.ctx || this.playing || !this.musicOn) return;
    this.playing = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._scheduler(), 25);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this._swapTimer);
  }

  /**
   * Sospende tutto quando l'app finisce in secondo piano. Senza questo la musica
   * continua a suonare a icona ridotta e l'unico modo per zittirla è chiudere il
   * gioco. Ferma anche lo scheduler, altrimenti continuerebbe a creare note.
   */
  suspend() {
    if (!this.ctx) return;
    this._stepSalvato = this.step;
    this._suonavaPrima = this.playing;
    this.stopMusic();
    if (this.ctx.state === 'running') this.ctx.suspend();
  }

  /** Riprende da dov'era, senza far ripartire il brano dall'inizio. */
  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this._suonavaPrima && this.musicOn) {
      this.startMusic();
      this.step = this._stepSalvato || 0;
    }
  }

  /** Cicla musica+effetti → solo effetti → muto. */
  cycleMode() {
    const order = ['full', 'sfx', 'off'];
    this.setMode(order[(order.indexOf(this.mode) + 1) % order.length]);
    return this.mode;
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Rampa lineare, non setTargetAtTime: l'esponenziale tende a zero senza mai
    // arrivarci e lascerebbe la musica a filo di volume invece che spenta.
    this._ramp(this.musicBus.gain, this.musicOn ? MUSIC_LEVEL : 0, now, 0.12);
    this._ramp(this.sfxBus.gain, this.sfxOn ? SFX_LEVEL : 0, now, 0.04);

    // Con la musica spenta fermiamo anche lo scheduler: niente nodi creati a vuoto.
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
  }

  _ramp(param, target, now, dur) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + dur);
  }

  get modeLabel() {
    return { full: 'Musica + effetti', sfx: 'Solo effetti', off: 'Muto' }[this.mode];
  }

  /** Alza la tensione musicale nei piani profondi. */
  setIntensity(depth) {
    this.intensity = Math.min(2, 1 + depth / 22);
  }

  get track() {
    return TRACKS[this.trackIndex];
  }

  /**
   * Cambia colonna sonora in base al piano. Il passaggio avviene in dissolvenza:
   * tagliare di netto a metà battuta si sentirebbe come un errore.
   */
  setDepth(depth, force = false) {
    this.setIntensity(depth);
    const next = trackIndexForDepth(depth);
    if (next === this.trackIndex && !force) return null;
    const changed = next !== this.trackIndex;
    this.trackIndex = next;
    if (!this.ctx) return changed ? this.track : null;

    if (this.musicOn) {
      const now = this.ctx.currentTime;
      this._ramp(this.musicBus.gain, 0, now, 0.35);
      clearTimeout(this._swapTimer);
      this._swapTimer = setTimeout(() => {
        if (!this.musicOn) return;
        this.stopMusic();
        this.step = 0;
        this.startMusic();
        this._ramp(this.musicBus.gain, MUSIC_LEVEL, this.ctx.currentTime, 0.5);
      }, 400);
    }
    // Solo un cambio vero merita l'annuncio a schermo; un riavvio forzato no.
    return changed ? this.track : null;
  }

  _scheduler() {
    if (!this.ctx || !this.playing) return;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      this._scheduleStep(this.step, this.nextNoteTime, stepDur);
      this.step = (this.step + 1) % TOTAL_STEPS;
      this.nextNoteTime += stepDur;
    }
  }

  _scheduleStep(step, time, stepDur) {
    const track = this.track;
    track.melody.forEach(([s, note, dur]) => {
      if (s === step) this._lead(freq(note), time, dur * stepDur * 0.96, track.leadFilter);
    });
    track.bass.forEach(([s, note, dur]) => {
      if (s === step) this._bass(freq(note), time, dur * stepDur * 0.82);
    });
    track.arpeggio.forEach(([s, note, dur]) => {
      if (s === step) this._arp(freq(note), time, dur * stepDur * 0.7);
    });

    const inBar = step % STEPS_PER_BAR;
    if (track.kick.includes(inBar)) this._kick(time);
    if (track.snare.includes(inBar)) this._snare(time);
    if (inBar % 2 === 0) this._hat(time, inBar % 4 === 0 ? 0.05 : 0.026);
  }

  /** Lead a onda quadra con vibrato ritardato: il canto espressivo tipico del chip NES. */
  _lead(f, time, dur, cutoff = 2900) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff + this.intensity * 700;

    o.type = 'square';
    o.frequency.setValueAtTime(f, time);

    // Il vibrato entra dopo l'attacco, come farebbe un musicista.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 5.6;
    lfoGain.gain.setValueAtTime(0, time);
    lfoGain.gain.linearRampToValueAtTime(f * 0.016, time + Math.min(0.2, dur * 0.55));
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);

    // Inviluppo sostenuto: la melodia deve cantare, non solo pungere.
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.2, time + 0.012);
    g.gain.linearRampToValueAtTime(0.155, time + Math.min(0.12, dur * 0.4));
    g.gain.setValueAtTime(0.155, time + dur * 0.82);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    o.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    lfo.start(time);
    o.stop(time + dur + 0.02);
    lfo.stop(time + dur + 0.02);
  }

  /** Arpeggio d'accompagnamento, tenuto basso di volume per non coprire il canto. */
  _arp(f, time, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1800;
    o.type = 'square';
    o.frequency.setValueAtTime(f, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.062, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  _bass(f, time, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.34, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  _kick(time) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(45, time + 0.11);
    g.gain.setValueAtTime(0.42, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(time);
    o.stop(time + 0.18);
  }

  _snare(time) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    s.start(time);
    s.stop(time + 0.15);
  }

  _hat(time, vol) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    s.start(time);
    s.stop(time + 0.06);
  }

  // ---- Effetti sonori ----

  sfx(name) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'swing':
        this._blip('square', 700, 260, t, 0.09, 0.13);
        break;
      case 'hit':
        this._blip('square', 320, 90, t, 0.12, 0.2);
        this._noiseBurst(t, 0.09, 0.16, 900);
        break;
      case 'kill':
        this._blip('sawtooth', 420, 70, t, 0.24, 0.22);
        this._noiseBurst(t, 0.2, 0.14, 500);
        break;
      case 'hurt':
        this._blip('sawtooth', 260, 70, t, 0.26, 0.3);
        break;
      case 'pickup':
        this._blip('square', freq('E5'), freq('E5'), t, 0.09, 0.2);
        this._blip('square', freq('B5'), freq('B5'), t + 0.08, 0.11, 0.2);
        break;
      case 'potion':
        this._blip('triangle', freq('C5'), freq('C6'), t, 0.22, 0.25);
        break;
      case 'levelup':
        ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
          this._blip('square', freq(n), freq(n), t + i * 0.07, 0.14, 0.22);
        });
        break;
      case 'stairs':
        ['G4', 'C5', 'E5'].forEach((n, i) => {
          this._blip('triangle', freq(n), freq(n), t + i * 0.06, 0.16, 0.22);
        });
        break;
      case 'death':
        ['A4', 'F4', 'D4', 'A3'].forEach((n, i) => {
          this._blip('sawtooth', freq(n), freq(n) * 0.98, t + i * 0.16, 0.3, 0.26);
        });
        break;
      case 'transform':
        // accordo che sale: la metamorfosi
        ['A3', 'C#4', 'E4', 'A4', 'C#5', 'E5', 'A5'].forEach((n, i) => {
          this._blip('sawtooth', freq(n), freq(n), t + i * 0.055, 0.4, 0.16);
        });
        this._blip('triangle', 110, 880, t, 0.6, 0.2);
        this._noiseBurst(t, 0.16, 0.5, 600);
        break;
      case 'fire':
        this._noiseBurst(t, 0.13, 0.24, 420);
        this._blip('sawtooth', 460, 130, t, 0.24, 0.11);
        break;
      case 'boss':
        // tre rintocchi gravi: l'arrivo del guardiano
        [0, 0.26, 0.52].forEach((d, i) => {
          this._blip('sawtooth', 98 - i * 8, 92 - i * 8, t + d, 0.5, 0.3);
        });
        this._noiseBurst(t, 0.2, 0.6, 260);
        break;
      case 'bossdown':
        ['A4', 'E4', 'C4', 'A3', 'E3'].forEach((n, i) => {
          this._blip('sawtooth', freq(n), freq(n) * 0.96, t + i * 0.13, 0.5, 0.24);
        });
        this._noiseBurst(t, 0.3, 0.9, 200);
        break;
      case 'charge':
        this._blip('sawtooth', 180, 620, t, 0.3, 0.2);
        break;
      case 'volley':
        this._blip('square', 900, 340, t, 0.18, 0.16);
        break;
      case 'summon':
        this._blip('triangle', 320, 720, t, 0.3, 0.18);
        this._noiseBurst(t, 0.1, 0.25, 800);
        break;
      case 'ready':
        ['C5', 'G5', 'C6'].forEach((n, i) => {
          this._blip('triangle', freq(n), freq(n), t + i * 0.08, 0.3, 0.2);
        });
        break;
      case 'boost':
        ['E5', 'G#5', 'B5', 'E6'].forEach((n, i) => {
          this._blip('square', freq(n), freq(n), t + i * 0.06, 0.2, 0.2);
        });
        this._blip('triangle', 220, 880, t, 0.34, 0.16);
        break;
      case 'menu':
        this._blip('square', 620, 620, t, 0.05, 0.14);
        break;
      case 'confirm':
        this._blip('square', 520, 900, t, 0.13, 0.2);
        break;
      default:
        break;
    }
  }

  _blip(type, f0, f1, time, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), time);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), time + dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  _noiseBurst(time, vol, dur, hp) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    s.start(time);
    s.stop(time + dur + 0.02);
  }
}
