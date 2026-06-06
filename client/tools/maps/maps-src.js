/* =====================================================================
   WARZONE — MAP AUTHORING  (pure JS, no canvas)
   1920x1056 maps on a 48px grid (40 cols x 22 rows). PvP maps are
   TRANSFORM-GENERATED from an authored region so
   they are provably symmetric/fair.

   globalThis.WZMAPS.build(id) -> resolved map data object.
   ===================================================================== */
(function () {
  const COLS = 40, ROWS = 22, TILE = 48, W = COLS * TILE, H = ROWS * TILE;
  const key = (x, y) => x + ',' + y;
  const inBoard = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

  // symmetry transforms
  const mX  = p => ({ x: COLS - 1 - p.x, y: p.y });
  const mY  = p => ({ x: p.x, y: ROWS - 1 - p.y });
  const mXY = p => ({ x: COLS - 1 - p.x, y: ROWS - 1 - p.y });

  /* ---- authored map specs ---------------------------------------- */
  const SPECS = {
    /* ---------- SINGLE PLAYER 1: Bocage Run ---------- */
    bocage_run: {
      name: 'Bocage Run', mode: 'single', symmetry: 'none',
      bases: [{ team: 'p1', x: 37, y: 11 }],
      lanes: [[[-1,11],[5,11],[5,4],[13,4],[13,17],[21,17],[21,7],[29,7],[29,14],[35,14],[35,11],[37,11]]],
      water: rect(24,1,3,2),                    // small pond, top
      deco: [
        ['tree',1,1],['tree',2,2],['tree',1,3],['tree',3,1],['tree',8,1],['tree',9,2],
        ['tree',33,2],['tree',35,1],['tree',2,19],['tree',4,20],['tree',36,19],['tree',38,18],
        ['rock',17,2],['rock',25,20],['rock',31,18],['rock',9,12],
        ['bush',16,9],['bush',26,12],['bush',7,18],['bush',33,8],
        ['hedgehog',6,8],['hedgehog',12,9],['hedgehog',20,12],['hedgehog',30,11],['hedgehog',34,8],
        ['barbedwire',14,16],['barbedwire',15,16],['barbedwire',28,8],
        ['crater',34,10],['crater',11,5],['barrel',32,12],['crate',31,12],
      ],
    },

    /* ---------- SINGLE PLAYER 2: River Crossing ---------- */
    river_crossing: {
      name: 'River Crossing', mode: 'single', symmetry: 'none',
      bases: [{ team: 'p1', x: 36, y: 11 }],
      lanes: [[[-1,11],[6,11],[6,6],[14,6],[14,11],[25,11],[25,16],[31,16],[31,11],[36,11]]],
      // vertical river at x=18,19 — main bridge at y=10/11 plus a risky north ford
      water: riverBand(18, 19, [5, 6, 10, 11]),
      deco: [
        ['tree',2,2],['tree',3,3],['tree',2,18],['tree',4,19],['tree',9,2],['tree',9,19],
        ['tree',23,2],['tree',23,19],['tree',33,2],['tree',34,3],['tree',38,11],['tree',20,3],['tree',16,18],
        ['rock',8,9],['rock',27,7],['rock',12,18],['bush',10,13],['bush',28,13],
        ['hedgehog',16,11],['hedgehog',21,11],['hedgehog',16,5],['hedgehog',21,6],
        ['sandbag',34,9],['sandbag',34,13],['sandbag',38,9],['sandbag',30,15],
        ['barbedwire',16,10],['barbedwire',21,10],['barbedwire',16,6],['barbedwire',21,5],
        ['crater',26,11],['crate',33,11],['barrel',38,13],['crate',13,8],['barrel',24,14],
      ],
    },

    /* ---------- PVP 1: Twin Fronts (2p, mirror-X) ---------- */
    twin_fronts: {
      name: 'Twin Fronts', mode: 'pvp', players: 2, symmetry: 'x',
      // authored LEFT half only — mirrored to the right
      bases: [{ team: 'p1', x: 2, y: 10 }],
      teamsByMirror: { base: 'p2' },            // mirror-X copy belongs to p2
      lanes: [[[20,10],[20,3],[10,3],[10,17],[4,17],[4,10],[2,10]]],
      water: rect(17,9,2,4),                    // half of a central lake (mirror completes it)
      deco: [
        ['tree',1,1],['tree',2,2],['tree',7,8],['tree',8,18],['tree',12,1],['tree',6,13],
        ['rock',5,5],['rock',11,12],['rock',9,20],['rock',16,7],
        ['bush',14,9],['bush',3,16],
        ['hedgehog',10,10],['hedgehog',4,13],['hedgehog',16,3],
        ['barbedwire',10,8],['barbedwire',9,8],
        ['crater',3,9],['crater',13,16],['barrel',6,10],['crate',6,11],
      ],
    },

    /* ---------- PVP 2: Crossroads (2p, mirror-X) ---------- */
    crossroads: {
      name: 'Crossroads', mode: 'pvp', players: 2, symmetry: 'x',
      bases: [{ team: 'p1', x: 2, y: 10 }],
      teamsByMirror: { base: 'p2' },
      lanes: [[[20,10],[20,5],[14,5],[14,10],[8,10],[8,15],[3,15],[3,10],[2,10]]],
      water: rect(17,8,2,2).concat(rect(17,13,2,1)),
      deco: [
        ['sandbag',18,10],['sandbag',18,11],['crate',16,10],['barrel',15,11],
        ['tree',1,1],['tree',2,2],['tree',5,5],['tree',11,2],['tree',6,18],['tree',14,19],
        ['rock',4,8],['rock',12,13],['rock',16,16],
        ['bush',6,7],['bush',10,12],['bush',13,8],['bush',2,17],
        ['hedgehog',7,10],['hedgehog',8,9],['hedgehog',13,5],['hedgehog',14,6],
        ['barbedwire',5,14],['barbedwire',6,14],['crater',10,10],['crater',15,4],
      ],
    },

    /* ---------- PVP 2: Four Corners (4p, mirror-XY) ---------- */
    four_corners: {
      name: 'Four Corners', mode: 'pvp', players: 4, symmetry: 'xy',
      // authored TOP-LEFT quadrant only — mirrored into 4
      bases: [{ team: 'p1', x: 3, y: 3 }],
      teamsByMirror: { x: 'p2', y: 'p3', xy: 'p4' },
      lanes: [[[19,10],[17,10],[17,15],[9,15],[9,5],[5,5],[5,3],[3,3]]],
      water: rect(17,8,2,3),                    // one quadrant of central lake
      deco: [
        ['tree',1,1],['tree',8,8],['tree',2,6],['tree',10,2],['tree',1,9],['tree',13,13],
        ['rock',6,6],['rock',9,10],['rock',14,5],['rock',15,16],
        ['bush',4,8],['bush',11,6],['bush',13,11],
        ['hedgehog',12,7],['hedgehog',7,4],['hedgehog',16,12],['hedgehog',10,14],
        ['barbedwire',8,4],['barbedwire',14,14],['crater',5,9],['crate',2,3],['barrel',16,9],
      ],
    },

    /* ---------- SINGLE PLAYER 3: Hedgerow Maze ---------- */
    hedgerow_maze: {
      name: 'Hedgerow Maze', mode: 'single', symmetry: 'none',
      bases: [{ team: 'p1', x: 38, y: 11 }],
      lanes: [[[-1,11],[4,11],[4,3],[11,3],[11,18],[18,18],[18,5],[25,5],[25,16],[32,16],[32,11],[38,11]]],
      water: rect(20,9,2,4).concat(rect(31,3,3,2)),
      deco: [
        ['tree',1,1],['tree',2,2],['tree',5,1],['tree',8,20],['tree',12,1],['tree',13,20],
        ['tree',22,2],['tree',26,20],['tree',34,18],['tree',36,4],['tree',39,16],
        ['bush',2,6],['bush',6,15],['bush',10,8],['bush',16,16],['bush',23,8],['bush',29,13],['bush',35,8],
        ['hedgehog',3,4],['hedgehog',3,5],['hedgehog',3,6],['hedgehog',3,7],['hedgehog',3,8],
        ['hedgehog',7,13],['hedgehog',8,13],['hedgehog',9,13],['hedgehog',10,13],
        ['hedgehog',14,4],['hedgehog',15,4],['hedgehog',16,4],['hedgehog',17,4],
        ['hedgehog',15,10],['hedgehog',15,11],['hedgehog',15,12],['hedgehog',15,13],
        ['hedgehog',22,15],['hedgehog',23,15],['hedgehog',24,15],
        ['hedgehog',28,6],['hedgehog',28,7],['hedgehog',28,8],['hedgehog',28,9],
        ['hedgehog',33,12],['hedgehog',34,12],['hedgehog',35,12],
        ['barbedwire',6,6],['barbedwire',7,6],['barbedwire',20,17],['barbedwire',21,17],['barbedwire',30,10],
        ['rock',6,3],['rock',13,7],['rock',19,13],['rock',30,18],['rock',35,2],
        ['crater',9,17],['crater',23,5],['crate',36,10],['barrel',37,13],
      ],
    },
  };

  /* ---- spec helpers --------------------------------------------- */
  function rect(x, y, w, h) { const a = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a.push([x + i, y + j]); return a; }
  function riverBand(x1, x2, gapYs) {
    const a = []; const gap = new Set(gapYs);
    for (let y = 0; y < ROWS; y++) { if (gap.has(y)) continue; a.push([x1, y]); a.push([x2, y]); }
    return a;
  }

  /* ---- build ----------------------------------------------------- */
  function expandLane(wp) {
    // wp: array of [x,y] axis-aligned waypoints; returns ordered in-board cells
    const cells = [];
    for (let i = 0; i < wp.length - 1; i++) {
      let [x, y] = wp[i]; const [bx, by] = wp[i + 1];
      const dx = Math.sign(bx - x), dy = Math.sign(by - y);
      while (x !== bx || y !== by) { if (inBoard(x, y)) cells.push({ x, y }); x += dx; y += dy; }
    }
    const last = wp[wp.length - 1]; if (inBoard(last[0], last[1])) cells.push({ x: last[0], y: last[1] });
    // dedupe consecutive
    const out = []; const seen = new Set();
    for (const c of cells) { const k = key(c.x, c.y); if (!seen.has(k)) { seen.add(k); out.push(c); } }
    return out;
  }

  function maskKey(set, x, y) {
    const n = set.has(key(x, y - 1)), s = set.has(key(x, y + 1)),
          e = set.has(key(x + 1, y)), w = set.has(key(x - 1, y));
    const cnt = n + s + e + w;
    if (cnt >= 4) return 'cross';
    if (cnt === 3) return n && e && w ? 't_up' : s && e && w ? 't_down' : n && s && w ? 't_left' : 't_right';
    if (cnt === 2) {
      if (e && w) return 'h'; if (n && s) return 'v';
      if (n && e) return 'ne'; if (n && w) return 'nw'; if (s && e) return 'se'; return 'sw';
    }
    if (cnt === 1) { if (n) return 'end_s'; if (s) return 'end_n'; if (e) return 'end_w'; return 'end_e'; }
    return 'h';
  }

  function applySym(spec) {
    // returns { bases, lanes, water, deco } after symmetry expansion
    const sym = spec.symmetry;
    const out = { bases: [], lanes: [], water: [], deco: [] };

    const pushBase = (b, t) => out.bases.push({ team: t, x: b.x, y: b.y });
    const pushLane = wp => out.lanes.push(wp.map(p => [p.x, p.y]));
    const pushWater = c => out.water.push([c.x, c.y]);
    const pushDeco = (d, p) => out.deco.push([d[0], p.x, p.y]);

    spec.bases.forEach(b => {
      pushBase(b, b.team);
      if (sym === 'x') pushBase(mX(b), spec.teamsByMirror.base);
      if (sym === 'xy') { pushBase(mX(b), spec.teamsByMirror.x); pushBase(mY(b), spec.teamsByMirror.y); pushBase(mXY(b), spec.teamsByMirror.xy); }
    });
    spec.lanes.forEach(wp => {
      const P = wp.map(([x, y]) => ({ x, y }));
      pushLane(P);
      if (sym === 'x') pushLane(P.map(mX));
      if (sym === 'xy') { pushLane(P.map(mX)); pushLane(P.map(mY)); pushLane(P.map(mXY)); }
    });
    (spec.water || []).forEach(([x, y]) => {
      const p = { x, y }; pushWater(p);
      if (sym === 'x') pushWater(mX(p));
      if (sym === 'xy') { pushWater(mX(p)); pushWater(mY(p)); pushWater(mXY(p)); }
    });
    (spec.deco || []).forEach(d => {
      const p = { x: d[1], y: d[2] }; pushDeco(d, p);
      if (sym === 'x') pushDeco(d, mX(p));
      if (sym === 'xy') { pushDeco(d, mX(p)); pushDeco(d, mY(p)); pushDeco(d, mXY(p)); }
    });
    return out;
  }

  function build(id) {
    const spec = SPECS[id];
    if (!spec) throw new Error('no map ' + id);
    const ex = applySym(spec);

    // lanes -> cells + path set
    const laneCellSets = ex.lanes.map(expandLane);
    const laneSet = new Set();
    laneCellSets.forEach(cells => cells.forEach(c => laneSet.add(key(c.x, c.y))));

    const pathTiles = [];
    laneSet.forEach(k => { const [x, y] = k.split(',').map(Number); pathTiles.push({ x, y, key: maskKey(laneSet, x, y) }); });

    const waterSet = new Set(ex.water.map(([x, y]) => key(x, y)));

    // base footprints (2x2 around centre) are blocked + no-build
    const baseBlocked = new Set();
    ex.bases.forEach(b => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) baseBlocked.add(key(b.x + dx, b.y + dy)); });

    // deco: drop any that fall on lane / water / base
    const deco = ex.deco.filter(([, x, y]) => !laneSet.has(key(x, y)) && !waterSet.has(key(x, y)) && !baseBlocked.has(key(x, y)))
                        .map(([k, x, y]) => ({ key: k, x, y }));
    const decoSet = new Set(deco.map(d => key(d.x, d.y)));

    // spawns = first in-board cell of each lane, tagged with the base it heads toward
    const spawns = laneCellSets.map((cells, i) => {
      const first = cells[0], lastCell = cells[cells.length - 1];
      const target = nearestBase(ex.bases, lastCell);
      return { x: first.x, y: first.y, lane: i, target: target ? target.team : null };
    });

    // blocked / buildable
    const blocked = new Set([...laneSet, ...waterSet, ...baseBlocked, ...decoSet]);
    const buildable = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!blocked.has(key(x, y))) buildable.push([x, y]);

    return {
      id, name: spec.name, mode: spec.mode, players: spec.players || 1,
      symmetry: spec.symmetry, tile: TILE, cols: COLS, rows: ROWS, width: W, height: H,
      groundFill: 'grass',
      bases: ex.bases,
      spawns,
      lanes: ex.lanes.map(wp => wp.map(([x, y]) => ({ x, y }))),
      pathTiles,
      water: [...waterSet].map(k => k.split(',').map(Number)).map(([x, y]) => ({ x, y })),
      deco,
      blocked: [...blocked].map(k => k.split(',').map(Number)).map(([x, y]) => ({ x, y })),
      buildableCount: buildable.length,
    };
  }
  function nearestBase(bases, cell) {
    let best = null, bd = 1e9;
    bases.forEach(b => { const d = Math.abs(b.x - cell.x) + Math.abs(b.y - cell.y); if (d < bd) { bd = d; best = b; } });
    return best;
  }

  globalThis.WZMAPS = { build, list: Object.keys(SPECS), SPECS, COLS, ROWS, TILE, W, H };
})();
