import { TILE, MAP_W, MAP_H, PALETTE } from './config.js';
import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { Menu } from './menu.js';
import { drawHUD, drawNotifications, drawOverlay, drawEndScreen } from './hud.js';
import {
  drawWorld,
  drawItems,
  drawMonsters,
  drawPlayer,
  drawParticles,
  drawProjectiles,
  drawFloatingTexts,
  drawVignette,
} from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const audio = new AudioEngine();
const input = new InputManager();
const menu = new Menu(input, audio);

let game = null;
let appState = 'splash'; // splash | menu | playing | paused
let time = 0;

// Istante in cui la partita è finita. Serve a ignorare l'input per un attimo:
// chi muore mentre sta pestando il tasto d'attacco non deve saltare via dalle
// statistiche senza nemmeno vederle.
let gameOverAt = null;
const GAME_OVER_LOCK = 1.1;

const camera = { x: 0, y: 0, w: 0, h: 0, zoom: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };

/**
 * Spazio di disegno logico minimo. Il cerchio di luce è largo 17 caselle da 34px,
 * cioè 578px: sotto quell'altezza la torcia verrebbe tagliata sopra e sotto, e
 * l'interfaccia — pensata in pixel fissi — occuperebbe una fetta enorme dello
 * schermo. Su un telefono in orizzontale ci sono ~412px logici: troppo pochi.
 *
 * Invece di rimpicciolire i font a mano, riduciamo l'intera scala di disegno finché
 * lo spazio logico non raggiunge queste misure. È lo stesso effetto della "modalità
 * desktop" del browser — si vede di più e le scritte sono più piccole — ma nitido,
 * perché continuiamo a disegnare alla risoluzione vera del dispositivo.
 */
const DESIGN_MIN_W = 1180;
const DESIGN_MIN_H = 620;

// In verticale i minimi da orizzontale si azzufferebbero: pretendere 1180px di
// larghezza su uno schermo stretto rimpicciolirebbe tutto fino all'illeggibile.
// Il gioco è pensato in orizzontale, ma in verticale deve restare dignitoso.
const PORTRAIT_MIN_W = 640;
const PORTRAIT_MIN_H = 1020;

// Oltre questo non si rimpicciolisce più: meglio tagliare qualcosa che rendere
// l'interfaccia illeggibile su schermi molto piccoli.
const MIN_ZOOM = 0.5;

// Su schermi ad altissima densità riempire ogni pixel costa caro, e questo gioco
// usa molti bagliori sfocati. Oltre 2.5x la differenza non si vede, il costo sì.
const MAX_DPR = 2.5;

function readSafeInsets() {
  const s = getComputedStyle(document.body);
  const px = (nome) => parseFloat(s.getPropertyValue(nome)) || 0;
  return { top: px('--sat'), right: px('--sar'), bottom: px('--sab'), left: px('--sal') };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const cssW = canvas.clientWidth || window.innerWidth;
  const cssH = canvas.clientHeight || window.innerHeight;

  const orizzontale = cssW >= cssH;
  const minW = orizzontale ? DESIGN_MIN_W : PORTRAIT_MIN_W;
  const minH = orizzontale ? DESIGN_MIN_H : PORTRAIT_MIN_H;

  // Mai ingrandire: su schermi ampi resta 1 e il comportamento su PC non cambia.
  const zoom = Math.max(MIN_ZOOM, Math.min(1, cssW / minW, cssH / minH));

  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);

  camera.zoom = zoom;
  camera.w = cssW / zoom;
  camera.h = cssH / zoom;

  // I margini di sicurezza arrivano in pixel CSS: vanno riportati nella stessa
  // scala del disegno, altrimenti sul telefono sarebbero grandi il doppio.
  const safe = readSafeInsets();
  camera.safe = {
    top: safe.top / zoom,
    right: safe.right / zoom,
    bottom: safe.bottom / zoom,
    left: safe.left / zoom,
  };
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// L'audio può partire solo dopo un gesto dell'utente (policy dei browser).
function unlockAudio() {
  audio.init();
  audio.startMusic();
}
function leaveSplash() {
  if (appState !== 'splash') return;
  unlockAudio();
  appState = 'menu';
  input.clearPressed();
  audio.sfx('confirm');
}
window.addEventListener('keydown', leaveSplash);
window.addEventListener('pointerdown', leaveSplash);

function startGame() {
  input.mode = menu.useGamepad ? 'gamepad' : 'keyboard';
  game = new Game(menu.difficulty, audio);
  audio.setDepth(1, true);
  appState = 'playing';
  gameOverAt = null;
  input.clearPressed();
}

