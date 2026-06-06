/* =====================================================================
   WARZONE — Sprite Forge :: UI & ICONS  (neutral)
   HUD chrome (panels, buttons, bars, cards, markers) + a glyph icon set.
   Icons are drawn as solid dark glyphs on transparent bg so they read on
   light chips and can be tinted in-engine.
   ===================================================================== */
(function () {
  const SF = globalThis.SF, P = SF.P;
  const { rrect, poly, circle, ellipse, ol, fo, shadow } = SF.h;
  const F = (c, col) => { c.fillStyle = col; c.fill(); };
  const GL = '#2a2d38';   // glyph color
  const stroke = (c, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };

  /* ---- panels & cards -------------------------------------------- */
  SF.reg('ui_panel', 64, 64, 'ui', (c) => {
    rrect(c, 3, 3, 58, 58, 10); fo(c, '#23262f', 2.6);
    rrect(c, 6, 6, 52, 8, 6); F(c, '#2e323d');           // top sheen bar
    rrect(c, 3, 3, 58, 58, 10); c.lineWidth = 2; c.strokeStyle = '#3a3f4c'; c.stroke();
  });
  SF.reg('ui_card', 80, 100, 'ui', (c) => {
    rrect(c, 3, 3, 74, 94, 9); fo(c, '#262a34', 2.4);
    rrect(c, 7, 7, 66, 50, 6); F(c, '#1c1f27');          // art well
    rrect(c, 7, 62, 66, 30, 6); F(c, '#2e323d');         // label well
    rrect(c, 3, 3, 74, 94, 9); c.lineWidth = 2; c.strokeStyle = '#3a3f4c'; c.stroke();
  });

  /* ---- buttons (3 states) ---------------------------------------- */
  function button(c, col, colDk, state) {
    const dy = state === 'press' ? 3 : 0;
    rrect(c, 4, 8, 104, 30, 9); F(c, colDk);             // base / shadow
    rrect(c, 4, 6 + dy, 104, 28, 9); fo(c, state === 'hover' ? lighten(col) : col, 2.4);
    rrect(c, 9, 10 + dy, 94, 7, 4); c.globalAlpha = 0.35; F(c, '#ffffff'); c.globalAlpha = 1;
  }
  function lighten(hex) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + 22, g = ((n >> 8) & 255) + 22, b = (n & 255) + 22;
    r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  ['', '_hover', '_press'].forEach((s, i) => {
    SF.reg('ui_button' + s, 112, 44, 'ui', (c) => button(c, '#4b525f', '#33384300'.slice(0, 7) || '#333843', ['', 'hover', 'press'][i]));
    SF.reg('ui_button_green' + s, 112, 44, 'ui', (c) => button(c, '#3fae5e', '#2b7e44', ['', 'hover', 'press'][i]));
    SF.reg('ui_button_red' + s, 112, 44, 'ui', (c) => button(c, '#e8413a', '#b02b27', ['', 'hover', 'press'][i]));
  });

  /* ---- health / progress bar ------------------------------------- */
  SF.reg('ui_bar_frame', 72, 14, 'ui', (c) => {
    rrect(c, 1, 1, 70, 12, 6); fo(c, '#1b1e26', 2);
    rrect(c, 3, 3, 66, 8, 4); F(c, '#33384300'.slice(0, 7) || '#333843');
  });
  // solid fills (game stretches these inside the frame)
  ['green', 'yellow', 'red'].forEach((k, i) => {
    const col = ['#3fd56a', '#ffcf3f', '#e8413a'][i];
    SF.reg('ui_bar_' + k, 64, 8, 'ui', (c) => { rrect(c, 0, 0, 64, 8, 4); F(c, col); });
  });

  /* ---- markers --------------------------------------------------- */
  SF.reg('ui_range', 200, 200, 'ui', (c) => {
    circle(c, 100, 100, 96); c.fillStyle = 'rgba(95,174,58,0.12)'; c.fill();
    circle(c, 100, 100, 96); c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(120,200,90,0.9)'; c.stroke(); c.setLineDash([]);
  });
  SF.reg('ui_place_ok', 48, 48, 'ui', (c) => {
    rrect(c, 4, 4, 40, 40, 8); c.fillStyle = 'rgba(63,213,106,0.22)'; c.fill();
    rrect(c, 4, 4, 40, 40, 8); c.lineWidth = 3; c.strokeStyle = '#3fd56a'; c.stroke();
    c.beginPath(); c.moveTo(17, 25); c.lineTo(23, 31); c.lineTo(33, 18); stroke(c, '#3fd56a', 4);
  });
  SF.reg('ui_place_no', 48, 48, 'ui', (c) => {
    rrect(c, 4, 4, 40, 40, 8); c.fillStyle = 'rgba(232,65,58,0.22)'; c.fill();
    rrect(c, 4, 4, 40, 40, 8); c.lineWidth = 3; c.strokeStyle = '#e8413a'; c.stroke();
    c.beginPath(); c.moveTo(18, 18); c.lineTo(30, 30); c.moveTo(30, 18); c.lineTo(18, 30); stroke(c, '#e8413a', 4);
  });

  /* ---- currency / wave banner ------------------------------------ */
  SF.reg('ui_coin', 32, 32, 'ui', (c) => {
    shadow(c, 16, 26, 9, 3);
    circle(c, 16, 15, 12); fo(c, P.yellow, 2.4);
    circle(c, 16, 15, 8.5); c.lineWidth = 2; c.strokeStyle = P.amber; c.stroke();
    c.font = 'bold 13px sans-serif'; c.fillStyle = P.amber; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('$', 16, 16);
  });
  SF.reg('ui_wave_banner', 200, 48, 'ui', (c) => {
    poly(c, [[8, 6], [192, 6], [200, 24], [192, 42], [8, 42], [0, 24]]); fo(c, '#23262f', 2.6);
    poly(c, [[8, 6], [192, 6], [200, 24], [192, 42], [8, 42], [0, 24]]); c.lineWidth = 2; c.strokeStyle = P.red; c.stroke();
    rrect(c, 14, 12, 24, 24, 5); fo(c, P.red, 2);
  });

  /* ================= ICONS (32x32 glyphs) ========================= */
  function icon(name, draw) { SF.reg('icon_' + name, 32, 32, 'icons', draw); }
  const ctr = 16;

  icon('upgrade', (c) => { poly(c, [[16, 5], [27, 17], [20, 17], [20, 27], [12, 27], [12, 17], [5, 17]]); F(c, '#3fd56a'); ol(c, 2); });
  icon('sell', (c) => { circle(c, 16, 16, 11); fo(c, P.yellow, 2.2); c.font = 'bold 15px sans-serif'; c.fillStyle = P.amber; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 16, 17); });
  icon('pause', (c) => { rrect(c, 9, 7, 5, 18, 2); F(c, GL); rrect(c, 18, 7, 5, 18, 2); F(c, GL); });
  icon('play', (c) => { poly(c, [[10, 7], [25, 16], [10, 25]]); fo(c, GL, 2); });
  icon('fast', (c) => { poly(c, [[5, 8], [15, 16], [5, 24]]); F(c, GL); poly(c, [[15, 8], [25, 16], [15, 24]]); F(c, GL); });
  icon('target', (c) => { circle(c, 16, 16, 10); stroke(c, GL, 2.6); circle(c, 16, 16, 3); F(c, GL); c.beginPath(); c.moveTo(16, 2); c.lineTo(16, 7); c.moveTo(16, 25); c.lineTo(16, 30); c.moveTo(2, 16); c.lineTo(7, 16); c.moveTo(25, 16); c.lineTo(30, 16); stroke(c, GL, 2.6); });
  icon('damage', (c) => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const r1 = k % 2 ? 5 : 12; const x = 16 + Math.cos(a) * r1, y = 16 + Math.sin(a) * r1; k ? c.lineTo(x, y) : (c.beginPath(), c.moveTo(x, y)); } c.closePath(); fo(c, P.orange, 2); });
  icon('settings', (c) => { for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const x = 16 + Math.cos(a) * 12, y = 16 + Math.sin(a) * 12; rrect(c, x - 2.4, y - 2.4, 4.8, 4.8, 1.5); F(c, GL); } circle(c, 16, 16, 8); fo(c, GL, 2.2); circle(c, 16, 16, 3.5); F(c, '#ffffff'); });
  icon('star', (c) => { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 5 : 12; const x = 16 + Math.cos(a) * r, y = 16 + Math.sin(a) * r; k ? c.lineTo(x, y) : (c.beginPath(), c.moveTo(x, y)); } c.closePath(); fo(c, P.yellow, 2); });
  icon('heart', (c) => { c.beginPath(); c.moveTo(16, 26); c.bezierCurveTo(2, 16, 7, 5, 16, 12); c.bezierCurveTo(25, 5, 30, 16, 16, 26); c.closePath(); fo(c, P.red, 2); });
  icon('skull', (c) => { circle(c, 16, 13, 10); fo(c, '#e8e3d4', 2); rrect(c, 9, 20, 14, 7, 3); fo(c, '#e8e3d4', 2); circle(c, 12, 13, 3); F(c, GL); circle(c, 20, 13, 3); F(c, GL); rrect(c, 14.5, 16, 3, 5, 1); F(c, GL); });
  icon('ammo', (c) => { rrect(c, 11, 6, 10, 14, 2); fo(c, P.amber, 2); poly(c, [[11, 6], [16, -1], [21, 6]]); fo(c, P.yellow, 2); rrect(c, 11, 20, 10, 6, 1); fo(c, P.gunDk, 2); });
  icon('shield', (c) => { c.beginPath(); c.moveTo(16, 4); c.lineTo(27, 9); c.lineTo(27, 17); c.quadraticCurveTo(27, 26, 16, 29); c.quadraticCurveTo(5, 26, 5, 17); c.lineTo(5, 9); c.closePath(); fo(c, P.blue, 2.2); });
  icon('fire', (c) => { c.beginPath(); c.moveTo(16, 3); c.bezierCurveTo(24, 12, 24, 14, 22, 19); c.bezierCurveTo(28, 17, 26, 9, 26, 9); c.bezierCurveTo(31, 18, 27, 29, 16, 29); c.bezierCurveTo(6, 29, 3, 20, 9, 12); c.bezierCurveTo(9, 18, 12, 18, 12, 18); c.bezierCurveTo(10, 11, 16, 9, 16, 3); c.closePath(); fo(c, P.orange, 2); });
  icon('lock', (c) => { rrect(c, 8, 14, 16, 13, 3); fo(c, GL, 2); c.beginPath(); c.arc(16, 14, 6, Math.PI, 0); stroke(c, GL, 3); circle(c, 16, 20, 2.4); F(c, '#ffffff'); });
  icon('plus', (c) => { rrect(c, 13.5, 6, 5, 20, 2); F(c, '#3fd56a'); rrect(c, 6, 13.5, 20, 5, 2); F(c, '#3fd56a'); });
  icon('close', (c) => { c.beginPath(); c.moveTo(9, 9); c.lineTo(23, 23); c.moveTo(23, 9); c.lineTo(9, 23); stroke(c, P.red, 4); });
  icon('menu', (c) => { [10, 16, 22].forEach(y => { rrect(c, 6, y - 1.6, 20, 3.2, 1.6); F(c, GL); }); });
  icon('sound_on', (c) => { poly(c, [[6, 12], [12, 12], [18, 6], [18, 26], [12, 20], [6, 20]]); fo(c, GL, 2); c.beginPath(); c.arc(20, 16, 5, -1, 1); c.arc(20, 16, 9, -1, 1); stroke(c, GL, 2.4); });
  icon('sound_off', (c) => { poly(c, [[6, 12], [12, 12], [18, 6], [18, 26], [12, 20], [6, 20]]); fo(c, GL, 2); c.beginPath(); c.moveTo(22, 12); c.lineTo(28, 20); c.moveTo(28, 12); c.lineTo(22, 20); stroke(c, P.red, 3); });
  icon('speed', (c) => { circle(c, 16, 17, 11); stroke(c, GL, 2.4); c.beginPath(); c.moveTo(16, 17); c.lineTo(22, 10); stroke(c, P.red, 3); circle(c, 16, 17, 2.4); F(c, GL); });
  icon('flag', (c) => { rrect(c, 8, 4, 2.6, 24, 1); F(c, GL); poly(c, [[10, 5], [26, 9], [10, 15]]); fo(c, P.red, 2); });
})();
