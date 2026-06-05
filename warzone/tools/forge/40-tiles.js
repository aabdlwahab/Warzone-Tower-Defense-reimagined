/* =====================================================================
   WARZONE — Sprite Forge :: TILES & DECORATIONS  (48x48, neutral)
   Ground tiles, dirt-lane path pieces (mask-driven so they tile), and
   transparent prop sprites placed on top of ground.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };

  // deterministic speckle scatter
  function speckle(c, base, dots, colA, colB, seed) {
    let s = seed || 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < dots; i++) {
      const x = 4 + rnd() * 40, y = 4 + rnd() * 40, r = 1.2 + rnd() * 2.2;
      circle(c, x, y, r); F(c, rnd() > 0.5 ? colA : colB);
    }
  }

  /* ---- ground tiles ---------------------------------------------- */
  SF.reg('tile_grass', 48, 48, 'tiles', (c) => { F2(c, P.grass); speckle(c, 0, 10, P.grassDk, P.grassLt, 3); });
  SF.reg('tile_grass2', 48, 48, 'tiles', (c) => {
    F2(c, P.grass); speckle(c, 0, 8, P.grassDk, P.grassLt, 11);
    // tufts
    [[14, 30], [32, 16], [36, 38]].forEach(([x, y]) => {
      c.strokeStyle = P.grassDk; c.lineWidth = 1.6; c.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + k * 3, y - 5); c.stroke(); }
    });
  });
  SF.reg('tile_dirt', 48, 48, 'tiles', (c) => { F2(c, P.dirt); speckle(c, 0, 12, P.dirtDk, P.dirtLt, 5); });
  SF.reg('tile_sand', 48, 48, 'tiles', (c) => { F2(c, P.sand); speckle(c, 0, 9, P.sandDk, P.dirtLt, 8); });
  SF.reg('tile_mud', 48, 48, 'tiles', (c) => {
    F2(c, P.mud); speckle(c, 0, 8, P.mudDk, P.dirt, 6);
    [[16, 18], [30, 32]].forEach(([x, y]) => { ellipse(c, x, y, 6, 4); F(c, P.mudDk); });
  });
  SF.reg('tile_water', 48, 48, 'tiles', (c) => {
    F2(c, P.water);
    c.strokeStyle = P.waterLt; c.lineWidth = 2; c.lineCap = 'round';
    [[8, 14], [26, 30], [14, 38]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - 4, x + 12, y); c.stroke(); });
  });
  SF.reg('tile_road', 48, 48, 'tiles', (c) => {
    F2(c, P.stoneDk); speckle(c, 0, 6, P.stone, P.gunDk, 2);
    c.strokeStyle = P.sand; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(24, 0); c.lineTo(24, 48); c.stroke(); c.setLineDash([]);
  });

  // build plot + blocked overlay (semi-transparent grids)
  SF.reg('tile_build', 48, 48, 'tiles', (c) => {
    c.globalAlpha = 0.9; rrect(c, 3, 3, 42, 42, 6); F(c, 'rgba(120,200,90,0.18)');
    c.lineWidth = 2; c.strokeStyle = 'rgba(120,200,90,0.85)'; c.setLineDash([6, 4]); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1;
  });
  SF.reg('tile_blocked', 48, 48, 'tiles', (c) => {
    rrect(c, 3, 3, 42, 42, 6); F(c, 'rgba(232,65,58,0.16)');
    c.lineWidth = 2; c.strokeStyle = 'rgba(232,65,58,0.8)'; c.stroke();
    c.beginPath(); c.moveTo(10, 10); c.lineTo(38, 38); c.moveTo(38, 10); c.lineTo(10, 38); c.stroke();
  });

  function F2(c, col) { c.fillStyle = col; c.fillRect(0, 0, 48, 48); }

  /* ---- mask-driven dirt lane ------------------------------------- */
  // m = {n,e,s,w} booleans; grass background + dirt arms + centre.
  function pathTile(c, m) {
    F2(c, P.grass); speckle(c, 0, 7, P.grassDk, P.grassLt, 9);
    const half = 24, band = 15;
    c.fillStyle = P.dirt;
    // centre block
    rrect(c, half - band, half - band, band * 2, band * 2, 5); c.fill();
    // arms
    if (m.n) { rrect(c, half - band, -2, band * 2, half + 2, 5); c.fill(); }
    if (m.s) { rrect(c, half - band, half, band * 2, half + 2, 5); c.fill(); }
    if (m.w) { rrect(c, -2, half - band, half + 2, band * 2, 5); c.fill(); }
    if (m.e) { rrect(c, half, half - band, half + 2, band * 2, 5); c.fill(); }
    // darker ruts + edge speckle
    c.fillStyle = P.dirtDk;
    const sd = (x, y) => { circle(c, x, y, 1.6); c.fill(); };
    sd(18, 20); sd(30, 28); sd(24, 24); sd(20, 32); sd(32, 18);
    // wheel ruts along straight arms
    c.strokeStyle = P.dirtDk; c.lineWidth = 2; c.lineCap = 'round';
    if (m.w || m.e) { [20, 28].forEach(y => { c.beginPath(); c.moveTo(m.w ? 0 : half - band, y); c.lineTo(m.e ? 48 : half + band, y); c.stroke(); }); }
    if (m.n || m.s) { [20, 28].forEach(x => { c.beginPath(); c.moveTo(x, m.n ? 0 : half - band); c.lineTo(x, m.s ? 48 : half + band); c.stroke(); }); }
  }
  const PT = (key, m) => SF.reg('path_' + key, 48, 48, 'tiles', (c) => pathTile(c, m));
  PT('h', { e: 1, w: 1 });
  PT('v', { n: 1, s: 1 });
  PT('ne', { n: 1, e: 1 });
  PT('nw', { n: 1, w: 1 });
  PT('se', { s: 1, e: 1 });
  PT('sw', { s: 1, w: 1 });
  PT('t_up', { n: 1, e: 1, w: 1 });
  PT('t_down', { s: 1, e: 1, w: 1 });
  PT('t_left', { n: 1, s: 1, w: 1 });
  PT('t_right', { n: 1, s: 1, e: 1 });
  PT('cross', { n: 1, e: 1, s: 1, w: 1 });
  PT('end_n', { s: 1 });
  PT('end_s', { n: 1 });
  PT('end_e', { w: 1 });
  PT('end_w', { e: 1 });

  /* ---- decorations (transparent) --------------------------------- */
  SF.reg('deco_tree', 48, 48, 'deco', (c) => {
    shadow(c, 26, 36, 13, 6);
    circle(c, 24, 22, 15); fo(c, P.grassDk, 2.4);
    circle(c, 18, 18, 8); F(c, P.grass); circle(c, 30, 24, 7); F(c, P.grassLt);
    circle(c, 24, 22, 3.4); F(c, P.woodDk);
  });
  SF.reg('deco_bush', 48, 48, 'deco', (c) => {
    shadow(c, 24, 34, 11, 5);
    circle(c, 18, 28, 8); fo(c, P.grassDk, 2.2);
    circle(c, 30, 28, 9); fo(c, P.grass, 2.2);
    circle(c, 24, 22, 8); fo(c, P.grassLt, 2.2);
  });
  SF.reg('deco_rock', 48, 48, 'deco', (c) => {
    shadow(c, 24, 32, 13, 6);
    poly(c, [[10, 30], [16, 16], [30, 14], [40, 26], [34, 34], [16, 34]]); fo(c, P.stone, 2.4);
    poly(c, [[16, 28], [22, 20], [30, 22]]); F(c, P.stoneDk);
  });
  SF.reg('deco_sandbag', 48, 48, 'deco', (c) => {
    shadow(c, 24, 30, 18, 6);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
      const x = 8 + i * 9 + (row ? 4 : 0), y = 18 + row * 8;
      ellipse(c, x, y, 5.5, 4.2); fo(c, (i + row) % 2 ? P.sand : P.sandDk, 1.8);
    }
  });
  SF.reg('deco_barbedwire', 48, 48, 'deco', (c) => {
    c.strokeStyle = P.steelDk; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, 30); c.lineTo(44, 30); c.stroke();
    poly(c, [[10, 30], [16, 14], [22, 30]]); ol(c, 2); poly(c, [[26, 30], [32, 14], [38, 30]]); ol(c, 2);
    for (let x = 8; x < 44; x += 6) { c.beginPath(); c.moveTo(x, 28); c.lineTo(x + 3, 24); c.moveTo(x, 28); c.lineTo(x - 1, 24); c.stroke(); }
  });
  SF.reg('deco_hedgehog', 48, 48, 'deco', (c) => { // czech hedgehog / tank trap
    shadow(c, 24, 30, 14, 6);
    c.strokeStyle = P.steel; c.lineWidth = 4.5; c.lineCap = 'round';
    [[8, 12, 40, 36], [40, 12, 8, 36], [24, 8, 24, 40]].forEach(([x1, y1, x2, y2]) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); });
    c.strokeStyle = P.steelDk; c.lineWidth = 2;
    [[8, 12, 40, 36], [40, 12, 8, 36]].forEach(([x1, y1, x2, y2]) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); });
  });
  SF.reg('deco_barrel', 48, 48, 'deco', (c) => {
    shadow(c, 24, 32, 10, 5);
    rrect(c, 15, 12, 18, 22, 4); fo(c, P.red, 2.4);
    rrect(c, 15, 18, 18, 3, 1); F(c, P.redDk); rrect(c, 15, 26, 18, 3, 1); F(c, P.redDk);
    ellipse(c, 24, 13, 9, 3.5); fo(c, P.gunDk, 1.8);
  });
  SF.reg('deco_crate', 48, 48, 'deco', (c) => {
    shadow(c, 24, 33, 12, 5);
    rrect(c, 12, 14, 24, 22, 3); fo(c, P.wood, 2.4);
    c.strokeStyle = P.woodDk; c.lineWidth = 2;
    c.strokeRect(12, 14, 24, 22); c.beginPath(); c.moveTo(12, 14); c.lineTo(36, 36); c.moveTo(36, 14); c.lineTo(12, 36); c.stroke();
  });
  SF.reg('deco_crater', 48, 48, 'deco', (c) => {
    ellipse(c, 24, 24, 18, 16); F(c, P.dirtDk);
    ellipse(c, 24, 24, 18, 16); ol(c, 2);
    ellipse(c, 24, 25, 11, 9); F(c, P.mudDk);
    c.globalAlpha = 0.5; ellipse(c, 24, 26, 6, 4); F(c, P.ink); c.globalAlpha = 1;
  });
})();
