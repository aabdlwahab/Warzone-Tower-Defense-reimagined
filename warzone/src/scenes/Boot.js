/* Boot / preload scene — queues every asset listed in the manifest,
   then builds Phaser animations for the spritesheets. */
import Phaser from 'phaser';

export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const m = this.registry.get('manifest');
    const base = this.registry.get('assetBase') || '';
    const P = p => base + p;

    // simple progress bar
    const { width, height } = this.scale;
    const g = this.add.graphics();
    const bw = 360, bx = (width - bw) / 2, by = height / 2;
    this.add.text(bx, by - 34, 'WARZONE — loading…', { fontFamily: 'monospace', fontSize: 16, color: '#ffcf3f' });
    this.load.on('progress', p => {
      g.clear();
      g.fillStyle(0x23262f).fillRoundedRect(bx, by, bw, 16, 8);
      g.fillStyle(0xffcf3f).fillRoundedRect(bx + 2, by + 2, (bw - 4) * p, 12, 6);
    });

    // neutral single-frame images
    m.statics.forEach(s => this.load.image(s.key, P(s.path)));
    // team-baked single-frame images (all variants)
    m.teamStatics.forEach(t => t.variants.forEach(v => this.load.image(v.key, P(v.path))));
    // neutral spritesheets
    m.anims.forEach(a => this.load.spritesheet(a.key, P(a.path), { frameWidth: a.frameWidth, frameHeight: a.frameHeight }));
    // team spritesheets
    m.teamAnims.forEach(a => a.variants.forEach(v =>
      this.load.spritesheet(v.key, P(v.path), { frameWidth: a.frameWidth, frameHeight: a.frameHeight })));
  }

  create() {
    const m = this.registry.get('manifest');

    const makeAnim = (key, frames, fps, repeat) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }),
        frameRate: fps, repeat,
      });
    };
    m.anims.forEach(a => makeAnim(a.key, a.frames, a.fps, a.repeat));
    m.teamAnims.forEach(a => a.variants.forEach(v => makeAnim(v.key, a.frames, a.fps, a.repeat)));

    this.scene.start('Game');
    this.scene.launch('Hud');
  }
}
