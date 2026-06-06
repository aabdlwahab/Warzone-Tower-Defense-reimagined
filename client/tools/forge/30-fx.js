/* =====================================================================
   WARZONE — Sprite Forge :: PROJECTILES & FX
   Neutral (not team-tinted). Projectiles point EAST. Animations are
   baked as horizontal spritesheet rows + an atlas entry.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };
  const A = (c, a) => { c.globalAlpha = a; };

  /* ---- projectiles (static) -------------------------------------- */
  SF.reg('proj_bullet', 14, 14, 'fx', (c) => {
    rrect(c, 3, 5, 8, 4, 2); fo(c, P.yellow, 1.6);
    rrect(c, 9, 5, 3, 4, 1.5); F(c, P.amber);
  });
  SF.reg('proj_tracer', 20, 10, 'fx', (c) => {
    A(c, 0.85); rrect(c, 1, 4, 12, 2, 1); F(c, P.orangeLt); A(c, 1);
    rrect(c, 12, 3, 7, 4, 2); fo(c, P.yellow, 1.4);
  });
  SF.reg('proj_shell', 18, 18, 'fx', (c) => {
    poly(c, [[4, 6], [12, 6], [16, 9], [12, 12], [4, 12]]); fo(c, P.steelLt, 1.8);
    rrect(c, 3, 6, 4, 6, 1.5); F(c, P.amber);
  });
  SF.reg('proj_mortar', 16, 16, 'fx', (c) => {
    ellipse(c, 8, 8, 4.5, 5.5); fo(c, P.gunDk, 1.8);
    poly(c, [[8, 1.5], [10.5, 4], [5.5, 4]]); F(c, P.gun);   // fins
    rrect(c, 6.5, 11, 3, 4, 1); F(c, P.steelLt);
  });
  SF.reg('proj_rocket', 26, 14, 'fx', (c) => {
    rrect(c, 2, 5, 16, 4, 2); fo(c, P.steel, 1.8);
    poly(c, [[18, 4], [24, 7], [18, 10]]); fo(c, P.red, 1.6);  // nose east
    poly(c, [[2, 3], [6, 5], [2, 6]]); F(c, P.gunDk);          // fin
    poly(c, [[2, 11], [6, 9], [2, 8]]); F(c, P.gunDk);
    A(c, 0.8); ellipse(c, 1, 7, 3, 2.4); F(c, P.orange); A(c, 1);
  });
  SF.reg('proj_flame', 16, 16, 'fx', (c) => {
    ellipse(c, 8, 8, 6, 5); F(c, P.orange);
    ellipse(c, 8, 8, 3.5, 3); F(c, P.yellow);
    ellipse(c, 9, 8, 1.6, 1.4); F(c, P.white);
  });

  /* ---- explosion (7 frames) -------------------------------------- */
  SF.anim('fx_explosion', 64, 64, 7, 'fx', (c, i, n) => {
    const t = i / (n - 1);
    const cx = 32, cy = 32;
    // outer smoke
    if (t > 0.3) {
      A(c, 0.5 * (1 - t) + 0.15);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2, r = 10 + t * 20;
        circle(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7 - t * 3);
        F(c, P.smoke);
      }
      A(c, 1);
    }
    // fire ball
    const R = 6 + t * 22;
    A(c, 1 - t * 0.7);
    circle(c, cx, cy, R); F(c, t < 0.5 ? P.orange : P.redDk);
    circle(c, cx, cy, R * 0.62); F(c, P.orange);
    circle(c, cx, cy, R * 0.32); F(c, P.yellow);
    A(c, 1);
    // spark shards early
    if (t < 0.6) {
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, r = R + 4 + t * 10;
        circle(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4 - t * 1.5);
        F(c, P.yellow);
      }
    }
  });

  /* ---- big explosion (boss death, 8 frames) ---------------------- */
  SF.anim('fx_explosion_big', 96, 96, 8, 'fx', (c, i, n) => {
    const t = i / (n - 1), cx = 48, cy = 48;
    A(c, 0.55 * (1 - t) + 0.2);
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2, r = 14 + t * 32;
      circle(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 11 - t * 4); F(c, P.smokeDk);
    }
    A(c, 1);
    const R = 10 + t * 34; A(c, 1 - t * 0.65);
    circle(c, cx, cy, R); F(c, t < 0.5 ? P.orange : P.red);
    circle(c, cx, cy, R * 0.6); F(c, P.orange);
    circle(c, cx, cy, R * 0.3); F(c, P.yellow); A(c, 1);
  });

  /* ---- muzzle flash (4 frames, points EAST) ---------------------- */
  SF.anim('fx_muzzle', 32, 32, 4, 'fx', (c, i, n) => {
    const t = i / (n - 1), cx = 8, cy = 16, s = 1 - t * 0.5;
    A(c, 1 - t * 0.8);
    poly(c, [[cx, cy - 6 * s], [cx + 20 * s, cy], [cx, cy + 6 * s]]); F(c, P.yellow);
    poly(c, [[cx, cy - 3.5 * s], [cx + 13 * s, cy], [cx, cy + 3.5 * s]]); F(c, P.white);
    for (let k = -1; k <= 1; k += 2) {
      poly(c, [[cx, cy], [cx + 11 * s, cy + k * 7 * s], [cx + 5, cy + k * 2]]); F(c, P.orange);
    }
    A(c, 1);
  });

  /* ---- smoke puff (6 frames, rising) ----------------------------- */
  SF.anim('fx_smoke', 48, 48, 6, 'fx', (c, i, n) => {
    const t = i / (n - 1);
    A(c, 0.7 * (1 - t) + 0.1);
    const y = 34 - t * 22, r = 6 + t * 10;
    circle(c, 24, y, r); F(c, P.smoke);
    circle(c, 20, y + 3, r * 0.7); F(c, P.smokeDk);
    circle(c, 28, y + 2, r * 0.6); F(c, P.smoke);
    A(c, 1);
  });

  /* ---- impact spark (4 frames) ----------------------------------- */
  SF.anim('fx_impact', 24, 24, 4, 'fx', (c, i, n) => {
    const t = i / (n - 1); A(c, 1 - t);
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, r = 2 + t * 9;
      circle(c, 12 + Math.cos(a) * r, 12 + Math.sin(a) * r, 2.2 - t * 1.4); F(c, k % 2 ? P.yellow : P.orange);
    }
    A(c, 1);
  });

  /* ---- flame stream tip (5 frames, points EAST) ------------------ */
  SF.anim('fx_flame', 44, 32, 5, 'fx', (c, i, n) => {
    const t = i / n, w = 30 + Math.sin(t * Math.PI * 2) * 4;
    A(c, 0.92);
    ellipse(c, 6 + w / 2, 16, w / 2, 9); F(c, P.orange);
    ellipse(c, 6 + w / 2.4, 16, w / 2.6, 6); F(c, P.amber);
    ellipse(c, 6 + w / 3, 16, w / 4, 3.5); F(c, P.yellow);
    A(c, 1);
  });

  /* ---- vehicle dust puff (5 frames) ------------------------------ */
  SF.anim('fx_dust', 32, 32, 5, 'fx', (c, i, n) => {
    const t = i / (n - 1); A(c, 0.6 * (1 - t) + 0.08);
    const r = 4 + t * 8;
    circle(c, 16, 18 - t * 4, r); F(c, P.dirtLt);
    circle(c, 11, 20, r * 0.6); F(c, P.sand);
    A(c, 1);
  });
})();
