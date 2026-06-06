/* =====================================================================
   WARZONE — Sprite Forge :: CORE
   Flat-vector / high-contrast arcade / WWII top-down visual system.
   Defines the palette, drawing helpers, and the sprite registry.
   Loaded first; every other forge file appends to globalThis.SF.
   ===================================================================== */
(function () {
  const SF = (globalThis.SF = globalThis.SF || {});

  /* ---- Palette ---------------------------------------------------- */
  SF.P = {
    ink:        '#15161d',          // universal outline / darkest
    inkSoft:    '#2a2d38',
    shadow:     'rgba(12,14,20,0.30)',

    // terrain
    grass:      '#5fae3a',
    grassDk:    '#4c9230',
    grassLt:    '#77c44d',
    dirt:       '#c08a52',
    dirtDk:     '#a06f3f',
    dirtLt:     '#d6a468',
    sand:       '#e3c272',
    sandDk:     '#cfa busy',         // (overwritten below; placeholder guard)
    water:      '#33a7dd',
    waterDk:    '#2b8ec0',
    waterLt:    '#62c2ef',
    mud:        '#7a5c39',
    mudDk:      '#5f4729',
    stone:      '#8b8f99',
    stoneDk:    '#6b6f79',

    // allied (towers) — olive + steel + blue
    olive:      '#86922f',
    oliveDk:    '#5f6b22',
    oliveLt:    '#a6b347',
    steel:      '#5a6473',
    steelDk:    '#414b59',
    steelLt:    '#7d8a9b',
    blue:       '#2e74d6',
    blueLt:     '#4f95ef',

    // axis (enemies) — gunmetal + red
    gun:        '#4a5160',
    gunDk:      '#343a47',
    gunLt:      '#69728a',
    field:      '#737d54',          // feldgrau
    fieldDk:    '#56603c',

    // accents / fx
    red:        '#e8413a',
    redDk:      '#c22f2c',
    orange:     '#ff7a1a',
    orangeLt:   '#ffa14d',
    yellow:     '#ffcf3f',
    amber:      '#f5a623',
    white:      '#f4f1e6',
    cream:      '#efe7cf',
    smoke:      '#aab0ba',
    smokeDk:    '#7e848f',
    flesh:      '#e8b88f',
    fleshDk:    '#c9925f',
    wood:       '#9c6b3c',
    woodDk:     '#7a5128',
  };
  SF.P.sandDk = '#cfa84f';

  const P = SF.P;

  /* ---- Geometry helpers ------------------------------------------ */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function circle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
  }
  function ellipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.closePath();
  }

  /* ---- Paint helpers --------------------------------------------- */
  // Stroke the current path as an arcade outline.
  function ol(ctx, lw) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lw == null ? 2.4 : lw;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
  }
  // Fill + outline in one go.
  function fo(ctx, color, lw) {
    ctx.fillStyle = color;
    ctx.fill();
    ol(ctx, lw);
  }
  // Drop a soft top-down contact shadow.
  function shadow(ctx, cx, cy, rx, ry) {
    ctx.save();
    ctx.fillStyle = P.shadow;
    ellipse(ctx, cx, cy, rx, ry);
    ctx.fill();
    ctx.restore();
  }
  // A small flat highlight wedge (no gradients — flat shapes only).
  function shade(ctx, color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Top-left highlight strip on a filled rounded rect (already path'd or pass dims).
  function bevel(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    rrect(ctx, x + 1, y + 1, w * 0.55, h * 0.35, 2);
    ctx.fill();
  }
  // Crescent helmet / dome highlight.
  function domeHi(ctx, cx, cy, r, color) {
    ctx.save();
    circle(ctx, cx, cy, r);
    ctx.clip();
    ellipse(ctx, cx - r * 0.15, cy - r * 0.35, r * 0.55, r * 0.35);
    shade(ctx, color);
    ctx.restore();
  }
  // Sandbag ring — reusable emplacement lip.
  function sandbags(ctx, cx, cy, radius, count) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      ellipse(ctx, x, y, 5.2, 3.8, a);
      fo(ctx, i % 2 ? P.sand : P.sandDk, 1.6);
      ellipse(ctx, x - 1, y - 1.5, 2.2, 1.4, a);
      shade(ctx, 'rgba(255,255,255,0.12)');
    }
  }

  SF.h = { rrect, poly, circle, ellipse, ol, fo, shadow, shade, bevel, domeHi, sandbags };

  /* ---- Player teams (configurable) -------------------------------
     Up to 4 players. Every tower (defense) and player-controlled unit
     is baked once per team (suffix _p1.._p4) plus a neutral set (_p0).
     Edit these triplets to recolor the whole army — re-run the forge
     and the game's TEAM_COLORS table to match.  main = body accent,
     dk = shadow side / outlines of colored parts, lt = rim highlight. */
  SF.TEAMS = {
    p0: { id: 'p0', name: 'Neutral', main: '#86922f', dk: '#5f6b22', lt: '#a6b347' }, // olive
    p1: { id: 'p1', name: 'Blue',    main: '#2e74d6', dk: '#1f56a6', lt: '#5b97ee' },
    p2: { id: 'p2', name: 'Red',     main: '#e8413a', dk: '#b82d28', lt: '#f4736d' },
    p3: { id: 'p3', name: 'Green',   main: '#25c065', dk: '#199048', lt: '#57da8c' },
    p4: { id: 'p4', name: 'Amber',   main: '#f5b21e', dk: '#c98a0c', lt: '#ffce5c' },
  };
  // Teams to actually bake variants for (p0 neutral + 4 players).
  SF.TEAM_ORDER = ['p0', 'p1', 'p2', 'p3', 'p4'];

  /* ---- Registry --------------------------------------------------- */
  // statics:  { name, w, h, draw(ctx,h,helpers) }
  // anims:    { name, w, h, frames, draw(ctx, i, frames, h) }  -> spritesheet row
  // teamed sprites/anims carry an extra final arg T (the team palette)
  // and are baked once per SF.TEAM_ORDER entry (suffix _p0.._p4).
  SF.sprites = SF.sprites || {};
  SF.anims = SF.anims || {};
  SF.teamSprites = SF.teamSprites || {};
  SF.teamAnims = SF.teamAnims || {};
  SF.groups = SF.groups || {}; // name -> category for catalog grouping

  SF.reg = function (name, w, h, group, draw) {
    SF.sprites[name] = { name, w, h, draw };
    SF.groups[name] = group;
  };
  SF.anim = function (name, w, h, frames, group, draw) {
    SF.anims[name] = { name, w, h, frames, draw };
    SF.groups[name] = group;
  };
  // Team-tinted variants. draw(ctx,h,helpers,T)
  SF.regTeam = function (name, w, h, group, draw) {
    SF.teamSprites[name] = { name, w, h, draw };
    SF.groups[name] = group;
  };
  SF.animTeam = function (name, w, h, frames, group, draw) {
    SF.teamAnims[name] = { name, w, h, frames, draw };
    SF.groups[name] = group;
  };

  // Convenience: register a tower as base + rotatable gun (gun points
  // east). Both are team-tinted. baseDraw/gunDraw get (ctx,h,helpers,T).
  SF.tower = function (key, baseDraw, gunDraw) {
    SF.regTeam('tower_' + key + '_base', 48, 48, 'towers', baseDraw);
    SF.regTeam('tower_' + key + '_gun', 48, 48, 'towers', gunDraw);
  };
})();
