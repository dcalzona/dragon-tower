import { PLAYER } from './config.js';

export const MONSTER_TYPES = [
  { id: 'slime', name: 'Melma', color: '#7bd88f', hp: 12, atk: 4, speed: 1.9, xp: 6, radius: 0.34, minDepth: 1 },
  { id: 'bat', name: 'Pipistrello', color: '#c084fc', hp: 9, atk: 5, speed: 3.4, xp: 8, radius: 0.28, minDepth: 1 },
  { id: 'goblin', name: 'Goblin', color: '#ffa94d', hp: 20, atk: 8, speed: 2.6, xp: 14, radius: 0.34, minDepth: 3 },
  { id: 'wraith', name: 'Spettro', color: '#7aa2ff', hp: 26, atk: 12, speed: 2.9, xp: 22, radius: 0.36, minDepth: 6 },
  { id: 'drake', name: 'Draghetto', color: '#ff6b6b', hp: 40, atk: 17, speed: 3.1, xp: 36, radius: 0.42, minDepth: 9 },
];

export const ITEM_TYPES = {
  potion: { name: 'Pozione', color: '#63e6be' },
  crystal: { name: 'Frammento di Cristallo', color: '#ffd43b' },
  tome: { name: 'Tomo Antico', color: '#c084fc' },
};

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: { x: 0, y: 1 },
    radius: PLAYER.radius,
    hp: 60,
    maxHp: 60,
    atk: 9,
    def: 2,
    level: 1,
    xp: 0,
    xpToNext: 20,
    potions: 2,
    crystals: 0,
    attackTimer: 0,
    invulnTimer: 0,
    swingTimer: 0,
    dead: false,
    // Trasformazione in drago
    dragonCharge: 0,
    dragonTimer: 0,
    wingPhase: 0,
  };
}

export function createBoss(def, x, y, difficulty) {
  const maxHp = Math.round(def.hp * difficulty.enemyHp);
  return {
    boss: true,
    def,
    type: { id: def.id, name: def.name, color: def.color },
    x,
    y,
    radius: def.radius,
    hp: maxHp,
    maxHp,
    atk: Math.max(1, Math.round(def.atk * difficulty.enemyAtk)),
    speed: def.speed * difficulty.enemySpeed,
    xp: def.xp,
    attackTimer: 0,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    dead: false,
    // Ciclo di combattimento: insegue → punta → carica → riposa
    phase: 'chase',
    phaseTimer: 0,
    chargeDir: { x: 0, y: 0 },
    abilityTimer: 3,
    summonsLeft: def.summons,
    anim: Math.random() * 10,
  };
}

export function createProjectile(x, y, dx, dy, speed, damage, color) {
  return { x, y, vx: dx * speed, vy: dy * speed, damage, color, life: 4, radius: 0.24 };
}

export function xpForLevel(level) {
  return Math.floor(20 * Math.pow(1.45, level - 1));
}

export function spawnMonster(type, x, y, depth) {
  const scale = 1 + (depth - 1) * 0.16;
  const maxHp = Math.round(type.hp * scale);
  return {
    type,
    x,
    y,
    radius: type.radius,
    hp: maxHp,
    maxHp,
    atk: Math.round(type.atk * scale),
    speed: type.speed,
    xp: Math.round(type.xp * (1 + (depth - 1) * 0.2)),
    attackTimer: 0,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    dead: false,
  };
}

export function pickMonsterType(depth) {
  const available = MONSTER_TYPES.filter((t) => t.minDepth <= depth);
  return available[Math.floor(Math.random() * available.length)];
}
