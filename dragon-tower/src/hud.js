import { PALETTE, SPEED_TIERS, DRAGON, ARENA_SPEED } from './config.js';
import { roundRect } from './render.js';

export function bar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(0, Math.min(1, ratio)) * w, h, h / 2);
  ctx.fill();
}

const SAFE_ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Restringe l'area utile ai margini di sicurezza del telefono (foro della
 * fotocamera, angoli stondati, barra dei gesti). Spostando l'origine una volta
 * sola, tutto il resto del disegno resta scritto come prima.
 */
function areaSicura(camera) {
  const s = camera.safe || SAFE_ZERO;
  return { off: s, view: { ...camera, w: camera.w - s.left - s.right, h: camera.h - s.top - s.bottom } };
}

export function drawHUD(ctx, game, camera, opts) {
  const { potionKey = 'Q', audioLabel = 'Musica + effetti', audioFull = true, compact = false } = opts || {};
  const p = game.player;
  const { off, view } = areaSicura(camera);
  const pad = 18;

  /**
   * Su telefono l'interfaccia vive sui pulsanti a schermo: la vita è l'anello
   * attorno alla pozione, la metamorfosi quello attorno al drago, e tutto il
   * resto sta nel menu di pausa. Qui restano solo la cronaca, le notifiche e la
   * barra del boss — così i pannelli non coprono più la stanza.
   */
  if (compact) {
    drawBossBar(ctx, game, view);
    ctx.save();
    ctx.translate(off.left, off.top);
    drawEventFeed(ctx, game, view, pad);
    ctx.restore();
    return;
  }

  // Spostamento unico: da qui in poi tutto il disegno è già dentro l'area sicura.
  ctx.save();
  ctx.translate(off.left, off.top);

  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 23, 0.82)';
  roundRect(ctx, pad, pad, 268, 158, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText(`Livello ${p.level}`, pad + 16, pad + 28);

  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Piano ${game.depth}`, pad + 252, pad + 28);

  bar(ctx, pad + 16, pad + 40, 236, 12, p.hp / p.maxHp, PALETTE.hp);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${p.hp} / ${p.maxHp}`, pad + 134, pad + 50);

  bar(ctx, pad + 16, pad + 60, 236, 8, p.xp / p.xpToNext, PALETTE.xp);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`ATT ${p.atk}   DIF ${p.def}`, pad + 16, pad + 90);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.potions > 0 ? '#63e6be' : PALETTE.textDim;
  // Col touch il tasto è disegnato a schermo: suggerirne uno da tastiera confonde.
  ctx.fillText(potionKey ? `Pozioni: ${p.potions}  [${potionKey}]` : `Pozioni: ${p.potions}`, pad + 252, pad + 90);

  // Nell'arena la percentuale di mappa non dice nulla: è tutta svelata.
  if (game.arenaRoom) {
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Arena del guardiano', pad + 16, pad + 112);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`velocità ×${ARENA_SPEED}`, pad + 252, pad + 112);
    ctx.restore();
    drawZonaDestra(ctx, game, view, pad, audioLabel, audioFull);
    drawDragonGauge(ctx, game, view, pad, opts);
    drawBossBar(ctx, game, view);
    drawEventFeed(ctx, game, view, pad);
    ctx.restore();
    return;
  }

  // Esplorazione del piano + livello di velocità raggiunto
  const ratio = game.exploredRatio;
  const tier = game.speedTier > 0 ? SPEED_TIERS[game.speedTier - 1] : null;
  const nextTier = SPEED_TIERS[game.speedTier];

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Mappa esplorata', pad + 16, pad + 112);
  ctx.textAlign = 'right';
  ctx.fillStyle = tier ? tier.color : PALETTE.text;
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.round(ratio * 100)}%`, pad + 252, pad + 112);

  // La barra mostra anche dove scatta il prossimo scaglione di velocità
  const bx = pad + 16;
  const by = pad + 118;
  const bw = 236;
  bar(ctx, bx, by, bw, 7, ratio, tier ? tier.color : PALETTE.player);
  SPEED_TIERS.forEach((t) => {
    ctx.fillStyle = ratio >= t.at ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)';
    ctx.fillRect(bx + bw * t.at - 1, by - 2, 2, 11);
  });

  ctx.textAlign = 'left';
  if (tier) {
    ctx.fillStyle = tier.color;
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`▲ ${tier.name} ×${tier.mult}`, pad + 16, pad + 143);
  } else if (nextTier) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Boost velocità al ${Math.round(nextTier.at * 100)}%`, pad + 16, pad + 143);
  }
  ctx.restore();

  drawZonaDestra(ctx, game, view, pad, audioLabel, audioFull);

  drawDragonGauge(ctx, game, view, pad, opts);
  drawBossBar(ctx, game, view);
  drawEventFeed(ctx, game, view, pad);

  ctx.restore();
}

