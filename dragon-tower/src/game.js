import {
  MAP_W,
  MAP_H,
  TILES,
  PLAYER,
  FOV_RADIUS,
  DIFFICULTIES,
  SPEED_TIERS,
  DRAGON,
  bossForFloor,
} from './config.js';
import { generateDungeon, isBlocked } from './dungeon.js';
import {
  createPlayer,
  createBoss,
  createProjectile,
  spawnMonster,
  pickMonsterType,
  xpForLevel,
  ITEM_TYPES,
} from './entities.js';

function createStats() {
  return {
    tempo: 0,
    pianoMax: 1,
    uccisioni: 0,
    uccisioniPerTipo: {},
    bossAbbattuti: 0,
    dannoInflitto: 0,
    dannoSubito: 0,
    colpiSferrati: 0,
    colpiAndatiASegno: 0,
    pozioniBevute: 0,
    frammenti: 0,
    tomi: 0,
    trasformazioni: 0,
    tempoInDrago: 0,
    livelloMax: 1,
    esplorazioneMedia: [],
  };
}

export class Game {
  constructor(difficulty = DIFFICULTIES[1], audio = null) {
    this.difficulty = difficulty;
    this.audio = audio;
    this.depth = 1;
    this.player = null;
    this.particles = [];
    this.floatingTexts = [];
    this.log = [];
    this.notifications = [];
    this.projectiles = [];
    this.state = 'playing';
    this.time = 0;
    this.stats = createStats();
    this.loadFloor(1, true);
  }

