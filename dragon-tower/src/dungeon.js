import { MAP_W, MAP_H, TILES, bossForFloor } from './config.js';

// I piani con un guardiano non sono dungeon: sono una sala unica e vasta, senza
// corridoi ne stanze laterali. Serve spazio vero per caricare e per schivare.
// Circa cinque volte la vecchia arena, e all'incirca lo spazio di un piano
// intero. Piu' grande di cosi' il guardiano passerebbe meta' dello scontro a
// camminare: la sua carica copre 7 caselle, e deve valere qualcosa.
const ARENA_W = 24;
const ARENA_H = 17;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

class Room {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  get cx() {
    return Math.floor(this.x + this.w / 2);
  }
  get cy() {
    return Math.floor(this.y + this.h / 2);
  }
  intersects(other, pad = 1) {
    return (
      this.x - pad < other.x + other.w &&
      this.x + this.w + pad > other.x &&
      this.y - pad < other.y + other.h &&
      this.y + this.h + pad > other.y
    );
  }
  randomPoint() {
    return { x: randInt(this.x, this.x + this.w - 1), y: randInt(this.y, this.y + this.h - 1) };
  }
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = TILES.FLOOR;
    }
  }
}

function carveCorridor(tiles, ax, ay, bx, by) {
  let x = ax;
  let y = ay;
  const horizontalFirst = Math.random() < 0.5;
  const stepX = () => {
    while (x !== bx) {
      x += Math.sign(bx - x);
      tiles[y][x] = TILES.FLOOR;
    }
  };
  const stepY = () => {
    while (y !== by) {
      y += Math.sign(by - y);
      tiles[y][x] = TILES.FLOOR;
    }
  };
  tiles[y][x] = TILES.FLOOR;
  if (horizontalFirst) {
    stepX();
    stepY();
  } else {
    stepY();
    stepX();
  }
}

function addWalls(tiles) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tiles[y][x] !== TILES.VOID) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
          if (tiles[ny][nx] === TILES.FLOOR || tiles[ny][nx] === TILES.STAIRS) {
            touchesFloor = true;
            break;
          }
        }
      }
      if (touchesFloor) tiles[y][x] = TILES.WALL;
    }
  }
}

/**
 * Sceglie una casella di muro sul perimetro della stanza da trasformare in scala,
 * così le scale appaiono come un varco nella parete. `dir` punta verso l'interno
 * della stanza e serve al disegno per orientare l'arcata.
 */
function placeStairsInWall(tiles, room) {
  const dentro = (x, y) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  const candidati = [];

  for (let y = room.y - 1; y <= room.y + room.h; y++) {
    for (let x = room.x - 1; x <= room.x + room.w; x++) {
      if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) continue;
      if (dentro(x, y)) continue; // solo l'anello di muro attorno
      if (tiles[y][x] !== TILES.WALL) continue; // mai sopra un varco già aperto

      // Deve affacciarsi direttamente su un pavimento della stanza, altrimenti
      // sarebbe un'arcata irraggiungibile.
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (dentro(x + dx, y + dy) && tiles[y + dy][x + dx] === TILES.FLOOR) {
          candidati.push({ x, y, dir: { x: dx, y: dy } });
          break;
        }
      }
    }
  }

  if (!candidati.length) return null;
  return candidati[randInt(0, candidati.length - 1)];
}

/** I piani col guardiano sono un'arena; tutti gli altri, un dungeon di stanze. */
export function generateDungeon(depth) {
  return bossForFloor(depth) ? buildArenaFloor() : buildDungeon(depth);
}

/**
 * Piano-arena: una sola sala, grande, con le scale in una parete e nient'altro.
 * Niente esplorazione, niente corridoi — solo tu e il guardiano.
 */
function buildArenaFloor() {
  const tiles = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(TILES.VOID));

  const w = Math.min(ARENA_W, MAP_W - 6);
  const h = Math.min(ARENA_H, MAP_H - 6);
  const x = Math.floor((MAP_W - w) / 2);
  const y = Math.floor((MAP_H - h) / 2);
  const arena = new Room(x, y, w, h);

  carveRoom(tiles, arena);
  addWalls(tiles);

  const stairs = placeStairsInWall(tiles, arena) || { x: arena.cx, y: arena.y - 1, dir: { x: 0, y: 1 } };
  tiles[stairs.y][stairs.x] = TILES.STAIRS;

  const partenza = {
    x: arena.cx + 0.5 - stairs.dir.x * (w * 0.34),
    y: arena.cy + 0.5 - stairs.dir.y * (h * 0.34),
  };
  const pilastri = aggiungiPilastri(tiles, arena, partenza, stairs);

  return {
    tiles,
    pilastri,
    rooms: [arena],
    stairs,
    stairsRoom: arena,
    arenaRoom: arena,
    // L'unica uscita e' la scala: e' quella a restare sigillata.
    arenaDoors: [{ x: stairs.x, y: stairs.y }],
    arenaOk: true,
    // Si comincia dal lato opposto alle scale, con il guardiano in mezzo.
    start: partenza,
  };
}

