(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pad = n => String(n).padStart(2, '0');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Saved countdown on this device?
  try { if (localStorage.getItem('bdc.config')) $('resume').hidden = false; } catch {}

  // Where are you?
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const alias = { Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu' };
    const raw = tz.split('/').pop().replace(/_/g, ' ');
    const city = alias[raw] || raw;
    if (city) $('where').innerHTML = `Time left until midnight in <strong>${city.replace(/[<>&]/g, '')}</strong>`;
  } catch {}

  // ---------- clock: tonight's real midnight, or a 10-second demo ----------
  let demoEnd = null, celebrateUntil = 0;
  function nextMidnight() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime(); }
  function tick() {
    const now = Date.now();
    if (now < celebrateUntil) return;
    if (celebrateUntil && now >= celebrateUntil) { celebrateUntil = 0; $('cheer').hidden = true; $('digits').hidden = false; $('note').hidden = false; }
    const target = demoEnd || nextMidnight();
    let diff = target - now;
    if (diff <= 0) { fire(); return; }
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    $('hh').textContent = pad(h); $('mm').textContent = pad(m); $('ss').textContent = pad(s);
    $('digits').classList.toggle('last', h === 0 && m === 0);
  }
  function fire() {
    const wasDemo = !!demoEnd;
    demoEnd = null;
    $('digits').hidden = true; $('digits').classList.remove('last');
    $('cheer').hidden = false; $('cheer').textContent = wasDemo ? "It's midnight!" : 'Happy midnight!';
    $('note').hidden = true;
    $('demo').disabled = false;
    celebrateUntil = Date.now() + 9000;
    celebrate();
  }
  $('demo').addEventListener('click', () => {
    demoEnd = Date.now() + 10000; celebrateUntil = 0;
    $('cheer').hidden = true; $('digits').hidden = false; $('note').hidden = false;
    $('demo').disabled = true;
    tick();
    const card = document.querySelector('.clockcard');
    if (card.getBoundingClientRect().top > innerHeight * .6) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
  tick();
  setInterval(tick, 250);

  // ---------- canvases ----------
  function size(c) { const r = Math.min(devicePixelRatio || 1, 2); c.width = innerWidth * r; c.height = innerHeight * r; c.getContext('2d').setTransform(r, 0, 0, r, 0, 0); }
  const sc = $('stars'), sx = sc.getContext('2d'); let stars = [];
  function makeStars() { size(sc); const n = Math.min(320, Math.round(innerWidth * innerHeight / 9000));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.2 + .2, p: Math.random() * 6.28 })); }
  function drawStars(t) { sx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) { sx.fillStyle = `rgba(243,241,255,${reduce ? .55 : .3 + .3 * Math.sin(t / 900 + s.p)})`; sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 6.283); sx.fill(); } }
  const cc = $('confetti'), cx = cc.getContext('2d');
  const colors = ['#ffc94a', '#ff7a8a', '#7fe0d2', '#b9a4ff', '#ffffff', '#ff9f43'];
  let bits = [];
  const piece = (x, y, vx, vy) => ({ x, y, vx, vy, w: 6 + Math.random() * 6, h: 8 + Math.random() * 10, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
    tilt: Math.random() * 6.28, vt: .05 + Math.random() * .1, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < .25 });
  function burst(x, y, n) { if (reduce) n = Math.round(n / 3); for (let i = 0; i < n && bits.length < 1200; i++) { const a = Math.random() * 6.283, v = 4 + Math.random() * 9; bits.push(piece(x, y, Math.cos(a) * v, Math.sin(a) * v - 6)); } }
  function rain(n) { if (reduce) n = Math.round(n / 3); for (let i = 0; i < n && bits.length < 1200; i++) bits.push(piece(Math.random() * innerWidth, -20 - Math.random() * innerHeight * .4, (Math.random() - .5) * 2, Math.random() * 2)); }
  function celebrate() { const W = innerWidth, H = innerHeight; burst(W * .2, H * .7, 120); burst(W * .8, H * .7, 120);
    setTimeout(() => burst(W * .5, H * .45, 160), 300); let k = 0; const iv = setInterval(() => { rain(60); if (++k >= (reduce ? 2 : 8)) clearInterval(iv); }, 600); }
  function drawConfetti() { if (!bits.length) return; cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) { b.vy += .18; b.vx *= .99; b.vy *= .99; b.x += b.vx + Math.sin(b.tilt) * .6; b.y += b.vy; b.rot += b.vr; b.tilt += b.vt;
      cx.save(); cx.translate(b.x, b.y); cx.rotate(b.rot); cx.fillStyle = b.c;
      if (b.round) { cx.beginPath(); cx.arc(0, 0, b.w / 2, 0, 6.283); cx.fill(); } else { cx.scale(1, Math.cos(b.tilt)); cx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); }
      cx.restore(); }
    bits = bits.filter(b => b.y < innerHeight + 40); if (!bits.length) cx.clearRect(0, 0, innerWidth, innerHeight); }
  addEventListener('resize', () => { makeStars(); size(cc); });
  makeStars(); size(cc); drawStars(0);
  let lastStar = 0;
  (function frame(t) { if (!reduce && t - lastStar > 60) { drawStars(t); lastStar = t; } drawConfetti(); requestAnimationFrame(frame); })(0);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {}));
  }
})();
