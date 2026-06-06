const COLS = 40;
const ROWS = 22;
const TILE = 48;
const TEAMS = ['p1', 'p2', 'p3', 'p4'];
const TEAM_NAMES = { p1: 'Blue', p2: 'Red', p3: 'Green', p4: 'Amber' };
const TEAM_DEFAULTS = {
  p1: { base: [37, 11], spawn: [0, 11] },
  p2: { base: [2, 11], spawn: [39, 11] },
  p3: { base: [20, 20], spawn: [20, 0] },
  p4: { base: [20, 1], spawn: [20, 21] },
};

const TOOLS = [
  { id: 'path', label: 'Road' },
  { id: 'water', label: 'Water' },
  { id: 'tree', label: 'Tree' },
  { id: 'bush', label: 'Bush' },
  { id: 'rock', label: 'Rock' },
  { id: 'hedgehog', label: 'Blocker' },
  { id: 'base', label: 'HQ' },
  { id: 'spawn', label: 'Spawn' },
  { id: 'erase', label: 'Erase' },
];

export const DESIGNER_CSS = `
  #wz-designer {
    position: fixed; inset: 0; z-index: 10000;
    display: grid; grid-template-columns: 260px minmax(720px, 1fr);
    background: #0e0f14; color: #e9e6da; font-family: monospace;
  }
  .wz-design-panel {
    padding: 18px; border-right: 1px solid #2a2e3e;
    background: #15161d; overflow-y: auto;
  }
  .wz-design-title { color: #ffcf3f; font: 700 23px/1 monospace; letter-spacing: 2px; margin-bottom: 16px; }
  .wz-design-field { display: grid; gap: 5px; margin-bottom: 12px; }
  .wz-design-field label { color: #8a90a0; font-size: 10px; letter-spacing: 1px; }
  .wz-design-field input,
  .wz-design-field select {
    width: 100%; padding: 9px 10px; border: 1px solid #33384a;
    background: #0e0f14; color: #e9e6da; font: 13px monospace; outline: none;
  }
  .wz-design-field input:focus,
  .wz-design-field select:focus { border-color: #ffcf3f; }
  .wz-tool-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 14px 0; }
  .wz-tool,
  .wz-design-action {
    min-height: 38px; border: 1px solid #33384a; background: #1c1f2a;
    color: #e9e6da; font: 700 11px monospace; cursor: pointer;
  }
  .wz-tool.active { border-color: #ffcf3f; color: #ffcf3f; background: #2b2818; }
  .wz-design-actions { display: grid; gap: 9px; margin-top: 14px; }
  .wz-design-action.save { border-color: #3d8c40; color: #3fd56a; background: #132414; }
  .wz-design-action.cancel { border-color: #733; color: #f4736d; background: #241313; }
  .wz-design-status { min-height: 34px; margin-top: 12px; color: #8a90a0; font-size: 12px; line-height: 1.35; }
  .wz-design-stage {
    overflow: auto; padding: 20px; display: grid; align-content: start;
    background:
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(0deg, rgba(255,255,255,.02) 1px, transparent 1px),
      #101217;
    background-size: 24px 24px;
  }
  .wz-design-grid {
    display: grid; grid-template-columns: repeat(40, 24px); grid-template-rows: repeat(22, 24px);
    width: 960px; height: 528px; border: 2px solid #33384a; background: #78a957;
    box-shadow: 0 20px 60px rgba(0,0,0,.38);
  }
  .wz-design-cell {
    width: 24px; height: 24px; padding: 0; border: 0; border-right: 1px solid rgba(0,0,0,.12);
    border-bottom: 1px solid rgba(0,0,0,.12); background: #78a957; color: #101217;
    font: 700 9px/1 monospace; cursor: crosshair;
  }
  .wz-design-cell.path { background: #b58355; }
  .wz-design-cell.water { background: #5db6e8; }
  .wz-design-cell.deco { background: #5c8e45; color: #111; }
  .wz-design-cell.base { background: #2e74d6; color: #fff; }
  .wz-design-cell.spawn { color: #fff; }
  .wz-design-cell.team-p1.spawn { background: #2e74d6; }
  .wz-design-cell.team-p2.spawn { background: #e8413a; }
  .wz-design-cell.team-p3.spawn { background: #25c065; color: #111; }
  .wz-design-cell.team-p4.spawn { background: #f5b21e; color: #111; }
  .wz-design-cell.team-p2.base { background: #e8413a; }
  .wz-design-cell.team-p3.base { background: #25c065; }
  .wz-design-cell.team-p4.base { background: #f5b21e; color: #111; }
  @media (max-width: 1000px) {
    #wz-designer { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    .wz-design-panel { border-right: 0; border-bottom: 1px solid #2a2e3e; }
  }
`;

