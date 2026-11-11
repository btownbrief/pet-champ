/* Pet Champ - pure pet simulation. No DOM. All times are ms timestamps.
   Needs are 0..100 (hunger = how full it is). Decay is gentle and keeps running
   while the game is closed: advance() replays the gap in 5-minute steps. */
(function (root) {
  'use strict';
  const SAVE_VERSION = 1;
  const MIN = 60e3, HOUR = 3600e3;
  const GROW_AT = { juvenile: 24, grown: 72 };      // hours after hatching
  const HATCH_NEED = 13;                             // egg progress units (see eggTick): ~10 s of steady rubbing, ~15-20 s of casual tapping
  const SULK_AFTER = 18;                             // hours stuck at zero before it sulks off (skipping a whole day is forgiven)

  const FOODS = {
    perch:   { name: 'Perch',        hunger: 30, happy: 2,  kind: 'meal'  },
    berries: { name: 'Blueberries',  hunger: 12, happy: 7,  kind: 'treat' },
    cookie:  { name: 'Maple cookie', hunger: 8,  happy: 12, kind: 'treat' },
    creemee: { name: 'Creemee',      hunger: 10, happy: 20, kind: 'treat' },
  };
  const TREATS = ['berries', 'cookie', 'creemee'];
  const VARIANTS = {
    sunny:  { name: 'Sunny',  blurb: 'cuddled and well loved' },
    chonk:  { name: 'Chonky', blurb: 'spoiled with treats' },
    splash: { name: 'Splashy', blurb: 'always playing and swimming' },
    mossy:  { name: 'Mossy',  blurb: 'a little wild around the edges' },
  };

  let seasonOverride = null;   // tests / __T
  function seasonOf(t) {
    if (seasonOverride) return seasonOverride === 'deepwinter' ? 'winter' : seasonOverride;
    const m = new Date(t).getMonth();
    if (m === 11 || m <= 1) return 'winter';
    if (m <= 4) return 'spring';
    if (m <= 7) return 'summer';
    return 'fall';
  }
  function isDeepWinter(t) {
    if (seasonOverride) return seasonOverride === 'deepwinter';
    const m = new Date(t).getMonth();
    return m === 0 || m === 1;
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function newState(now) {
    return {
      v: SAVE_VERSION, created: now, lastTick: now,
      stage: 'egg', egg: { warm: 0, prog: 0 }, hatchedAt: 0,
      name: '', fav: pick(TREATS),
      needs: { hunger: 75, happy: 80, energy: 90, clean: 100 },
      asleep: false, sleepSince: 0,
      sulk: null, neglectH: 0,
      tummyUntil: 0, creemees: [],
      care: { meal: 0, treat: 0, play: 0, swim: 0, pet: 0, sulk: 0, dirtyH: 0 },
      variant: null,
      sightings: 0, log: [], sightAcc: 0.55,
      best: { fish: 0, bubble: 0, tag: 0 },
      lastSeason: seasonOf(now),
      settings: { sfx: true, music: true },
      hints: {},
      wear: null, closet: [], findDay: -1, streak: 0, streakDay: -1,
      goals: null, stars: 0, goalDays: 0,
      cup: null, league: 0, trophies: [],
    };
  }

  // ---- daily beach find + wardrobe -------------------------------------------
  const WEARS = {
    shades:  { name: 'Sunglasses',   line: 'a pair of tiny sunglasses' },
    beanie:  { name: 'Knit beanie',  line: 'a cozy knit beanie with a pom-pom' },
    flowers: { name: 'Flower crown', line: 'a little crown of wildflowers' },
    leaf:    { name: 'Maple leaf',   line: 'a perfect red maple leaf' },
    sailor:  { name: 'Sailor cap',   line: 'a tiny sailor cap' },
    party:   { name: 'Party hat',    line: 'a sparkly party hat' },
    bow:     { name: 'Big bow',      line: 'a big pink bow' },
    goggles: { name: 'Swim goggles', line: 'a pair of swim goggles' },
    crown:   { name: 'Golden crown', line: 'a tiny golden crown', stars: 6 },
    tophat:  { name: 'Top hat',      line: 'a very fancy top hat', stars: 15 },
    antlers: { name: 'Moose antlers', line: 'a headband with fuzzy moose antlers', stars: 25 },
  };
  const STAR_WEARS = ['crown', 'tophat', 'antlers'];

  // ---- Lake Cup: a weekly league. Your cup score = the sum of your best score in each mini-game this week.
  // Rival lake monsters post scores that climb through the week. Top 2 move up a league.
  const LEAGUES = [
    { name: 'Pond League', top: 260 }, { name: 'Bay League', top: 300 }, { name: 'Lake League', top: 400 }, { name: 'Legend League', top: 520 },
  ];
  const RIVALS = ['Bloop of Shelburne Bay', 'Marge from Malletts Bay', 'Sir Splashington', 'Kelpie Kate', 'Gus by the ferry dock', 'Puddles the Younger', 'Old Mossback', 'Little Ripple'];
  function weekNum(t) { return Math.floor((dayNum(t) + 3) / 7); }   // weeks start on Monday
  function cupToday(st, t) {
    const wk = weekNum(t), out = { ended: null };
    if (!st.cup || st.cup.week !== wk) {
      if (st.cup && st.cup.week < wk) out.ended = finishCup(st);
      const R = rngFor(wk * 31 + st.league), top = LEAGUES[st.league].top, used = [];
      const rivals = [];
      for (let i = 0; i < 5; i++) {
        let n; do { n = RIVALS[Math.floor(R() * RIVALS.length)]; } while (used.indexOf(n) >= 0); used.push(n);
        rivals.push({ name: n, final: Math.round(top * (1.05 - i * 0.16) * (0.9 + R() * 0.2) * Math.max(0.7, (7 - weekDay(t)) / 7)) });   // joining mid-week: rivals only had the days left too
      }
      st.cup = { week: wk, best: { fish: 0, bubble: 0, tag: 0 }, rivals, start: weekDay(t) };
    }
    return out;
  }
  function weekDay(t) { return ((dayNum(t) + 3) % 7 + 7) % 7; }   // 0 = Monday
  function cupStandings(st, t) {
    cupToday(st, t);
    const off = st.cup.start || 0, prog = Math.min(1, 0.3 + 0.7 * (weekDay(t) - off + 1) / (7 - off));   // rivals climb through the week and reach their final score on the last day
    const me = st.cup.best.fish + st.cup.best.bubble + st.cup.best.tag;
    const rows = st.cup.rivals.map(r => ({ name: r.name, score: Math.round(r.final * prog), me: false }));
    rows.push({ name: st.name || 'You', score: me, me: true });
    rows.sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
    return { rows, rank: rows.findIndex(r => r.me) + 1, me, league: LEAGUES[st.league].name, daysLeft: 6 - weekDay(t) };
  }
  function finishCup(st) {
    const me = st.cup.best.fish + st.cup.best.bubble + st.cup.best.tag;
    const rows = st.cup.rivals.map(r => r.final).concat([me]).sort((a, b) => b - a);
    const rank = rows.indexOf(me) + 1, from = st.league, played = me > 0;
    if (played) st.trophies.push({ week: st.cup.week, league: from, rank });
    let moved = 0;
    if (played && rank <= 2 && st.league < LEAGUES.length - 1) { st.league++; moved = 1; }
    else if (played && rank === 6 && st.league > 0) { st.league--; moved = -1; }
    return { rank, me, league: LEAGUES[from].name, moved, newLeague: LEAGUES[st.league].name, played };
  }
  /** After a mini-game: returns { improved, before, after } for this week's cup score. */
  function cupScore(st, game, score, t) {
    const ended = cupToday(st, t).ended;
    const b = st.cup.best, before = b.fish + b.bubble + b.tag;
    if (score > b[game]) b[game] = score;
    const after = b.fish + b.bubble + b.tag;
    return { improved: after > before, before, after, ended };
  }

  // ---- daily goals: three small goals a day, each worth a star (all three: +2 bonus). Stars unlock special wearables.
  const GAMES = ['fish', 'bubble', 'tag'];
  const COMBO = { fish: [8, 12, 18], bubble: [5, 7, 9], tag: [6, 9, 12] };
  function rngFor(n) { let x = (n * 2654435761) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
  function makeGoals(st, day) {
    const R = rngFor(day + 7), pk = (a) => a[Math.floor(R() * a.length)];
    if (st.goalDays === 0) return [{ k: 'meal' }, { k: 'pet' }, { k: 'play', n: 1 }];   // first day teaches the loop
    const lvl = st.stars < 6 ? 0 : st.stars < 15 ? 1 : 2;
    const care = pk(['meal', 'treat', 'pet', 'bath', 'nap']);
    const g1 = pk(GAMES), g2 = pk(GAMES.filter(g => g !== g1));
    const third = R() < 0.5 ? { k: 'combo', g: g2, v: COMBO[g2][lvl] } : R() < 0.5 ? { k: 'play', n: 2 } : { k: pk(['meal', 'treat', 'pet', 'bath'].filter(x => x !== care)) };
    return [{ k: care }, { k: 'medal', g: g1, v: lvl + 1 }, third];
  }
  function goalsToday(st, t) {
    const day = dayNum(t);
    if (!st.goals || st.goals.day !== day) {
      if (st.goals) st.goalDays++;
      st.goals = { day, perfect: false, fresh: !!st.goals, list: makeGoals(st, day).map(g => Object.assign({ n: 1, p: 0, done: false }, g)) };
    }
    return st.goals;
  }
  function goalMatch(g, ev) {
    if (g.k === 'meal') return ev.type === 'feed' && ev.kind === 'perch';
    if (g.k === 'treat') return ev.type === 'feed' && ev.kind !== 'perch';
    if (g.k === 'pet' || g.k === 'bath' || g.k === 'nap') return ev.type === g.k;
    if (g.k === 'play') return ev.type === 'game';
    if (g.k === 'medal') return ev.type === 'game' && ev.name === g.g && ev.tier >= g.v;
    if (g.k === 'combo') return ev.type === 'game' && ev.name === g.g && ev.combo >= g.v;
    return false;
  }
  /** Report a care/game event. Returns { done: [goals], perfect, stars, unlocked: [wear keys] }. */
  function goalEvent(st, ev, t) {
    const out = { done: [], perfect: false, stars: 0, unlocked: [] };
    if (st.stage === 'egg' || st.sulk) return out;
    const G = goalsToday(st, t);
    for (const g of G.list) if (!g.done && goalMatch(g, ev)) { g.p++; if (g.p >= g.n) { g.done = true; out.done.push(g); out.stars++; } }
    if (!G.perfect && G.list.every(g => g.done)) { G.perfect = true; out.perfect = true; out.stars += 2; }
    if (out.stars) {
      const before = st.stars; st.stars += out.stars;
      for (const k of STAR_WEARS) if (before < WEARS[k].stars && st.stars >= WEARS[k].stars && st.closet.indexOf(k) < 0) { st.closet.push(k); out.unlocked.push(k); }
    }
    return out;
  }
  const WEAR_ORDER = ['shades', 'beanie', 'flowers', 'leaf', 'sailor', 'party', 'bow', 'goggles'];
  const SEASON_WEAR = { summer: 'shades', winter: 'beanie', spring: 'flowers', fall: 'leaf' };
  /** Local calendar day number (days since epoch in local time). */
  function dayNum(t) { const d = new Date(t); return Math.floor((t - d.getTimezoneOffset() * MIN) / (24 * HOUR)); }
  function findReady(st, t) { return st.stage !== 'egg' && !st.sulk && st.findDay !== dayNum(t); }
  /** Open today's bottle. Returns { item | null (sea glass), streak, happy }. */
  function collectFind(st, t) {
    const day = dayNum(t);
    if (st.findDay === day) return null;
    st.findDay = day;
    st.streak = st.streakDay === day - 1 ? st.streak + 1 : 1;
    st.streakDay = day;
    const owned = st.closet;
    const seasonal = SEASON_WEAR[seasonOf(t)];
    let item = owned.indexOf(seasonal) < 0 ? seasonal : WEAR_ORDER.find(k => owned.indexOf(k) < 0) || null;
    let happy = 0;
    if (item) owned.push(item);
    else { const h0 = st.needs.happy; st.needs.happy = clamp(h0 + 12, 0, 100); happy = Math.round(st.needs.happy - h0); }
    return { item, streak: st.streak, happy };
  }
  function setWear(st, k) { st.wear = k && st.closet.indexOf(k) >= 0 ? k : null; return st.wear; }

  // ---- sightings -------------------------------------------------------
  const WHO = {
    any: ['a kayaker', 'a retired dentist', 'two kids on the ferry', 'a birdwatcher', 'a guy holding a creemee',
      'a very serious scientist', 'a cyclist on the bike path', 'a sailing class', 'somebody’s grandma',
      'a lost tourist looking for the ferry', 'a jogger', 'a wedding photographer', 'a dog, apparently',
      'a fisherman (again)', 'a bus full of leaf-peepers', 'the night-shift baker', 'a college a cappella group'],
    summer: ['a paddleboarder', 'a sunburned sailor', 'a kid with a pool noodle', 'a beach volleyball team'],
    winter: ['an ice fisherman', 'a snowshoer', 'a guy in shorts (in January)', 'a cross-country skier'],
    fall: ['a leaf-peeper from New Jersey', 'a cider-donut enthusiast'],
    spring: ['a mud-season hiker', 'a sugar-maker taking a break'],
  };
  const SAID = [
    'It winked at me.', 'Blurry photo, mostly thumb. Definitely a monster.', 'It was canoe-sized. Ish.',
    'It ate my sandwich and somehow said thank you.', 'Saw a head, then a hump, then my sunglasses fell in.',
    'It did a little dance?', 'Looked right into my soul. Kind soul.', '100% real. 60% sure.',
    'It smelled faintly of maple.', 'Burped. Then bowed.', 'It photobombed our engagement photos.',
    'It blew a bubble shaped like a heart.', 'My dog barked at it. It barked back, but nicer.',
    'The water went “bloop.” Then: monster.', 'It did the backstroke. Badly. Adorably.',
    'We waved. It waved. We’re friends now.', 'It looked like it wanted a snack. Relatable.',
    'Smaller than the legends. Cuter, too.', 'It sneezed and made a tiny rainbow.',
    'I came for the sunset and got a monster. Five stars.', 'It was wearing a lily pad like a hat.',
    'Swam by, did a double take at me. Rude, but fair.', 'It hummed. In tune!',
    'My camera died. My heart did not.', 'It splashed my mom. She laughed for an hour.',
    'Ripples, a flipper, and a very smug face.', 'Pretty sure it was posing.',
    'It followed our boat for a bit, then got distracted by a duck.',
    'It looked like a pickle with ambition.', 'Honestly? Better than the fireworks.',
  ];
  const SAID_SEASON = {
    summer: ['It stole a pool noodle and gave it back.', 'Raced a paddleboarder. Won.'],
    winter: ['It popped up through the ice like a periscope.', 'It was wearing snow like a little hat.'],
    fall: ['It had a red leaf stuck to its nose. Didn’t care.', 'It tried to catch falling leaves.'],
    spring: ['It sniffed a blossom and sneezed.', 'Splashed through the ice-out like it owned the place.'],
  };
  function makeReport(season) {
    const who = Math.random() < 0.3 && WHO[season] ? pick(WHO[season]) : pick(WHO.any);
    const said = Math.random() < 0.25 && SAID_SEASON[season] ? pick(SAID_SEASON[season]) : pick(SAID);
    return { who, said };
  }
  function addSighting(st, t) {
    st.sightings++;
    const r = makeReport(seasonOf(t));
    const e = { n: st.sightings, t, who: r.who, said: r.said };
    st.log.unshift(e);
    if (st.log.length > 80) st.log.length = 80;
    return e;
  }

  // ---- variant ---------------------------------------------------------
  function variantScores(st) {
    const c = st.care;
    return {
      sunny: 6 + c.pet * 0.7 + c.meal * 0.3,
      chonk: c.treat * 1.6 + c.meal * 0.4,
      splash: c.play * 2.2 + c.swim * 1.4,
      mossy: c.sulk * 4 + c.dirtyH * 0.6,
    };
  }
  function leaning(st) {
    const s = variantScores(st); let best = 'sunny';
    for (const k in s) if (s[k] > s[best]) best = k;
    return best;
  }

  // ---- time --------------------------------------------------------------
  /** Replay time from st.lastTick to t1. live=true while the player is watching. Returns events. */
  function advance(st, t1, live) {
    const ev = [];
    let t = st.lastTick || t1;
    if (t1 <= t) { st.lastTick = t1; return ev; }   // clock went backwards: just resync, nothing happens
    if (t1 - t > 45 * 24 * HOUR) t = t1 - 45 * 24 * HOUR;   // cap very long absences
    while (t < t1) {
      const dt = Math.min(5 * MIN, t1 - t);
      stepOnce(st, t, dt, ev, live);
      t += dt;
    }
    st.lastTick = t1;
    const s = seasonOf(t1);
    if (s !== st.lastSeason) { ev.push({ type: 'season', t: t1, season: s, from: st.lastSeason }); st.lastSeason = s; }
    return ev;
  }

  function stepOnce(st, t, dtms, ev, live) {
    if (st.stage === 'egg') { st.egg.warm = Math.max(0, st.egg.warm - 3 * dtms / 1000); return; }
    const h = dtms / HOUR, n = st.needs, te = t + dtms;
    const deep = isDeepWinter(t), m = deep ? 0.6 : 1;

    const age = (te - st.hatchedAt) / HOUR;
    if (st.stage === 'hatchling' && age >= GROW_AT.juvenile) { st.stage = 'juvenile'; ev.push({ type: 'grow', t: te, stage: 'juvenile' }); }
    if (st.stage === 'juvenile' && age >= GROW_AT.grown) {
      st.stage = 'grown'; st.variant = leaning(st);
      ev.push({ type: 'grow', t: te, stage: 'grown', variant: st.variant });
    }
    if (st.sulk) return;   // needs pause while it's across the lake

    if (st.asleep) {
      n.energy += (live ? 90 : 30) * h;   // a nap you watch refills fast (30 min ≈ +45); overnight it's gentle
      n.hunger -= 2.5 * m * h; n.happy -= 0.6 * m * h; n.clean -= 0.6 * m * h;
      if (n.energy >= 100) {
        n.energy = 100; st.asleep = false;
        ev.push({ type: 'wake', t: te, slept: te - st.sleepSince });
      }
    } else {
      // tuned for a once-a-day check-in: from full, hunger lasts ~30 h and it only sulks after 12 more hours at zero
      n.hunger -= 3 * m * h;
      n.happy -= (2.2 + (n.hunger < 25 ? 2.5 : 0) + (n.clean < 25 ? 1.5 : 0) + (n.energy < 20 ? 1 : 0)) * m * h;
      n.energy -= 3.6 * m * h;
      n.clean -= 2 * m * h;
      // tired -> curls up on its own (more often in deep winter: it naps under the ice)
      // while the app is closed it keeps a bedtime (10 pm to 7 am), so mornings start rested
      const hr = new Date(t).getHours(), bedtime = !live && (hr >= 22 || hr < 7) && n.energy < 80;
      if (n.energy <= (deep ? 35 : 12) || bedtime) {
        st.asleep = true; st.sleepSince = te;
        ev.push({ type: 'sleep', t: te, auto: true });
      }
      // gentle neglect -> it sulks off to the other side of the lake
      const bad = n.hunger <= 5 || n.happy <= 5;
      st.neglectH = bad ? st.neglectH + h : Math.max(0, st.neglectH - 2 * h);
      if (st.neglectH >= SULK_AFTER && !st.asleep) {
        st.sulk = { since: te }; st.neglectH = 0; st.care.sulk++;
        ev.push({ type: 'sulk', t: te });
      }
      // happy pets get spotted by tourists
      if (!st.sulk && n.happy >= 60 && n.hunger >= 35 && n.clean >= 30) {
        const s = seasonOf(t);
        const rate = (s === 'summer' ? 1.4 : s === 'winter' ? 0.5 : 0.9) * (live ? 6 : 1);
        st.sightAcc += h * rate;
        if (st.sightAcc >= 1) { st.sightAcc -= 1; ev.push({ type: 'sighting', t: te, entry: addSighting(st, te) }); }
      }
    }
    if (st.stage !== 'grown' && n.clean < 25) st.care.dirtyH += h;
    for (const k in n) n[k] = clamp(n[k], 0, 100);
  }

  // ---- egg -----------------------------------------------------------------
  /** Warm the egg. A tap (boost) also nudges hatching directly, so a casual tapper meets the pet in ~7 s. */
  function warmEgg(st, amt, boost) { st.egg.warm = Math.min(100, st.egg.warm + (amt || 17)); if (boost) st.egg.prog = Math.min(HATCH_NEED, st.egg.prog + boost); }
  /** live egg tick, dt in seconds. Returns true when it hatches. */
  function eggTick(st, dt) {
    const e = st.egg;
    if (e.warm > 12) e.prog += (0.4 + e.warm / 100) * dt;
    return e.prog >= HATCH_NEED;
  }
  function hatch(st, t) {
    st.stage = 'hatchling'; st.hatchedAt = t; st.lastTick = t;
    st.needs = { hunger: 55, happy: 80, energy: 85, clean: 90 };
  }

  // ---- care actions --------------------------------------------------------
  function feed(st, k, t) {
    const f = FOODS[k], n = st.needs;
    if (!f) return { ok: false, reason: 'none' };
    if (st.sulk) {
      if (k === st.fav) { comeBack(st, t); return { ok: true, returned: true }; }
      return { ok: false, reason: 'nobite' };
    }
    if (st.asleep) return { ok: false, reason: 'asleep' };
    if (f.kind === 'meal' && n.hunger >= 92) return { ok: false, reason: 'full' };
    if (f.kind === 'treat' && n.hunger >= 98) return { ok: false, reason: 'full' };
    if (f.kind === 'treat' && t < st.tummyUntil) return { ok: false, reason: 'tummy' };
    const fav = k === st.fav;
    n.hunger = clamp(n.hunger + f.hunger, 0, 100);
    n.happy = clamp(n.happy + f.happy + (fav ? 6 : 0), 0, 100);
    if (st.stage !== 'grown') { if (f.kind === 'meal') st.care.meal++; else st.care.treat++; }
    let tummy = false, warn = false;
    if (k === 'creemee') {
      st.creemees = st.creemees.filter(x => t - x < 2 * HOUR);
      st.creemees.push(t);
      if (st.creemees.length >= 3) {
        tummy = true; st.tummyUntil = t + 30 * MIN; st.creemees = [];
        n.happy = clamp(n.happy - 25, 0, 100);
      } else if (st.creemees.length === 2) warn = true;
    }
    return { ok: true, fav, tummy, warn };
  }
  function comeBack(st, t) {
    const n = st.needs;
    st.sulk = null; st.neglectH = 0; st.asleep = false;
    n.hunger = Math.max(n.hunger, 65); n.happy = Math.max(n.happy, 75);
    n.energy = Math.max(n.energy, 70); n.clean = Math.max(n.clean, 60);
  }
  function sleep(st, t) {
    if (st.sulk || st.asleep) return { ok: false, reason: 'no' };
    if (st.needs.energy >= 85) return { ok: false, reason: 'notsleepy' };
    st.asleep = true; st.sleepSince = t;
    return { ok: true };
  }
  function wake(st, t) {
    if (!st.asleep) return { ok: false };
    st.asleep = false;
    return { ok: true, grumpy: st.needs.energy < 40 };
  }
  function playDone(st, game, score) {
    const n = st.needs;
    const gain = clamp(8 + score * 0.6, 8, 28);
    n.happy = clamp(n.happy + gain, 0, 100);
    n.energy = clamp(n.energy - 5, 0, 100);
    n.hunger = clamp(n.hunger - 4, 0, 100);
    n.clean = clamp(n.clean - 3, 0, 100);
    if (st.stage !== 'grown') st.care.play++;
    const best = score > (st.best[game] || 0);
    if (best) st.best[game] = score;
    return { gain: Math.round(gain), best };
  }
  function bathDone(st, scrubbed) {
    st.needs.clean = 100;
    if (scrubbed !== false) {   // a splash when already clean is just for fun: no happy/care farming
      st.needs.happy = clamp(st.needs.happy + 6, 0, 100);
      if (st.stage !== 'grown') st.care.swim++;
    }
  }
  function pet(st, amt) { st.needs.happy = clamp(st.needs.happy + amt, 0, 100); }
  function canPlay(st) {
    const n = st.needs;
    if (st.sulk) return 'away';
    if (st.asleep) return 'asleep';
    if (n.energy < 15) return 'tired';
    if (n.hunger < 12) return 'hungry';
    return '';
  }

  function ageHours(st, t) { return st.hatchedAt ? (t - st.hatchedAt) / HOUR : 0; }

  /** Mood used for faces: lowest need decides. */
  function mood(st, t) {
    const n = st.needs;
    if (st.sulk) return 'away';
    if (st.asleep) return 'asleep';
    if (t < st.tummyUntil) return 'tummy';
    const low = Math.min(n.hunger, n.happy, n.clean);
    if (n.energy < 22) return 'sleepy';
    if (low < 25) return 'sad';
    if (n.happy > 75 && low > 50) return 'happy';
    return 'ok';
  }

  // ---- save -----------------------------------------------------------------
  const KEY = 'petChamp.save';
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return null;
    if (s.v !== SAVE_VERSION) return migrate(s);
    return fill(s);
  }
  function fill(s) {   // tolerate missing fields from older saves of the same version
    const d = newState(s.created || Date.now());
    for (const k in d) if (s[k] === undefined) s[k] = d[k];
    if (!Array.isArray(s.closet)) s.closet = [];
    for (const k of ['needs', 'care', 'best', 'settings', 'egg']) for (const j in d[k]) if (s[k][j] === undefined) s[k][j] = d[k][j];
    return s;
  }
  function migrate(s) { return null; }   // only one version so far
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }

  root.Sim = {
    SAVE_VERSION, HOUR, MIN, GROW_AT, HATCH_NEED, FOODS, TREATS, VARIANTS,
    newState, advance, warmEgg, eggTick, hatch, feed, comeBack, sleep, wake, playDone, bathDone, pet, canPlay,
    seasonOf, isDeepWinter, ageHours, mood, leaning, variantScores, addSighting, makeReport,
    save, load, wipe,
    WEARS, WEAR_ORDER, STAR_WEARS, COMBO, LEAGUES, weekNum, cupToday, cupStandings, cupScore, dayNum, findReady, collectFind, setWear, goalsToday, goalEvent,
    setSeasonOverride(s) { seasonOverride = s || null; },
    getSeasonOverride() { return seasonOverride; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
