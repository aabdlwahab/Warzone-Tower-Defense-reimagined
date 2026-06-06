/* =====================================================================
   WARZONE — Sprite Forge :: BASES (player HQ)
   v2 art pass — cleaner compound, stronger team identity.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow, bevel, sandbags, domeHi } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };

  function watchtower(c, x, y, T) {
    rrect(c, x - 6, y - 2, 12, 14, 3); fo(c, P.stoneDk, 2);
    rrect(c, x - 4, y, 8, 8, 2); fo(c, P.stone, 1.6);
    circle(c, x, y + 1, 2.2); fo(c, T.main, 1.2);
    rrect(c, x - 5, y - 6, 10, 5, 2); fo(c, P.stoneDk, 1.6);
  }

  function star(c, cx, cy, ro, ri, col) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); F(c, col);
  }

  function baseHQ(c, T, damaged) {
    const cx = 48, cy = 48;
    shadow(c, cx, cy + 8, 42, 38);

    rrect(c, 4, 8, 88, 80, 16); fo(c, P.dirtDk, 2.6);
    rrect(c, 12, 16, 72, 64, 12); fo(c, P.sand, 2);
    rrect(c, 18, 22, 60, 52, 10); fo(c, P.stoneDk, 2.4);
    rrect(c, 18, 22, 60, 52, 10); c.lineWidth = 3; c.strokeStyle = T.dk; c.stroke();

    sandbags(c, 48, 48, 38, 16);

    watchtower(c, 20, 24, T);
    watchtower(c, 76, 24, T);
    watchtower(c, 20, 72, T);
    watchtower(c, 76, 72, T);

    // command bunker
    rrect(c, 32, 34, 32, 28, 7); fo(c, P.stone, 2.6);
    rrect(c, 32, 34, 32, 10, 7); F(c, T.main);
    bevel(c, 32, 34, 32, 28, 'rgba(255,255,255,0.12)');
    rrect(c, 36, 40, 8, 6, 1); fo(c, P.cream, 1.2);
    rrect(c, 52, 40, 8, 6, 1); fo(c, P.cream, 1.2);
    rrect(c, 40, 52, 16, 6, 2); fo(c, P.inkSoft, 1.6);

    circle(c, 48, 50, 10); fo(c, T.dk, 2.2);
    circle(c, 48, 50, 10); c.lineWidth = 2; c.strokeStyle = T.lt; c.stroke();
    star(c, 48, 50, 7, 3.2, T.lt);

    rrect(c, 42, 78, 12, 6, 2); fo(c, P.gunDk, 2);

    rrect(c, 68, 26, 2.4, 22, 1); fo(c, P.woodDk, 1.4);
    poly(c, [[70, 26], [84, 30], [70, 36]]); fo(c, T.main, 1.8);
    star(c, 75, 30, 3.5, 1.6, T.lt);

    rrect(c, 22, 28, 2, 16, 1); fo(c, P.steelDk, 1.2);
    circle(c, 23, 27, 2.5); fo(c, P.red, 1.4);

    if (damaged) {
      c.globalAlpha = 0.6;
      [[30, 36, 9], [62, 58, 8], [44, 68, 6]].forEach(([x, y, r]) => {
        circle(c, x, y, r); F(c, P.ink);
      });
      c.globalAlpha = 1;
      poly(c, [[76, 72], [90, 82], [78, 88], [68, 82]]); F(c, P.dirtDk);
      circle(c, 78, 78, 7); F(c, P.ink); circle(c, 78, 78, 7); ol(c, 1.4);
      c.globalAlpha = 0.45;
      circle(c, 64, 32, 8); F(c, P.smokeDk);
      circle(c, 68, 26, 6); F(c, P.smoke);
      c.globalAlpha = 1;
    }
  }

  SF.regTeam('base_hq', 96, 96, 'bases', (c, w, h, H, T) => baseHQ(c, T, false));
  SF.regTeam('base_hq_damaged', 96, 96, 'bases', (c, w, h, H, T) => baseHQ(c, T, true));

  SF.regTeam('base_flag', 32, 32, 'bases', (c, w, h, H, T) => {
    shadow(c, 16, 28, 8, 3);
    rrect(c, 14, 6, 3, 22, 1.2); fo(c, P.woodDk, 1.4);
    rrect(c, 14, 26, 5, 3, 1); fo(c, P.wood, 1.2);
    poly(c, [[17, 7], [28, 11], [17, 17]]); fo(c, T.main, 1.8);
    star(c, 21, 11, 3.2, 1.4, T.lt);
  });
})();
