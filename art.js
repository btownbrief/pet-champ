/* Pet Champ - code-drawn art. Every drawable has an ASSETS key; drop a PNG path into
   ASSETS[key].src later and drawAsset() will use it instead of the code fallback. */
(function (root) {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------- assets
  const ASSETS = {
    // keys match IMAGE-PROMPTS.md. src:null = use the code-drawn fallback.
    title_logo: { src: null }, bg_summer: { src: null }, bg_fall: { src: null }, bg_winter: { src: null }, bg_spring: { src: null },
    pet_hatchling: { src: null }, pet_juvenile: { src: null }, pet_sunny: { src: null }, pet_chonk: { src: null },
    pet_splash: { src: null }, pet_mossy: { src: null }, egg: { src: null },
    food_perch: { src: null }, food_berries: { src: null }, food_cookie: { src: null }, food_creemee: { src: null },
    tourist: { src: null }, duck: { src: null }, note: { src: null },
    bottle: { src: null }, medal_1: { src: null }, medal_2: { src: null }, medal_3: { src: null },
    wear_shades: { src: null }, wear_beanie: { src: null }, wear_flowers: { src: null }, wear_leaf: { src: null }, wear_sailor: { src: null }, wear_party: { src: null },
    wear_bow: { src: null }, wear_goggles: { src: null }, wear_crown: { src: null }, wear_tophat: { src: null }, wear_antlers: { src: null },
  };
  function loadAssets() {
    for (const k in ASSETS) {
      const a = ASSETS[k];
      if (a.src && !a.img) { a.img = new Image(); a.img.onload = () => { a.ok = true; }; a.img.src = a.src; }
    }
  }
  // Painted pets are a single pose, so the code-drawn rig stays the default in play even when a PNG exists.
  function img(key) { const a = ASSETS[key]; return a && a.ok ? a.img : null; }
  /** Draw a painted asset centred at (x, y-h/2) fitted to width w; returns false when there is no PNG. */
  function drawImg(c, key, x, yBottom, w) {
    const im = img(key); if (!im) return false;
    const h = w * im.height / im.width; c.drawImage(im, x - w / 2, yBottom - h, w, h); return true;
  }

  // ---------------------------------------------------------------- color utils
  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
  }
  function rgba(c, a) { const A = hex(c); return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + a + ')'; }

  // ---------------------------------------------------------------- shape helpers
  function bez(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  }
  function bezD(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
      y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
    };
  }
  /** Tapered tube along a cubic bezier. Strokes the sides (not the base). */
  function tube(c, p0, p1, p2, p3, w0, w1, fill, line, lw, cap) {
    const N = 22, L = [], R = [];
    let endA = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = bez(p0, p1, p2, p3, t), d = bezD(p0, p1, p2, p3, t);
      const m = Math.hypot(d.x, d.y) || 1, nx = -d.y / m, ny = d.x / m, w = lerp(w0, w1, t) / 2;
      L.push([p.x + nx * w, p.y + ny * w]); R.push([p.x - nx * w, p.y - ny * w]);
      if (i === N) endA = Math.atan2(ny, nx);
    }
    const end = bez(p0, p1, p2, p3, 1);
    c.beginPath(); c.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= N; i++) c.lineTo(L[i][0], L[i][1]);
    if (cap) c.arc(end.x, end.y, w1 / 2, endA, endA - PI, true);
    for (let i = N; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
    c.closePath(); c.fillStyle = fill; c.fill();
    if (line) {
      c.beginPath(); c.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i <= N; i++) c.lineTo(L[i][0], L[i][1]);
      if (cap) c.arc(end.x, end.y, w1 / 2, endA, endA - PI, true); else c.moveTo(R[N][0], R[N][1]);
      for (let i = N; i >= 0; i--) c.lineTo(R[i][0], R[i][1]);
      c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    }
    return { L, R };
  }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); }
  function heartPath(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * 0.35);
    c.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.5, y - s * 1.05, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.5, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
    c.closePath();
  }
  function heart(c, x, y, s, col, a) {
    c.save(); c.globalAlpha *= a == null ? 1 : a;
    heartPath(c, x, y, s); c.fillStyle = col || '#ff6f91'; c.fill();
    c.lineWidth = Math.max(1.5, s * 0.16); c.strokeStyle = '#7a2340'; c.stroke();
    c.beginPath(); c.ellipse(x - s * 0.38, y - s * 0.42, s * 0.16, s * 0.1, -0.6, 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
    c.restore();
  }
  function sparkle(c, x, y, r, col, a) {
    c.save(); c.globalAlpha *= a == null ? 1 : a; c.fillStyle = col || '#fff6c2'; c.beginPath();
    for (let i = 0; i < 8; i++) { const ang = i * PI / 4, rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
    c.closePath(); c.fill(); c.restore();
  }

  // ---------------------------------------------------------------- pet palette + geometry
  const PAL = {
    baby:   { body: '#62cdb4', dark: '#2f9188', light: '#b5f2de', belly: '#f6f0c8', spot: '#c9f7e8', frill: '#ff9db0', frillD: '#df6584', cheek: '#ff8ea4', line: '#1d4a52', iris: '#2d5c7a' },
    sunny:  { body: '#4fc9b6', dark: '#228f88', light: '#a8f2df', belly: '#fff0b5', spot: '#ffd55a', frill: '#ffc94a', frillD: '#d99417', cheek: '#ff8ea4', line: '#1a4a50', iris: '#7a5418' },
    chonk:  { body: '#ffae7c', dark: '#d8744b', light: '#ffd7b8', belly: '#fff4df', spot: '#ffe2ad', frill: '#ff86a2', frillD: '#d4507a', cheek: '#ff6f8e', line: '#5a2c22', iris: '#5a3a2a' },
    splash: { body: '#4f97f2', dark: '#2a5fbe', light: '#a6d0ff', belly: '#eaf7ff', spot: '#ffffff', frill: '#63e3ea', frillD: '#1fa4b4', cheek: '#ff8eb4', line: '#152f63', iris: '#1d3c7a' },
    mossy:  { body: '#83b25c', dark: '#4f7d36', light: '#bfe197', belly: '#f1e9c0', spot: '#5f8f3d', frill: '#c99be3', frillD: '#8f5bb3', cheek: '#ff9a9a', line: '#2b4420', iris: '#4a3a1a' },
  };
  function geom(stage, variant) {
    if (stage === 'hatchling') return { size: 0.72, rx: 0.6, ry: 0.47, neck: 0.12, headR: 0.52, eyeR: 0.34, frill: 0, ridges: 2, tail: 0.5, cap: true };
    if (stage === 'juvenile') return { size: 0.86, rx: 0.62, ry: 0.44, neck: 0.36, headR: 0.44, eyeR: 0.3, frill: 0.6, ridges: 3, tail: 0.72 };
    const g = { size: 1, rx: 0.66, ry: 0.46, neck: 0.56, headR: 0.41, eyeR: 0.27, frill: 1, ridges: 4, tail: 0.9 };
    if (variant === 'chonk') Object.assign(g, { rx: 0.82, ry: 0.55, neck: 0.36, headR: 0.45, chin: true, ridges: 3 });
    if (variant === 'splash') Object.assign(g, { rx: 0.6, ry: 0.41, neck: 0.82, headR: 0.39, fin: true, stripe: true });
    if (variant === 'mossy') Object.assign(g, { lily: true, tufts: true, rx: 0.68 });
    if (variant === 'sunny') Object.assign(g, { shine: true, frill: 1.2 });
    return g;
  }
  function palFor(stage, variant) { return stage === 'grown' && PAL[variant] ? PAL[variant] : PAL.baby; }

  // Default pose. game.js keeps one of these per pet and eases it every frame.
  function pose() {
    return {
      stage: 'hatchling', variant: null, t: 0,
      sq: 0, jump: 0, sway: 0, lean: 0, droop: 0, tilt: 0, curl: 0, head: null,
      eye: 1, eyeStyle: 'normal', px: 0, py: 0, brow: 'none',
      mouth: 'smile', mouthOpen: 0, blush: 0, tummy: 0,
      tailWag: 0, flip: 0, facing: 1, wet: 0, spots: [], sparkle: 0, alpha: 1, shadow: 1, cheeks: 0, wear: null,
    };
  }

  /** Draw the pet standing at ground point (x,y). s = pixels per unit for a grown pet.
      Returns hit info in screen pixels. */
  function drawPet(c, x, y, s, P) {
    const g = geom(P.stage, P.variant), pal = palFor(P.stage, P.variant);
    const k = s * g.size, lw = 2.8 / k, t = P.t;
    const hit = {};
    c.save();
    c.globalAlpha *= P.alpha;
    c.translate(x, y);
    // shadow on the ground
    if (P.shadow > 0) {
      const sh = clamp(1 - P.jump * 0.8, 0.3, 1);
      c.fillStyle = 'rgba(30,40,60,' + (0.22 * P.shadow * sh) + ')';
      ell(c, 0, 0, k * (g.rx + 0.18) * sh, k * 0.12 * sh); c.fill();
    }
    c.scale(k * P.facing, k);
    c.translate(0, -P.jump);
    c.rotate(P.sway);
    c.scale(1 + P.sq, 1 - P.sq);

    const rx = g.rx, ry = g.ry, by = -ry;
    // --- head position (upright, droopy, curled for sleep, or overridden by a mini-game lunge)
    const B = { x: -rx * 0.28, y: by - ry * 0.55 };
    const topY = by - ry;
    let H = { x: B.x * 0.55 + P.lean * 0.28, y: topY - g.neck - g.headR * 0.55 + P.droop * (g.neck * 0.55 + 0.1) };
    const rest = { x: -rx * 0.62, y: by - ry * 0.55 };
    if (P.curl > 0) H = { x: lerp(H.x, rest.x, P.curl), y: lerp(H.y, rest.y, P.curl) };
    if (P.head) H = { x: P.head.x, y: P.head.y };
    const hr = g.headR;

    // --- tail (behind)
    const wag = Math.sin(P.tailWag) * 0.18;
    const T0 = { x: rx * 0.62, y: by + ry * 0.35 };
    const tl = g.tail * (1 - P.curl * 0.2);
    tube(c, T0, { x: rx + 0.15 * tl, y: by + ry * 0.75 },
      { x: rx + 0.42 * tl + wag * 0.4, y: by + ry * 0.2 - wag * 0.3 },
      { x: rx + 0.36 * tl + wag, y: by - ry * 0.35 - 0.18 * tl - P.curl * 0.05 },
      0.3, 0.07, pal.body, pal.line, lw, true);
    // back flipper
    c.save(); c.translate(rx * 0.55, -0.04); c.rotate(0.5 + Math.sin(P.flip + 1) * 0.15);
    ell(c, 0, 0, 0.2, 0.09); c.fillStyle = pal.dark; c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke(); c.restore();
    // splashy dorsal sail
    if (g.fin) {
      c.beginPath(); c.moveTo(-rx * 0.05, by - ry * 0.85);
      c.quadraticCurveTo(rx * 0.25, by - ry * 1.75, rx * 0.65, by - ry * 0.55);
      c.closePath(); c.fillStyle = rgba(pal.frill, 0.9); c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke();
      c.strokeStyle = rgba(pal.frillD, 0.6); c.lineWidth = lw * 0.7;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(rx * (0.05 + i * 0.14), by - ry * 0.8); c.lineTo(rx * (0.1 + i * 0.12), by - ry * (1.5 - i * 0.18)); c.stroke(); }
    }
    // --- body
    let gr = c.createLinearGradient(0, by - ry, 0, by + ry);
    gr.addColorStop(0, pal.light); gr.addColorStop(0.35, pal.body); gr.addColorStop(1, pal.dark);
    ell(c, 0, by, rx, ry); c.fillStyle = gr; c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke();
    // back ridges
    for (let i = 0; i < g.ridges; i++) {
      const a = -PI * 0.42 + i * 0.32, px = Math.cos(a) * rx * 0.93, py = by + Math.sin(a) * ry * 0.93;
      c.beginPath(); c.arc(px, py, 0.075, a + PI * 0.5 + 0.2 - PI, a + PI * 0.5 - 0.2 + PI * 0.0, false);
      ell(c, px + Math.cos(a) * 0.03, py + Math.sin(a) * 0.03, 0.075, 0.06, a + PI / 2);
      c.fillStyle = pal.dark; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = pal.line; c.stroke();
    }
    // spots
    c.fillStyle = rgba(pal.spot, 0.85);
    [[0.25, -0.6, 0.085], [0.45, -0.35, 0.06], [0.08, -0.82, 0.055], [0.52, -0.62, 0.045]].forEach(p => { ell(c, rx * p[0] / 0.66, by + ry * p[1], p[2], p[2] * 0.8); c.fill(); });
    // belly
    c.save(); ell(c, -rx * 0.1, by + ry * 0.25, rx * 0.6, ry * 0.62); c.fillStyle = pal.belly; c.fill();
    c.clip(); c.strokeStyle = rgba(pal.dark, 0.25); c.lineWidth = lw * 0.8;
    for (let i = 0; i < 4; i++) { const yy = by + ry * (-0.15 + i * 0.22); c.beginPath(); c.moveTo(-rx, yy); c.quadraticCurveTo(-rx * 0.1, yy + 0.06, rx, yy); c.stroke(); }
    c.restore();
    // mossy tufts
    if (g.tufts) {
      c.strokeStyle = '#3f6e2a'; c.lineWidth = lw * 1.2; c.lineCap = 'round';
      [[0.1, -0.95], [0.35, -0.85], [0.55, -0.6]].forEach((p, i) => {
        const px = rx * p[0] / 0.66, py = by + ry * p[1];
        for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + j * 0.05, py - 0.08, px + j * 0.08 + Math.sin(t * 2 + i) * 0.02, py - 0.14); c.stroke(); }
      });
    }
    // chonk tummy roll line
    if (g.chin) { c.beginPath(); c.arc(-rx * 0.1, by + ry * 0.1, rx * 0.5, 0.3, PI - 0.3); c.strokeStyle = rgba(pal.dark, 0.35); c.lineWidth = lw; c.stroke(); }
    // body dirt
    drawSpots(c, P.spots, 'body', 0, by, pal);

    // --- neck (in front of body)
    const L = Math.hypot(H.x - B.x, H.y - B.y);
    const bow = 0.2 + P.droop * 0.2;
    const N1 = { x: B.x + bow * 0.6, y: B.y - L * 0.45 };
    const N2 = { x: H.x + (B.x - H.x) * 0.1 + bow * 0.4, y: H.y + L * 0.4 };
    const nw0 = 0.44 + (g.chin ? 0.08 : 0), nw1 = hr * 0.95;
    const sides = tube(c, B, N1, N2, { x: H.x, y: H.y + hr * 0.3 }, nw0, nw1, pal.body, pal.line, lw, false);
    // throat stripe
    c.save(); c.globalAlpha *= g.stripe ? 0.9 : 0.7;
    tube(c, { x: B.x - 0.05, y: B.y + 0.05 }, { x: N1.x - 0.07, y: N1.y }, { x: N2.x - 0.05, y: N2.y }, { x: H.x - 0.03, y: H.y + hr * 0.4 },
      nw0 * 0.34, nw1 * 0.4, g.stripe ? '#ffffff' : pal.belly, null, 0, false);
    c.restore();
    hit.neck = sides;

    // --- front flippers
    [[-1, -0.6], [1, 0.45]].forEach(([sd, ox], i) => {
      c.save(); c.translate(rx * ox, -0.05);
      c.rotate(sd * (0.55 + Math.sin(P.flip + i * 1.3) * 0.22));
      ell(c, sd * 0.06, 0, 0.21, 0.1); gr = c.createLinearGradient(0, -0.1, 0, 0.1); gr.addColorStop(0, pal.body); gr.addColorStop(1, pal.dark);
      c.fillStyle = gr; c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke();
      c.strokeStyle = rgba(pal.line, 0.5); c.lineWidth = lw * 0.7;
      for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(sd * (0.13 + 0.02 * Math.abs(j)), j * 0.04); c.lineTo(sd * 0.22, j * 0.05); c.stroke(); }
      c.restore();
    });

    // --- head
    c.save(); c.translate(H.x, H.y); c.rotate(P.tilt);
    hit.headLocal = { x: H.x, y: H.y, r: hr * 1.1 };
    // frills
    if (g.frill > 0) {
      const fl = g.frill;
      [-1, 1].forEach(sd => {
        for (let i = 0; i < 3; i++) {
          const a = (sd < 0 ? PI : 0) + sd * (-0.55 + i * 0.4) + Math.sin(t * 2.2 + i + sd) * 0.06;
          const fx = Math.cos(a) * hr * 0.98, fy = Math.sin(a) * hr * 0.85 - hr * 0.15;
          c.save(); c.translate(fx, fy); c.rotate(a);
          ell(c, 0.12 * fl, 0, 0.16 * fl, 0.065 * fl); c.fillStyle = pal.frill; c.fill(); c.lineWidth = lw * 0.9; c.strokeStyle = pal.line; c.stroke();
          c.beginPath(); c.moveTo(0.02, 0); c.lineTo(0.22 * fl, 0); c.strokeStyle = pal.frillD; c.lineWidth = lw * 0.6; c.stroke();
          c.restore();
        }
      });
    }
    // little horn nubs
    if (!g.cap) {
      [-1, 1].forEach(sd => {
        c.save(); c.translate(sd * hr * 0.42, -hr * 0.86); c.rotate(sd * 0.3);
        ell(c, 0, 0, hr * 0.17, hr * 0.24); c.fillStyle = pal.light; c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke();
        ell(c, 0, -hr * 0.08, hr * 0.08, hr * 0.1); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
        c.restore();
      });
    }
    // head shape
    gr = c.createRadialGradient(-hr * 0.35, -hr * 0.45, hr * 0.1, 0, 0, hr * 1.25);
    gr.addColorStop(0, pal.light); gr.addColorStop(0.55, pal.body); gr.addColorStop(1, pal.dark);
    ell(c, 0, 0, hr * 1.12, hr); c.fillStyle = gr; c.fill(); c.lineWidth = lw; c.strokeStyle = pal.line; c.stroke();
    // muzzle
    ell(c, 0, hr * 0.42, hr * 0.74, hr * 0.44); c.fillStyle = pal.belly; c.fill();
    if (g.chin) { c.beginPath(); c.arc(0, hr * 0.62, hr * 0.5, 0.45, PI - 0.45); c.strokeStyle = rgba(pal.dark, 0.4); c.lineWidth = lw; c.stroke(); }
    // nostrils
    c.fillStyle = rgba(pal.line, 0.7);
    ell(c, -hr * 0.13, hr * 0.17, hr * 0.045, hr * 0.03, 0.4); c.fill(); ell(c, hr * 0.13, hr * 0.17, hr * 0.045, hr * 0.03, -0.4); c.fill();
    // cheeks
    const tum = P.tummy;
    c.fillStyle = tum > 0.1 ? 'rgba(140,200,90,' + (0.35 + tum * 0.4) + ')' : rgba(pal.cheek, 0.3 + P.blush * 0.5);
    ell(c, -hr * 0.7, hr * 0.28, hr * 0.17, hr * 0.11); c.fill(); ell(c, hr * 0.7, hr * 0.28, hr * 0.17, hr * 0.11); c.fill();
    // eyes
    const er = g.eyeR * (hr / 0.44) * 0.95 + 0.0;
    eye(c, -hr * 0.4, -hr * 0.12, er, P, pal, lw, -1);
    eye(c, hr * 0.4, -hr * 0.12, er, P, pal, lw, 1);
    brows(c, P.brow, hr, er, pal, lw);
    mouth(c, P, hr, pal, lw);
    drawSpots(c, P.spots, 'head', 0, 0, pal);
    // hats (a worn item replaces the eggshell cap / lily pad, except the side bow)
    const keepHat = !P.wear || P.wear === 'bow';
    if (g.cap && keepHat) eggCap(c, hr, lw, t);
    if (g.lily && keepHat) lilyHat(c, hr, lw, t);
    if (P.wear) drawWear(c, P.wear, hr, lw, t);
    // wet shine
    if (P.wet > 0) {
      c.save(); c.globalAlpha *= P.wet; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = lw * 1.4; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, hr * 0.85, PI * 1.15, PI * 1.4); c.stroke(); c.restore();
    }
    c.restore();
    if (P.wet > 0) {
      c.save(); c.globalAlpha *= P.wet; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = lw * 1.4; c.lineCap = 'round';
      c.beginPath(); c.arc(0, by, rx * 0.8, PI * 1.2, PI * 1.45); c.stroke();
      c.fillStyle = 'rgba(190,235,255,.9)';
      for (let i = 0; i < 4; i++) { const dy = ((t * 0.6 + i * 0.27) % 1); ell(c, -rx * 0.6 + i * rx * 0.4, by + ry * 0.2 + dy * ry * 0.7, 0.025, 0.04); c.fill(); }
      c.restore();
    }
    if (g.shine || P.sparkle > 0) {
      const n = g.shine ? 3 : 0;
      for (let i = 0; i < n + (P.sparkle > 0 ? 4 : 0); i++) {
        const ph = (t * 0.7 + i * 0.37) % 1, a = Math.sin(ph * PI);
        sparkle(c, Math.cos(i * 2.4) * rx * 1.1, by - ry * 0.4 + Math.sin(i * 1.7) * ry * 1.2 - (H.y < by ? 0.3 : 0), 0.06 + 0.03 * a, '#fff3a8', a * (P.sparkle > 0 ? 1 : 0.8));
      }
    }
    // screen-space hit areas
    const m = c.getTransform();
    const tp = (px, py) => { const p = m.transformPoint(new DOMPoint(px, py)); const d = c.canvas.__dpr || 1; return { x: p.x / d, y: p.y / d }; };
    const hc = tp(H.x, H.y), he = tp(H.x + hr, H.y), bc = tp(0, by), be = tp(rx, by + ry);
    hit.head = { x: hc.x, y: hc.y, r: Math.abs(he.x - hc.x) * 1.15 };
    hit.body = { x: bc.x, y: bc.y, rx: Math.abs(be.x - bc.x) * 1.05, ry: Math.abs(be.y - bc.y) * 1.1 };
    hit.mouth = tp(H.x, H.y + hr * 0.5);
    c.restore();
    return hit;
  }

  function drawSpots(c, spots, on, ox, oy, pal) {
    if (!spots || !spots.length) return;
    for (const s of spots) {
      if (s.on !== on || s.a <= 0.02) continue;
      c.save(); c.globalAlpha *= clamp(s.a * 1.1, 0, 1);
      const x = ox + s.x, y = oy + s.y, r = s.r * 1.25;
      // a wet mud splat: dark blob, a drip, a couple of flecks and a glossy highlight (reads as mud, not a leaf)
      c.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = i / 12 * TAU, rr = r * (0.9 + 0.1 * Math.sin(i * 2.7 + s.x * 40));   // round wet blob (no spiky leaf outline)
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
      }
      c.closePath(); c.fillStyle = '#6b5038'; c.fill();
      c.lineWidth = r * 0.2; c.strokeStyle = 'rgba(160,128,92,.85)'; c.stroke();
      ell(c, x + r * 0.35, y + r * 1.0, r * 0.15, r * 0.26); c.fillStyle = '#6b5038'; c.fill();
      ell(c, x - r * 1.15, y - r * 0.2, r * 0.17, r * 0.15); c.fill(); ell(c, x + r * 1.1, y - r * 0.55, r * 0.12, r * 0.11); c.fill();
      ell(c, x - r * 0.3, y - r * 0.32, r * 0.36, r * 0.2, -0.4); c.fillStyle = 'rgba(255,244,228,.6)'; c.fill();
      ell(c, x + r * 0.32, y + r * 0.22, r * 0.1, r * 0.08); c.fill();
      c.restore();
    }
  }

  function eye(c, ex, ey, e, P, pal, lw, side) {
    const st = P.eyeStyle;
    c.lineCap = 'round'; c.strokeStyle = pal.line;
    if (st === 'happy') {
      c.beginPath(); c.arc(ex, ey + e * 0.35, e * 0.6, PI * 1.15, PI * 1.85); c.lineWidth = lw * 1.9; c.stroke(); return;
    }
    if (st === 'closed') {
      c.beginPath(); c.arc(ex, ey - e * 0.15, e * 0.58, PI * 0.18, PI * 0.82); c.lineWidth = lw * 1.7; c.stroke();
      c.beginPath(); c.moveTo(ex + side * e * 0.5, ey + e * 0.15); c.lineTo(ex + side * e * 0.68, ey + e * 0.32); c.lineWidth = lw; c.stroke();
      return;
    }
    if (st === 'squint') {
      c.beginPath(); c.moveTo(ex - side * e * 0.45, ey - e * 0.35); c.lineTo(ex + side * e * 0.35, ey); c.lineTo(ex - side * e * 0.45, ey + e * 0.35);
      c.lineWidth = lw * 1.7; c.lineJoin = 'round'; c.stroke(); return;
    }
    // open eye
    ell(c, ex, ey, e * 0.84, e); c.fillStyle = '#fff'; c.fill(); c.lineWidth = lw; c.stroke();
    c.save(); ell(c, ex, ey, e * 0.84, e); c.clip();
    const pr = e * 0.62 * (P.pupil || 1);
    const px = ex + clamp(P.px, -1, 1) * e * 0.3, py = ey + clamp(P.py, -1, 1) * e * 0.28 + e * 0.06;
    const ig = c.createRadialGradient(px, py + pr * 0.4, pr * 0.1, px, py, pr);
    ig.addColorStop(0, pal.iris); ig.addColorStop(1, '#101c28');
    ell(c, px, py, pr * 0.92, pr); c.fillStyle = ig; c.fill();
    ell(c, px - pr * 0.32, py - pr * 0.38, pr * 0.34, pr * 0.3); c.fillStyle = '#fff'; c.fill();
    ell(c, px + pr * 0.36, py + pr * 0.36, pr * 0.14, pr * 0.14); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
    // eyelid
    const open = clamp(P.eye, 0, 1);
    if (open < 0.98) {
      const ly = ey - e + 2 * e * (1 - open);
      c.fillStyle = palLid(pal); c.fillRect(ex - e, ey - e - 0.01, e * 2, ly - (ey - e) + 0.01);
      c.beginPath(); c.moveTo(ex - e, ly); c.quadraticCurveTo(ex, ly + e * 0.18, ex + e, ly);
      c.lineWidth = lw * 1.2; c.strokeStyle = pal.line; c.stroke();
    }
    c.restore();
  }
  function palLid(pal) { return pal.body; }
  function brows(c, kind, hr, er, pal, lw) {
    if (kind === 'none') return;
    c.strokeStyle = pal.line; c.lineWidth = lw * 1.4; c.lineCap = 'round';
    [-1, 1].forEach(sd => {
      const x = sd * hr * 0.4, y = -hr * 0.12 - er * 1.25;
      c.beginPath();
      if (kind === 'sad') { c.moveTo(x - sd * er * 0.55, y - er * 0.18); c.lineTo(x + sd * er * 0.45, y + er * 0.12); }
      else { c.moveTo(x - sd * er * 0.55, y + er * 0.15); c.lineTo(x + sd * er * 0.45, y - er * 0.1); }
      c.stroke();
    });
  }
  function mouth(c, P, hr, pal, lw) {
    const my = hr * 0.48, w = hr * 0.26, o = clamp(P.mouthOpen, 0, 1);
    c.strokeStyle = pal.line; c.lineWidth = lw * 1.3; c.lineCap = 'round'; c.lineJoin = 'round';
    const k = P.mouth;
    if (o > 0.05 || k === 'open' || k === 'grin') {
      const oo = Math.max(o, k === 'grin' ? 0.5 : 0.3);
      c.beginPath();
      if (k === 'grin') { c.moveTo(-w * 1.2, my - hr * 0.04); c.quadraticCurveTo(0, my + hr * 0.42 * oo + hr * 0.05, w * 1.2, my - hr * 0.04); c.closePath(); }
      else ell(c, 0, my + hr * 0.05, w * (0.75 + oo * 0.25), hr * 0.06 + hr * 0.24 * oo);
      c.fillStyle = '#7a2a3a'; c.fill(); c.stroke();
      c.save(); c.clip();
      ell(c, 0, my + hr * 0.05 + hr * 0.2 * oo, w * 0.7, hr * 0.13 * (0.5 + oo)); c.fillStyle = '#ff8fa6'; c.fill();
      // tiny teeth
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-w * 0.45, my - hr * 0.05); c.lineTo(-w * 0.32, my + hr * 0.06); c.lineTo(-w * 0.2, my - hr * 0.05); c.fill();
      c.beginPath(); c.moveTo(w * 0.45, my - hr * 0.05); c.lineTo(w * 0.32, my + hr * 0.06); c.lineTo(w * 0.2, my - hr * 0.05); c.fill();
      c.restore();
      return;
    }
    c.beginPath();
    if (k === 'smile') { c.moveTo(-w, my); c.quadraticCurveTo(0, my + hr * 0.2, w, my); }
    else if (k === 'frown') { c.moveTo(-w * 0.8, my + hr * 0.1); c.quadraticCurveTo(0, my - hr * 0.06, w * 0.8, my + hr * 0.1); }
    else if (k === 'flat') { c.moveTo(-w * 0.6, my + hr * 0.04); c.lineTo(w * 0.6, my + hr * 0.04); }
    else if (k === 'o') { ell(c, 0, my + hr * 0.06, hr * 0.08, hr * 0.1); c.fillStyle = '#7a2a3a'; c.fill(); }
    else if (k === 'wavy') { c.moveTo(-w, my + hr * 0.05); for (let i = 1; i <= 4; i++) c.lineTo(-w + i * w / 2, my + hr * 0.05 + (i % 2 ? -1 : 1) * hr * 0.06); }
    else if (k === 'purr') { c.moveTo(-w, my); c.quadraticCurveTo(-w / 2, my + hr * 0.16, 0, my + hr * 0.02); c.quadraticCurveTo(w / 2, my + hr * 0.16, w, my); }
    c.stroke();
  }
  function eggCap(c, hr, lw, t) {
    c.save(); c.translate(hr * 0.1, -hr * 0.78); c.rotate(0.18 + Math.sin(t * 1.3) * 0.03);
    c.beginPath(); c.moveTo(-hr * 0.62, hr * 0.12);
    c.bezierCurveTo(-hr * 0.6, -hr * 0.45, hr * 0.6, -hr * 0.45, hr * 0.62, hr * 0.12);
    const zz = [0.62, 0.4, 0.2, 0, -0.2, -0.42, -0.62];
    zz.forEach((zx, i) => c.lineTo(zx * hr, hr * (i % 2 ? 0.0 : 0.16)));
    c.closePath();
    const g = c.createLinearGradient(0, -hr * 0.4, 0, hr * 0.15); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e8dcc0');
    c.fillStyle = g; c.fill(); c.lineWidth = lw; c.strokeStyle = '#5a4a3a'; c.stroke();
    c.fillStyle = '#7fcfc0'; [[-0.3, -0.12, 0.06], [0.15, -0.22, 0.05], [0.35, -0.02, 0.04]].forEach(p => { ell(c, p[0] * hr, p[1] * hr, p[2] * hr, p[2] * hr * 0.8); c.fill(); });
    c.restore();
  }
  function lilyHat(c, hr, lw, t) {
    c.save(); c.translate(-hr * 0.15, -hr * 0.92); c.rotate(-0.2 + Math.sin(t * 1.1) * 0.04);
    c.beginPath(); c.ellipse(0, 0, hr * 0.62, hr * 0.2, 0, 0.25, TAU - 0.25); c.lineTo(0, 0); c.closePath();
    c.fillStyle = '#5fae4a'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#2b5a20'; c.stroke();
    c.strokeStyle = 'rgba(40,90,30,.5)'; c.lineWidth = lw * 0.6;
    for (let i = 0; i < 5; i++) { const a = 0.6 + i * 1.1; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * hr * 0.5, Math.sin(a) * hr * 0.16); c.stroke(); }
    // flower
    c.translate(hr * 0.25, -hr * 0.12);
    for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * PI / 3); ell(c, 0, -hr * 0.1, hr * 0.06, hr * 0.11); c.fillStyle = i % 2 ? '#ffd1e3' : '#fff'; c.fill(); c.restore(); }
    ell(c, 0, 0, hr * 0.05, hr * 0.05); c.fillStyle = '#ffd34d'; c.fill();
    c.restore();
  }


  // ---------------------------------------------------------------- wearables (daily beach finds)
  /** Draw a wearable in head-local units (origin = head centre, already tilted). hr = head radius. */
  function drawWear(c, key, hr, lw, t) {
    const L = '#3a2633', sw = Math.sin(t * 1.3) * 0.03;
    if (img('wear_' + key)) {   // painted drop-in: bottom-centre sits on the top of the head
      c.save(); c.rotate(sw); const im = img('wear_' + key), w = hr * 1.7, h = w * im.height / im.width;
      c.drawImage(im, -w / 2, -hr * 0.62 - h, w, h); c.restore(); return;
    }
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    const out = (w) => { c.lineWidth = lw * (w || 1); c.strokeStyle = L; c.stroke(); };
    if (key === 'beanie') {
      c.translate(hr * 0.05, -hr * 0.8); c.rotate(0.12 + sw);
      c.beginPath(); c.moveTo(-hr * 0.66, 0); c.bezierCurveTo(-hr * 0.68, -hr * 0.8, hr * 0.68, -hr * 0.8, hr * 0.66, 0); c.closePath();
      let g = c.createLinearGradient(0, -hr * 0.7, 0, 0); g.addColorStop(0, '#f27a72'); g.addColorStop(1, '#c9404e');
      c.fillStyle = g; c.fill(); out();
      c.strokeStyle = 'rgba(110,20,40,.35)'; c.lineWidth = lw * 0.7;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * hr * 0.24, -hr * 0.04); c.quadraticCurveTo(i * hr * 0.22, -hr * 0.34, i * hr * 0.12, -hr * 0.52); c.stroke(); }
      c.beginPath(); c.roundRect(-hr * 0.72, -hr * 0.14, hr * 1.44, hr * 0.3, hr * 0.13); c.fillStyle = '#f7eedc'; c.fill(); out();
      c.strokeStyle = 'rgba(160,120,90,.45)'; c.lineWidth = lw * 0.6;
      for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * hr * 0.12, -hr * 0.08); c.lineTo(i * hr * 0.12, hr * 0.1); c.stroke(); }
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ell(c, Math.cos(a) * hr * 0.13, -hr * 0.66 + Math.sin(a) * hr * 0.12, hr * 0.1, hr * 0.1); c.fillStyle = '#fff8ee'; c.fill(); }
      ell(c, 0, -hr * 0.66, hr * 0.19, hr * 0.18); c.fillStyle = '#fff8ee'; c.fill(); out(0.8);
    } else if (key === 'sailor') {
      c.translate(-hr * 0.04, -hr * 0.86); c.rotate(-0.16 + sw);
      c.beginPath(); c.moveTo(-hr * 0.5, 0); c.bezierCurveTo(-hr * 0.56, -hr * 0.55, hr * 0.56, -hr * 0.55, hr * 0.5, 0); c.closePath();
      c.fillStyle = '#ffffff'; c.fill(); out();
      c.beginPath(); c.moveTo(-hr * 0.5, -hr * 0.1); c.quadraticCurveTo(0, -hr * 0.02, hr * 0.5, -hr * 0.1); c.lineWidth = hr * 0.11; c.strokeStyle = '#2b4f93'; c.stroke();
      ell(c, 0, hr * 0.02, hr * 0.64, hr * 0.14); c.fillStyle = '#eef2f6'; c.fill(); out();
      sparkle(c, hr * 0.18, -hr * 0.3, hr * 0.11, '#ffc933', 1);
    } else if (key === 'party') {
      c.translate(hr * 0.26, -hr * 0.8); c.rotate(0.3 + sw);
      c.beginPath(); c.moveTo(-hr * 0.36, 0); c.lineTo(0, -hr * 1.0); c.lineTo(hr * 0.36, 0); c.quadraticCurveTo(0, hr * 0.12, -hr * 0.36, 0); c.closePath();
      const g = c.createLinearGradient(-hr * 0.4, 0, hr * 0.4, 0); g.addColorStop(0, '#8fdcff'); g.addColorStop(1, '#3d8fe0');
      c.fillStyle = g; c.fill();
      c.save(); c.clip(); c.strokeStyle = '#ff74a6'; c.lineWidth = hr * 0.09;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-hr * 0.5, -hr * (0.08 + i * 0.26)); c.lineTo(hr * 0.5, -hr * (0.22 + i * 0.26)); c.stroke(); }
      c.fillStyle = '#ffe14d'; [[-0.12, -0.18], [0.14, -0.42], [-0.04, -0.62]].forEach(p => { ell(c, p[0] * hr, p[1] * hr, hr * 0.05, hr * 0.05); c.fill(); });
      c.restore();
      c.beginPath(); c.moveTo(-hr * 0.36, 0); c.lineTo(0, -hr * 1.0); c.lineTo(hr * 0.36, 0); c.quadraticCurveTo(0, hr * 0.12, -hr * 0.36, 0); out();
      ell(c, 0, -hr * 1.02, hr * 0.13, hr * 0.13); c.fillStyle = '#ff74a6'; c.fill(); out(0.8);
      sparkle(c, hr * 0.22, -hr * 1.12, hr * 0.12 * (0.6 + 0.4 * Math.abs(Math.sin(t * 3))), '#fff6b0', 1);
    } else if (key === 'flowers') {
      const n = 5, a0 = -PI * 0.86, a1 = -PI * 0.14;
      c.beginPath(); c.ellipse(0, 0, hr * 1.0, hr * 0.9, 0, a0, a1); c.lineWidth = hr * 0.07; c.strokeStyle = '#4f9a45'; c.stroke();
      const cols = ['#ffffff', '#ffc2d8', '#ffe27a', '#d4c2ff', '#ffb8a0'];
      for (let i = 0; i < n; i++) {
        const a = a0 + (a1 - a0) * i / (n - 1), x = Math.cos(a) * hr * 1.0, y = Math.sin(a) * hr * 0.9 + Math.sin(t * 2 + i) * hr * 0.01;
        const r = hr * (i === 2 ? 0.15 : 0.12);
        ell(c, x + r * 0.9, y + r * 0.5, r * 0.55, r * 0.28, 0.6); c.fillStyle = '#6cbf5c'; c.fill();
        for (let j = 0; j < 5; j++) { const b = j / 5 * TAU + i; ell(c, x + Math.cos(b) * r * 0.62, y + Math.sin(b) * r * 0.62, r * 0.48, r * 0.48); c.fillStyle = cols[i % cols.length]; c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = L; c.stroke(); }
        ell(c, x, y, r * 0.38, r * 0.38); c.fillStyle = i % 2 ? '#ff9f43' : '#ffd23f'; c.fill(); out(0.6);
      }
    } else if (key === 'leaf') {
      c.translate(hr * 0.32, -hr * 0.95); c.rotate(0.55 + sw * 2);
      leaf(c, 0, -hr * 0.22, hr * 0.44, '#e2492f', L, lw);
      c.strokeStyle = 'rgba(120,25,15,.55)'; c.lineWidth = lw * 0.7;
      [[0, -0.62], [0.32, -0.36], [-0.32, -0.36], [0.3, -0.05], [-0.3, -0.05]].forEach(p => { c.beginPath(); c.moveTo(0, -hr * 0.05); c.lineTo(p[0] * hr, p[1] * hr - hr * 0.1); c.stroke(); });
      c.beginPath(); c.moveTo(0, hr * 0.15); c.lineTo(0, hr * 0.32); c.lineWidth = lw * 1.3; c.strokeStyle = '#7a2a16'; c.stroke();
    } else if (key === 'shades') {
      c.translate(0, -hr * 0.8); c.rotate(-0.08 + sw * 0.5);
      [-1, 1].forEach(sd => { c.beginPath(); c.moveTo(sd * hr * 0.6, -hr * 0.02); c.lineTo(sd * hr * 0.92, hr * 0.12); c.lineWidth = lw * 1.6; c.strokeStyle = L; c.stroke(); });
      c.beginPath(); c.moveTo(-hr * 0.1, -hr * 0.03); c.quadraticCurveTo(0, -hr * 0.12, hr * 0.1, -hr * 0.03); c.lineWidth = lw * 2.4; c.strokeStyle = L; c.stroke(); c.lineWidth = lw * 1.2; c.strokeStyle = '#ff6f91'; c.stroke();
      [-1, 1].forEach(sd => {
        c.beginPath(); c.roundRect(sd * hr * 0.34 - hr * 0.27, -hr * 0.18, hr * 0.54, hr * 0.36, hr * 0.15);
        const g = c.createLinearGradient(0, -hr * 0.18, 0, hr * 0.18); g.addColorStop(0, '#3a4a6e'); g.addColorStop(1, '#141a2c');
        c.fillStyle = g; c.fill(); c.lineWidth = lw * 2.6; c.strokeStyle = L; c.stroke(); c.lineWidth = lw * 1.3; c.strokeStyle = '#ff6f91'; c.stroke();
        ell(c, sd * hr * 0.34 - hr * 0.1, -hr * 0.06, hr * 0.08, hr * 0.035, -0.5); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
      });
    } else if (key === 'goggles') {
      c.beginPath(); c.ellipse(0, hr * 0.08, hr * 1.1, hr * 0.86, 0, PI * 1.06, PI * 1.94);
      c.lineWidth = hr * 0.13 + lw * 2; c.strokeStyle = L; c.stroke(); c.lineWidth = hr * 0.13; c.strokeStyle = '#ff9f43'; c.stroke();
      [-1, 1].forEach(sd => {
        const x = sd * hr * 0.3, y = -hr * 0.76;
        const g = c.createRadialGradient(x - hr * 0.06, y - hr * 0.06, hr * 0.02, x, y, hr * 0.22); g.addColorStop(0, '#d8fbff'); g.addColorStop(1, '#4fb9d8');
        ell(c, x, y, hr * 0.22, hr * 0.19); c.fillStyle = g; c.fill(); c.lineWidth = lw * 3; c.strokeStyle = L; c.stroke(); c.lineWidth = lw * 1.6; c.strokeStyle = '#3fb6c8'; c.stroke();
        ell(c, x - hr * 0.08, y - hr * 0.06, hr * 0.06, hr * 0.035, -0.6); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
      });
    } else if (key === 'bow') {
      c.translate(hr * 0.66, -hr * 0.7); c.rotate(0.35 + sw);
      [-1, 1].forEach(sd => {
        c.beginPath(); c.moveTo(0, hr * 0.05); c.quadraticCurveTo(sd * hr * 0.12, hr * 0.3, sd * hr * 0.2, hr * 0.42); c.lineTo(sd * hr * 0.05, hr * 0.38); c.closePath();
        c.fillStyle = '#e2507f'; c.fill(); out(0.8);
      });
      [-1, 1].forEach(sd => {
        c.beginPath(); c.moveTo(0, 0);
        c.bezierCurveTo(sd * hr * 0.18, -hr * 0.34, sd * hr * 0.56, -hr * 0.26, sd * hr * 0.5, 0);
        c.bezierCurveTo(sd * hr * 0.56, hr * 0.24, sd * hr * 0.18, hr * 0.3, 0, 0);
        const g = c.createLinearGradient(0, -hr * 0.3, 0, hr * 0.3); g.addColorStop(0, '#ff9cc2'); g.addColorStop(1, '#ec5f8f');
        c.fillStyle = g; c.fill(); out();
        c.beginPath(); c.arc(sd * hr * 0.3, -hr * 0.02, hr * 0.14, PI * 1.1, PI * 1.5); c.lineWidth = lw; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
      });
      ell(c, 0, 0, hr * 0.11, hr * 0.13); c.fillStyle = '#d9467a'; c.fill(); out();
    } else if (key === 'crown') {
      c.translate(hr * 0.02, -hr * 0.84); c.rotate(0.1 + sw);
      c.beginPath(); c.moveTo(-hr * 0.5, 0); c.lineTo(-hr * 0.56, -hr * 0.5); c.lineTo(-hr * 0.27, -hr * 0.24); c.lineTo(0, -hr * 0.62); c.lineTo(hr * 0.27, -hr * 0.24); c.lineTo(hr * 0.56, -hr * 0.5); c.lineTo(hr * 0.5, 0); c.quadraticCurveTo(0, hr * 0.1, -hr * 0.5, 0); c.closePath();
      const g = c.createLinearGradient(0, -hr * 0.6, 0, hr * 0.05); g.addColorStop(0, '#fff2a0'); g.addColorStop(0.5, '#ffcc33'); g.addColorStop(1, '#d99a12');
      c.fillStyle = g; c.fill(); out();
      [[-0.56, -0.5], [0, -0.62], [0.56, -0.5]].forEach(p => { ell(c, p[0] * hr, p[1] * hr, hr * 0.07, hr * 0.07); c.fillStyle = '#fff6d0'; c.fill(); out(0.7); });
      [[-0.27, -0.09, '#ff5a7a'], [0, -0.07, '#4fb3e8'], [0.27, -0.09, '#5fd38a']].forEach(p => { ell(c, p[0] * hr, p[1] * hr, hr * 0.075, hr * 0.06); c.fillStyle = p[2]; c.fill(); out(0.6); });
      sparkle(c, -hr * 0.3, -hr * 0.42, hr * 0.12 * Math.abs(Math.sin(t * 2.5)), '#ffffff', 1);
    } else if (key === 'tophat') {
      c.translate(-hr * 0.08, -hr * 0.86); c.rotate(-0.15 + sw);
      ell(c, 0, 0, hr * 0.62, hr * 0.13); c.fillStyle = '#2a2a3a'; c.fill(); out();
      c.beginPath(); c.moveTo(-hr * 0.38, 0); c.lineTo(-hr * 0.34, -hr * 0.78); c.quadraticCurveTo(0, -hr * 0.86, hr * 0.34, -hr * 0.78); c.lineTo(hr * 0.38, 0); c.quadraticCurveTo(0, hr * 0.08, -hr * 0.38, 0); c.closePath();
      const g = c.createLinearGradient(-hr * 0.4, 0, hr * 0.4, 0); g.addColorStop(0, '#22222e'); g.addColorStop(0.35, '#4a4a60'); g.addColorStop(1, '#1c1c26');
      c.fillStyle = g; c.fill(); out();
      c.beginPath(); c.moveTo(-hr * 0.37, -hr * 0.1); c.quadraticCurveTo(0, -hr * 0.02, hr * 0.37, -hr * 0.1); c.lineTo(hr * 0.36, -hr * 0.24); c.quadraticCurveTo(0, -hr * 0.16, -hr * 0.36, -hr * 0.24); c.closePath(); c.fillStyle = '#e0505a'; c.fill();
      ell(c, -hr * 0.18, -hr * 0.5, hr * 0.05, hr * 0.2); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
      ell(c, hr * 0.26, -hr * 0.17, hr * 0.09, hr * 0.09); c.fillStyle = '#ffe066'; c.fill(); out(0.6);
    } else if (key === 'antlers') {
      c.beginPath(); c.ellipse(0, hr * 0.06, hr * 1.06, hr * 0.92, 0, PI * 1.12, PI * 1.88); c.lineWidth = hr * 0.1 + lw * 2; c.strokeStyle = L; c.stroke(); c.lineWidth = hr * 0.1; c.strokeStyle = '#7a4a2a'; c.stroke();
      [-1, 1].forEach(sd => {
        c.save(); c.translate(sd * hr * 0.55, -hr * 0.68); c.scale(sd, 1); c.rotate(-0.35 + Math.sin(t * 1.6) * 0.03);
        c.beginPath(); c.moveTo(-hr * 0.05, hr * 0.05); c.lineTo(hr * 0.12, -hr * 0.18);
        c.quadraticCurveTo(hr * 0.1, -hr * 0.42, hr * 0.02, -hr * 0.55); c.lineTo(hr * 0.16, -hr * 0.5); c.lineTo(hr * 0.2, -hr * 0.68); c.lineTo(hr * 0.32, -hr * 0.52);
        c.lineTo(hr * 0.42, -hr * 0.66); c.lineTo(hr * 0.5, -hr * 0.46); c.lineTo(hr * 0.64, -hr * 0.52); c.quadraticCurveTo(hr * 0.6, -hr * 0.22, hr * 0.3, -hr * 0.16);
        c.lineTo(hr * 0.12, hr * 0.06); c.closePath();
        const g = c.createLinearGradient(0, -hr * 0.6, 0, hr * 0.05); g.addColorStop(0, '#e8c99a'); g.addColorStop(1, '#a8794a');
        c.fillStyle = g; c.fill(); out();
        c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = lw; c.beginPath(); c.moveTo(hr * 0.16, -hr * 0.22); c.quadraticCurveTo(hr * 0.3, -hr * 0.36, hr * 0.48, -hr * 0.36); c.stroke();
        c.restore();
      });
    }
    c.restore();
  }

  /** Message-in-a-bottle half buried in the sand (ground point x,y), gently rocking with glints. */
  function drawBottle(c, x, y, s, t, open) {
    if (img('bottle')) { c.save(); c.translate(x, y); c.rotate(Math.sin(t * 2.2) * 0.05); drawImg(c, 'bottle', 0, s * 0.1, s * 1.3); c.restore(); return; }
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(40,40,60,.18)'; ell(c, 0, s * 0.06, s * 0.6, s * 0.12); c.fill();
    c.save(); c.rotate(-0.32 + Math.sin(t * 2.2) * 0.05); c.translate(0, -s * 0.12);
    c.lineJoin = 'round';
    c.beginPath(); c.roundRect(-s * 0.55, -s * 0.2, s * 0.84, s * 0.4, s * 0.17); c.roundRect(s * 0.24, -s * 0.1, s * 0.3, s * 0.2, s * 0.05);
    c.fillStyle = 'rgba(140,225,205,.6)'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#2f6a62'; c.stroke();
    if (!open) {
      c.beginPath(); c.roundRect(s * 0.52, -s * 0.11, s * 0.14, s * 0.22, s * 0.04); c.fillStyle = '#c98f55'; c.fill(); c.strokeStyle = '#6a4220'; c.stroke();
      c.beginPath(); c.roundRect(-s * 0.42, -s * 0.11, s * 0.56, s * 0.22, s * 0.1); c.fillStyle = '#fff4d6'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#a08050'; c.stroke();
      c.beginPath(); c.moveTo(-s * 0.15, -s * 0.11); c.lineTo(-s * 0.15, s * 0.11); c.strokeStyle = '#e0505a'; c.lineWidth = 2.5; c.stroke();
    }
    c.beginPath(); c.moveTo(-s * 0.45, -s * 0.13); c.lineTo(s * 0.12, -s * 0.13); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
    c.restore();
    c.fillStyle = '#e2c68e'; c.beginPath(); c.ellipse(-s * 0.05, s * 0.04, s * 0.55, s * 0.11, 0, PI, TAU); c.fill();
    c.fillStyle = '#d7b77a'; ell(c, s * 0.2, s * 0.02, s * 0.12, s * 0.04); c.fill();
    for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i * 0.33) % 1; sparkle(c, -s * 0.4 + i * s * 0.4, -s * 0.45 - i * s * 0.08, s * 0.16 * Math.sin(ph * PI), '#fff6b0', 1); }
    c.restore();
  }

  /** Ribbon medal. tier: 1 bronze, 2 silver, 3 gold. */
  function drawMedal(c, x, y, r, tier, t) {
    if (img('medal_' + tier)) { drawImg(c, 'medal_' + tier, x, y + r * 1.7, r * 2.2); return; }
    const C = [null, ['#f0a868', '#b9682e', '#7a3e14'], ['#f4f8fc', '#a7b4c6', '#56637a'], ['#ffe066', '#e0a514', '#8a5a00']][tier];
    if (!C) return;
    c.save(); c.translate(x, y); c.rotate(Math.sin((t || 0) * 2) * 0.05); c.lineJoin = 'round';
    [[-1, '#ff6f91'], [1, '#4fb3e8']].forEach(([sd, col]) => {
      c.beginPath(); c.moveTo(sd * r * 0.15, -r * 0.4); c.lineTo(sd * r * 0.75, r * 1.5); c.lineTo(sd * r * 0.42, r * 1.3); c.lineTo(sd * r * 0.3, r * 1.62); c.lineTo(-sd * r * 0.2, r * 0.1); c.closePath();
      c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#1e2f4a'; c.stroke();
    });
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, C[0]); g.addColorStop(1, C[1]);
    ell(c, 0, 0, r, r); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = '#1e2f4a'; c.stroke();
    ell(c, 0, 0, r * 0.72, r * 0.72); c.lineWidth = 2; c.strokeStyle = C[2]; c.globalAlpha = 0.5; c.stroke(); c.globalAlpha = 1;
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.22 : r * 0.5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
    c.fillStyle = C[2]; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
    ell(c, -r * 0.38, -r * 0.42, r * 0.16, r * 0.09, -0.7); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
    c.restore();
  }

  // ---------------------------------------------------------------- egg
  function drawEgg(c, x, y, s, E) {
    const w = s * 0.37, h = s * 0.8;
    if (img('egg') && !E.crack) { c.save(); c.translate(x, y); c.rotate(E.wobble); drawImg(c, 'egg', 0, w * 0.3, w * 3.2); c.restore(); return; }
    c.save(); c.translate(x, y);
    // nest
    c.fillStyle = 'rgba(120,90,50,.25)'; ell(c, 0, 0, w * 1.35, w * 0.32); c.fill();
    c.strokeStyle = '#a07a4a'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const a = PI + i / 8 * PI; c.beginPath(); c.moveTo(Math.cos(a) * w * 1.2, Math.sin(a) * w * 0.2 + 2); c.lineTo(Math.cos(a + 0.5) * w * 1.25, Math.sin(a + 0.5) * w * 0.25 + 4); c.stroke(); }
    // warm glow
    if (E.glow > 0.02) {
      const g = c.createRadialGradient(0, -h * 0.5, h * 0.2, 0, -h * 0.5, h * 1.1);
      g.addColorStop(0, 'rgba(255,190,110,' + 0.85 * E.glow + ')'); g.addColorStop(0.5, 'rgba(255,150,120,' + 0.35 * E.glow + ')'); g.addColorStop(1, 'rgba(255,170,120,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, -h * 0.5, h * 1.1, 0, TAU); c.fill();
    }
    c.rotate(E.wobble); c.scale(1 + (E.sq || 0), 1 - (E.sq || 0));
    const path = () => {
      c.beginPath(); c.moveTo(0, -h);
      c.bezierCurveTo(w * 0.75, -h, w, -h * 0.35, w, -h * 0.3 + h * 0.0);
      c.bezierCurveTo(w, h * 0.0 - h * 0.02, w * 0.6, 0, 0, 0);
      c.bezierCurveTo(-w * 0.6, 0, -w, -h * 0.02, -w, -h * 0.3);
      c.bezierCurveTo(-w, -h * 0.35, -w * 0.75, -h, 0, -h);
      c.closePath();
    };
    path();
    const g = c.createRadialGradient(-w * 0.35, -h * 0.7, w * 0.1, 0, -h * 0.4, h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e6f6ef'); g.addColorStop(1, '#a9d8cc');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    if (E.glow > 0.05) { c.fillStyle = 'rgba(255,170,130,' + 0.35 * E.glow + ')'; c.fillRect(-w, -h, w * 2, h); }
    // wavy band and speckles
    c.fillStyle = '#7fcfc0';
    c.beginPath(); c.moveTo(-w, -h * 0.42);
    for (let i = 0; i <= 8; i++) c.lineTo(-w + i * w / 4, -h * 0.42 + (i % 2 ? -1 : 1) * h * 0.04);
    for (let i = 8; i >= 0; i--) c.lineTo(-w + i * w / 4, -h * 0.3 + (i % 2 ? -1 : 1) * h * 0.04);
    c.closePath(); c.fill();
    c.fillStyle = '#5fb6a8';
    [[-0.4, -0.75, 0.07], [0.3, -0.82, 0.05], [0.5, -0.55, 0.06], [-0.55, -0.18, 0.05], [0.2, -0.15, 0.07], [-0.1, -0.6, 0.04]].forEach(p => { ell(c, p[0] * w, p[1] * h, p[2] * w, p[2] * w * 0.8); c.fill(); });
    // peeking eye through the crack
    if (E.peek > 0) {
      c.fillStyle = '#1d2a36'; ell(c, w * 0.1, -h * 0.62, w * 0.22, h * 0.07 * E.peek); c.fill();
      ell(c, w * 0.12 + E.look * w * 0.05, -h * 0.62, w * 0.07, h * 0.045 * E.peek); c.fillStyle = '#fff'; c.fill();
    }
    c.restore();
    path(); c.lineWidth = 3.2; c.strokeStyle = '#2f5a55'; c.stroke();
    // cracks
    if (E.crack > 0) {
      const cr = [[0, -h * 0.98], [w * 0.08, -h * 0.85], [-w * 0.07, -h * 0.75], [w * 0.15, -h * 0.66], [-w * 0.1, -h * 0.58], [w * 0.4, -h * 0.55], [w * 0.55, -h * 0.68], [-w * 0.35, -h * 0.5], [-w * 0.6, -h * 0.62]];
      const n = Math.ceil(E.crack * (cr.length - 1));
      c.beginPath(); c.moveTo(cr[0][0], cr[0][1]);
      for (let i = 1; i <= n; i++) c.lineTo(cr[i][0], cr[i][1]);
      c.strokeStyle = '#2f4a45'; c.lineWidth = 2.6; c.lineJoin = 'round'; c.stroke();
    }
    // shine
    c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, -w * 0.45, -h * 0.68, w * 0.12, h * 0.16, 0.4); c.fill();
    c.restore();
  }
  function drawShell(c, x, y, s, rot, half) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath();
    if (half) { c.moveTo(-s, 0); c.bezierCurveTo(-s, -s * 1.2, s, -s * 1.2, s, 0); for (let i = 0; i <= 6; i++) c.lineTo(s - i * s / 3, (i % 2 ? 0.25 : 0) * s); }
    else { c.moveTo(-s, 0); c.bezierCurveTo(-s, s * 1.0, s, s * 1.0, s, 0); for (let i = 0; i <= 6; i++) c.lineTo(s - i * s / 3, (i % 2 ? -0.25 : 0) * s); }
    c.closePath(); c.fillStyle = '#f2f6ee'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#2f5a55'; c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- food + props
  function drawFood(c, kind, x, y, s, bite) {
    if (!bite && img('food_' + kind)) { drawImg(c, 'food_' + kind, x, y + s * 0.6, s * 1.2); return; }
    c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
    const lw = Math.max(2, s * 0.06);
    bite = bite || 0;
    if (kind === 'perch') { drawFish(c, 0, 0, s * 1.1, 0, 'perch', 0); }
    else if (kind === 'berries') {
      const pts = [[-0.22, 0.05], [0.2, 0.08], [0, -0.14], [-0.1, 0.2], [0.14, -0.16], [0.28, -0.1]].slice(0, 6 - Math.floor(bite * 6));
      pts.forEach(p => {
        const g = c.createRadialGradient(p[0] * s - s * 0.05, p[1] * s - s * 0.05, 1, p[0] * s, p[1] * s, s * 0.2);
        g.addColorStop(0, '#8fa8ff'); g.addColorStop(1, '#2c3a8f');
        c.beginPath(); c.arc(p[0] * s, p[1] * s, s * 0.17, 0, TAU); c.fillStyle = g; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = '#1a2050'; c.stroke();
        c.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.lineTo(p[0] * s + Math.cos(a) * s * 0.05, p[1] * s - s * 0.1 + Math.sin(a) * s * 0.05); } c.closePath(); c.fillStyle = '#1a2050'; c.fill();
      });
      c.beginPath(); c.moveTo(0.05 * s, -0.25 * s); c.quadraticCurveTo(0.35 * s, -0.5 * s, 0.4 * s, -0.3 * s); c.quadraticCurveTo(0.2 * s, -0.25 * s, 0.05 * s, -0.25 * s);
      c.fillStyle = '#5bb04a'; c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = '#2a5a20'; c.stroke();
    } else if (kind === 'cookie') {
      // maple-leaf shaped cookie
      c.save(); if (bite > 0) { c.beginPath(); c.rect(-s, -s, s * 2, s * 2); c.arc(s * 0.45, -s * 0.2, s * (0.25 + bite * 0.35), 0, TAU, true); c.clip(); }
      leaf(c, 0, 0, s * 0.5, '#d9963f', '#7a4a18', lw);
      c.fillStyle = 'rgba(255,240,200,.75)'; c.beginPath(); c.arc(-s * 0.1, -s * 0.05, s * 0.05, 0, TAU); c.arc(s * 0.12, s * 0.1, s * 0.04, 0, TAU); c.fill();
      c.restore();
    } else if (kind === 'creemee') {
      // cone
      c.beginPath(); c.moveTo(-s * 0.26, -s * 0.05); c.lineTo(0, s * 0.62); c.lineTo(s * 0.26, -s * 0.05); c.closePath();
      c.fillStyle = '#e0a45a'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#7a4a18'; c.stroke();
      c.save(); c.clip(); c.strokeStyle = 'rgba(122,74,24,.45)'; c.lineWidth = lw * 0.6;
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * s * 0.12 - s * 0.3, -s * 0.05); c.lineTo(i * s * 0.12 + s * 0.3, s * 0.6); c.stroke(); c.beginPath(); c.moveTo(i * s * 0.12 + s * 0.3, -s * 0.05); c.lineTo(i * s * 0.12 - s * 0.3, s * 0.6); c.stroke(); }
      c.restore();
      // soft-serve swirl (maple cream)
      const tiers = [[0, -s * 0.12, s * 0.33, s * 0.15], [0, -s * 0.3, s * 0.26, s * 0.13], [0.02 * s, -s * 0.46, s * 0.17, s * 0.11]];
      const bt = Math.floor(bite * 3);
      tiers.slice(0, 3 - bt).forEach(tr => { ell(c, tr[0], tr[1], tr[2], tr[3]); c.fillStyle = '#fbe9c8'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#8a5a28'; c.stroke(); ell(c, tr[0] - tr[2] * 0.35, tr[1] - tr[3] * 0.3, tr[2] * 0.3, tr[3] * 0.3); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); });
      if (bt < 3) { c.beginPath(); c.moveTo(0.02 * s, -s * (0.55 - bt * 0.17)); c.quadraticCurveTo(s * 0.1, -s * (0.65 - bt * 0.17), s * 0.06, -s * (0.7 - bt * 0.17)); c.lineWidth = lw * 1.4; c.strokeStyle = '#fbe9c8'; c.stroke(); }
    }
    c.restore();
  }
  function leaf(c, x, y, r, fill, line, lw) {
    c.save(); c.translate(x, y); c.beginPath();
    const pts = [[0, -1], [0.18, -0.55], [0.5, -0.7], [0.42, -0.3], [0.95, -0.25], [0.75, 0.05], [0.95, 0.2], [0.45, 0.3], [0.5, 0.55], [0.1, 0.42], [0.06, 0.95], [-0.06, 0.95], [-0.1, 0.42], [-0.5, 0.55], [-0.45, 0.3], [-0.95, 0.2], [-0.75, 0.05], [-0.95, -0.25], [-0.42, -0.3], [-0.5, -0.7], [-0.18, -0.55]];
    pts.forEach(p => c.lineTo(p[0] * r, p[1] * r)); c.closePath();
    c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = lw || 2; c.strokeStyle = line; c.stroke(); }
    c.restore();
  }
  function drawFish(c, x, y, s, ang, kind, t) {
    c.save(); c.translate(x, y); c.rotate(ang); c.lineJoin = 'round';
    const lw = Math.max(1.8, s * 0.05);
    if (kind === 'boot') {
      c.rotate(-ang * 0.5 + Math.sin(t * 6) * 0.2);
      c.beginPath(); c.moveTo(-s * 0.2, -s * 0.45); c.lineTo(s * 0.12, -s * 0.45); c.lineTo(s * 0.12, s * 0.05); c.lineTo(s * 0.45, s * 0.12); c.quadraticCurveTo(s * 0.55, s * 0.32, s * 0.4, s * 0.32); c.lineTo(-s * 0.22, s * 0.32); c.closePath();
      c.fillStyle = '#6b4a32'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#2a1a10'; c.stroke();
      c.fillStyle = '#3a2a1e'; c.fillRect(-s * 0.24, s * 0.24, s * 0.68, s * 0.08);
      c.strokeStyle = '#d8c8a0'; c.lineWidth = lw * 0.7; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-s * 0.1, -s * 0.3 + i * s * 0.1); c.lineTo(s * 0.06, -s * 0.32 + i * s * 0.1); c.stroke(); }
      // drip
      c.fillStyle = 'rgba(160,220,255,.9)'; ell(c, -s * 0.15, s * 0.42 + (t * 30 % 10), s * 0.03, s * 0.05); c.fill();
      c.restore(); return;
    }
    const gold = kind === 'gold';
    const L = s * 0.5, Hh = s * 0.2;
    // tail
    c.beginPath(); c.moveTo(-L * 0.85, 0); c.lineTo(-L * 1.25, -Hh * 0.9 + Math.sin(t * 20) * 2); c.quadraticCurveTo(-L * 1.12, 0, -L * 1.25, Hh * 0.9 + Math.sin(t * 20) * 2); c.closePath();
    c.fillStyle = gold ? '#ffb02e' : '#f08a3a'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#3a2410'; c.stroke();
    // fins
    c.beginPath(); c.moveTo(-L * 0.3, -Hh * 0.9); c.quadraticCurveTo(0, -Hh * 1.8, L * 0.25, -Hh * 0.95); c.closePath(); c.fillStyle = gold ? '#ffcc4a' : '#c7a24a'; c.fill(); c.stroke();
    // body
    ell(c, 0, 0, L, Hh);
    const g = c.createLinearGradient(0, -Hh, 0, Hh);
    if (gold) { g.addColorStop(0, '#fff1a0'); g.addColorStop(0.5, '#ffd23f'); g.addColorStop(1, '#e8a414'); }
    else { g.addColorStop(0, '#8bae4a'); g.addColorStop(0.5, '#d9cf6a'); g.addColorStop(1, '#f2ead0'); }
    c.fillStyle = g; c.fill(); c.lineWidth = lw; c.strokeStyle = '#3a2a10'; c.stroke();
    c.save(); ell(c, 0, 0, L, Hh); c.clip();
    c.fillStyle = gold ? 'rgba(220,140,10,.4)' : 'rgba(60,80,30,.45)';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-L * 0.55 + i * L * 0.27, -Hh); c.lineTo(-L * 0.45 + i * L * 0.27, -Hh); c.lineTo(-L * 0.5 + i * L * 0.27, Hh * 0.3); c.closePath(); c.fill(); }
    c.restore();
    c.beginPath(); c.arc(L * 0.58, -Hh * 0.18, Hh * 0.28, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = lw * 0.7; c.stroke();
    c.beginPath(); c.arc(L * 0.62, -Hh * 0.18, Hh * 0.15, 0, TAU); c.fillStyle = '#111'; c.fill();
    c.beginPath(); c.moveTo(L * 0.82, Hh * 0.25); c.lineTo(L * 0.95, Hh * 0.18); c.lineWidth = lw * 0.8; c.stroke();
    if (gold) sparkle(c, L * 0.2, -Hh * 0.5, s * 0.12, '#fff', 0.6 + 0.4 * Math.sin(t * 9));
    c.restore();
  }
  function drawBubble(c, x, y, r, kind, t) {
    c.save(); c.translate(x, y);
    if (kind === 'urchin') {
      c.strokeStyle = '#3a1a4a'; c.lineWidth = Math.max(2, r * 0.1);
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); c.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); c.stroke(); }
      const g = c.createRadialGradient(-r * 0.2, -r * 0.2, 1, 0, 0, r * 0.7); g.addColorStop(0, '#b77ad8'); g.addColorStop(1, '#5a2a7a');
      c.beginPath(); c.arc(0, 0, r * 0.66, 0, TAU); c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.stroke();
      // grumpy face
      c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 0.32, -r * 0.18); c.lineTo(-r * 0.1, -r * 0.08); c.moveTo(r * 0.32, -r * 0.18); c.lineTo(r * 0.1, -r * 0.08); c.stroke();
      c.beginPath(); c.arc(0, r * 0.28, r * 0.16, PI * 1.15, PI * 1.85); c.stroke();
      c.restore(); return;
    }
    const rb = kind === 'rainbow';
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    if (rb) { const h = (t * 120) % 360; g.addColorStop(0, 'hsla(' + h + ',90%,90%,.5)'); g.addColorStop(0.7, 'hsla(' + (h + 120) + ',90%,70%,.35)'); g.addColorStop(1, 'hsla(' + (h + 240) + ',90%,65%,.8)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(0.75, 'rgba(170,230,255,.22)'); g.addColorStop(1, 'rgba(120,200,255,.6)'); }
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = g; c.fill();
    c.lineWidth = Math.max(1.5, r * 0.07); c.strokeStyle = rb ? 'rgba(255,255,255,.9)' : 'rgba(225,248,255,.95)'; c.stroke();
    c.beginPath(); c.ellipse(-r * 0.38, -r * 0.4, r * 0.24, r * 0.13, -0.7, 0, TAU); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
    c.beginPath(); c.arc(r * 0.42, r * 0.38, r * 0.07, 0, TAU); c.fill();
    if (rb) sparkle(c, 0, 0, r * 0.45, '#fff', 0.7 + 0.3 * Math.sin(t * 8));
    c.restore();
  }
  function drawDuck(c, x, y, s, t, mad) {
    if (img('duck')) { drawImg(c, 'duck', x, y + s * 0.3, s * 1.5); return; }
    c.save(); c.translate(x, y); c.lineJoin = 'round';
    const lw = Math.max(2, s * 0.06);
    ell(c, 0, 0, s * 0.5, s * 0.3); c.fillStyle = '#fff6d8'; c.fill(); c.lineWidth = lw; c.strokeStyle = '#4a3a20'; c.stroke();
    c.beginPath(); c.moveTo(-s * 0.45, -s * 0.05); c.lineTo(-s * 0.7, -s * 0.25); c.lineTo(-s * 0.5, s * 0.08); c.closePath(); c.fill(); c.stroke();
    ell(c, s * 0.05, -s * 0.05, s * 0.22, s * 0.12, -0.3); c.fillStyle = '#efe0b0'; c.fill(); c.stroke();
    c.beginPath(); c.arc(s * 0.32, -s * 0.38, s * 0.22, 0, TAU); c.fillStyle = '#3f8f4a'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(s * 0.5, -s * 0.38); c.quadraticCurveTo(s * 0.8, -s * 0.36, s * 0.75, -s * 0.28); c.quadraticCurveTo(s * 0.6, -s * 0.24, s * 0.48, -s * 0.3); c.closePath(); c.fillStyle = '#ffa63a'; c.fill(); c.stroke();
    c.beginPath(); c.arc(s * 0.38, -s * 0.44, s * 0.05, 0, TAU); c.fillStyle = '#111'; c.fill();
    if (mad) { c.strokeStyle = '#111'; c.lineWidth = lw; c.beginPath(); c.moveTo(s * 0.28, -s * 0.56); c.lineTo(s * 0.46, -s * 0.5); c.stroke(); }
    c.restore();
  }
  function drawLilyPad(c, x, y, r, flower, t) {
    c.save(); c.translate(x, y); c.scale(1, 0.45);
    c.beginPath(); c.arc(0, 0, r, 0.3, TAU - 0.05); c.lineTo(0, 0); c.closePath();
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r); g.addColorStop(0, '#8fd06a'); g.addColorStop(1, '#3f8a3a');
    c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = '#24561f'; c.stroke();
    c.strokeStyle = 'rgba(30,80,30,.4)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = 0.6 + i; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); c.stroke(); }
    c.restore();
    if (flower) {
      c.save(); c.translate(x - r * 0.3, y - r * 0.15);
      for (let i = 0; i < 6; i++) { c.save(); c.rotate(i * PI / 3 + Math.sin(t) * 0.05); ell(c, 0, -r * 0.14, r * 0.07, r * 0.15); c.fillStyle = i % 2 ? '#ffc2da' : '#fff'; c.fill(); c.restore(); }
      ell(c, 0, 0, r * 0.06, r * 0.06); c.fillStyle = '#ffd34d'; c.fill(); c.restore();
    }
  }
  function drawTourist(c, x, y, s, t, kind, flash) {
    if (img('tourist')) { drawImg(c, 'tourist', x, y, s * 1.0); return; }
    // kind: 0..3 outfit variations; winter adds hat/scarf
    const outfits = [['#ff6b6b', '#2f4a7a', '#ffd166'], ['#4ecdc4', '#3a3a3a', '#ff9f1c'], ['#ffd166', '#5a4a8a', '#e76f51'], ['#a0c4ff', '#7a4a2a', '#ff70a6']];
    const o = outfits[kind % 4];
    c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
    const lw = Math.max(2, s * 0.05);
    c.strokeStyle = '#2a2030'; c.lineWidth = lw;
    // legs
    c.fillStyle = o[1]; c.fillRect(-s * 0.16, -s * 0.5, s * 0.13, s * 0.5); c.strokeRect(-s * 0.16, -s * 0.5, s * 0.13, s * 0.5);
    c.fillRect(s * 0.03, -s * 0.5, s * 0.13, s * 0.5); c.strokeRect(s * 0.03, -s * 0.5, s * 0.13, s * 0.5);
    // body
    c.beginPath(); c.moveTo(-s * 0.26, -s * 0.48); c.lineTo(-s * 0.22, -s * 1.05); c.quadraticCurveTo(0, -s * 1.15, s * 0.22, -s * 1.05); c.lineTo(s * 0.26, -s * 0.48); c.closePath();
    c.fillStyle = o[0]; c.fill(); c.stroke();
    // head
    c.beginPath(); c.arc(0, -s * 1.3, s * 0.22, 0, TAU); c.fillStyle = '#f2c9a0'; c.fill(); c.stroke();
    // hat
    c.beginPath(); c.ellipse(0, -s * 1.46, s * 0.3, s * 0.07, 0, 0, TAU); c.fillStyle = o[2]; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-s * 0.17, -s * 1.46); c.quadraticCurveTo(0, -s * 1.72, s * 0.17, -s * 1.46); c.fill(); c.stroke();
    // camera held up to face
    c.fillStyle = '#333'; c.fillRect(-s * 0.32, -s * 1.38, s * 0.26, s * 0.18); c.strokeRect(-s * 0.32, -s * 1.38, s * 0.26, s * 0.18);
    c.beginPath(); c.arc(-s * 0.19, -s * 1.29, s * 0.06, 0, TAU); c.fillStyle = '#7fb3ff'; c.fill();
    // arm
    c.beginPath(); c.moveTo(-s * 0.2, -s * 0.95); c.lineTo(-s * 0.3, -s * 1.2); c.lineWidth = lw * 2.2; c.strokeStyle = o[0]; c.stroke();
    if (flash > 0) {
      const g = c.createRadialGradient(-s * 0.32, -s * 1.3, 1, -s * 0.32, -s * 1.3, s * 1.2 * flash);
      g.addColorStop(0, 'rgba(255,255,240,' + flash + ')'); g.addColorStop(1, 'rgba(255,255,240,0)');
      c.fillStyle = g; c.beginPath(); c.arc(-s * 0.32, -s * 1.3, s * 1.2 * flash + 1, 0, TAU); c.fill();
    }
    c.restore();
  }
  function drawPaddler(c, x, y, s, t, col) {
    c.save(); c.translate(x, y);
    c.fillStyle = col || '#ffd166'; c.strokeStyle = '#1f2a3a'; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, s * 1.1, s * 0.12, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#1f2a3a';
    c.fillRect(-s * 0.08, -s * 0.9, s * 0.16, s * 0.9);
    c.beginPath(); c.arc(0, -s * 1.05, s * 0.17, 0, TAU); c.fill();
    c.strokeStyle = '#1f2a3a'; c.lineWidth = 1.4; const a = Math.sin(t * 2) * 0.4;
    c.beginPath(); c.moveTo(Math.sin(a) * s * 0.5, -s * 1.2); c.lineTo(-Math.sin(a) * s * 0.6, s * 0.3); c.stroke();
    c.restore();
  }
  function drawSailboat(c, x, y, s) {
    c.save(); c.translate(x, y); c.strokeStyle = '#1f2a3a'; c.lineWidth = 1.2;
    c.fillStyle = '#f4f1e8'; c.beginPath(); c.moveTo(0, -s * 1.9); c.lineTo(0, -s * 0.2); c.lineTo(s * 0.9, -s * 0.25); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-s * 0.05, -s * 1.6); c.lineTo(-s * 0.6, -s * 0.3); c.lineTo(-s * 0.05, -s * 0.3); c.closePath(); c.fillStyle = '#ffd7a8'; c.fill(); c.stroke();
    c.fillStyle = '#c0504d'; c.beginPath(); c.moveTo(-s * 0.8, -s * 0.15); c.lineTo(s * 0.9, -s * 0.15); c.lineTo(s * 0.6, s * 0.12); c.lineTo(-s * 0.55, s * 0.12); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  function drawNote(c, x, y, s, t) {
    if (img('note')) { drawImg(c, 'note', x + s * 0.4, y, s * 1.1); return; }
    // a little paper note on a driftwood stick, flapping
    c.save(); c.translate(x, y); c.lineJoin = 'round';
    c.strokeStyle = '#5a3a1a'; c.lineWidth = s * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.04, -s * 1.0); c.stroke();
    c.rotate(Math.sin(t * 2.5) * 0.06);
    c.translate(s * 0.04, -s * 0.95);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.75, s * 0.06 + Math.sin(t * 3) * s * 0.03); c.lineTo(s * 0.72, s * 0.6); c.lineTo(0, s * 0.55); c.closePath();
    c.fillStyle = '#fff8e6'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#6a5030'; c.stroke();
    c.strokeStyle = 'rgba(80,90,140,.6)'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(s * 0.1, s * (0.18 + i * 0.12)); c.lineTo(s * 0.6, s * (0.2 + i * 0.12)); c.stroke(); }
    heart(c, s * 0.58, s * 0.48, s * 0.07, '#ff8fa6');
    c.restore();
  }
  function drawFly(c, x, y, t) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(220,235,255,.8)'; const w = Math.abs(Math.sin(t * 60)) * 4 + 2;
    ell(c, -2, -3, w, 2.5, -0.5); c.fill(); ell(c, 2, -3, w, 2.5, 0.5); c.fill();
    c.fillStyle = '#222'; ell(c, 0, 0, 3.2, 2.6); c.fill();
    c.restore();
  }
  function drawZ(c, x, y, s, a) {
    c.save(); c.globalAlpha *= a; c.font = '800 ' + s + 'px Fredoka, Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = s * 0.18; c.strokeStyle = '#1b2a4a'; c.strokeText('z', x, y); c.fillStyle = '#e8f0ff'; c.fillText('z', x, y); c.restore();
  }
  function drawMoon(c, x, y, r, a) {
    c.save(); c.globalAlpha *= a;
    const g = c.createRadialGradient(x, y, r * 0.8, x, y, r * 3); g.addColorStop(0, 'rgba(255,250,220,.35)'); g.addColorStop(1, 'rgba(255,250,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#fff6d6'; c.fill();
    c.fillStyle = 'rgba(220,210,170,.6)'; ell(c, x - r * 0.3, y - r * 0.2, r * 0.18, r * 0.15); c.fill(); ell(c, x + r * 0.25, y + r * 0.3, r * 0.12, r * 0.1); c.fill(); ell(c, x + r * 0.35, y - r * 0.35, r * 0.08, r * 0.08); c.fill();
    c.restore();
  }

  // ---------------------------------------------------------------- scene
  // sky color keyframes by hour [hour, top, bottom]
  const SKY = [
    [0, '#0d1633', '#24325e'], [5, '#1b2450', '#4a4f86'], [6.5, '#6f7fc0', '#ffb98a'], [8.5, '#79b8ef', '#cfe9ff'],
    [16.5, '#6aaee8', '#d6eeff'], [18.5, '#7d6fb8', '#ffb07a'], [20, '#2b2f66', '#a86a8a'], [21.5, '#111a3d', '#2c3768'], [24, '#0d1633', '#24325e'],
  ];
  function skyAt(h) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  function nightness(h) {   // 0 day .. 1 night
    if (h < 5 || h >= 21.5) return 1;
    if (h < 7) return 1 - (h - 5) / 2;
    if (h > 18.5) return (h - 18.5) / 3;
    return 0;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  let cache = null, cacheKey = '';
  /** Static part of the scene (sky, mountains, beach decorations) cached per size/season/hour bucket. */
  function sceneStatic(W, H, L, env, dpr) {
    const key = [W, H, env.season, Math.round(env.hour * 4), env.ice, L.horizon, L.shore, dpr, !!env.lake].join('|');
    if (cache && key === cacheKey) return cache;
    const cv = cache && cache.width === Math.round(W * dpr) && cache.height === Math.round(H * dpr) ? cache : document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hz = L.horizon, sh = L.shore, season = env.season, nt = nightness(env.hour);
    const R = rng(7);
    // sky
    const [st, sb] = skyAt(env.hour);
    let g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, st); g.addColorStop(1, sb);
    c.fillStyle = g; c.fillRect(0, 0, W, hz + 2);
    // sun
    if (nt < 0.8) {
      const hrs = env.hour, sx = W * (0.12 + 0.76 * clamp((hrs - 6) / 13, 0, 1)), sy = hz * (0.75 - 0.5 * Math.sin(clamp((hrs - 6) / 13, 0, 1) * PI));
      g = c.createRadialGradient(sx, sy, 4, sx, sy, 70); g.addColorStop(0, 'rgba(255,245,200,' + (0.9 * (1 - nt)) + ')'); g.addColorStop(1, 'rgba(255,230,160,0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 70, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,248,220,' + (1 - nt) + ')'; c.beginPath(); c.arc(sx, sy, 18, 0, TAU); c.fill();
    }
    // mountains (two ridges across the lake)
    const ridge = (base, amp, seed, col, snow) => {
      const r2 = rng(seed); const ph = [r2() * 6, r2() * 6, r2() * 6];
      c.beginPath(); c.moveTo(0, hz + 1);
      const pts = [];
      for (let x = 0; x <= W + 8; x += 8) {
        const u = x / W;
        const y = base - amp * (0.55 + 0.25 * Math.sin(u * 5.1 + ph[0]) + 0.15 * Math.sin(u * 11.3 + ph[1]) + 0.08 * Math.sin(u * 23 + ph[2]));
        pts.push([x, y]); c.lineTo(x, y);
      }
      c.lineTo(W, hz + 1); c.closePath(); c.fillStyle = col; c.fill();
      if (snow) {   // a real snowcap: follows the ridge, deeper on the peaks, with a ragged lower edge
        c.save(); c.clip();
        const thr = base - amp * 0.6;
        c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1] - 1) : c.moveTo(p[0], p[1] - 1));
        for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i], d = Math.max(0, thr - p[1]); c.lineTo(p[0], p[1] + d * 1.3 + Math.min(1, d / 5) * (3 + Math.sin(p[0] * 0.37) * 3.5)); }
        c.closePath(); c.fillStyle = mix('#f6faff', '#7d86b4', nt); c.fill();
        c.globalAlpha = 0.35; c.fillStyle = mix('#b9c9e6', '#4a5488', nt);   // shaded slopes
        c.beginPath(); pts.forEach((p, i) => { const d = Math.max(0, thr - p[1]); const y = p[1] + d * 1.3; if (i % 6 < 3) { c.moveTo(p[0], p[1] + 2); c.lineTo(p[0] + 8, y); c.lineTo(p[0], y); } }); c.fill();
        c.restore();
      }
    };
    const dusk = (a, b) => mix(a, b, nt);
    const seasonTint = { summer: ['#7d9cc4', '#5b7fa8'], fall: ['#9a8fb4', '#8a6f8a'], winter: ['#a9bdd8', '#8aa2c4'], spring: ['#86a6c8', '#6a8db4'] }[season];
    ridge(hz - 2, H * 0.08, 3, dusk(seasonTint[0], '#2a3360'), season === 'winter' || season === 'spring');
    ridge(hz + 1, H * 0.045, 9, dusk(seasonTint[1], '#1f2850'), season === 'winter');
    // far shore treeline on the left with a tiny lighthouse on a breakwater
    c.fillStyle = dusk('#3d5a6a', '#18203f');
    c.fillRect(0, hz - 3, W, 4);
    const lhx = W * 0.14, lhy = hz + H * 0.012;
    c.fillStyle = dusk('#58646e', '#252a44'); c.fillRect(lhx - W * 0.1, lhy, W * 0.2, 3);
    c.fillStyle = dusk('#f4f1e8', '#8a8fb0'); c.fillRect(lhx - 3, lhy - 16, 6, 16);
    c.fillStyle = dusk('#c94a42', '#5a3050'); c.fillRect(lhx - 4, lhy - 20, 8, 5);
    if (nt > 0.3) { g = c.createRadialGradient(lhx, lhy - 18, 1, lhx, lhy - 18, 22); g.addColorStop(0, 'rgba(255,240,180,.8)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.beginPath(); c.arc(lhx, lhy - 18, 22, 0, TAU); c.fill(); }
    // lake
    g = c.createLinearGradient(0, hz, 0, sh);
    const lakeTop = { summer: '#4f8fc8', fall: '#4a7fae', winter: '#7aa0c0', spring: '#4f88b8' }[season];
    const lakeBot = { summer: '#2f6f9e', fall: '#2c5f86', winter: '#5a84a6', spring: '#2f6a96' }[season];
    g.addColorStop(0, dusk(lakeTop, '#1a2a50')); g.addColorStop(1, dusk(lakeBot, '#0f1a38'));
    c.fillStyle = g; c.fillRect(0, hz, W, sh - hz + 2);
    // sky reflection band
    g = c.createLinearGradient(0, hz, 0, hz + (sh - hz) * 0.5); g.addColorStop(0, rgba('#ffffff', 0.18 * (1 - nt))); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, hz, W, (sh - hz) * 0.5);
    // ice
    if (env.ice) {
      c.fillStyle = dusk('#dbe9f2', '#5a6a90');
      c.beginPath(); c.moveTo(0, sh - (sh - hz) * 0.55);
      for (let x = 0; x <= W; x += W / 10) c.lineTo(x, sh - (sh - hz) * (0.5 + 0.08 * Math.sin(x * 0.05)));
      c.lineTo(W, sh + 2); c.lineTo(0, sh + 2); c.closePath(); c.fill();
      c.strokeStyle = rgba('#9ab8d0', 0.8); c.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const x = R() * W, y = sh - R() * (sh - hz) * 0.45; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20 + R() * 30, y + R() * 8 - 4); c.lineTo(x + 30 + R() * 30, y + R() * 10); c.stroke(); }
    }
    // beach
    const sandTop = { summer: '#ecd29a', fall: '#d8bf8c', winter: '#f2f6fa', spring: '#dcc68f' }[season];
    const sandBot = { summer: '#d9b277', fall: '#c3a06a', winter: '#d6e2ee', spring: '#c9ab72' }[season];
    g = c.createLinearGradient(0, sh, 0, H); g.addColorStop(0, dusk(sandTop, '#4a4a6a')); g.addColorStop(1, dusk(sandBot, '#2a2a48'));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, sh + 6);
    for (let x = 0; x <= W; x += 10) c.lineTo(x, sh + 6 + Math.sin(x * 0.02) * 4);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    // wet sand band
    c.fillStyle = rgba(season === 'winter' ? '#b8c8d8' : '#a8875a', 0.35 * (1 - nt * 0.5));
    c.beginPath(); c.moveTo(0, sh + 6); for (let x = 0; x <= W; x += 10) c.lineTo(x, sh + 6 + Math.sin(x * 0.02) * 4);
    for (let x = W; x >= 0; x -= 10) c.lineTo(x, sh + 18 + Math.sin(x * 0.02 + 1) * 5); c.closePath(); c.fill();
    // pebbles + texture
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = sh + 24 + R() * (H - sh - 24), r = 1 + R() * 3.5 * (y / H);
      c.fillStyle = season === 'winter' ? rgba('#9fb4c8', 0.5) : rgba(R() < 0.5 ? '#9a8060' : '#b8a080', 0.55 * (1 - nt * 0.5));
      ell(c, x, y, r * 1.3, r); c.fill();
    }
    if (!env.lake) {
    // driftwood log on the left
    const dx = W * 0.1, dy = sh + (H - sh) * 0.35;
    c.save(); c.translate(dx, dy); c.rotate(-0.08);
    c.fillStyle = dusk('#8a6a4a', '#3a3048'); c.strokeStyle = dusk('#4a3420', '#1a1428'); c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(-W * 0.12, -9, W * 0.26, 18, 9); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(W * 0.14, 0, 5, 9, 0, 0, TAU); c.fillStyle = dusk('#c9a77a', '#4a4058'); c.fill(); c.stroke();
    c.strokeStyle = rgba('#4a3420', 0.4); c.beginPath(); c.moveTo(-W * 0.08, -2); c.lineTo(W * 0.08, -3); c.moveTo(-W * 0.05, 4); c.lineTo(W * 0.1, 3); c.stroke();
    if (season === 'winter') { c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(-W * 0.12, -12, W * 0.26, 7, 4); c.fill(); }
    c.restore();
    // dock on the right going into the lake
    const d0 = W * 0.80, dw = W * 0.12;
    c.fillStyle = dusk('#9a7450', '#3a3050'); c.strokeStyle = dusk('#4a3420', '#1a1428'); c.lineWidth = 2;
    c.beginPath(); c.moveTo(d0, sh + 22); c.lineTo(d0 + dw * 1.6, sh + 22); c.lineTo(d0 + dw * 0.9, hz + (sh - hz) * 0.45); c.lineTo(d0 + dw * 0.35, hz + (sh - hz) * 0.45); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = rgba('#4a3420', 0.5); c.lineWidth = 1;
    for (let i = 1; i < 9; i++) { const u = i / 9, y = lerp(sh + 22, hz + (sh - hz) * 0.45, u); c.beginPath(); c.moveTo(lerp(d0, d0 + dw * 0.35, u), y); c.lineTo(lerp(d0 + dw * 1.6, d0 + dw * 0.9, u), y); c.stroke(); }
    c.fillStyle = dusk('#6a4a30', '#2a2038');
    [[0, 22, 6, 18], [1.55, 22, 6, 18], [0.3, (sh - hz) * -0.3, 4, 10], [0.92, (sh - hz) * -0.3, 4, 10]].forEach(p => c.fillRect(d0 + dw * p[0] - p[2] / 2, sh + p[1] - 2, p[2], p[3]));
    if (season === 'winter') {   // snow resting on each plank and capping the posts; the wood still shows between
      c.strokeStyle = mix('#ffffff', '#8a90b8', nt); c.lineCap = 'round';
      for (let i = 0; i <= 9; i++) { const u = i / 9, y = lerp(sh + 22, hz + (sh - hz) * 0.45, u) - 1.5; c.lineWidth = 3.2 - u * 1.6; c.beginPath(); c.moveTo(lerp(d0, d0 + dw * 0.35, u) + 3, y); c.lineTo(lerp(d0 + dw * 1.6, d0 + dw * 0.9, u) - 3 - (i % 3) * 4, y); c.stroke(); }
      c.fillStyle = mix('#ffffff', '#8a90b8', nt);
      [[0, 22, 6], [1.55, 22, 6], [0.3, (sh - hz) * -0.3, 4], [0.92, (sh - hz) * -0.3, 4]].forEach(p => { ell(c, d0 + dw * p[0], sh + p[1] - 2, p[2] * 0.8, 2.6); c.fill(); });
    }
    // birch tree on the left edge
    const tx = W * 0.045, ty = sh + (H - sh) * 0.2, top = hz - H * 0.24;
    const trunk = (x0, y0, x1, y1, w0, w1) => {
      c.beginPath(); c.moveTo(x0 - w0, y0); c.quadraticCurveTo((x0 + x1) / 2 - w0 * 0.6, (y0 + y1) / 2, x1 - w1, y1);
      c.lineTo(x1 + w1, y1); c.quadraticCurveTo((x0 + x1) / 2 + w0 * 0.6, (y0 + y1) / 2, x0 + w0, y0); c.closePath(); c.fill(); c.stroke();
    };
    c.fillStyle = dusk('#f4f1ea', '#8a8aa8'); c.strokeStyle = dusk('#3a3a3a', '#1a1a2a'); c.lineWidth = 2; c.lineJoin = 'round';
    // branches first so the trunk overlaps them
    const br = [[0.32, 1, 34, -26], [0.18, -1, 18, -20], [0.12, 1, 26, -34], [0.45, 1, 22, -14]];
    br.forEach(b => { const by0 = lerp(ty, top, 1 - b[0]); trunk(tx, by0, tx + b[1] * b[2], by0 + b[3], 3, 1.2); });
    trunk(tx, ty, tx + 6, top, 10, 4);
    c.fillStyle = dusk('#2a2a2a', '#1a1a2a');
    const RB = rng(31);
    for (let i = 0; i < 14; i++) { const u = RB(), y = lerp(ty - 6, top + 10, u), x = tx + u * 6 - 7 + RB() * 6; c.fillRect(x, y, 3 + RB() * 7, 1.6 + RB() * 1.6); }
    const leafCol = { summer: ['#4f9a4a', '#6dbb5a', '#3f8a3e'], fall: ['#e0702a', '#f2b03a', '#d4552a'], winter: null, spring: ['#ffc2d8', '#9ad07a', '#ffd6e4'] }[season];
    if (leafCol) {
      const RL = rng(17);
      for (let i = 0; i < 22; i++) {
        const lx = tx + 6 + (RL() - 0.35) * 90, ly = top + (RL() - 0.3) * 80;
        c.fillStyle = dusk(leafCol[i % 3], '#2a3048'); c.beginPath(); c.arc(lx, ly, 13 + RL() * 15, 0, TAU); c.fill();
      }
    } else {
      c.fillStyle = 'rgba(255,255,255,.95)';
      br.forEach(b => { const by0 = lerp(ty, top, 1 - b[0]); c.beginPath(); c.ellipse(tx + b[1] * b[2] * 0.6, by0 + b[3] * 0.6 - 3, 9, 3, b[1] * -0.6, 0, TAU); c.fill(); });
      c.beginPath(); c.ellipse(tx + 6, top + 1, 6, 3, 0, 0, TAU); c.fill();
    }
    }
    // seasonal ground details
    if (!env.lake && season === 'fall') for (let i = 0; i < 26; i++) leaf(c, R() * W, sh + 30 + R() * (H - sh - 30), 5 + R() * 4, dusk(['#e0702a', '#f2b03a', '#c9432a'][i % 3], '#3a2a40'), null);
    if (!env.lake && (season === 'spring' || season === 'summer')) {
      c.strokeStyle = dusk(season === 'spring' ? '#7ab85a' : '#8aa85a', '#2a3a40'); c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const x = (i < 7 ? R() * W * 0.22 : W * 0.78 + R() * W * 0.22), y = H - R() * (H - sh) * 0.5; for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + j * 4, y - 8, x + j * 7, y - 14); c.stroke(); } }
      if (season === 'spring') for (let i = 0; i < 6; i++) { const x = R() * W * 0.2, y = H - R() * (H - sh) * 0.4; heart(c, x, y, 4, '#ffd1e3'); }
    }
    if (!env.lake && season === 'winter') {   // soft shaded snowdrifts with a glint
      for (let i = 0; i < 7; i++) {
        const x = R() * W, y = sh + 34 + R() * (H - sh - 40), rw = 34 + R() * 46, rh = 9 + R() * 8;
        c.globalAlpha = 0.45; c.fillStyle = mix('#9fb6d2', '#2a3058', nt); ell(c, x + 4, y + 2, rw * 1.03, rh * 0.55); c.fill(); c.globalAlpha = 1;
        const gd = c.createLinearGradient(0, y - rh, 0, y); gd.addColorStop(0, mix('#ffffff', '#a0a8d0', nt)); gd.addColorStop(1, mix('#dbe6f2', '#5a6290', nt));
        c.fillStyle = gd; c.beginPath(); c.ellipse(x, y, rw, rh, 0, PI, TAU); c.closePath(); c.fill();
        if (nt < 0.6) { sparkle(c, x - rw * 0.3, y - rh * 0.6, 3.5, '#ffffff', 0.9); sparkle(c, x + rw * 0.25, y - rh * 0.4, 2.5, '#ffffff', 0.7); }
      }
    }
    if (!env.lake && nt > 0.25) {   // moonlight pooling on the beach so night isn't one flat wash
      const mg = c.createRadialGradient(W * 0.55, sh + (H - sh) * 0.5, 10, W * 0.55, sh + (H - sh) * 0.5, Math.max(W, H - sh) * 0.75);
      mg.addColorStop(0, 'rgba(205,215,255,' + (0.32 * nt) + ')'); mg.addColorStop(1, 'rgba(200,210,255,0)');
      c.fillStyle = mg; c.fillRect(0, sh, W, H - sh);
      c.strokeStyle = 'rgba(230,235,255,' + (0.35 * nt) + ')'; c.lineWidth = 2; c.lineCap = 'round';   // moon path on the water
      for (let i = 0; i < 9; i++) { const u = i / 8, y = hz + 8 + u * (sh - hz - 14), w = 8 + u * 30; c.beginPath(); c.moveTo(W * 0.72 - w / 2, y); c.lineTo(W * 0.72 + w / 2, y); c.stroke(); }
    }
    if (env.lake) {   // mini-game arena: soft haze on the far water for depth
      const hg = c.createLinearGradient(0, hz, 0, hz + H * 0.16); hg.addColorStop(0, 'rgba(235,245,255,' + (0.32 * (1 - nt)) + ')'); hg.addColorStop(1, 'rgba(235,245,255,0)');
      c.fillStyle = hg; c.fillRect(0, hz, W, H * 0.16);
    }
    cache = cv; cacheKey = key;
    return cv;
  }

  /** Full scene draw: static cache + animated layers. Returns nothing. */
  function drawScene(c, W, H, L, env) {
    const dpr = c.canvas.__dpr || 1;
    const bg = !env.lake && img('bg_' + env.season);
    if (bg) { const sc = Math.max(W / bg.width, H / bg.height); c.drawImage(bg, (W - bg.width * sc) / 2, (H - bg.height * sc) / 2, bg.width * sc, bg.height * sc); }
    else c.drawImage(sceneStatic(W, H, L, env, dpr), 0, 0, W, H);
    const t = env.t, hz = L.horizon, sh = L.shore, nt = nightness(env.hour);
    // stars
    const dark = Math.max(nt, env.dim || 0);
    if (dark > 0.05) {
      const R = rng(42);
      for (let i = 0; i < 50; i++) {
        const x = R() * W, y = R() * hz * 0.85, tw = 0.5 + 0.5 * Math.sin(t * (1 + R() * 2) + i);
        c.fillStyle = 'rgba(255,255,240,' + (dark * (0.35 + 0.5 * tw)) + ')'; c.fillRect(x, y, 1.6, 1.6);
      }
    }
    // clouds
    if (env.season !== 'winter' || true) {
      const R = rng(11);
      for (let i = 0; i < 4; i++) {
        const sp = 4 + R() * 6, w = 50 + R() * 60, y = hz * (0.25 + R() * 0.4);
        const x = ((R() * W + t * sp) % (W + w * 2)) - w;
        c.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - nt * 0.7)) + ')';
        c.beginPath(); c.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, TAU); c.ellipse(x - w * 0.2, y - w * 0.08, w * 0.22, w * 0.14, 0, 0, TAU); c.ellipse(x + w * 0.15, y - w * 0.1, w * 0.25, w * 0.17, 0, 0, TAU); c.fill();
      }
    }
    // boats + paddleboarders
    if (env.season === 'summer') {
      drawSailboat(c, ((t * 7) % (W + 120)) - 60, hz + (sh - hz) * 0.12, 13);
      for (let i = 0; i < 2; i++) {
        const sp = i ? -11 : 9, x = ((i * W * 0.6 + t * sp) % (W + 80) + W + 80) % (W + 80) - 40;
        drawPaddler(c, x, hz + (sh - hz) * (0.35 + i * 0.22), 9 + i * 3, t + i, i ? '#ff7a6b' : '#ffd166');
      }
    } else if (env.season !== 'winter') {
      drawSailboat(c, W - ((t * 5) % (W + 120)) + 60, hz + (sh - hz) * 0.1, 11);
    }
    // water shimmer
    if (!env.ice) {
      c.strokeStyle = 'rgba(255,255,255,' + (0.35 - nt * 0.15) + ')'; c.lineWidth = 2; c.lineCap = 'round';
      const R = rng(5);
      for (let i = 0; i < 26; i++) {
        const u = R(), y = hz + 6 + u * u * (sh - hz - 10), w = 6 + u * 22, ph = R() * TAU;
        const x = (R() * W + Math.sin(t * 0.6 + ph) * 12);
        c.globalAlpha = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.4 + ph));
        c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); c.stroke();
      }
      c.globalAlpha = 1;
      // foam at shore
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3;
      const fy = sh + 6 + Math.sin(t * 0.9) * 3;
      c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, fy + Math.sin(x * 0.02) * 4 + Math.sin(x * 0.11 + t * 2) * 1.5); c.stroke();
    } else if (env.hole) {
      // ice-fishing style hole the pet naps under
      const hx = env.hole.x, hy = env.hole.y;
      c.fillStyle = '#2a5a80'; ell(c, hx, hy, 46, 12); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
    }
    if (env.lake) {   // mini-game lake: fish shadows cruising under the surface + sun glitter on the far water
      const RF = rng(23);
      for (let i = 0; i < 6; i++) {
        const sp = (8 + RF() * 14) * (i % 2 ? -1 : 1), y = hz + (H - hz) * (0.25 + RF() * 0.6), len = 26 + RF() * 26;
        const x = (((RF() * W + t * sp) % (W + 120)) + W + 120) % (W + 120) - 60;
        c.save(); c.translate(x, y + Math.sin(t * 0.8 + i) * 6); c.scale(sp < 0 ? -1 : 1, 1); c.globalAlpha = 0.13 * (1 - nt * 0.5); c.fillStyle = '#0c2a48';
        c.beginPath(); c.ellipse(0, 0, len, len * 0.3, 0, 0, TAU); c.moveTo(-len * 0.9, 0); c.lineTo(-len * 1.45, -len * 0.3 + Math.sin(t * 6 + i) * 3); c.lineTo(-len * 1.45, len * 0.3 + Math.sin(t * 6 + i) * 3); c.fill();
        c.restore();
      }
      if (nt < 0.6) for (let i = 0; i < 18; i++) { const RG = rng(300 + i); const x = RG() * W, y = hz + 4 + RG() * (H - hz) * 0.22, a = Math.max(0, Math.sin(t * (2 + RG() * 2) + i * 1.7)); if (a > 0.6) sparkle(c, x, y, 3 + a * 3, '#fffbe0', (a - 0.6) * 2.2 * (1 - nt)); }
    }
    // weather particles
    const R = rng(99);
    if (env.season === 'winter') {
      c.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 46; i++) { const sp = 18 + R() * 25, x = (R() * W + Math.sin(t + i) * 14) % W, y = (R() * H + t * sp) % H, r = 1 + R() * 2.4; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    } else if (env.season === 'fall') {
      for (let i = 0; i < 9; i++) { const sp = 22 + R() * 20, x = (R() * W + Math.sin(t * 0.8 + i) * 30 + t * 10) % W, y = (R() * H + t * sp) % H; c.save(); c.translate(x, y); c.rotate(t * 2 + i); leaf(c, 0, 0, 6, ['#e0702a', '#f2b03a', '#c9432a'][i % 3], null); c.restore(); }
    } else if (env.season === 'spring') {
      for (let i = 0; i < 12; i++) { const sp = 14 + R() * 12, x = (R() * W + Math.sin(t + i) * 22) % W, y = (R() * H + t * sp) % H; c.fillStyle = 'rgba(255,205,225,.9)'; ell(c, x, y, 3.5, 2, t + i); c.fill(); }
    } else if (nt > 0.5) {
      for (let i = 0; i < 12; i++) { const x = R() * W + Math.sin(t * 0.7 + i) * 20, y = sh + R() * (H - sh) * 0.6 + Math.cos(t * 0.9 + i) * 12, a = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); c.fillStyle = 'rgba(230,255,140,' + a + ')'; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill(); }
    }
  }
  /** Foreground for the mini-game lake: swaying reeds and cattails in the bottom corners (drawn over the game). */
  function drawLakeFront(c, W, H, t) {
    const R = rng(77);
    c.save(); c.lineCap = 'round';
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 7; i++) {
        const bx = side ? W - R() * W * 0.16 : R() * W * 0.16, h = 70 + R() * 90, sway = Math.sin(t * 1.3 + i + side) * 6;
        const tx = bx + (side ? -1 : 1) * (8 + R() * 14) + sway, ty = H - h;
        c.strokeStyle = i % 2 ? '#2f6a3a' : '#3f8248'; c.lineWidth = 4 + R() * 2;
        c.beginPath(); c.moveTo(bx, H + 4); c.quadraticCurveTo(bx + (tx - bx) * 0.2, H - h * 0.5, tx, ty); c.stroke();
        if (i % 3 === 0) { c.save(); c.translate(tx, ty + 16); c.rotate((tx - bx) / h); c.fillStyle = '#7a4a28'; c.beginPath(); c.roundRect(-4, -14, 8, 26, 4); c.fill(); c.strokeStyle = '#3a2414'; c.lineWidth = 1.5; c.stroke(); c.restore(); }
      }
    }
    c.restore();
  }
  function drawNightOverlay(c, W, H, L, a, t, hour) {
    if (a <= 0.01) return;
    c.fillStyle = 'rgba(12,18,52,' + (0.5 * a) + ')'; c.fillRect(0, 0, W, H);
    // stars + moon so "lights out" always shows the night sky
    const R = rng(42);
    for (let i = 0; i < 50; i++) {
      const x = R() * W, y = R() * L.horizon * 0.85, tw = 0.5 + 0.5 * Math.sin(t * (1 + R() * 2) + i);
      c.fillStyle = 'rgba(255,255,240,' + (a * (0.35 + 0.5 * tw)) + ')'; c.fillRect(x, y, 1.6, 1.6);
    }
    drawMoon(c, W * 0.78, L.horizon * 0.42, Math.min(W, H) * 0.06, a);
  }

  root.Art = {
    ASSETS, loadAssets, img, drawImg, pose, drawPet, drawEgg, drawShell, drawFood, drawFish, drawBubble, drawDuck, drawLilyPad,
    drawTourist, drawPaddler, drawSailboat, drawNote, drawFly, drawZ, drawMoon, drawScene, drawNightOverlay,
    heart, sparkle, leaf, nightness, drawWear, drawBottle, drawMedal, drawLakeFront, geom, palFor, PAL, mix, rgba,
  };
})(window);
