import { TILE, MAP_W, MAP_H, TILES, PALETTE, DRAGON } from './config.js';
import { ITEM_TYPES } from './entities.js';

/** Rumore deterministico per tile: varia il pavimento senza farlo sfarfallare. */
function tileHash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function drawWorld(ctx, game, camera, time) {
  const { tiles, visible, explored } = game;

  const x0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((camera.x + camera.w) / TILE) + 1);
  const y1 = Math.min(MAP_H - 1, Math.ceil((camera.y + camera.h) / TILE) + 1);

  // Le torce respirano: la luce non è mai perfettamente ferma.
  const flicker = 0.94 + 0.06 * Math.sin(time * 7.3) * Math.sin(time * 3.1);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = tiles[y][x];
      if (t === TILES.VOID) continue;
      if (!explored[y][x]) continue;
      const lit = visible[y][x];

      const px = x * TILE;
      const py = y * TILE;
      const h = tileHash(x, y);

      if (t === TILES.WALL) {
        drawWallTile(ctx, px, py, lit, h, flicker);
      } else {
        if (t === TILES.STAIRS) drawStairs(ctx, px, py, lit, time, game.stairs && game.stairs.dir);
        else drawFloorTile(ctx, px, py, lit, h, flicker);
      }

      if (!lit) {
        ctx.fillStyle = 'rgba(8, 11, 18, 0.58)';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
}

function drawFloorTile(ctx, px, py, lit, h, flicker) {
  const base = lit ? 26 + h * 12 : 18 + h * 6;
  const v = Math.round(base * (lit ? flicker : 1));
  ctx.fillStyle = `rgb(${Math.round(v * 0.72)}, ${Math.round(v * 0.9)}, ${Math.round(v * 1.55)})`;
  roundRect(ctx, px + 1.5, py + 1.5, TILE - 3, TILE - 3, 4);
  ctx.fill();

  // fughe fra le lastre
  if (h > 0.82) {
    ctx.fillStyle = lit ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(px + 6, py + TILE * 0.5, TILE - 12, 1.5);
  }
}

function drawWallTile(ctx, px, py, lit, h, flicker) {
  const v = Math.round((lit ? 52 + h * 14 : 34 + h * 8) * (lit ? flicker : 1));
  ctx.fillStyle = `rgb(${Math.round(v * 0.72)}, ${Math.round(v * 0.86)}, ${Math.round(v * 1.35)})`;
  roundRect(ctx, px + 1, py + 1, TILE - 2, TILE - 2, 5);
  ctx.fill();

  // faccia superiore in ombra: dà spessore al blocco
  ctx.fillStyle = lit ? 'rgba(10,14,24,0.55)' : 'rgba(10,14,24,0.68)';
  roundRect(ctx, px + 4, py + 5, TILE - 8, TILE - 11, 4);
  ctx.fill();

  if (lit) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, px + 4, py + 3, TILE - 8, 2.5, 1);
    ctx.fill();
  }
}

/**
 * Arcata scavata nel muro: gradini che scendono nel buio, orientati verso la
 * stanza. `dir` punta dall'arcata verso il pavimento davanti a essa.
 */