function backToMenu() {
  appState = 'menu';
  menu.done = false;
  menu.row = 3; // la riga "ENTRA NELLA TORRE"
  gameOverAt = null;
  input.clearPressed();
}

function update(dt) {
  input.pollMenu();

  if (input.consume('mute')) {
    audio.cycleMode();
    audio.sfx('menu');
  }

  if (appState === 'menu') {
    menu.update(dt);
    if (menu.done) startGame();
    return;
  }

  if (appState === 'playing') {
    if (game.state === 'playing') {
      if (input.consume('pause')) {
        appState = 'paused';
        audio.sfx('menu');
        return;
      }
      if (input.consume('potion')) game.usePotion();
      if (input.consume('transform')) game.transform();
      game.update(dt, input.state);
      return;
    }

    // Partita finita: statistiche a schermo, input accettato solo dopo la pausa.
    if (gameOverAt === null) gameOverAt = time;
    if (time - gameOverAt < GAME_OVER_LOCK) return;

    if (input.consume('restart') || input.consume('confirm') || input.consume('attack')) {
      game.restart();
      gameOverAt = null;
      audio.setDepth(1, true);
    } else if (input.consume('pause')) {
      backToMenu();
    }
    return;
  }

  if (appState === 'paused') {
    if (input.consume('pause') || input.consume('confirm')) {
      appState = 'playing';
      audio.sfx('menu');
    }
    if (input.consume('restart')) backToMenu();
  }
}

function updateCamera() {
  const p = game.player;
  const targetX = p.x * TILE - camera.w / 2;
  const targetY = p.y * TILE - camera.h / 2;
  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.12;
  camera.x = Math.max(0, Math.min(MAP_W * TILE - camera.w, camera.x));
  camera.y = Math.max(0, Math.min(MAP_H * TILE - camera.h, camera.y));
  if (MAP_W * TILE < camera.w) camera.x = (MAP_W * TILE - camera.w) / 2;
  if (MAP_H * TILE < camera.h) camera.y = (MAP_H * TILE - camera.h) / 2;
}

function drawSplash() {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, camera.w, camera.h);
  const cx = camera.w / 2;
  const cy = camera.h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);

  ctx.textAlign = 'center';
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 24;
  ctx.fillStyle = PALETTE.player;
  ctx.font = 'bold 58px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('DRAGON TOWER', cx, cy - 20);
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 0.4 + pulse * 0.6;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Premi un tasto o clicca per iniziare', cx, cy + 34);
  ctx.globalAlpha = 1;

  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('un action-roguelike gotico a 30 piani', cx, cy + 70);
}

function drawGame() {
  updateCamera();

  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, camera.w, camera.h);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  drawWorld(ctx, game, camera, game.time);
  drawItems(ctx, game.items, game, game.time);
  drawMonsters(ctx, game.monsters, game, game.time);
  drawPlayer(ctx, game.player, game.time, game.isDragon);
  drawProjectiles(ctx, game.projectiles, game.time);
  drawParticles(ctx, game.particles);
  drawFloatingTexts(ctx, game.floatingTexts);
  ctx.restore();

  drawVignette(ctx, camera.w, camera.h);

  drawHUD(ctx, game, camera, {
    potionKey: input.mode === 'gamepad' ? '⭕' : 'Q',
    transformKey: input.mode === 'gamepad' ? '△' : 'E',
    audioLabel: audio.modeLabel,
    audioFull: audio.mode === 'full',
  });

  drawNotifications(ctx, camera, game.notifications);

  const restartKey = input.mode === 'gamepad' ? 'X' : 'un tasto';
  const pronto = gameOverAt !== null && time - gameOverAt >= GAME_OVER_LOCK;
  if (game.state === 'dead') {
    drawEndScreen(ctx, camera, game, 'SEI CADUTO', '#ff6b6b', `Premi ${restartKey} per ricominciare`, pronto);
  } else if (game.state === 'won') {
    drawEndScreen(ctx, camera, game, 'IL CRISTALLO È TUO', '#ffd43b', `Premi ${restartKey} per rigiocare`, pronto);
  } else if (appState === 'paused') {
    const resumeKey = input.mode === 'gamepad' ? 'OPTIONS' : 'P';
    const menuKey = input.mode === 'gamepad' ? 'L1' : 'R';
    drawOverlay(ctx, camera, 'PAUSA', `${resumeKey} riprendi · ${menuKey} torna al menu`, PALETTE.player);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  update(dt);
  // Le pressioni non consumate scadono qui: non devono sopravvivere al frame.
  input.endFrame();

  if (appState === 'splash') {
    drawSplash();
  } else if (appState === 'menu') {
    menu.draw(ctx, camera.w, camera.h);
  } else {
    drawGame();
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