  loadFloor(depth, isFirst) {
    const dungeon = generateDungeon(depth);
    this.depth = depth;
    this.tiles = dungeon.tiles;
    this.rooms = dungeon.rooms;
    this.stairs = dungeon.stairs;
    this.stairsRoom = dungeon.stairsRoom;

    this.visible = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));
    this.explored = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));

    // Conta solo le caselle calpestabili: così il 100% è davvero raggiungibile.
    this.walkableTotal = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = this.tiles[y][x];
        if (t === TILES.FLOOR || t === TILES.STAIRS) this.walkableTotal++;
      }
    }
    this.walkableExplored = 0;
    this.speedTier = 0;

    if (isFirst) {
      this.player = createPlayer(dungeon.start.x, dungeon.start.y);
      const d = this.difficulty;
      this.player.maxHp = Math.round(this.player.maxHp * d.playerHp);
      this.player.hp = this.player.maxHp;
      this.player.potions = d.startPotions;
    } else {
      this.player.x = dungeon.start.x;
      this.player.y = dungeon.start.y;
    }

    this.monsters = [];
    this.items = [];
    this.projectiles = [];
    this.boss = null;
    this.spawnFloorContent();

    // Ogni dieci piani la Torre mette un guardiano davanti alle scale.
    const bossDef = bossForFloor(depth);
    if (bossDef) this.spawnBoss(bossDef);

    this.updateFOV();
    if (this.stats) this.stats.pianoMax = Math.max(this.stats.pianoMax, depth);

    this.addLog(`Piano ${depth} della Torre.`, '#8fb8ff');
  }

  spawnBoss(def) {
    // Nell'arena delle scale, così lo si incontra per forza prima di scendere.
    const room = this.stairsRoom;
    const bx = room.cx + 0.5;
    const by = room.cy + 0.5;
    this.boss = createBoss(def, bx, by, this.difficulty);
    this.monsters.push(this.boss);
    this.notify(def.name, def.subtitle, def.color, 5);
    this.addLog(`${def.name} sbarra la strada!`, def.color);
    this.sfx('boss');
  }

  spawnFloorContent() {
    const d = this.difficulty;
    const monsterCount = Math.round(Math.min(4 + Math.floor(this.depth * 1.4), 16) * d.enemyCount);
    for (let i = 0; i < monsterCount; i++) {
      const room = this.rooms[1 + Math.floor(Math.random() * (this.rooms.length - 1))];
      if (!room) continue;
      const p = room.randomPoint();
      const type = pickMonsterType(this.depth);
      const m = spawnMonster(type, p.x + 0.5, p.y + 0.5, this.depth);
      m.maxHp = Math.max(1, Math.round(m.maxHp * d.enemyHp));
      m.hp = m.maxHp;
      m.atk = Math.max(1, Math.round(m.atk * d.enemyAtk));
      m.speed *= d.enemySpeed;
      m.xp = Math.round(m.xp * d.xpGain);
      this.monsters.push(m);
    }

    const itemCount = Math.max(1, Math.round((2 + Math.floor(Math.random() * 3)) * d.potionDrop));
    for (let i = 0; i < itemCount; i++) {
      const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
      if (!room) continue;
      const p = room.randomPoint();
      const roll = Math.random();
      const kind = roll < 0.6 ? 'potion' : roll < 0.85 ? 'crystal' : 'tome';
      this.items.push({ x: p.x + 0.5, y: p.y + 0.5, kind });
    }
  }

  sfx(name) {
    if (this.audio) this.audio.sfx(name);
  }

  /** Segna una casella come esplorata tenendo aggiornato il conteggio. */
  markExplored(x, y) {
    if (this.explored[y][x]) return;
    this.explored[y][x] = true;
    const t = this.tiles[y][x];
    if (t === TILES.FLOOR || t === TILES.STAIRS) this.walkableExplored++;
  }

  get exploredRatio() {
    return this.walkableTotal ? this.walkableExplored / this.walkableTotal : 0;
  }

  get speedMultiplier() {
    return this.speedTier > 0 ? SPEED_TIERS[this.speedTier - 1].mult : 1;
  }

  /** Promuove il giocatore al livello di velocità che l'esplorazione gli ha guadagnato. */
  checkSpeedTier() {
    const ratio = this.exploredRatio;
    let tier = 0;
    SPEED_TIERS.forEach((t, i) => {
      if (ratio >= t.at) tier = i + 1;
    });
    if (tier > this.speedTier) {
      this.speedTier = tier;
      const t = SPEED_TIERS[tier - 1];
      this.notify(t.name, t.desc, t.color);
      this.addLog(`${t.name}: ${t.desc}.`, t.color);
      this.burst(this.player.x, this.player.y, t.color, 26);
      this.sfx('boost');
    }
  }

  /** Le notifiche si impilano nella colonna dedicata, senza coprire l'azione. */
  notify(title, subtitle, color, life = 3.6) {
    this.notifications.push({ title, subtitle, color, life, maxLife: life });
    if (this.notifications.length > 4) this.notifications.shift();
  }

  addLog(text, color = null) {
    this.log.unshift({ text, color });
    if (this.log.length > 7) this.log.pop();
  }

  addFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color,
        size: 2 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
      });
    }
  }

  update(dt, input) {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.stats.tempo += dt;
    this.updatePlayer(dt, input);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updateFOV();
    this.checkSpeedTier();

    this.notifications.forEach((n) => {
      n.life -= dt;
    });
    this.notifications = this.notifications.filter((n) => n.life > 0);
  }

  updatePlayer(dt, input) {
    const p = this.player;
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.swingTimer = Math.max(0, p.swingTimer - dt);
    p.wingPhase += dt * (this.isDragon ? 9 : 0);

    if (p.dragonTimer > 0) {
      p.dragonTimer = Math.max(0, p.dragonTimer - dt);
      this.stats.tempoInDrago += dt;
      // scia di brace mentre sei in forma di drago
      if (Math.random() < dt * 26) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 0.5,
          y: p.y + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.4 - Math.random() * 0.6,
          color: Math.random() < 0.5 ? DRAGON.color : DRAGON.colorDeep,
          size: 1.5 + Math.random() * 2.5,
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.65,
        });
      }
      if (p.dragonTimer === 0) {
        this.addLog('La forma di drago svanisce.', DRAGON.color);
        this.notify('FORMA UMANA', 'La metamorfosi è finita', '#8a94ad', 2.6);
        this.burst(p.x, p.y, DRAGON.color, 20);
      }
    }

    const dx = input.moveX;
    const dy = input.moveY;
    const mag = Math.hypot(dx, dy);

    if (mag > 0.001) {
      // Lo stick analogico dosa la velocità; la direzione resta normalizzata.
      const speed = PLAYER.speed * this.speedMultiplier * Math.min(1, mag);
      p.facing = { x: dx / mag, y: dy / mag };
      this.moveWithCollision(p, (dx / mag) * speed * dt, (dy / mag) * speed * dt);
    }

    if (input.attack && p.attackTimer <= 0) {
      this.playerAttack();
    }

    this.items = this.items.filter((item) => {
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d > 0.6) return true;
      this.pickUp(item);
      return false;
    });

    // L'arcata è incassata nel muro: pretendere di centrarne la casella sarebbe
    // pignolo, quindi basta accostarsi alla soglia.
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    const sulleScale =
      this.tiles[ty][tx] === TILES.STAIRS ||
      Math.hypot(this.stairs.x + 0.5 - p.x, this.stairs.y + 0.5 - p.y) < 0.78;

    if (sulleScale) {
      // Il guardiano sbarra le scale: niente scorciatoie.
      if (this.boss && !this.boss.dead) {
        if (this.time - (this.lastBlockedWarning || -9) > 3) {
          this.lastBlockedWarning = this.time;
          this.addLog('Le scale sono sigillate finché il guardiano vive.', this.boss.def.color);
          this.notify('SCALE SIGILLATE', `Abbatti ${this.boss.def.name}`, this.boss.def.color, 2.6);
        }
      } else {
        this.descend();
      }
    }
  }

  /** Metamorfosi in drago: si sblocca coi Frammenti di Cristallo, si attiva a comando. */
  transform() {
    const p = this.player;
    if (p.dragonTimer > 0) return;
    if (p.dragonCharge < 1) {
      this.addLog('Servono più Frammenti di Cristallo.', '#ffd43b');
      return;
    }
    p.dragonCharge = 0;
    p.dragonTimer = DRAGON.duration;
    p.invulnTimer = Math.max(p.invulnTimer, 0.6);
    this.stats.trasformazioni++;
    this.notify('FORMA DI DRAGO', `Danno ×${DRAGON.damageMult} · ${DRAGON.duration}s`, DRAGON.color, 4);
    this.addLog('Le squame ti ricoprono: sei un drago!', DRAGON.color);
    this.burst(p.x, p.y, DRAGON.color, 44);
    this.sfx('transform');
  }

  get isDragon() {
    return this.player.dragonTimer > 0;
  }

  pickUp(item) {
    const p = this.player;
    const def = ITEM_TYPES[item.kind];
    if (item.kind === 'potion') {
      p.potions += 1;
      this.addLog('Hai raccolto una pozione.', def.color);
    } else if (item.kind === 'crystal') {
      p.crystals += 1;
      p.atk += 1;
      this.stats.frammenti++;
      const prima = p.dragonCharge;
      p.dragonCharge = Math.min(1, p.dragonCharge + DRAGON.chargePerCrystal);
      this.addLog('Frammento di Cristallo! Attacco +1.', def.color);
      this.notify(
        'FRAMMENTO DI CRISTALLO',
        `Attacco +1 · metamorfosi ${Math.round(p.dragonCharge * 100)}%`,
        def.color,
        2.8
      );
      if (prima < 1 && p.dragonCharge >= 1) {
        this.notify('METAMORFOSI PRONTA', 'Premi E per diventare drago', DRAGON.color, 4.5);
        this.addLog('Il cristallo pulsa: puoi trasformarti.', DRAGON.color);
        this.sfx('ready');
      }
    } else {
      p.maxHp += 8;
      p.hp = Math.min(p.maxHp, p.hp + 8);
      this.stats.tomi++;
      this.addLog('Tomo Antico! Vita massima +8.', def.color);
      this.notify('TOMO ANTICO', 'Vita massima +8', def.color, 2.8);
    }
    this.addFloatingText(item.x, item.y - 0.5, def.name, def.color);
    this.burst(item.x, item.y, def.color, 8);
    this.sfx('pickup');
  }

  usePotion() {
    const p = this.player;
    if (p.potions <= 0) {
      this.addLog('Non hai pozioni.');
      return;
    }
    if (p.hp >= p.maxHp) return;
    p.potions -= 1;
    this.stats.pozioniBevute++;
    const heal = Math.round(p.maxHp * 0.45);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    this.addFloatingText(p.x, p.y - 0.8, `+${heal}`, '#63e6be');
    this.burst(p.x, p.y, '#63e6be', 12);
    this.addLog(`Pozione bevuta: +${heal} PV.`);
    this.sfx('potion');
  }

  playerAttack() {
    const p = this.player;
    p.attackTimer = PLAYER.attackCooldown;
    p.swingTimer = 0.18;
    this.sfx('swing');

    const facingAngle = Math.atan2(p.facing.y, p.facing.x);
    let hitAny = false;
    const dragon = this.isDragon;
    const range = PLAYER.attackRange + (dragon ? DRAGON.rangeBonus : 0);
    const arc = PLAYER.attackArc + (dragon ? DRAGON.arcBonus : 0);
    this.stats.colpiSferrati++;

    if (dragon) this.breatheFire(facingAngle, range);

    this.monsters.forEach((m) => {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range + m.radius) return;
      const angle = Math.atan2(dy, dx);
      let diff = Math.abs(angle - facingAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > arc / 2) return;

      let damage = Math.max(1, p.atk + Math.floor(Math.random() * 4) - 1);
      if (dragon) damage = Math.round(damage * DRAGON.damageMult);
      m.hp -= damage;
      this.stats.dannoInflitto += damage;
      m.hitFlash = 0.12;
      m.knockX = (dx / (dist || 1)) * 3.4;
      m.knockY = (dy / (dist || 1)) * 3.4;
      this.addFloatingText(m.x, m.y - 0.7, `${damage}`, '#ffffff');
      this.burst(m.x, m.y, m.type.color, 6);
      hitAny = true;

      if (m.hp <= 0) this.killMonster(m);
    });

    if (hitAny) {
      this.stats.colpiAndatiASegno++;
      this.sfx('hit');
      this.monsters = this.monsters.filter((m) => !m.dead);
    }
  }

  /** Soffio infuocato: puro effetto scenico, il danno resta quello dell'arco d'attacco. */
  breatheFire(angle, range) {
    const p = this.player;
    for (let i = 0; i < 16; i++) {
      const spread = (Math.random() - 0.5) * DRAGON.arcBonus * 2.4;
      const a = angle + spread;
      const speed = 3.5 + Math.random() * 4.5;
      this.particles.push({
        x: p.x + Math.cos(a) * 0.4,
        y: p.y + Math.sin(a) * 0.4,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color: Math.random() < 0.45 ? '#ffe066' : Math.random() < 0.6 ? DRAGON.color : DRAGON.colorDeep,
        size: 2.5 + Math.random() * 4,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.44,
      });
    }
    this.sfx('fire');
  }

  killMonster(m) {
    m.dead = true;
    const p = this.player;
    p.xp += m.xp;
    this.stats.uccisioni++;
    const nome = m.type.name;
    this.stats.uccisioniPerTipo[nome] = (this.stats.uccisioniPerTipo[nome] || 0) + 1;

    if (m.boss) {
      this.stats.bossAbbattuti++;
      this.boss = null;
      this.burst(m.x, m.y, m.def.color, 70);
      this.notify('GUARDIANO ABBATTUTO', `${m.def.name} · scale libere`, m.def.color, 5);
      this.addLog(`${m.def.name} crolla. Le scale si aprono.`, m.def.color);
      // Un boss vale una trasformazione intera.
      p.dragonCharge = Math.min(1, p.dragonCharge + DRAGON.chargePerBoss);
      this.notify('CRISTALLO CARICO', 'Trasformazione pronta', DRAGON.color, 4);
      this.sfx('bossdown');
    } else {
      this.burst(m.x, m.y, m.type.color, 16);
      this.sfx('kill');
    }
    this.addFloatingText(m.x, m.y - 1, `+${m.xp} XP`, '#4ecdc4');

    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = xpForLevel(p.level + 1);
      p.maxHp += 10;
      p.hp = p.maxHp;
      p.atk += 2;
      p.def += 1;
      this.addFloatingText(p.x, p.y - 1.2, 'LIVELLO SU!', '#ffd43b');
      this.burst(p.x, p.y, '#ffd43b', 22);
      this.addLog(`Livello ${p.level}! Ti senti più forte.`, '#ffd43b');
      this.notify(`LIVELLO ${p.level}`, 'PV +10 · ATT +2 · DIF +1', '#ffd43b');
      this.stats.livelloMax = p.level;
      this.sfx('levelup');
    }
  }

  updateMonsters(dt) {
    const p = this.player;

    this.monsters.forEach((m) => {
      m.hitFlash = Math.max(0, m.hitFlash - dt);
      m.attackTimer = Math.max(0, m.attackTimer - dt);

      if (m.boss) {
        this.updateBoss(m, dt);
        return;
      }

      if (Math.abs(m.knockX) > 0.05 || Math.abs(m.knockY) > 0.05) {
        this.moveWithCollision(m, m.knockX * dt, m.knockY * dt);
        m.knockX *= 0.82;
        m.knockY *= 0.82;
      }

      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const dist = Math.hypot(dx, dy);

      const tx = Math.floor(m.x);
      const ty = Math.floor(m.y);
      const aware = dist < 9 && this.visible[ty][tx];

      if (aware && dist > 0.1) {
        const nx = dx / dist;
        const ny = dy / dist;
        const contact = m.radius + p.radius + 0.05;
        if (dist > contact) {
          this.moveWithCollision(m, nx * m.speed * dt, ny * m.speed * dt);
        } else if (m.attackTimer <= 0 && p.invulnTimer <= 0) {
          this.damagePlayer(m);
        }
      }
    });
  }

  /**
   * I boss alternano quattro fasi: inseguimento, mira (telegrafata, così la carica
   * si può schivare), carica vera e propria, e una pausa che lascia una finestra
   * per colpirli. Sotto metà vita evocano rinforzi e sparano ventagli di proiettili.
   */
  updateBoss(b, dt) {
    const p = this.player;
    b.anim += dt;
    b.phaseTimer -= dt;
    b.abilityTimer -= dt;

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (Math.abs(b.knockX) > 0.05 || Math.abs(b.knockY) > 0.05) {
      this.moveWithCollision(b, b.knockX * dt * 0.4, b.knockY * dt * 0.4);
      b.knockX *= 0.8;
      b.knockY *= 0.8;
    }

    switch (b.phase) {
      case 'chase': {
        const contact = b.radius + p.radius + 0.05;
        if (dist > contact) this.moveWithCollision(b, nx * b.speed * dt, ny * b.speed * dt);
        else if (b.attackTimer <= 0 && p.invulnTimer <= 0) this.damagePlayer(b);
        if (b.phaseTimer <= 0 && dist < 11) {
          b.phase = 'aim';
          b.phaseTimer = 0.85;
          b.chargeDir = { x: nx, y: ny };
        }
        break;
      }
      case 'aim':
        // resta fermo e punta: è il preavviso per il giocatore
        b.chargeDir = { x: nx * 0.35 + b.chargeDir.x * 0.65, y: ny * 0.35 + b.chargeDir.y * 0.65 };
        if (b.phaseTimer <= 0) {
          b.phase = 'charge';
          b.phaseTimer = 0.75;
          this.sfx('charge');
        }
        break;
      case 'charge': {
        const before = { x: b.x, y: b.y };
        this.moveWithCollision(b, b.chargeDir.x * b.def.chargeSpeed * dt, b.chargeDir.y * b.def.chargeSpeed * dt);
        const moved = Math.hypot(b.x - before.x, b.y - before.y);
        if (dist < b.radius + p.radius + 0.25 && p.invulnTimer <= 0) this.damagePlayer(b, 1.35);
        if (b.phaseTimer <= 0 || moved < 0.004) {
          b.phase = 'rest';
          b.phaseTimer = 1.15; // finestra per contrattaccare
          this.burst(b.x, b.y, b.def.color, 14);
        }
        break;
      }
      case 'rest':
      default:
        if (b.phaseTimer <= 0) {
          b.phase = 'chase';
          b.phaseTimer = 2.4 + Math.random() * 1.6;
        }
        break;
    }

    // Abilità speciali, più frequenti quando il boss è ferito
    const ferito = b.hp / b.maxHp < 0.55;
    if (b.abilityTimer <= 0) {
      b.abilityTimer = ferito ? 3.4 : 5.2;
      if (b.def.projectiles > 0) this.bossVolley(b);
      else if (b.summonsLeft > 0) this.bossSummon(b);
      if (ferito && b.def.projectiles > 0 && b.summonsLeft > 0 && Math.random() < 0.5) this.bossSummon(b);
    }
  }

  bossVolley(b) {
    const p = this.player;
    const base = Math.atan2(p.y - b.y, p.x - b.x);
    const n = b.def.projectiles;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.26;
      this.projectiles.push(
        createProjectile(b.x, b.y, Math.cos(a), Math.sin(a), 6.2, Math.round(b.atk * 0.55), b.def.color)
      );
    }
    this.sfx('volley');
  }

  bossSummon(b) {
    b.summonsLeft--;
    const n = 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = b.x + Math.cos(a) * 1.6;
      const y = b.y + Math.sin(a) * 1.6;
      if (isBlocked(this.tiles, x, y)) continue;
      const type = pickMonsterType(this.depth);
      const m = spawnMonster(type, x, y, this.depth);
      m.maxHp = Math.max(1, Math.round(m.maxHp * this.difficulty.enemyHp));
      m.hp = m.maxHp;
      m.atk = Math.max(1, Math.round(m.atk * this.difficulty.enemyAtk));
      m.speed *= this.difficulty.enemySpeed;
      this.monsters.push(m);
      this.burst(x, y, b.def.color, 10);
    }
    this.addLog(`${b.def.name} chiama rinforzi!`, b.def.color);
    this.sfx('summon');
  }

  updateProjectiles(dt) {
    const p = this.player;
    this.projectiles.forEach((pr) => {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (isBlocked(this.tiles, pr.x, pr.y)) {
        pr.life = 0;
        this.burst(pr.x, pr.y, pr.color, 6);
        return;
      }
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.radius + p.radius && p.invulnTimer <= 0) {
        pr.life = 0;
        this.hurtPlayer(pr.damage, pr.x, pr.y);
      }
    });
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  damagePlayer(m, multiplier = 1) {
    const p = this.player;
    m.attackTimer = 0.8;
    const raw = Math.max(1, m.atk * multiplier - p.def + Math.floor(Math.random() * 3) - 1);
    this.hurtPlayer(Math.round(raw), m.x, m.y);
  }

  /** Unico punto in cui il giocatore perde vita: danno da contatto e da proiettile. */
  hurtPlayer(amount, fromX, fromY) {
    const p = this.player;
    let damage = Math.max(1, amount);
    if (this.isDragon) damage = Math.max(1, Math.round(damage * DRAGON.damageTaken));

    p.hp -= damage;
    p.invulnTimer = PLAYER.invulnTime;
    this.stats.dannoSubito += damage;
    this.addFloatingText(p.x, p.y - 0.8, `-${damage}`, '#ff6b6b');
    this.burst(p.x, p.y, '#ff6b6b', 8);
    this.sfx('hurt');

    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.moveWithCollision(p, (dx / d) * 0.35, (dy / d) * 0.35);

    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.state = 'dead';
      this.addLog(`Sei caduto al piano ${this.depth}.`, '#ff6b6b');
      this.sfx('death');
    }
  }

  descend() {
    this.stats.esplorazioneMedia.push(this.exploredRatio);
    this.addLog(`Scendi più in profondità...`, '#ffd43b');
    this.burst(this.player.x, this.player.y, '#ffd43b', 24);
    this.sfx('stairs');
    this.loadFloor(this.depth + 1, false);

    // Ogni dieci piani la Torre cambia colonna sonora: vale la pena dirlo.
    if (this.audio) {
      const nuovoBrano = this.audio.setDepth(this.depth);
      if (nuovoBrano) {
        this.notify(`♪ ${nuovoBrano.name.toUpperCase()}`, `Nuova colonna sonora · ${nuovoBrano.floors}`, '#c084fc', 4.2);
        this.addLog(`La musica cambia: "${nuovoBrano.name}".`, '#c084fc');
      }
    }
    if (this.depth > 30) this.state = 'won';
  }

  moveWithCollision(entity, dx, dy) {
    const r = entity.radius;

    const nextX = entity.x + dx;
    if (
      !isBlocked(this.tiles, nextX + Math.sign(dx) * r, entity.y - r * 0.7) &&
      !isBlocked(this.tiles, nextX + Math.sign(dx) * r, entity.y + r * 0.7)
    ) {
      entity.x = nextX;
    }

    const nextY = entity.y + dy;
    if (
      !isBlocked(this.tiles, entity.x - r * 0.7, nextY + Math.sign(dy) * r) &&
      !isBlocked(this.tiles, entity.x + r * 0.7, nextY + Math.sign(dy) * r)
    ) {
      entity.y = nextY;
    }
  }

  updateParticles(dt) {
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);

    this.floatingTexts.forEach((t) => {
      t.y -= dt * 1.2;
      t.life -= dt;
    });
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
  }

  updateFOV() {
    const p = this.player;
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);
    const R = Math.ceil(FOV_RADIUS);

    for (let y = Math.max(0, py - R - 1); y <= Math.min(MAP_H - 1, py + R + 1); y++) {
      for (let x = Math.max(0, px - R - 1); x <= Math.min(MAP_W - 1, px + R + 1); x++) {
        this.visible[y][x] = false;
      }
    }

    this.visible[py][px] = true;
    this.markExplored(px, py);

    // Densità dei raggi calcolata sulla circonferenza esterna: a raggio pieno servono
    // più raggi di una tile di larghezza, altrimenti restano fessure d'ombra.
    const rays = Math.ceil(2 * Math.PI * FOV_RADIUS * 3);
    const stepLen = 0.2;
    const maxSteps = Math.ceil(FOV_RADIUS / stepLen);

    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let x = p.x;
      let y = p.y;
      for (let step = 0; step < maxSteps; step++) {
        x += dx * stepLen;
        y += dy * stepLen;
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) break;
        this.visible[ty][tx] = true;
        this.markExplored(tx, ty);
        if (this.tiles[ty][tx] === TILES.WALL || this.tiles[ty][tx] === TILES.VOID) break;
      }
    }

    this.lightBorderingWalls(px, py, R);
  }

  /**
   * Un muro che delimita una stanza illuminata dev'essere illuminato anche lui:
   * il raycast da solo lascia al buio le facce che nessun raggio colpisce in pieno.
   */
  lightBorderingWalls(px, py, R) {
    const y0 = Math.max(1, py - R - 1);
    const y1 = Math.min(MAP_H - 2, py + R + 1);
    const x0 = Math.max(1, px - R - 1);
    const x1 = Math.min(MAP_W - 2, px + R + 1);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.visible[y][x]) continue;
        if (this.tiles[y][x] !== TILES.WALL) continue;
        if (Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y) > FOV_RADIUS + 1) continue;

        scan: for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            const t = this.tiles[ny][nx];
            if (!this.visible[ny][nx] || (t !== TILES.FLOOR && t !== TILES.STAIRS)) continue;
            // Solo se il pavimento illuminato sta dalla parte del giocatore:
            // così i muri visti "di schiena" da un'altra stanza restano al buio.
            const towardPlayer =
              (this.player.x - (x + 0.5)) * dx + (this.player.y - (y + 0.5)) * dy;
            if (towardPlayer > 0) {
              this.visible[y][x] = true;
              this.markExplored(x, y);
              break scan;
            }
          }
        }
      }
    }
  }

  restart() {
    this.particles = [];
    this.floatingTexts = [];
    this.log = [];
    this.notifications = [];
    this.projectiles = [];
    this.boss = null;
    this.state = 'playing';
    this.player = null;
    this.stats = createStats();
    this.loadFloor(1, true);
  }
}
