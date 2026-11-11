/* Pet Champ - main game: loop, layout, pet animation, care actions, cards, input, __T hooks. */
(function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const ease = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (u) => u * u * (3 - 2 * u);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ------------------------------------------------------------------ clock
  let tOff = 0;                        // __T fast-forward offset (ms)
  const now = () => Date.now() + tOff;
  let hourOverride = null;
  function hourNow() { if (hourOverride != null) return hourOverride; const d = new Date(now()); return d.getHours() + d.getMinutes() / 60; }

  // ------------------------------------------------------------------ state
  let st = Sim.load();
  let mode = 'title';                  // title | egg | hatching | home | bath | game
  let paused = false, noPause = false;
  const cv = $('scene'), c = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const L = { horizon: 0, shore: 0, petX: 0, petY: 0, petS: 100, hudB: 110, actT: 700, land: false };
  const GL = { horizon: 0, shore: 0 };   // mini-game layout (lake fills the screen)
  let safe = { t: 0, b: 0 };

  // ------------------------------------------------------------------ layout
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  function layout(force) {
    const w = window.innerWidth, h = window.innerHeight;
    const orient = w > h, land = orient && h <= 520;    // phone landscape; tall desktop windows use the column layout
    if (!force && w === W && orient === L.orient && Math.abs(h - H) < 160) {
      // Safari toolbar show/hide: keep every position frozen, just grow/shrink the canvas so no strip shows
      if (h !== H) {
        H = h; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
        if (!L.land && L.base) {   // the action bar is pinned to the visible bottom, so the pet's feet follow it (no sudden overlap)
          const d = H - L.base.H; L.petY = L.base.petY + d; L.actT = L.base.actT + d;
          if (pet.where === 'home' && !pet.move && mode !== 'bath') pet.y = L.petY;
        }
      }
      return false;
    }
    W = w; H = h; L.land = land; L.orient = orient;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.__dpr = dpr;
    const cs = getComputedStyle(probe); safe = { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
    L.hudB = safe.t + 8 + 52 + 8 + 34;
    if (!land) {
      L.actT = H - safe.b - 12 - 79;
      L.horizon = H * 0.36; L.shore = H * 0.555;
      L.petX = W * 0.5; L.petY = Math.min(H * 0.8, L.actT - 30);
      L.petS = Math.min(W * 0.35, (L.petY - L.hudB - 30) / 2.75, 150);
      L.base = { H, petY: L.petY, actT: L.actT };
    } else {
      L.actT = H;
      L.horizon = H * 0.4; L.shore = H * 0.6;
      L.petX = W * 0.27; L.petY = H - safe.b - 22;
      L.petS = Math.min(W * 0.2, (L.petY - L.hudB - 10) / 2.75, 140);
    }
    GL.horizon = H * 0.2; GL.shore = H * 1.15;
    pet.x = L.petX; pet.y = L.petY; pet.s = L.petS;
    if (game) relaunchGame();
    return true;
  }

  // ------------------------------------------------------------------ FX
  const fx = {
    parts: [], texts: [], shakeA: 0, pause: 0,
    add(p) { if (this.parts.length < 400) this.parts.push(Object.assign({ t: 0, life: 1, vx: 0, vy: 0, g: 0, r: 4, rot: 0, vr: 0, col: '#fff' }, p)); },
    burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(80, 260); this.add({ kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, r: rand(2.5, 5.5), col, life: rand(0.4, 0.8) }); } },
    hearts(x, y, n) { for (let i = 0; i < n; i++) this.add({ kind: 'heart', x: x + rand(-20, 20), y: y + rand(-10, 10), vx: rand(-40, 40), vy: rand(-110, -60), r: rand(7, 12), life: rand(0.9, 1.4), col: ['#ff6f91', '#ff8fb0', '#ffb3c8'][i % 3] }); },
    splash(x, y, s) { s = s || 1; for (let i = 0; i < 14 * s + 4; i++) { const a = rand(-PI * 0.95, -PI * 0.05), v = rand(120, 320) * s; this.add({ kind: 'drop', x: x + rand(-14, 14) * s, y, vx: Math.cos(a) * v * 0.7, vy: Math.sin(a) * v, g: 700, r: rand(2.5, 5) * Math.max(0.6, s), life: rand(0.5, 0.9) }); } this.ring(x, y, 20 * s); },
    ring(x, y, r) { this.add({ kind: 'ring', x, y, r, life: 0.45 }); },
    crumbs(x, y, col) { for (let i = 0; i < 5; i++) this.add({ kind: 'dot', x: x + rand(-10, 10), y, vx: rand(-90, 90), vy: rand(-140, -40), g: 600, r: rand(2, 3.5), col, life: rand(0.4, 0.7) }); },
    suds(x, y) { this.add({ kind: 'suds', x: x + rand(-14, 14), y: y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-50, -20), r: rand(5, 11), life: rand(0.8, 1.4) }); },
    zzz(x, y, s) { this.add({ kind: 'z', x, y, vx: rand(14, 30), vy: -rand(28, 40), r: s || 18, life: 2.2, ph: rand(0, TAU) }); },
    sparkles(x, y, n, spread) { for (let i = 0; i < n; i++) this.add({ kind: 'spark', x: x + rand(-1, 1) * (spread || 40), y: y + rand(-1, 1) * (spread || 40), vy: rand(-40, -10), r: rand(6, 12), life: rand(0.5, 1.1) }); },
    shells(x, y) { for (let i = 0; i < 9; i++) { const a = rand(-PI * 0.9, -PI * 0.1), v = rand(160, 380); this.add({ kind: 'shell', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, r: rand(6, 13), vr: rand(-10, 10), life: rand(0.9, 1.3) }); } },
    text(x, y, s, col, size) { this.texts.push({ x, y, s, col: col || '#fff', size: size || 26, t: 0, life: 1.1 }); },
    shake(a) { this.shakeA = Math.max(this.shakeA, a); },
    hitPause(s) { this.pause = Math.max(this.pause, s); },
    buzz(ms) { try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} },
    update(dt) {
      for (const p of this.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.kind === 'suds' || p.kind === 'heart') p.vx *= 0.97; }
      this.parts = this.parts.filter(p => p.t < p.life);
      for (const t of this.texts) { t.t += dt; t.y -= 46 * dt * (1 - t.t / t.life); }
      this.texts = this.texts.filter(t => t.t < t.life);
      this.shakeA = Math.max(0, this.shakeA - dt * 30);
    },
    draw(c) {
      for (const p of this.parts) {
        const u = p.t / p.life, a = 1 - u;
        c.save(); c.globalAlpha = Math.min(1, a * 1.6);
        if (p.kind === 'dot') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r * (1 - u * 0.4), 0, TAU); c.fill(); }
        else if (p.kind === 'heart') { Art.heart(c, p.x + Math.sin(p.t * 6) * 4, p.y, p.r * (0.6 + Math.min(1, p.t * 5) * 0.4), p.col); }
        else if (p.kind === 'drop') { c.fillStyle = 'rgba(200,240,255,.95)'; c.beginPath(); c.ellipse(p.x, p.y, p.r * 0.75, p.r * 1.15, Math.atan2(p.vy, p.vx) + PI / 2, 0, TAU); c.fill(); }
        else if (p.kind === 'ring') { c.strokeStyle = 'rgba(255,255,255,' + a + ')'; c.lineWidth = 3; c.beginPath(); c.ellipse(p.x, p.y, p.r + u * 40, (p.r + u * 40) * 0.35, 0, 0, TAU); c.stroke(); }
        else if (p.kind === 'suds') { c.strokeStyle = 'rgba(255,255,255,.95)'; c.fillStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); c.stroke(); }
        else if (p.kind === 'z') { Art.drawZ(c, p.x + Math.sin(p.t * 2 + p.ph) * 8, p.y, p.r * (0.6 + u * 0.6), Math.min(1, a * 1.5) * Math.min(1, p.t * 3)); }
        else if (p.kind === 'spark') { Art.sparkle(c, p.x, p.y, p.r * Math.sin(u * PI), '#fff6b0', 1); }
        else if (p.kind === 'shell') { c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = '#f2f6ee'; c.strokeStyle = '#2f5a55'; c.lineWidth = 2; c.beginPath(); c.moveTo(-p.r, 0); c.lineTo(0, -p.r * 0.8); c.lineTo(p.r, 0); c.lineTo(p.r * 0.2, p.r * 0.5); c.closePath(); c.fill(); c.stroke(); }
        c.restore();
      }
      for (const t of this.texts) {
        const u = t.t / t.life, sc = u < 0.15 ? 0.6 + u / 0.15 * 0.5 : 1.1 - Math.min(0.1, (u - 0.15));
        c.save(); c.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; c.translate(t.x, t.y); c.scale(sc, sc);
        c.font = '700 ' + t.size + 'px Fredoka, Nunito, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = t.size * 0.2; c.strokeStyle = '#1e2f4a'; c.lineJoin = 'round'; c.strokeText(t.s, 0, 0); c.fillStyle = t.col; c.fillText(t.s, 0, 0);
        c.restore();
      }
    },
  };

  // ------------------------------------------------------------------ pet controller
  const SPOTS = [
    { on: 'body', x: 0.22, y: -0.12, r: 0.11 }, { on: 'body', x: -0.3, y: 0.08, r: 0.09 }, { on: 'head', x: 0.2, y: -0.25, r: 0.08 },
    { on: 'body', x: 0.42, y: -0.28, r: 0.07 }, { on: 'body', x: -0.05, y: 0.25, r: 0.1 }, { on: 'head', x: -0.25, y: 0.12, r: 0.065 }, { on: 'body', x: 0.3, y: 0.22, r: 0.08 },
  ];
  const pet = {
    x: 0, y: 0, s: 100, P: Art.pose(), where: 'home', move: null, act: null,
    blink: 2.5, blinkOn: 0, idle: 4, look: { x: 0, y: 0, until: 0 }, hit: null,
    water: 0, dim: 0, spots: SPOTS.map(s => Object.assign({ a: 0 }, s)), flies: [], petting: null, zT: 0, hold: null, flash: 0, scaleMul: 1,
  };
  for (let i = 0; i < 3; i++) pet.flies.push({ a: rand(0, TAU), r: rand(0.6, 0.95), sp: rand(2, 3.5) * (i % 2 ? 1 : -1), ph: rand(0, TAU) });

  const ACTS = {
    boop: 0.55, hop: 0.8, eat: 1.5, refuse: 0.9, yawn: 1.6, shake: 1.0, pose: 1.4, wake: 1.3, grumpy: 2.2, tummy: 1.6, sigh: 1.8,
    wiggle: 1.1, giggle: 0.8, grow: 2.4, anticipate: 3, queasy: 1.4, dunk: 0.9, look: 1.6, surprised: 1.0, wave: 1.4,
  };
  function act(name, data) {
    const old = pet.act;
    pet.act = null;
    if (old && old.t < old.dur) {   // interrupted: still run the important cleanup
      if (old.name === 'eat') { eating = null; }
      if (old.name === 'grow') { pet.hold = null; }
      if (old.done && (old.name === 'eat' || old.name === 'grow' || old.name === 'shake' || old.name === 'surprised')) { const d = old.done; old.done = null; d(); }
    }
    pet.act = { name, t: 0, dur: ACTS[name] || 1, data: data || {} };
  }
  const busy = () => actIs('eat') || actIs('anticipate') || actIs('grow') || !!flying;
  function actIs(name) { return pet.act && pet.act.name === name; }

  function visStage() { return pet.hold ? pet.hold : { stage: st ? st.stage : 'hatchling', variant: st ? st.variant : null }; }

  function updatePet(dt) {
    const P = pet.P; P.t += dt; const t = P.t;
    const vs = visStage(); P.stage = vs.stage === 'egg' ? 'hatchling' : vs.stage; P.variant = vs.variant; P.wear = st ? st.wear : null; Snd.setVoice(P.stage);
    const m = st ? Sim.mood(st, now()) : 'ok';
    const asleep = st && st.asleep;
    const o = {
      lean: 0, droop: 0, tilt: Math.sin(t * 0.7) * 0.04, curl: 0, eye: 1, blush: 0.15,
      sq: Math.sin(t * 2.1) * 0.025, sway: 0, jump: 0, tummy: 0, eyeStyle: 'normal', mouth: 'smile', brow: 'none', mouthOpen: 0,
      wagSpeed: 1.6, sparkle: 0, pupil: 1,
    };
    if (asleep) {
      Object.assign(o, { curl: 1, eyeStyle: 'closed', mouth: (t % 7) < 4 ? 'smile' : 'o', sq: Math.sin(t * 1.25) * 0.045, wagSpeed: 0.3, blush: 0.35 });
      pet.zT -= dt;
      if (pet.zT <= 0 && pet.hit && pet.where === 'home' && mode === 'home') { fx.zzz(pet.hit.head.x + pet.hit.head.r * 0.6, pet.hit.head.y - pet.hit.head.r * 0.4, 16 + pet.s * 0.08); pet.zT = 1.3; }
    } else if (m === 'happy') { Object.assign(o, { blush: 0.55, wagSpeed: 3.5 }); }
    else if (m === 'sad') { Object.assign(o, { droop: 0.85, brow: 'sad', mouth: 'frown', eye: 0.78, sq: Math.sin(t * 1.4) * 0.02, wagSpeed: 0.6 }); }
    else if (m === 'sleepy') { Object.assign(o, { eye: 0.42, droop: 0.35, mouth: 'flat', wagSpeed: 0.7, sway: Math.sin(t * 0.9) * 0.03 }); }
    else if (m === 'tummy') { Object.assign(o, { tummy: 1, eye: 0.7, brow: 'sad', mouth: 'wavy', sway: Math.sin(t * 3) * 0.025 }); }

    // swimming off / swimming home
    if (pet.where === 'leaving') Object.assign(o, { droop: 0.6, brow: 'sad', mouth: 'frown', eye: 0.8, eyeStyle: 'normal', curl: 0 });
    else if (pet.where === 'returning') Object.assign(o, { eyeStyle: 'happy', mouth: 'grin', blush: 0.9, droop: 0, brow: 'none', curl: 0, wagSpeed: 8 });
    o.jump += pet.mj || 0; pet.mj = 0;
    // look target: finger/mouse, else idle wander
    const lookAt = ptr.recent(now()) && mode === 'home' ? ptr : (pet.look.until > t ? pet.look : null);
    if (pet.hit && !asleep) {
      const hx = pet.hit.head.x, hy = pet.hit.head.y;
      const tx = lookAt ? clamp((lookAt.x - hx) / (W * 0.32), -1, 1) : 0;
      const ty = lookAt ? clamp((lookAt.y - hy) / (H * 0.28), -1, 1) : 0;
      P.px = ease(P.px, tx, 9, dt); P.py = ease(P.py, ty, 9, dt);
      o.lean += P.px * 0.35 * (o.droop > 0.5 ? 0.4 : 1);
      o.tilt += -P.px * 0.06 + (lookAt && Math.abs(tx) < 0.2 ? Math.sin(t * 0.8) * 0.08 : 0);
    } else { P.px = ease(P.px, 0, 4, dt); P.py = ease(P.py, 0, 4, dt); }

    // petting overrides
    const pg = pet.petting;
    if (pg && pg.active) {
      const lv = pg.level;
      if (asleep) { o.blush = 1; o.mouth = 'smile'; }
      else Object.assign(o, { eyeStyle: 'happy', mouth: 'purr', blush: 1, droop: 0, brow: 'none', wagSpeed: 10 });
      o.sway += Math.sin(t * 9) * 0.035 * lv;
      o.sq += Math.sin(t * 18) * 0.012 * lv;
      o.lean += clamp((pg.x - pet.x) / (pet.s * 2), -0.6, 0.6) * 0.5;
    }

    // idle behaviours
    if (!pet.act && !asleep && mode === 'home' && pet.where === 'home' && !(pg && pg.active)) {
      pet.idle -= dt;
      if (pet.idle <= 0) {
        pet.idle = rand(4, 8);
        const r = Math.random();
        if (m === 'happy') { if (r < 0.35) { act('hop'); Snd.play('boing'); if (Math.random() < 0.6) Snd.voice('bwip'); } else if (r < 0.65) act('wiggle'); else lookAround(); }
        else if (m === 'sleepy') { act('yawn'); Snd.play('yawn'); }
        else if (m === 'sad') { act('sigh'); Snd.voice('mew'); }
        else if (m === 'tummy') { act('tummy'); }
        else { if (r < 0.5) lookAround(); else act('wiggle'); }
      }
    }

    // action overlay
    if (pet.act) {
      const a = pet.act; a.t += dt; const u = clamp(a.t / a.dur, 0, 1);
      applyAct(a, u, o, dt);
      if (a.t >= a.dur) { const done = a.done; pet.act = null; if (done) done(); }
    }

    // blink (only for open eyes)
    pet.blink -= dt;
    if (pet.blink <= 0) { pet.blinkOn = 0.13; pet.blink = rand(1.8, 5) * (Math.random() < 0.2 ? 0.15 : 1); }
    if (pet.blinkOn > 0) { pet.blinkOn -= dt; if (o.eyeStyle === 'normal') o.eye = 0.05; }

    // ease continuous values
    const r = 12;
    P.lean = ease(P.lean, o.lean, 6, dt); P.droop = ease(P.droop, o.droop, 4, dt); P.tilt = ease(P.tilt, o.tilt, 8, dt);
    P.curl = ease(P.curl, o.curl, 3, dt); P.blush = ease(P.blush, o.blush, 5, dt); P.tummy = ease(P.tummy, o.tummy, 4, dt);
    P.eye = o.eye < 0.1 ? o.eye : ease(P.eye, o.eye, r, dt);
    P.pupil = o.pupil; P.sq = o.sq; P.sway = o.sway; P.jump = o.jump; P.mouthOpen = o.mouthOpen; P.sparkle = o.sparkle;
    P.eyeStyle = o.eyeStyle; P.mouth = o.mouth; P.brow = o.brow;
    P.tailWag += dt * o.wagSpeed; P.flip += dt * (pg && pg.active ? 5 : 1.5);
    P.wet = Math.max(0, P.wet - dt * 0.12);
    // dirt
    const clean = st ? st.needs.clean : 100;
    const nSpots = mode === 'bath' ? -1 : clean < 62 ? Math.min(7, Math.ceil((62 - clean) / 8.5)) : 0;
    if (nSpots >= 0) pet.spots.forEach((s, i) => { s.a = ease(s.a, i < nSpots ? 0.9 : 0, 3, dt); });
    P.spots = pet.spots;
  }

  function lookAround() { pet.look = { x: rand(W * 0.1, W * 0.9), y: rand(L.horizon, L.shore), until: pet.P.t + rand(1.2, 2.2) }; }

  function applyAct(a, u, o, dt) {
    const s = Math.sin;
    switch (a.name) {
      case 'boop': o.sq = u < 0.25 ? 0.14 * s(u / 0.25 * PI) : -0.06 * s((u - 0.25) / 0.75 * PI); o.eyeStyle = 'happy'; o.mouth = 'grin'; o.blush = 1; break;
      case 'giggle': o.jump = 0.12 * Math.abs(s(u * PI * 2)); o.sway = s(u * PI * 6) * 0.06; o.eyeStyle = 'happy'; o.mouth = 'grin'; o.blush = 1; break;
      case 'hop': {
        if (u < 0.18) o.sq = 0.12 * s(u / 0.18 * PI / 2);
        else if (u < 0.8) { const v = (u - 0.18) / 0.62; o.jump = 0.38 * s(v * PI); o.sq = -0.08 * s(v * PI); }
        else o.sq = 0.1 * s((u - 0.8) / 0.2 * PI);
        o.eyeStyle = 'happy'; o.mouth = 'grin'; o.blush = 0.9; o.wagSpeed = 9;
        if (!a.landed && u >= 0.8) { a.landed = true; if (pet.hit) fx.hearts(pet.hit.head.x, pet.hit.head.y - 20, 2); }
        break;
      }
      case 'wiggle': o.sway = s(u * PI * 4) * 0.07 * (1 - u); o.eyeStyle = 'happy'; o.mouth = 'smile'; o.wagSpeed = 8; break;
      case 'eat': {
        const ch = Math.abs(s(u * PI * 4.5));
        o.mouthOpen = u < 0.88 ? ch * 0.85 : 0; o.mouth = u < 0.88 ? 'open' : 'smile';
        o.eyeStyle = u > 0.12 ? 'happy' : 'normal'; o.blush = 1; o.sq = u > 0.88 ? 0.06 * s((u - 0.88) / 0.12 * PI) : 0;
        o.droop = 0; o.brow = 'none'; o.tummy = 0;
        const cyc = Math.floor(u * 4.5);
        if (cyc !== a.cyc && u < 0.88) { a.cyc = cyc; Snd.play('chomp'); if (pet.hit) fx.crumbs(pet.hit.mouth.x, pet.hit.mouth.y, a.data.crumb || '#d9a85a'); if (eating) eating.bite = Math.min(1, (cyc + 1) / 4); fx.buzz(8); }
        if (!a.gulped && u >= 0.88) { a.gulped = true; eating = null; Snd.play('gulp'); }
        break;
      }
      case 'anticipate': o.mouth = 'open'; o.mouthOpen = 0.75; o.eye = 1; o.eyeStyle = 'normal'; o.droop = 0; o.brow = 'none'; o.wagSpeed = 7; break;
      case 'refuse': o.tilt = s(u * PI * 6) * 0.28 * (1 - u); o.mouth = 'flat'; o.eye = 0.85; o.eyeStyle = 'normal'; o.brow = 'none'; break;
      case 'yawn': o.mouth = 'open'; o.mouthOpen = s(u * PI); o.eyeStyle = u > 0.15 && u < 0.85 ? 'closed' : 'normal'; o.sq = -0.06 * s(u * PI); o.tilt = -0.15 * s(u * PI); break;
      case 'sigh': o.droop = Math.min(1, o.droop + 0.25 * s(u * PI)); o.eye = 0.55; o.sq = -0.03 * s(u * PI); break;
      case 'tummy': o.sway = s(u * PI * 5) * 0.06; o.eyeStyle = 'squint'; o.mouth = 'wavy'; o.tummy = 1; break;
      case 'queasy': o.eyeStyle = 'squint'; o.mouth = 'wavy'; o.tummy = s(u * PI); o.sway = s(u * PI * 4) * 0.04; break;
      case 'shake': o.sway = s(u * PI * 12) * 0.13 * (1 - u); o.eyeStyle = 'squint'; o.mouth = 'grin';
        if (!a.dropT || a.t > a.dropT) { a.dropT = a.t + 0.08; if (pet.hit) for (let i = 0; i < 3; i++) fx.add({ kind: 'drop', x: pet.hit.body.x + rand(-1, 1) * pet.hit.body.rx, y: pet.hit.body.y - rand(0, pet.hit.body.ry), vx: rand(-260, 260), vy: rand(-260, -80), g: 800, r: rand(2.5, 4.5), life: 0.6 }); }
        break;
      case 'pose': o.eyeStyle = 'happy'; o.mouth = 'grin'; o.tilt = 0.24 * s(Math.min(1, u * 3) * PI / 2); o.blush = 1; o.lean = 0.4; o.sparkle = 1; break;
      case 'wake': o.sq = -0.09 * s(u * PI); o.mouth = u < 0.6 ? 'open' : 'smile'; o.mouthOpen = u < 0.6 ? s(u / 0.6 * PI) * 0.8 : 0; o.eyeStyle = u < 0.5 ? 'closed' : 'normal'; o.eye = clamp((u - 0.5) * 2, 0.3, 1); break;
      case 'grumpy': o.brow = 'grumpy'; o.mouth = 'flat'; o.eye = 0.7; o.eyeStyle = 'normal'; break;
      case 'surprised': o.eye = 1; o.eyeStyle = 'normal'; o.mouth = 'o'; o.sq = -0.05 * s(u * PI); o.pupil = 0.72; break;
      case 'grow': {
        o.sq = s(u * PI * 6) * 0.06 * (1 - u); o.eyeStyle = u < 0.5 ? 'closed' : 'happy'; o.mouth = u < 0.5 ? 'o' : 'grin'; o.sparkle = 1; o.blush = 1;
        if (pet.hit && Math.random() < dt * 30) fx.sparkles(pet.hit.body.x, pet.hit.body.y - pet.s * 0.6, 1, pet.s * 0.9);
        if (!a.flashed && u >= 0.5) { a.flashed = true; pet.hold = null; pet.flash = 1; Snd.play('sparkle'); fx.shake(4); if (pet.hit) fx.hearts(pet.hit.head.x, pet.hit.head.y, 5); }
        break;
      }
      case 'dunk': o.jump = -0.5 * s(u * PI); o.eyeStyle = 'closed'; o.mouth = 'o'; break;
      case 'look': break;
      case 'wave': o.eyeStyle = 'normal'; o.mouth = 'frown'; o.brow = 'sad'; o.tilt = s(u * PI * 3) * 0.12; break;
    }
  }

  /** Draw the pet with its lower part under water. wlU = waterline height above the ground point, in pet units. */
  function drawPetWater(c, x, y, P, wlU, s, pool) {
    s = s || pet.s;
    const g = Art.geom(P.stage, P.variant), k = s * g.size, wl = y - wlU * k;
    const sh = P.shadow; P.shadow = 0;
    if (pool) {   // shallow tide pool so the submerged half sits in water, not on sand
      const pg = c.createRadialGradient(x, wl, 4, x, wl, k * 1.4);
      pg.addColorStop(0, 'rgba(70,140,190,.75)'); pg.addColorStop(0.75, 'rgba(70,140,190,.55)'); pg.addColorStop(1, 'rgba(70,140,190,0)');
      c.fillStyle = pg; c.beginPath(); c.ellipse(x, wl + (y - wl) * 0.45, k * 1.35, (y - wl) * 0.75 + 14, 0, 0, TAU); c.fill();
    }
    c.save(); c.beginPath(); c.rect(-50, -50, W + 100, wl + 50); c.clip(); const hit = Art.drawPet(c, x, y, s, P); c.restore();
    c.save(); c.beginPath(); c.rect(-50, wl, W + 100, H); c.clip(); c.globalAlpha = 0.22; Art.drawPet(c, x, y, s, P); c.restore();
    P.shadow = sh;
    const rw = k * 0.75, tt = P.t;
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(x, wl, rw, rw * 0.16, 0, 0, TAU); c.stroke();
    const ph = (tt * 0.8) % 1;
    c.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - ph)) + ')'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, wl + 2, rw * (1 + ph * 0.6), rw * 0.16 * (1 + ph * 0.6), 0, 0, TAU); c.stroke();
    return hit;
  }

  // ------------------------------------------------------------------ egg + hatching
  const egg = { wob: 0, wobV: 0, sq: 0, taps: 0, kick: 2, look: 0 };
  function eggRect() { const s = L.petS * 1.5; return { x: L.petX, y: L.petY, s, w: s * 0.37, h: s * 0.8 }; }
  function warmTap(x, y) {
    Sim.warmEgg(st, 17, 1); egg.taps++;
    egg.wobV += (x < L.petX ? 1 : -1) * rand(3, 5); egg.sq = 0.08;
    Snd.play('eggTap', Math.floor(st.egg.prog / Sim.HATCH_NEED * 8)); fx.buzz(10);
    const r = eggRect();
    fx.sparkles(x, y, 2, 14);
    if (egg.taps === 3 && !st.hints.egg) { st.hints.egg = 1; ghost.hide(); }
    if (egg.taps % 6 === 0) fx.hearts(r.x, r.y - r.h, 1);
  }
  let hatchT = 0;
  function updateEgg(dt) {
    egg.wobV += (-egg.wob * 70 - egg.wobV * 5) * dt; egg.wob += egg.wobV * dt;
    egg.sq = ease(egg.sq, 0, 10, dt);
    const prog = st.egg.prog / Sim.HATCH_NEED;
    egg.kick -= dt;
    if (egg.kick <= 0 && prog > 0.3) { egg.kick = rand(1.5, 4) * (1.4 - prog); egg.wobV += rand(-3, 3) * prog; if (prog > 0.5) Snd.play('tap'); }
    egg.look = Math.sin(pet.P.t * 0.9);
    if (mode === 'egg') {
      const crackBefore = Math.floor(prog * 8);
      if (Sim.eggTick(st, dt)) { startHatch(); return; }
      const crackAfter = Math.floor(st.egg.prog / Sim.HATCH_NEED * 8);
      if (crackAfter !== crackBefore && crackAfter >= 4) { Snd.play('crack'); fx.shake(2); }
      const w = st.egg.warm;
      $('eggBar').querySelector('b').style.width = w + '%';
      $('eggPct').textContent = 'hatching ' + Math.round(prog * 100) + '%';
      if (w < 8 && st.hints.egg && !eggNagged && prog > 0.05) { eggNagged = true; toast('Brr! The egg is getting cold. Tap to warm it.'); }
      if (w > 30) eggNagged = false;
    }
  }
  let eggNagged = false;
  function clearToasts() { toasts.length = 0; clearTimeout(toastT); $('toast').classList.remove('show'); toastOn = false; }
  function startHatch() {
    mode = 'hatching'; hatchT = 0; ghost.hide(); clearToasts();
    $('eggBar').classList.add('hidden');
  }
  function updateHatch(dt) {
    hatchT += dt;
    const shakeAmt = Math.min(1, hatchT / 1.2);
    if (hatchT < 1.25) {
      egg.wob = Math.sin(hatchT * 40) * 0.14 * shakeAmt;
      if ([0.3, 0.7, 1.0].some(k => hatchT - dt < k && hatchT >= k)) { Snd.play('crack'); fx.shake(3); fx.buzz(20); }
    } else if (!st.hatchedAt) {
      Sim.hatch(st, now());
      Snd.play('hatch'); fx.shake(8); fx.buzz(60);
      const r = eggRect();
      fx.shells(r.x, r.y - r.h * 0.5); fx.sparkles(r.x, r.y - r.h * 0.5, 14, 70);
      pet.flash = 1; act('surprised'); pet.act.done = () => { act('hop'); Snd.voice('hi'); };
      save();
    }
    if (hatchT > 2.8 && mode === 'hatching') { mode = 'home'; showHUD(); namePicker(); }
  }

  // ------------------------------------------------------------------ food in flight + tourists
  let flying = null, eating = null;
  const tourists = [];
  function updateFlying(dt) {
    if (!flying) return;
    const f = flying; f.t += dt;
    const u = clamp(f.t / f.dur, 0, 1);
    f.x = lerp(f.x0, f.tx(), u); f.y = lerp(f.y0, f.ty(), u) - Math.sin(u * PI) * f.arc;
    f.rot = u * f.spin;
    if (u >= 1) { flying = null; f.arrive(); }
  }
  function spawnTourist(entry) {
    const s = pet.s * 0.42;
    tourists.push({ t: 0, x: W * (L.land ? 0.87 : 0.88), y: L.shore + 26, s, kind: Math.floor(rand(0, 4)), entry, flashed: false, flash: 0 });
  }
  function updateTourists(dt) {
    for (const tr of tourists) {
      tr.t += dt; tr.flash = Math.max(0, tr.flash - dt * 3);
      if (!tr.flashed && tr.t > 0.9) {
        tr.flashed = true; tr.flash = 1; Snd.play('shutter');
        if (st.asleep !== true && pet.where === 'home' && mode === 'home') act('pose');
        $('sightN').textContent = st.sightings; bumpChip();
        const e = tr.entry;
        toast('<b>Sighting #' + e.n + '!</b> <q>' + esc(e.said) + '</q><small>reported by ' + esc(e.who) + '</small>', 4200);
        const ms = milestoneLine(e.n - 1, e.n);
        if (ms) { toast('<b>' + ms.n + ' sightings!</b> ' + ms.text, 4200); Snd.play('best'); fx.sparkles(W * 0.8, 40, 12, 40); }
      }
    }
    for (let i = tourists.length - 1; i >= 0; i--) if (tourists[i].t > 4) tourists.splice(i, 1);
  }
  function drawTourists(c) {
    for (const tr of tourists) {
      const inU = smooth(clamp(tr.t / 0.5, 0, 1)), outU = smooth(clamp((tr.t - 3.4) / 0.6, 0, 1));
      c.save(); c.globalAlpha = inU * (1 - outU);
      c.translate(tr.x, tr.y); c.scale(1, 0.7 + 0.3 * inU);
      Art.drawTourist(c, 0, 0, tr.s, pet.P.t, tr.kind, tr.flash);
      c.restore();
    }
  }
  const MILESTONES = { 10: 'The lake paper runs a blurry photo on page 6.', 25: 'A tour boat adds a \u201cmonster lookout\u201d stop.', 50: 'Someone sells T-shirts. They\u2019re not great. You buy one.', 100: 'The town puts up a \u201cmonster crossing\u201d sign.', 250: 'A documentary crew shows up. Mostly films ducks.', 500: 'Legend status. Kids dress up as your monster for Halloween.', 1000: 'Officially the most-spotted monster on the lake.' };
  function milestoneLine(from, to) { let m = null; for (const k in MILESTONES) if (+k > from && +k <= to) m = k; return m ? { n: +m, text: MILESTONES[m] } : null; }
  function bumpChip() { const ch = $('sightChip'); ch.classList.remove('pop'); void ch.offsetWidth; ch.classList.add('pop'); }

  // ------------------------------------------------------------------ daily beach find (a message in a bottle with a wearable)
  let find = null, findWait = 4, pendingFind = null;
  function findSpot() { return L.land ? { x: W * 0.46, y: L.shore + (H - L.shore) * 0.5 } : { x: W * 0.85, y: L.shore + (L.petY - L.shore) * 0.4 }; }
  function findSize() { return Math.max(36, pet.s * 0.5); }
  function updateFind(dt) {
    if (pendingFind) {   // the card waits until we're back on the beach (not mid-game / mid-bath)
      pendingFind.t -= dt;
      if (pendingFind.t <= 0 && mode === 'home' && $('sheet').classList.contains('hidden')) { const pf = pendingFind; pendingFind = null; findCard(pf.r, pf.before); }
    }
    if (find) {
      find.t += dt;
      if (find.state === 'in' && find.t >= 1.1) { find.state = 'idle'; fx.burst(find.x, find.y, '#e9d3a0', 6); }
      if (find.state === 'open') { find.openT += dt; if (find.openT > 0.7) find = null; }
      else if (!Sim.findReady(st, now())) { find = null; if (ghost.mode === 'find') ghost.hide(); }
      return;
    }
    const ok = mode === 'home' && pet.where === 'home' && !cardOpen && !st.asleep && st.hints.feed && st.hints.pet && !pet.act && $('sheet').classList.contains('hidden') && Sim.findReady(st, now());
    if (!ok) return;
    findWait -= dt * (st.hints.find ? 2.5 : 1); if (findWait > 0) return;   // first one waits for the tutorial to settle
    const sp = findSpot();
    find = { x: sp.x, y: sp.y, t: 0, state: 'in', openT: 0 };
    fx.splash(sp.x - findSize() * 0.4, L.shore + 4, 0.6); Snd.play('splash', 0.4);
    if (!st.hints.find) { ghost.show('find'); toast('Something washed up on the beach! Tap the bottle.', 4200); }
    else toast('A bottle washed up on the beach!', 3000);
    pet.look = { x: sp.x, y: sp.y, until: pet.P.t + 2.5 };
  }
  function drawFind(c, t) {
    if (!find || mode !== 'home' || pet.where !== 'home' || (st.asleep && find.state !== 'open')) return;
    const s = findSize();
    let x = find.x, y = find.y, sc = 1;
    if (find.state === 'in') { const u = smooth(clamp(find.t / 1.1, 0, 1)); x = lerp(find.x - s * 0.5, find.x, u); y = lerp(L.shore + 2, find.y, u) - Math.sin(u * PI) * s * 0.25; }
    c.save();
    if (find.state === 'open') { const u = clamp(find.openT / 0.7, 0, 1); c.globalAlpha = 1 - u; sc = 1 + u * 0.4; }
    else {   // soft glow so it reads as tappable
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      const g = c.createRadialGradient(x, y - s * 0.15, 2, x, y - s * 0.15, s * 0.9);
      g.addColorStop(0, 'rgba(255,246,190,' + (0.35 + pulse * 0.2) + ')'); g.addColorStop(1, 'rgba(255,246,190,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y - s * 0.15, s * 0.9, 0, TAU); c.fill();
    }
    c.translate(x, y); c.scale(sc, sc);
    Art.drawBottle(c, 0, 0, s, t, find.state === 'open');
    c.restore();
  }
  function openFind() {
    find.state = 'open'; find.openT = 0; if (ghost.mode === 'find') ghost.hide();
    const s = findSize();
    Snd.play('pop'); Snd.play('clink'); fx.buzz(20);
    fx.sparkles(find.x, find.y - s * 0.3, 12, s * 0.7); fx.burst(find.x, find.y - s * 0.2, '#bff3e6', 10);
    const before = needSnap(), r = Sim.collectFind(st, now()); save();
    if (!r) return;
    pet.look = { x: find.x, y: find.y, until: pet.P.t + 2 }; act('surprised');
    if (!st.hints.find) { st.hints.find = 1; save(); }
    pendingFind = { r, before, t: 0.65 };
  }
  function findCard(r, before) {
    const nm = esc(st.name);
    const streak = '<p class="streak">' + (r.streak > 1 ? '🔥 ' + r.streak + ' days in a row!' : '🔥 Day 1 of your beach streak') + '</p>';
    const tmr = '<p class="sub" style="margin:4px 0 0">Another bottle washes up tomorrow.</p>';
    if (r.item) {
      const w = Sim.WEARS[r.item];
      showCard('<h2>Beach find!</h2><p class="sub">A message in a bottle · ' + st.closet.length + ' of 8 found</p><canvas class="art" data-art="head" data-wear="' + r.item + '"></canvas>' +
        '<p style="text-align:center">Inside: <b>' + w.line + '</b>!</p>' + streak + tmr,
        [{ label: 'Later', cls: 'pill', fn: () => toast('Saved in the wardrobe. Tap ' + nm + '’s name any time.', 3200) }, { label: 'Try it on', cls: 'big alt', fn: () => wearIt(r.item) }]);
    } else {
      showCard('<h2>Beach find!</h2><p class="sub">A message in a bottle</p><canvas class="art" data-art="portrait"></canvas>' +
        '<p style="text-align:center">A smooth piece of green sea glass. ' + nm + ' thinks it’s the best thing ever.' + (r.happy > 0 ? ' <b style="color:#e0507a">+' + r.happy + ' happy</b>' : '') + '</p>' + streak + tmr,
        [{ label: 'Lovely', cls: 'big alt', fn: () => { showGains(before); act('hop'); Snd.play('happy'); } }]);
    }
  }
  function wearIt(k) {
    Sim.setWear(st, k); save();
    if (k) { act('pose'); Snd.play('tada'); Snd.voice('yay'); if (pet.hit) { fx.sparkles(pet.hit.head.x, pet.hit.head.y - pet.hit.head.r * 0.8, 10, pet.hit.head.r); fx.hearts(pet.hit.head.x, pet.hit.head.y - 10, 3); } }
    else { act('wiggle'); Snd.play('tap'); }
  }

  // ------------------------------------------------------------------ Lake Cup (weekly league)
  const cupQ = [];
  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  const trophyIcon = (t) => t.rank === 1 ? '🏆' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : '🎗️';
  function cupBannerHtml() {
    const S = Sim.cupStandings(st, now());
    return '<button class="cupBanner" id="cupBtn"><span class="cupIc">🏆</span><span><b>Lake Cup</b> · ' + S.league + '<small>You’re ' + ordinal(S.rank) + ' of 6 · ' + (S.daysLeft ? S.daysLeft + (S.daysLeft === 1 ? ' day' : ' days') + ' left' : 'last day!') + '</small></span><i>›</i></button>';
  }
  function cupCard() {
    const S = Sim.cupStandings(st, now()), b = st.cup.best;
    showCard('<h2>Lake Cup</h2><p class="sub">' + S.league + ' · ' + (S.daysLeft ? S.daysLeft + (S.daysLeft === 1 ? ' day' : ' days') + ' left this week' : 'ends tonight!') + '</p><ol class="cup">' +
      S.rows.map((r, i) => '<li class="' + (r.me ? 'me' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.name) + '</span><b>' + r.score + '</b></li>').join('') + '</ol>' +
      '<p class="sub" style="margin-top:8px">Your score = your best Fish Leap (' + b.fish + ') + Bubble Pop (' + b.bubble + ') + Splash Tag (' + b.tag + ') this week. Top 2 move up a league.</p>' +
      (st.trophies.length ? '<p style="text-align:center">Trophy shelf: ' + st.trophies.slice(-12).map(trophyIcon).join('') + '</p>' : ''),
      [{ label: 'Back', cls: 'pill' }, { label: 'Play', cls: 'big alt', fn: () => playSheet() }]);
  }
  function cupResultCard(e) {
    showCard('<h2>Lake Cup results</h2><div class="bigstar">' + trophyIcon(e) + '</div><p style="text-align:center">' + esc(st.name) + ' finished <b>' + ordinal(e.rank) + '</b> in the ' + e.league + ' with ' + e.me + ' points.</p>' +
      (e.moved > 0 ? '<p class="streak">Promoted to the ' + e.newLeague + '!</p>' : e.moved < 0 ? '<p class="sub">Back to the ' + e.newLeague + ' for a week. You’ll bounce back.</p>' : '<p class="sub">Staying in the ' + e.newLeague + '.</p>') +
      '<p class="sub">A new week has started. New rivals, fresh scores.</p>',
      [{ label: 'Let’s go!', cls: 'big alt', fn: () => { act('hop'); Snd.voice('yay'); } }], { bind: () => { if (e.rank <= 3) { confetti(); Snd.play('best'); } } });
  }
  let cupT = 0;
  function updateCup(dt) {
    cupT -= dt; if (cupT > 0) return; cupT = 2;
    if (!st || st.stage === 'egg') return;
    const e = Sim.cupToday(st, now()).ended;
    if (e) { save(); if (e.played) cupQ.push(e); }
    if (cupQ.length && mode === 'home' && !cardOpen && $('sheet').classList.contains('hidden')) cupResultCard(cupQ.shift());
  }

  // ------------------------------------------------------------------ daily goals (three a day, stars unlock special wearables)
  const goalQ = [];   // toasts/cards wait here until we're back on the beach
  function goalText(g) {
    const nm = esc(st.name || 'your monster'), T = (k) => Games.INFO[k].title;
    if (g.k === 'meal') return 'Feed ' + nm + ' a perch meal';
    if (g.k === 'treat') return 'Share a treat with ' + nm;
    if (g.k === 'pet') return 'Give ' + nm + ' a long pet';
    if (g.k === 'bath') return 'Scrub ' + nm + ' clean in a bath';
    if (g.k === 'nap') return 'Tuck ' + nm + ' in for a nap';
    if (g.k === 'play') return g.n > 1 ? 'Play ' + g.n + ' mini-games' + (g.p && !g.done ? ' (' + g.p + '/' + g.n + ')' : '') : 'Play a mini-game';
    if (g.k === 'medal') return 'Win a ' + ['', 'bronze', 'silver', 'gold'][g.v] + ' medal in ' + T(g.g);
    if (g.k === 'combo') return g.g === 'fish' ? 'Catch ' + g.v + ' fish in a row in Fish Leap' : g.g === 'bubble' ? 'Pop a ' + g.v + '-bubble chain in Bubble Pop' : 'Tag ' + g.v + ' in a row in Splash Tag';
    return '';
  }
  function goalEv(ev) {
    if (!st || st.stage === 'egg') return;
    const r = Sim.goalEvent(st, ev, now());
    if (!r.done.length && !r.perfect) return;
    save(); goalQ.push(r);
  }
  function updateGoals() {
    if (!goalQ.length || mode !== 'home' || cardOpen || !$('sheet').classList.contains('hidden')) return;
    const r = goalQ.shift(), G = st.goals, n = G.list.filter(g => g.done).length;
    refreshHUD(true); const ch = $('goalChip'); ch.classList.remove('pop'); void ch.offsetWidth; ch.classList.add('pop');
    const cr = ch.getBoundingClientRect(); fx.sparkles(cr.left + cr.width / 2, cr.top + cr.height / 2, 8, 22);
    Snd.play('medal', 1); fx.buzz(15);
    r.done.forEach(g => toast('⭐ <b>Goal done!</b> ' + goalText(g) + '<small>' + n + ' of 3 today' + (st.goalDays === 0 && n === 1 ? ' · tap ⭐ up top to see them' : '') + '</small>', 3200));
    if (r.perfect) showCard('<h2>Perfect day!</h2><div class="bigstar">⭐</div><p style="text-align:center">All three goals done. <b>+2 bonus stars!</b><br>You have <b>' + st.stars + '</b> ⭐.</p>' + nextUnlockHtml() + '<p class="sub" style="margin-top:8px">New goals tomorrow.</p>',
      [{ label: 'Yay!', cls: 'big alt', fn: () => { act('hop'); Snd.voice('yay'); } }], { bind: () => { confetti(); Snd.play('best'); } });
    r.unlocked.forEach(k => showCard('<h2>Unlocked!</h2><p class="sub">' + st.stars + ' stars earned</p><canvas class="art" data-art="head" data-wear="' + k + '"></canvas><p style="text-align:center">Your stars earned <b>' + Sim.WEARS[k].line + '</b>!</p>',
      [{ label: 'Later', cls: 'pill' }, { label: 'Try it on', cls: 'big alt', fn: () => wearIt(k) }], { bind: () => confetti() }));
  }
  function nextUnlockHtml() {
    const k = Sim.STAR_WEARS.find(k => st.stars < Sim.WEARS[k].stars);
    if (!k) return '<p class="sub">Every star prize unlocked. Champion!</p>';
    const need = Sim.WEARS[k].stars;
    return '<div class="unlock"><canvas data-art="head" data-wear="' + k + '"></canvas><div>Next prize: <b>' + Sim.WEARS[k].name + '</b> at ' + need + ' ⭐<i><b style="width:' + Math.round(st.stars / need * 100) + '%"></b></i></div></div>';
  }
  function goalsCard() {
    if (st.stage === 'egg') return;
    const G = Sim.goalsToday(st, now()); G.fresh = false; save();
    showCard('<h2>Today’s goals</h2><p class="sub">⭐ ' + st.stars + ' stars · new goals every day</p><ul class="goals">' +
      G.list.map(g => '<li class="' + (g.done ? 'done' : '') + '"><span class="ck">' + (g.done ? '✓' : '') + '</span><span>' + goalText(g) + '</span><b>+1 ⭐</b></li>').join('') + '</ul>' +
      (G.perfect ? '<p class="streak">Perfect day! +2 bonus ⭐</p>' : '<p class="sub">Finish all three for +2 bonus ⭐</p>') + nextUnlockHtml(),
      [{ label: 'Let’s go', cls: 'big alt' }]);
  }

  // ------------------------------------------------------------------ pet movement (leave / return / bath / ice)
  function startLeaving() {
    pet.where = 'leaving'; pet.move = { t: 0 }; pet.act = null; Snd.play('away'); closeSheet();
  }
  function startReturning() {
    pet.where = 'returning'; pet.move = { t: 0 }; pet.act = null; Snd.play('splash', 0.4);
  }
  function lakeSpot() { return { x: W * 0.64, y: L.horizon + (L.shore - L.horizon) * 0.08 }; }
  function iceHole() { return { x: L.petX + pet.s * 0.2, y: L.shore - (L.shore - L.horizon) * 0.18 }; }
  function updateMove(dt) {
    const m = pet.move;
    if (pet.where === 'leaving') {
      m.t += dt; const T = m.t;
      const shoreP = { x: lerp(L.petX, W * 0.6, 0.5), y: L.shore + 4 };
      const far = lakeSpot();
      if (T < 1.4) {
        const u = smooth(T / 1.4);
        pet.x = lerp(L.petX, shoreP.x, u); pet.y = lerp(L.petY, shoreP.y, u); pet.scaleMul = lerp(1, 0.8, u); pet.water = 0;
        pet.mj = Math.abs(Math.sin(T * 9)) * 0.08;
      } else {
        const u = clamp((T - 1.4) / 5, 0, 1), e = smooth(u);
        pet.x = lerp(shoreP.x, far.x, e); pet.y = lerp(shoreP.y, far.y, e); pet.scaleMul = lerp(0.8, 0.14, e);
        pet.water = lerp(0, 0.85, smooth(clamp(u * 5, 0, 1)));
        if (Math.random() < dt * 6) fx.ring(pet.x, pet.y - pet.water * pet.s * pet.scaleMul * Art.geom(pet.P.stage, pet.P.variant).size, 10 * pet.scaleMul + 4);
        if (T > 2.2 && T < 3.8 && !actIs('wave')) { act('wave'); }
        if (u >= 1) { pet.where = 'away'; pet.move = null; pet.x = L.petX; pet.y = L.petY; pet.scaleMul = 1; pet.water = 0; noteDrop = 0; refreshHUD(true); toast(esc(st.name) + ' swam off to the other side of the lake. There’s a note on the sand.', 4200, true); }
      }
    } else if (pet.where === 'returning') {
      m.t += dt; const T = m.t;
      const shoreP = { x: lerp(L.petX, W * 0.6, 0.5), y: L.shore + 4 };
      const far = lakeSpot();
      if (T < 4) {
        const e = smooth(T / 4);
        pet.x = lerp(far.x, shoreP.x, e); pet.y = lerp(far.y, shoreP.y, e); pet.scaleMul = lerp(0.14, 0.8, e); pet.water = 0.85 * (1 - smooth(clamp((T - 3.2) / 0.8, 0, 1)));
        if (Math.random() < dt * 8) fx.ring(pet.x, pet.y - pet.water * pet.s * pet.scaleMul, 10 * pet.scaleMul + 4);
        pet.mj = 0;
      } else if (T < 5.2) {
        if (!m.splashed) { m.splashed = true; fx.splash(pet.x, pet.y, 1.2); Snd.play('splash'); }
        const u = smooth((T - 4) / 1.2);
        pet.x = lerp(shoreP.x, L.petX, u); pet.y = lerp(shoreP.y, L.petY, u); pet.scaleMul = lerp(0.8, 1, u); pet.water = 0;
        pet.mj = Math.abs(Math.sin(T * 9)) * 0.1; pet.P.wet = 1;
      } else {
        pet.where = 'home'; pet.move = null; pet.x = L.petX; pet.y = L.petY; pet.scaleMul = 1;
        act('shake'); pet.act.done = () => { act('hop'); Snd.play('back'); Snd.voice('yay'); if (pet.hit) fx.hearts(pet.hit.head.x, pet.hit.head.y, 6); };
        Snd.play('splash', 0.5);
        refreshHUD(true);
        setTimeout(() => toast(esc(st.name) + '’s back! All is forgiven. ♥', 3200, true), 900);
      }
    } else if (pet.where === 'toIce' || pet.where === 'fromIce') {
      m.t += dt;
      const h = iceHole(), u = smooth(clamp(m.t / 0.9, 0, 1));
      if (pet.where === 'toIce') {
        pet.x = lerp(L.petX, h.x, u); pet.y = lerp(L.petY, h.y + 8, u); pet.scaleMul = lerp(1, 0.75, u); pet.water = u * 1.6;
        if (m.t >= 0.9) { pet.where = 'ice'; pet.move = null; fx.splash(h.x, h.y, 0.8); Snd.play('splash', 0.6); }
      } else {
        pet.x = lerp(h.x, L.petX, u); pet.y = lerp(h.y + 8, L.petY, u); pet.scaleMul = lerp(0.75, 1, u); pet.water = (1 - u) * 1.6;
        if (m.t >= 0.9) { pet.where = 'home'; pet.move = null; pet.water = 0; pet.scaleMul = 1; pet.P.wet = 1; act('shake'); }
      }
    }
  }
  let noteDrop = 0;

  function syncWhere(live) {
    if (!st || st.stage === 'egg' || mode !== 'home') return;
    const deep = Sim.isDeepWinter(now());
    if (st.sulk && (pet.where === 'home' || pet.where === 'ice')) {
      if (live) startLeaving(); else { pet.where = 'away'; pet.move = null; noteDrop = 1; }
    } else if (!st.sulk && pet.where === 'away') {
      if (live) startReturning(); else pet.where = 'home';
    }
    if (pet.where === 'home' && st.asleep && deep && !pet.act) { pet.where = 'toIce'; pet.move = { t: 0 }; }
    if (pet.where === 'ice' && (!st.asleep || !deep)) { pet.where = 'fromIce'; pet.move = { t: 0 }; fx.splash(iceHole().x, iceHole().y, 0.8); Snd.play('splash', 0.6); }
  }

  // ------------------------------------------------------------------ care actions
  const FOOD_COL = { perch: '#c9b24a', berries: '#3a4aa8', cookie: '#d9963f', creemee: '#fbe9c8' };
  function feedStart(kind, fromEl) {
    let r = fromEl ? fromEl.getBoundingClientRect() : null;
    if (!r || r.width === 0 || r.top > H) { const fb = document.querySelector('#actions [data-act=feed]').getBoundingClientRect(); r = fb.width ? fb : { left: W / 2, top: H - 60, width: 0, height: 0 }; }
    closeSheet();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 3;
    if (st.sulk) {
      const far = lakeSpot();
      flying = { kind, x0, y0, x: x0, y: y0, t: 0, dur: 1.0, arc: H * 0.25, spin: 6, tx: () => far.x, ty: () => far.y, size: pet.s * 0.4,
        arrive() {
          fx.splash(far.x, far.y, 0.5); Snd.play('splash', 0.4);
          const res = Sim.feed(st, kind, now());
          save();
          if (res.returned) { toast('A happy splash from across the lake…', 2600, true); }
          else { setTimeout(() => toast('The ripples go quiet… no answer. The note might have a clue.', 3400, true), 500); }
        } };
      Snd.play('ui');
      return;
    }
    const before = needSnap();
    const res = Sim.feed(st, kind, now());
    const mouth = () => pet.hit ? pet.hit.mouth : { x: pet.x, y: pet.y - pet.s * 1.5 };
    act('anticipate');
    flying = { kind, x0, y0, x: x0, y: y0, t: 0, dur: 0.75, arc: pet.s * 0.9, spin: 0.5, tx: () => mouth().x, ty: () => mouth().y, size: pet.s * 0.42,
      arrive() {
        if (!res.ok) {
          act('refuse'); Snd.play('nope'); Snd.voice('hmph');
          dropFood(kind);
          if (res.reason === 'full') toast(esc(st.name) + '’s full! Maybe later.');
          else if (res.reason === 'tummy') toast('Tummy’s still grumbly. No treats for a little while.');
          return;
        }
        eating = { kind, bite: 0 };
        act('eat', { crumb: FOOD_COL[kind] });
        pet.act.done = () => {
          refreshHUD(true); showGains(before);
          if (res.tummy) { act('tummy'); Snd.play('sad'); setTimeout(() => showCard('<h2>Tummy ache!</h2><canvas class="art" data-art="tummy"></canvas><p>Three creemees was one too many. ' + esc(st.name) + ' will be fine. No more treats for half an hour, okay?</p>', [{ label: 'Poor thing', cls: 'big alt' }]), 900); }
          else if (res.warn) { act('queasy'); toast(esc(st.name) + ' looks a tiny bit queasy. Maybe that’s enough creemee for now.', 3600); }
          else if (res.fav) { act('hop'); Snd.play('happy'); Snd.voice('yay'); if (pet.hit) fx.hearts(pet.hit.head.x, pet.hit.head.y - 10, 6); if (!st.favKnown) { st.favKnown = 1; toast(esc(st.name) + ' LOVES ' + Sim.FOODS[kind].name.toLowerCase() + (kind === 'berries' ? '!' : 's!') + ' ♥', 3200); } }
          else { Snd.play('yum'); Snd.voice('mmm'); if (kind !== 'perch' && pet.hit) fx.hearts(pet.hit.head.x, pet.hit.head.y - 10, 2); }
          if (!st.hints.feed) { st.hints.feed = 1; hintNext(); }
          goalEv({ type: 'feed', kind });
          save();
        };
      } };
    Snd.play('ui');
  }
  let dropped = null;
  function dropFood(kind) { dropped = { kind, x: pet.hit ? pet.hit.mouth.x : pet.x, y: pet.hit ? pet.hit.mouth.y : pet.y - 100, vy: -120, vx: 90, t: 0 }; }

  function doSleep() {
    if (st.asleep) {
      const r = Sim.wake(st, now()); save();
      Snd.play('ui');
      if (pet.where === 'home') { act('wake'); pet.act.done = () => { if (r.grumpy) { act('grumpy'); Snd.voice('hmph'); toast(esc(st.name) + ' is a bit grumpy. Still sleepy!'); } }; }
      refreshHUD(true);
      return;
    }
    const r = Sim.sleep(st, now());
    if (!r.ok) { act('refuse'); Snd.play('nope'); toast(esc(st.name) + ' isn’t sleepy yet!'); return; }
    act('yawn'); Snd.play('yawn'); goalEv({ type: 'nap' });
    save(); refreshHUD(true);
    toast(Sim.isDeepWinter(now()) ? 'Lights out. ' + esc(st.name) + ' naps under the ice in deep winter.' : 'Lights out. Sweet dreams, ' + esc(st.name) + '.', 2600);
  }

  // bath
  const bath = { t: 0, phase: 'in', rinse: 0, scrubSnd: 0 };
  function startBath() {
    const clean = st.needs.clean;
    mode = 'bath'; bath.t = 0; bath.phase = 'in'; bath.rinse = 0; bath.before = needSnap(); bath.left = null; bath.scrubT = 0; bath.ringT = 0;
    if (clean >= 92) { pet.spots.forEach(s => s.a = 0); bath.already = true; }
    else { bath.already = false; const n = Math.max(2, Math.min(7, Math.ceil((100 - clean) / 13))); bath.n = n; pet.spots.forEach((s, i) => s.a = i < n ? 0.95 : 0); }
    $('actions').classList.add('hidden'); $('bathBar').classList.remove('hidden');
    $('bathMsg').textContent = bath.already ? 'Already squeaky clean! Splash around.' : 'Rub to scrub off the mud!';
    Snd.play('splash', 0.5);
  }
  function bathSpot() { return { x: L.land ? L.petX : W * 0.5, y: L.shore + 16 }; }
  function updateBath(dt) {
    bath.t += dt;
    const sp = bathSpot();
    if (bath.phase === 'in') {
      const u = smooth(clamp(bath.t / 0.8, 0, 1));
      pet.x = lerp(L.petX, sp.x, u); pet.y = lerp(L.petY, sp.y, u); pet.scaleMul = lerp(1, 1.08, u); pet.water = u * 0.55;
      pet.mj = Math.abs(Math.sin(bath.t * 9)) * 0.06 * (1 - u);
      if (bath.t >= 0.8) { bath.phase = 'scrub'; fx.splash(pet.x, pet.y - pet.water * pet.s * 0.85, 0.8); Snd.play('splash', 0.7); if (bath.already) { bath.phase = 'rinse'; bath.t = 0; } }
    } else if (bath.phase === 'scrub') {
      bath.scrubT = (bath.scrubT || 0) + dt;
      if (pet.hit) {   // help: mud under the water rinses off on its own; after a while the last spots glow, then the lake washes them away
        const g = Art.geom(pet.P.stage, pet.P.variant), k = pet.s * pet.scaleMul * g.size, wl = pet.y - pet.water * k;
        bath.ringT = (bath.ringT || 0) - dt;
        for (const s of pet.spots) {
          if (s.a < 0.06) continue;
          const base = s.on === 'head' ? pet.hit.head : pet.hit.body, sx = base.x + s.x * k, sy = base.y + s.y * k;
          if (sy > wl + 4 && bath.scrubT > 1) s.a = Math.max(0, s.a - dt * 0.6);
          if (bath.scrubT > 4 && bath.ringT <= 0) fx.ring(sx, sy, s.r * k + 6);
          if (bath.scrubT > 10) s.a = Math.max(0, s.a - dt * 0.5);
        }
        if (bath.ringT <= 0) bath.ringT = 1.1;
      }
      const left = pet.spots.filter(s => s.a >= 0.06).length;
      if (left !== bath.left) { if (bath.left != null && left < bath.left) { Snd.play('pop'); fx.buzz(12); } bath.left = left; $('bathMsg').textContent = left ? 'Rub off the mud! ' + left + (left === 1 ? ' spot' : ' spots') + ' left' : 'All clean!'; }
      if (left === 0) { bath.phase = 'rinse'; bath.t = 0; }
    } else if (bath.phase === 'rinse') {
      if (!pet.act && bath.t < 0.1) { act('dunk'); fx.splash(pet.x, pet.y - pet.water * pet.s, 1.3); Snd.play('splash'); }
      if (bath.t > 0.9 && !bath.done) {
        bath.done = true; pet.P.wet = 1; Sim.bathDone(st, !bath.already); if (!bath.already) goalEv({ type: 'bath' }); save(); refreshHUD(true); showGains(bath.before);
        act('shake'); pet.act.done = () => { act('hop'); Snd.play('happy'); };
        Snd.play('sparkle'); if (pet.hit) fx.sparkles(pet.hit.body.x, pet.hit.body.y - pet.s * 0.5, 12, pet.s * 0.8);
        $('bathMsg').textContent = 'Squeaky clean!';
      }
      if (bath.t > 2.6) { bath.phase = 'out'; bath.t = 0; }
    } else if (bath.phase === 'out') {
      const u = smooth(clamp(bath.t / 0.8, 0, 1));
      pet.x = lerp(sp.x, L.petX, u); pet.y = lerp(sp.y, L.petY, u); pet.scaleMul = lerp(1.08, 1, u); pet.water = (1 - u) * 0.55;
      if (bath.t >= 0.8) endBath();
    }
  }
  function endBath() {
    mode = 'home'; bath.done = false; pet.x = L.petX; pet.y = L.petY; pet.scaleMul = 1; pet.water = 0;
    $('bathBar').classList.add('hidden'); $('actions').classList.remove('hidden'); refreshHUD(true);
  }
  function scrubAt(x, y, dist) {
    if (bath.phase !== 'scrub' || !pet.hit) return;
    const g = Art.geom(pet.P.stage, pet.P.variant), k = pet.s * pet.scaleMul * g.size;
    let any = false;
    for (const s of pet.spots) {
      if (s.a < 0.02) continue;
      const base = s.on === 'head' ? pet.hit.head : pet.hit.body;
      const sx = base.x + s.x * k, sy = base.y + s.y * k;
      if (Math.hypot(sx - x, sy - y) < s.r * k + 34) { s.a = Math.max(0, s.a - dist * 0.008); any = true; }
    }
    const onPet = inPet(x, y, 20);
    if (onPet) {
      if (Math.random() < 0.5) fx.suds(x, y);
      bath.scrubSnd -= dist; if (bath.scrubSnd <= 0) { Snd.play('scrub'); bath.scrubSnd = 40; }
      if (!pet.act && Math.random() < 0.01) { act('giggle'); Snd.play('giggle'); }
    }
    if (any && Math.random() < 0.3) fx.buzz(5);
  }

  // ------------------------------------------------------------------ mini-games
  let game = null, gameName = '', gameEnd = 0;
  function gameApi() {
    return { W, H, fx, snd: Snd, art: Art, petS: pet.s, stage: st.stage, variant: st.variant, wear: st.wear, pose: Object.assign(Art.pose(), { stage: st.stage, variant: st.variant, wear: st.wear, t: pet.P.t }), drawPetWater };
  }
  function startGame(name) {
    closeSheet(); clearToasts(); ghost.hide(); hintOn = '';
    pet.act = null; eating = null; flying = null; dropped = null; if (pet.petting) finishPetting();
    gameName = name; gameBefore = null; gameEv = null; game = Games.start(name, gameApi());
    mode = 'game'; gameEnd = 0; gameEnded = false; Snd.setSong('game');
    $('hud').classList.add('hidden'); $('actions').classList.add('hidden'); $('mgHud').classList.remove('hidden');
    $('mgTitle').textContent = Games.INFO[name].title; $('mgHow').textContent = Games.INFO[name].how;
    $('mgIntro').classList.remove('hidden');
    Snd.play('go');
  }
  function relaunchGame() {
    const old = game; if (!old || old.over) return;
    const g = Games.start(gameName, gameApi());
    g.score = old.score; g.time = old.time; g.intro = Math.max(0.6, old.intro); g.bestCombo = old.bestCombo;
    game = g;
  }
  let lastSec = 99;
  function updateGame(dt) {
    if (!game || cardOpen) return;   // a card (quit confirm / results) pauses the mini-game
    const wasIntro = game.intro > 0;
    game.update(dt);
    if (wasIntro && game.intro <= 0) { $('mgIntro').classList.add('hidden'); Snd.play('go'); }
    const tb = $('mgHud').querySelector('.mgTime');
    tb.firstElementChild.style.width = (game.time / Games.LEN * 100) + '%';
    tb.classList.toggle('hurry', game.time < 5);
    $('mgScore').textContent = game.score;
    $('mgCombo').textContent = game.fever > 0 ? 'FEVER ×2' : game.combo >= 2 ? 'combo ' + game.combo : '';
    $('mgHud').classList.toggle('fever', game.fever > 0);
    const sec = Math.ceil(game.time);
    if (sec !== lastSec && sec <= 3 && sec > 0 && game.intro <= 0) { Snd.play('tick'); Snd.play('count', 8 + (3 - sec) * 4); fx.text(W / 2, H * 0.4, String(sec), sec === 1 ? '#ff8f7a' : '#ffe066', 92); }
    lastSec = sec;
    if (game.over) { gameEnd += dt; if (gameEnd > 0.6 && !gameEnded) endGame(); }
  }
  let gameEnded = false;
  function endGame(quit) {
    gameEnded = true;
    const g = game;
    if (quit) { closeGame(); return; }
    gameBefore = needSnap();
    const res = Sim.playDone(st, gameName, g.score); save();
    gameEv = { type: 'game', name: gameName, tier: Games.medal(gameName, g.score), combo: g.bestCombo };
    const cup = Sim.cupScore(st, gameName, g.score, now()); save();
    if (cup.ended && cup.ended.played) cupQ.push(cup.ended);
    const cupRank = Sim.cupStandings(st, now()).rank;
    goalEv(gameEv); gameEv = null; if (!st.hints.play) st.hints.play = 1; save();   // credit at "Time!", not on leaving (toasts still wait for the beach)
    const info = Games.INFO[gameName];
    const can = Sim.canPlay(st) === '';
    const tier = Games.medal(gameName, g.score), M = Games.MEDALS[gameName], isBest = res.best && g.score > 0;
    const next = tier < 3 ? '<small>Next: ' + ['bronze', 'silver', 'gold'][tier] + ' at ' + M[tier] + '</small>' : '<small>Top medal. ' + esc(st.name) + ' is so impressed.</small>';
    showCard('<h2>' + esc(info.title) + '</h2><p class="sub">Time!</p><div class="medalRow">' + (tier ? '<canvas class="medal pre" data-art="medal:' + tier + '"></canvas>' : '') + '<div class="bignum">0</div></div>' +
      '<p class="medalTxt">' + (tier ? ['', 'Bronze', 'Silver', 'Gold'][tier] + ' medal!' : 'Nice try!') + next + '</p>' +
      (isBest ? '<p class="newBest">New best!</p>' : '<p style="text-align:center">Best: ' + st.best[gameName] + '</p>') +
      '<p style="text-align:center">' + esc(st.name) + ' had fun! <b style="color:#e0507a">+' + res.gain + ' happy</b>' + (g.bestCombo >= 4 ? '<br><small>Best combo: ' + g.bestCombo + '</small>' : '') + '</p>' +
      (cup.improved ? '<p class="cupLine">🏆 Lake Cup +' + (cup.after - cup.before) + ' · you’re now <b>' + ordinal(cupRank) + '</b></p>' : ''),
      [{ label: 'Back to the beach', cls: 'pill', fn: closeGame }, { label: can ? 'Play again' : 'Too tired', cls: 'big alt', disabled: !can, fn: () => { closeGame(); startGame(gameName); } }],
      { bind: (root) => countUp(root, g.score, tier, isBest) });
  }
  let gameBefore = null, gameEv = null;
  function countUp(root, to, tier, isBest) {
    const el = root.querySelector('.bignum'), md = root.querySelector('canvas.medal');
    const dur = Math.min(1100, 350 + to * 6), t0 = performance.now();
    let shown = -1, ticks = -1; const seq = cardSeq;
    const finish = () => {
      el.textContent = to; el.classList.add('land'); if (md) md.classList.remove('pre');
      Snd.play(tier ? 'medal' : 'end', tier); fx.buzz(tier ? 25 : 10);
      if (isBest) { root.querySelector('.newBest').classList.add('show'); setTimeout(() => Snd.play('best'), 280); confetti(); }
    };
    (function step() {
      if (!el.isConnected || seq !== cardSeq || !cardOpen) return;   // card closed (e.g. Play again): no late fanfare
      const u = Math.min(1, (performance.now() - t0) / dur), n = Math.round(to * (1 - Math.pow(1 - u, 3)));
      if (n !== shown) { shown = n; el.textContent = n; const tk = Math.floor(u * 10); if (tk !== ticks) { ticks = tk; Snd.play('count', tk); } }
      if (u < 1) requestAnimationFrame(step); else finish();
    })();
  }
  function confetti() {
    const box = $('card'), cols = ['#ff6f91', '#ffd23f', '#4fc9b6', '#5aa9ff', '#ff9f43', '#b98cff'];
    for (let i = 0; i < 40; i++) {
      const e = document.createElement('i'); e.className = 'confetti';
      e.style.left = rand(4, 96) + '%'; e.style.background = cols[i % cols.length];
      e.style.animationDelay = rand(0, 0.35) + 's'; e.style.animationDuration = rand(1.5, 2.4) + 's';
      e.style.setProperty('--dx', rand(-60, 60) + 'px'); e.style.setProperty('--rot', rand(-720, 720) + 'deg');
      box.appendChild(e); setTimeout(() => e.remove(), 3000);
    }
  }
  function closeGame() {
    game = null; gameEnded = false; mode = 'home'; Snd.setSong('home');
    $('mgHud').classList.add('hidden'); $('mgIntro').classList.add('hidden');
    showHUD(); refreshHUD(true); if (!showGains(gameBefore)) bumpNeed('happy'); gameBefore = null;
    pet.x = L.petX; pet.y = L.petY; act('hop');
  }

  // ------------------------------------------------------------------ HUD + UI
  function showHUD() {
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
    const isEgg = st.stage === 'egg';
    $('needs').classList.toggle('hidden', isEgg); $('eggBar').classList.toggle('hidden', !isEgg || mode === 'hatching');
    $('actions').classList.toggle('hidden', isEgg || mode === 'bath' || mode === 'game');
    refreshHUD(true);
  }
  const lastBar = {}; let lastSig = '';
  function refreshHUD(force) {
    if (!st) return;
    const n = st.needs;
    for (const k of ['hunger', 'happy', 'energy', 'clean']) {
      const v = Math.round(n[k]);
      if (force || lastBar[k] !== v) {
        lastBar[k] = v;
        const el = document.querySelector('.need[data-k=' + k + ']');
        el.querySelector('b').style.width = Math.max(4, v) + '%';
        el.classList.toggle('low', v < 25 && !st.sulk && st.stage !== 'egg');
      }
    }
    if (st.stage !== 'egg' && !st.sulk && (!st.goals || st.goals.day !== Sim.dayNum(now()))) Sim.goalsToday(st, now());
    const sig = [st.stage, st.name, stageLabel(), st.goals ? st.goals.day + ':' + st.goals.list.filter(g => g.done).length : '', st.sightings, !!st.sulk, st.asleep, hintOn, n.hunger < 25, n.clean < 25, n.happy < 30, n.energy < 20, n.hunger >= 25, n.energy >= 20].join('|');
    if (!force && sig === lastSig) return;
    lastSig = sig;
    $('petName').textContent = st.stage === 'egg' ? 'A mystery egg' : st.name || 'Baby';
    $('petStage').textContent = stageLabel();
    $('sightN').textContent = st.sightings;
    const gc = $('goalChip'); gc.classList.toggle('hidden', st.stage === 'egg');
    if (st.stage !== 'egg' && st.goals) { const nd = st.goals.list.filter(g => g.done).length; $('goalN').textContent = nd + '/3'; gc.classList.toggle('alldone', nd === 3); }
    // action buttons
    const btn = (a) => document.querySelector('#actions [data-act=' + a + ']');
    const fb = btn('feed'); fb.querySelector('span').textContent = st.sulk ? 'Coax' : 'Feed'; fb.querySelector('i').className = 'ai ' + (st.sulk ? 'coax' : 'feed');
    const sb = btn('sleep'); sb.querySelector('span').textContent = st.asleep ? 'Wake' : 'Sleep'; sb.querySelector('i').className = 'ai ' + (st.asleep ? 'wake' : 'sleep');
    btn('play').classList.toggle('dim', !!st.sulk || st.asleep);
    btn('swim').classList.toggle('dim', !!st.sulk || st.asleep);
    sb.classList.toggle('dim', !!st.sulk);
    // gentle nudges for low needs (and the tutorial)
    if (!st.sulk && !st.asleep && st.stage !== 'egg') {
      fb.classList.toggle('nudge', n.hunger < 25 || hintOn === 'feed');
      btn('swim').classList.toggle('nudge', n.clean < 25 && n.hunger >= 25);
      btn('play').classList.toggle('nudge', (n.happy < 30 && n.hunger >= 25 && n.energy >= 20) || hintOn === 'play');
      sb.classList.toggle('nudge', n.energy < 20);
    } else document.querySelectorAll('#actions .nudge').forEach(b => b.classList.remove('nudge'));
  }
  function stageLabel() {
    if (!st || st.stage === 'egg') return 'found on the beach · keep it warm';
    const day = Sim.dayNum(now()) - Sim.dayNum(st.hatchedAt || now()) + 1;   // calendar days, so day 2 starts at midnight
    const nm = st.stage === 'grown' ? (Sim.VARIANTS[st.variant] || Sim.VARIANTS.sunny).name + ' Champ' : st.stage === 'juvenile' ? 'Juvenile' : 'Hatchling';
    if (st.sulk) return 'Across the lake · day ' + day;   // the status matters more than the stage name (and must not get cut off)
    if (st.asleep) return 'Sleeping · day ' + day;
    return nm + ' · day ' + day;
  }
  function bumpNeed(k) { const el = document.querySelector('.need[data-k=' + k + ']'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  /** "+N" numbers that rise into the need bars after a care action. */
  function needSnap() { return st ? Object.assign({}, st.needs) : null; }
  function showGains(before) {
    if (!before || !st) return 0;
    let i = 0;
    for (const k of ['hunger', 'happy', 'energy', 'clean']) {
      const d = Math.round(st.needs[k] - before[k]);
      if (d < 1) continue;
      const el = document.querySelector('.need[data-k=' + k + ']');
      const g = document.createElement('span'); g.className = 'gain'; g.textContent = '+' + d; g.style.animationDelay = (i * 0.09) + 's';
      el.appendChild(g); setTimeout(() => g.remove(), 1600); setTimeout(() => bumpNeed(k), 500 + i * 90); i++;
    }
    return i;
  }

  // toast queue
  const toasts = []; let toastT = 0, toastOn = false;
  function toast(html, ms, urgent) {
    if (urgent) { toasts.length = 0; clearTimeout(toastT); toastOn = false; }
    if (toasts.length > 3) toasts.shift(); toasts.push({ html, ms: ms || 2600 }); if (!toastOn) nextToast();
  }
  function nextToast() {
    const el = $('toast');
    if (!toasts.length) { toastOn = false; el.classList.remove('show'); return; }
    const t = toasts.shift(); toastOn = true; el.innerHTML = t.html; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 280); }, t.ms);
  }

  // sheet
  let tapGuard = 0;   // a double tap on Feed/Play must not also pick the option that opens under the finger
  // ...and a click only counts if its finger went down after the menu appeared (time-only guards leak on slow phones)
  const downOk = { sheet: false, card: false };
  ['sheet', 'card'].forEach(id => {
    $(id).addEventListener('pointerdown', () => { downOk[id] = performance.now() > tapGuard; }, true);   // a finger that lands within 300 ms is the 2nd half of a double tap
    $(id).addEventListener('click', (e) => { if (!downOk[id]) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
  function openSheet(title, html, bind) {
    tapGuard = performance.now() + 300; downOk.sheet = false; clearToasts();
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheet').classList.remove('hidden');
    if (bind) bind($('sheetBody'));
    drawMiniCanvases($('sheetBody'));
  }
  function closeSheet() { $('sheet').classList.add('hidden'); }
  $('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet')) { closeSheet(); Snd.play('tap'); } });

  // cards (queued)
  const cardQ = []; let cardOpen = false, cardSeq = 0;
  function showCard(html, btns, opts) {
    cardQ.push({ html, btns: btns || [{ label: 'OK', cls: 'big alt' }], opts: opts || {} });
    if (!cardOpen) nextCard();
  }
  function nextCard() {
    const c0 = cardQ.shift();
    if (!c0) { cardOpen = false; $('card').classList.add('hidden'); return; }
    cardOpen = true; cardSeq++; tapGuard = performance.now() + 300; downOk.card = false; clearToasts();
    $('cardBody').innerHTML = c0.html;
    const bw = $('cardBtns'); bw.innerHTML = '';
    c0.btns.forEach(b => {
      const el = document.createElement('button'); el.className = b.cls || 'pill'; el.innerHTML = b.label; if (b.disabled) el.disabled = true;
      el.addEventListener('click', () => { Snd.play('ui'); if (!b.keep) closeCard(); if (b.fn) b.fn(); });
      bw.appendChild(el);
    });
    $('card').classList.remove('hidden');
    drawMiniCanvases($('cardBody'));
    if (c0.opts.bind) c0.opts.bind($('cardBody'));
  }
  function closeCard() { cardOpen = false; $('card').classList.add('hidden'); setTimeout(() => { if (!cardOpen) nextCard(); }, 150); }

  /** Small canvases in sheets/cards: data-art = food kind, game, portrait, tummy, note */
  function drawMiniCanvases(root) {
    root.querySelectorAll('canvas[data-art]').forEach(cn => {
      const w = cn.clientWidth || 72, h = cn.clientHeight || 64, d = Math.min(2, window.devicePixelRatio || 1);   // layout size (cards animate in with a scale)
      cn.width = Math.round(w * d); cn.height = Math.round(h * d); cn.__dpr = d;
      const x = cn.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
      const k = cn.dataset.art;
      if (Sim.FOODS[k]) { Art.drawFood(x, k, w / 2, h / 2 + 2, Math.min(w, h) * 0.6, 0); return; }
      if (k === 'fish') { Art.drawFish(x, w / 2, h / 2, Math.min(w, h) * 0.8, -0.3, 'perch', 0); return; }
      if (k === 'bubble') { Art.drawBubble(x, w * 0.4, h * 0.55, h * 0.28, 'plain', 0); Art.drawBubble(x, w * 0.7, h * 0.3, h * 0.17, 'rainbow', 1); return; }
      if (k === 'tag') { Art.drawLilyPad(x, w * 0.5, h * 0.72, w * 0.36, true, 0); Art.drawDuck(x, w * 0.5, h * 0.48, h * 0.42, 0); return; }
      if (k.indexOf('medal:') === 0) { Art.drawMedal(x, w / 2, h * 0.36, Math.min(w * 0.36, h * 0.3), +k.slice(6), 0); return; }
      // portraits
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe6ff'); g.addColorStop(0.62, '#7fb8e0'); g.addColorStop(0.62, '#ecd29a'); g.addColorStop(1, '#d9b277');
      x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 18); x.fill();
      const P = Object.assign(Art.pose(), { stage: st.stage === 'egg' ? 'hatchling' : st.stage, variant: st.variant, t: pet.P.t, eyeStyle: 'happy', mouth: 'grin', blush: 0.8, wear: cn.dataset.wear != null ? (cn.dataset.wear || null) : st.wear });
      if (k === 'tummy') Object.assign(P, { eyeStyle: 'squint', mouth: 'wavy', tummy: 1, brow: 'sad' });
      if (k === 'away') Object.assign(P, { eyeStyle: 'normal', mouth: 'smile', px: 0.5 });
      const key = 'pet_' + (P.stage === 'grown' ? (P.variant || 'sunny') : P.stage);
      if (k === 'portrait' && Art.drawImg(x, key, w / 2, h * 0.96, Math.min(w * 0.6, h * 0.8))) return;
      if (k === 'head') {   // close-up on the face (wardrobe)
        const g = Art.geom(P.stage, P.variant), kk = h * 0.27 / g.headR;
        P.shadow = 0; P.t = 0.4;
        Art.drawPet(x, w / 2 + 0.154 * g.rx * kk, h * 0.6 + (2 * g.ry + g.neck + 0.55 * g.headR) * kk, kk / g.size, P);
        return;
      }
      const gs = Art.geom(P.stage, P.variant).size;
      const s = Math.min(w * 0.4, h * 0.4) / Math.max(0.75, gs);
      Art.drawPet(x, w / 2, h * 0.93, s, P);
    });
  }

  // ------------------------------------------------------------------ hints / tutorial
  let hintOn = '';
  const ghost = {
    el: $('ghost'), mode: '', t: 0,
    show(m) { this.mode = m; this.t = 0; this.el.classList.remove('hidden'); },
    hide() { this.mode = ''; this.el.classList.add('hidden'); },
    update(dt) {
      if (!this.mode) return;
      this.t += dt;
      let x = 0, y = 0, sc = 1;
      if (this.mode === 'egg') { const r = eggRect(); const ph = this.t % 1.1; x = r.x + 10; y = r.y - r.h * 0.45 + (ph < 0.25 ? -ph * 30 : 0); sc = ph < 0.25 ? 0.9 : 1; }
      else if (this.mode === 'find' && find) { const ph = this.t % 1.1; x = find.x + 4; y = find.y - findSize() * 0.25 + (ph < 0.25 ? -ph * 30 : 0); sc = ph < 0.25 ? 0.9 : 1; }
      else if (this.mode === 'pet' && pet.hit) { const ph = (this.t % 1.8) / 1.8; x = pet.hit.body.x + (ph - 0.5) * pet.hit.body.rx * 1.6; y = pet.hit.body.y - pet.hit.body.ry * 0.3 + Math.sin(ph * PI) * -10; }
      this.el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')';
      this.el.style.opacity = (this.mode === 'find' && mode !== 'home') || cardOpen || !$('sheet').classList.contains('hidden') ? 0 : '';   // never float over menus
    },
  };
  function hintNext() {
    if (!st || st.stage === 'egg' || st.sulk || st.asleep) return;
    hintOn = '';
    if (!st.hints.feed) { hintOn = 'feed'; toast(esc(st.name) + ' is hungry! Tap <b>Feed</b>.', 3500); }
    else if (!st.hints.pet) { setTimeout(() => { if (!st.hints.pet && mode === 'home') { ghost.show('pet'); toast('Stroke ' + esc(st.name) + ' with your finger to pet it.', 3500); } }, 1800); }
    else if (!st.hints.play) { hintOn = 'play'; setTimeout(() => { hintOn = ''; refreshHUD(true); }, 9000); toast('Try a game in the lake: tap <b>Play</b>.', 3000); }
    refreshHUD(true);
  }

  // ------------------------------------------------------------------ name picker
  const NAMES = ['Pip', 'Bloop', 'Chompers', 'Bixby', 'Puddle', 'Marble', 'Tater', 'Squish', 'Wren', 'Bean', 'Dumpling', 'Fig', 'Pickles', 'Waffles', 'Moxie', 'Noodle', 'Ripple', 'Sprout', 'Biscuit', 'Mochi', 'Tadpole', 'Gus', 'Clover', 'Juniper', 'Pebble', 'Kelp', 'Nori', 'Toast', 'Maple', 'Gherkin'];
  function namePicker() {
    let opts = [], sel = '';
    const roll = () => { const pool = NAMES.slice(); opts = []; for (let i = 0; i < 4; i++) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); sel = opts[0]; };
    roll();
    const render = (root) => {
      const box = root.querySelector('.names');
      box.innerHTML = opts.map(n => '<button class="' + (n === sel ? 'sel' : '') + '">' + n + '</button>').join('') + '<button data-r="1" aria-label="More names">↻</button>';
      box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        Snd.play('tap'); if (b.dataset.r) roll(); else sel = b.textContent; render(root);
        $('cardBtns').querySelector('button').textContent = 'Hi, ' + sel + '!';
      }));
    };
    showCard('<h2>It hatched!</h2><canvas class="art" data-art="portrait"></canvas><p class="sub">A baby lake monster! What should we call it?</p><div class="names"></div>',
      [{ label: 'Hi, ' + sel + '!', cls: 'big alt', fn: () => { st.name = sel; save(); refreshHUD(true); act('hop'); Snd.voice('hi'); setTimeout(hintNext, 600); } }],
      { bind: render });
  }

  // ------------------------------------------------------------------ cards: profile, sightings, menu, note, away
  function profileCard() {
    if (st.stage === 'egg') { showCard('<h2>A mystery egg</h2><p>Found half-buried on the beach, still warm. Something inside is wiggling.</p><p>Tap it (or rub it) to keep it warm. Warm eggs hatch faster.</p>'); return; }
    const age = Sim.ageHours(st, now());
    const ageTxt = age < 24 ? Math.max(1, Math.round(age)) + (Math.round(age) <= 1 ? ' hour old' : ' hours old') : Math.floor(age / 24) + (Math.floor(age / 24) === 1 ? ' day old' : ' days old');
    const fav = st.favKnown ? Sim.FOODS[st.fav].name : '???';
    let grow = '';
    if (st.stage !== 'grown') {
      const sc = Sim.variantScores(st), mx = Math.max(...Object.values(sc), 1);
      const next = st.stage === 'hatchling' ? Sim.GROW_AT.juvenile : Sim.GROW_AT.grown;
      const left = Math.max(0, next - age);
      grow = '<p style="margin-top:12px"><b>Growing up</b> · ' + (st.stage === 'hatchling' ? 'juvenile' : 'grown') + ' in ' + (left < 1 ? 'under an hour' : Math.ceil(left) + ' h') + '</p>' +
        '<p style="font-size:14px;margin:0;opacity:.75">How you care for it shapes how it grows up:</p><div class="lean">' +
        [['sunny', 'Sunny', 'cuddles'], ['chonk', 'Chonky', 'treats'], ['splash', 'Splashy', 'games & swims'], ['mossy', 'Mossy', 'wild days']].map(v =>
          '<div><span>' + v[1] + '</span><i><b style="width:' + Math.round(sc[v[0]] / mx * 100) + '%"></b></i><small style="width:84px;opacity:.6">' + v[2] + '</small></div>').join('') + '</div>';
    } else grow = '<p style="text-align:center">A <b>' + Sim.VARIANTS[st.variant].name + ' Champ</b>: ' + Sim.VARIANTS[st.variant].blurb + '.</p>';
    const closet = '<p style="margin-top:12px"><b>Wardrobe</b> · ' + st.closet.length + ' of 11 · ' + (Sim.findReady(st, now()) ? 'a bottle is on the beach!' : 'next bottle tomorrow') + '</p><div class="closet">' +
      Sim.WEAR_ORDER.concat(Sim.STAR_WEARS).map(k => st.closet.indexOf(k) >= 0 ? '<button data-wear="' + k + '" class="' + (st.wear === k ? 'on' : '') + '" aria-label="' + Sim.WEARS[k].name + '"><canvas data-art="head" data-wear="' + k + '"></canvas></button>' : (Sim.WEARS[k].stars ? '<button class="lock star" disabled aria-label="Unlocks at ' + Sim.WEARS[k].stars + ' stars">⭐' + Sim.WEARS[k].stars + '</button>' : '<button class="lock" disabled aria-label="Not found yet">?</button>')).join('') + '</div>' +
      (st.closet.length ? '' : '<p class="sub" style="margin-top:6px">A bottle washes up on the beach once a day. Some have treasures to wear.</p>');
    showCard('<h2>' + esc(st.name) + '</h2><p class="sub">' + esc(stageLabel()) + '</p><canvas class="art" data-art="portrait"></canvas>' + closet +
      '<div class="stats"><div>Age<b>' + ageTxt + '</b></div><div>Favorite treat<b>' + fav + '</b></div>' +
      '<div>Fish Leap best<b>' + st.best.fish + '</b></div><div>Bubble Pop best<b>' + st.best.bubble + '</b></div><div>Splash Tag best<b>' + st.best.tag + '</b></div><div>Sightings<b>' + st.sightings + '</b></div><div>Lake Cup<b>' + Sim.LEAGUES[st.league].name.replace(' League', '') + '</b></div><div>Trophies<b>' + (st.trophies.length ? st.trophies.map(t => t.rank === 1 ? '🏆' : t.rank === 2 ? '🥈' : t.rank === 3 ? '🥉' : '🎗️').slice(-6).join('') : '—') + '</b></div></div>' + grow, null,
      { bind(root) {
        root.querySelectorAll('.closet [data-wear]').forEach(b => b.addEventListener('click', () => {
          const k = b.dataset.wear; wearIt(st.wear === k ? null : k);
          root.querySelectorAll('.closet [data-wear]').forEach(o => o.classList.toggle('on', o.dataset.wear === st.wear));
          drawMiniCanvases({ querySelectorAll: () => [root.querySelector('canvas.art')] });   // portrait shows the new look
        }));
      } });
  }
  function sightCard() {
    const items = st.log.slice(0, 40).map(e => '<li class="report"><span class="em">📸</span><span><q>' + esc(e.said) + '</q><small>#' + e.n + ' · ' + esc(e.who) + ' · ' + ago(e.t) + '</small></span></li>').join('');
    showCard('<h2>Sightings</h2><div class="bignum">' + st.sightings + '</div><p class="sub">tourist reports of ' + esc(st.name || 'your monster') + '</p>' +
      (items ? '<ul class="list">' + items + '</ul>' : '<p style="text-align:center">No sightings yet. A happy, well-fed, clean monster gets spotted by tourists, even while you’re away.</p>'));
  }
  function ago(t) {
    const m = Math.max(0, (now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return Math.round(m) + ' min ago';
    const h = m / 60; if (h < 24) return Math.round(h) + ' h ago';
    return Math.round(h / 24) + ' d ago';
  }
  function menuCard() {
    const s = st.settings;
    showCard('<h2>Menu</h2><div class="row" style="margin:10px 0"><button class="pill ' + (s.sfx ? 'on' : '') + '" id="mSfx">Sound: ' + (s.sfx ? 'on' : 'off') + '</button><button class="pill ' + (s.music ? 'on' : '') + '" id="mMus">Music: ' + (s.music ? 'on' : 'off') + '</button></div>' +
      '<p style="font-size:14.5px"><b>How it works.</b> Your monster’s needs drop slowly in real time, even when the game is closed. Feed it, play, give it a swim, put it to bed, and stroke it to pet it. It grows up over a few days, and how you care for it decides what it becomes. Happy monsters get spotted by tourists.</p>' +
      '<p style="font-size:14.5px">Nothing bad ever happens. If it feels forgotten, it swims across the lake and leaves a note.</p>' +
      '<div class="row" style="margin-top:12px"><button class="pill warn" id="mReset">Start over…</button></div>',
      [{ label: 'Close', cls: 'big alt' }],
      { bind(root) {
        root.querySelector('#mSfx').addEventListener('click', (e) => { s.sfx = !s.sfx; Snd.setSfx(s.sfx); e.target.textContent = 'Sound: ' + (s.sfx ? 'on' : 'off'); e.target.classList.toggle('on', s.sfx); save(); Snd.play('tap'); });
        root.querySelector('#mMus').addEventListener('click', (e) => { s.music = !s.music; Snd.setMusic(s.music); e.target.textContent = 'Music: ' + (s.music ? 'on' : 'off'); e.target.classList.toggle('on', s.music); save(); Snd.play('tap'); });
        root.querySelector('#mReset').addEventListener('click', () => { closeCard(); confirmReset(); });
      } });
  }
  function confirmReset() {
    const nm = st.stage === 'egg' ? 'the egg' : esc(st.name);
    showCard('<h2>Start over?</h2><p style="text-align:center">' + nm + ' will swim off to live happily in the lake, and you’ll find a new egg on the beach.</p><p class="sub">Sightings and best scores reset too.</p>',
      [{ label: 'Keep ' + (st.stage === 'egg' ? 'it' : nm), cls: 'big alt' }, { label: 'New egg', cls: 'pill warn', fn: () => { const s = st.settings; st = Sim.newState(now()); st.settings = s; resetVisual(); save(); mode = 'egg'; showHUD(); ghost.show('egg'); toast('A new egg! Tap it to keep it warm.'); } }]);
  }
  function noteCard() {
    Snd.play('page');
    const favName = Sim.FOODS[st.fav].name.toLowerCase();
    showCard('<h2>A note on the sand</h2><div class="note">Dear friend,<br>I swam to the other side of the lake for a bit. I felt a little forgotten.<br>A <b>' + esc(favName) + '</b> would cheer me right up.<br>— ' + esc(st.name) + ' ♥</div>' +
      '<p class="sub" style="margin-top:14px">Tap <b>Coax</b> and toss a treat across the lake.</p>',
      [{ label: 'Coax ' + esc(st.name) + ' back', cls: 'big alt', fn: () => feedSheet() }]);
  }
  function awayCard(gap, ev, before) {
    const lines = [];
    const sights = ev.filter(e => e.type === 'sighting');
    const grows = ev.filter(e => e.type === 'grow');
    const sulk = ev.find(e => e.type === 'sulk');
    const season = ev.filter(e => e.type === 'season').pop();
    let slept = 0; ev.forEach(e => { if (e.type === 'wake') slept += e.slept; });
    if (st.asleep && st.sleepSince < now()) slept += now() - Math.max(st.sleepSince, now() - gap);
    if (season) lines.push([{ winter: '❄️', spring: '🌸', summer: '☀️', fall: '🍁' }[season.season], { winter: 'Winter came! Snow on the beach.', spring: 'Spring! The ice went out and the blossoms came back.', summer: 'Summer! Paddleboarders are out on the lake.', fall: 'Fall! The leaves are turning.' }[season.season]]);
    grows.forEach(g => lines.push(['🌱', g.stage === 'juvenile' ? 'Grew into a juvenile!' : 'All grown up: a <b>' + Sim.VARIANTS[g.variant].name + ' Champ</b>!']));
    const ms = sights.length ? milestoneLine(sights[0].entry.n - 1, sights[sights.length - 1].entry.n) : null;
    if (ms) lines.push(['🏆', '<b>' + ms.n + ' sightings!</b> ' + ms.text]);
    if (sights.length) { const e = sights[sights.length - 1].entry; lines.push(['📸', 'Tourists reported <b>' + sights.length + '</b> sighting' + (sights.length > 1 ? 's' : '') + '! <q>' + esc(e.said) + '</q> <small style="opacity:.6">— ' + esc(e.who) + '</small>']); }
    if (st.asleep) lines.push(['😴', 'Curled up for a nap' + (slept > 20 * 60e3 ? ' (' + dur(slept) + ' so far)' : '') + '. Still snoozing.']);
    else if (slept > 20 * 60e3) lines.push(['😴', 'Napped for ' + dur(slept) + '.']);
    if (!st.sulk && st.goals && (st.goals.fresh || st.goals.day !== Sim.dayNum(now()))) { lines.push(['⭐', 'New daily goals are up. Tap ⭐ to see them.']); st.goals.fresh = false; }
    if (!sulk && !st.sulk && st.hints.find && Sim.findReady(st, now())) lines.push(['✨', 'A bottle washed up on the beach. Something’s inside!']);
    if (sulk) lines.push(['📝', 'Felt a little forgotten and swam to the other side of the lake. Left you a note.']);
    else if (st.sulk) lines.push(['📝', 'Still on the other side of the lake, hoping for a treat. The note is on the sand.']);
    else {
      const n = st.needs;
      if (n.hunger < 30) lines.push(['🐟', n.hunger < 15 ? 'Really hungry! Feed me?' : 'Getting peckish.']);
      if (n.clean < 35) lines.push(['🫧', 'Rolled in some mud. Could use a swim.']);
      if (n.energy < 25 && !st.asleep) lines.push(['🥱', 'A bit sleepy.']);
      if (n.happy < 35) lines.push(['💙', 'Missed you!']);
      if (lines.length === 0) lines.push(['🌊', 'Splashed around in the shallows and waited for you.']);
    }
    const html = '<h2>While you were away</h2><p class="sub">' + dur(gap) + '</p><canvas class="art" data-art="away"></canvas><ul class="list">' + lines.map(l => '<li><span class="em">' + l[0] + '</span><span>' + l[1] + '</span></li>').join('') + '</ul>';
    showCard(html, [{ label: sulk || st.sulk ? 'Read the note' : 'Hi, ' + esc(st.name) + '!', cls: 'big alt', fn: () => { if (st.sulk) noteCard(); else { act('hop'); Snd.voice('hi'); } } }]);
    const gv = grows.find(g => g.stage === 'grown');
    if (gv) grownCard(gv.variant);
  }
  function grownCard(v) {
    showCard('<h2>All grown up!</h2><canvas class="art" data-art="portrait"></canvas><p style="text-align:center">' + esc(st.name) + ' became a <b>' + Sim.VARIANTS[v].name + ' Champ</b>, ' + Sim.VARIANTS[v].blurb + '.</p>', [{ label: 'So proud', cls: 'big alt' }]);
  }
  function dur(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
    const d = Math.floor(h / 24), hh = h % 24;
    return d + (d === 1 ? ' day' : ' days') + (hh ? ' ' + hh + ' h' : '');
  }

  // sheets
  function feedSheet() {
    if (busy()) return;
    if (st.asleep) { toast('Shh… ' + esc(st.name) + ' is sleeping.'); return; }
    const kinds = ['perch', 'berries', 'cookie', 'creemee'];
    const tummy = now() < st.tummyUntil;
    const desc = { perch: 'Filling meal', berries: 'Healthy snack', cookie: 'Sweet treat', creemee: 'Super treat! Not too many.' };
    const html = '<div class="grid">' + kinds.map(k => {
      const off = !st.sulk && tummy && k !== 'perch';
      const fav = st.favKnown && st.fav === k ? '<span class="fav">♥ fav</span>' : '';
      return '<button class="opt' + (off ? ' off' : '') + '" data-food="' + k + '">' + fav + '<canvas data-art="' + k + '"></canvas><b>' + Sim.FOODS[k].name + '</b><small>' + desc[k] + '</small></button>';
    }).join('') + '</div>' + (st.sulk ? '<p class="sheetNote">Toss a treat across the lake. Which one would ' + esc(st.name) + ' swim back for?</p>' : tummy ? '<p class="sheetNote">Tummy ache: treats are off for a bit.</p>' : '');
    openSheet(st.sulk ? 'Coax ' + st.name + ' back' : 'Feed ' + st.name, html, (root) => {
      root.querySelectorAll('[data-food]').forEach(b => b.addEventListener('click', () => feedStart(b.dataset.food, b)));
    });
    Snd.play('ui');
  }
  function playSheet() {
    const why = Sim.canPlay(st);
    if (why) {
      Snd.play('nope'); act('refuse');
      toast({ away: 'Coax ' + esc(st.name) + ' back first.', asleep: 'Shh… sleeping.', tired: esc(st.name) + ' is too pooped to play. Nap time?', hungry: 'Too hungry to play. A snack first?' }[why]);
      return;
    }
    const html = '<div class="grid">' + ['fish', 'bubble', 'tag'].map(k => '<button class="opt wide" data-game="' + k + '"><canvas data-art="' + k + '"></canvas><span class="txt"><b>' + Games.INFO[k].title + '</b><small>' + Games.INFO[k].how + '</small></span><span class="best">best ' + st.best[k] + '</span></button>').join('') + '</div><p class="sheetNote">20 seconds each. Playing makes ' + esc(st.name) + ' happy (and a little tired).</p>';
    openSheet('Play in the lake', cupBannerHtml() + html, (root) => { root.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => startGame(b.dataset.game))); root.querySelector('#cupBtn').addEventListener('click', () => { closeSheet(); Snd.play('ui'); cupCard(); }); });
    Snd.play('ui');
  }

  // ------------------------------------------------------------------ actions wiring
  document.querySelectorAll('#actions button').forEach(b => {
    b.addEventListener('click', () => {
      if (mode !== 'home' || !st || pet.where === 'leaving' || pet.where === 'returning') return;
      Snd.unlock();
      const a = b.dataset.act;
      if (a === 'feed') feedSheet();
      else if (a === 'play') playSheet();
      else if (a === 'swim') {
        if (st.sulk) { toast('Coax ' + esc(st.name) + ' back first.'); return; }
        if (st.asleep) { toast('Shh… ' + esc(st.name) + ' is sleeping.'); return; }
        startBath();
      } else if (a === 'sleep') { if (st.sulk) { toast(esc(st.name) + ' is across the lake.'); return; } doSleep(); }
    });
  });
  $('bathDone').addEventListener('click', () => {
    Snd.play('ui');
    if (bath.phase === 'scrub') { const left = pet.spots.filter(s => s.a > 0.06).length; if (left === 0) { bath.phase = 'rinse'; bath.t = 0; } else { bath.phase = 'out'; bath.t = 0; const done = Math.max(0, (bath.n || 0) - left); st.needs.clean = Math.min(100, st.needs.clean + (100 - st.needs.clean) * done / Math.max(1, bath.n || 1)); save(); refreshHUD(true); showGains(bath.before); } }
    else if (bath.phase === 'in') { endBath(); }
  });
  $('nameChip').addEventListener('click', () => { Snd.play('ui'); profileCard(); });
  $('sightChip').addEventListener('click', () => { Snd.play('ui'); sightCard(); });
  $('goalChip').addEventListener('click', () => { Snd.play('ui'); goalsCard(); });
  $('menuBtn').addEventListener('click', () => { Snd.play('ui'); menuCard(); });
  $('mgQuit').addEventListener('click', () => { Snd.play('ui'); if (game && !gameEnded) { game.over = true; gameEnded = true; showCard('<h2>Leave the game?</h2><p style="text-align:center">No happy bonus if you stop early.</p>', [{ label: 'Keep playing', cls: 'big alt', fn: () => { game.over = false; gameEnded = false; gameEnd = 0; } }, { label: 'Leave', cls: 'pill', fn: () => closeGame() }]); } });

  $('startBtn').addEventListener('click', () => {
    Snd.unlock(); Snd.play('ui');
    if (!st) { st = Sim.newState(now()); save(); }
    Snd.setSfx(st.settings.sfx); Snd.setMusic(st.settings.music);
    if (st.stage === 'egg') { mode = 'egg'; showHUD(); if (!st.hints.egg) { ghost.show('egg'); toast('You found an egg on the beach! Tap it to keep it warm.', 3600); } }
    else { mode = 'home'; showHUD(); catchUp(true); if (!st.name) namePicker(); else if (!st.hints.feed || !st.hints.pet || !st.hints.play) hintNext(); }
  });

  // ------------------------------------------------------------------ time catch-up + live events
  function catchUp(fromTitle) {
    if (!st || st.stage === 'egg') { if (st) Sim.advance(st, now(), false); return; }
    const before = JSON.parse(JSON.stringify(st.needs));
    const gap = now() - st.lastTick;
    const ev = Sim.advance(st, now(), false);
    save();
    syncWhere(false);
    if (gap > 10 * 60e3 && (mode === 'home' || mode === 'bath' || mode === 'game')) awayCard(gap, ev, before);
    { const ce = Sim.cupToday(st, now()).ended; if (ce) { save(); if (ce.played) cupQ.push(ce); } }
    if (cupQ.length && (mode === 'home')) cupResultCard(cupQ.shift());   // queued right behind the away card
    else handleLive(ev.filter(e => e.type !== 'sighting' || ev.length < 4));
    refreshHUD(true);
  }
  function handleLive(ev) {
    for (const e of ev) {
      if (e.type === 'sighting') { if (mode === 'home') spawnTourist(e.entry); else { $('sightN').textContent = st.sightings; } }
      else if (e.type === 'sleep') { if (mode === 'home') { act('yawn'); Snd.play('yawn'); toast(esc(st.name) + ' got sleepy and curled up for a nap.'); } }
      else if (e.type === 'wake') { if (mode === 'home') { act('wake'); toast(esc(st.name) + ' woke up refreshed!'); } }
      else if (e.type === 'grow') {
        const prev = e.stage === 'juvenile' ? { stage: 'hatchling', variant: null } : { stage: 'juvenile', variant: null };
        pet.hold = prev; act('grow'); Snd.play('grow');
        if (e.stage === 'grown') setTimeout(() => grownCard(e.variant), 2600);
        else setTimeout(() => toast(esc(st.name) + ' grew into a juvenile!', 3000), 1400);
      }
      else if (e.type === 'season') toast({ winter: 'Snow on the beach! Winter is here.', spring: 'Spring! The ice is out.', summer: 'Summer! Paddleboarders on the lake.', fall: 'Fall colors on the lake!' }[e.season], 3200);
      else if (e.type === 'sulk') { /* syncWhere starts the swim-away */ }
    }
    if (ev.length) { refreshHUD(true); save(); }
  }

  // ------------------------------------------------------------------ input
  const ptr = { x: -999, y: -999, t: 0, recent(tn) { return tn - this.t < 2500; } };
  let touch = null;   // the one pointer interacting with the scene
  function inPet(x, y, pad) {
    const h = pet.hit; if (!h) return false;
    pad = pad || 0;
    if (Math.hypot(x - h.head.x, y - h.head.y) < h.head.r + pad) return 'head';
    const dx = (x - h.body.x) / (h.body.rx + pad), dy = (y - h.body.y) / (h.body.ry + pad);
    if (dx * dx + dy * dy < 1) return 'body';
    // neck: between body and head
    const nx = lerp(h.body.x, h.head.x, 0.5), ny = lerp(h.body.y, h.head.y, 0.5);
    if (Math.hypot(x - nx, y - ny) < h.head.r * 0.8 + pad) return 'body';
    return false;
  }
  function local(e) { return { x: e.clientX, y: e.clientY }; }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Snd.unlock();
    const p = local(e);
    ptr.x = p.x; ptr.y = p.y; ptr.t = now();
    if (mode === 'game' && game) { game.down(p.x, p.y, e.pointerId); return; }
    if (touch) return;   // second finger ignored for petting
    touch = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: 0, part: null };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (mode === 'egg') { const r = eggRect(); if (Math.abs(p.x - r.x) < r.w * 1.5 && p.y > r.y - r.h * 1.4 && p.y < r.y + 30) warmTap(p.x, p.y); else fx.ring(p.x, p.y, 6); return; }
    if (mode === 'bath') { touch.part = 'scrub'; scrubAt(p.x, p.y, 10); return; }
    if (mode !== 'home') return;
    if (find && find.state !== 'open' && find.t > 0.5 && pet.where === 'home' && !st.asleep && !inPet(p.x, p.y, 0) && Math.hypot(p.x - find.x, p.y - (find.y - findSize() * 0.15)) < findSize() * 0.8 + 18) { openFind(); touch = null; return; }
    if (pet.where === 'away') {
      const nx = L.petX, ny = L.petY;
      if (Math.abs(p.x - nx) < 70 && p.y > ny - 110 && p.y < ny + 30) { noteCard(); touch = null; }
      return;
    }
    if (pet.where === 'ice') { toast(esc(st.name) + ' is napping under the ice. Zzz.'); fx.ring(p.x, p.y, 8); return; }
    if (pet.where !== 'home') return;
    touch.part = inPet(p.x, p.y, 10);
    if (!touch.part) {
      // tapping the beach or the lake
      if (p.y < L.shore) { fx.ring(p.x, p.y, 8); Snd.play('splash', 0.15); } else fx.burst(p.x, p.y, '#e9d3a0', 4);
      pet.look = { x: p.x, y: p.y, until: pet.P.t + 1.5 };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = local(e);
    ptr.x = p.x; ptr.y = p.y; ptr.t = now();
    if (mode === 'game' && game) { game.move(p.x, p.y, e.pointerId); return; }
    if (!touch || touch.id !== e.pointerId) return;
    const d = Math.hypot(p.x - touch.x, p.y - touch.y);
    touch.moved += d;
    const px = touch.x, py = touch.y;
    touch.x = p.x; touch.y = p.y;
    if (mode === 'egg') { const r = eggRect(); if (Math.abs(p.x - r.x) < r.w * 1.3 && p.y > r.y - r.h * 1.3 && p.y < r.y + 20) { Sim.warmEgg(st, d * 0.06, d * 0.004); egg.wobV += (p.x - px) * 0.004; if (Math.random() < 0.2) fx.sparkles(p.x, p.y, 1, 8); } return; }
    if (mode === 'bath') { scrubAt(p.x, p.y, d); return; }
    if (mode !== 'home' || pet.where !== 'home' || !touch.part) return;
    if (touch.moved > 12) {
      if (!pet.petting) pet.petting = { active: true, level: 0, dist: 0, heartD: 0, x: p.x, time: 0, bank: 0, before: needSnap() };
      const pg = pet.petting; pg.x = p.x;
      const over = inPet(p.x, p.y, 30);
      if (over) {
        pg.dist += d; pg.heartD += d; pg.level = Math.min(1, pg.level + d / 300);
        if (pg.heartD > 70) { pg.heartD = 0; fx.hearts(p.x, p.y - 10, 1); }
        petBank.use(d);
        if (!st.hints.pet && pg.dist + (now() - petAcc.t < 3000 ? petAcc.dist : 0) > 160) { st.hints.pet = 1; ghost.hide(); save(); setTimeout(hintNext, 1500); }
      }
    }
  });
  function endTouch(e, cancel) {
    if (mode === 'game' && game) { game.up(e.pointerId); }
    if (!touch || touch.id !== e.pointerId) return;
    const tp = touch; touch = null;
    if (pet.petting) { finishPetting(); return; }
    if (cancel || mode !== 'home' || pet.where !== 'home') return;
    const quick = performance.now() - tp.t0 < 450 && tp.moved < 14;
    if (quick && tp.part && !busy()) {
      if (st.asleep) { act('look'); fx.zzz(pet.hit.head.x + 20, pet.hit.head.y - 20, 18); toast('Shh… ' + esc(st.name) + ' is fast asleep.', 1600); return; }
      if (tp.part === 'head') { act('boop'); Snd.voice('squee'); fx.hearts(tp.x, tp.y - 10, 1); fx.buzz(10); }
      else { act('giggle'); Snd.play('giggle'); Snd.voice('bwip'); fx.buzz(10); }
      petBank.use(25);
    }
  }
  cv.addEventListener('pointerup', (e) => endTouch(e, false));
  cv.addEventListener('pointercancel', (e) => endTouch(e, true));
  cv.addEventListener('lostpointercapture', (e) => { if (touch && touch.id === e.pointerId) endTouch(e, true); });
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now(); } }, { passive: true });
  document.addEventListener('touchstart', () => {}, { passive: true });   // lets iOS show :active press states
  ['pointerdown', 'pointerup', 'click', 'touchend'].forEach(t => window.addEventListener(t, () => Snd.unlock(), { capture: true, passive: true }));   // iOS audio unlock
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // petting happiness bank: up to ~15 happy per minute so stroking stays meaningful but not exploitable
  const petBank = {
    v: 6, lastCare: -1e12,
    tick(dt) { this.v = Math.min(15, this.v + dt * 0.25); },
    use(dist) { if (!st || st.stage === 'egg') return; const amt = Math.min(this.v, dist * 0.02); if (amt > 0) { this.v -= amt; Sim.pet(st, amt); } },
  };
  const petAcc = { dist: 0, t: 0 };
  function finishPetting() {
    const pg = pet.petting; pet.petting = null; Snd.purrOff();
    if (!pg || !st) return;
    // short natural strokes add up if they come within ~3 s of each other
    petAcc.dist = (now() - petAcc.t < 3000 ? petAcc.dist : 0) + pg.dist; petAcc.t = now();
    if (petAcc.dist > 160) {
      petAcc.dist = 0;
      if (!st.hints.pet) { st.hints.pet = 1; ghost.hide(); setTimeout(hintNext, 1500); }
      if (now() - petBank.lastCare > 90e3 && st.stage !== 'grown') { st.care.pet++; petBank.lastCare = now(); }
      goalEv({ type: 'pet' });
      refreshHUD(true); if (!showGains(pg.before)) bumpNeed('happy'); save();
    } else if (!st.hints.pet && !petAcc.told && pg.dist > 20) { petAcc.told = true; toast('Keep stroking! ' + esc(st.name) + ' loves it.', 2200); }
  }

  // keyboard (desktop)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!$('sheet').classList.contains('hidden')) closeSheet(); else if (cardOpen && st && (st.name || st.stage === 'egg')) closeCard(); return; }
    if (!$('title').classList.contains('hidden')) { if (k === 'enter' || k === ' ') $('startBtn').click(); return; }
    if (cardOpen && (k === 'enter' || k === ' ')) { const b = $('cardBtns').querySelector('.big:not([disabled])') || $('cardBtns').querySelector('button'); downOk.card = true; tapGuard = 0; if (b) b.click(); e.preventDefault(); return; }
    if (k === 'm') { st.settings.sfx = !st.settings.sfx; Snd.setSfx(st.settings.sfx); toast('Sound ' + (st.settings.sfx ? 'on' : 'off'), 1200); save(); return; }
    if (mode === 'home' && !cardOpen) {
      const map = { f: 'feed', p: 'play', s: 'swim', z: 'sleep' };
      if (map[k]) document.querySelector('#actions [data-act=' + map[k] + ']').click();
    }
  });

  // ------------------------------------------------------------------ save
  function save() { if (st) Sim.save(st); }

  function resetVisual() {
    pet.where = 'home'; pet.move = null; pet.act = null; pet.hold = null; pet.water = 0; pet.scaleMul = 1; pet.x = L.petX; pet.y = L.petY; pet.dim = 0;
    egg.taps = 0; hatchT = 0; tourists.length = 0; flying = null; eating = null; dropped = null; pet.P = Art.pose(); find = null; findWait = 4; pendingFind = null; goalQ.length = 0; cupQ.length = 0;
  }

  // ------------------------------------------------------------------ loop
  let last = 0, liveAcc = 0;
  function update(dt) {
    if (fx.pause > 0) { fx.pause -= dt; fx.update(dt * 0.1); return; }
    ghost.update(dt);
    petBank.tick(dt);
    if (st && mode !== 'title') {
      if (st.stage === 'egg') { if (mode === 'egg') Sim.advance(st, now(), true); }
      else {
        liveAcc += dt;
        if (liveAcc > 0.5) {
          liveAcc = 0;
          const gap = now() - st.lastTick;
          if (gap > 90e3) catchUp(); else handleLive(Sim.advance(st, now(), true));
        }
      }
    }
    if (mode === 'egg' || mode === 'hatching') updateEgg(dt);
    if (mode === 'hatching') updateHatch(dt);
    if (mode === 'home') { syncWhere(true); if (pet.move) updateMove(dt); }
    if (st && st.stage !== 'egg') { updateFind(dt); updateGoals(); updateCup(dt); }
    if (mode === 'bath') updateBath(dt);
    if (mode === 'game') updateGame(dt);
    if (mode !== 'game') updatePet(dt);
    updateFlying(dt); updateTourists(dt);
    if (dropped) { dropped.t += dt; dropped.vy += 900 * dt; dropped.x += dropped.vx * dt; dropped.y += dropped.vy * dt; if (dropped.t > 1) dropped = null; }
    // lights out
    const wantDim = st && st.asleep && mode === 'home' && !st.sulk ? 1 : 0;
    pet.dim = ease(pet.dim, wantDim, 2.2, dt);
    pet.flash = Math.max(0, pet.flash - dt * 2.5);
    Snd.setNight(pet.dim > 0.5 || Art.nightness(hourNow()) > 0.6);
    // purr
    if (pet.petting && pet.petting.active && st && st.settings.sfx) { pet.petting.level = Math.max(0, pet.petting.level - dt * 0.35); Snd.purrOn(st.asleep ? pet.petting.level * 0.4 : pet.petting.level); }
    fx.update(dt);
    if (st && mode !== 'title' && mode !== 'game') refreshHUD(false);
    if (st) saveT += dt; if (saveT > 10) { saveT = 0; save(); }
  }
  let saveT = 0;

  function env() {
    const t = now();
    return { season: Sim.seasonOf(t), hour: hourNow(), t: pet.P.t, ice: Sim.isDeepWinter(t), dim: pet.dim };
  }
  function draw() {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fx.shakeA > 0) c.translate(rand(-1, 1) * fx.shakeA, rand(-1, 1) * fx.shakeA);
    const E = env();
    if (mode === 'game') {
      Art.drawScene(c, W, H, GL, Object.assign(E, { ice: false, lake: true }));
      if (game) game.draw(c);
      Art.drawLakeFront(c, W, H, E.t);
      if (game && game.fever > 0) {   // gold glow around the edges while Fever is on
        const a = Math.min(1, game.fever) * (0.55 + 0.25 * Math.sin(E.t * 10));
        const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, 'rgba(255,210,63,0)'); vg.addColorStop(1, 'rgba(255,190,40,' + (0.65 * a) + ')');
        c.fillStyle = vg; c.fillRect(0, 0, W, H);
      }
      fx.draw(c);
      return;
    }
    if (E.ice && st && (pet.where === 'ice' || pet.where === 'toIce' || pet.where === 'fromIce')) E.hole = iceHole();
    Art.drawScene(c, W, H, L, E);
    Art.drawNightOverlay(c, W, H, L, pet.dim, E.t, E.hour);
    drawTourists(c);
    drawFind(c, E.t);
    // egg / note / pet
    if (mode === 'title') { /* clean backdrop behind the logo */ }
    else if (!st || st.stage === 'egg' || mode === 'hatching') {
      if (mode !== 'hatching' || hatchT < 1.25) {
        const r = eggRect(), prog = st ? st.egg.prog / Sim.HATCH_NEED : 0;
        Art.drawEgg(c, r.x, r.y, r.s, { wobble: egg.wob, sq: egg.sq, crack: clamp((prog - 0.35) / 0.6, 0, 1), glow: st ? st.egg.warm / 100 : 0, peek: clamp((prog - 0.75) / 0.15, 0, 1), look: egg.look });
      }
      if (mode === 'hatching' && hatchT >= 1.25) drawPetMain(c);
    } else if (pet.where === 'away') {
      noteDrop = Math.min(1, noteDrop + 0.03);
      const s = 54 * Math.max(0.6, pet.s / 120);
      c.save(); c.translate(L.petX - s * 0.3, L.petY); c.scale(1, smooth(noteDrop)); Art.drawNote(c, 0, 0, s, E.t); c.restore();
      if (Math.sin(E.t * 3) > 0.6) Art.sparkle(c, L.petX + s * 0.5, L.petY - s * 1.1, 6, '#fff6b0', 0.8);
    } else if (pet.where === 'ice') {
      const h = iceHole();
      // sleepy head peeking up through the ice
      const P2 = Object.assign({}, pet.P, { curl: 0, droop: 0.35, lean: 0, eyeStyle: 'closed', mouth: (E.t % 6) < 3 ? 'smile' : 'o', shadow: 0, sq: Math.sin(E.t * 1.2) * 0.03, head: null });
      const g = Art.geom(P2.stage, P2.variant), s2 = pet.s * 0.62, k2 = s2 * g.size;
      const wlU = g.ry * 2 + g.neck * 0.7 + 0.05, gy = h.y + wlU * k2 + Math.sin(E.t * 1.2) * 2;
      c.save(); c.beginPath(); c.ellipse(h.x, h.y - k2 * 2, 46, k2 * 2, 0, 0, TAU); c.rect(0, 0, W, h.y - 2); c.clip();
      c.beginPath(); c.rect(0, 0, W, h.y); c.clip();
      Art.drawPet(c, h.x, gy, s2, P2);
      c.restore();
      if (Math.random() < 0.05) fx.add({ kind: 'suds', x: h.x + rand(-20, 20), y: h.y, vy: -30, r: rand(3, 6), life: 0.8 });
      pet.zT -= 1 / 60; if (pet.zT <= 0) { fx.zzz(h.x + 10, h.y - 14, 18); pet.zT = 1.4; }
    } else drawPetMain(c);
    // flies when dirty
    if (st && st.stage !== 'egg' && st.needs.clean < 25 && pet.where === 'home' && pet.hit && mode === 'home') {
      for (const f of pet.flies) {
        f.a += f.sp / 60;
        const fxp = pet.hit.body.x + Math.cos(f.a) * pet.hit.body.rx * 1.3 * f.r, fyp = pet.hit.body.y - pet.hit.body.ry * 0.8 + Math.sin(f.a * 1.7 + f.ph) * pet.hit.body.ry * 0.9;
        Art.drawFly(c, fxp, fyp, E.t);
      }
      if (Math.random() < 0.004) Snd.play('flyBuzz');
    }
    if (pet.dim > 0.02) { c.fillStyle = 'rgba(12,18,52,' + (0.18 * pet.dim) + ')'; c.fillRect(0, 0, W, H); }
    // food
    if (flying) { c.save(); c.translate(flying.x, flying.y); c.rotate(flying.rot); Art.drawFood(c, flying.kind, 0, 0, flying.size, 0); c.restore(); }
    if (eating && pet.hit) Art.drawFood(c, eating.kind, pet.hit.mouth.x, pet.hit.mouth.y + pet.s * 0.12, pet.s * 0.3 * (1 - eating.bite * 0.5), eating.bite);
    if (dropped) { c.save(); c.globalAlpha = 1 - dropped.t; Art.drawFood(c, dropped.kind, dropped.x, dropped.y, pet.s * 0.35, 0); c.restore(); }
    fx.draw(c);
    if (pet.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (pet.flash * 0.7) + ')'; c.fillRect(0, 0, W, H); }
  }
  function drawPetMain(c) {
    const s = pet.s * pet.scaleMul;
    pet.P.alpha = 1;
    if (pet.water > 0.01) pet.hit = drawPetWater(c, pet.x, pet.y, pet.P, pet.water, s, mode === 'bath' || pet.where === 'fromIce' || pet.where === 'toIce');
    else pet.hit = Art.drawPet(c, pet.x, pet.y, s, pet.P);
  }

  function frame(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    if (!paused && !manual) update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  let manual = false;

  // ------------------------------------------------------------------ lifecycle
  function onHide() { save(); Snd.purrOff(); Snd.suspend(); if (!noPause) paused = true; if (touch) { touch = null; finishPetting(); } }
  function onShow() { paused = false; last = 0; Snd.resume(); if (st && mode !== 'title') catchUp(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); else onShow(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('blur', () => { if (!noPause) save(); });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => layout(false), 120); });
  window.addEventListener('orientationchange', () => { clearTimeout(rt); rt = setTimeout(() => layout(true), 300); });

  // title setup
  function titleInit() {
    if (st && st.sulk && st.stage !== 'egg') { pet.where = 'away'; noteDrop = 1; }
    if (st && st.stage !== 'egg') { $('startLbl').textContent = 'Visit ' + (st.name || 'your monster'); $('titleSub').textContent = st.sulk ? 'Somebody left a note on the beach…' : 'Your lake monster is waiting on the beach.'; }
    else if (st) { $('startLbl').textContent = 'Back to the egg'; }
    // logo pet
    const lc = $('logoPet'), d = Math.min(2, window.devicePixelRatio || 1);
    lc.width = 240 * d; lc.height = 200 * d; lc.__dpr = d;
    const lx = lc.getContext('2d');
    const lp = Object.assign(Art.pose(), { stage: 'juvenile', eyeStyle: 'normal', mouth: 'grin', blush: 0.7 });
    (function anim(ts) {
      if ($('title').classList.contains('hidden')) return;
      lx.setTransform(d, 0, 0, d, 0, 0); lx.clearRect(0, 0, 240, 200);
      lp.t = ts / 1000; lp.tailWag = lp.t * 4; lp.flip = lp.t * 2; lp.sq = Math.sin(lp.t * 2.2) * 0.03; lp.tilt = Math.sin(lp.t * 0.9) * 0.12; lp.px = Math.sin(lp.t * 0.7) * 0.6;
      lp.eyeStyle = (lp.t % 4) > 3.85 ? 'happy' : 'normal';
      Art.drawPet(lx, 120, 196, 92, lp);
      requestAnimationFrame(anim);
    })(0);
  }

  // ------------------------------------------------------------------ boot
  Art.loadAssets();
  layout(true);
  if (st) { Snd.setSfx(st.settings.sfx); Snd.setMusic(st.settings.music); }
  titleInit();
  requestAnimationFrame(frame);

  // ------------------------------------------------------------------ test hooks
  window.__T = {
    get noPause() { return noPause; }, set noPause(v) { noPause = !!v; },
    start() { $('startBtn').click(); return mode; },
    state() { return { mode, where: pet.where, act: pet.act && pet.act.name, st: st && JSON.parse(JSON.stringify(st)), mood: st && Sim.mood(st, now()), cardOpen, sheetOpen: !$('sheet').classList.contains('hidden'), game: game && { name: gameName, score: game.score, time: game.time, combo: game.combo, over: game.over }, tOff, W, H, L: Object.assign({}, L), hit: pet.hit, find: find && { x: find.x, y: find.y, state: find.state } }; },
    step(ms) { manual = true; const n = Math.max(1, Math.round(ms / 16.67)); for (let i = 0; i < n; i++) update(1 / 60); draw(); return this.state(); },
    resume() { manual = false; },
    /** Fast-forward the wall clock by h hours (as if the game had been closed), then run the normal return path. */
    ff(h) { tOff += h * 3600e3; catchUp(); return this.state(); },
    /** Fast-forward while "open" (live events, no away card): simulates in 5-minute chunks. */
    ffLive(h) { const end = now() + h * 3600e3; while (now() < end) { tOff += 5 * 60e3; handleLive(Sim.advance(st, now(), true)); } return this.state(); },
    hatch() { if (st && st.stage === 'egg') { st.egg.prog = Sim.HATCH_NEED; } return mode; },
    setNeeds(o) { Object.assign(st.needs, o); refreshHUD(true); save(); return st.needs; },
    set(o) { Object.assign(st, o); refreshHUD(true); save(); return true; },
    season(s) { Sim.setSeasonOverride(s); return s; },
    hour(h) { hourOverride = h; return h; },
    feed(k) { feedStart(k, null); },
    play(name) { startGame(name); return mode; },
    game() { return game; },
    endGame() { if (game) { game.time = 0; game.over = true; } },
    sleep() { doSleep(); return st.asleep; },
    swim() { startBath(); return mode; },
    tap(x, y) { const o = { clientX: x, clientY: y, pointerId: 99, preventDefault() {} }; cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 99, bubbles: true })); cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 99, bubbles: true })); return o; },
    stroke(x0, y0, x1, y1, n) { n = n || 12; cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x0, clientY: y0, pointerId: 98, bubbles: true })); for (let i = 1; i <= n; i++) { cv.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + (x1 - x0) * i / n, clientY: y0 + (y1 - y0) * i / n, pointerId: 98, bubbles: true })); update(1 / 60); } cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x1, clientY: y1, pointerId: 98, bubbles: true })); return st.needs.happy; },
    closeCards() { cardQ.length = 0; closeCard(); closeSheet(); },
    reset() { st = null; Sim.wipe(); location.reload(); },
    act(n) { act(n); },
    /** Wash today's bottle up right now (skips the wait). */
    find() { findWait = 0; return Sim.findReady(st, now()); },
    wear(k) { if (k && st.closet.indexOf(k) < 0) st.closet.push(k); wearIt(k); return st.wear; },
    sim: Sim,
  };
})();