function drawStairs(ctx, px, py, lit, time, dir) {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  const d = dir || { x: 0, y: 1 };

  ctx.save();
  ctx.translate(cx, cy);
  // Ruoto in modo che "verso la stanza" sia il basso: l'arcata guarda il giocatore.
  ctx.rotate(Math.atan2(d.y, d.x) - Math.PI / 2);

  // stipite di pietra attorno all'apertura
  ctx.fillStyle = lit ? '#3a4870' : '#2a3450';
  roundRect(ctx, -TILE / 2 + 1, -TILE / 2 + 1, TILE - 2, TILE - 2, 5);
  ctx.fill();

  const w = TILE * 0.6;
  const hh = TILE * 0.8;

  // apertura buia ad arco
  ctx.beginPath();
  ctx.moveTo(-w / 2, hh / 2);
  ctx.lineTo(-w / 2, -hh / 2 + w / 2);
  ctx.arc(0, -hh / 2 + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(w / 2, hh / 2);
  ctx.closePath();
  ctx.fillStyle = '#05070c';
  ctx.fill();

  // gradini che rimpiccioliscono salendo: danno profondità al varco
  ctx.fillStyle = PALETTE.stairs;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = (lit ? 0.9 : 0.4) * (1 - i * 0.21);
    const larghezza = w * (0.92 - i * 0.16);
    const y = hh / 2 - 4 - i * (TILE * 0.13);
    ctx.fillRect(-larghezza / 2, y, larghezza, 2.6);
  }

  // bagliore sulla soglia
  ctx.globalAlpha = (lit ? 0.55 : 0.22) * pulse;
  ctx.shadowColor = PALETTE.stairs;
  ctx.shadowBlur = 14;
  ctx.fillStyle = PALETTE.stairs;
  ctx.fillRect(-w / 2, hh / 2 - 2.5, w, 2.5);
  ctx.restore();
}

