// Motore audio: colonne sonore gotiche in stile Castlevania, generate nota per nota,
// più gli effetti sonori. Nessun file audio esterno: tutto sintetizzato con la Web Audio API.

import { TRACKS, TOTAL_STEPS, BOSS_TRACK, TRACK_COUNT, trackIndexForDepth } from './musica.js';

export { BOSS_TRACK, TRACK_COUNT, trackIndexForDepth };

const SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = SEMITONES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
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

    this._crossfade();
    // Solo un cambio vero merita l'annuncio a schermo; un riavvio forzato no.
    return changed ? this.track : null;
  }

  /**
   * Entra o esce dal brano dello scontro. Il piano corrente resta memorizzato,
   * cosi abbattuto il guardiano si torna alla musica della zona.
   */
  setBoss(attivo, depth) {
    this.setIntensity(depth);
    const voluto = attivo ? BOSS_TRACK : trackIndexForDepth(depth);
    if (voluto === this.trackIndex) return null;
    this.trackIndex = voluto;
    this._crossfade();
    return this.track;
  }

  /** Cambio di brano in dissolvenza: tagliare di netto si sentirebbe. */
  _crossfade() {
    if (!this.ctx || !this.musicOn) return;
    const now = this.ctx.currentTime;
    this._ramp(this.musicBus.gain, 0, now, 0.3);
    clearTimeout(this._swapTimer);
    this._swapTimer = setTimeout(() => {
      if (!this.musicOn) return;
      this.stopMusic();
      this.step = 0;
      this.startMusic();
      this._ramp(this.musicBus.gain, MUSIC_LEVEL, this.ctx.currentTime, 0.45);
    }, 340);
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
      // Le note lunghe si accorciano un filo: fra una frase e l'altra ci vuole aria.
      if (s === step) this._lead(freq(note), time, dur * stepDur * 0.9, track.leadFilter, track.leadType);
    });
    track.bass.forEach(([s, note, dur]) => {
      if (s === step) this._bass(freq(note), time, dur * stepDur * 0.8);
    });
    track.arpeggio.forEach(([s, note, dur, tenuto]) => {
      if (s === step) this._arp(freq(note), time, dur * stepDur * 0.85, tenuto);
    });
    track.drums.forEach(([s, tipo]) => {
      if (s !== step) return;
      if (tipo === 'kick') this._kick(time);
      else if (tipo === 'snare') this._snare(time);
      else this._hat(time, step % 8 === 0 ? 0.045 : 0.022);
    });
  }

  /** Lead a onda quadra con vibrato ritardato: il canto espressivo tipico del chip NES. */
  _lead(f, time, dur, cutoff = 2900, tipo = 'square') {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff + this.intensity * 700;

    o.type = tipo;
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
  _arp(f, time, dur, tenuto = false) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1500;
    o.type = 'square';
    o.frequency.setValueAtTime(f, time);
    g.gain.setValueAtTime(0, time);
    if (tenuto) {
      // Accordo di sostegno: sale piano, tiene, e solo alla fine lascia. Senza
      // questo si spegneva a meta' battuta e restava un buco nel brano.
      g.gain.linearRampToValueAtTime(0.05, time + 0.05);
      g.gain.setValueAtTime(0.05, time + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    } else {
      g.gain.linearRampToValueAtTime(0.042, time + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    }
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