/** Difficoltà e stato audio, in alto a destra. */
function drawZonaDestra(ctx, game, view, pad, audioLabel, audioFull) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = game.difficulty.color;
  ctx.fillText(game.difficulty.name.toUpperCase(), view.w - pad, pad + 18);
  ctx.fillStyle = audioFull ? PALETTE.textDim : '#7b6b48';
  ctx.fillText(`♪ ${audioLabel}  [M]`, view.w - pad, pad + 38);
  ctx.restore();
}

/** Barra della metamorfosi: si carica coi frammenti, lampeggia quando è pronta. */
export function drawDragonGauge(ctx, game, camera, pad = 18, opts = {}) {
  const p = game.player;
  const attivo = p.dragonTimer > 0;
  const pronto = p.dragonCharge >= 1;
  const x = pad;
  const y = pad + 172;
  const w = 268;
  const h = 46;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 23, 0.82)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = attivo || pronto ? DRAGON.color : 'rgba(255,255,255,0.09)';
  ctx.lineWidth = attivo ? 2 : 1;
  ctx.stroke();

  const ratio = attivo ? p.dragonTimer / DRAGON.duration : p.dragonCharge;
  const colore = attivo ? DRAGON.colorDeep : pronto ? DRAGON.color : '#8a6a4a';

  ctx.textAlign = 'left';
  ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = attivo || pronto ? DRAGON.color : PALETTE.textDim;
  const tasto = opts.transformKey === null ? '' : `  [${opts.transformKey || 'E'}]`;
  const etichetta = attivo
    ? `FORMA DI DRAGO · ${p.dragonTimer.toFixed(1)}s`
    : pronto
      ? `METAMORFOSI PRONTA${tasto}`
      : 'METAMORFOSI';
  ctx.fillText(etichetta, x + 16, y + 19);

  if (!attivo && !pronto) {
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${Math.round(p.dragonCharge * 100)}%`, x + w - 16, y + 19);
  }

  // lampeggio quando è pronta, per farsi notare
  const lampeggio = pronto && !attivo ? 0.72 + 0.28 * Math.sin(game.time * 6) : 1;
  ctx.globalAlpha = lampeggio;
  bar(ctx, x + 16, y + 27, w - 32, 9, ratio, colore);
  ctx.restore();
}

/** Vita del boss: fascia in cima allo schermo, come si conviene. */
export function drawBossBar(ctx, game, camera) {
  const b = game.boss;
  if (!b || b.dead) return;

  const w = Math.min(560, camera.w - 120);
  const x = (camera.w - w) / 2;
  const y = 22;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
  roundRect(ctx, x - 12, y - 8, w + 24, 52, 12);
  ctx.fill();
  ctx.strokeStyle = b.def.color;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = b.def.color;
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(b.def.name, camera.w / 2, y + 8);

  // fondo scuro + vita + bordo
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, x, y + 16, w, 14, 7);
  ctx.fill();
  const ratio = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = b.def.color;
  roundRect(ctx, x, y + 16, w * ratio, 14, 7);
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${Math.max(0, b.hp)} / ${b.maxHp}`, x + w - 6, y + 27);

  // avviso durante la carica
  if (b.phase === 'aim' || b.phase === 'charge') {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(b.phase === 'aim' ? '⚠ STA CARICANDO' : '⚡ CARICA!', camera.w / 2, y + 44);
  }
  ctx.restore();
}

