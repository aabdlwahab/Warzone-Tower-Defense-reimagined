/* Warzone — Phaser bootstrap. Fetches the asset manifest, then starts
   the game at the map's native size (COLS×ROWS × TILE). */
import Phaser from 'phaser';
import { TILE, COLS, ROWS } from './config.js';
import Boot from './scenes/Boot.js';
import Game from './scenes/Game.js';
import Hud from './scenes/Hud.js';

const BASE = window.ASSET_BASE || '';
const manifest = await fetch(BASE + 'assets/manifest.json').then(r => r.json());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COLS * TILE,
  height: ROWS * TILE,
  backgroundColor: '#2e3d22',
  pixelArt: false,
  roundPixels: true,
  render: { preserveDrawingBuffer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Game, Hud],
});
game.registry.set('manifest', manifest);
game.registry.set('assetBase', BASE);
window.__game = game;
