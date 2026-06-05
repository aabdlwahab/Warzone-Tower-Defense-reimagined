/* =====================================================================
   WARZONE — Sprite Forge :: TOWERS (defenses)
   12 towers, each = base (footprint) + gun (rotatable, points EAST,
   pivot at 24,24). Team-tinted: the emplacement ring + a turret marking
   take the player color; gun steel stays neutral.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow } = SF.h;

  /* ---- shared base pads ------------------------------------------ */
  // Sandbag ring with a team-colored inner lip.
  function padSandbag(ctx, T) {
    shadow(ctx, 24, 26, 21, 19);
    // dirt floor
    circle(ctx, 24, 24, 20); fo(ctx, P.dirt, 2.2);
    circle(ctx, 24, 24, 13); ctx.fillStyle = P.dirtDk; ctx.fill();
    // team lip
    circle(ctx, 24, 24, 13); ctx.lineWidth = 3; ctx.strokeStyle = T.main; ctx.stroke();
    // sandbags around ring
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = 24 + Math.cos(a) * 18, y = 24 + Math.sin(a) * 18;
      ellipse(ctx, x, y, 4.6, 3.6, a); fo(ctx, i % 2 ? P.sand : P.sandDk, 1.8);
    }
  }
  // Concrete pad, beveled, team bolts at corners.
  function padConcrete(ctx, T) {
    shadow(ctx, 24, 27, 20, 18);
    rrect(ctx, 6, 6, 36, 36, 7); fo(ctx, P.stone, 2.4);
    rrect(ctx, 11, 11, 26, 26, 5); ctx.fillStyle = P.stoneDk; ctx.fill();
    rrect(ctx, 11, 11, 26, 26, 5); ctx.lineWidth = 2.6; ctx.strokeStyle = T.main; ctx.stroke();
    [[11, 11], [37, 11], [11, 37], [37, 37]].forEach(([x, y]) => {
      circle(ctx, x, y, 2.4); fo(ctx, T.lt, 1.4);
    });
  }
  // Earthwork / foxhole, cheap.
  function padEarth(ctx, T) {
    shadow(ctx, 24, 26, 19, 17);
    ellipse(ctx, 24, 24, 19, 18); fo(ctx, P.dirtDk, 2.2);
    ellipse(ctx, 24, 25, 12, 11); fo(ctx, P.mud, 1.8);
    // team marker stake
    circle(ctx, 24, 24, 4); fo(ctx, T.main, 1.6);
  }
  // Wooden platform.
  function padWood(ctx, T) {
    shadow(ctx, 24, 27, 20, 17);
    rrect(ctx, 6, 8, 36, 32, 5); fo(ctx, P.wood, 2.4);
    ctx.strokeStyle = P.woodDk; ctx.lineWidth = 1.6;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(6, 8 + i * 6.4); ctx.lineTo(42, 8 + i * 6.4); ctx.stroke(); }
    rrect(ctx, 6, 8, 36, 32, 5); ol(ctx, 2.4);
    rrect(ctx, 9, 11, 6, 6, 2); fo(ctx, T.main, 1.4);
  }

  /* ---- gun building blocks --------------------------------------- */
  // barrel pointing east from a center pivot
  function barrel(ctx, x0, len, w, color) {
    rrect(ctx, x0, 24 - w / 2, len, w, w / 2); fo(ctx, color, 2.2);
  }
  function turretBody(ctx, r, color, T) {
    circle(ctx, 24, 24, r); fo(ctx, color, 2.4);
    // team band
    ctx.save(); circle(ctx, 24, 24, r); ctx.clip();
    rrect(ctx, 24 - r, 24 - 2.4, r, 4.8, 0); ctx.fillStyle = T.main; ctx.fill();
    ctx.restore();
    circle(ctx, 24, 24, r); ol(ctx, 2.4);
  }
  function muzzle(ctx, x, color) {
    rrect(ctx, x, 24 - 4, 4, 8, 1.5); fo(ctx, color || P.gunDk, 1.8);
  }

  /* =================================================================
     TOWER DEFINITIONS
     ================================================================= */

  // 1. RIFLE PIT — cheap starter
  SF.tower('rifle', (c, w, h, H, T) => padEarth(c, T), (c, w, h, H, T) => {
    // small gunner + rifle east
    circle(c, 21, 24, 7); fo(c, P.field, 2.2);           // shoulders
    circle(c, 22, 24, 4.4); fo(c, P.fieldDk, 1.8);        // helmet
    rrect(c, 24, 22.4, 18, 3.2, 1.4); fo(c, P.woodDk, 1.8); // rifle
    muzzle(c, 41, P.gunDk);
  });

  // 2. MG NEST — twin barrels
  SF.tower('mg', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    rrect(c, 12, 17, 10, 14, 3); fo(c, P.steelDk, 2.2);   // ammo box
    turretBody(c, 8, P.steel, T);
    barrel(c, 30, 14, 3.6, P.gun);
    barrel(c, 30, 14, 3.6, P.gun);                        // (twin, offset below)
    rrect(c, 30, 27, 14, 3.6, 1.8); fo(c, P.gun, 2);
    rrect(c, 30, 17.4, 14, 3.6, 1.8); fo(c, P.gun, 2);
    muzzle(c, 43, P.gunDk);
  });

  // 3. MORTAR PIT — short fat tube
  SF.tower('mortar', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    turretBody(c, 9, P.steelDk, T);
    rrect(c, 24, 19, 18, 10, 4); fo(c, P.steel, 2.4);     // stubby tube
    circle(c, 40, 24, 5.5); fo(c, P.gunDk, 2);             // mouth
    circle(c, 40, 24, 2.6); ctx_fill(c, P.ink);
  });

  // 4. FIELD CANNON — wheels + medium barrel
  SF.tower('cannon', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    circle(c, 16, 12, 6); fo(c, P.gunDk, 2); circle(c, 16, 36, 6); fo(c, P.gunDk, 2); // wheels
    circle(c, 16, 12, 2.2); fo(c, T.main, 1.2); circle(c, 16, 36, 2.2); fo(c, T.main, 1.2);
    turretBody(c, 8, P.steel, T);
    barrel(c, 28, 18, 6, P.gun);
    muzzle(c, 45, P.gunDk);
  });

  // 5. ANTI-TANK GUN — long thin barrel + shield
  SF.tower('at', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    turretBody(c, 7, P.steelDk, T);
    rrect(c, 18, 12, 7, 24, 3); fo(c, P.steel, 2.4);      // gun shield
    barrel(c, 25, 21, 3.4, P.gun);
    muzzle(c, 46, P.gunDk);
  });

  // 6. FLAK AA — quad short barrels
  SF.tower('flak', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    turretBody(c, 9, P.steel, T);
    [[-4.5], [-1.5], [1.5], [4.5]].forEach(([o]) => {
      rrect(c, 30, 24 + o - 1.3, 13, 2.6, 1.2); fo(c, P.gun, 1.7);
    });
    circle(c, 24, 24, 3); fo(c, T.lt, 1.4);
  });

  // 7. HOWITZER — thick barrel + recoil cylinder
  SF.tower('howitzer', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    turretBody(c, 10, P.steelDk, T);
    rrect(c, 22, 19, 12, 10, 4); fo(c, P.steel, 2.2);     // recoil housing
    barrel(c, 30, 16, 7.5, P.gun);
    muzzle(c, 45, P.gunDk);
  });

  // 8. SNIPER POST — very long thin rifle
  SF.tower('sniper', (c, w, h, H, T) => padWood(c, T), (c, w, h, H, T) => {
    circle(c, 18, 24, 6.5); fo(c, P.field, 2.2);
    circle(c, 19, 24, 4); fo(c, P.fieldDk, 1.6);
    rrect(c, 22, 22.6, 24, 2.8, 1.2); fo(c, P.gunDk, 1.8); // long barrel
    rrect(c, 21, 21, 5, 6, 1.5); fo(c, T.main, 1.4);       // scope/marker
    muzzle(c, 45, P.ink);
  });

  // 9. FLAME BUNKER — fuel tanks + nozzle
  SF.tower('flame', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    rrect(c, 11, 15, 9, 18, 4); fo(c, P.red, 2.2);         // fuel tank
    circle(c, 15.5, 15, 2.4); fo(c, P.gunDk, 1.4);
    turretBody(c, 7, P.steelDk, T);
    barrel(c, 28, 16, 4.5, P.gun);
    ellipse(c, 45, 24, 3.4, 4.4); fo(c, P.orange, 1.6);    // pilot flame
    ellipse(c, 45, 24, 1.6, 2.4); ctx_fill(c, P.yellow);
  });

  // 10. ROCKET BATTERY — rack of tubes
  SF.tower('rocket', (c, w, h, H, T) => padConcrete(c, T), (c, w, h, H, T) => {
    rrect(c, 12, 13, 12, 22, 4); fo(c, P.steelDk, 2.2);    // mount
    rrect(c, 12, 14, 6, 6, 1.5); fo(c, T.main, 1.4);
    [[-6], [-2], [2], [6]].forEach(([o]) => {
      rrect(c, 22, 24 + o - 1.6, 22, 3.2, 1.6); fo(c, P.gun, 1.7);
      circle(c, 44, 24 + o, 1.8); fo(c, P.orange, 1.1);
    });
  });

  // 11. BAZOOKA TEAM — gunner + shoulder tube
  SF.tower('bazooka', (c, w, h, H, T) => padSandbag(c, T), (c, w, h, H, T) => {
    circle(c, 19, 27, 7); fo(c, P.field, 2.2);             // gunner
    circle(c, 20, 27, 4.2); fo(c, P.fieldDk, 1.6);
    rrect(c, 16, 19, 28, 6, 3); fo(c, P.steel, 2.2);       // tube
    rrect(c, 16, 19, 6, 6, 2); fo(c, T.main, 1.4);
    circle(c, 44, 22, 3.6); fo(c, P.gunDk, 1.8);
  });

  // 12. HQ BUNKER (support) — radar dish + flag, slow rotate
  SF.tower('command', (c, w, h, H, T) => {
    shadow(c, 24, 27, 21, 18);
    rrect(c, 7, 9, 34, 32, 6); fo(c, P.stoneDk, 2.4);      // bunker
    rrect(c, 12, 14, 24, 22, 4); fo(c, P.stone, 2);
    // slit
    rrect(c, 14, 22, 20, 5, 2); fo(c, P.ink, 1.4);
    // team flag
    rrect(c, 33, 6, 2, 14, 1); fo(c, P.woodDk, 1.2);
    poly(c, [[35, 6], [44, 9], [35, 14]]); fo(c, T.main, 1.6);
  }, (c, w, h, H, T) => {
    // rotating radar dish + antenna
    circle(c, 24, 24, 5); fo(c, P.steelDk, 2);
    poly(c, [[26, 16], [40, 20], [40, 28], [26, 32]]); fo(c, P.steelLt, 2.2); // dish
    rrect(c, 24, 23, 16, 2, 1); fo(c, P.gun, 1.4);
    circle(c, 24, 24, 2.4); fo(c, T.lt, 1.2);
  });

  // tiny shim used above
  function ctx_fill(c, color) { c.fillStyle = color; c.fill(); }
})();
