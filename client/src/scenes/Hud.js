/* HUD overlay scene — server-driven.
   Reads state from Game's 'stats' events and sends commands to the backend
   via the net client stored in the registry. */
import Phaser from 'phaser';
import {
  HUD_BAR_HEIGHT,
  INFANTRY_KINDS,
  TOWERS,
  TOWER_ORDER,
  UNITS,
  UNIT_ORDER,
  TEAM_COLORS,
  MAX_TOWER_LEVEL,
  towerDamageAtLevel,
  towerRangeAtLevel,
  towerUpgradeCost,
} from '../config.js';

const TOWER_DESCRIPTIONS = {
  rifle: 'Cheap starter defense. Reliable single-target fire for the first waves.',
  mg: 'Very fast fire rate. Best against groups of light infantry.',
  mortar: 'Arcing explosive shots. Strong splash damage over barricaded lanes.',
  cannon: 'Heavy direct fire. Good all-round answer to vehicles.',
  at: 'Long-range armor killer. Slow, precise, and built for tanks.',
  flak: 'Rapid burst cannon. Clips groups and lightly splashes clustered units.',
  howitzer: 'Expensive long-range artillery with a large blast radius.',
  sniper: 'Extreme range and high damage. Deletes priority targets one at a time.',
  flame: 'Short-range bunker that slows and burns packed enemies.',
  rocket: 'Rocket battery with splash damage for heavy pushes.',
  bazooka: 'Mobile anti-armor team. Cheaper burst damage with small splash.',
  command: 'Income bunker. Generates cash instead of attacking enemies.',
};

const UNIT_DESCRIPTIONS = {
  infantry: 'Cheap pressure unit. Good for forcing early tower spending.',
  scout: 'Fast runner. Punishes open lanes and slow reactions.',
  grenadier: 'Durable infantry with higher base damage.',
  heavy: 'Slow heavy infantry that soaks early defenses.',
  motorcycle: 'Very fast vehicle for timing attacks.',
  armoredcar: 'Light armor that pressures weak single-target defenses.',
  halftrack: 'Mid-tier armor with solid health and base damage.',
  lighttank: 'Reliable armored push unit.',
  mediumtank: 'Expensive tank that needs focused anti-armor fire.',
  heavytank: 'Late-game breakthrough unit with heavy base damage.',
};

