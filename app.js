(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();

  // ---------- storage (best effort) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  // ---------- time zone math ----------
  const fmtCache = new Map();
  function partsFmt(tz) {
    if (!fmtCache.has(tz)) {
      fmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
      }));
    }
    return fmtCache.get(tz);
  }
  function zoned(t, tz) {
    const o = {};
    for (const p of partsFmt(tz).formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = +p.value;
    return { y: o.year, m: o.month - 1, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute, s: o.second };
  }
  // UTC instant of 00:00 wall-clock on y-m-d in tz (handles DST and month overflow)
  function midnightIn(y, m, d, tz) {
    const want = Date.UTC(y, m, d);
    let t = want;
    for (let i = 0; i < 3; i++) {
      const p = zoned(t, tz);
      const wall = Date.UTC(p.y, p.m, p.d, p.h, p.mi, p.s);
      const delta = want - wall;
      if (!delta) break;
      t += delta;
    }
    return t;
  }
  function validTz(tz) {
    if (!tz) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
  }
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

  // ---------- config ----------
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function validDate(s) {
    if (!DATE_RE.test(s || '')) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1900 && y <= 2200;
  }
  function readConfig() {
    const q = new URLSearchParams(location.search);
    if (validDate(q.get('d'))) {
      return { n: (q.get('n') || '').slice(0, 40), d: q.get('d'), tz: validTz(q.get('tz')) ? q.get('tz') : LOCAL_TZ, age: q.get('a') !== '0', fromLink: true };
    }
    try {
      const s = JSON.parse(store.get('bdc.config') || 'null');
      if (s && validDate(s.d)) return { n: String(s.n || '').slice(0, 40), d: s.d, tz: validTz(s.tz) ? s.tz : LOCAL_TZ, age: s.age !== false };
    } catch {}
    return null;
  }
  function sampleConfig() {
    const t = new Date(Date.now() + 30 * 864e5);
    return { n: '', d: `${t.getFullYear() - 30}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, tz: LOCAL_TZ, age: true, sample: true };
  }
  function shareUrl(c) {
    const q = new URLSearchParams();
    if (c.n.trim()) q.set('n', c.n.trim());
    q.set('d', c.d);
    q.set('tz', c.tz);
    if (!c.age) q.set('a', '0');
    return `${location.origin}${location.pathname}?${q.toString()}`;
  }

  let cfg = readConfig();
  let mode = cfg ? 'run' : 'setup';
  if (!cfg) cfg = sampleConfig();

  // ---------- birthday math ----------
  function birthdayYMD(year) {
    let [, m, d] = cfg.d.split('-').map(Number);
    m -= 1;
    if (m === 1 && d === 29 && !isLeap(year)) d = 28;
    return [year, m, d];
  }
  function nextBirthday(now) {
    const yNow = zoned(now, cfg.tz).y;
    for (const y of [yNow - 1, yNow, yNow + 1]) {
      const [Y, M, D] = birthdayYMD(y);
      const start = midnightIn(Y, M, D, cfg.tz);
      const end = midnightIn(Y, M, D + 1, cfg.tz);
      if (now < start) return { target: start, year: Y, isToday: false };
      if (now < end) return { target: start, year: Y, isToday: true };
    }
    const [Y, M, D] = birthdayYMD(yNow + 2);
    return { target: midnightIn(Y, M, D, cfg.tz), year: Y, isToday: false };
  }

  // ---------- formatting ----------
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TZ_ALIAS = { Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu' };
  const tzCity = tz => { const c = tz.split('/').pop().replace(/_/g, ' '); return TZ_ALIAS[c] || c; };
  function fmtDate(t, tz) {
    try { return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(t); }
    catch { return new Date(t).toDateString(); }
  }
  function fmtLocalTime(t) {
    try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(t); }
    catch { return new Date(t).toLocaleString(); }
  }
  function offsetLabel(tz) {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      return (p.find(x => x.type === 'timeZoneName') || {}).value || '';
    } catch { return ''; }
  }

  // ---------- render ----------
  let rehearsalEnd = null;
  let celebratedFor = null;
  let lastTitle = '';

  function displayName() { return cfg.n.trim(); }

  function render() {
    const now = Date.now();
    const nm = displayName();
    $('hName').textContent = nm ? `${nm}'s` : (cfg.sample ? 'Your' : 'The');
    let target, isToday, year, rehearsing = false;

    if (rehearsalEnd) {
      rehearsing = true;
      target = rehearsalEnd;
      isToday = now >= target;
      year = null;
    } else {
      ({ target, isToday, year } = nextBirthday(now));
    }

    const by = +cfg.d.slice(0, 4);
    const age = cfg.age && year ? year - by : null;
    const showAge = age && age > 0 && age < 150;
    const crossTz = cfg.tz !== LOCAL_TZ;

    if (isToday) {
      const key = rehearsing ? 'rehearsal' : `${cfg.d}|${cfg.tz}|${year}`;
      $('clock').hidden = true;
      $('celebrate').hidden = false;
      $('eyebrow').textContent = rehearsing ? 'Rehearsal' : "It's the day";
      $('cheer').textContent = nm ? `Happy Birthday, ${nm}!` : 'Happy Birthday!';
      $('cheerSub').textContent = showAge && !rehearsing ? `Happy ${ord(age)}! The clock struck midnight.` : 'The clock struck midnight.';
      $('sub').innerHTML = rehearsing ? 'That was a practice run.' : `Today, <strong>${esc(fmtDate(target, cfg.tz))}</strong>`;
      if (celebratedFor !== key) { celebratedFor = key; celebrate(); }
      setTitle(nm ? `Happy Birthday, ${nm}!` : 'Happy Birthday!');
      if (rehearsing && now - target > 15000) { rehearsalEnd = null; celebratedFor = null; }
      return;
    }

    $('clock').hidden = false;
    $('celebrate').hidden = true;
    $('eyebrow').textContent = rehearsing ? 'Rehearsal · 10 seconds' : (cfg.sample ? 'Preview' : 'Counting down to midnight');

    if (rehearsing) {
      $('sub').textContent = 'Confetti fires at zero.';
    } else {
      let html = `Starts at 00:00 on <strong>${esc(fmtDate(target, cfg.tz))}</strong>`;
      if (crossTz) html += ` in ${esc(tzCity(cfg.tz))} <span class="nowrap">(${esc(fmtLocalTime(target))} your time)</span>`;
      if (showAge) html += ` · turning ${age}`;
      $('sub').innerHTML = html;
    }

    let diff = Math.max(0, target - now);
    const days = Math.floor(diff / 864e5); diff -= days * 864e5;
    const hrs = Math.floor(diff / 36e5); diff -= hrs * 36e5;
    const mins = Math.floor(diff / 6e4); diff -= mins * 6e4;
    const secs = Math.floor(diff / 1e3);
    $('d').textContent = pad(days); $('h').textContent = pad(hrs);
    $('m').textContent = pad(mins); $('s').textContent = pad(secs);
    const finalMinute = days === 0 && hrs === 0 && mins === 0;
    $('secCell').classList.toggle('final', finalMinute);
    $('clock').classList.toggle('last', finalMinute);
    setTitle(`${days ? days + 'd ' : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)} · ${nm ? nm + "'s birthday" : 'Birthday countdown'}`);
  }
  function setTitle(t) { if (t !== lastTitle) { document.title = t; lastTitle = t; } }

  // ---------- views ----------
  function applyMode() {
    const run = mode === 'run';
    $('setup').hidden = run;
    $('runActions').hidden = !run;
    if (!run) $('shareBox').hidden = true;
  }

  // ---------- setup form ----------
  function fillTzSelect() {
    const sel = $('tzIn');
    let zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch {}
    if (!zones.length) zones = ['UTC'];
    const frag = document.createDocumentFragment();
    const mine = document.createElement('option');
    mine.value = LOCAL_TZ;
    mine.textContent = `Your time zone · ${tzCity(LOCAL_TZ)} ${offsetLabel(LOCAL_TZ)}`.trim();
    frag.appendChild(mine);
    const extra = cfg.tz && cfg.tz !== LOCAL_TZ && !zones.includes(cfg.tz) ? [cfg.tz] : [];
    for (const z of [...extra, ...zones]) {
      if (z === LOCAL_TZ) continue;
      const o = document.createElement('option');
      o.value = z; o.textContent = `${z.replace(/_/g, ' ')} ${offsetLabel(z)}`.trim();
      frag.appendChild(o);
    }
    sel.appendChild(frag);
  }
  function loadForm() {
    $('nameIn').value = cfg.sample ? '' : cfg.n;
    $('dateIn').value = cfg.sample ? '' : cfg.d;
    $('tzIn').value = cfg.tz;
    $('ageIn').checked = cfg.age;
    $('dateIn').max = `${new Date().getFullYear() + 1}-12-31`;
  }
  function formPreview() {
    const d = $('dateIn').value;
    const base = validDate(d) ? { d, sample: false } : { d: sampleConfig().d, sample: true };
    cfg = { n: $('nameIn').value.slice(0, 40), tz: $('tzIn').value || LOCAL_TZ, age: $('ageIn').checked, ...base };
    if (cfg.n.trim()) cfg.sample = false;
    celebratedFor = null;
    $('formErr').textContent = '';
    render();
  }
  ['input', 'change'].forEach(ev => $('setup').addEventListener(ev, formPreview));
  $('setup').addEventListener('submit', e => {
    e.preventDefault();
    const n = $('nameIn').value.trim(), d = $('dateIn').value;
    if (!n) { $('formErr').textContent = 'Enter a name to show on the countdown.'; $('nameIn').focus(); return; }
    if (!validDate(d)) { $('formErr').textContent = 'Pick a date of birth from the calendar.'; $('dateIn').focus(); return; }
    cfg = { n, d, tz: $('tzIn').value || LOCAL_TZ, age: $('ageIn').checked };
    store.set('bdc.config', JSON.stringify(cfg));
    try { history.replaceState(null, '', shareUrl(cfg)); } catch {}
    mode = 'run'; celebratedFor = null; applyMode(); render();
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  $('edit').addEventListener('click', () => {
    mode = 'setup'; loadForm(); applyMode(); render();
    $('nameIn').focus();
  });

  // ---------- share ----------
  async function share() {
    const url = shareUrl(cfg);
    $('shareUrl').value = url;
    $('shareBox').hidden = false;
    $('copyMsg').innerHTML = '&nbsp;';
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: document.title, text: `Countdown to ${displayName() || 'the'} birthday`, url }); return; } catch {}
    }
  }
  async function copy() {
    const el = $('shareUrl');
    try { await navigator.clipboard.writeText(el.value); $('copyMsg').textContent = 'Link copied.'; }
    catch { el.focus(); el.select(); $('copyMsg').textContent = 'Press Ctrl+C (or ⌘C) to copy the selected link.'; }
  }
  $('share').addEventListener('click', share);
  $('copyUrl').addEventListener('click', copy);
  $('rehearse').addEventListener('click', () => { rehearsalEnd = Date.now() + 10000; celebratedFor = null; render(); });

  // ---------- stage (timer-only full screen) ----------
  let idleT = null;
  function wake() {
    if (!document.body.classList.contains('stage')) return;
    document.body.classList.add('awake');
    clearTimeout(idleT);
    idleT = setTimeout(() => document.body.classList.remove('awake'), 2500);
  }
  async function enterStage() {
    document.body.classList.add('stage');
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch {}
    keepAwake();
    setTimeout(resizeAll, 200);
  }
  function leaveStage() {
    document.body.classList.remove('stage', 'awake');
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch {} }
    setTimeout(resizeAll, 200);
  }
  $('goStage').addEventListener('click', enterStage);
  $('exitStage').addEventListener('click', leaveStage);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) leaveStage(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') leaveStage();
    if ((e.key === 'f' || e.key === 'F') && mode === 'run' && !/input|select|textarea/i.test(e.target.tagName)) enterStage();
  });
  ['mousemove', 'touchstart'].forEach(ev => addEventListener(ev, wake, { passive: true }));

  // ---------- keep screen awake (best effort) ----------
  async function keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch {}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); render(); } });

  // ---------- canvases ----------
  function sizeCanvas(c) {
    const r = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * r; c.height = innerHeight * r;
    c.getContext('2d').setTransform(r, 0, 0, r, 0, 0);
  }
  const sc = $('stars'), sx = sc.getContext('2d');
  let stars = [];
  function makeStars() {
    sizeCanvas(sc);
    const n = Math.min(400, Math.round(innerWidth * innerHeight / 9000));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + .2, p: Math.random() * 6.28 }));
  }
  function drawStars(t) {
    sx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      const a = reduce ? .6 : .35 + .35 * Math.sin(t / 900 + s.p);
      sx.fillStyle = `rgba(243,241,255,${a})`;
      sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 6.283); sx.fill();
    }
  }

  const cc = $('confetti'), cx = cc.getContext('2d');
  const colors = ['#ffc94a', '#ff7a8a', '#7fe0d2', '#b9a4ff', '#ffffff', '#ff9f43'];
  let bits = [];
  const MAX_BITS = 1400;
  function piece(x, y, vx, vy) {
    return { x, y, vx, vy, w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
      tilt: Math.random() * 6.28, vt: .05 + Math.random() * .1, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < .25 };
  }
  function burst(x, y, n) {
    if (reduce) n = Math.round(n / 3);
    for (let i = 0; i < n && bits.length < MAX_BITS; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      bits.push(piece(x, y, Math.cos(a) * v, Math.sin(a) * v - 6));
    }
  }
  function rain(n) {
    if (reduce) n = Math.round(n / 3);
    for (let i = 0; i < n && bits.length < MAX_BITS; i++) bits.push(piece(Math.random() * innerWidth, -20 - Math.random() * innerHeight * .5, (Math.random() - .5) * 2, Math.random() * 2));
  }
  function drawConfetti() {
    if (!bits.length) return;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.18; b.vx *= 0.99; b.vy *= 0.99;
      b.x += b.vx + Math.sin(b.tilt) * .6; b.y += b.vy; b.rot += b.vr; b.tilt += b.vt;
      cx.save(); cx.translate(b.x, b.y); cx.rotate(b.rot); cx.fillStyle = b.c;
      if (b.round) { cx.beginPath(); cx.arc(0, 0, b.w / 2, 0, 6.283); cx.fill(); }
      else { cx.scale(1, Math.cos(b.tilt)); cx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
      cx.restore();
    }
    bits = bits.filter(b => b.y < innerHeight + 40);
    if (!bits.length) cx.clearRect(0, 0, innerWidth, innerHeight);
  }
  function celebrate() {
    const W = innerWidth, H = innerHeight;
    burst(W * .2, H * .7, 140); burst(W * .8, H * .7, 140);
    setTimeout(() => burst(W * .5, H * .45, 200), 350);
    let waves = 0;
    const iv = setInterval(() => { rain(70); if (++waves >= (reduce ? 3 : 14)) clearInterval(iv); }, 600);
  }
  $('celebrate').addEventListener('click', () => burst(innerWidth / 2, innerHeight * .45, 120));

  function resizeAll() { makeStars(); sizeCanvas(cc); }
  addEventListener('resize', resizeAll);

  // ---------- boot ----------
  fillTzSelect();
  loadForm();
  applyMode();
  resizeAll();
  render();
  drawStars(0);
  keepAwake();

  let last = 0, lastStar = 0;
  function frame(t) {
    if (t - last > 200) { render(); last = t; }
    if (!reduce && t - lastStar > 50) { drawStars(t); lastStar = t; }
    drawConfetti();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Background tabs throttle rAF; keep the clock correct when it becomes visible again.
  setInterval(() => { if (document.hidden) render(); }, 1000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // test hook (no effect on users)
  window.__bdc = { midnightIn, zoned, nextBirthday: (t, c) => { const old = cfg; cfg = c; const r = nextBirthday(t); cfg = old; return r; } };
})();