/**
 * Pilastri sparsi nell'arena: bastano un paio di caselle per togliersi dalla
 * linea di tiro. Sono disposti in modo simmetrico — un'arena vuole ordine, non
 * un ammasso casuale — e stanno lontani dal centro dove nasce il guardiano,
 * dal punto in cui arrivi e dalla soglia delle scale.
 */
function aggiungiPilastri(tiles, arena, partenza, stairs) {
  // Posizioni relative all'arena, con la misura del blocco.
  const schema = [
    [0.22, 0.26, 2],
    [0.78, 0.26, 2],
    [0.22, 0.74, 2],
    [0.78, 0.74, 2],
    [0.5, 0.16, 1],
    [0.5, 0.84, 1],
    [0.12, 0.5, 1],
    [0.88, 0.5, 1],
  ];

  const messi = [];
  const libero = (x, y, lato) => {
    for (let dy = 0; dy < lato; dy++) {
      for (let dx = 0; dx < lato; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        // deve restare dentro l'arena, con un margine dai muri per non creare angoli ciechi
        if (tx < arena.x + 2 || ty < arena.y + 2) return false;
        if (tx > arena.x + arena.w - 3 || ty > arena.y + arena.h - 3) return false;
        // lontano da dove nasce il guardiano
        if (Math.hypot(tx - arena.cx, ty - arena.cy) < 3.5) return false;
        // lontano da dove arrivi tu
        if (Math.hypot(tx - partenza.x, ty - partenza.y) < 3) return false;
        // e dalla soglia delle scale, che dev'essere sempre avvicinabile
        if (Math.hypot(tx - stairs.x, ty - stairs.y) < 3) return false;
      }
    }
    return true;
  };

  schema.forEach(([fx, fy, lato]) => {
    const x = Math.round(arena.x + fx * (arena.w - lato));
    const y = Math.round(arena.y + fy * (arena.h - lato));
    if (!libero(x, y, lato)) return;
    for (let dy = 0; dy < lato; dy++) {
      for (let dx = 0; dx < lato; dx++) tiles[y + dy][x + dx] = TILES.WALL;
    }
    messi.push({ x, y, lato });
  });

  return messi;
}

function buildDungeon(depth) {
  const tiles = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(TILES.VOID));
  const rooms = [];

  const attempts = 90;
  const maxRooms = Math.min(6 + Math.floor(depth / 2), 12);

  for (let i = 0; i < attempts && rooms.length < maxRooms; i++) {
    const w = randInt(5, 11);
    const h = randInt(4, 8);
    const x = randInt(2, MAP_W - w - 3);
    const y = randInt(2, MAP_H - h - 3);
    const room = new Room(x, y, w, h);
    if (rooms.some((r) => room.intersects(r, 2))) continue;
    rooms.push(room);
  }

  rooms.forEach((room) => carveRoom(tiles, room));

  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    carveCorridor(tiles, a.cx, a.cy, b.cx, b.cy);
  }

  // Un paio di collegamenti extra: rende il piano meno lineare, più da esplorare.
  const extraLinks = Math.min(2, Math.max(0, rooms.length - 2));
  for (let i = 0; i < extraLinks; i++) {
    const a = rooms[randInt(0, rooms.length - 1)];
    const b = rooms[randInt(0, rooms.length - 1)];
    if (a !== b) carveCorridor(tiles, a.cx, a.cy, b.cx, b.cy);
  }

  addWalls(tiles);

  const startRoom = rooms[0];
  const stairsRoom = rooms[rooms.length - 1];

  // Le scale sono un'arcata scavata nel muro, non una botola in mezzo alla stanza.
  const stairs = placeStairsInWall(tiles, stairsRoom) || {
    x: stairsRoom.cx,
    y: stairsRoom.cy,
    dir: { x: 0, y: 1 },
  };
  tiles[stairs.y][stairs.x] = TILES.STAIRS;

  return {
    tiles,
    rooms,
    stairs,
    stairsRoom,
    arenaRoom: null,
    arenaDoors: [],
    start: { x: startRoom.cx + 0.5, y: startRoom.cy + 0.5 },
  };
}

export function isBlocked(tiles, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  const t = tiles[ty][tx];
  // Il sigillo dell'arena blocca come un muro finche' il guardiano non cade.
  return t === TILES.VOID || t === TILES.WALL || t === TILES.SEALED;
}
