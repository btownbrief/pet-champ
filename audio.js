/* Pet Champ - WebAudio synth sounds and a soft music-box loop. No audio files. */
(function (root) {
  'use strict';
  let ctx = null, master = null, sfx = null, mus = null, noiseBuf = null;
  const S = { sfx: true, music: true, started: false, night: false };
  let musTimer = null, nextT = 0, step = 0;
  let purr = null;

  function init() {
    if (ctx) return;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = S.sfx ? 1 : 0; sfx.connect(master);
    mus = ctx.createGain(); mus.gain.value = S.music ? 0.32 : 0; mus.connect(master);
    // "lake reverb": one shared convolver send with a synthetic 2 s tail, so every sound sits in the same airy space
    try {
      const len = (ctx.sampleRate * 2.2) | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1); }
      const verb = ctx.createConvolver(); verb.buffer = ir;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      verb.connect(lp); lp.connect(wet); wet.connect(master);
      const sSend = ctx.createGain(); sSend.gain.value = 0.16; sfx.connect(sSend); sSend.connect(verb);
      const mSend = ctx.createGain(); mSend.gain.value = 0.3; mus.connect(mSend); mSend.connect(verb);
    } catch (e) {}
    const len = ctx.sampleRate | 0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function unlock() {
    init(); if (!ctx) return;
    if (ctx.state !== 'running' && ctx.resume) ctx.resume();
    if (!S.started) { S.started = true; if (S.music) startMusic(); }
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && S.started && ctx.state !== 'running') ctx.resume(); }

  function tone(f, dur, type, vol, o) {
    if (!ctx || !S.sfx) return;
    o = o || {};
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.glide || dur));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + (o.atk || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || sfx);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(dur, f, q, vol, o) {
    if (!ctx || !S.sfx) return;
    o = o || {};
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(f, t0);
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    fl.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + (o.atk || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(sfx);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  const semi = (n) => Math.pow(2, n / 12);

  const SFX = {
    tap() { tone(660, 0.07, 'triangle', 0.12); },
    ui() { tone(520, 0.06, 'triangle', 0.1); tone(780, 0.08, 'triangle', 0.08, { delay: 0.04 }); },
    nope() { tone(300, 0.12, 'triangle', 0.14, { to: 220 }); tone(240, 0.16, 'triangle', 0.12, { delay: 0.1, to: 180 }); },
    eggTap(n) { noise(0.05, 1800, 3, 0.18); tone(392 * semi((n || 0) % 8), 0.25, 'sine', 0.12, { delay: 0.02 }); },
    crack() { noise(0.09, 2600, 2, 0.35); noise(0.06, 1400, 2, 0.25, { delay: 0.06 }); },
    hatch() { noise(0.25, 2000, 1, 0.3); [0, 4, 7, 12, 16].forEach((n, i) => tone(523 * semi(n), 0.4, 'triangle', 0.14, { delay: 0.12 + i * 0.08 })); },
    chomp() { noise(0.06, 900, 2, 0.32); tone(180, 0.06, 'square', 0.05); },
    gulp() { tone(260, 0.18, 'sine', 0.22, { to: 110 }); },
    yum() { tone(523, 0.12, 'sine', 0.14, { to: 659 }); tone(784, 0.18, 'sine', 0.12, { delay: 0.1, to: 880 }); },
    giggle() { [0, 3, 1, 5].forEach((n, i) => tone(760 * semi(n), 0.07, 'sine', 0.13, { delay: i * 0.065, to: 900 * semi(n) })); },
    boing() { tone(220, 0.25, 'sine', 0.22, { to: 520, glide: 0.12 }); },
    happy() { [0, 4, 7, 12].forEach((n, i) => tone(587 * semi(n), 0.2, 'triangle', 0.12, { delay: i * 0.07 })); },
    sad() { tone(440, 0.3, 'sine', 0.12, { to: 330, vib: 6 }); tone(330, 0.4, 'sine', 0.1, { delay: 0.25, to: 262, vib: 6 }); },
    yawn() { tone(420, 0.7, 'sine', 0.12, { to: 180, vib: 5, atk: 0.1 }); noise(0.6, 600, 1, 0.05, { atk: 0.2 }); },
    snore() { noise(0.9, 300, 2, 0.06, { atk: 0.4, to: 500 }); },
    splash(v) { noise(0.35, 1200, 0.7, 0.3 * (v || 1), { to: 400 }); noise(0.2, 3000, 1, 0.12 * (v || 1), { delay: 0.05 }); },
    scrub() { noise(0.08, 2400 + Math.random() * 800, 4, 0.06); },
    bubble(i) { tone(500 * semi(Math.min(i || 0, 18)), 0.09, 'sine', 0.2, { to: 1300 * semi(Math.min(i || 0, 18)), glide: 0.06 }); },
    catchFish(i) { noise(0.05, 900, 2, 0.25); tone(600 * semi(Math.min(i || 0, 15)), 0.14, 'triangle', 0.15, { delay: 0.03 }); },
    gold() { [0, 7, 12, 19].forEach((n, i) => tone(784 * semi(n), 0.2, 'triangle', 0.12, { delay: i * 0.05 })); },
    bonk() { tone(140, 0.18, 'square', 0.1, { to: 70 }); noise(0.1, 500, 1, 0.2); },
    quack() { tone(330, 0.16, 'sawtooth', 0.12, { to: 250 }); noise(0.12, 1300, 4, 0.1); },
    tag(i) { noise(0.15, 1600, 1, 0.22, { to: 600 }); tone(660 * semi(Math.min(i || 0, 14)), 0.12, 'triangle', 0.14, { delay: 0.04 }); },
    shutter() { noise(0.03, 4000, 1, 0.3); noise(0.04, 2500, 1, 0.22, { delay: 0.07 }); },
    grow() { [0, 4, 7, 11, 12, 16, 19, 24].forEach((n, i) => tone(523 * semi(n), 0.3, 'triangle', 0.11, { delay: i * 0.08 })); },
    away() { [7, 4, 0, -5].forEach((n, i) => tone(440 * semi(n), 0.35, 'sine', 0.1, { delay: i * 0.18, vib: 5 })); },
    back() { [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone(523 * semi(n), 0.22, 'triangle', 0.12, { delay: i * 0.09 })); },
    go() { tone(523, 0.12, 'triangle', 0.14); tone(784, 0.25, 'triangle', 0.14, { delay: 0.12 }); },
    tick() { tone(880, 0.05, 'square', 0.04); },
    end() { [12, 7, 4, 0].forEach((n, i) => tone(523 * semi(n), 0.25, 'triangle', 0.12, { delay: i * 0.09 })); },
    best() { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(523 * semi(n), 0.22, 'triangle', 0.12, { delay: i * 0.06 })); },
    flyBuzz() { tone(190, 0.4, 'sawtooth', 0.025, { vib: 30 }); },
    sparkle() { [0, 7, 12].forEach((n, i) => tone(1046 * semi(n), 0.15, 'sine', 0.07, { delay: i * 0.05 })); },
    page() { noise(0.12, 3000, 0.8, 0.12, { to: 1500 }); },
    pop() { tone(900, 0.07, 'sine', 0.2, { to: 300 }); noise(0.05, 2500, 2, 0.22); },
    clink() { tone(2093, 0.2, 'sine', 0.07); tone(2637, 0.25, 'sine', 0.05, { delay: 0.06 }); },
    count(i) { tone(660 * semi(Math.min(i || 0, 20)), 0.04, 'triangle', 0.05); },
    medal(n) { ([[0, 7], [0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 12, 16, 19]][n || 0]).forEach((m, i) => tone(659 * semi(m), 0.3, 'triangle', 0.12, { delay: i * 0.08 })); },
    tada() { tone(784, 0.1, 'triangle', 0.12); tone(1046, 0.32, 'triangle', 0.12, { delay: 0.1 }); },
  };

  /** Continuous purr while petting. Call purrOn(level 0..1) each frame, purrOff() to stop. */
  function purrOn(level) {
    if (!ctx || !S.sfx) return;
    if (!purr) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 24;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
      const bias = ctx.createConstantSource ? ctx.createConstantSource() : null;
      const out = ctx.createGain(); out.gain.value = 0.0001;
      const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52;
      const humG = ctx.createGain(); humG.gain.value = 0.35;
      src.connect(lp); lp.connect(am); hum.connect(humG); humG.connect(am);
      lfo.connect(lfoG); lfoG.connect(am.gain);
      if (bias) { bias.offset.value = 0.55; bias.connect(am.gain); bias.start(); }
      am.connect(out); out.connect(sfx);
      src.start(); lfo.start(); hum.start();
      purr = { src, lfo, hum, out, bias };
    }
    const v = 0.05 + 0.4 * Math.max(0, Math.min(1, level));
    purr.out.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
  }
  function purrOff() {
    if (!purr || !ctx) return;
    const p = purr; purr = null;
    p.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    setTimeout(() => { try { p.src.stop(); p.lfo.stop(); p.hum.stop(); if (p.bias) p.bias.stop(); } catch (e) {} }, 700);
  }

  // ---- music: two original songs (a lakeside music-box tune at home, a bouncy one for mini-games), softer and slower at night
  // chords: [root semitone from C, minor?]
  const C_ = [0, 0], Am = [9, 1], F_ = [5, 0], G_ = [7, 0], Dm = [2, 1], Em = [4, 1];
  const _ = null;
  const SONGS = {
    home: { bpm: 92, chords: [C_, Am, F_, G_, C_, Am, Dm, G_, F_, G_, Em, Am, F_, G_, C_, C_],
      mel: [7, _, 4, _, 0, 2, 4, _,   9, _, 7, 4, _, 0, 4, _,   5, _, 9, _, 12, _, 9, 7,   7, _, _, 2, 5, 4, 2, _,
            4, 7, 12, _, 11, _, 7, _,  9, _, 12, _, 16, _, 14, 12, 14, _, 12, 9, 5, _, 9, _,  7, _, 11, _, 14, _, _, _,
            12, _, 9, _, 5, _, 9, 12,  14, _, 11, _, 7, _, 11, 14, 16, _, 12, _, 11, _, 7, _,  9, 11, 12, _, 16, _, 12, _,
            17, _, 16, _, 12, _, 9, _, 11, _, 14, _, 19, _, 17, 14, 16, _, 12, _, 7, _, 4, _,   0, _, _, _, _, _, _, _] },
    game: { bpm: 134, chords: [C_, F_, G_, C_, Am, F_, G_, G_, F_, G_, Em, Am, F_, G_, C_, G_],   // 16 bars ≈ 29 s: never repeats inside a 20 s round
      mel: [0, 4, 7, 12, 7, 4, 7, _,   5, 9, 12, 9, 5, _, 9, _,   7, 11, 14, 11, 7, _, 2, _,   12, _, 7, _, 4, _, 0, _,
            9, 12, 16, 12, 9, _, 12, _, 5, 9, 12, 17, 16, _, 12, _, 14, _, 11, _, 7, _, 11, 14,  19, _, 17, _, 14, _, 11, _,
            17, _, 16, _, 12, _, 9, _,  14, _, 11, 14, 19, _, _, _,  16, _, 12, _, 11, _, 7, _,   9, 12, 16, 12, 9, _, _, _,
            5, 9, 12, 17, 16, _, 12, _, 14, _, 17, _, 19, _, 23, _, 24, _, 19, _, 16, _, 12, _,  11, _, 14, _, 7, _, _, _] },
  };
  let song = 'home', bar = 0;
  function startMusic() {
    if (!ctx || musTimer) return;
    nextT = ctx.currentTime + 0.2; step = 0;
    musTimer = setInterval(sched, 100);
  }
  function stopMusic() { if (musTimer) { clearInterval(musTimer); musTimer = null; } if (ctx) ambience(false); }
  function setSong(name) { if (!SONGS[name] || name === song) return; song = name; step = 0; if (ctx) nextT = Math.max(nextT, ctx.currentTime + 0.05); }
  let waves = null, critterT = 0;
  function ambience(on) {
    if (on && !waves) {   // soft lapping waves: looped noise through a low-pass, swelling slowly
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 0.035;
      lfo.connect(lg); lg.connect(g.gain); src.connect(lp); lp.connect(g); g.connect(mus);
      src.start(); lfo.start(); waves = { src, lfo, g };
    } else if (!on && waves) { const w = waves; waves = null; w.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => { try { w.src.stop(); w.lfo.stop(); } catch (e) {} }, 1500); }
  }
  function critter(t0, night) {
    if (night) {   // a far-off loon: a slow rising wail with a wobble
      [[0, 620, 940, 1.1], [1.25, 760, 700, 0.9]].forEach(p => { const o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(p[1], t0 + p[0]); o.frequency.exponentialRampToValueAtTime(p[2], t0 + p[0] + p[3] * 0.7);
        v.frequency.value = 6; vg.gain.value = 9; v.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t0 + p[0]); g.gain.exponentialRampToValueAtTime(0.035, t0 + p[0] + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + p[0] + p[3]);
        o.connect(g); g.connect(mus); o.start(t0 + p[0]); v.start(t0 + p[0]); o.stop(t0 + p[0] + p[3] + 0.1); v.stop(t0 + p[0] + p[3] + 0.1); });
    } else {   // a little songbird: three quick chirps
      for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), f = 2600 + Math.random() * 900, d = t0 + i * 0.13;
        o.type = 'sine'; o.frequency.setValueAtTime(f, d); o.frequency.exponentialRampToValueAtTime(f * 1.35, d + 0.07);
        g.gain.setValueAtTime(0.0001, d); g.gain.exponentialRampToValueAtTime(0.018, d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, d + 0.09);
        o.connect(g); g.connect(mus); o.start(d); o.stop(d + 0.12); }
    }
  }
  function sched() {
    if (!ctx || ctx.state !== 'running') return;
    const SG = SONGS[song], night = S.night && song === 'home';
    ambience(song === 'home');
    if (song === 'home' && ctx.currentTime > critterT) { if (critterT) critter(ctx.currentTime + 0.1, S.night); critterT = ctx.currentTime + (S.night ? 35 : 18) + Math.random() * 25; }
    const stepDur = 60 / SG.bpm / 2 * (night ? 1.35 : 1);
    while (nextT < ctx.currentTime + 0.35) {
      const nBars = SG.chords.length, b = Math.floor(step / 8) % nBars, inBar = step % 8;
      const ch = SG.chords[b], root = ch[0], third = ch[1] ? 3 : 4;
      const m = SG.mel[step % SG.mel.length];
      if (song === 'home') {
        if (inBar === 0) pad([root, root + third, root + 7], nextT, stepDur * 8, night ? 0.018 : 0.024);
        if (m !== _) bell(523.25 * semi(m), nextT, night ? 0.05 : 0.075);
        if (inBar === 0 || inBar === 4) bass(65.4 * semi(root + (inBar === 4 ? 7 : 0)), nextT, night ? 0.09 : 0.12);
        if (!night && (inBar === 2 || inBar === 6)) shaker(nextT, 0.03);
        if (!night && inBar % 2 === 1 && Math.random() < 0.35) bell(523.25 * semi(root + [0, third, 7][Math.random() * 3 | 0] + 12), nextT, 0.022, 0.5);
      } else {
        if (m !== _) pluck(523.25 * semi(m), nextT, 0.06);
        if (inBar % 2 === 0) bass(65.4 * semi(root + (inBar % 4 === 2 ? 12 : 0)), nextT, 0.13, 0.22);
        if (inBar === 0 || inBar === 4) kick(nextT);
        if (inBar === 2 || inBar === 6) clap(nextT);
        shaker(nextT + stepDur * 0.5, 0.018);
        if (inBar === 0) pad([root, root + third, root + 7], nextT, stepDur * 8, 0.014);
      }
      nextT += stepDur; step++;
    }
  }
  function env(g, t0, peak, atk, dur) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + atk); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
  function bell(f, t0, vol, dur) {
    dur = dur || 0.9;
    [[1, 1], [2.76, 0.18], [5.4, 0.06]].forEach(p => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * p[0];
      env(g, t0, vol * p[1], 0.006, dur / p[0] * 1.3);
      o.connect(g); g.connect(mus); o.start(t0); o.stop(t0 + dur + 0.1);
    });
  }
  function pluck(f, t0, vol) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f * 1.003;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t0); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t0 + 0.2);
    env(g, t0, vol, 0.004, 0.28);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(mus);
    o.start(t0); o2.start(t0); o.stop(t0 + 0.35); o2.stop(t0 + 0.35);
  }
  function pad(notes, t0, dur, vol) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(mus);
    notes.forEach((n, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 261.63 * semi(n - (i === 0 ? 12 : 0)); o.detune.value = (i - 1) * 6;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.5, dur * 0.3));
      g.gain.setValueAtTime(vol, t0 + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.3);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(t0 + dur + 0.4);
    });
  }
  function bass(f, t0, vol, dur) {
    dur = dur || 0.5;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.3;
    env(g, t0, vol, 0.01, dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(mus); o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  }
  function nz(t0, f, q, vol, dur, type) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t0, vol, 0.003, dur);
    src.connect(fl); fl.connect(g); g.connect(mus); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }
  function shaker(t0, vol) { nz(t0, 7500, 1.2, vol, 0.05, 'highpass'); }
  function clap(t0) { [0, 0.012, 0.026].forEach(d => nz(t0 + d, 1500, 1.5, 0.05, 0.09)); }
  function kick(t0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(48, t0 + 0.12); env(g, t0, 0.16, 0.004, 0.18); o.connect(g); g.connect(mus); o.start(t0); o.stop(t0 + 0.2); }

  // ---- the monster's little voice (pitch drops as it grows)
  let voiceBase = 720;
  function setVoice(stage) { voiceBase = stage === 'grown' ? 430 : stage === 'juvenile' ? 560 : 720; }
  function chirp(f0, f1, dur, vol, delay, vib) {
    tone(f0, dur, 'triangle', vol, { to: f1, delay, vib: vib || 0, atk: 0.015 });
    tone(f0 * 2, dur * 0.8, 'sine', vol * 0.25, { to: f1 * 2, delay });
  }
  const VOICE = {
    squee() { const b = voiceBase; chirp(b * 1.1, b * 1.9, 0.16, 0.13, 0); chirp(b * 1.5, b * 2.1, 0.1, 0.08, 0.14); },
    bwip() { const b = voiceBase; chirp(b * 0.9, b * 1.4, 0.09, 0.12, 0); chirp(b * 1.2, b * 1.6, 0.08, 0.09, 0.1); },
    mew() { const b = voiceBase; chirp(b * 1.25, b * 0.85, 0.42, 0.09, 0, 7); },
    hmph() { const b = voiceBase; chirp(b * 0.75, b * 0.6, 0.12, 0.1, 0); chirp(b * 0.7, b * 0.55, 0.14, 0.08, 0.13); },
    mmm() { const b = voiceBase; chirp(b * 0.8, b * 0.95, 0.18, 0.07, 0, 9); chirp(b * 0.85, b * 1.05, 0.22, 0.07, 0.2, 9); },
    yay() { const b = voiceBase; [1, 1.26, 1.5, 2].forEach((m, i) => chirp(b * m, b * m * 1.12, 0.09, 0.1, i * 0.075)); },
    hi() { const b = voiceBase; chirp(b, b * 1.5, 0.12, 0.12, 0); chirp(b * 1.5, b * 1.1, 0.2, 0.1, 0.13, 6); },
  };

  function setSfx(on) { S.sfx = on; if (sfx) sfx.gain.value = on ? 1 : 0; if (!on) purrOff(); }
  function setMusic(on) { S.music = on; if (mus) mus.gain.value = on ? 0.32 : 0; if (on && S.started) startMusic(); if (!on) stopMusic(); }
  function setNight(on) { S.night = !!on; }

  root.Snd = Object.assign({ unlock, suspend, resume, setSfx, setMusic, setNight, setSong, setVoice, purrOn, purrOff, S }, { play(name, a) { try { SFX[name] && SFX[name](a); } catch (e) {} }, voice(name) { try { VOICE[name] && VOICE[name](); } catch (e) {} } });
})(window);
