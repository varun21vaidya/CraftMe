/* CraftMe screens: placeholder artwork. Draws a seeded painting into every <canvas class="art" data-seed data-style data-ratio>. */
(function () {
  var PAL = [
    ['#1d3557', '#e63946', '#f1faee', '#a8dadc', '#457b9d'],
    ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c', '#d90429'],
    ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
    ['#0b132b', '#1c2541', '#3a506b', '#5bc0be', '#6fffe9'],
    ['#582f0e', '#9c6644', '#e6ccb2', '#ddb892', '#7f5539'],
    ['#003049', '#d62828', '#f77f00', '#fcbf49', '#eae2b7'],
    ['#3d405b', '#e07a5f', '#f4f1de', '#81b29a', '#f2cc8f'],
    ['#14213d', '#fca311', '#e5e5e5', '#ffffff', '#1b263b'],
    ['#355070', '#6d597a', '#b56576', '#e56b6f', '#eaac8b'],
    ['#1b4332', '#40916c', '#95d5b2', '#d8f3dc', '#081c15']
  ];
  var STYLES = ['field', 'horizon', 'orbit', 'hatch', 'bloom'];
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function draw(c) {
    var seed = +c.dataset.seed || 1;
    var style = c.dataset.style || STYLES[seed % STYLES.length];
    var ratio = c.dataset.ratio || '4/5';
    c.style.setProperty('--ratio', ratio.replace('/', ' / '));
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = rng(seed * 9973 + 7);
    var p = PAL[seed % PAL.length].slice().sort(function () { return r() - .5; });
    g.clearRect(0, 0, w, h);

    if (style === 'field') {
      g.fillStyle = p[0]; g.fillRect(0, 0, w, h);
      g.shadowBlur = w * .06;
      g.shadowColor = p[1]; g.fillStyle = p[1]; g.fillRect(w * .1, h * .09, w * .8, h * .4);
      g.shadowColor = p[3]; g.fillStyle = p[3]; g.fillRect(w * .1, h * .54, w * .8, h * .3);
      g.shadowBlur = 0; g.fillStyle = p[2]; g.fillRect(w * .1, h * .5, w * .8, h * .012);
    } else if (style === 'horizon') {
      var sk = g.createLinearGradient(0, 0, 0, h * .7); sk.addColorStop(0, p[2]); sk.addColorStop(1, p[3]);
      g.fillStyle = sk; g.fillRect(0, 0, w, h);
      g.fillStyle = p[4]; g.beginPath(); g.arc(w * (.3 + r() * .4), h * (.28 + r() * .12), w * .1, 0, 7); g.fill();
      for (var i = 0; i < 4; i++) {
        var y0 = h * (.5 + i * .12), amp = h * (.05 + r() * .05), ph = r() * 6;
        g.fillStyle = p[i % 5]; g.beginPath(); g.moveTo(0, h);
        for (var x = 0; x <= w; x += 4) g.lineTo(x, y0 + Math.sin(x / w * 5 + ph) * amp);
        g.lineTo(w, h); g.fill();
      }
    } else if (style === 'orbit') {
      g.fillStyle = p[2]; g.fillRect(0, 0, w, h);
      for (var j = 0; j < 7; j++) {
        var cx = w * (.2 + r() * .6), cy = h * (.2 + r() * .6), rad = w * (.08 + r() * .26);
        g.globalAlpha = .5 + r() * .45; g.fillStyle = p[j % 5]; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill();
        g.globalAlpha = 1; g.strokeStyle = p[(j + 2) % 5]; g.lineWidth = Math.max(1, w * .008);
        g.beginPath(); g.arc(cx, cy, rad * 1.35, 0, 7); g.stroke();
      }
    } else if (style === 'hatch') {
      g.fillStyle = p[2]; g.fillRect(0, 0, w, h);
      for (var k = 0; k < 5; k++) {
        g.save(); g.translate(w * r(), h * r()); g.rotate((r() - .5) * 1.6);
        g.strokeStyle = p[k % 5]; g.lineWidth = Math.max(1, w * .006); g.globalAlpha = .85;
        var n = 14 + (r() * 18 | 0), gap = w * .018;
        for (var m = 0; m < n; m++) { g.beginPath(); g.moveTo(m * gap, -w * .3); g.lineTo(m * gap, w * .3); g.stroke(); }
        g.restore();
      }
    } else {
      g.fillStyle = p[0]; g.fillRect(0, 0, w, h);
      for (var q = 0; q < 9; q++) {
        var bx = w * r(), by = h * r(), br = w * (.15 + r() * .35);
        var gr = g.createRadialGradient(bx, by, 0, bx, by, br);
        gr.addColorStop(0, p[q % 5]); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = .8; g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      g.globalAlpha = 1;
    }
  }

  function all() { Array.prototype.forEach.call(document.querySelectorAll('canvas.art'), draw); }
  window.CM_drawArt = draw; window.CM_drawAllArt = all;
  if (document.readyState !== 'loading') all(); else document.addEventListener('DOMContentLoaded', all);
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(all, 120); });
})();