export default class Hud extends Phaser.Scene {
  constructor() { super('Hud'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._net      = this.registry.get('net');
    this._myId     = this.registry.get('playerId');
    const snapshot = this.registry.get('snapshot');
    const fallbackMapH = snapshot?.map ? snapshot.map.rows * snapshot.map.tile : H - HUD_BAR_HEIGHT;
    const mapH     = this.registry.get('mapPixelHeight') ?? fallbackMapH;
    const hudH     = this.registry.get('hudHeight') ?? HUD_BAR_HEIGHT;
    const playH    = this.registry.get('playViewportHeight') ?? H - hudH;
    this._mode     = snapshot?.map?.mode ?? 'pvp';   // 'single' or 'pvp'
    this._maxPlayers = snapshot?.map?.players ?? 2;  // PvP needs every base filled
    this._myTeam   = '';
    this._money    = 0;
    this._status   = 'waiting';
    this._ready    = false;
    this._buttons  = {};
    this._unitButtons = {};
    this._players  = [];
    this._selected = null;
    this._inspectedTower = null;
    this._hudMode  = 'build';
    this._targetTeam = null;

    this._buildTopBar(W);
    this._buildUpgradePanel();
    this._buildReadyBtn(W);
    this._buildPalette(W, playH, hudH);

    this._banner = this.add.container(W / 2, H / 2).setDepth(50).setAlpha(0);
    this._listenGame();
    this.events.once('shutdown', () => this.game.events.removeAllListeners());
  }

  /* ------------------------------------------------------------------ */
  /*  Top bar: money / HP / wave / team                                  */
  /* ------------------------------------------------------------------ */

  _buildTopBar(W) {
    this.add.rectangle(0, 0, W, 40, 0x15161d, 0.9).setOrigin(0).setDepth(0);

    this.add.image(20, 20, 'ui_coin').setDepth(1);
    this._moneyTxt = this.add.text(38, 12, '0', {
      fontFamily: 'monospace', fontSize: 18, color: '#ffcf3f',
    }).setDepth(1);

    this.add.image(150, 20, 'icon_heart').setScale(0.8).setDepth(1);
    this._hpTxt = this.add.text(168, 12, '—', {
      fontFamily: 'monospace', fontSize: 18, color: '#e8413a',
    }).setDepth(1);

    this._waveTxt = this.add.text(W / 2, 12, 'WAITING', {
      fontFamily: 'monospace', fontSize: 15, color: '#e9e6da',
    }).setOrigin(0.5, 0).setDepth(1);

    this._teamTxt = this.add.text(W - 16, 12, '', {
      fontFamily: 'monospace', fontSize: 13, color: '#8a90a0',
    }).setOrigin(1, 0).setDepth(1);
  }

  _buildUpgradePanel() {
    this._upgradePanel = this.add.container(252, 20).setDepth(4).setVisible(false);
    const bg = this.add.rectangle(0, 0, 218, 28, 0x0e0f14, 0.96)
      .setStrokeStyle(1, 0xffcf3f);
    this._upgradeTitle = this.add.text(-100, -7, 'DEFENSE', {
      fontFamily: 'monospace', fontSize: 9, color: '#b9bfcc',
    }).setOrigin(0, 0.5);
    this._upgradeStats = this.add.text(-100, 7, '', {
      fontFamily: 'monospace', fontSize: 9, color: '#e9e6da',
    }).setOrigin(0, 0.5);
    this._upgradeBtn = this.add.rectangle(69, 0, 76, 20, 0x2b2818, 1)
      .setStrokeStyle(1, 0xffcf3f)
      .setInteractive({ useHandCursor: true });
    this._upgradeBtnText = this.add.text(69, 0, 'UPGRADE', {
      fontFamily: 'monospace', fontSize: 9, color: '#ffcf3f', fontStyle: 'bold',
    }).setOrigin(0.5);
    this._upgradeBtn.on('pointerdown', () => this._upgradeDefense());
    this._upgradePanel.add([bg, this._upgradeTitle, this._upgradeStats, this._upgradeBtn, this._upgradeBtnText]);
  }

  /* ------------------------------------------------------------------ */
  /*  Ready button (replaces "Start Wave" — server controls waves)       */
  /* ------------------------------------------------------------------ */

  _buildReadyBtn(W) {
    // Sits below the room-code chip (fixed DOM overlay at top:46 / height 26)
    // so the two never overlap in the top-right corner.
    this._readyBtn = this._uiButton(W - 130, 98, 'ui_button_green', 'READY', () => {
      if (!this._ready) {
        this._net.ready();
        this._ready = true;
        this._readyBtn.label.setText('WAITING…');
        this._readyBtn.img.setAlpha(0.5);
        this._readyBtn.img.disableInteractive();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Tower palette                                                       */
  /* ------------------------------------------------------------------ */

  _buildPalette(W, mapY, barH) {
    const pad = 12;
    const cell = Phaser.Math.Clamp(Math.floor((W - pad * 2) / TOWER_ORDER.length), 72, 88);
    const cardW = cell - 6;
    const cardH = 54;
    const cardY = mapY + barH / 2;

    this.add.rectangle(0, mapY, W, barH, 0x15161d, 0.96).setOrigin(0).setDepth(0);
    this.add.rectangle(0, mapY, W, 2, 0xffcf3f, 0.7).setOrigin(0).setDepth(1);

    // Default to p1 until we know the player's team.
    const pt = 'p1';
    const towerTotalW = TOWER_ORDER.length * cell;
    const towerStartX = W / 2 - towerTotalW / 2 + cell / 2;
    this._towerLayer = this.add.container(0, 0).setDepth(2);
    this._unitLayer = this.add.container(0, 0).setDepth(2).setVisible(false);

    TOWER_ORDER.forEach((key, i) => {
      const x = towerStartX + i * cell, y = cardY;
      const card = this.add.rectangle(x, y, cardW, cardH, 0x23262f)
        .setStrokeStyle(2, 0x33384a).setInteractive({ useHandCursor: true });
      const base = this.add.image(x, y - 2, `tower_${key}_base_${pt}`).setScale(0.52);
      const gun = this.add.image(x, y - 2, `tower_${key}_gun_${pt}`).setScale(0.52).setRotation(-Math.PI / 4);
      const cost = this.add.text(x, y + 18, '$' + TOWERS[key].cost, {
        fontFamily: 'monospace', fontSize: 11, color: '#ffcf3f',
      }).setOrigin(0.5);
      const name = this.add.text(x, y - 22, TOWERS[key].name, {
        fontFamily: 'monospace', fontSize: 8, color: '#b9bfcc',
      }).setOrigin(0.5);
      card.on('pointerover', () => this._showTowerTip(key));
      card.on('pointerout', () => this._hideTowerTip());
      card.on('pointerdown', () => this._select(key));
      this._towerLayer.add([card, base, gun, cost, name]);
      this._buttons[key] = { card, cost };
    });

    const unitCell = Phaser.Math.Clamp(Math.floor((W - pad * 2) / UNIT_ORDER.length), 72, 96);
    const unitTotalW = UNIT_ORDER.length * unitCell;
    const unitStartX = W / 2 - unitTotalW / 2 + unitCell / 2;
    UNIT_ORDER.forEach((key, i) => {
      const x = unitStartX + i * unitCell, y = cardY;
      const unit = UNITS[key];
      const card = this.add.rectangle(x, y, unitCell - 6, cardH, 0x23262f)
        .setStrokeStyle(2, 0x33384a).setInteractive({ useHandCursor: true });
      const icon = INFANTRY_KINDS.has(key)
        ? this.add.sprite(x, y - 2, `unit_${key}_p0`, 0).setScale(0.5)
        : this.add.image(x, y - 2, `unit_${key}_p0`).setScale(0.5);
      const cost = this.add.text(x, y + 18, '$' + unit.cost, {
        fontFamily: 'monospace', fontSize: 11, color: '#ffcf3f',
      }).setOrigin(0.5);
      const name = this.add.text(x, y - 22, unit.name, {
        fontFamily: 'monospace', fontSize: 8, color: '#b9bfcc',
      }).setOrigin(0.5);
      card.on('pointerover', () => this._showUnitTip(key));
      card.on('pointerout', () => this._hideTowerTip());
      card.on('pointerdown', () => this._dispatch(key));
      this._unitLayer.add([card, icon, cost, name]);
      this._unitButtons[key] = { card, cost };
    });

    if (this._mode !== 'single') {
      this._buildModeControls(mapY, barH);
    }

    const tipWidth = this._mode === 'single' ? Math.min(W - 56, 980) : Math.min(W - 360, 780);
    this._tip = this.add.container(W / 2, mapY - 18).setDepth(60).setVisible(false);
    this._tipBg = this.add.rectangle(0, 0, tipWidth, 26, 0x0e0f14, 0.95)
      .setStrokeStyle(1, 0x33384a);
    this._tipTitle = this.add.text(-this._tipBg.width / 2 + 16, 0, '', {
      fontFamily: 'monospace', fontSize: 12, color: '#ffcf3f', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this._tipBody = this.add.text(-this._tipBg.width / 2 + 132, 0, '', {
      fontFamily: 'monospace', fontSize: 11, color: '#e9e6da',
      wordWrap: { width: this._tipBg.width - 152 },
    }).setOrigin(0, 0.5);
    this._tip.add([this._tipBg, this._tipTitle, this._tipBody]);
  }

  /* ------------------------------------------------------------------ */
  /*  Game event listeners                                               */
  /* ------------------------------------------------------------------ */

  _listenGame() {
    this.game.events.on('stats', s => this._onStats(s));
    this.game.events.on('deselect', () => this._select(null));
    this.game.events.on('towerInspect', tower => this._onTowerInspect(tower));
    this.game.events.on('towerUpgraded', ev => this._onTowerUpgraded(ev));
    this.game.events.on('unitUpgraded', ev => this._onUnitUpgraded(ev));
    this.game.events.on('serverError', msg => this._flash(msg, '#e8413a', false));
    this.game.events.on('disconnect', () => this._flash('DISCONNECTED', '#e8413a', true));
  }

  _onStats(s) {
    this._money  = s.money;
    this._status = s.status;
    this._players = s.players;

    this._moneyTxt.setText(s.money);
    this._hpTxt.setText(s.baseHP);

    const isSingle = this._mode === 'single';

    // Wave / status line.
    if (s.status === 'waiting') {
      const ready = s.players.filter(p => p.ready).length;
      if (isSingle) {
        this._waveTxt.setText('WAITING');
      } else {
        const need = this._maxPlayers;
        const joined = s.players.length;
        this._waveTxt.setText(
          joined < need
            ? `WAITING FOR OPPONENT — ${joined}/${need} joined`
            : `WAITING — ${ready}/${need} ready`,
        );
      }
      this._readyBtn.img.setVisible(!isSingle);
      this._readyBtn.label.setVisible(!isSingle);
    } else if (s.status === 'running' || s.status === 'finished') {
      let label;
      if (s.prepRemaining > 0) {
        const secs = Math.ceil(s.prepRemaining);
        label = isSingle
          ? `WAVE ${s.wave} starts in ${secs}s — BUILD!`
          : `NEXT WAVE IN ${secs}s`;
      } else if (!isSingle && s.status === 'running') {
        label = 'PVP — BUILD DEFENSES OR SEND UNITS';
      } else if (s.waveActive) {
        label = `WAVE ${s.wave} / ${s.totalWaves}`;
      } else {
        label = `WAVE ${s.wave} CLEARED`;
      }
      this._waveTxt.setText(label);
      // Ready button is only relevant in PvP lobby.
      this._readyBtn.img.setVisible(false);
      this._readyBtn.label.setVisible(false);
    }

    // Team label.
    const me = s.players.find(p => p.id === this._myId);
    if (me?.team && me.team !== this._myTeam) {
      this._myTeam = me.team;
      const tc = TEAM_COLORS[this._myTeam];
      if (tc) this._teamTxt.setText('● ' + tc.name).setColor(tc.css);
    }
    this._updateTargetLabel();

    this._refreshAffordable();
    this._refreshUpgradePanel();

    // End-game banners.
    if (s.status === 'victory')  this._flash('VICTORY!',       '#3fd56a', true);
    if (s.status === 'defeat')   this._flash('BASE DESTROYED', '#e8413a', true);
    if (s.status === 'finished') {
      if (s.winner === this._myTeam) this._flash('VICTORY!',   '#3fd56a', true);
      else if (s.winner)             this._flash('DEFEATED',   '#e8413a', true);
      else                           this._flash('DRAW',       '#ffcf3f', true);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */

  _uiButton(x, y, tex, text, cb) {
    const img = this.add.image(x, y, tex).setDepth(1).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y - 2, text, {
      fontFamily: 'monospace', fontSize: 13, color: '#fff',
    }).setOrigin(0.5).setDepth(2);
    img.on('pointerover',  () => img.setTexture(tex + '_hover'));
    img.on('pointerout',   () => img.setTexture(tex));
    img.on('pointerdown',  () => { img.setTexture(tex + '_press'); cb(); });
    img.on('pointerup',    () => img.setTexture(tex + '_hover'));
    return { img, label };
  }

  _buildModeControls(mapY, barH) {
    const y = mapY + barH / 2;
    this._modeButtons = {
      build: this._modeButton(58, y, 'BUILD', () => this._setHudMode('build')),
      send: this._modeButton(138, y, 'SEND', () => this._setHudMode('send')),
    };

    this._targetButton = this._modeButton(this.scale.width - 104, y, 'TARGET', () => this._cycleTarget(), 160);
    this._setHudMode('build');
  }

  _modeButton(x, y, text, cb, width = 70) {
    const bg = this.add.rectangle(x, y, width, 24, 0x1c1f2a, 0.96)
      .setStrokeStyle(1, 0x33384a)
      .setDepth(55)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: 11, color: '#e9e6da', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(56);
    bg.on('pointerdown', cb);
    return { bg, label };
  }

  _setHudMode(mode) {
    this._hudMode = mode;
    this._towerLayer?.setVisible(mode === 'build');
    this._unitLayer?.setVisible(mode === 'send');

    if (mode === 'send') this._select(null);

    Object.entries(this._modeButtons ?? {}).forEach(([key, button]) => {
      const active = key === mode;
      button.bg.setFillStyle(active ? 0x2b2818 : 0x1c1f2a);
      button.bg.setStrokeStyle(1, active ? 0xffcf3f : 0x33384a);
      button.label.setColor(active ? '#ffcf3f' : '#e9e6da');
    });
  }

  _cycleTarget() {
    const targets = this._availableTargets();
    if (!targets.length) return;
    const index = targets.indexOf(this._targetTeam);
    this._targetTeam = targets[(index + 1) % targets.length];
    this._updateTargetLabel();
  }

  _availableTargets() {
    return this._players
      .filter(p => p.team && p.team !== this._myTeam && p.alive !== false)
      .map(p => p.team);
  }

  _updateTargetLabel() {
    if (!this._targetButton) return;
    const targets = this._availableTargets();

    if (!targets.includes(this._targetTeam)) {
      this._targetTeam = targets[0] ?? null;
    }

    const color = TEAM_COLORS[this._targetTeam]?.css ?? '#8a90a0';
    const name = TEAM_COLORS[this._targetTeam]?.name ?? 'None';
    this._targetButton.label.setText(`TARGET ${name.toUpperCase()}`);
    this._targetButton.label.setColor(color);
  }

  _select(key) {
    this._selected = key;
    if (key) this._onTowerInspect(null);
    Object.entries(this._buttons).forEach(([k, b]) =>
      b.card.setStrokeStyle(2, k === key ? 0xffcf3f : 0x33384a));
    this.game.events.emit('selectTower', key);
  }

  _dispatch(key) {
    if (this._status !== 'running') {
      this._flash('MATCH NOT RUNNING', '#e8413a', false);
      return;
    }

    this._updateTargetLabel();

    if (!this._targetTeam) {
      this._flash('NO TARGET', '#e8413a', false);
      return;
    }

    this._net.dispatch(key, this._targetTeam);
  }

  _onUnitUpgraded(ev) {
    if (ev.player_id && ev.player_id !== this._myId) return;

    const unit = UNITS[ev.kind]?.name ?? ev.kind.toUpperCase();
    const bonus = ev.health_bonus_pct ?? ev.damage_bonus_pct ?? 10;
    this._flash(`${unit} UPGRADED +${bonus}% HP / DAMAGE`, '#3fd56a', false);
  }

  _onTowerUpgraded(ev) {
    if (ev.player_id && ev.player_id !== this._myId) return;

    const tower = TOWERS[ev.kind]?.name ?? ev.kind.toUpperCase();
    this._flash(`${tower} UPGRADED TO L${ev.level}`, '#3fd56a', false);
  }

  _onTowerInspect(tower) {
    this._inspectedTower = tower?.owner_id === this._myId ? tower : null;
    this._refreshUpgradePanel();
  }

  _upgradeDefense() {
    const tower = this._inspectedTower;
    if (!tower) return;

    if (tower.level >= MAX_TOWER_LEVEL) {
      this._flash('DEFENSE AT MAX LEVEL', '#ffcf3f', false);
      return;
    }

    const cost = towerUpgradeCost(tower.kind, tower.level);
    if (cost === null) return;

    if (this._money < cost) {
      this._flash('NOT ENOUGH MONEY', '#e8413a', false);
      return;
    }

    this._net.upgrade(tower.id);
    this._flash(`${TOWERS[tower.kind].name} UPGRADE ORDERED`, '#3fd56a', false);
  }

  _showTowerTip(key) {
    const tower = TOWERS[key];
    const bits = [
      TOWER_DESCRIPTIONS[key] ?? 'Builds a battlefield defense.',
      tower.income ? `Income +$${tower.income} every 3s.` : `Range ${tower.range}px / Damage ${tower.dmg} / Cooldown ${tower.cd}ms.`,
    ];

    if (tower.splash > 0) bits.push(`Splash ${tower.splash}px.`);

    this._tipTitle.setText(tower.name);
    this._tipBody.setText(bits.join('  '));
    this._tip.setVisible(true).setAlpha(1);
  }

  _showUnitTip(key) {
    const unit = UNITS[key];
    const squadSize = unit.kind === 'inf' ? 5 : 3;
    const bits = [
      UNIT_DESCRIPTIONS[key] ?? 'Purchased attack unit.',
      `Dispatches ${squadSize} for $${unit.cost}. HP ${unit.hp} / Speed ${unit.speed} / Base damage ${unit.dmg}.`,
    ];

    this._tipTitle.setText(unit.name);
    this._tipBody.setText(bits.join('  '));
    this._tip.setVisible(true).setAlpha(1);
  }

  _hideTowerTip() {
    this._tip.setVisible(false);
  }

  _refreshAffordable() {
    Object.entries(this._buttons).forEach(([k, b]) => {
      const ok = this._money >= TOWERS[k].cost;
      b.card.setFillStyle(ok ? 0x23262f : 0x1a1116);
      b.cost.setColor(ok ? '#ffcf3f' : '#7a4a3a');
    });
    Object.entries(this._unitButtons).forEach(([k, b]) => {
      const ok = this._money >= UNITS[k].cost;
      b.card.setFillStyle(ok ? 0x23262f : 0x1a1116);
      b.cost.setColor(ok ? '#ffcf3f' : '#7a4a3a');
    });
  }

  _refreshUpgradePanel() {
    const tower = this._inspectedTower;
    if (!tower || !this._upgradePanel) {
      this._upgradePanel?.setVisible(false);
      return;
    }

    const def = TOWERS[tower.kind];
    const level = tower.level ?? 1;
    const maxed = level >= MAX_TOWER_LEVEL;
    const cost = towerUpgradeCost(tower.kind, level);
    const nextLevel = Math.min(MAX_TOWER_LEVEL, level + 1);
    const nextDamage = towerDamageAtLevel(tower.kind, nextLevel);
    const nextRange = towerRangeAtLevel(tower.kind, nextLevel);
    const canAfford = cost !== null && this._money >= cost;

    this._upgradeTitle.setText(`${def.name.toUpperCase()} L${level}`);
    this._upgradeStats.setText(maxed
      ? 'MAX LEVEL'
      : `L${nextLevel}: ${Math.round(nextDamage)} DMG / ${Math.round(nextRange)} RNG`);
    this._upgradeBtnText.setText(maxed ? 'MAX' : `$${cost}`);
    this._upgradeBtn.disableInteractive();

    if (!maxed && canAfford) {
      this._upgradeBtn.setFillStyle(0x2b2818, 1).setStrokeStyle(1, 0xffcf3f).setInteractive({ useHandCursor: true });
      this._upgradeBtnText.setColor('#ffcf3f');
    } else if (!maxed) {
      this._upgradeBtn.setFillStyle(0x1a1116, 1).setStrokeStyle(1, 0x7a4a3a);
      this._upgradeBtnText.setColor('#7a4a3a');
    } else {
      this._upgradeBtn.setFillStyle(0x1c1f2a, 1).setStrokeStyle(1, 0x3fd56a);
      this._upgradeBtnText.setColor('#3fd56a');
    }

    this._upgradePanel.setVisible(true);
  }

  _flash(text, color, sticky) {
    this._banner.removeAll(true);
    const hexColor = Phaser.Display.Color.HexStringToColor(color).color;
    const bg = this.add.rectangle(0, 0, 460, 90, 0x15161d, 0.92)
                 .setStrokeStyle(3, hexColor);
    const t = this.add.text(0, 0, text, {
      fontFamily: 'monospace', fontSize: 34, color, fontStyle: 'bold',
    }).setOrigin(0.5);
    this._banner.add([bg, t]);
    this._banner.setAlpha(1).setScale(0.8);
    this.tweens.add({ targets: this._banner, scale: 1, duration: 220, ease: 'Back.out' });
    if (!sticky) this.tweens.add({ targets: this._banner, alpha: 0, delay: 1100, duration: 400 });
  }
}
