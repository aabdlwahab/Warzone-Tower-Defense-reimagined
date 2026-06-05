/* HUD overlay scene — money / base HP / wave readout, tower build
   palette, and wave + speed controls. Talks to Game via game.events. */
import Phaser from 'phaser';
import { TOWERS, TOWER_ORDER, PLAYER_TEAM, TEAM_COLORS, PLAYER_TEAM as PT } from '../config.js';

export default class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.money = 0; this.selected = null; this.buttons = {};

    // ---- top bar ----
    this.add.rectangle(0, 0, W, 40, 0x15161d, 0.88).setOrigin(0).setDepth(0);
    this.add.image(20, 20, 'ui_coin').setDepth(1);
    this.moneyTxt = this.add.text(38, 12, '0', { fontFamily: 'monospace', fontSize: 18, color: '#ffcf3f' }).setDepth(1);
    this.add.image(150, 20, 'icon_heart').setScale(0.8).setDepth(1);
    this.hpTxt = this.add.text(168, 12, '100', { fontFamily: 'monospace', fontSize: 18, color: '#e8413a' }).setDepth(1);
    this.waveTxt = this.add.text(W / 2, 12, 'WAVE 0', { fontFamily: 'monospace', fontSize: 16, color: '#e9e6da' }).setOrigin(0.5, 0).setDepth(1);

    const teamCss = TEAM_COLORS[PLAYER_TEAM].css;
    this.add.text(W - 16, 12, '● ' + TEAM_COLORS[PLAYER_TEAM].name, { fontFamily: 'monospace', fontSize: 14, color: teamCss }).setOrigin(1, 0).setDepth(1);

    // ---- start wave + speed ----
    this.startBtn = this.uiButton(W - 130, 60, 'ui_button_green', 'START WAVE', () => this.game.events.emit('startWave'));
    this.speed = 1;
    this.speedBtn = this.uiButton(W - 130, 104, 'ui_button', '▶ 1×', () => {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
      this.speedBtn.label.setText('▶ ' + this.speed + '×');
      this.game.events.emit('setSpeed', this.speed);
    });

    // ---- tower palette (bottom) ----
    const barH = 92;
    this.add.rectangle(0, H - barH, W, barH, 0x15161d, 0.9).setOrigin(0).setDepth(0);
    const pad = 14, cell = 74;
    TOWER_ORDER.forEach((key, i) => {
      const x = pad + cell / 2 + i * cell, y = H - barH / 2;
      const card = this.add.rectangle(x, y, cell - 8, barH - 16, 0x23262f).setStrokeStyle(2, 0x33384a).setDepth(1).setInteractive({ useHandCursor: true });
      this.add.image(x, y - 12, 'tower_' + key + '_base_' + PT).setScale(0.62).setDepth(2);
      this.add.image(x, y - 12, 'tower_' + key + '_gun_' + PT).setScale(0.62).setDepth(2).setRotation(-Math.PI / 4);
      const cost = this.add.text(x, y + 24, '$' + TOWERS[key].cost, { fontFamily: 'monospace', fontSize: 12, color: '#ffcf3f' }).setOrigin(0.5).setDepth(2);
      this.add.text(x, y - 36, TOWERS[key].name, { fontFamily: 'monospace', fontSize: 8.5, color: '#8a90a0' }).setOrigin(0.5).setDepth(2);
      card.on('pointerdown', () => this.select(key));
      this.buttons[key] = { card, cost };
    });

    // ---- banners (wave / game over / victory) ----
    this.banner = this.add.container(W / 2, H / 2).setDepth(50).setAlpha(0);

    // ---- events from Game ----
    this.game.events.on('stats', s => {
      this.money = s.money;
      this.moneyTxt.setText(s.money);
      this.hpTxt.setText(s.baseHP);
      this.waveTxt.setText('WAVE ' + s.wave + ' / ' + s.totalWaves);
      this.refreshAffordable();
    });
    this.game.events.on('deselect', () => this.select(null));
    this.game.events.on('wave', d => this.flash('WAVE ' + d.index, '#ffcf3f'));
    this.game.events.on('waveCleared', d => this.flash('WAVE CLEARED', '#3fd56a'));
    this.game.events.on('gameOver', d => this.flash('BASE DESTROYED', '#e8413a', true));
    this.game.events.on('victory', () => this.flash('VICTORY!', '#3fd56a', true));

    this.events.once('shutdown', () => this.game.events.removeAllListeners());
  }

  uiButton(x, y, tex, text, cb) {
    const img = this.add.image(x, y, tex).setDepth(1).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y - 2, text, { fontFamily: 'monospace', fontSize: 13, color: '#fff' }).setOrigin(0.5).setDepth(2);
    img.on('pointerover', () => img.setTexture(tex + '_hover'));
    img.on('pointerout', () => img.setTexture(tex));
    img.on('pointerdown', () => { img.setTexture(tex + '_press'); cb(); });
    img.on('pointerup', () => img.setTexture(tex + '_hover'));
    return { img, label };
  }

  select(key) {
    this.selected = key;
    Object.entries(this.buttons).forEach(([k, b]) => b.card.setStrokeStyle(2, k === key ? 0xffcf3f : 0x33384a));
    this.game.events.emit('selectTower', key);
  }

  refreshAffordable() {
    Object.entries(this.buttons).forEach(([k, b]) => {
      const ok = this.money >= TOWERS[k].cost;
      b.card.setFillStyle(ok ? 0x23262f : 0x1a1116);
      b.cost.setColor(ok ? '#ffcf3f' : '#7a4a3a');
    });
  }

  flash(text, color, sticky) {
    this.banner.removeAll(true);
    const bg = this.add.rectangle(0, 0, 460, 90, 0x15161d, 0.92).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(color).color);
    const t = this.add.text(0, 0, text, { fontFamily: 'monospace', fontSize: 34, color, fontStyle: 'bold' }).setOrigin(0.5);
    this.banner.add([bg, t]);
    this.banner.setAlpha(1).setScale(0.8);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.out' });
    if (!sticky) this.tweens.add({ targets: this.banner, alpha: 0, delay: 1100, duration: 400 });
  }
}
