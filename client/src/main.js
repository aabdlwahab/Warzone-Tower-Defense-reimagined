/* Warzone — lobby (map select → name → join) then Phaser bootstrap. */
import Phaser from 'phaser';
import Boot from './scenes/Boot.js';
import Game from './scenes/Game.js';
import Hud from './scenes/Hud.js';
import { HUD_BAR_HEIGHT, TOP_BAR_HEIGHT } from './config.js';
import { DESIGNER_CSS, openMapDesigner } from './designer.js';
import { Net } from './net.js';

const BASE = window.ASSET_BASE || '';

/* ---- Lobby --------------------------------------------------------------- */

const LOBBY_CSS = `
  * { box-sizing: border-box; }
  #wz-lobby {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #0e0f14; z-index: 9999; overflow-y: auto; padding: 24px 12px;
  }
  .wz-title { font: 700 44px/1 monospace; color: #ffcf3f; letter-spacing: 5px; }
  .wz-sub   { font: 12px monospace; color: #555; letter-spacing: 3px; margin: 6px 0 28px; }
  .wz-label { font: 11px monospace; color: #8a90a0; letter-spacing: 1px;
               margin-bottom: 6px; display: block; }
  .wz-maps  {
    display: grid; grid-template-columns: repeat(2, 220px); gap: 12px;
    margin-bottom: 24px;
  }
  .wz-map-card {
    border: 2px solid #2a2e3e; background: #15161d; cursor: pointer;
    display: flex; flex-direction: column; transition: border-color .12s;
  }
  .wz-map-card:hover  { border-color: #4a5060; }
  .wz-map-card.active { border-color: #ffcf3f; }
  .wz-map-preview {
    width: 100%; aspect-ratio: 40/22; display: block;
    background: #202617;
  }
  .wz-map-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
  .wz-map-name { font: 700 13px monospace; color: #e9e6da; }
  .wz-badge    { font: 10px monospace; letter-spacing: 1px; padding: 2px 6px;
                 display: inline-block; width: fit-content; }
  .badge-sp  { background: #1a2e1a; color: #3fd56a; }
  .badge-pvp { background: #2a1a1a; color: #e8413a; }
  .wz-row {
    display: flex; gap: 10px; margin-bottom: 10px; width: 452px;
  }
  .wz-input {
    flex: 1; padding: 10px 12px; background: #1c1f2a;
    border: 2px solid #2a2e3e; color: #e9e6da; font: 15px monospace; outline: none;
  }
  .wz-input:focus { border-color: #ffcf3f; }
  #wz-join {
    width: 452px; padding: 13px;
    background: #1a2a1a; border: 2px solid #3d8c40;
    color: #3fd56a; font: 700 14px monospace; cursor: pointer; letter-spacing: 1px;
  }
  #wz-join:hover    { background: #213021; }
  #wz-join:disabled { opacity: .45; cursor: not-allowed; }
  #wz-design {
    width: 452px; padding: 11px; margin-top: 10px;
    background: #1c1f2a; border: 2px solid #4a5060;
    color: #e9e6da; font: 700 12px monospace; cursor: pointer; letter-spacing: 1px;
  }
  #wz-design:hover { border-color: #ffcf3f; color: #ffcf3f; }
  #wz-msg { margin-top: 10px; min-height: 18px; font: 13px monospace; text-align: center; }
`;

const ROOM_COPY_CSS = `
  #wz-room-copy {
    position: fixed; top: 46px; right: 8px; z-index: 10000;
    display: flex; align-items: center; gap: 6px; height: 26px;
    padding: 0 6px; background: rgba(16,18,24,.94);
    border: 1px solid #33384a; color: #8a90a0;
    font: 700 10px monospace; letter-spacing: .5px;
  }
  #wz-room-copy:hover { border-color: #ffcf3f; color: #ffcf3f; }
  #wz-room-copy input {
    width: 58px; border: 0; outline: none; padding: 0;
    background: transparent; color: #ffcf3f;
    font: 700 11px monospace; text-align: center; letter-spacing: .5px;
  }
  #wz-room-copy button {
    height: 18px; border: 1px solid #4a5060; background: #1c1f2a;
    color: #e9e6da; font: 700 9px monospace; cursor: pointer;
  }
  #wz-room-copy button:hover { border-color: #ffcf3f; color: #ffcf3f; }
  #wz-room-copy.copied button { border-color: #3fd56a; color: #3fd56a; }
  #wz-room-copy.selected button { border-color: #ffcf3f; color: #ffcf3f; }
`;