/** Cronaca degli eventi in basso a sinistra: pannello proprio, testo leggibile. */
export function drawEventFeed(ctx, game, camera, pad = 18) {
  if (!game.log.length) return;

  const lineH = 22;
  const w = Math.min(430, camera.w - pad * 2);
  const h = game.log.length * lineH + 34;
  const x = pad;
  const y = camera.h - pad - h;

  ctx.save();
  // Tenuto leggero: la cronaca non deve nascondere la mappa sotto di sé.
  ctx.fillStyle = 'rgba(10, 14, 23, 0.42)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(123, 135, 168, 0.75)';
  ctx.fillText('CRONACA', x + 16, y + 20);

  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  game.log.forEach((entry, i) => {
    // Le righe più vecchie sbiadiscono, ma restano leggibili.
    ctx.globalAlpha = Math.max(0.3, 1 - i * 0.13);
    // Con il pannello più trasparente il testo ha bisogno di un contorno scuro
    // per restare leggibile anche sopra un pavimento illuminato.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(6, 9, 16, 0.75)';
    ctx.strokeText(entry.text, x + 16, y + 42 + i * lineH);
    ctx.fillStyle = entry.color || PALETTE.text;
    ctx.fillText(entry.text, x + 16, y + 42 + i * lineH);
  });
  ctx.restore();
}

const NOTIF_W = 272;
const NOTIF_H = 56;
const NOTIF_GAP = 8;

/**
 * Colonna riservata alle notifiche, incolonnate lungo il bordo destro sotto gli
 * indicatori. Il gioco si svolge al centro dello schermo: qui non copre nulla, e
 * le schede restano semitrasparenti perché si intraveda comunque cosa c'è sotto.
 */
export function drawNotifications(ctx, camera, notifications, pad = 18) {
  if (!notifications.length) return;
  const { off, view } = areaSicura(camera);
  const x = view.w - pad - NOTIF_W;
  const top = pad + 58; // sotto difficoltà e stato audio

  ctx.save();
  ctx.translate(off.left, off.top);
  notifications.forEach((n, i) => {
    const age = 1 - n.life / n.maxLife;
    const slideIn = age < 0.14 ? 1 - age / 0.14 : 0;
    const fadeOut = n.life < 0.55 ? n.life / 0.55 : 1;

    const y = top + i * (NOTIF_H + NOTIF_GAP);
    const nx = x + slideIn * (NOTIF_W + pad);

    ctx.globalAlpha = Math.max(0, Math.min(1, fadeOut)) * 0.93;

    ctx.fillStyle = 'rgba(10, 14, 23, 0.8)';
    roundRect(ctx, nx, y, NOTIF_W, NOTIF_H, 10);
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha *= 0.75;
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, Math.min(1, fadeOut)) * 0.93;

    // banda colorata a sinistra
    ctx.fillStyle = n.color;
    roundRect(ctx, nx + 4, y + 9, 3.5, NOTIF_H - 18, 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = n.color;
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(n.title, nx + 18, y + 24);

    ctx.fillStyle = PALETTE.text;
    ctx.font = '11.5px "Segoe UI", system-ui, sans-serif';
    ctx.globalAlpha *= 0.85;
    ctx.fillText(n.subtitle, nx + 18, y + 42);
  });
  ctx.restore();
}

