/* =====================================================================
   WARZONE — Sprite Forge :: TOWERS (defenses)
   v2 art pass — cleaner silhouettes, beveled pads, readable at 48px.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow, bevel, domeHi, sandbags } = SF.h;

  function padSandbag(ctx, T) {
    shadow(ctx, 24, 27, 20, 18);
    circle(ctx, 24, 25, 19); fo(ctx, P.dirt, 2);
    circle(ctx, 24, 25, 11); fo(ctx, P.dirtDk, 1.6);
    sandbags(ctx, 24, 25, 17, 10);
    circle(ctx, 24, 25, 10); ctx.lineWidth = 2.4; ctx.strokeStyle = T.main; ctx.stroke();
    circle(ctx, 24, 25, 4); fo(ctx, T.dk, 1.2);
  }

  function padConcrete(ctx, T) {
    shadow(ctx, 24, 28, 19, 17);
    rrect(ctx, 5, 7, 38, 34, 8); fo(ctx, P.stoneDk, 2.4);
    rrect(ctx, 9, 11, 30, 26, 6); fo(ctx, P.stone, 2);
    bevel(ctx, 9, 11, 30, 26, 'rgba(255,255,255,0.14)');
    rrect(ctx, 9, 11, 30, 26, 6); ctx.lineWidth = 2.2; ctx.strokeStyle = T.main; ctx.stroke();
    [[13, 15], [35, 15], [13, 33], [35, 33]].forEach(([x, y]) => {
      circle(ctx, x, y, 2.6); fo(ctx, T.lt, 1.2);
    });
  }

  function padEarth(ctx, T) {
    shadow(ctx, 24, 27, 18, 16);
    ellipse(ctx, 24, 26, 18, 16); fo(ctx, P.dirtDk, 2.2);
    ellipse(ctx, 24, 27, 11, 9); fo(ctx, P.mud, 1.6);
    sandbags(ctx, 24, 24, 14, 7);
    rrect(ctx, 20, 22, 8, 8, 3); fo(ctx, P.inkSoft, 1.4);
  }

  function padWood(ctx, T) {
    shadow(ctx, 24, 28, 19, 16);
    rrect(ctx, 6, 10, 36, 30, 6); fo(ctx, P.woodDk, 2.4);
    rrect(ctx, 8, 12, 32, 26, 4); fo(ctx, P.wood, 2);
    ctx.strokeStyle = P.woodDk; ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(8, 14 + i * 6); ctx.lineTo(40, 14 + i * 6); ctx.stroke();
    }
    rrect(ctx, 10, 12, 8, 8, 2); fo(ctx, T.main, 1.4);
    bevel(ctx, 8, 12, 32, 26, 'rgba(255,255,255,0.1)');
  }

  function barrel(ctx, x0, len, w, color, hi) {
    rrect(ctx, x0, 24 - w / 2, len, w, w / 2); fo(ctx, color, 2);
    rrect(ctx, x0 + 1, 24 - w / 2 + 1, len * 0.65, w * 0.28, 1); ctx.fillStyle = hi || P.gunLt; ctx.fill();
  }

  function turretBody(ctx, r, color, T) {
    circle(ctx, 24, 24, r); fo(ctx, color, 2.4);
    domeHi(ctx, 24, 24, r, 'rgba(255,255,255,0.16)');
    ctx.save(); circle(ctx, 24, 24, r); ctx.clip();
    rrect(ctx, 24 - r + 1, 24 - 2, r - 1, 4, 1); ctx.fillStyle = T.main; ctx.fill();
    ctx.restore();
    circle(ctx, 24, 24, 2.2); fo(ctx, T.lt, 1);
  }

  function muzzle(ctx, x, w) {
    w = w || 5;
    rrect(ctx, x, 24 - w / 2, 4, w, 1.5); fo(ctx, P.ink, 1.6);
  }

  function gunner(ctx, T, opts) {
    opts = opts || {};
    const cx = opts.cx || 18, cy = opts.cy || 24;
    ellipse(ctx, cx, cy + 5, 7, 5); fo(ctx, P.fieldDk, 2);
    ellipse(ctx, cx, cy - 1, 8, 7); fo(ctx, opts.body || P.field, 2.2);
    domeHi(ctx, cx + 1, cy - 2, 5, 'rgba(255,255,255,0.14)');
    rrect(ctx, cx - 5, cy, 10, 2.6, 1); ctx.fillStyle = T.main; ctx.fill();
    if (opts.weapon !== false) {
      barrel(ctx, cx + 4, opts.len || 16, opts.w || 3, P.gunDk, P.gun);
      muzzle(ctx, cx + 4 + (opts.len || 16) - 2, opts.w || 3);
    }
  }

  SF.tower('rifle', (c, w, h, H, T) => padEarth(c, T), (c, w, h, H, T) => {
    gunner(c, T, { cx: 17, len: 18, w: 2.8 });
  });

  SF.tower('mg', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    rrect(c, 10, 16, 11, 16, 3); fo(c, P.steelDk, 2);
    bevel(c, 10, 16, 11, 16, P.steelLt);
    turretBody(c, 9, P.steel, T);
    barrel(c, 31, 13, 3.2, P.gun, P.gunLt);
    barrel(c, 31, 13, 3.2, P.gunDk, P.gun);
    rrect(c, 31, 20.5, 13, 3.2, 1.4); fo(c, P.gun, 1.8);
    rrect(c, 31, 24.3, 13, 3.2, 1.4); fo(c, P.gunDk, 1.8);
    muzzle(c, 43, 3.2);
  });

  SF.tower('mortar', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    turretBody(c, 8, P.steelDk, T);
    rrect(c, 22, 18, 20, 12, 5); fo(c, P.steel, 2.4);
    bevel(c, 22, 18, 20, 12, P.steelLt);
    circle(c, 41, 24, 6); fo(c, P.gunDk, 2);
    circle(c, 41, 24, 2.5); c.fillStyle = P.ink; c.fill();
  });

  SF.tower('cannon', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    [[15, 11], [15, 37]].forEach(([x, y]) => {
      circle(c, x, y, 6.5); fo(c, P.gunDk, 2);
      circle(c, x, y, 2.4); fo(c, T.main, 1.2);
    });
    rrect(c, 12, 18, 8, 12, 3); fo(c, P.steelDk, 2);
    turretBody(c, 7.5, P.steel, T);
    barrel(c, 29, 19, 6.5, P.gun, P.gunLt);
    muzzle(c, 47, 6.5);
  });

  SF.tower('at', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    rrect(c, 16, 11, 8, 26, 3); fo(c, P.steel, 2.4);
    bevel(c, 16, 11, 8, 26, P.steelLt);
    rrect(c, 18, 16, 3, 16, 1); c.fillStyle = T.main; c.fill();
    turretBody(c, 6.5, P.steelDk, T);
    barrel(c, 26, 22, 3.2, P.gun, P.gunLt);
    muzzle(c, 47, 3.2);
  });

  SF.tower('flak', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    turretBody(c, 8.5, P.steel, T);
    [-5, -1.5, 2, 5.5].forEach(o => {
      rrect(c, 29, 24 + o - 1.2, 12, 2.4, 1.1); fo(c, P.gun, 1.5);
      rrect(c, 40, 24 + o - 1.2, 3, 2.4, 1); fo(c, P.inkSoft, 1.2);
    });
    circle(c, 24, 24, 2.8); fo(c, T.lt, 1.2);
  });

  SF.tower('howitzer', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    turretBody(c, 9.5, P.steelDk, T);
    rrect(c, 20, 18, 14, 12, 4); fo(c, P.steel, 2.2);
    bevel(c, 20, 18, 14, 12, P.steelLt);
    barrel(c, 30, 17, 8, P.gun, P.gunLt);
    muzzle(c, 46, 8);
  });

  SF.tower('sniper', (c, w, h, H, T) => padWood(c, T), (c, w, h, H, T) => {
    rrect(c, 8, 14, 6, 20, 2); fo(c, P.woodDk, 1.8);
    gunner(c, T, { cx: 16, len: 24, w: 2.4 });
    rrect(c, 20, 20, 6, 7, 2); fo(c, T.main, 1.4);
    circle(c, 23, 23, 2); fo(c, P.ink, 1);
  });

  SF.tower('flame', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    rrect(c, 10, 14, 10, 20, 4); fo(c, P.redDk, 2.2);
    rrect(c, 12, 16, 6, 16, 2); fo(c, P.red, 1.6);
    bevel(c, 12, 16, 6, 16, 'rgba(255,255,255,0.12)');
    turretBody(c, 7, P.steelDk, T);
    barrel(c, 27, 15, 4.5, P.gun, P.gunLt);
    ellipse(c, 44, 24, 4, 5); fo(c, P.orange, 1.6);
    ellipse(c, 44, 24, 2, 2.8); c.fillStyle = P.yellow; c.fill();
  });

  SF.tower('rocket', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    rrect(c, 10, 12, 14, 24, 4); fo(c, P.steelDk, 2.2);
    rrect(c, 12, 14, 6, 6, 2); fo(c, T.main, 1.4);
    [-6, -2, 2, 6].forEach(o => {
      rrect(c, 22, 24 + o - 1.5, 21, 3, 1.4); fo(c, P.gun, 1.6);
      circle(c, 42, 24 + o, 2); fo(c, P.orangeLt, 1);
    });
  });

  SF.tower('bazooka', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    gunner(c, T, { cx: 17, cy: 26, weapon: false });
    rrect(c, 14, 18, 26, 7, 3.5); fo(c, P.steel, 2.2);
    rrect(c, 14, 18, 7, 7, 2); fo(c, T.main, 1.4);
    circle(c, 39, 21, 4); fo(c, P.gunDk, 1.8);
  });

  SF.tower('command', (c, w, h, H, T) => {
    shadow(c, 24, 28, 20, 17);
    rrect(c, 6, 10, 36, 30, 7); fo(c, P.stoneDk, 2.4);
    rrect(c, 11, 15, 26, 20, 5); fo(c, P.stone, 2);
    bevel(c, 11, 15, 26, 20, 'rgba(255,255,255,0.1)');
    rrect(c, 14, 20, 20, 4, 2); fo(c, P.ink, 1.4);
    rrect(c, 32, 8, 2, 16, 1); fo(c, P.woodDk, 1.2);
    poly(c, [[34, 8], [44, 11], [34, 16]]); fo(c, T.main, 1.6);
    circle(c, 38, 12, 2); fo(c, T.lt, 1);
  }, (c, w, h, H, T) => {
    circle(c, 24, 24, 5); fo(c, P.steelDk, 2);
    poly(c, [[27, 15], [41, 19], [41, 29], [27, 33]]); fo(c, P.steelLt, 2);
    rrect(c, 24, 22.5, 15, 3, 1); fo(c, P.gun, 1.4);
    circle(c, 24, 24, 2); fo(c, T.lt, 1);
  });
})();
