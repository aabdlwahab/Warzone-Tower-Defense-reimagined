/* Paints the static layer of a map into a Phaser scene: ground tiles,
   water, optional road art, decorations, HQ buildings, and spawn flags.
   The server is authoritative for everything dynamic (towers, enemies,
   pathfinding), so no handles are returned — call for the side effect. */

export function paintMap(scene, m) {
  const T = m.tile;
  const px = (gx) => gx * T + T / 2;
  const py = (gy) => gy * T + T / 2;

  // Ground — full canvas height; alternates two grass variants for variety.
  for (let gy = 0; gy * T < m.height; gy += 1) {
    for (let gx = 0; gx < m.cols; gx += 1) {
      const key = ((gx * 7 + gy * 3) % 5 === 0) ? 'tile_grass2' : 'tile_grass';
      scene.add.image(gx * T, gy * T, key).setOrigin(0).setDepth(0);
    }
  }

  // Water tiles.
  (m.water ?? []).forEach((w) =>
    scene.add.image(w.x * T, w.y * T, 'tile_water').setOrigin(0).setDepth(1));

  // Lane road art (absent on open-terrain maps).
  (m.pathTiles ?? []).forEach((p) =>
    scene.add.image(p.x * T, p.y * T, `path_${p.key}`).setOrigin(0).setDepth(1));

  // Decorations / obstacles (trees, rocks, hedgehogs, etc.).
  (m.deco ?? []).forEach((d) =>
    scene.add.image(px(d.x), py(d.y), `deco_${d.key}`).setDepth(3));

  // HQ buildings (96px, centred on the cell).
  (m.bases ?? []).forEach((b) =>
    scene.add.image(px(b.x), py(b.y), `base_hq_${b.team}`).setDepth(5));

  // Spawn flags — tinted by the team that owns the spawn (or hostile p0).
  (m.spawns ?? []).forEach((s) =>
    scene.add.image(px(s.x), py(s.y), `base_flag_${s.team || 'p0'}`).setDepth(4));
}