function renderMapCards(grid, maps, selectedId = '', net = null) {
  if (!grid) return;
  grid.replaceChildren();

  maps.forEach((m, i) => {
    const modeLabel = m.mode === 'single'
      ? `<span class="wz-badge badge-sp">SOLO</span>`
      : `<span class="wz-badge badge-pvp">${m.players}-PLAYER PVP</span>`;

    const card = document.createElement('div');
    card.className = 'wz-map-card' + ((selectedId ? m.id === selectedId : i === 0) ? ' active' : '');
    card.dataset.mapId = m.id;
    card.innerHTML = `
      <canvas class="wz-map-preview" width="440" height="242" aria-label="${escapeHtml(m.name)} preview"></canvas>
      <div class="wz-map-info">
        <span class="wz-map-name">${escapeHtml(m.name)}</span>
        ${modeLabel}
      </div>`;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.wz-map-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
    grid.appendChild(card);
    renderMapPreview(card.querySelector('canvas'), m, net);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

async function loadMapPreviewData(mapId, net) {
  if (net) {
    try {
      return await net.getMap(mapId);
    } catch {}
  }

  const response = await fetch(BASE + `maps/${mapId}.json`);
  if (!response.ok) throw new Error(`Map preview returned ${response.status}`);
  return response.json();
}

function renderMapPreview(canvas, mapInfo, net) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  drawMapPreview(ctx, canvas, {
    ...mapInfo,
    water: [],
    pathTiles: [],
    bases: [],
    spawns: [],
    deco: [],
  });

  loadMapPreviewData(mapInfo.id, net)
    .then(mapData => drawMapPreview(ctx, canvas, mapData))
    .catch(() => drawMapPreview(ctx, canvas, mapInfo));
}

function drawMapPreview(ctx, canvas, mapData) {
  const cols = Math.max(1, Number(mapData.cols ?? 40));
  const rows = Math.max(1, Number(mapData.rows ?? 22));
  const width = canvas.width;
  const height = canvas.height;
  const scale = Math.min(width / cols, height / rows);
  const tile = Math.max(1, scale);
  const offsetX = (width - cols * tile) / 2;
  const offsetY = (height - rows * tile) / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#11150f';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = ((x * 5 + y * 3) % 7 === 0) ? '#506a35' : '#40582d';
      ctx.fillRect(offsetX + x * tile, offsetY + y * tile, tile + 0.25, tile + 0.25);
    }
  }

  fillTiles(ctx, mapData.water, offsetX, offsetY, tile, '#315d72');
  fillTiles(ctx, mapData.pathTiles, offsetX, offsetY, tile, '#9b7a49');
  fillTiles(ctx, mapData.blocked?.filter(p => !(mapData.pathTiles ?? []).some(t => t.x === p.x && t.y === p.y)), offsetX, offsetY, tile, 'rgba(32, 35, 27, 0.28)');

  for (const lane of mapData.lanes ?? []) {
    if (!lane.length) continue;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 205, 111, 0.75)';
    ctx.lineWidth = Math.max(2, tile * 0.32);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    lane.forEach((point, index) => {
      const x = offsetX + (point.x + 0.5) * tile;
      const y = offsetY + (point.y + 0.5) * tile;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  for (const deco of mapData.deco ?? []) {
    const x = offsetX + (deco.x + 0.5) * tile;
    const y = offsetY + (deco.y + 0.5) * tile;
    ctx.fillStyle = deco.key === 'tree' || deco.key === 'bush' ? '#263f20' : '#4c4a3e';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, tile * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const spawn of mapData.spawns ?? []) {
    drawMarker(ctx, offsetX, offsetY, tile, spawn.x, spawn.y, '#f0d469', 'spawn');
  }

  const teamColors = {
    p1: '#4b8cff',
    p2: '#e84d4d',
    p3: '#49d17d',
    p4: '#c678dd',
  };
  for (const base of mapData.bases ?? []) {
    drawMarker(ctx, offsetX, offsetY, tile, base.x, base.y, teamColors[base.team] ?? '#e9e6da', 'base');
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, cols * tile - 1, rows * tile - 1);
}

function fillTiles(ctx, tiles = [], offsetX, offsetY, tile, color) {
  ctx.fillStyle = color;
  for (const point of tiles ?? []) {
    ctx.fillRect(offsetX + point.x * tile, offsetY + point.y * tile, tile + 0.25, tile + 0.25);
  }
}

function drawMarker(ctx, offsetX, offsetY, tile, gx, gy, color, type) {
  const x = offsetX + (gx + 0.5) * tile;
  const y = offsetY + (gy + 0.5) * tile;
  const r = Math.max(3, tile * (type === 'base' ? 0.55 : 0.38));

  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.arc(x + 1, y + 1, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8f1cf';
  ctx.lineWidth = Math.max(1, tile * 0.08);
  ctx.stroke();
}

function buildLobby(maps, net) {
  const styleEl = document.createElement('style');
  styleEl.textContent = LOBBY_CSS + DESIGNER_CSS;
  document.head.appendChild(styleEl);

  const el = document.createElement('div');
  el.id = 'wz-lobby';

  // Title
  el.insertAdjacentHTML('beforeend', `
    <div class="wz-title">WARZONE</div>
    <div class="wz-sub">TOWER DEFENSE</div>
  `);

  // Map grid (only shown when creating a new room)
  let grid = null;
  if (maps.length) {
    el.insertAdjacentHTML('beforeend', '<label class="wz-label" style="margin-bottom:8px">SELECT MAP</label>');
    grid = document.createElement('div');
    grid.className = 'wz-maps';
    renderMapCards(grid, maps, '', net);
    el.appendChild(grid);
  }

  // Name + room ID inputs
  el.insertAdjacentHTML('beforeend', `
    <label class="wz-label">YOUR NAME</label>
    <div class="wz-row">
      <input id="wz-name" class="wz-input" maxlength="24" placeholder="Player" value="Player" />
      <input id="wz-room" class="wz-input" maxlength="8"
             placeholder="Room ID (join existing)" style="text-transform:uppercase; flex:0 0 190px" />
    </div>
    <button id="wz-join">CREATE / JOIN ROOM</button>
    <button id="wz-design">MAP DESIGNER</button>
    <div id="wz-msg"></div>
  `);

  document.body.appendChild(el);
  return { el, grid, styleEl };
}

function installRoomCodeCopy(roomId) {
  document.getElementById('wz-room-copy')?.remove();
  document.getElementById('wz-room-copy-style')?.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'wz-room-copy-style';
  styleEl.textContent = ROOM_COPY_CSS;

  const el = document.createElement('div');
  el.id = 'wz-room-copy';
  const label = document.createElement('span');
  label.textContent = 'ROOM';
  const input = document.createElement('input');
  input.value = roomId;
  input.readOnly = true;
  input.setAttribute('aria-label', 'Room code');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'COPY';
  el.append(label, input, button);
  const reset = () => {
    el.classList.remove('copied', 'selected');
    button.textContent = 'COPY';
  };
  const selectCode = () => {
    input.focus();
    input.select();
  };

  input.addEventListener('click', selectCode);
  button.addEventListener('click', async () => {
    reset();
    selectCode();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(roomId);
        el.classList.add('copied');
        button.textContent = 'COPIED';
        window.setTimeout(reset, 1400);
        return;
      }
    } catch {}

    try {
      if (document.execCommand('copy')) {
        el.classList.add('copied');
        button.textContent = 'COPIED';
        window.setTimeout(reset, 1400);
        return;
      }
    } catch {}

    el.classList.add('selected');
    button.textContent = 'SELECTED';
    window.setTimeout(reset, 1800);
  });

  document.head.appendChild(styleEl);
  document.body.appendChild(el);
}

async function runLobby() {
  const net  = new Net();
  const maps = await net.listMaps().catch(() => []);
  const { el, grid, styleEl } = buildLobby(maps, net);

  const joinBtn = document.getElementById('wz-join');
  const designBtn = document.getElementById('wz-design');
  const msgEl   = document.getElementById('wz-msg');

  return new Promise(resolve => {
    designBtn.addEventListener('click', async () => {
      const result = await openMapDesigner(net);
      if (!result?.map) return;

      const refreshed = await net.listMaps().catch(() => []);
      renderMapCards(grid, refreshed, result.map.id, net);
      msgEl.style.color = '#3fd56a';
      msgEl.textContent = `${result.map.name} saved and selected.`;
    });

    joinBtn.addEventListener('click', async () => {
      const name      = document.getElementById('wz-name').value.trim() || 'Player';
      const roomInput = document.getElementById('wz-room').value.trim().toUpperCase();
      const mapId     = grid?.querySelector('.wz-map-card.active')?.dataset.mapId ?? '';

      joinBtn.disabled    = true;
      msgEl.style.color   = '#ffcf3f';
      msgEl.textContent   = 'Connecting…';

      try {
        const roomId = roomInput || await net.createRoom(mapId);
        await net.connect(roomId);
        net.join(name);

        await new Promise((ok, fail) => {
          const t = setTimeout(() => fail(new Error('Server did not respond')), 6000);
          net.on(m => {
            if (m.type === 'joined') {
              clearTimeout(t);
              localStorage.setItem('wz_token', m.token);
              localStorage.setItem('wz_room',  roomId);
              el.remove();
              styleEl.remove();
              ok({ net, roomId, playerId: m.player_id, token: m.token, snapshot: m.payload });
            } else if (m.type === 'error') {
              clearTimeout(t);
              fail(new Error(m.message));
            }
          });
        }).then(resolve);

      } catch (e) {
        msgEl.style.color = '#e8413a';
        msgEl.textContent = e.message;
        joinBtn.disabled  = false;
      }
    });
  });
}

/* ---- Bootstrap ----------------------------------------------------------- */
const { net, roomId, playerId, token, snapshot } = await runLobby();
const [manifest, mapMeta] = await Promise.all([
  fetch(BASE + 'assets/manifest.json').then(r => r.json()),
  net.getMap(snapshot.map.id).catch(() => fetch(BASE + `maps/${snapshot.map.id}.json`).then(r => r.json()).catch(() => null)),
]);

const T = snapshot.map.tile;
const mapW = mapMeta?.width ?? snapshot.map.cols * T;
const mapH = mapMeta?.height ?? snapshot.map.rows * T;
const hudH = HUD_BAR_HEIGHT;
const topH = TOP_BAR_HEIGHT;
const W = window.innerWidth || mapW;
const H = window.innerHeight || mapH + hudH;
const playH = Math.max(360, H - hudH);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#2e3d22',
  pixelArt: false,
  roundPixels: true,
  render: { preserveDrawingBuffer: true },
  scale: { mode: Phaser.Scale.NONE },
  scene: [Boot, Game, Hud],
});

game.registry.set('manifest',  manifest);
game.registry.set('assetBase', BASE);
game.registry.set('net',       net);
game.registry.set('roomId',    roomId);
game.registry.set('playerId',  playerId);
game.registry.set('token',     token);
game.registry.set('snapshot',  snapshot);
game.registry.set('mapData',   mapMeta);
game.registry.set('mapPixelWidth', mapW);
game.registry.set('mapPixelHeight', mapH);
game.registry.set('hudHeight', hudH);
game.registry.set('topBarHeight', topH);
game.registry.set('playViewportHeight', playH);
window.__game = game;
installRoomCodeCopy(roomId);

window.addEventListener('resize', () => {
  const nextW = window.innerWidth || mapW;
  const nextH = window.innerHeight || mapH + hudH;
  game.scale.resize(nextW, nextH);
  game.registry.set('playViewportHeight', Math.max(360, nextH - hudH));
});
