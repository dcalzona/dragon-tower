import { PALETTE, DRAGON } from './config.js';

/**
 * Comandi a schermo per il telefono.
 *
 * Le misure sono in pixel CSS e vengono convertite in coordinate logiche
 * dividendo per lo zoom: così i pulsanti restano della stessa dimensione
 * *fisica* sotto il pollice, qualunque sia la scala di disegno.
 */
const ATTACK_R = 58; // il pulsante che si usa il 90% del tempo: il più grande
const SMALL_R = 33;
const STICK_R = 58; // corsa massima del pollice sullo stick
const PAUSE_R = 18;
const MARGIN = 24;

const SAFE_ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

export class TouchControls {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;

    /** Diventa vero al primo tocco vero: su PC i comandi non compaiono mai. */
    this.enabled = false;
    /** 'game' disegna stick e pulsanti · 'ui' passa i tocchi ai menu. */
    this.mode = 'ui';
    /** Chiamata dai menu per i tocchi che non finiscono su un comando. */
    this.onTap = null;

    this.state = { moveX: 0, moveY: 0, attack: false };
    this.pressed = new Set();

    this.stick = null; // { id, baseX, baseY, x, y }
    this.holds = new Map(); // pointerId -> id del pulsante premuto
    this.pulse = new Map(); // id pulsante -> istante della pressione, per l'animazione

