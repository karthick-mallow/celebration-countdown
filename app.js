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

  // ---------- occasions ----------
  // One entry per celebration. Fields:
  //   recurs: 'yearly' (every year on the date) | 'once' (that exact date)
  //   name:   { label, placeholder, required }
  //   date:   { label, when: 'past' | 'future', sample: [yearsAgo, daysAhead] }   or  fixed: 'MM-DD' (no date field)
  //   count:  { label, phrase(n) } | null   — yearly only; n = years since the date
  //   head(nm, c) -> [highlighted, rest]   cheer(nm, c)   cheerSub(n, nm, c)   (c = { year })
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const poss = (nm, noun) => nm ? [`${nm}'s`, noun] : ['Your', noun];
  const titled = (nm, noun) => nm ? [nm, ''] : ['Your', noun];
  const OCCASIONS = {
    birthday: {
      icon: "<path d='M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V9'/><path d='M12 9c-1 0-1.6-.8-1.6-1.7C10.4 6 12 4 12 4s1.6 2 1.6 3.3c0 .9-.6 1.7-1.6 1.7z'/>",
      label: 'Birthday', recurs: 'yearly',
      name: { label: 'Name', placeholder: 'e.g. Aarav', required: true },
      date: { label: 'Date of birth', when: 'past', sample: [30, 30] },
      count: { label: 'Show the age they are turning', phrase: n => `turning ${n}` },
      head: nm => poss(nm, 'birthday'),
      cheer: nm => nm ? `Happy Birthday, ${nm}!` : 'Happy Birthday!',
      cheerSub: n => n ? `Happy ${ord(n)}! The clock struck midnight.` : 'The clock struck midnight.'
    },
    anniversary: {
      icon: "<path d='M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z'/>",
      label: 'Anniversary', recurs: 'yearly',
      name: { label: 'Couple', placeholder: 'e.g. Priya & Arjun', required: true },
      date: { label: 'Wedding date', when: 'past', sample: [10, 30] },
      count: { label: 'Show the number of years', phrase: n => `${ord(n)} anniversary` },
      head: nm => poss(nm, 'anniversary'),
      cheer: nm => nm ? `Happy Anniversary, ${nm}!` : 'Happy Anniversary!',
      cheerSub: n => n ? `${n} ${n === 1 ? 'year' : 'years'} together.` : 'The clock struck midnight.'
    },
    wedding: {
      icon: "<circle cx='9' cy='14.5' r='5'/><circle cx='15' cy='14.5' r='5'/><path d='M13.3 5.5h3.4l1 1.4L15 9.5l-2.7-2.6z'/>",
      label: 'Wedding day', recurs: 'once',
      name: { label: 'Couple', placeholder: 'e.g. Priya & Arjun', required: true },
      date: { label: 'Wedding date', when: 'future', sample: [0, 45] },
      count: null,
      head: nm => poss(nm, 'wedding'),
      cheer: nm => nm ? `Congratulations, ${nm}!` : 'Congratulations!',
      cheerSub: () => 'The wedding day is here.'
    },
    newyear: {
      icon: "<path d='M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5'/><circle cx='12' cy='12' r='1.6'/>",
      label: 'New Year', recurs: 'yearly', fixed: '01-01',
      name: { label: 'From (optional)', placeholder: 'e.g. The Sharma family', required: false },
      count: null,
      head: (nm, c) => ['New Year', String(c.year || '')],
      cheer: (nm, c) => `Happy New Year${c.year ? ' ' + c.year : ''}!`,
      cheerSub: (n, nm) => nm ? `With love from ${nm}.` : 'The clock struck midnight.'
    },
    festival: {
      icon: "<path d='M3 14.5c0 2.8 4 4.5 9 4.5s9-1.7 9-4.5H3zM9 21.5h6'/><path d='M12 11.5c-1.3 0-2-1-2-2.2C10 7.6 12 5 12 5s2 2.6 2 4.3c0 1.2-.7 2.2-2 2.2z'/>",
      label: 'Festival', recurs: 'once',
      name: { label: 'Festival', placeholder: 'e.g. Diwali, Eid, Christmas, Pongal', required: true },
      date: { label: 'Festival date', when: 'future', sample: [0, 30] },
      count: null,
      head: nm => titled(nm, 'festival'),
      cheer: nm => nm ? `Happy ${nm}!` : 'Happy festival!',
      cheerSub: () => 'Let the celebrations begin.'
    },
    baby: {
      icon: "<path d='M5 4.5a7.5 7.5 0 0 1 7.5 7.5H5zM12.5 12H19M5 12a7 4.2 0 0 0 14 0M2.5 4.5H5'/><circle cx='8' cy='19.5' r='1.6'/><circle cx='16' cy='19.5' r='1.6'/>",
      label: 'Baby arrival', recurs: 'once',
      name: { label: 'Family or baby name', placeholder: 'e.g. Baby Iyer', required: true },
      date: { label: 'Due date', when: 'future', sample: [0, 60] },
      count: null,
      head: nm => poss(nm, 'due date'),
      cheer: () => 'Welcome, little one!',
      cheerSub: (n, nm) => nm ? `${nm}'s due date is here.` : 'The due date is here.'
    },
    graduation: {
      icon: "<path d='M2 9.5l10-5 10 5-10 5zM6 11.5v4.8c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.8M22 9.5v5.5'/>",
      label: 'Graduation', recurs: 'once',
      name: { label: 'Graduate', placeholder: 'e.g. Meera', required: true },
      date: { label: 'Graduation day', when: 'future', sample: [0, 40] },
      count: null,
      head: nm => poss(nm, 'graduation'),
      cheer: nm => nm ? `Congratulations, ${nm}!` : 'Congratulations, graduate!',
      cheerSub: () => 'Graduation day is here.'
    },
    retirement: {
      icon: "<path d='M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 7V4.5M6.3 10.3 4.6 8.6M17.7 10.3l1.7-1.7M8 21.5h8'/>",
      label: 'Retirement', recurs: 'once',
      name: { label: 'Name', placeholder: 'e.g. Ravi', required: true },
      date: { label: 'Retirement day', when: 'future', sample: [0, 50] },
      count: null,
      head: nm => poss(nm, 'retirement'),
      cheer: nm => nm ? `Happy Retirement, ${nm}!` : 'Happy Retirement!',
      cheerSub: () => 'The next chapter starts now.'
    },
    event: {
      icon: "<rect x='3.5' y='5' width='17' height='15.5' rx='2'/><path d='M3.5 10h17M8 3v4M16 3v4M12 12.5l1.1 2.2 2.4.4-1.75 1.7.4 2.4-2.15-1.15-2.15 1.15.4-2.4-1.75-1.7 2.4-.4z'/>",
      label: 'Custom event', recurs: 'once',
      name: { label: 'Event name', placeholder: 'e.g. Housewarming, Product launch', required: true },
      date: { label: 'Event date', when: 'future', sample: [0, 21] },
      count: null,
      head: nm => titled(nm, 'event'),
      cheer: nm => nm ? `It's here: ${nm}!` : "It's here!",
      cheerSub: () => 'The countdown is over.'
    }
  };
  const DEFAULT_OCC = 'birthday';
  const occOf = id => OCCASIONS[id] ? id : DEFAULT_OCC;
  const occ = () => OCCASIONS[cfg.o] || OCCASIONS[DEFAULT_OCC];
  const isoDate = t => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  function sampleDate(O) {
    if (O.fixed) return `2000-${O.fixed}`;
    const [yearsAgo, daysAhead] = O.date.sample;
    const t = new Date(Date.now() + daysAhead * 864e5);
    t.setFullYear(t.getFullYear() - yearsAgo);
    return isoDate(t);
  }
  const headText = (O, nm, c) => O.head(nm, c).filter(Boolean).join(' ');

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
      return { o: occOf(q.get('o')), n: (q.get('n') || '').slice(0, 40), d: q.get('d'), tz: validTz(q.get('tz')) ? q.get('tz') : LOCAL_TZ, age: q.get('a') !== '0', fromLink: true };
    }
    try {
      const s = JSON.parse(store.get('bdc.config') || 'null');
      if (s && validDate(s.d)) return { o: occOf(s.o), n: String(s.n || '').slice(0, 40), d: s.d, tz: validTz(s.tz) ? s.tz : LOCAL_TZ, age: s.age !== false };
    } catch {}
    return null;
  }
  function sampleConfig(o = DEFAULT_OCC) {
    return { o, n: '', d: sampleDate(OCCASIONS[o]), tz: LOCAL_TZ, age: true, sample: !OCCASIONS[o].fixed };
  }
  function shareUrl(c) {
    const q = new URLSearchParams();
    if (c.o !== DEFAULT_OCC) q.set('o', c.o);
    if (c.n.trim()) q.set('n', c.n.trim());
    q.set('d', c.d);
    q.set('tz', c.tz);
    if (!c.age) q.set('a', '0');
    return `${location.origin}${location.pathname}?${q.toString()}`;
  }

  // ?new=<occasion> (from the landing page) opens a blank setup with that occasion picked
  const startOcc = new URLSearchParams(location.search).get('new');
  let cfg = startOcc ? null : readConfig();
  let mode = cfg ? 'run' : 'setup';
  if (startOcc) { cfg = sampleConfig(occOf(startOcc)); try { history.replaceState(null, '', location.pathname); } catch {} }
  // A fresh setup starts by choosing the occasion; nothing occasion-specific shows until one is picked.
  let picked = mode === 'run' || !!startOcc;
  if (!cfg) cfg = sampleConfig();

  // ---------- date math ----------
  function occurrenceYMD(year) {
    let [, m, d] = (occ().fixed ? `2000-${occ().fixed}` : cfg.d).split('-').map(Number);
    m -= 1;
    if (m === 1 && d === 29 && !isLeap(year)) d = 28;
    return [year, m, d];
  }
  function nextOccurrence(now) {
    if (occ().recurs === 'once') {
      const [Y, M, D] = cfg.d.split('-').map(Number);
      const start = midnightIn(Y, M - 1, D, cfg.tz), end = midnightIn(Y, M - 1, D + 1, cfg.tz);
      return { target: start, year: Y, isToday: now >= start && now < end, passed: now >= end };
    }
    const yNow = zoned(now, cfg.tz).y;
    for (const y of [yNow - 1, yNow, yNow + 1]) {
      const [Y, M, D] = occurrenceYMD(y);
      const start = midnightIn(Y, M, D, cfg.tz);
      const end = midnightIn(Y, M, D + 1, cfg.tz);
      if (now < start) return { target: start, year: Y, isToday: false };
      if (now < end) return { target: start, year: Y, isToday: true };
    }
    const [Y, M, D] = occurrenceYMD(yNow + 2);
    return { target: midnightIn(Y, M, D, cfg.tz), year: Y, isToday: false };
  }

  // ---------- formatting ----------
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
    if (document.body.classList.contains('choosing')) { setTitle('Celebration Countdown'); return; }
    const now = Date.now();
    const nm = displayName();
    const O = occ();
    let target, isToday, year, passed = false, rehearsing = false;

    if (rehearsalEnd) {
      rehearsing = true;
      target = rehearsalEnd;
      isToday = now >= target;
      year = null;
    } else {
      ({ target, isToday, year, passed = false } = nextOccurrence(now));
    }

    const c = { year: rehearsing ? null : year };
    const [hi, rest] = O.head(nm, c);
    $('hName').textContent = hi; $('hOcc').textContent = rest || '';
    const heading = headText(O, nm, c);
    const by = +cfg.d.slice(0, 4);
    const age = cfg.age && O.count && year && O.recurs === 'yearly' ? year - by : null;
    const showAge = age && age > 0 && age < 150;
    // Compare wall clocks, not names (Asia/Calcutta and Asia/Kolkata are the same zone)
    const zA = zoned(target, cfg.tz), zB = zoned(target, LOCAL_TZ);
    const crossTz = zA.d !== zB.d || zA.h !== zB.h || zA.mi !== zB.mi;

    if (isToday) {
      const key = rehearsing ? 'rehearsal' : `${cfg.d}|${cfg.tz}|${year}`;
      $('clock').hidden = true;
      $('celebrate').hidden = false;
      $('eyebrow').textContent = rehearsing ? 'Rehearsal' : "It's the day";
      $('cheer').textContent = O.cheer(nm, c);
      $('cheerSub').textContent = O.cheerSub(showAge && !rehearsing ? age : null, nm, c);
      $('sub').innerHTML = rehearsing ? 'That was a practice run.' : `Today, <strong>${esc(fmtDate(target, cfg.tz))}</strong>`;
      if (celebratedFor !== key) { celebratedFor = key; celebrate(); }
      setTitle(O.cheer(nm, c));
      if (rehearsing && now - target > 15000) { rehearsalEnd = null; celebratedFor = null; }
      return;
    }

    if (passed) {
      $('clock').hidden = true; $('celebrate').hidden = true;
      $('eyebrow').textContent = 'Already celebrated';
      $('sub').innerHTML = `This was on <strong>${esc(fmtDate(target, cfg.tz))}</strong>. Edit to set a new date.`;
      setTitle(heading);
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
      if (showAge) html += ` · ${esc(O.count.phrase(age))}`;
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
    setTitle(`${days ? days + 'd ' : ''}${pad(hrs)}:${pad(mins)}:${pad(secs)} · ${heading}`);
  }
  function setTitle(t) { if (t !== lastTitle) { document.title = t; lastTitle = t; } }

  // ---------- views ----------
  function applyMode() {
    const run = mode === 'run';
    document.body.classList.toggle('choosing', !run && !picked);
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
  const getOcc = () => occOf(($('setup').querySelector('input[name=occ]:checked') || {}).value);
  function setOcc(id) { const r = $('setup').querySelector(`input[name=occ][value="${id}"]`); if (r) r.checked = true; }
  function fillOccTiles() {
    const ids = Object.keys(OCCASIONS);
    $('occWrap').hidden = ids.length < 2;
    $('occTiles').innerHTML = ids.map(id => `<label class="tile"><input type="radio" name="occ" value="${id}" id="occ-${id}"><span><svg viewBox="0 0 24 24" aria-hidden="true">${OCCASIONS[id].icon}</svg>${esc(OCCASIONS[id].label)}</span></label>`).join('');
  }
  function applyOccLabels() {
    const O = OCCASIONS[getOcc()];
    $('nameLbl').textContent = O.name.label; $('nameIn').placeholder = O.name.placeholder;
    $('dateIn').closest('label').hidden = !!O.fixed;
    if (O.date) {
      $('dateLbl').textContent = O.date.label;
      const today = isoDate(new Date());
      $('dateIn').min = O.date.when === 'future' ? today : '1900-01-01';
      $('dateIn').max = O.date.when === 'past' ? today : '2200-12-31';
    }
    $('ageIn').closest('label').hidden = !O.count;
    if (O.count) $('ageLbl').textContent = O.count.label;
  }
  function loadForm() {
    if (picked) setOcc(cfg.o);
    else $('setup').querySelectorAll('input[name=occ]').forEach(r => { r.checked = false; });
    applyOccLabels();
    $('nameIn').value = cfg.sample ? '' : cfg.n;
    $('dateIn').value = cfg.sample || OCCASIONS[cfg.o].fixed ? '' : cfg.d;
    $('tzIn').value = cfg.tz;
    $('ageIn').checked = cfg.age;
  }
  function formPreview() {
    const o = getOcc(), O = OCCASIONS[o];
    applyOccLabels();
    const d = $('dateIn').value;
    const base = O.fixed ? { d: sampleDate(O), sample: false }
      : validDate(d) ? { d, sample: false } : { d: sampleDate(O), sample: true };
    cfg = { o, n: $('nameIn').value.slice(0, 40), tz: $('tzIn').value || LOCAL_TZ, age: $('ageIn').checked, ...base };
    if (cfg.n.trim()) cfg.sample = false;
    celebratedFor = null;
    $('formErr').textContent = '';
    render();
  }
  ['input', 'change'].forEach(ev => $('setup').addEventListener(ev, formPreview));
  $('occTiles').addEventListener('change', () => {
    if (!picked) { picked = true; applyMode(); scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); } if (!$('nameIn').value.trim()) $('nameIn').focus({ preventScroll: true }); });
  $('setup').addEventListener('submit', e => {
    e.preventDefault();
    const o = getOcc(), O = OCCASIONS[o];
    const n = $('nameIn').value.trim();
    const d = O.fixed ? sampleDate(O) : $('dateIn').value;
    const err = (msg, el) => { $('formErr').textContent = msg; el.focus(); };
    if (O.name.required && !n) return err(`Fill in “${O.name.label}”.`, $('nameIn'));
    if (!validDate(d)) return err(`Pick the ${O.date.label.toLowerCase()} from the calendar.`, $('dateIn'));
    if (O.date && O.date.when === 'future' && d < isoDate(new Date())) return err(`The ${O.date.label.toLowerCase()} has passed. Pick today or a later date.`, $('dateIn'));
    cfg = { o, n, d, tz: $('tzIn').value || LOCAL_TZ, age: $('ageIn').checked };
    store.set('bdc.config', JSON.stringify(cfg));
    try { history.replaceState(null, '', shareUrl(cfg)); } catch {}
    mode = 'run'; celebratedFor = null; applyMode(); render();
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  $('newCd').addEventListener('click', () => {
    cfg = sampleConfig(); mode = 'setup'; picked = false; celebratedFor = null; rehearsalEnd = null;
    loadForm(); $('nameIn').value = ''; $('dateIn').value = '';
    applyMode(); render();
    try { history.replaceState(null, '', location.pathname); } catch {}
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
  $('edit').addEventListener('click', () => {
    mode = 'setup'; picked = true; loadForm(); applyMode(); render();
    $('nameIn').focus();
  });

  // ---------- share ----------
  async function share() {
    const url = shareUrl(cfg);
    $('shareUrl').value = url;
    $('shareBox').hidden = false;
    $('copyMsg').innerHTML = '&nbsp;';
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: document.title, text: `Countdown to ${headText(occ(), displayName(), { year: nextOccurrence(Date.now()).year })}`, url }); return; } catch {}
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
  fillOccTiles();
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
    // Reload once when a new version takes over, so returning visitors never sit on an old build.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false, touched = false;
    ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { touched = true; }, { once: true, capture: true }));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Never reload under someone who is already using the page; they get the new version next visit.
      if (!hadController || reloaded || touched || document.body.classList.contains('stage')) return;
      reloaded = true; location.reload();
    });
    addEventListener('load', () => navigator.serviceWorker.register('../sw.js', { scope: '../', updateViaCache: 'none' })
      .then(r => r.update()).catch(() => {}));
  }

  // test hook (no effect on users)
  window.__bdc = { midnightIn, zoned, nextOccurrence: (t, c) => { const old = cfg; cfg = { o: DEFAULT_OCC, ...c }; const r = nextOccurrence(t); cfg = old; return r; } };
})();
