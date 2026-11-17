(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const animated = hasGsap && !reduce;
  if (!animated) root.classList.remove('anim');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const isHorizontal = () => animated && window.innerWidth >= 820;

  /* ---------- Hasard reproductible pour les formes d'onde ---------- */
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Construction des éléments générés ---------- */
  // Lettres du nom
  $$('.name .line').forEach(line => {
    line.innerHTML = Array.from(line.textContent).map(c => `<span class="lt">${c}</span>`).join('');
  });

  // Paroles mot par mot
  const lyrics = $('.lyrics');
  lyrics.innerHTML = lyrics.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  const words = $$('.lyrics .w');
  const ball = $('.ball');

  // Égaliseur
  const eq = $('.eq');
  for (let i = 0; i < 56; i++) eq.appendChild(document.createElement('i'));
  const eqBars = $$('.eq i');
  const eqLv = eqBars.map(() => 0.05);

  // Vumètres
  $$('.vu').forEach(vu => { for (let i = 0; i < 14; i++) vu.appendChild(document.createElement('i')); });

  // Séquenceur
  const seq = $('.seq');
  for (let i = 0; i < 16; i++) seq.appendChild(document.createElement('i'));
  const seqSteps = $$('.seq i');

  // Formes d'onde
  const waves = $$('.wave').map(w => {
    const seed = +w.dataset.seed || 1;
    const rand = rng(seed);
    const n = 120;
    let bars = '';
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const env = 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * x), 0.5) * (0.55 + 0.45 * Math.sin(x * 17 + seed));
      const h = Math.max(6, Math.round(100 * env * (0.35 + 0.65 * rand())));
      bars += `<rect x="${i * 5}" y="${(100 - h) / 2}" width="3" height="${h}" rx="1.5"/>`;
    }
    const svg = `<svg viewBox="0 0 ${n * 5} 100" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
    w.innerHTML = `<div class="wave-base">${svg}</div><div class="wave-played">${svg}</div>`;
    return { el: w, clip: w.closest('.clip') };
  });

  function updateWaves() {
    const vw = window.innerWidth, vh = window.innerHeight, horiz = isHorizontal();
    waves.forEach(({ el, clip }) => {
      let p = 1;
      if (animated) {
        const r = clip.getBoundingClientRect();
        p = horiz ? (vw / 2 - r.left) / r.width : (vh * 0.7 - r.top) / r.height;
      }
      el.style.setProperty('--p', clamp(p).toFixed(4));
    });
  }

  /* ---------- Barre de transport ---------- */
  const TOTAL = 210;
  const tpTime = $('.tp-time');
  const tpFill = $('.tp-fill');
  const markers = $$('.tp-mark');
  let maxS = 1;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function sectionTop(el) {
    const parent = el.parentElement;
    const box = parent && parent.classList.contains('pin-spacer') ? parent : el;
    return box.getBoundingClientRect().top + window.scrollY;
  }
  function measure() {
    maxS = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    markers.forEach(b => {
      const top = Math.min(sectionTop($(b.dataset.target)), maxS);
      b._top = top;
      b.style.left = (top / maxS * 100) + '%';
    });
    bands.forEach(b => { b.w = b.el.scrollWidth / 2; });
    cacheWords();
  }
  function updateTransport() {
    const p = clamp(window.scrollY / maxS);
    tpTime.textContent = fmt(p * TOTAL);
    tpFill.style.transform = `scaleX(${p})`;
  }
  markers.forEach(b => b.addEventListener('click', () => {
    window.scrollTo({ top: b._top != null ? b._top : sectionTop($(b.dataset.target)), behavior: reduce ? 'auto' : 'smooth' });
  }));
  $('.tp-logo').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  $('.rewind').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  /* ---------- Karaoké ---------- */
  let wordPos = [];
  let currentWord = -1;
  function cacheWords() {
    wordPos = words.map(w => ({ x: w.offsetLeft + w.offsetWidth / 2, y: w.offsetTop }));
  }
  function moveBall(p) {
    if (!wordPos.length) return;
    const n = words.length;
    const f = clamp(p) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const frac = Math.min(1, f - i);
    const a = wordPos[i], b = wordPos[Math.min(n - 1, i + 1)];
    const x = a.x + (b.x - a.x) * frac;
    const y = a.y + (b.y - a.y) * frac - Math.sin(frac * Math.PI) * 34 - 14;
    ball.style.transform = `translate(${x - 6.5}px, ${y - 6.5}px)`;
    ball.style.opacity = p > 0.001 && p < 0.999 ? 1 : 0;
    if (i !== currentWord) {
      if (currentWord >= 0) words[currentWord].classList.remove('now');
      if (p < 0.999) { words[i].classList.add('now'); currentWord = i; } else currentWord = -1;
    }
  }

  /* ---------- Bandeaux ---------- */
  const bands = $$('.band-inner').map((el, i) => ({ el, x: 0, w: 1, dir: i % 2 ? 1 : -1 }));

  /* ---------- Visibilité des sections ---------- */
  let heroIn = true, deskIn = false, padsIn = false;
  let deskAmt = animated ? 0 : 1;
  let needleDown = !animated;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.target.id === 'intro') heroIn = e.isIntersecting;
      if (e.target.id === 'console') deskIn = e.isIntersecting;
      if (e.target.id === 'pads') {
        padsIn = e.isIntersecting;
        if (!padsIn && beatOn) toggleBeat();
      }
    });
  });
  ['#intro', '#console', '#pads'].forEach(s => io.observe($(s)));

  /* ---------- Boucle d'animation ---------- */
  const disc = $('.disc');
  const strips = $$('.strip').map(s => ({ segs: $$('.vu i', s), lvl: +s.dataset.level, cur: 0 }));
  let lastY = window.scrollY, lastT = performance.now(), vel = 0, rot = 0, lastMove = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const y = window.scrollY, dy = y - lastY;
    lastY = y;
    vel += (dy / Math.max(dt, 0.001) - vel) * 0.2;
    if (Math.abs(dy) > 0.5) lastMove = now;
    root.classList.toggle('is-scrolling', now - lastMove < 220);

    // Le disque tourne à 33 tours, et suit aussi le défilement
    if (heroIn) {
      rot += (needleDown ? 198 * dt : 0) + dy * 0.35;
      disc.style.transform = `rotate(${rot.toFixed(2)}deg)`;

      const energy = needleDown ? 0.5 + clamp(Math.abs(vel) / 2500) * 0.5 : 0.06;
      const n = eqBars.length;
      for (let i = 0; i < n; i++) {
        const shape = 1 - Math.abs(i / n - 0.5) * 1.1;
        const target = energy * shape * (0.3 + 0.7 * Math.random());
        eqLv[i] += (target - eqLv[i]) * 0.22;
        eqBars[i].style.transform = `scaleY(${Math.max(0.03, eqLv[i]).toFixed(3)})`;
      }
    }

    if (deskIn) {
      strips.forEach(s => {
        const target = s.lvl * deskAmt * (0.55 + 0.45 * Math.random());
        s.cur += (target - s.cur) * 0.3;
        const lit = Math.round(s.cur * s.segs.length);
        s.segs.forEach((seg, i) => seg.classList.toggle('on', i < lit));
      });
    }

    const speed = 50 + Math.min(1600, Math.abs(vel)) * 0.5;
    const sign = vel < -5 ? -1 : 1;
    bands.forEach(b => {
      b.x += b.dir * sign * speed * dt;
      b.x = ((b.x % b.w) + b.w) % b.w - b.w;
      b.el.style.transform = `translate3d(${b.x.toFixed(1)}px,0,0)`;
    });

    updateWaves();
    updateTransport();
    requestAnimationFrame(frame);
  }

  /* ---------- Boîte à rythmes (Web Audio) ---------- */
  let ctx = null, master = null, noiseBuf = null;
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(comp);
      comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g, t, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.003 + dec);
  }
  function noise(t, dur, type, freq, peak, q = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, peak, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, dur, peak) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = ctx.createGain();
    env(g, t, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const kit = {
    kick: t => tone(t, 'sine', 160, 42, 0.45, 1),
    snare: t => { noise(t, 0.2, 'highpass', 1200, 0.7); tone(t, 'triangle', 220, 160, 0.12, 0.4); },
    hat: t => noise(t, 0.05, 'highpass', 7500, 0.35),
    open: t => noise(t, 0.32, 'highpass', 7000, 0.3),
    clap: t => { [0, 0.012, 0.024].forEach(o => noise(t + o, 0.05, 'bandpass', 1500, 0.6, 0.8)); noise(t + 0.036, 0.2, 'bandpass', 1500, 0.5, 0.8); },
    tomLo: t => tone(t, 'sine', 190, 90, 0.35, 0.8),
    tomHi: t => tone(t, 'sine', 300, 150, 0.28, 0.7),
    bell: t => { tone(t, 'square', 800, 790, 0.18, 0.12); tone(t, 'square', 540, 535, 0.18, 0.12); }
  };

  const pads = $$('.pad');
  const padBySound = {};
  const padByCode = {};
  pads.forEach(p => { padBySound[p.dataset.sound] = p; padByCode[p.dataset.code] = p; });

  function flash(pad) {
    pad.classList.remove('hit');
    void pad.offsetWidth;
    pad.classList.add('hit');
    clearTimeout(pad._t);
    pad._t = setTimeout(() => pad.classList.remove('hit'), 110);
  }
  function hit(sound) {
    if (!audio()) return;
    kit[sound](ctx.currentTime + 0.005);
    flash(padBySound[sound]);
  }
  pads.forEach(p => p.addEventListener('pointerdown', e => { e.preventDefault(); hit(p.dataset.sound); }));
  pads.forEach(p => p.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(p.dataset.sound); }
  }));
  window.addEventListener('keydown', e => {
    if (!padsIn || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const pad = padByCode[e.code];
    if (pad) { e.preventDefault(); hit(pad.dataset.sound); }
  });

  // Séquence de 16 pas à 100 BPM
  const pattern = {
    kick: [0, 7, 8, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12],
    open: [14],
    clap: [12],
    tomHi: [13],
    tomLo: [15],
    bell: [3, 11]
  };
  const stepDur = 60 / 100 / 4;
  let beatOn = false, step = 0, nextTime = 0, timer = null;
  const beatBtn = $('.beat-btn');

  function schedule(s, t) {
    const delay = Math.max(0, (t - ctx.currentTime) * 1000);
    Object.keys(pattern).forEach(k => {
      if (pattern[k].includes(s)) {
        kit[k](t);
        setTimeout(() => flash(padBySound[k]), delay);
      }
    });
    setTimeout(() => {
      seqSteps.forEach((el, i) => el.classList.toggle('on', i === s && beatOn));
    }, delay);
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.1) {
      schedule(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % 16;
    }
  }
  function toggleBeat() {
    if (beatOn) {
      beatOn = false;
      clearInterval(timer);
      seqSteps.forEach(el => el.classList.remove('on'));
    } else {
      if (!audio()) return;
      beatOn = true;
      step = 0;
      nextTime = ctx.currentTime + 0.06;
      timer = setInterval(scheduler, 25);
    }
    beatBtn.classList.toggle('on', beatOn);
    $('.txt', beatBtn).textContent = beatOn ? 'Arrêter' : 'Lancer le beat';
  }
  beatBtn.addEventListener('click', toggleBeat);

  /* ---------- Animations au défilement (GSAP) ---------- */
  if (animated) {
    gsap.registerPlugin(ScrollTrigger);

    // Entrée de la page
    gsap.from('.name .lt', { yPercent: 115, duration: 1, ease: 'power4.out', stagger: 0.035, delay: 0.1 });
    gsap.from('.deck', { scale: 0.85, rotate: -6, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.25 });
    gsap.from('.hero-text .kicker', { opacity: 0, x: -20, duration: 0.8, delay: 0.5 });

    // 1. Le disque sort de sa pochette, le bras se pose
    const htl = gsap.timeline({
      scrollTrigger: { trigger: '#intro', start: 'top top', end: '+=140%', pin: true, scrub: 0.7 },
      onUpdate() { needleDown = this.time() >= 1.45; }
    });
    htl.to('.scroll-hint', { opacity: 0, y: 20, duration: 0.2 }, 0)
      .to('.vinyl', { xPercent: 55, duration: 1, ease: 'power2.inOut' }, 0)
      .to('.sleeve', { xPercent: -8, rotate: -4, duration: 1, ease: 'power2.inOut' }, 0)
      .to('.arm', { rotate: 21, duration: 0.5, ease: 'power2.out' }, 1)
      .from('.hero-sub .r', { yPercent: 110, opacity: 0, stagger: 0.12, duration: 0.4 }, 1.1)
      .to({}, { duration: 0.3 });

    // 2. Karaoké
    gsap.set(words, { opacity: 0.14 });
    gsap.timeline({
      scrollTrigger: {
        trigger: '#paroles', start: 'top top', end: '+=150%', pin: true, scrub: 0.5,
        onUpdate: self => moveBall(self.progress)
      }
    }).to(words, { opacity: 1, stagger: 1, duration: 1, ease: 'none' });

    // 3. Pistes : horizontal sur grand écran, vertical sur mobile
    const mm = gsap.matchMedia();
    mm.add('(min-width: 820px)', () => {
      const track = $('.lane-track');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: '#projets', start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 0.8, invalidateOnRefresh: true
        }
      });
    });
    mm.add('(max-width: 819.98px)', () => {
      $$('.lane-title, .clip').forEach(el => {
        gsap.from(el, { y: 70, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
      });
    });

    // Titres de section
    $$('.reveal').forEach(el => {
      gsap.from(el.children, {
        y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // 4. Console : les tranches montent, faders et LED suivent le défilement
    const stripEls = $$('.strip');
    const ctl = gsap.timeline({
      scrollTrigger: { trigger: '.desk', start: 'top 85%', end: 'bottom 75%', scrub: 0.6 },
      onUpdate() { deskAmt = this.progress(); }
    });
    ctl.from(stripEls, { y: 100, opacity: 0, rotate: i => (i % 2 ? 2 : -2), stagger: 0.12, duration: 0.5, ease: 'power2.out' }, 0);
    stripEls.forEach((s, i) => {
      const lvl = +s.dataset.level;
      const cap = $('.cap', s), fader = $('.fader', s);
      const at = 0.35 + i * 0.08;
      ctl.to(cap, { y: () => -(fader.clientHeight - cap.offsetHeight) * lvl, duration: 0.8, ease: 'power2.out' }, at)
        .to($('.knob', s), { rotate: -135 + 270 * lvl, duration: 0.8 }, at)
        .to($$('.led', s), { backgroundColor: '#e2382c', boxShadow: '0 0 8px rgba(226,56,44,0.9)', stagger: 0.05, duration: 0.1 }, at + 0.05)
        .to($$('li', s), { color: '#efe6d6', stagger: 0.05, duration: 0.1 }, at + 0.05)
        .to($$('.logo', s), { filter: 'grayscale(0)', opacity: 1, scale: 1, stagger: 0.05, duration: 0.1 }, at + 0.05);
    });

    // 5. Pads qui tombent
    gsap.from('.pad', {
      y: -60, opacity: 0, rotate: i => (i % 2 ? 10 : -10), scale: 0.8,
      duration: 0.7, ease: 'back.out(2)', stagger: 0.06,
      scrollTrigger: { trigger: '.pads', start: 'top 80%' }
    });

    // 6. Le billet arrive, puis le talon se détache
    gsap.fromTo('.ticket', { rotate: -12, y: 140, opacity: 0 }, {
      rotate: -2, y: 0, opacity: 1, ease: 'power2.out',
      scrollTrigger: { trigger: '#rappel', start: 'top 85%', end: 'center 65%', scrub: 0.6 }
    });
    const stubMove = () => (window.innerWidth >= 820 ? { x: 22, y: 0, rotate: 5 } : { x: 0, y: 16, rotate: 3 });
    gsap.to('.stub', {
      x: () => stubMove().x, y: () => stubMove().y, rotate: () => stubMove().rotate, ease: 'none',
      scrollTrigger: { trigger: '.ticket', start: 'center 65%', end: 'bottom 45%', scrub: 0.6, invalidateOnRefresh: true }
    });

    ScrollTrigger.addEventListener('refresh', () => { measure(); updateWaves(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  } else {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', updateTransport, { passive: true });
  }

  measure();
  updateWaves();
  updateTransport();
  if (!reduce) requestAnimationFrame(frame);
  window.addEventListener('load', () => (animated ? ScrollTrigger.refresh() : measure()));
})();