/** Ombra ellittica a terra: aggancia le creature al pavimento. */
function shadow(ctx, x, y, r, alpha = 0.32) {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.82, r * 0.92, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Occhi che seguono il bersaglio: bastano due punti per dare vita a una forma. */
function eyes(ctx, cx, cy, spread, size, lookX, lookY, color = '#0b0f18') {
  const len = Math.hypot(lookX, lookY) || 1;
  const ox = (lookX / len) * size * 0.42;
  const oy = (lookY / len) * size * 0.42;
  ctx.fillStyle = '#f4f7ff';
  ctx.beginPath();
  ctx.arc(cx - spread, cy, size, 0, Math.PI * 2);
  ctx.arc(cx + spread, cy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - spread + ox, cy + oy, size * 0.52, 0, Math.PI * 2);
  ctx.arc(cx + spread + ox, cy + oy, size * 0.52, 0, Math.PI * 2);
  ctx.fill();
}

function glowingEyes(ctx, cx, cy, spread, size, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - spread, cy, size, 0, Math.PI * 2);
  ctx.arc(cx + spread, cy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawItems(ctx, items, game, time) {
  items.forEach((item) => {
    const tx = Math.floor(item.x);
    const ty = Math.floor(item.y);
    if (!game.explored[ty][tx]) return;
    const lit = game.visible[ty][tx];
    const def = ITEM_TYPES[item.kind];
    const px = item.x * TILE;
    const py = item.y * TILE + Math.sin(time * 2.5 + item.x) * 2.5;

    shadow(ctx, px, item.y * TILE + 6, 9, lit ? 0.28 : 0.12);

    ctx.save();
    ctx.globalAlpha = lit ? 1 : 0.35;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = lit ? 14 : 0;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    if (item.kind === 'potion') {
      roundRect(ctx, px - 5, py - 4, 10, 12, 4);
      ctx.fill();
      ctx.fillRect(px - 2.5, py - 9, 5, 5);
    } else if (item.kind === 'crystal') {
      ctx.moveTo(px, py - 10);
      ctx.lineTo(px + 7, py);
      ctx.lineTo(px, py + 10);
      ctx.lineTo(px - 7, py);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px, py - 10);
      ctx.lineTo(px + 3.5, py);
      ctx.lineTo(px, py + 10);
      ctx.closePath();
      ctx.fill();
    } else {
      roundRect(ctx, px - 8, py - 6, 16, 12, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(px - 8, py - 1, 16, 1.5);
      ctx.fillRect(px - 1, py - 6, 2, 12);
    }
    ctx.restore();
  });
}

export function drawProjectiles(ctx, projectiles, time) {
  projectiles.forEach((pr) => {
    const px = pr.x * TILE;
    const py = pr.y * TILE;
    const r = pr.radius * TILE;
    ctx.save();
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - pr.vx * 1.6, py - pr.vy * 1.6, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawMonsters(ctx, monsters, game, time) {
  monsters.forEach((m) => {
    const tx = Math.floor(m.x);
    const ty = Math.floor(m.y);
    if (!game.visible[ty]?.[tx]) return;

    const px = m.x * TILE;
    const py = m.y * TILE;
    const r = m.radius * TILE;
    const lookX = game.player.x - m.x;
    const lookY = game.player.y - m.y;

    shadow(ctx, px, py, r);

    ctx.save();
    if (m.hitFlash > 0) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
    }
    const color = m.hitFlash > 0 ? '#ffffff' : m.type.color;

    if (m.boss) drawBoss(ctx, m, px, py, r, color, lookX, lookY, time);
    else drawCreature(ctx, m, px, py, r, color, lookX, lookY, time);
    ctx.restore();

    // Barra vita solo per i mostri comuni: il boss ce l'ha in cima allo schermo.
    if (!m.boss && m.hp < m.maxHp) {
      const w = r * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px - w / 2, py - r - 12, w, 4);
      ctx.fillStyle = PALETTE.hp;
      ctx.fillRect(px - w / 2, py - r - 12, w * (m.hp / m.maxHp), 4);
    }
  });
}

function drawCreature(ctx, m, px, py, r, color, lookX, lookY, time) {
  const t = time * 6 + m.x * 3;
  ctx.fillStyle = color;

  switch (m.type.id) {
    case 'slime': {
      // corpo che palpita, schiacciato a terra
      const squash = 1 + Math.sin(t) * 0.12;
      const stretch = 1 - Math.sin(t) * 0.1;
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.12, r * squash, r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px - r * 0.3, py - r * 0.28, r * 0.26, r * 0.18, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      eyes(ctx, px, py + r * 0.05, r * 0.34, r * 0.2, lookX, lookY);
      break;
    }
    case 'bat': {
      const flap = Math.sin(time * 16 + m.x) * 0.55;
      ctx.beginPath();
      // ala sinistra
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - r * 1.5, py - r * flap - r * 0.4, px - r * 1.85, py + r * 0.35);
      ctx.quadraticCurveTo(px - r * 1.1, py + r * 0.1, px, py + r * 0.32);
      // ala destra
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + r * 1.5, py - r * flap - r * 0.4, px + r * 1.85, py + r * 0.35);
      ctx.quadraticCurveTo(px + r * 1.1, py + r * 0.1, px, py + r * 0.32);
      ctx.fill();
      // corpo
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.55, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      // orecchie
      ctx.beginPath();
      ctx.moveTo(px - r * 0.34, py - r * 0.5);
      ctx.lineTo(px - r * 0.5, py - r * 1.05);
      ctx.lineTo(px - r * 0.08, py - r * 0.62);
      ctx.moveTo(px + r * 0.34, py - r * 0.5);
      ctx.lineTo(px + r * 0.5, py - r * 1.05);
      ctx.lineTo(px + r * 0.08, py - r * 0.62);
      ctx.fill();
      glowingEyes(ctx, px, py - r * 0.12, r * 0.22, r * 0.14, '#fff0a8');
      break;
    }
    case 'goblin': {
      const bob = Math.sin(t) * r * 0.08;
      // corpo
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.36 + bob, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // testa
      ctx.beginPath();
      ctx.arc(px, py - r * 0.34 + bob, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      // orecchie a punta
      ctx.beginPath();
      ctx.moveTo(px - r * 0.5, py - r * 0.45 + bob);
      ctx.lineTo(px - r * 1.05, py - r * 0.72 + bob);
      ctx.lineTo(px - r * 0.42, py - r * 0.1 + bob);
      ctx.moveTo(px + r * 0.5, py - r * 0.45 + bob);
      ctx.lineTo(px + r * 1.05, py - r * 0.72 + bob);
      ctx.lineTo(px + r * 0.42, py - r * 0.1 + bob);
      ctx.fill();
      // clava, dal lato verso cui guarda
      const side = lookX >= 0 ? 1 : -1;
      ctx.save();
      ctx.strokeStyle = '#6b5334';
      ctx.lineWidth = r * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + side * r * 0.55, py + r * 0.35 + bob);
      ctx.lineTo(px + side * r * 1.05, py - r * 0.15 + bob);
      ctx.stroke();
      ctx.restore();
      eyes(ctx, px, py - r * 0.38 + bob, r * 0.24, r * 0.15, lookX, lookY);
      break;
    }
    case 'wraith': {
      const wave = time * 4 + m.x;
      ctx.globalAlpha = 0.86;
      // manto sfrangiato
      ctx.beginPath();
      ctx.moveTo(px - r * 0.78, py - r * 0.15);
      ctx.quadraticCurveTo(px - r * 0.9, py - r, px, py - r * 1.05);
      ctx.quadraticCurveTo(px + r * 0.9, py - r, px + r * 0.78, py - r * 0.15);
      for (let i = 0; i <= 6; i++) {
        const fx = px + r * 0.78 - (i * r * 1.56) / 6;
        const fy = py + r * 0.75 + Math.sin(wave + i * 1.4) * r * 0.28;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath();
      ctx.fill();
      // cappuccio più scuro
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#0d1220';
      ctx.beginPath();
      ctx.ellipse(px, py - r * 0.3, r * 0.5, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      glowingEyes(ctx, px, py - r * 0.32, r * 0.22, r * 0.13, '#a9c7ff');
      break;
    }
    case 'drake':
    default: {
      const flap = Math.sin(time * 11 + m.x) * 0.4;
      const side = lookX >= 0 ? 1 : -1;
      // ali
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(px, py - r * 0.1);
      ctx.quadraticCurveTo(px - r * 1.2, py - r * (0.9 + flap), px - r * 1.5, py + r * 0.15);
      ctx.quadraticCurveTo(px - r * 0.8, py - r * 0.1, px, py + r * 0.3);
      ctx.moveTo(px, py - r * 0.1);
      ctx.quadraticCurveTo(px + r * 1.2, py - r * (0.9 + flap), px + r * 1.5, py + r * 0.15);
      ctx.quadraticCurveTo(px + r * 0.8, py - r * 0.1, px, py + r * 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      // corpo e coda
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.1, r * 0.55, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - side * r * 0.2, py + r * 0.5);
      ctx.quadraticCurveTo(px - side * r * 1.0, py + r * 0.95, px - side * r * 1.25, py + r * 0.45);
      ctx.quadraticCurveTo(px - side * r * 0.85, py + r * 0.85, px - side * r * 0.15, py + r * 0.75);
      ctx.fill();
      // muso
      ctx.beginPath();
      ctx.ellipse(px + side * r * 0.42, py - r * 0.3, r * 0.36, r * 0.26, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
      glowingEyes(ctx, px + side * r * 0.28, py - r * 0.42, r * 0.16, r * 0.12, '#ffe066');
      break;
    }
  }
}

/** I boss condividono l'impianto: corona di rune, nucleo pulsante, telegrafo della carica. */
function drawBoss(ctx, b, px, py, r, color, lookX, lookY, time) {
  const aiming = b.phase === 'aim';
  const charging = b.phase === 'charge';
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);

  // Telegrafo: mentre punta, una lancia di luce mostra dove scatterà.
  if (aiming) {
    const a = Math.atan2(b.chargeDir.y, b.chargeDir.x);
    ctx.save();
    ctx.globalAlpha = 0.16 + pulse * 0.22;
    ctx.fillStyle = color;
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(TILE * 7, -r * 0.9);
    ctx.lineTo(TILE * 7, r * 0.9);
    ctx.lineTo(0, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Aura
  ctx.save();
  ctx.globalAlpha = charging ? 0.5 : 0.24 + pulse * 0.12;
  ctx.shadowColor = color;
  ctx.shadowBlur = 34;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, r * (charging ? 1.18 : 1.05), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = color;

  if (b.def.id === 'guardiano') {
    // blocchi di pietra sospesi attorno a un nucleo
    ctx.beginPath();
    roundRect(ctx, px - r * 0.62, py - r * 0.72, r * 1.24, r * 1.44, r * 0.22);
    ctx.fill();
    const orbit = time * 1.2;
    for (let i = 0; i < 5; i++) {
      const a = orbit + (i / 5) * Math.PI * 2;
      const ox = px + Math.cos(a) * r * 1.32;
      const oy = py + Math.sin(a) * r * 1.05;
      ctx.globalAlpha = 0.8;
      roundRect(ctx, ox - r * 0.17, oy - r * 0.17, r * 0.34, r * 0.34, r * 0.08);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    glowingEyes(ctx, px, py - r * 0.22, r * 0.26, r * 0.14, '#ffffff');
  } else if (b.def.id === 'signore') {
    // corona e manto regale
    const wave = time * 3;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.85, py - r * 0.2);
    ctx.quadraticCurveTo(px, py - r * 1.35, px + r * 0.85, py - r * 0.2);
    for (let i = 0; i <= 7; i++) {
      const fx = px + r * 0.85 - (i * r * 1.7) / 7;
      const fy = py + r * 0.85 + Math.sin(wave + i * 1.2) * r * 0.24;
      ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    ctx.fill();
    // corona
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const bx = px - r * 0.6 + (i * r * 1.2) / 4;
      ctx.moveTo(bx - r * 0.1, py - r * 0.86);
      ctx.lineTo(bx, py - r * 1.3);
      ctx.lineTo(bx + r * 0.1, py - r * 0.86);
    }
    ctx.fill();
    ctx.fillRect(px - r * 0.62, py - r * 0.92, r * 1.24, r * 0.14);
    glowingEyes(ctx, px, py - r * 0.42, r * 0.26, r * 0.15, '#ff8fd8');
  } else {
    // drago di cristallo: ali ampie, corna, coda
    const flap = Math.sin(time * 7) * 0.35;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(px, py - r * 0.1);
    ctx.quadraticCurveTo(px - r * 1.5, py - r * (1.15 + flap), px - r * 2.0, py + r * 0.2);
    ctx.quadraticCurveTo(px - r * 1.0, py - r * 0.05, px, py + r * 0.4);
    ctx.moveTo(px, py - r * 0.1);
    ctx.quadraticCurveTo(px + r * 1.5, py - r * (1.15 + flap), px + r * 2.0, py + r * 0.2);
    ctx.quadraticCurveTo(px + r * 1.0, py - r * 0.05, px, py + r * 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.05, r * 0.6, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    // corna
    ctx.beginPath();
    ctx.moveTo(px - r * 0.32, py - r * 0.62);
    ctx.lineTo(px - r * 0.62, py - r * 1.24);
    ctx.lineTo(px - r * 0.1, py - r * 0.72);
    ctx.moveTo(px + r * 0.32, py - r * 0.62);
    ctx.lineTo(px + r * 0.62, py - r * 1.24);
    ctx.lineTo(px + r * 0.1, py - r * 0.72);
    ctx.fill();
    glowingEyes(ctx, px, py - r * 0.44, r * 0.24, r * 0.15, '#ffe066');
  }
  ctx.restore();
}

export function drawPlayer(ctx, p, time, isDragon) {
  const px = p.x * TILE;
  const py = p.y * TILE;
  const r = p.radius * TILE * (isDragon ? 1.35 : 1);

  shadow(ctx, px, py, r);

  if (p.swingTimer > 0) {
    const angle = Math.atan2(p.facing.y, p.facing.x);
    const progress = 1 - p.swingTimer / 0.18;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - progress);
    ctx.strokeStyle = isDragon ? DRAGON.color : '#ffffff';
    ctx.lineWidth = isDragon ? 11 : 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(px, py, r + 12, angle - 0.85 + progress * 0.6, angle + 0.85 + progress * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  const flashing = p.invulnTimer > 0 && Math.floor(time * 20) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = flashing ? 0.4 : 1;

  if (isDragon) drawDragonForm(ctx, p, px, py, r, time);
  else drawHumanForm(ctx, p, px, py, r);

  ctx.restore();
}

function drawHumanForm(ctx, p, px, py, r) {
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // mantello dal lato opposto allo sguardo
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.ellipse(px - p.facing.x * r * 0.5, py - p.facing.y * r * 0.5, r * 0.78, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(px, py, r * 0.82, 0, Math.PI * 2);
  ctx.fill();

  eyes(ctx, px + p.facing.x * r * 0.2, py + p.facing.y * r * 0.2, r * 0.3, r * 0.19, p.facing.x, p.facing.y);
}

/** Forma di drago: ali battenti, corna, coda che segue la direzione. */
function drawDragonForm(ctx, p, px, py, r, time) {
  const flap = Math.sin(p.wingPhase) * 0.45;
  const side = p.facing.x >= 0 ? 1 : -1;

  ctx.shadowColor = DRAGON.color;
  ctx.shadowBlur = 26;

  // ali
  ctx.globalAlpha *= 0.95;
  ctx.fillStyle = DRAGON.colorDeep;
  ctx.beginPath();
  ctx.moveTo(px, py - r * 0.1);
  ctx.quadraticCurveTo(px - r * 1.35, py - r * (1.0 + flap), px - r * 1.8, py + r * 0.25);
  ctx.quadraticCurveTo(px - r * 0.9, py, px, py + r * 0.42);
  ctx.moveTo(px, py - r * 0.1);
  ctx.quadraticCurveTo(px + r * 1.35, py - r * (1.0 + flap), px + r * 1.8, py + r * 0.25);
  ctx.quadraticCurveTo(px + r * 0.9, py, px, py + r * 0.42);
  ctx.fill();

  // coda
  ctx.beginPath();
  ctx.moveTo(px - side * r * 0.25, py + r * 0.45);
  ctx.quadraticCurveTo(
    px - side * r * 1.1,
    py + r * (0.95 + Math.sin(time * 5) * 0.18),
    px - side * r * 1.45,
    py + r * 0.35
  );
  ctx.quadraticCurveTo(px - side * r * 0.9, py + r * 0.9, px - side * r * 0.2, py + r * 0.72);
  ctx.fill();

  // corpo
  ctx.fillStyle = DRAGON.color;
  ctx.beginPath();
  ctx.ellipse(px, py, r * 0.72, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fill();

  // ventre più chiaro
  ctx.globalAlpha *= 0.55;
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.ellipse(px, py + r * 0.22, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.55;

  // corna
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffe9c2';
  ctx.beginPath();
  ctx.moveTo(px - r * 0.3, py - r * 0.66);
  ctx.lineTo(px - r * 0.56, py - r * 1.25);
  ctx.lineTo(px - r * 0.08, py - r * 0.78);
  ctx.moveTo(px + r * 0.3, py - r * 0.66);
  ctx.lineTo(px + r * 0.56, py - r * 1.25);
  ctx.lineTo(px + r * 0.08, py - r * 0.78);
  ctx.fill();

  glowingEyes(ctx, px + p.facing.x * r * 0.18, py - r * 0.28 + p.facing.y * r * 0.12, r * 0.26, r * 0.15, '#fff3c4');
}

export function drawParticles(ctx, particles) {
  particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * TILE, p.y * TILE, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

export function drawFloatingTexts(ctx, texts) {
  texts.forEach((t) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,11,18,0.8)';
    ctx.strokeText(t.text, t.x * TILE, t.y * TILE);
    ctx.fillText(t.text, t.x * TILE, t.y * TILE);
    ctx.restore();
  });
}

/** Vignettatura: chiude i bordi e concentra lo sguardo al centro. */
export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
