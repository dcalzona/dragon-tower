import { PALETTE, DIFFICULTIES } from './config.js';
import { roundRect } from './render.js';

const ROWS = ['controls', 'difficulty', 'audio', 'start'];
const AUDIO_MODES = ['full', 'sfx', 'off'];

export class Menu {
  constructor(input, audio) {
    this.input = input;
    this.audio = audio;
    this.row = 0;
    this.controlIndex = 0; // 0 = tastiera, 1 = controller
    this.difficultyIndex = 1;
    this.time = 0;
    this.done = false;
  }

  get difficulty() {
    return DIFFICULTIES[this.difficultyIndex];
  }

  get useGamepad() {
    return this.controlIndex === 1;
  }

  update(dt) {
    this.time += dt;
    const input = this.input;

    if (input.consumeMenu('up')) {
      this.row = (this.row - 1 + ROWS.length) % ROWS.length;
      this.audio.sfx('menu');
    }
    if (input.consumeMenu('down')) {
      this.row = (this.row + 1) % ROWS.length;
      this.audio.sfx('menu');
    }

    const dir = (input.consumeMenu('right') ? 1 : 0) - (input.consumeMenu('left') ? 1 : 0);
    if (dir !== 0 && ROWS[this.row] !== 'start') {
      this._cycle(dir);
      this.audio.sfx('menu');
    }

    if (input.consume('confirm') || input.consume('attack')) {
      if (ROWS[this.row] === 'start') {
        this.done = true;
        this.audio.sfx('confirm');
      } else {
        this.row = Math.min(ROWS.length - 1, this.row + 1);
        this.audio.sfx('menu');
      }
    }
  }

  /**
   * Tocco sul menu. Le zone sensibili vengono registrate durante il disegno,
   * così restano automaticamente allineate a quello che si vede.
   */
  handleTap(x, y) {
    for (const z of this.hitAreas || []) {
      if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h) continue;
      if (z.kind === 'start') {
        this.done = true;
        this.audio.sfx('confirm');
      } else if (z.kind === 'left' || z.kind === 'right') {
        this.row = z.row;
        this._cycle(z.kind === 'right' ? 1 : -1);
        this.audio.sfx('menu');
      } else {
        // Toccare la riga la seleziona; toccarla di nuovo avanza il valore.
        if (this.row === z.row) this._cycle(1);
        this.row = z.row;
        this.audio.sfx('menu');
      }
      return true;
    }
    return false;
  }

  _cycle(dir) {
    const riga = ROWS[this.row];
    if (riga === 'controls') this.controlIndex = (this.controlIndex + dir + 2) % 2;
    else if (riga === 'difficulty')
      this.difficultyIndex = (this.difficultyIndex + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
    else if (riga === 'audio') {
      const i = AUDIO_MODES.indexOf(this.audio.mode);
      this.audio.setMode(AUDIO_MODES[(i + dir + AUDIO_MODES.length) % AUDIO_MODES.length]);
    } else if (riga === 'start') this.done = true;
  }

  draw(ctx, w, h) {
    this.hitAreas = [];
    ctx.save();
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, w, h);

    // Sfondo: griglia sottile in prospettiva, richiamo arcade
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const y = h * 0.55 + i * i * 1.4 - this.time * 12 * 0;
      if (y > h) break;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const cx = w / 2;
    const panelW = Math.min(560, w - 60);
    const panelX = cx - panelW / 2;
    let y = Math.max(60, h * 0.16);

    // Titolo
    const glow = 0.5 + 0.5 * Math.sin(this.time * 2);
    ctx.textAlign = 'center';
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18 + glow * 14;
    ctx.fillStyle = PALETTE.player;
    ctx.font = 'bold 54px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('DRAGON TOWER', cx, y);
    ctx.shadowBlur = 0;

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('30 piani ti separano dal Cristallo', cx, y + 28);

    y += 78;

    this._drawRow(ctx, panelX, y, panelW, 'COMANDI', this._controlLabel(), this.row === 0, PALETTE.player, 0);
    y += 82;

    const diff = this.difficulty;
    this._drawRow(ctx, panelX, y, panelW, 'DIFFICOLTÀ', diff.name, this.row === 1, diff.color, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(diff.desc, cx, y + 62);
    y += 92;

    const audioOn = this.audio.mode === 'full';
    this._drawRow(ctx, panelX, y, panelW, 'AUDIO', this.audio.modeLabel, this.row === 2, audioOn ? PALETTE.player : '#8a94ad', 2);
    y += 78;

    // Pulsante avvio
    const selected = this.row === 3;
    const btnW = 240;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    this.hitAreas.push({ kind: 'start', row: 3, x: btnX, y, w: btnW, h: btnH });
    ctx.fillStyle = selected ? 'rgba(78, 205, 196, 0.18)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, btnX, y, btnW, btnH, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? PALETTE.player : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = selected ? PALETTE.player : PALETTE.textDim;
    ctx.font = 'bold 19px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENTRA NELLA TORRE', cx, y + 33);

    y += btnH + 40;

    // Aiuto comandi
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12.5px "Segoe UI", system-ui, sans-serif';
    const hint = this.useGamepad
      ? 'Stick muovi · X/⬜ attacca · ⭕ pozione · △ drago · OPTIONS pausa'
      : 'WASD muovi · Spazio attacca · Q pozione · E drago · M audio · P pausa';
    ctx.fillText(hint, cx, y);

    const pad = this.input.getPad();
    ctx.fillStyle = pad ? '#7bd88f' : '#7b6b48';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(
      pad ? `Controller rilevato: ${this._shortPadName(pad.id)}` : 'Nessun controller rilevato — premi un tasto del pad per attivarlo',
      cx,
      y + 22
    );

    ctx.restore();
  }

  _shortPadName(id) {
    const m = /^(.*?)\s*\(/.exec(id);
    return (m ? m[1] : id).slice(0, 42);
  }

  _controlLabel() {
    return this.controlIndex === 0 ? 'Tastiera' : 'Controller PlayStation';
  }

  _drawRow(ctx, x, y, w, label, value, selected, color, rowIndex) {
    if (rowIndex !== undefined) {
      this.hitAreas.push({ kind: 'row', row: rowIndex, x, y: y - 6, w, h: 56 });
      const aw = 46;
      this.hitAreas.unshift({ kind: 'right', row: rowIndex, x: x + w - aw, y: y - 6, w: aw, h: 56 });
      this.hitAreas.unshift({ kind: 'left', row: rowIndex, x: x + w - aw * 2, y: y - 6, w: aw, h: 56 });
    }
    ctx.save();
    ctx.fillStyle = selected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
    roundRect(ctx, x, y - 6, w, 56, 12);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = 'rgba(78, 205, 196, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, x + 20, y + 16);

    ctx.fillStyle = color;
    ctx.font = 'bold 21px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(value, x + 20, y + 41);

    // Frecce di selezione
    const arrowY = y + 26;
    ctx.fillStyle = selected ? PALETTE.text : 'rgba(255,255,255,0.18)';
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const bob = selected ? Math.sin(this.time * 6) * 2 : 0;
    ctx.fillText('‹', x + w - 54 - bob, arrowY + 6);
    ctx.fillText('›', x + w - 24 + bob, arrowY + 6);
    ctx.restore();
  }
}