    this._bind();
  }

  _bind() {
    const opts = { passive: false };
    this.canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    this.canvas.addEventListener('pointermove', (e) => this._move(e), opts);
    this.canvas.addEventListener('pointerup', (e) => this._up(e), opts);
    this.canvas.addEventListener('pointercancel', (e) => this._up(e), opts);
    this.canvas.addEventListener('pointerleave', (e) => this._up(e), opts);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _logical(e) {
    const r = this.canvas.getBoundingClientRect();
    const z = this.camera.zoom || 1;
    return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z };
  }

  /** Posizioni di stick e pulsanti, in coordinate logiche. */
  layout() {
    const c = this.camera;
    const s = c.safe || SAFE_ZERO;
    const z = c.zoom || 1;
    const u = (v) => v / z; // da pixel CSS a logici

    const aR = u(ATTACK_R);
    const sR = u(SMALL_R);
    const m = u(MARGIN);

    const ax = c.w - s.right - m - aR;
    const ay = c.h - s.bottom - m - aR;

    return {
      unit: u,
      stickR: u(STICK_R),
      buttons: [
        { id: 'attack', x: ax, y: ay, r: aR },
        { id: 'potion', x: ax - aR - sR - u(12), y: ay - u(4), r: sR },
        { id: 'transform', x: ax - u(6), y: ay - aR - sR - u(14), r: sR },
        { id: 'pause', x: c.w - s.right - u(26), y: s.top + u(26), r: u(PAUSE_R) },
      ],
      // Lo stick vive nella metà sinistra: si ancora dove appoggi il pollice.
      stickZone: { x1: c.w * 0.52, y0: c.h * 0.12 },
    };
  }

  _hitButton(p) {
    if (this.mode !== 'game') return null;
    const { buttons } = this.layout();
    for (const b of buttons) {
      // Area sensibile un po' più larga del disegno: i pollici non sono precisi.
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r * 1.22) return b;
    }
    return null;
  }

  _down(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') this.enabled = true;
    if (!this.enabled) return;
    e.preventDefault();

    const p = this._logical(e);

    if (this.mode === 'ui') {
      this._tapStart = { id: e.pointerId, ...p, t: performance.now() };
      return;
    }

    const b = this._hitButton(p);
    if (b) {
      this.holds.set(e.pointerId, b.id);
      this.pulse.set(b.id, performance.now());
      // L'attacco si tiene premuto (il recupero fa il resto); gli altri sono singoli.
      if (b.id !== 'attack') this.pressed.add(b.id);
      return;
    }

    const { stickZone } = this.layout();
    if (p.x <= stickZone.x1 && p.y >= stickZone.y0 && !this.stick) {
      this.stick = { id: e.pointerId, baseX: p.x, baseY: p.y, x: p.x, y: p.y };
    }
  }

  _move(e) {
    if (!this.enabled) return;
    if (this.stick && this.stick.id === e.pointerId) {
      e.preventDefault();
      const p = this._logical(e);
      this.stick.x = p.x;
      this.stick.y = p.y;
      return;
    }
    // Se il dito scivola fuori dal pulsante, la pressione si annulla.
    if (this.holds.has(e.pointerId)) {
      const p = this._logical(e);
      const id = this.holds.get(e.pointerId);
      const b = this.layout().buttons.find((x) => x.id === id);
      if (b && Math.hypot(p.x - b.x, p.y - b.y) > b.r * 1.9) this.holds.delete(e.pointerId);
    }
  }

  _up(e) {
    if (!this.enabled) return;

    if (this.mode === 'ui' && this._tapStart && this._tapStart.id === e.pointerId) {
      const p = this._logical(e);
      const mosso = Math.hypot(p.x - this._tapStart.x, p.y - this._tapStart.y);
      const durata = performance.now() - this._tapStart.t;
      this._tapStart = null;
      if (mosso < 30 && durata < 700 && this.onTap) this.onTap(p.x, p.y);
      return;
    }

    if (this.stick && this.stick.id === e.pointerId) this.stick = null;
    this.holds.delete(e.pointerId);
  }

  /** Da chiamare a ogni frame prima di leggere lo stato. */
  poll() {
    const s = this.state;
    s.attack = [...this.holds.values()].includes('attack');

    if (this.stick) {
      const { stickR } = this.layout();
      let dx = this.stick.x - this.stick.baseX;
      let dy = this.stick.y - this.stick.baseY;
      const d = Math.hypot(dx, dy);
      // Piccola zona morta: appoggiare il pollice non deve far camminare.
      const morta = stickR * 0.16;
      if (d <= morta) {
        s.moveX = 0;
        s.moveY = 0;
      } else {
        const intensita = Math.min(1, (d - morta) / (stickR - morta));
        s.moveX = (dx / d) * intensita;
        s.moveY = (dy / d) * intensita;
      }
    } else {
      s.moveX = 0;
      s.moveY = 0;
    }
    return s;
  }

  consume(azione) {
    if (this.pressed.has(azione)) {
      this.pressed.delete(azione);
      return true;
    }
    return false;
  }

  clear() {
    this.pressed.clear();
    this.holds.clear();
    this.stick = null;
    this.state.moveX = 0;
    this.state.moveY = 0;
    this.state.attack = false;
  }

  // ---- Disegno ----

  draw(ctx, game) {
    if (!this.enabled || this.mode !== 'game') return;
    const { buttons, stickR, unit } = this.layout();
    const ora = performance.now();

    ctx.save();

    // Stick: compare dove hai appoggiato il pollice
    if (this.stick) {
      const { baseX, baseY } = this.stick;
      let dx = this.stick.x - baseX;
      let dy = this.stick.y - baseY;
      const d = Math.hypot(dx, dy);
      if (d > stickR) {
        dx = (dx / d) * stickR;
        dy = (dy / d) * stickR;
      }

      ctx.globalAlpha = 0.24;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(baseX, baseY, stickR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = unit(2);
      ctx.beginPath();
      ctx.arc(baseX, baseY, stickR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(baseX + dx, baseY + dy, stickR * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    const premuto = (id) => [...this.holds.values()].includes(id);

    buttons.forEach((b) => {
      const giu = premuto(b.id);
      const lampo = this.pulse.get(b.id);
      const eco = lampo ? Math.max(0, 1 - (ora - lampo) / 260) : 0;

      let colore = PALETTE.player;
      let attivo = true;
      let pulsazione = 1;
      if (b.id === 'potion') {
        // La pozione porta anche lo stato della vita: cambia colore e pulsa quando
        // scende, così l'allarme arriva dove il pollice sta già guardando.
        const vita = game ? game.player.hp / game.player.maxHp : 1;
        colore = vita < 0.3 ? '#ff6b6b' : vita < 0.5 ? '#ffa94d' : '#63e6be';
        if (vita < 0.5) {
          const ritmo = vita < 0.3 ? 130 : 210;
          pulsazione = 0.55 + 0.45 * Math.sin(ora / ritmo);
        }
        attivo = game && game.player.potions > 0;
      } else if (b.id === 'transform') {
        colore = DRAGON.color;
        attivo = game && (game.player.dragonCharge >= 1 || game.player.dragonTimer > 0);
      } else if (b.id === 'pause') {
        colore = PALETTE.textDim;
      }

      const scala = giu ? 0.93 : 1 + eco * 0.06;
      const r = b.r * scala;

      ctx.globalAlpha = (attivo ? (giu ? 0.4 : 0.22) : 0.1) * pulsazione;
      ctx.fillStyle = colore;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = (attivo ? (giu ? 0.95 : 0.6) : 0.22) * pulsazione;
      ctx.strokeStyle = colore;
      ctx.lineWidth = unit(b.id === 'attack' ? 2.5 : 2);
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = (attivo ? 0.92 : 0.28) * pulsazione;
      this._glyph(ctx, b.id, b.x, b.y, r, colore, game);

      // Anello della vita attorno alla pozione: sostituisce la barra tolta
      // dall'angolo. Resta ben visibile anche a pozioni finite, perché è proprio
      // allora che sapere quanta vita resta conta di più.
      if (b.id === 'potion' && game) {
        const vita = Math.max(0, game.player.hp / game.player.maxHp);
        ctx.lineWidth = unit(4);
        ctx.strokeStyle = colore;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 1.28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.95 * pulsazione;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 1.28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * vita);
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  _glyph(ctx, id, x, y, r, colore, game) {
    ctx.save();
    ctx.fillStyle = colore;
    ctx.strokeStyle = colore;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (id === 'attack') {
      // spada stilizzata
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.34, y + r * 0.36);
      ctx.lineTo(x + r * 0.36, y - r * 0.36);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.14, y - r * 0.44);
      ctx.lineTo(x + r * 0.46, y - r * 0.46);
      ctx.lineTo(x + r * 0.44, y - r * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.44, y + r * 0.14);
      ctx.lineTo(x - r * 0.14, y + r * 0.44);
      ctx.stroke();
    } else if (id === 'potion') {
      // ampolla
      ctx.lineWidth = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.16, y - r * 0.44);
      ctx.lineTo(x - r * 0.16, y - r * 0.1);
      ctx.lineTo(x - r * 0.4, y + r * 0.3);
      ctx.quadraticCurveTo(x - r * 0.42, y + r * 0.52, x - r * 0.16, y + r * 0.52);
      ctx.lineTo(x + r * 0.16, y + r * 0.52);
      ctx.quadraticCurveTo(x + r * 0.42, y + r * 0.52, x + r * 0.4, y + r * 0.3);
      ctx.lineTo(x + r * 0.16, y - r * 0.1);
      ctx.lineTo(x + r * 0.16, y - r * 0.44);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.28, y - r * 0.5);
      ctx.lineTo(x + r * 0.28, y - r * 0.5);
      ctx.stroke();
      if (game) {
        ctx.font = `bold ${r * 0.5}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${game.player.potions}`, x + r * 0.72, y + r * 0.78);
      }
    } else if (id === 'transform') {
      // fiamma / drago
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.52);
      ctx.quadraticCurveTo(x + r * 0.46, y - r * 0.06, x + r * 0.22, y + r * 0.3);
      ctx.quadraticCurveTo(x + r * 0.14, y + r * 0.5, x, y + r * 0.5);
      ctx.quadraticCurveTo(x - r * 0.14, y + r * 0.5, x - r * 0.22, y + r * 0.3);
      ctx.quadraticCurveTo(x - r * 0.46, y - r * 0.06, x, y - r * 0.52);
      ctx.fill();
      if (game) {
        const p = game.player;
        ctx.lineWidth = r * 0.14;
        if (p.dragonTimer > 0) {
          // In forma di drago l'anello diventa il tempo che resta.
          ctx.strokeStyle = DRAGON.colorDeep;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(x, y, r * 1.28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.dragonTimer / DRAGON.duration));
          ctx.stroke();
        } else if (p.dragonCharge >= 1) {
          // carica: anello pieno che pulsa, si può usare
          ctx.globalAlpha *= 0.55 + 0.45 * Math.sin(performance.now() / 160);
          ctx.beginPath();
          ctx.arc(x, y, r * 1.28, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // altrimenti mostra quanto manca
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(x, y, r * 1.28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(x, y, r * 1.28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.dragonCharge);
          ctx.stroke();
        }
      }
    } else if (id === 'pause') {
      ctx.fillRect(x - r * 0.34, y - r * 0.4, r * 0.24, r * 0.8);
      ctx.fillRect(x + r * 0.1, y - r * 0.4, r * 0.24, r * 0.8);
    }
    ctx.restore();
  }
}
