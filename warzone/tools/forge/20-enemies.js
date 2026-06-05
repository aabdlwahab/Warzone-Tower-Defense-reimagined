/* =====================================================================
   WARZONE — Sprite Forge :: ENEMIES / UNITS
   15 unit types, all team-tinted (p0 neutral = the AI wave foe; p1..p4
   = player-commanded variants). All face EAST (+x = movement / forward).
   Infantry are 4-frame walk cycles; vehicles are static (+ shared tread
   anim in the FX file).
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };

  /* ---- infantry builder ------------------------------------------
     cx is the body centre. legPhase animates the stride. */
  function soldier(c, i, frames, T, opt) {
    opt = opt || {};
    const cx = 24, cy = 25;
    const sw = Math.sin((i / frames) * Math.PI * 2);   // -1..1 stride
    shadow(c, cx, cy + 9, 9, 4);
    // legs (point east, swing along x)
    [[-1, 6], [1, -6]].forEach(([s, base]) => {
      const off = s * sw * 4;
      rrect(c, cx - 2 + off, cy + 4 + (base > 0 ? 0 : 0), 7, 4, 2);
      F(c, P.fieldDk); ol(c, 1.6);
    });
    // boots
    // body / shoulders
    ellipse(c, cx, cy, 8.5, 7); fo(c, opt.body || P.field, 2.2);
    // backpack
    if (opt.pack) { rrect(c, cx - 9, cy - 4, 6, 8, 2); fo(c, opt.pack, 1.8); }
    // team band across shoulders
    rrect(c, cx - 8.5, cy - 1.6, 17, 3.2, 1.4); F(c, T.main);
    // helmet
    circle(c, cx + 3, cy, 5.2); fo(c, opt.helmet || P.fieldDk, 2);
    if (opt.cross) { // medic
      rrect(c, cx + 1.6, cy - 0.8, 3, 1.6, 0.4); F(c, P.red);
      rrect(c, cx + 2.6, cy - 1.8, 1, 3.6, 0.4); F(c, P.red);
    }
    if (opt.markCap) { circle(c, cx + 3, cy, 2.2); F(c, T.lt); }
    // weapon east
    if (opt.weapon !== false) {
      rrect(c, cx + 5, cy + (opt.wY || 0) - 1.4, opt.wLen || 14, 2.8, 1.2);
      F(c, P.woodDk); ol(c, 1.5);
    }
    if (opt.extra) opt.extra(c, cx, cy);
  }

  function infantry(key, opt) {
    SF.animTeam('unit_' + key, 48, 48, 4, 'units', (c, i, frames, w, h, H, T) =>
      soldier(c, i, frames, T, opt));
  }

  // 1..7 infantry
  infantry('infantry', { pack: P.woodDk });
  infantry('officer',  { body: P.gunDk, helmet: P.gun, markCap: true, wLen: 9, pack: null,
    extra: (c, x, y) => { rrect(c, x - 7, y + 5, 6, 9, 2); F(c, P.gunDk); } }); // greatcoat tail
  infantry('medic',    { body: P.cream, helmet: P.white, cross: true, pack: P.red, wLen: 0, weapon: false });
  infantry('engineer', { body: P.amber, helmet: P.fieldDk, pack: P.steelDk,
    extra: (c, x, y) => { rrect(c, x + 4, y + 3, 8, 5, 1.5); fo(c, P.steel, 1.4); } }); // toolbox
  infantry('scout',    { body: P.olive, helmet: P.oliveDk, wLen: 10,
    extra: (c, x, y) => { rrect(c, x + 1, y - 6, 5, 3, 1); fo(c, P.gunDk, 1.2); } }); // binos
  infantry('heavy',    { body: P.gunDk, helmet: P.gun, pack: P.steelDk, wLen: 17, wY: 1,
    extra: (c, x, y) => { circle(c, x - 3, y, 3.2); fo(c, P.steelDk, 1.5); } });
  infantry('grenadier',{ body: P.field, helmet: P.fieldDk, pack: P.red,
    extra: (c, x, y) => { circle(c, x + 9, y + 4, 2.6); fo(c, P.gunDk, 1.4); } }); // grenade

  /* ---- vehicle helpers ------------------------------------------- */
  function track(c, x, y, w, h) { // a tread block
    rrect(c, x, y, w, h, 2.5); fo(c, P.gunDk, 2);
    c.strokeStyle = P.ink; c.lineWidth = 1;
    for (let t = y + 3; t < y + h - 1; t += 3.2) { c.beginPath(); c.moveTo(x + 1, t); c.lineTo(x + w - 1, t); c.stroke(); }
  }
  function hull(c, x, y, w, h, col, T) {
    rrect(c, x, y, w, h, 4); fo(c, col, 2.4);
    rrect(c, x + 2, y + 2, w - 4, 4, 2); F(c, T.main);          // team stripe
  }
  function turret(c, cx, cy, r, col, T, barLen) {
    circle(c, cx, cy, r); fo(c, col, 2.4);
    rrect(c, cx - r + 1, cy - 2, 5, 4, 1); F(c, T.lt);          // team emblem
    rrect(c, cx + r - 2, cy - 2.2, barLen, 4.4, 2); fo(c, P.gun, 2);  // barrel east
    rrect(c, cx + r - 2 + barLen, cy - 3, 3, 6, 1.2); fo(c, P.gunDk, 1.6);
  }

  // 8. LIGHT TANK
  SF.regTeam('unit_lighttank', 48, 48, 'units', (c, w, h, H, T) => {
    shadow(c, 22, 26, 19, 13);
    track(c, 8, 9, 30, 6); track(c, 8, 33, 30, 6);
    hull(c, 11, 13, 26, 22, P.field, T);
    turret(c, 23, 24, 7.5, P.fieldDk, T, 14);
  });
  // 9. MEDIUM TANK
  SF.regTeam('unit_mediumtank', 56, 56, 'units', (c, w, h, H, T) => {
    shadow(c, 26, 31, 23, 15);
    track(c, 8, 10, 38, 8); track(c, 8, 38, 38, 8);
    hull(c, 12, 15, 34, 26, P.field, T);
    turret(c, 26, 28, 9.5, P.fieldDk, T, 18);
  });
  // 10. HEAVY TANK
  SF.regTeam('unit_heavytank', 64, 64, 'units', (c, w, h, H, T) => {
    shadow(c, 30, 36, 27, 17);
    track(c, 8, 11, 48, 10); track(c, 8, 43, 48, 10);
    hull(c, 12, 17, 44, 30, P.fieldDk, T);
    turret(c, 30, 32, 12, P.gunDk, T, 22);
  });
  // 11. HALF-TRACK
  SF.regTeam('unit_halftrack', 56, 48, 'units', (c, w, h, H, T) => {
    shadow(c, 28, 27, 24, 12);
    circle(c, 14, 12, 5); fo(c, P.gunDk, 2); circle(c, 14, 36, 5); fo(c, P.gunDk, 2); // front wheels
    track(c, 24, 9, 26, 6); track(c, 24, 33, 26, 6);
    hull(c, 10, 14, 40, 20, P.field, T);
    rrect(c, 34, 16, 14, 16, 3); fo(c, P.fieldDk, 2);   // open rear bay
  });
  // 12. ARMORED CAR
  SF.regTeam('unit_armoredcar', 52, 44, 'units', (c, w, h, H, T) => {
    shadow(c, 26, 25, 22, 11);
    [[12, 10], [40, 10], [12, 34], [40, 34]].forEach(([x, y]) => { circle(c, x, y, 5); fo(c, P.gunDk, 2); });
    hull(c, 9, 13, 36, 18, P.gun, T);
    turret(c, 24, 22, 6.5, P.gunDk, T, 12);
  });
  // 13. MOTORCYCLE + sidecar
  SF.regTeam('unit_motorcycle', 48, 40, 'units', (c, w, h, H, T) => {
    shadow(c, 24, 24, 18, 9);
    circle(c, 12, 16, 6); fo(c, P.gunDk, 2); circle(c, 36, 16, 6); fo(c, P.gunDk, 2); // wheels
    rrect(c, 12, 13, 24, 6, 3); fo(c, P.field, 2);      // frame
    ellipse(c, 22, 16, 4, 3); fo(c, P.fieldDk, 1.8);    // rider
    rrect(c, 16, 24, 18, 9, 3); fo(c, P.gunDk, 2);      // sidecar
    rrect(c, 18, 25, 6, 3, 1); F(c, T.main);
  });
  // 14. ARTILLERY TRUCK (towing gun)
  SF.regTeam('unit_arttruck', 60, 44, 'units', (c, w, h, H, T) => {
    shadow(c, 30, 25, 26, 11);
    [[14, 9], [14, 33], [30, 9], [30, 33]].forEach(([x, y]) => { circle(c, x, y, 4.5); fo(c, P.gunDk, 1.8); });
    hull(c, 8, 12, 32, 20, P.olive, T);
    rrect(c, 30, 14, 10, 16, 2); fo(c, P.oliveDk, 2);   // cab
    // towed gun
    circle(c, 48, 16, 4); fo(c, P.gunDk, 1.6); circle(c, 48, 28, 4); fo(c, P.gunDk, 1.6);
    rrect(c, 42, 20, 16, 4, 2); fo(c, P.steel, 2);
  });
  // 15. BOSS — heavy super-tank
  SF.regTeam('unit_boss', 88, 88, 'units', (c, w, h, H, T) => {
    shadow(c, 42, 50, 40, 24);
    track(c, 8, 14, 70, 14); track(c, 8, 60, 70, 14);
    hull(c, 12, 24, 64, 40, P.gunDk, T);
    rrect(c, 12, 24, 64, 7, 3); F(c, T.main);
    // big turret
    circle(c, 40, 44, 18); fo(c, P.fieldDk, 2.8);
    circle(c, 40, 44, 18); c.lineWidth = 3; c.strokeStyle = T.dk; c.stroke();
    rrect(c, 28, 38, 8, 12, 2); F(c, T.lt);             // emblem
    rrect(c, 56, 40, 30, 8, 3); fo(c, P.gun, 2.6);      // huge barrel
    rrect(c, 84, 37, 5, 14, 2); fo(c, P.gunDk, 2);      // muzzle brake
    // commander hatch
    circle(c, 40, 44, 5); fo(c, P.gun, 1.8);
  });
})();
