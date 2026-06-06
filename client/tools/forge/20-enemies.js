/* =====================================================================
   WARZONE — Sprite Forge :: ENEMIES / UNITS
   v2 art pass — clearer infantry silhouettes, chunkier vehicles.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow, domeHi } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };

  function soldier(c, i, frames, T, opt) {
    opt = opt || {};
    const cx = 24, cy = 26;
    const sw = Math.sin((i / frames) * Math.PI * 2);
    shadow(c, cx + 2, cy + 10, 10, 4);

    // legs + boots (stride along x — movement is east)
    [[-1, 0], [1, 0]].forEach(([s, lag], idx) => {
      const off = s * sw * 5;
      rrect(c, cx - 1 + off + idx * 0.5, cy + 5, 8, 4, 2);
      fo(c, P.fieldDk, 1.6);
      rrect(c, cx + 4 + off, cy + 7, 4, 2.5, 1);
      fo(c, P.inkSoft, 1.2);
    });

    // torso
    rrect(c, cx - 7, cy - 4, 14, 11, 4);
    fo(c, opt.body || P.field, 2.2);
    rrect(c, cx - 6, cy - 1, 12, 3, 1.5);
    F(c, T.main);

    if (opt.pack) {
      rrect(c, cx - 10, cy - 3, 5, 9, 2);
      fo(c, opt.pack, 1.8);
    }

    // helmet
    circle(c, cx + 2, cy - 5, 5.5);
    fo(c, opt.helmet || P.fieldDk, 2);
    domeHi(c, cx + 2, cy - 5, 5.5, 'rgba(255,255,255,0.15)');

    if (opt.cross) {
      rrect(c, cx + 0.5, cy - 6, 3.5, 1.4, 0.4);
      F(c, P.red);
      rrect(c, cx + 1.8, cy - 7.5, 1.4, 4.2, 0.4);
      F(c, P.red);
    }
    if (opt.markCap) {
      rrect(c, cx - 1, cy - 8, 7, 2.5, 1);
      fo(c, P.gunDk, 1.2);
      circle(c, cx + 2, cy - 5, 2); fo(c, T.lt, 1);
    }

    if (opt.weapon !== false) {
      barrel(c, cx + 5, opt.wLen || 15, opt.wW || 2.8);
    }
    if (opt.extra) opt.extra(c, cx, cy);
  }

  function barrel(c, x0, len, w) {
    rrect(c, x0, 24 - w / 2, len, w, 1.2);
    fo(c, P.gunDk, 1.5);
    rrect(c, x0 + 1, 24 - w / 2 + 0.5, len * 0.55, w * 0.35, 0.8);
    F(c, P.gun);
  }

  function infantry(key, opt) {
    SF.animTeam('unit_' + key, 48, 48, 4, 'units', (c, i, frames, w, h, H, T) =>
      soldier(c, i, frames, T, opt));
  }

  infantry('infantry', { pack: P.woodDk });
  infantry('officer', {
    body: P.gunDk, helmet: P.gun, markCap: true, wLen: 10, pack: null,
    extra: (c, x, y) => { rrect(c, x - 8, y + 4, 7, 10, 2); fo(c, P.gunDk, 1.6); },
  });
  infantry('medic', { body: P.cream, helmet: P.white, cross: true, pack: P.red, weapon: false });
  infantry('engineer', {
    body: P.amber, helmet: P.fieldDk, pack: P.steelDk,
    extra: (c, x, y) => {
      rrect(c, x + 5, y + 2, 9, 6, 2); fo(c, P.steel, 1.6);
      SF.h.bevel(c, x + 5, y + 2, 9, 6, P.steelLt);
    },
  });
  infantry('scout', {
    body: P.olive, helmet: P.oliveDk, wLen: 11,
    extra: (c, x, y) => { rrect(c, x, y - 8, 6, 3, 1); fo(c, P.gunDk, 1.2); },
  });
  infantry('heavy', { body: P.gunDk, helmet: P.gun, pack: P.steelDk, wLen: 18, wW: 3.2 });
  infantry('grenadier', {
    body: P.field, helmet: P.fieldDk, pack: P.red,
    extra: (c, x, y) => { circle(c, x + 10, y + 3, 2.8); fo(c, P.gunDk, 1.4); },
  });

  function track(c, x, y, w, h) {
    rrect(c, x, y, w, h, 2.5); fo(c, P.gunDk, 2);
    c.strokeStyle = P.ink; c.lineWidth = 1;
    for (let t = y + 2.5; t < y + h - 2; t += 3) {
      c.beginPath(); c.moveTo(x + 2, t); c.lineTo(x + w - 2, t); c.stroke();
    }
  }

  function hull(c, x, y, w, h, col, T) {
    rrect(c, x, y, w, h, 5); fo(c, col, 2.4);
    rrect(c, x + 2, y + 3, w - 4, 5, 2); F(c, T.main);
    SF.h.bevel(c, x, y, w, h, 'rgba(255,255,255,0.1)');
  }

  function turret(c, cx, cy, r, col, T, barLen) {
    circle(c, cx, cy, r); fo(c, col, 2.4);
    domeHi(c, cx, cy, r, 'rgba(255,255,255,0.12)');
    circle(c, cx - 1, cy - 1, r * 0.35); F(c, T.lt);
    barrel(c, cx + r - 1, barLen, 4.5);
  }

  SF.regTeam('unit_lighttank', 48, 48, 'units', (c, w, h, H, T) => {
    shadow(c, 22, 27, 18, 12);
    track(c, 7, 8, 32, 7); track(c, 7, 33, 32, 7);
    hull(c, 10, 14, 28, 20, P.field, T);
    turret(c, 22, 24, 8, P.fieldDk, T, 14);
  });

  SF.regTeam('unit_mediumtank', 56, 56, 'units', (c, w, h, H, T) => {
    shadow(c, 26, 32, 22, 14);
    track(c, 7, 9, 40, 9); track(c, 7, 38, 40, 9);
    hull(c, 11, 15, 36, 26, P.field, T);
    turret(c, 26, 28, 10, P.fieldDk, T, 18);
  });

  SF.regTeam('unit_heavytank', 64, 64, 'units', (c, w, h, H, T) => {
    shadow(c, 30, 37, 26, 16);
    track(c, 7, 10, 48, 11); track(c, 7, 43, 48, 11);
    hull(c, 11, 16, 46, 32, P.fieldDk, T);
    turret(c, 30, 32, 13, P.gunDk, T, 22);
  });

  SF.regTeam('unit_halftrack', 56, 48, 'units', (c, w, h, H, T) => {
    shadow(c, 28, 27, 23, 11);
    circle(c, 13, 11, 5.5); fo(c, P.gunDk, 2);
    circle(c, 13, 37, 5.5); fo(c, P.gunDk, 2);
    track(c, 22, 8, 28, 7); track(c, 22, 33, 28, 7);
    hull(c, 9, 13, 42, 22, P.field, T);
    rrect(c, 32, 15, 16, 18, 4); fo(c, P.fieldDk, 2);
    rrect(c, 34, 17, 12, 4, 1); F(c, T.main);
  });

  SF.regTeam('unit_armoredcar', 52, 44, 'units', (c, w, h, H, T) => {
    shadow(c, 26, 25, 21, 10);
    [[11, 9], [41, 9], [11, 35], [41, 35]].forEach(([x, y]) => {
      circle(c, x, y, 5.5); fo(c, P.gunDk, 2);
      circle(c, x, y, 2); fo(c, P.gun, 1);
    });
    hull(c, 8, 12, 38, 20, P.gun, T);
    turret(c, 24, 22, 7, P.gunDk, T, 13);
  });

  SF.regTeam('unit_motorcycle', 48, 40, 'units', (c, w, h, H, T) => {
    shadow(c, 24, 24, 17, 8);
    circle(c, 11, 15, 6.5); fo(c, P.gunDk, 2);
    circle(c, 37, 15, 6.5); fo(c, P.gunDk, 2);
    rrect(c, 11, 12, 26, 6, 3); fo(c, P.field, 2);
    ellipse(c, 21, 14, 5, 4); fo(c, P.fieldDk, 1.8);
    rrect(c, 15, 22, 20, 10, 4); fo(c, P.gunDk, 2);
    rrect(c, 17, 24, 8, 3, 1); F(c, T.main);
  });

  SF.regTeam('unit_arttruck', 60, 44, 'units', (c, w, h, H, T) => {
    shadow(c, 30, 25, 25, 10);
    [[13, 8], [13, 34], [28, 8], [28, 34]].forEach(([x, y]) => {
      circle(c, x, y, 4.5); fo(c, P.gunDk, 1.8);
    });
    hull(c, 7, 11, 34, 22, P.olive, T);
    rrect(c, 28, 13, 12, 18, 3); fo(c, P.oliveDk, 2);
    rrect(c, 30, 16, 4, 6, 1); F(c, P.cream);
    circle(c, 47, 14, 4); fo(c, P.gunDk, 1.6);
    circle(c, 47, 28, 4); fo(c, P.gunDk, 1.6);
    rrect(c, 41, 19, 18, 4, 2); fo(c, P.steel, 2);
  });

  SF.regTeam('unit_boss', 88, 88, 'units', (c, w, h, H, T) => {
    shadow(c, 42, 52, 38, 22);
    track(c, 6, 12, 74, 15); track(c, 6, 61, 74, 15);
    hull(c, 10, 22, 68, 42, P.gunDk, T);
    rrect(c, 10, 22, 68, 8, 4); F(c, T.main);
    circle(c, 40, 44, 19); fo(c, P.fieldDk, 3);
    domeHi(c, 40, 44, 19, 'rgba(255,255,255,0.1)');
    rrect(c, 28, 38, 10, 12, 2); F(c, T.lt);
    rrect(c, 56, 40, 32, 9, 3); fo(c, P.gun, 2.6);
    rrect(c, 86, 37, 6, 15, 2); fo(c, P.gunDk, 2);
    circle(c, 40, 44, 5.5); fo(c, P.gun, 1.8);
  });
})();
