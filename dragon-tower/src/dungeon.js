import { MAP_W, MAP_H, TILES, bossForFloor } from './config.js';

// Un boss ha bisogno di spazio per caricare e il giocatore di spazio per schivare:
// sotto queste misure lo scontro diventa una rissa in un corridoio.
const ARENA_MIN_W = 9;
const ARENA_MIN_H = 7;

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

/**
 * Sui piani con un guardiano il dungeon viene rigenerato finché non produce una
 * stanza abbastanza ampia da farci stare uno scontro vero.
 */
export function generateDungeon(depth) {
  const serveArena = !!bossForFloor(depth);
  if (!serveArena) return buildDungeon(depth, false);

  for (let tentativo = 0; tentativo < 60; tentativo++) {
    const d = buildDungeon(depth, true);
    if (d.arenaOk) return d;
  }
  // Ripiego: meglio un'arena stretta che nessun piano.
  return buildDungeon(depth, true);
}

function buildDungeon(depth, serveArena) {
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
  const candidate = rooms.slice(1);

  // Con un boss le scale vanno nella stanza più grande, che diventa l'arena;
  // sugli altri piani resta l'ultima stanza generata, per varietà.
  let stairsRoom = rooms[rooms.length - 1];
  if (serveArena) {
    // Fra le stanze che rispettano le misure minime prendo la più ampia; se
    // nessuna le rispetta ripiego sulla più grande e segnalo il tentativo fallito.
    const bigger = (a, b) => (b.w * b.h > a.w * a.h ? b : a);
    const adatte = candidate.filter((r) => r.w >= ARENA_MIN_W && r.h >= ARENA_MIN_H);
    stairsRoom = adatte.length ? adatte.reduce(bigger) : candidate.reduce(bigger, candidate[0]);
  }

  const arenaOk = !serveArena || (stairsRoom.w >= ARENA_MIN_W && stairsRoom.h >= ARENA_MIN_H);

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
    arenaOk,
    start: { x: startRoom.cx + 0.5, y: startRoom.cy + 0.5 },
  };
}

export function isBlocked(tiles, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  const t = tiles[ty][tx];
  return t === TILES.VOID || t === TILES.WALL;
}
