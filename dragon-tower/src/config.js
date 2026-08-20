export const TILE = 34;

export const MAP_W = 52;
export const MAP_H = 36;

export const TILES = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  STAIRS: 3,
};

export const PALETTE = {
  void: '#080b12',
  floor: '#1a2133',
  floorLit: '#232d45',
  floorEdge: '#2b3550',
  wall: '#2a3450',
  wallLit: '#3a4870',
  wallTop: '#151b2b',
  player: '#4ecdc4',
  playerDark: '#2a8f88',
  stairs: '#ffd43b',
  hp: '#ff6b6b',
  xp: '#4ecdc4',
  text: '#dfe6f5',
  textDim: '#7b87a8',
};

export const PLAYER = {
  speed: 5.2,
  radius: 0.32,
  attackCooldown: 0.36,
  attackRange: 0.95,
  attackArc: Math.PI * 0.75,
  invulnTime: 0.55,
};

export const FOV_RADIUS = 8.5;

/**
 * La trasformazione in drago, il cuore dell'originale del 1990: i Frammenti di
 * Cristallo caricano la metamorfosi, che poi si spende quando serve davvero.
 */
export const DRAGON = {
  chargePerCrystal: 0.34, // tre frammenti per una trasformazione
  chargePerBoss: 1,
  duration: 20,
  speedMult: 1.3,
  damageMult: 2.1,
  rangeBonus: 0.55,
  arcBonus: Math.PI * 0.3,
  damageTaken: 0.5,
  color: '#ff9f45',
  colorDeep: '#ff5e3a',
};

export const BOSSES = [
  {
    floor: 10,
    id: 'guardiano',
    name: 'GUARDIANO DI PIETRA',
    subtitle: 'Il primo sigillo della Torre',
    color: '#8fb8ff',
    hp: 260,
    atk: 20,
    speed: 1.9,
    radius: 1.05,
    xp: 320,
    chargeSpeed: 7.2, // la carica: si ferma, punta, poi scatta
    projectiles: 0,
    summons: 2,
  },
  {
    floor: 20,
    id: 'signore',
    name: 'SIGNORE DELLE CRIPTE',
    subtitle: 'Ciò che resta dei re sepolti',
    color: '#c084fc',
    hp: 470,
    atk: 30,
    speed: 2.3,
    radius: 1.1,
    xp: 700,
    chargeSpeed: 8.4,
    projectiles: 5, // ventaglio di proiettili
    summons: 3,
  },
  {
    floor: 30,
    id: 'drago',
    name: 'DRAGO DI CRISTALLO',
    subtitle: 'Il custode del Cristallo',
    color: '#ff6b6b',
    hp: 820,
    atk: 40,
    speed: 2.6,
    radius: 1.3,
    xp: 1500,
    chargeSpeed: 9.5,
    projectiles: 8,
    summons: 4,
  },
];

export function bossForFloor(depth) {
  return BOSSES.find((b) => b.floor === depth) || null;
}

/**
 * Ricompensa per l'esplorazione: quando hai già visto quasi tutto il piano,
 * quello che resta è tornare indietro verso le scale — e camminare su terreno
 * noto dev'essere più rapido. Le soglie salgono con la mappa scoperta.
 */
export const SPEED_TIERS = [
  { at: 0.8, mult: 1.35, name: 'ESPLORATORE', desc: 'Piano quasi tutto svelato · velocità +35%', color: '#63e6be' },
  { at: 0.95, mult: 1.7, name: 'CARTOGRAFO', desc: 'Conosci ogni angolo · velocità +70%', color: '#ffd43b' },
];

export const DIFFICULTIES = [
  {
    id: 'facile',
    name: 'Facile',
    desc: 'Nemici più deboli e più pozioni. Per esplorare in tranquillità.',
    color: '#7bd88f',
    enemyHp: 0.75,
    enemyAtk: 0.7,
    enemyCount: 0.8,
    enemySpeed: 0.9,
    startPotions: 4,
    potionDrop: 1.35,
    xpGain: 1.2,
    playerHp: 1.25,
  },
  {
    id: 'normale',
    name: 'Normale',
    desc: "L'equilibrio pensato per la Torre. L'esperienza classica.",
    color: '#4ecdc4',
    enemyHp: 1,
    enemyAtk: 1,
    enemyCount: 1,
    enemySpeed: 1,
    startPotions: 2,
    potionDrop: 1,
    xpGain: 1,
    playerHp: 1,
  },
  {
    id: 'difficile',
    name: 'Difficile',
    desc: 'Nemici numerosi, rapidi e letali. Ogni pozione conta.',
    color: '#ffa94d',
    enemyHp: 1.35,
    enemyAtk: 1.45,
    enemyCount: 1.3,
    enemySpeed: 1.12,
    startPotions: 1,
    potionDrop: 0.75,
    xpGain: 1.15,
    playerHp: 0.9,
  },
  {
    id: 'incubo',
    name: 'Incubo',
    desc: 'La Torre non perdona nulla. Solo per veterani.',
    color: '#ff6b6b',
    enemyHp: 1.8,
    enemyAtk: 1.9,
    enemyCount: 1.5,
    enemySpeed: 1.25,
    startPotions: 0,
    potionDrop: 0.55,
    xpGain: 1.3,
    playerHp: 0.8,
  },
];