export function openMapDesigner(net) {
  return new Promise(resolve => {
    const state = createState();
    const cells = new Map();
    let tool = 'path';
    let drawing = false;

    const el = document.createElement('div');
    el.id = 'wz-designer';
    el.innerHTML = `
      <aside class="wz-design-panel">
        <div class="wz-design-title">MAP DESIGNER</div>
        <div class="wz-design-field">
          <label for="wz-map-name">MAP NAME</label>
          <input id="wz-map-name" maxlength="40" value="Custom Front" />
        </div>
        <div class="wz-design-field">
          <label for="wz-map-mode">MODE</label>
          <select id="wz-map-mode">
            <option value="single">Solo</option>
            <option value="pvp">PvP</option>
          </select>
        </div>
        <div class="wz-design-field">
          <label for="wz-map-players">PLAYERS</label>
          <select id="wz-map-players">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
          </select>
        </div>
        <div class="wz-design-field">
          <label for="wz-map-team">TEAM</label>
          <select id="wz-map-team"></select>
        </div>
        <div class="wz-tool-grid">
          ${TOOLS.map(t => `<button class="wz-tool${t.id === tool ? ' active' : ''}" data-tool="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="wz-design-actions">
          <button class="wz-design-action save" id="wz-save-map">SAVE MAP</button>
          <button class="wz-design-action cancel" id="wz-cancel-designer">BACK TO LOBBY</button>
        </div>
        <div class="wz-design-status" id="wz-design-status">Paint roads and obstacles, then place one HQ and unit spawn per team.</div>
      </aside>
      <main class="wz-design-stage">
        <div class="wz-design-grid" id="wz-design-grid"></div>
      </main>
    `;
    document.body.appendChild(el);

    const grid = el.querySelector('#wz-design-grid');
    const nameEl = el.querySelector('#wz-map-name');
    const modeEl = el.querySelector('#wz-map-mode');
    const playersEl = el.querySelector('#wz-map-players');
    const teamEl = el.querySelector('#wz-map-team');
    const statusEl = el.querySelector('#wz-design-status');
    const saveBtn = el.querySelector('#wz-save-map');

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'wz-design-cell';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.addEventListener('pointerdown', event => {
          event.preventDefault();
          drawing = true;
          paint(state, tool, teamEl.value, x, y);
          updateAround(cells, state, x, y);
        });
        cell.addEventListener('pointerenter', () => {
          if (!drawing || tool === 'base' || tool === 'spawn') return;
          paint(state, tool, teamEl.value, x, y);
          updateAround(cells, state, x, y);
        });
        cells.set(pointKey(x, y), cell);
        grid.appendChild(cell);
      }
    }

    document.addEventListener('pointerup', stopDrawing);
    el.querySelectorAll('.wz-tool').forEach(button => {
      button.addEventListener('click', () => {
        tool = button.dataset.tool;
        el.querySelectorAll('.wz-tool').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
      });
    });
    modeEl.addEventListener('change', () => syncMode(state, modeEl, playersEl, teamEl, cells));
    playersEl.addEventListener('change', () => syncMode(state, modeEl, playersEl, teamEl, cells));
    el.querySelector('#wz-cancel-designer').addEventListener('click', () => {
      document.removeEventListener('pointerup', stopDrawing);
      el.remove();
      resolve(null);
    });
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        statusEl.style.color = '#ffcf3f';
        statusEl.textContent = 'Saving map...';
        const payload = serialize(state, nameEl.value, modeEl.value, Number(playersEl.value));
        const result = await net.saveMap(payload);
        document.removeEventListener('pointerup', stopDrawing);
        el.remove();
        resolve(result);
      } catch (error) {
        saveBtn.disabled = false;
        statusEl.style.color = '#e8413a';
        statusEl.textContent = error.message;
      }
    });

    syncMode(state, modeEl, playersEl, teamEl, cells);
    updateAll(cells, state);

    function stopDrawing() {
      drawing = false;
    }
  });
}

function createState() {
  const state = {
    path: new Set(),
    water: new Set(),
    deco: new Map(),
    bases: new Map(),
    spawns: new Map(),
  };

  for (let x = 0; x <= 37; x += 1) state.path.add(pointKey(x, 11));
  state.bases.set('p1', teamPoint('p1', ...TEAM_DEFAULTS.p1.base));
  state.spawns.set('p1', spawnPoint('p1', ...TEAM_DEFAULTS.p1.spawn));
  return state;
}

function syncMode(state, modeEl, playersEl, teamEl, cells) {
  if (modeEl.value === 'single') {
    playersEl.value = '1';
    playersEl.disabled = true;
  } else {
    playersEl.disabled = false;
    if (playersEl.value === '1') playersEl.value = '2';
  }

  const count = Number(playersEl.value);
  activeTeams(count).forEach(team => {
    const defaults = TEAM_DEFAULTS[team];
    if (!state.bases.has(team)) state.bases.set(team, teamPoint(team, ...defaults.base));
    if (!state.spawns.has(team)) state.spawns.set(team, spawnPoint(team, ...defaults.spawn));
  });

  TEAMS.slice(count).forEach(team => {
    state.bases.delete(team);
    state.spawns.delete(team);
  });

  teamEl.innerHTML = activeTeams(count)
    .map(team => `<option value="${team}">${TEAM_NAMES[team]}</option>`)
    .join('');
  updateAll(cells, state);
}

function paint(state, tool, team, x, y) {
  const key = pointKey(x, y);

  if (tool === 'erase') {
    eraseAt(state, x, y);
    return;
  }

  eraseAt(state, x, y);

  if (tool === 'path') state.path.add(key);
  else if (tool === 'water') state.water.add(key);
  else if (tool === 'base') state.bases.set(team, teamPoint(team, x, y));
  else if (tool === 'spawn') state.spawns.set(team, spawnPoint(team, x, y));
  else state.deco.set(key, tool);
}

function eraseAt(state, x, y) {
  const key = pointKey(x, y);
  state.path.delete(key);
  state.water.delete(key);
  state.deco.delete(key);

  for (const [team, point] of state.bases) {
    if (point.x === x && point.y === y) state.bases.delete(team);
  }

  for (const [team, point] of state.spawns) {
    if (point.x === x && point.y === y) state.spawns.delete(team);
  }
}

function updateAround(cells, state, x, y) {
  for (let yy = y - 1; yy <= y + 1; yy += 1) {
    for (let xx = x - 1; xx <= x + 1; xx += 1) {
      updateCell(cells, state, xx, yy);
    }
  }
}

function updateAll(cells, state) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) updateCell(cells, state, x, y);
  }
}

function updateCell(cells, state, x, y) {
  const cell = cells.get(pointKey(x, y));
  if (!cell) return;

  const key = pointKey(x, y);
  const base = [...state.bases.values()].find(point => point.x === x && point.y === y);
  const spawn = [...state.spawns.values()].find(point => point.x === x && point.y === y);
  const deco = state.deco.get(key);
  cell.className = 'wz-design-cell';
  cell.textContent = '';

  if (state.path.has(key)) cell.classList.add('path');
  if (state.water.has(key)) cell.classList.add('water');
  if (deco) {
    cell.classList.add('deco');
    cell.textContent = decoLabel(deco);
  }
  if (spawn) {
    cell.classList.add('spawn', `team-${spawn.team}`);
    cell.textContent = 'S';
  }
  if (base) {
    cell.classList.add('base', `team-${base.team}`);
    cell.textContent = 'HQ';
  }
}

function serialize(state, name, mode, players) {
  const teams = activeTeams(players);
  const baseEntries = teams.map(team => state.bases.get(team));
  const spawnEntries = teams.map(team => state.spawns.get(team));

  if (!name.trim()) throw new Error('Map name is required.');
  if (baseEntries.some(point => !point)) throw new Error('Place one HQ for every active team.');
  if (spawnEntries.some(point => !point)) throw new Error('Place one spawn for every active team.');

  const bases = baseEntries.map(point => ({ ...point }));
  const spawns = spawnEntries.map((point, lane) => serializeSpawn(point, lane, mode, teams));
  const pathTiles = buildPathTiles(state.path);
  const deco = [...state.deco.entries()].map(([key, value]) => ({ key: value, ...parseKey(key) }));
  const water = sortedPoints([...state.water].map(parseKey));
  const lanes = spawns.map(spawn => buildLane(spawn, state.bases.get(spawn.target), state.path));
  const blocked = uniquePoints([
    ...water,
    ...pathTiles.map(({ x, y }) => ({ x, y })),
    ...deco.map(({ x, y }) => ({ x, y })),
    ...bases.map(({ x, y }) => ({ x, y })),
    ...spawns.map(({ x, y }) => ({ x, y })),
  ]);

  return {
    name: name.trim(),
    mode,
    players,
    cols: COLS,
    rows: ROWS,
    tile: TILE,
    bases,
    spawns,
    water,
    deco,
    pathTiles,
    lanes,
    blocked,
  };
}

function buildPathTiles(path) {
  return sortedPoints([...path].map(parseKey)).map(point => ({
    ...point,
    key: pathKey(point.x, point.y, path),
  }));
}

function pathKey(x, y, path) {
  const n = path.has(pointKey(x, y - 1));
  const s = path.has(pointKey(x, y + 1));
  const e = path.has(pointKey(x + 1, y));
  const w = path.has(pointKey(x - 1, y));
  const count = [n, s, e, w].filter(Boolean).length;

  if (count >= 4) return 'cross';
  if (count === 3) {
    if (!n) return 't_down';
    if (!s) return 't_up';
    if (!e) return 't_left';
    return 't_right';
  }
  if (n && s) return 'v';
  if (e && w) return 'h';
  if (n && e) return 'ne';
  if (n && w) return 'nw';
  if (s && e) return 'se';
  if (s && w) return 'sw';
  if (n) return 'end_s';
  if (s) return 'end_n';
  if (e) return 'end_w';
  if (w) return 'end_e';
  return 'h';
}

function buildLane(spawn, base, path) {
  const start = pointKey(spawn.x, spawn.y);
  const goal = pointKey(base.x, base.y);
  const allowed = new Set(path);
  allowed.add(start);
  allowed.add(goal);
  const queue = [start];
  const cameFrom = new Map([[start, null]]);

  while (queue.length) {
    const current = queue.shift();
    if (current === goal) break;
    const { x, y } = parseKey(current);

    for (const next of [
      pointKey(x + 1, y),
      pointKey(x - 1, y),
      pointKey(x, y + 1),
      pointKey(x, y - 1),
    ]) {
      const point = parseKey(next);
      if (point.x < 0 || point.x >= COLS || point.y < 0 || point.y >= ROWS) continue;
      if (!allowed.has(next) || cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      queue.push(next);
    }
  }

  if (!cameFrom.has(goal)) return [spawn, base].map(({ x, y }) => ({ x, y }));

  const lane = [];
  let current = goal;

  while (current) {
    lane.push(parseKey(current));
    current = cameFrom.get(current);
  }

  return lane.reverse();
}

function activeTeams(players) {
  return TEAMS.slice(0, players);
}

function teamPoint(team, x, y) {
  return { team, x, y };
}

function spawnPoint(team, x, y) {
  return { x, y, team };
}

function serializeSpawn(point, lane, mode, teams) {
  const entry = { x: point.x, y: point.y, lane };

  if (mode === 'single') {
    entry.target = 'p1';
    return entry;
  }

  entry.team = point.team;
  entry.target = defaultAttackTarget(point.team, teams);
  return entry;
}

function defaultAttackTarget(team, teams) {
  const index = teams.indexOf(team);

  if (index < 0 || teams.length < 2) {
    return team;
  }

  return teams[(index + 1) % teams.length];
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function parseKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

function sortedPoints(points) {
  return points.sort((a, b) => a.y - b.y || a.x - b.x);
}

function uniquePoints(points) {
  const seen = new Set();
  return sortedPoints(points.filter(point => {
    const key = pointKey(point.x, point.y);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function decoLabel(key) {
  return {
    tree: 'T',
    bush: 'B',
    rock: 'R',
    hedgehog: 'X',
  }[key] ?? '*';
}
