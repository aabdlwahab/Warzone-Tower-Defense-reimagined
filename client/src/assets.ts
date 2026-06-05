import Phaser from "phaser";

type AssetEntry = {
  key: string;
  path: string;
};

type AnimEntry = AssetEntry & {
  frameHeight: number;
  frameWidth: number;
  fps: number;
  frames: number;
  repeat: number;
};

type TeamEntry = {
  key: string;
  variants: AssetEntry[];
};

type TeamAnimEntry = Omit<AnimEntry, "path"> & {
  variants: AssetEntry[];
};

type AssetManifest = {
  anims: AnimEntry[];
  statics: AssetEntry[];
  teamAnims: TeamAnimEntry[];
  teamStatics: TeamEntry[];
};

const MANIFEST_URL = "/assets/manifest.json";

export class AssetCatalog {
  private _manifest: AssetManifest;

  constructor(manifest: AssetManifest) {
    this._manifest = manifest;
  }

  static async load(): Promise<AssetCatalog> {
    const response = await fetch(MANIFEST_URL);

    if (!response.ok) {
      throw new Error("Asset manifest could not be loaded");
    }

    const manifest = (await response.json()) as AssetManifest;
    AssetCatalog._validate(manifest);
    return new AssetCatalog(manifest);
  }

  create(scene: Phaser.Scene): void {
    this._manifest.anims.forEach((entry) => this._create(scene, entry.key, entry));
    this._manifest.teamAnims.forEach((entry) => {
      entry.variants.forEach((variant) => this._create(scene, variant.key, entry));
    });
  }

  get(key: string): string {
    return key;
  }

  has(scene: Phaser.Scene, key: string): boolean {
    return scene.textures.exists(key);
  }

  preload(scene: Phaser.Scene): void {
    this._manifest.statics.forEach((entry) => scene.load.image(entry.key, this._path(entry.path)));
    this._manifest.teamStatics.forEach((entry) => {
      entry.variants.forEach((variant) => {
        scene.load.image(variant.key, this._path(variant.path));
      });
    });
    this._manifest.anims.forEach((entry) => {
      scene.load.spritesheet(entry.key, this._path(entry.path), {
        frameHeight: entry.frameHeight,
        frameWidth: entry.frameWidth
      });
    });
    this._manifest.teamAnims.forEach((entry) => {
      entry.variants.forEach((variant) => {
        scene.load.spritesheet(variant.key, this._path(variant.path), {
          frameHeight: entry.frameHeight,
          frameWidth: entry.frameWidth
        });
      });
    });
  }

  team(key: string, team: string): string {
    return `${key}_${team}`;
  }

  private static _validate(manifest: AssetManifest): void {
    if (!Array.isArray(manifest.statics)) {
      throw new Error("Asset manifest statics are invalid");
    }

    if (!Array.isArray(manifest.teamStatics)) {
      throw new Error("Asset manifest team statics are invalid");
    }

    if (!Array.isArray(manifest.anims)) {
      throw new Error("Asset manifest animations are invalid");
    }

    if (!Array.isArray(manifest.teamAnims)) {
      throw new Error("Asset manifest team animations are invalid");
    }
  }

  private _create(scene: Phaser.Scene, key: string, entry: AnimEntry | TeamAnimEntry): void {
    if (scene.anims.exists(key)) {
      return;
    }

    scene.anims.create({
      frameRate: entry.fps,
      frames: scene.anims.generateFrameNumbers(key, {
        end: entry.frames - 1,
        start: 0
      }),
      key,
      repeat: entry.repeat
    });
  }

  private _path(path: string): string {
    return `/${path.replace(/^\/+/, "")}`;
  }
}