function formatTime(secondi) {
  const m = Math.floor(secondi / 60);
  const s = Math.floor(secondi % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Riepilogo di fine partita: cosa hai fatto davvero, non solo se hai vinto. */
export function drawEndScreen(ctx, camera, game, title, color, hint, ready = true) {
  const s = game.stats;
  const p = game.player;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 11, 18, 0.93)';
  ctx.fillRect(0, 0, camera.w, camera.h);

  const panelW = Math.min(660, camera.w - 48);
  const panelH = Math.min(486, camera.h - 40);
  const x = (camera.w - panelW) / 2;
  const y = (camera.h - panelH) / 2;

  ctx.fillStyle = 'rgba(14, 19, 31, 0.96)';
  roundRect(ctx, x, y, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const cx = camera.w / 2;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.font = 'bold 38px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(title, cx, y + 54);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(
    `${game.difficulty.name} · piano ${s.pianoMax} di 30 · livello ${p.level} · ${formatTime(s.tempo)}`,
    cx,
    y + 78
  );

  // Griglia di statistiche su due colonne
  const precisione = s.colpiSferrati ? Math.round((s.colpiAndatiASegno / s.colpiSferrati) * 100) : 0;
  const esplorazione = s.esplorazioneMedia.length
    ? Math.round((s.esplorazioneMedia.reduce((a, b) => a + b, 0) / s.esplorazioneMedia.length) * 100)
    : Math.round(game.exploredRatio * 100);

  const voci = [
    ['Nemici abbattuti', `${s.uccisioni}`],
    ['Guardiani sconfitti', `${s.bossAbbattuti} / 3`],
    ['Danno inflitto', `${s.dannoInflitto}`],
    ['Danno subito', `${s.dannoSubito}`],
    ['Precisione colpi', `${precisione}%`],
    ['Mappa esplorata (media)', `${esplorazione}%`],
    ['Trasformazioni', `${s.trasformazioni}`],
    ['Tempo da drago', formatTime(s.tempoInDrago)],
    ['Pozioni bevute', `${s.pozioniBevute}`],
    ['Frammenti · Tomi', `${s.frammenti} · ${s.tomi}`],
  ];

  const colW = (panelW - 96) / 2;
  const startY = y + 116;
  const rowH = 30;
  ctx.font = '13.5px "Segoe UI", system-ui, sans-serif';
  voci.forEach(([etichetta, valore], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rx = x + 48 + col * colW;
    const ry = startY + row * rowH;

    if (col === 0 && row % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      roundRect(ctx, x + 32, ry - 15, panelW - 64, rowH - 2, 6);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(etichetta, rx, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(valore, rx + colW - 22, ry);
    ctx.font = '13.5px "Segoe UI", system-ui, sans-serif';
  });

  // Bestiario: chi hai incontrato di più
  const tipi = Object.entries(s.uccisioniPerTipo).sort((a, b) => b[1] - a[1]);
  if (tipi.length) {
    const by = startY + Math.ceil(voci.length / 2) * rowH + 18;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(123, 135, 168, 0.8)';
    ctx.font = 'bold 10.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('BESTIARIO', x + 32, by);

    const max = tipi[0][1];
    tipi.slice(0, 4).forEach(([nome, n], i) => {
      const ry = by + 20 + i * 20;
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '12.5px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(nome, x + 32, ry);
      // barra proporzionale al più frequente
      const bx = x + 178;
      const bw = panelW - 178 - 74;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, bx, ry - 8, bw, 8, 4);
      ctx.fill();
      ctx.fillStyle = PALETTE.player;
      roundRect(ctx, bx, ry - 8, Math.max(4, bw * (n / max)), 8, 4);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`${n}`, x + panelW - 32, ry);
      ctx.textAlign = 'left';
    });
  }

  ctx.textAlign = 'center';
  if (ready) {
    // pulsa piano: si vede che ora aspetta te
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(game.time * 4);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 13.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(hint, cx, y + panelH - 22);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(123, 135, 168, 0.5)';
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('…', cx, y + panelH - 22);
  }
  ctx.restore();
}

/**
 * Menu di pausa: raccoglie tutto ciò che è stato tolto dallo schermo di gioco —
 * vita, statistiche, esplorazione — e i comandi che sul telefono non hanno un
 * tasto, l'audio per primo. Restituisce le zone toccabili.
 */
export function drawPauseScreen(ctx, camera, game, opts = {}) {
  const p = game.player;
  const s = game.stats;
  const zones = [];

  ctx.save();
  ctx.fillStyle = 'rgba(8, 11, 18, 0.9)';
  ctx.fillRect(0, 0, camera.w, camera.h);

  const panelW = Math.min(540, camera.w - 60);
  // La riga della visibilità, quando c'è, ha bisogno del suo spazio: senza
  // allungare il pannello finirebbe sopra l'ultima riga di statistiche.
  const conVisibilita = opts.touchOpacity !== undefined && opts.touchOpacity !== null;
  const panelH = Math.min(conVisibilita ? 484 : 430, camera.h - 40);
  const x = (camera.w - panelW) / 2;
  const y = (camera.h - panelH) / 2;
  const cx = camera.w / 2;

  ctx.fillStyle = 'rgba(14, 19, 31, 0.97)';
  roundRect(ctx, x, y, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = PALETTE.player;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.player;
  ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PAUSA', cx, y + 46);

  ctx.fillStyle = game.difficulty.color;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${game.difficulty.name.toUpperCase()} · PIANO ${game.depth} DI 30`, cx, y + 68);

  // Vita, in evidenza: è il dato che si toglie dallo schermo di gioco
  const barW = panelW - 96;
  const hpFrac = p.hp / p.maxHp;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('VITA', x + 48, y + 96);
  ctx.textAlign = 'right';
  ctx.fillStyle = hpFrac < 0.3 ? '#ff6b6b' : hpFrac < 0.5 ? '#ffa94d' : PALETTE.text;
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${p.hp} / ${p.maxHp}`, x + 48 + barW, y + 96);
  bar(ctx, x + 48, y + 104, barW, 11, hpFrac, PALETTE.hp);

  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '11px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`ESPERIENZA · livello ${p.level}`, x + 48, y + 134);
  bar(ctx, x + 48, y + 140, barW, 7, p.xp / p.xpToNext, PALETTE.xp);

  const tier = game.speedTier > 0 ? SPEED_TIERS[game.speedTier - 1] : null;
  const voci = [
    ['Attacco', `${p.atk}`],
    ['Difesa', `${p.def}`],
    ['Pozioni', `${p.potions}`],
    ['Metamorfosi', p.dragonTimer > 0 ? `attiva · ${p.dragonTimer.toFixed(0)}s` : `${Math.round(p.dragonCharge * 100)}%`],
    ['Mappa esplorata', game.arenaRoom ? '—' : `${Math.round(game.exploredRatio * 100)}%`],
    ['Velocità', game.arenaRoom ? `arena ×${ARENA_SPEED}` : tier ? `${tier.name} ×${tier.mult}` : 'normale'],
    ['Nemici abbattuti', `${s.uccisioni}`],
    ['Guardiani', `${s.bossAbbattuti} / 3`],
  ];

  const colW = (panelW - 96) / 2;
  const startY = y + 172;
  const rowH = 24;
  voci.forEach(([etichetta, valore], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rx = x + 48 + col * colW;
    const ry = startY + row * rowH;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(etichetta, rx, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 12.5px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(valore, rx + colW - 20, ry);
  });

  // Comandi toccabili
  const btnY = y + panelH - 68;
  const btnH = 44;
  const gap = 10;
  const audioW = panelW - 96;
  zones.push({ kind: 'audio', x: x + 48, y: btnY - 52, w: audioW, h: btnH });
  ctx.fillStyle = opts.audioFull ? 'rgba(78, 205, 196, 0.14)' : 'rgba(255,255,255,0.05)';
  roundRect(ctx, x + 48, btnY - 52, audioW, btnH, 10);
  ctx.fill();
  ctx.strokeStyle = opts.audioFull ? PALETTE.player : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = opts.audioFull ? PALETTE.player : PALETTE.textDim;
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`♪  ${opts.audioLabel || 'Audio'}`, cx, btnY - 52 + 28);

  // Visibilità dei comandi a schermo: solo dove i comandi esistono davvero.
  if (opts.touchOpacity !== undefined && opts.touchOpacity !== null) {
    const oy = btnY - 104;
    zones.push({ kind: 'opacity', x: x + 48, y: oy, w: audioW, h: btnH });
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x + 48, oy, audioW, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('VISIBILITÀ TASTI', x + 66, oy + 28);

    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.round(opts.touchOpacity * 100)}%`, x + 48 + audioW - 62, oy + 28);

    // Anteprima: un pulsante in miniatura alla visibilità scelta, così si vede
    // subito l'effetto senza dover uscire dalla pausa.
    const px = x + 48 + audioW - 32;
    const py = oy + btnH / 2;
    const pr = 13;
    ctx.save();
    ctx.globalAlpha = 0.22 * opts.touchOpacity;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.6 * opts.touchOpacity;
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.92 * opts.touchOpacity;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - pr * 0.4, py + pr * 0.4);
    ctx.lineTo(px + pr * 0.4, py - pr * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  const half = (audioW - gap) / 2;
  const azioni = [
    { kind: 'resume', label: opts.resumeLabel || 'RIPRENDI', color: PALETTE.player, x: x + 48 },
    { kind: 'menu', label: opts.menuLabel || 'MENU', color: '#8a94ad', x: x + 48 + half + gap },
  ];
  azioni.forEach((a) => {
    zones.push({ kind: a.kind, x: a.x, y: btnY, w: half, h: btnH });
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, a.x, btnY, half, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = a.color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = a.color;
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(a.label, a.x + half / 2, btnY + 28);
  });

  ctx.restore();
  return zones;
}
