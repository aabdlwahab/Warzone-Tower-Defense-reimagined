/* =====================================================================
   WARZONE — Sprite Forge :: BASES (player HQ)
   One fortified HQ per player (team-tinted). Units march on it; defenses
   protect it. 96x96 footprint (spans several 48 tiles). Intact + damaged
   states, plus a small standalone team flag marker.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };

  function watchtower(c, x, y, T) {
    circle(c, x, y, 7); fo(c, P.stoneDk, 2.2);
    circle(c, x, y, 4.4); fo(c, P.stone, 1.8);
    circle(c, x, y, 2.2); F(c, T.main);
  }

  function baseHQ(c, T, damaged) {
    const cx = 48, cy = 48;
    shadow(c, cx, cy + 6, 44, 40);
    // outer dirt compound
    rrect(c, 4, 6, 88, 84, 14); fo(c, P.dirtDk, 2.6);
    // sandbag perimeter wall
    const ring = [];
    const n = 26;
    rrect(c, 10, 12, 76, 72, 12); fo(c, P.sand, 2.2);
    rrect(c, 16, 18, 64, 60, 9); fo(c, P.stoneDk, 2.2);   // inner yard
    rrect(c, 16, 18, 64, 60, 9); c.lineWidth = 3; c.strokeStyle = T.dk; c.stroke();

    // corner watchtowers
    watchtower(c, 18, 20, T); watchtower(c, 78, 20, T);
    watchtower(c, 18, 76, T); watchtower(c, 78, 76, T);

    // central command building
    rrect(c, 30, 32, 36, 34, 6); fo(c, P.stone, 2.6);
    rrect(c, 30, 32, 36, 12, 6); F(c, T.main);             // team roof band
    rrect(c, 30, 32, 36, 34, 6); ol(c, 2.6);
    // big team emblem
    circle(c, 48, 52, 9); fo(c, T.dk, 2.2);
    circle(c, 48, 52, 9); c.lineWidth = 2.4; c.strokeStyle = T.lt; c.stroke();
    // star emblem
    star(c, 48, 52, 6.5, 3, T.lt);

    // entrance / gate (south)
    rrect(c, 40, 80, 16, 8, 2); fo(c, P.gunDk, 2);

    // flag pole + flag (NE)
    rrect(c, 70, 24, 2.4, 20, 1); fo(c, P.woodDk, 1.4);
    poly(c, [[72, 24], [86, 28], [72, 33]]); fo(c, T.main, 1.8);

    // antenna (NW)
    rrect(c, 24, 26, 2, 14, 1); fo(c, P.steelDk, 1.2);
    circle(c, 25, 25, 2.2); F(c, P.red);

    if (damaged) {
      // scorch + craters + broken corner
      c.globalAlpha = 0.55;
      [[28, 30, 8], [64, 64, 9], [40, 70, 6]].forEach(([x, y, r]) => { circle(c, x, y, r); F(c, P.ink); });
      c.globalAlpha = 1;
      // cracked corner
      poly(c, [[78, 76], [92, 84], [80, 90], [70, 86]]); F(c, P.dirtDk);
      circle(c, 80, 80, 6); F(c, P.ink); circle(c, 80, 80, 6); ol(c, 1.4);
      // rubble bits
      [[34, 60], [58, 38], [50, 64]].forEach(([x, y]) => { rrect(c, x, y, 4, 4, 1); fo(c, P.stoneDk, 1.2); });
      // smoke marker
      c.globalAlpha = 0.5;
      circle(c, 66, 36, 7); F(c, P.smokeDk); circle(c, 70, 30, 5); F(c, P.smoke);
      c.globalAlpha = 1;
    }
  }

  function star(c, cx, cy, ro, ri, col) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); F(c, col);
  }

  SF.regTeam('base_hq', 96, 96, 'bases', (c, w, h, H, T) => baseHQ(c, T, false));
  SF.regTeam('base_hq_damaged', 96, 96, 'bases', (c, w, h, H, T) => baseHQ(c, T, true));

  // standalone team flag marker (small, for spawn points / lane labels)
  SF.regTeam('base_flag', 32, 32, 'bases', (c, w, h, H, T) => {
    shadow(c, 16, 28, 7, 3);
    rrect(c, 9, 4, 2.6, 24, 1.2); fo(c, P.woodDk, 1.4);
    poly(c, [[11, 5], [27, 9], [11, 15]]); fo(c, T.main, 1.8);
    star(c, 17, 10, 3, 1.4, T.lt);
  });
})();
