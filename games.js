/* Pet Champ - three ~20 second mini-games played in the lake.
   Each game: { name, update(dt), draw(c), down(x,y,id), move(x,y,id), up(id), score, combo, time, over } */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const LEN = 20;

  // medal thresholds [bronze, silver, gold] (tuned from bot runs: a flawless bot ~155 / ~140 / ~90; human-ish bots ~16-73 / 105-143 / 27-32)
  const MEDALS = { fish: [20, 50, 90], bubble: [50, 110, 180], tag: [30, 60, 95] };
  const INFO = {
    fish:   { title: 'Fish Leap',  how: 'Tap the leaping perch. Skip the old boots!', icon: 'perch' },
    bubble: { title: 'Bubble Pop', how: 'Swipe through bubbles to pop chains. Not the grumpy urchin!', icon: 'bubble' },
    tag:    { title: 'Splash Tag', how: 'Tag your pal when it pops up. Leave the ducks alone!', icon: 'tag' },
  };

  /** Base for every game. api = { W, H, fx, snd, art, petS, pose (P), stage, variant } */
  function base(api, name) {
    return {
      name, api, score: 0, combo: 0, bestCombo: 0, time: LEN, t: 0, over: false, intro: 1.1, stun: 0, fever: 0, fevers: 0,
      L: { horizon: api.H * 0.2, shore: api.H * 1.2 },
      popup(x, y, text, col, size) { api.fx.text(x, y, text, col || '#fff', size || 26); },
      mul() { return this.fever > 0 ? 2 : 1; },
      /** Fever: a long streak earns 5 s of double points. */
      feverOn() {
        if (this.fever > 0 || this.over) return;
        this.fever = 5; this.fevers++;
        api.fx.text(api.W / 2, api.H * 0.34, 'FEVER ×2!', '#ffd23f', 46); api.fx.shake(5); api.fx.hitPause(0.08); api.fx.buzz(40);
        api.snd.play('best'); api.snd.voice('yay');
      },
    };
  }
  function tickBase(g, dt) {
    g.t += dt;
    if (g.intro > 0) { g.intro -= dt; return false; }
    g.time -= dt;
    if (g.stun > 0) g.stun -= dt;
    if (g.fever > 0) g.fever = Math.max(0, g.fever - dt);
    if (g.time <= 0) { g.time = 0; g.over = true; }
    return true;
  }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // ================================================================ FISH LEAP
  function fishLeap(api) {
    const g = base(api, 'fish');
    const W = api.W, H = api.H;
    const pet = { x: W / 2, y: H * 0.94, P: api.pose, lunge: null, chew: 0, spit: 0 };
    const k = api.petS * api.art.geom(api.stage, api.variant).size;
    const rest = () => ({ x: -0.15, y: -(api.art.geom(api.stage, api.variant).ry * 2 + api.art.geom(api.stage, api.variant).neck + 0.25) });
    pet.P.head = rest();
    const fish = []; g.fish = fish;
    let spawnT = 0.3, goldT = rand(4, 7), bootT = rand(3, 5);
    const surf = H * 0.86;
    function spawn(kind) {
      const x0 = rand(W * 0.08, W * 0.92);
      const apex = rand(H * 0.22, H * 0.5);
      const grav = H * (kind === 'gold' ? 2.1 : 1.6);
      const vy = -Math.sqrt(2 * grav * (surf - apex));
      const flight = 2 * -vy / grav;
      const x1 = clamp(x0 + rand(-W * 0.35, W * 0.35), W * 0.05, W * 0.95);
      fish.push({ kind, x: x0, y: surf, vx: (x1 - x0) / flight, vy, grav, size: kind === 'gold' ? 62 : kind === 'boot' ? 58 : 66, caught: false, dead: false, t: 0 });
      api.fx.splash(x0, surf, 0.6);
    }
    g.update = function (dt) {
      const P = pet.P; P.t += dt; P.tailWag += dt * 4; P.flip += dt * 3;
      const live = tickBase(g, dt);
      if (live) {
        const prog = 1 - g.time / LEN;
        spawnT -= dt;
        if (spawnT <= 0) { spawn('perch'); if (prog > 0.45 && Math.random() < 0.35) spawn('perch'); spawnT = rand(0.62, 0.85) - prog * 0.25; }
        goldT -= dt; if (goldT <= 0) { spawn('gold'); goldT = rand(4.5, 7); }
        bootT -= dt; if (bootT <= 0) { spawn('boot'); bootT = rand(2.6, 4.2) - prog; }
      }
      for (const f of fish) {
        f.t += dt;
        if (f.caught) continue;
        f.vy += f.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.vy > 0 && f.y >= surf) {
          f.dead = true; api.fx.splash(f.x, surf, 0.7);
          // a fish slipping back is fine: only a mis-tap or a boot breaks the combo
        }
      }
      for (let i = fish.length - 1; i >= 0; i--) if (fish[i].dead) fish.splice(i, 1);
      // lunge animation: the neck stretches to the fish
      const R = rest();
      if (pet.lunge) {
        const L = pet.lunge; L.t += dt;
        const target = { x: (L.tx - pet.x) / k, y: (L.ty - pet.y) / k };
        if (L.t < 0.11) { const u = L.t / 0.11; P.head = { x: R.x + (target.x - R.x) * u * u * (3 - 2 * u), y: R.y + (target.y - R.y) * u * u * (3 - 2 * u) }; P.mouthOpen = 1; }
        else if (!L.hit) { L.hit = true; resolve(L); }
        if (L.t >= 0.11) {
          const u = clamp((L.t - 0.11) / 0.28, 0, 1), e = 1 - Math.pow(1 - u, 3);
          P.head = { x: target.x + (R.x - target.x) * e, y: target.y + (R.y - target.y) * e };
          if (L.fish) { L.fish.x = pet.x + P.head.x * k; L.fish.y = pet.y + P.head.y * k + 10; }
          if (u >= 1) { if (L.fish) L.fish.dead = true; pet.lunge = null; }
        }
      } else {
        P.head = { x: ease(P.head.x, R.x + Math.sin(g.t * 1.3) * 0.05, 8, dt), y: ease(P.head.y, R.y + Math.sin(g.t * 2) * 0.03, 8, dt) };
      }
      pet.chew = Math.max(0, pet.chew - dt); pet.spit = Math.max(0, pet.spit - dt);
      P.mouth = pet.spit > 0 ? 'wavy' : pet.chew > 0 ? 'open' : (pet.lunge ? 'open' : 'smile');
      P.mouthOpen = pet.lunge && !pet.lunge.hit ? 1 : pet.chew > 0 ? Math.abs(Math.sin(pet.chew * 22)) * 0.6 : 0;
      P.eyeStyle = pet.spit > 0 ? 'squint' : pet.chew > 0 ? 'happy' : 'normal';
      P.brow = 'none';
      // look at the nearest live fish
      let near = null, nd = 1e9;
      for (const f of fish) { if (f.caught) continue; const d = Math.hypot(f.x - pet.x, f.y - pet.y); if (d < nd) { nd = d; near = f; } }
      const hx = pet.x + P.head.x * k, hy = pet.y + P.head.y * k;
      P.px = ease(P.px, near ? clamp((near.x - hx) / (W * 0.3), -1, 1) : 0, 10, dt);
      P.py = ease(P.py, near ? clamp((near.y - hy) / (H * 0.3), -1, 1) : 0, 10, dt);
      P.sq = Math.sin(g.t * 2.4) * 0.015;
    };
    function resolve(L) {
      // find the fish under the target point (generous radius)
      let best = null, bd = 1e9;
      for (const f of fish) {
        if (f.caught) continue;
        const d = Math.hypot(f.x - L.tx, f.y - L.ty);
        if (d < f.size * 0.55 + 42 && d < bd) { bd = d; best = f; }
      }
      if (!best) { api.snd.play('chomp'); if (g.combo > 1) g.popup(L.tx, L.ty - 20, 'missed', '#cfe8ff', 18); g.combo = 0; return; }
      best.caught = true; L.fish = best;
      if (best.kind === 'boot') {
        g.combo = 0; pet.spit = 0.7; g.stun = 0.35;
        api.snd.play('bonk'); api.fx.shake(5); api.fx.buzz(30);
        g.popup(best.x, best.y - 30, 'Bleh!', '#ffd0b0', 26);
        return;
      }
      g.combo++; g.bestCombo = Math.max(g.bestCombo, g.combo);
      if (g.combo % 10 === 0) g.feverOn();
      const mult = (1 + Math.min(3, Math.floor(g.combo / 4))) * g.mul();
      const pts = (best.kind === 'gold' ? 5 : 1) * mult;
      g.score += pts; pet.chew = 0.5;
      api.snd.play(best.kind === 'gold' ? 'gold' : 'catchFish', g.combo); api.fx.buzz(12); if (best.kind === 'gold') api.snd.voice('yay');
      api.fx.burst(best.x, best.y, best.kind === 'gold' ? '#ffd23f' : '#bfe7ff', 12);
      g.popup(best.x, best.y - 34, '+' + pts + (mult > 1 ? '  x' + mult : ''), best.kind === 'gold' ? '#ffe066' : '#fff', best.kind === 'gold' ? 32 : 26);
      if (best.kind === 'gold') api.fx.hitPause(0.06);
    }
    g.down = function (x, y) {
      if (g.over || g.intro > 0 || g.stun > 0) return;
      if (pet.lunge && !pet.lunge.hit) return;
      // snap the lunge to the nearest fish so near-misses still feel right
      let tx = x, ty = y, bd = 1e9;
      for (const f of fish) { if (f.caught) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < f.size * 0.55 + 42 && d < bd) { bd = d; tx = f.x; ty = f.y; } }
      pet.lunge = { tx, ty, t: 0, hit: false, fish: null };
    };
    g.move = function () {}; g.up = function () {};
    g.draw = function (c) {
      for (const f of fish) {
        const ang = f.caught ? 0.4 : Math.atan2(f.vy, Math.abs(f.vx) + 60) * 0.75;
        c.save(); if (f.vx < 0 && !f.caught) { c.translate(f.x, f.y); c.scale(-1, 1); c.translate(-f.x, -f.y); }
        api.art.drawFish(c, f.x, f.y, f.size, ang, f.kind, f.t);
        c.restore();
      }
      api.drawPetWater(c, pet.x, pet.y, pet.P, 0.62);
    };
    return g;
  }

  // ================================================================ BUBBLE POP
  function bubblePop(api) {
    const g = base(api, 'bubble');
    const W = api.W, H = api.H;
    const pet = { x: W / 2, y: H * 0.98, P: api.pose };
    const geo = api.art.geom(api.stage, api.variant);
    const k = api.petS * geo.size;
    pet.P.head = null;
    const bubbles = []; g.bubbles = bubbles;
    let spawnT = 0, chain = 0, stroke = null;
    function mouthPos() { return { x: pet.x + (-0.1) * k, y: pet.y - (geo.ry * 2 + geo.neck + geo.headR * 0.1) * k }; }
    function spawn() {
      const prog = 1 - g.time / LEN;
      const r = rand(25, 40);
      const roll = Math.random();
      const kind = roll < 0.07 ? 'rainbow' : roll < 0.07 + 0.05 + prog * 0.06 ? 'urchin' : 'plain';
      let x, y, vx;
      if (kind !== 'urchin' && Math.random() < 0.55) { const m = mouthPos(); x = m.x + rand(-10, 10); y = m.y - geo.headR * k * 1.6 - r; vx = rand(-W * 0.45, W * 0.45); }
      else { x = rand(W * 0.06, W * 0.94); y = H + 40; vx = rand(-20, 20); }
      bubbles.push({ x, y, vx, vy: -rand(70, 120) * (1 + prog * 0.6), r: kind === 'urchin' ? 30 : r, kind, ph: rand(0, TAU), t: 0, dead: false });
      pet.blow = 0.25;
    }
    function pop(b, viaRainbow) {
      if (b.dead) return;
      b.dead = true;
      if (b.kind === 'urchin') {
        g.stun = 0.6; chain = 0; g.combo = 0; stroke = null; g.hot = 0;
        api.snd.play('bonk'); api.fx.shake(6); api.fx.buzz(40);
        g.popup(b.x, b.y - 58, 'Ouch!', '#e6b8ff', 30); api.fx.burst(b.x, b.y, '#b77ad8', 10);
        pet.ouch = 0.7;
        return;
      }
      chain++; g.combo = chain; g.bestCombo = Math.max(g.bestCombo, chain);
      g.hot = (g.hot || 0) + 1; if (g.hot % 20 === 0) g.feverOn();
      const pts = (1 + Math.floor((chain - 1) / 3)) * g.mul();
      g.score += pts;
      api.snd.play('bubble', chain); api.fx.buzz(8);
      api.fx.ring(b.x, b.y, b.r);
      g.popup(b.x, b.y - 10, '+' + pts, chain >= 4 ? '#ffe066' : '#fff', 18 + Math.min(16, chain * 1.5));
      if (b.kind === 'rainbow' && !viaRainbow) {
        api.snd.play('sparkle'); api.fx.burst(b.x, b.y, '#ffffff', 18); api.fx.hitPause(0.05);
        for (const o of bubbles) if (!o.dead && o.kind !== 'urchin' && Math.hypot(o.x - b.x, o.y - b.y) < 150) pop(o, true);
      }
    }
    function hitAt(x, y) {
      if (g.stun > 0 || g.over || g.intro > 0) return;
      for (const b of bubbles) if (!b.dead && Math.hypot(b.x - x, b.y - y) < b.r + 14) pop(b);
    }
    function hitSeg(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 10));
      for (let i = 1; i <= n; i++) hitAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n);
    }
    g.update = function (dt) {
      const P = pet.P; P.t += dt; P.tailWag += dt * 3; P.flip += dt * 2;
      const live = tickBase(g, dt);
      if (live) {
        const prog = 1 - g.time / LEN;
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); if (Math.random() < 0.3 + prog * 0.3) spawn(); spawnT = rand(0.26, 0.4) - prog * 0.1; }
      }
      for (const b of bubbles) {
        b.t += dt; b.vx *= Math.pow(0.25, dt); b.x += (b.vx + Math.sin(b.t * 2.4 + b.ph) * 26) * dt; b.y += b.vy * dt;
        if (b.y < -b.r * 2) b.dead = true;
      }
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].dead) bubbles.splice(i, 1);
      pet.blow = Math.max(0, (pet.blow || 0) - dt); pet.ouch = Math.max(0, (pet.ouch || 0) - dt);
      P.mouth = pet.ouch > 0 ? 'wavy' : pet.blow > 0 ? 'o' : chain >= 3 ? 'grin' : 'smile';
      P.eyeStyle = pet.ouch > 0 ? 'squint' : chain >= 5 ? 'happy' : 'normal';
      P.sq = Math.sin(g.t * 2) * 0.02 + (pet.blow > 0 ? -0.03 : 0);
      P.blush = Math.min(1, chain / 6);
      let near = bubbles.find(b => !b.dead);
      P.px = ease(P.px, near ? clamp((near.x - pet.x) / (W * 0.4), -1, 1) : 0, 6, dt);
      P.py = ease(P.py, -0.8, 6, dt);
    };
    g.down = function (x, y, id) { if (stroke && stroke.id !== id) { hitAt(x, y); return; } stroke = { id, x, y }; chain = 0; hitAt(x, y); };   // a second finger just pops, it doesn't reset the chain
    g.move = function (x, y, id) { if (!stroke || stroke.id !== id) return; hitSeg(stroke.x, stroke.y, x, y); if (stroke) { stroke.x = x; stroke.y = y; } };
    g.up = function (id) { if (stroke && stroke.id === id) { stroke = null; if (chain >= 5) g.popup(W / 2, H * 0.3, 'Chain x' + chain + '!', '#ffe066', 34); chain = 0; g.combo = 0; } };
    g.draw = function (c) {
      api.drawPetWater(c, pet.x, pet.y, pet.P, 0.55);
      for (const b of bubbles) api.art.drawBubble(c, b.x, b.y, b.r, b.kind, b.t);
    };
    return g;
  }

  // ================================================================ SPLASH TAG
  function splashTag(api) {
    const g = base(api, 'tag');
    const W = api.W, H = api.H;
    const geo = api.art.geom(api.stage, api.variant);
    const ps = api.petS * 0.85;
    const k = ps * geo.size;
    const spots = []; g.spots = spots; g.k = k;
    const cols = 3, rows = 2;
    const top = H * 0.44, bot = H * 0.8;
    for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
      spots.push({ x: W * (0.2 + cI * 0.3) + (r ? W * 0.0 : 0), y: top + r * (bot - top), who: null, t: 0, up: 0, dur: 0, tele: 0, P: null, tagged: false, mad: 0 });
    }
    let nextT = 0.4;
    function faces(P) {
      const f = [['happy', 'grin'], ['normal', 'open'], ['normal', 'o'], ['happy', 'purr'], ['normal', 'grin']][Math.floor(Math.random() * 5)];
      P.eyeStyle = f[0]; P.mouth = f[1]; P.mouthOpen = f[1] === 'open' ? 0.6 : 0; P.tilt = rand(-0.25, 0.25); P.px = rand(-1, 1); P.py = rand(-0.6, 0.6);
    }
    function launch() {
      const prog = 1 - g.time / LEN;
      const free = spots.filter(s => !s.who);
      if (!free.length) return;
      const n = prog > 0.5 && Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < n && free.length; i++) {
        const s = free.splice(Math.floor(Math.random() * free.length), 1)[0];
        const duck = Math.random() < (0.18 + prog * 0.14) && !(i === 0 && n === 1 && Math.random() < 0.3);
        s.who = duck ? 'duck' : 'pet'; s.tele = 0.38; s.up = 0; s.dur = 1.25 - prog * 0.6; s.t = 0; s.tagged = false; s.mad = 0;
        if (!duck) { s.P = Object.assign(api.art.pose(), { stage: api.stage, variant: api.variant, wear: api.wear }); faces(s.P); }
      }
    }
    g.update = function (dt) {
      const live = tickBase(g, dt);
      if (live) { nextT -= dt; if (nextT <= 0) { launch(); const prog = 1 - g.time / LEN; nextT = rand(0.75, 1.05) - prog * 0.35; } }
      for (const s of spots) {
        if (!s.who) continue;
        s.t += dt;
        if (s.P) { s.P.t += dt; s.P.tailWag += dt * 4; }
        if (s.tele > 0) { s.tele -= dt; if (s.tele <= 0) { s.up = 0.001; if (s.who === 'pet') api.snd.play('splash', 0.35); } continue; }
        if (s.tagged) { s.up -= dt * 4; if (s.up <= 0) s.who = null; continue; }
        if (s.up > 0) {
          s.up += dt;
          if (s.up > s.dur) {
            if (s.who === 'pet' && !s.tagged) { if (g.combo > 1) g.popup(s.x, s.y - 50, 'too slow', '#cfe8ff', 18); g.combo = 0; }
            s.tagged = true; s.up = Math.min(s.up, 0.25);
          }
        }
        if (s.mad > 0) s.mad -= dt;
      }
    };
    function height(s) {   // 0..1 how far out of the water
      if (!s.who || s.tele > 0) return 0;
      if (s.tagged) return clamp(s.up / 0.25, 0, 1);
      return clamp(s.up / 0.12, 0, 1);
    }
    g.down = function (x, y) {
      if (g.over || g.intro > 0) return;
      let best = null, bd = 1e9;
      for (const s of spots) {
        if (!s.who || s.tagged || height(s) < 0.3) continue;
        const cy = s.y - (s.who === 'pet' ? k * 0.9 : 20);
        const d = Math.hypot(x - s.x, y - cy);
        if (d < (s.who === 'pet' ? k * 0.95 : 46) + 22 && d < bd) { bd = d; best = s; }
      }
      if (!best) { api.fx.splash(x, y, 0.3); return; }
      if (best.who === 'duck') {
        best.mad = 0.6; best.tagged = true; best.up = 0.25; g.combo = 0;
        api.snd.play('quack'); api.fx.buzz(30); api.fx.shake(4);
        g.popup(best.x, best.y - 60, 'QUACK!', '#ffd28a', 28);
        return;
      }
      best.tagged = true; best.up = 0.25;
      g.combo++; g.bestCombo = Math.max(g.bestCombo, g.combo);
      if (g.combo % 8 === 0) g.feverOn();
      const mult = (1 + Math.min(3, Math.floor(g.combo / 3))) * g.mul();
      g.score += mult;
      best.P.eyeStyle = 'happy'; best.P.mouth = 'grin';
      api.snd.play('tag', g.combo); api.snd.voice('squee'); api.fx.buzz(14);
      api.fx.splash(best.x, best.y, 1); api.fx.burst(best.x, best.y - k * 0.8, '#ffffff', 10);
      g.popup(best.x, best.y - k * 1.6, '+' + mult + (mult > 1 ? ' x' + mult : ''), mult > 1 ? '#ffe066' : '#fff', 26);
    };
    g.move = function () {}; g.up = function () {};
    g.draw = function (c) {
      for (const s of spots) {
        // ripple telegraph
        if (s.who && s.tele > 0) {
          const a = 1 - s.tele / 0.38;
          c.strokeStyle = 'rgba(255,255,255,' + (0.4 + a * 0.5) + ')'; c.lineWidth = 3;
          for (let i = 0; i < 2; i++) { c.beginPath(); c.ellipse(s.x, s.y, 14 + a * 30 + i * 12, (14 + a * 30 + i * 12) * 0.35, 0, 0, TAU); c.stroke(); }
        }
        api.art.drawLilyPad(c, s.x + 46, s.y + 10, 30, (spots.indexOf(s) % 2) === 0, g.t);
        const h = height(s);
        if (h > 0) {
          if (s.who === 'pet') {
            const wl = s.y;
            const gy = wl + (1 - h) * k * 2.2 + k * 0.35;
            api.drawPetWater(c, s.x, gy, s.P, (gy - wl) / k, ps);
          } else {
            c.save(); c.beginPath(); c.rect(0, 0, W, s.y + 4); c.clip();
            api.art.drawDuck(c, s.x, s.y + (1 - h) * 40 - 6, 46, g.t, s.mad > 0);
            c.restore();
            c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(s.x, s.y + 2, 28, 8, 0, 0, TAU); c.stroke();
          }
        }
      }
    };
    return g;
  }

  const MAKERS = { fish: fishLeap, bubble: bubblePop, tag: splashTag };
  root.Games = { INFO, LEN, MEDALS, medal(name, score) { const m = MEDALS[name]; return score >= m[2] ? 3 : score >= m[1] ? 2 : score >= m[0] ? 1 : 0; }, start(name, api) { return MAKERS[name](api); } };
})(window);
