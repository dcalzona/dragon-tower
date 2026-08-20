// Input unificato: tastiera e controller (DualShock / DualSense via Gamepad API).

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

// Mappatura standard Gamepad API (DualShock 4 / DualSense la seguono su Chrome ed Edge).
export const PAD = {
  CROSS: 0,
  CIRCLE: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L1: 4,
  R1: 5,
  SHARE: 8,
  OPTIONS: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
};

const DEADZONE = 0.28;

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.mode = 'keyboard'; // 'keyboard' | 'gamepad'
    this.padIndex = null;

    // Stato di gioco continuo
    this.state = { up: false, down: false, left: false, right: false, attack: false, moveX: 0, moveY: 0 };
    // Pressioni singole consumabili (menu, azioni una tantum)
    this.pressed = new Set();
    this.prevPad = {};

    this._onKeyDown = (e) => {
      if (
        KEY_MAP[e.code] ||
        ['Space', 'KeyJ', 'KeyQ', 'KeyR', 'KeyM', 'KeyE', 'Enter', 'Escape', 'KeyP'].includes(e.code)
      ) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressed.add(this._keyToAction(e.code));
      }
      this.lastDevice = 'keyboard';
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.padName = e.gamepad.id;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.padIndex = null;
    });
  }

  _keyToAction(code) {
    if (KEY_MAP[code]) return 'menu_' + KEY_MAP[code];
    switch (code) {
      case 'Space':
      case 'KeyJ':
        return 'attack';
      case 'Enter':
        return 'confirm';
      case 'KeyQ':
        return 'potion';
      case 'KeyE':
        return 'transform';
      case 'KeyR':
        return 'restart';
      case 'KeyM':
        return 'mute';
      case 'KeyP':
      case 'Escape':
        return 'pause';
      default:
        return 'key_' + code;
    }
  }

  getPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex !== null && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) {
      if (p && p.connected) {
        this.padIndex = p.index;
        this.padName = p.id;
        return p;
      }
    }
    return null;
  }

  get padConnected() {
    return !!this.getPad();
  }

  /** Da chiamare una volta per frame, prima di leggere lo stato. */
  poll() {
    const s = this.state;
    const useKeyboard = this.mode === 'keyboard';
    const pad = this.mode === 'gamepad' ? this.getPad() : null;

    let mx = 0;
    let my = 0;

    // Si riparte sempre da fermo. Senza questo, se la modalità è "controller" ma
    // il pad non risponde — scollegato, addormentato, oppure mai collegato perché
    // si gioca col dito — nessuno dei due rami sotto viene eseguito e l'attacco
    // resta congelato all'ultimo valore: il tasto fuoco rimane premuto per sempre.
    s.attack = false;

    if (useKeyboard) {
      for (const code of this.keys) {
        const dir = KEY_MAP[code];
        if (dir === 'up') my -= 1;
        else if (dir === 'down') my += 1;
        else if (dir === 'left') mx -= 1;
        else if (dir === 'right') mx += 1;
      }
      s.attack = this.keys.has('Space') || this.keys.has('KeyJ');
    } else if (pad) {
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      if (Math.abs(ax) > DEADZONE) mx += ax;
      if (Math.abs(ay) > DEADZONE) my += ay;

      const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      if (btn(PAD.DPAD_LEFT)) mx -= 1;
      if (btn(PAD.DPAD_RIGHT)) mx += 1;
      if (btn(PAD.DPAD_UP)) my -= 1;
      if (btn(PAD.DPAD_DOWN)) my += 1;

      s.attack = btn(PAD.CROSS) || btn(PAD.SQUARE) || btn(PAD.R1);

      // Fronti di salita del pad → azioni consumabili
      const edge = (i, action) => {
        const now = btn(i);
        if (now && !this.prevPad[i]) this.pressed.add(action);
        this.prevPad[i] = now;
      };
      edge(PAD.CIRCLE, 'potion');
      edge(PAD.TRIANGLE, 'transform');
      edge(PAD.CROSS, 'confirm');
      edge(PAD.OPTIONS, 'pause');
      edge(PAD.L1, 'restart');
      edge(PAD.DPAD_UP, 'menu_up');
      edge(PAD.DPAD_DOWN, 'menu_down');
      edge(PAD.DPAD_LEFT, 'menu_left');
      edge(PAD.DPAD_RIGHT, 'menu_right');

      // Anche lo stick sinistro naviga i menu, con isteresi
      this._stickEdge('menu_up', ay < -0.6, 'sy_up');
      this._stickEdge('menu_down', ay > 0.6, 'sy_down');
      this._stickEdge('menu_left', ax < -0.6, 'sx_left');
      this._stickEdge('menu_right', ax > 0.6, 'sx_right');
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    s.moveX = mx;
    s.moveY = my;
    s.up = my < -0.001;
    s.down = my > 0.001;
    s.left = mx < -0.001;
    s.right = mx > 0.001;
  }

  _stickEdge(action, condition, key) {
    if (condition && !this.prevPad[key]) this.pressed.add(action);
    this.prevPad[key] = condition;
  }

  /** Consuma una pressione singola: true una sola volta per pressione. */
  consume(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return true;
    }
    return false;
  }

  /** I menu accettano sempre sia tastiera sia pad, così non ci si blocca fuori. */
  consumeMenu(action) {
    return this.consume('menu_' + action);
  }

  clearPressed() {
    this.pressed.clear();
  }

  /**
   * Le pressioni singole valgono per un solo frame. Senza questo, un'azione che
   * nessuno consuma resta in sospeso all'infinito e scatta al primo momento in
   * cui qualcuno la richiede: premere Invio durante la partita faceva ripartire
   * il gioco nell'istante della morte, saltando la schermata delle statistiche.
   * Col pad era sistematico, perché X è insieme attacco e conferma.
   */
  endFrame() {
    this.pressed.clear();
  }

  /** Nei menu leggiamo il pad anche in modalità tastiera, per poterlo selezionare col pad. */
  pollMenu() {
    const saved = this.mode;
    this.mode = 'gamepad';
    const pad = this.getPad();
    if (pad) this.poll();
    this.mode = saved;
    this.poll();
  }
}
