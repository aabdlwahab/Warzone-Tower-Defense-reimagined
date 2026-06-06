#!/usr/bin/env node
/**
 * Re-bake forge sprites into public/assets/ (same output as generate.html).
 * Usage: node tools/forge/generate.mjs
 */
import { createCanvas } from 'canvas';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../../public/assets');
const fpsMap = {
  fx_explosion: 18,
  fx_explosion_big: 16,
  fx_muzzle: 30,
  fx_smoke: 14,
  fx_impact: 24,
  fx_flame: 18,
  fx_dust: 14,
};

function loadForge(name) {
  const code = readFileSync(join(__dirname, name), 'utf8');
  vm.runInThisContext(code, { filename: name });
}

globalThis.SF = undefined;
for (const file of [
  '00-core.js',
  '10-towers.js',
  '15-bases.js',
  '20-enemies.js',
  '30-fx.js',
  '40-tiles.js',
  '50-ui-icons.js',
]) {
  loadForge(file);
}

const SF = globalThis.SF;

function canvas(w, h) {
  return createCanvas(w, h);
}

function savePng(c, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, c.toBuffer('image/png'));
}

function drawStatic(s, T, path) {
  const c = canvas(s.w, s.h);
  s.draw(c.getContext('2d'), s.w, s.h, SF.h, T);
  savePng(c, path);
}

async function drawSheet(name, s, draw, path) {
  const c = canvas(s.w * s.frames, s.h);
  const ctx = c.getContext('2d');
  for (let i = 0; i < s.frames; i++) {
    ctx.save();
    ctx.translate(i * s.w, 0);
    draw(ctx, i);
    ctx.restore();
  }
  savePng(c, path);
}

mkdirSync(OUT, { recursive: true });

for (const key of Object.keys(SF.sprites)) {
  const s = SF.sprites[key];
  const group = SF.groups[key];
  drawStatic(s, undefined, join(OUT, group, `${key}.png`));
}
console.log('statics:', Object.keys(SF.sprites).length);

for (const tid of SF.TEAM_ORDER) {
  const T = SF.TEAMS[tid];
  for (const key of Object.keys(SF.teamSprites)) {
    const s = SF.teamSprites[key];
    const group = SF.groups[key];
    drawStatic(s, T, join(OUT, group, `${key}_${tid}.png`));
  }
}
console.log('team statics:', Object.keys(SF.teamSprites).length, '×', SF.TEAM_ORDER.length);

for (const key of Object.keys(SF.anims)) {
  const s = SF.anims[key];
  await drawSheet(key, s, (ctx, i) => s.draw(ctx, i, s.frames, s.w, s.h, SF.h), join(OUT, 'spritesheets', `${key}.png`));
}

for (const tid of SF.TEAM_ORDER) {
  const T = SF.TEAMS[tid];
  for (const key of Object.keys(SF.teamAnims)) {
    const s = SF.teamAnims[key];
    await drawSheet(`${key}_${tid}`, s, (ctx, i) => s.draw(ctx, i, s.frames, s.w, s.h, SF.h, T), join(OUT, 'spritesheets', `${key}_${tid}.png`));
  }
}
console.log('anim sheets done');

const folder = (g) => g;
const manifest = {
  meta: { project: 'warzone', tile: 48, generated: new Date().toISOString().slice(0, 10) },
  teams: SF.TEAM_ORDER.map((id) => ({ id, ...SF.TEAMS[id] })),
  statics: [],
  teamStatics: [],
  anims: [],
  teamAnims: [],
};

for (const key of Object.keys(SF.sprites)) {
  const s = SF.sprites[key];
  manifest.statics.push({
    key,
    group: SF.groups[key],
    path: `assets/${folder(SF.groups[key])}/${key}.png`,
    w: s.w,
    h: s.h,
  });
}

for (const key of Object.keys(SF.teamSprites)) {
  const s = SF.teamSprites[key];
  manifest.teamStatics.push({
    key,
    group: SF.groups[key],
    w: s.w,
    h: s.h,
    variants: SF.TEAM_ORDER.map((t) => ({
      team: t,
      key: `${key}_${t}`,
      path: `assets/${folder(SF.groups[key])}/${key}_${t}.png`,
    })),
  });
}

for (const key of Object.keys(SF.anims)) {
  const s = SF.anims[key];
  manifest.anims.push({
    key,
    group: SF.groups[key],
    path: `assets/spritesheets/${key}.png`,
    frameWidth: s.w,
    frameHeight: s.h,
    frames: s.frames,
    fps: fpsMap[key] || 16,
    repeat: 0,
  });
}

for (const key of Object.keys(SF.teamAnims)) {
  const s = SF.teamAnims[key];
  manifest.teamAnims.push({
    key,
    group: SF.groups[key],
    frameWidth: s.w,
    frameHeight: s.h,
    frames: s.frames,
    fps: 10,
    repeat: -1,
    variants: SF.TEAM_ORDER.map((t) => ({
      team: t,
      key: `${key}_${t}`,
      path: `assets/spritesheets/${key}_${t}.png`,
    })),
  });
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('wrote', OUT);
