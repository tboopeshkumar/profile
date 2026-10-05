(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const NOW = (() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); })();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- helpers ----------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v; // only used with trusted static SVG
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false || c === '') continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  // "2022-07" -> month index; null -> now
  const ym = (s) => {
    if (!s) return NOW;
    const [y, m] = String(s).split('-').map(Number);
    return y * 12 + ((m || 1) - 1);
  };
  const fmtYm = (s) => {
    if (!s) return 'Present';
    const [y, m] = String(s).split('-');
    return m ? `${MONTHS[+m - 1]} ${y}` : y;
  };
  // Inclusive month span, the way LinkedIn counts it.
  const span = (r) => ({ from: ym(r.start), to: ym(r.end) + 1 });
  function fmtDur(months) {
    const y = Math.floor(months / 12), m = months % 12;
    return [y && `${y} yr${y > 1 ? 's' : ''}`, m && `${m} mo${m > 1 ? 's' : ''}`].filter(Boolean).join(' ') || '1 mo';
  }
  // Union of month intervals so overlapping roles are not double counted.
  function unionMonths(intervals) {
    const sorted = intervals.slice().sort((a, b) => a.from - b.from);
    let total = 0, cur = null;
    for (const iv of sorted) {
      if (!cur || iv.from > cur.to) { if (cur) total += cur.to - cur.from; cur = { ...iv }; }
      else cur.to = Math.max(cur.to, iv.to);
    }
    return total + (cur ? cur.to - cur.from : 0);
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // "assets/CV.pdf?v=2" -> "CV.pdf"
  const fileName = (path) => path.split(/[?#]/)[0].split('/').pop();

  const ICONS = {
    download: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4zM4 7l8 6 8-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M9 9h10v10H9zM5 15V5h10"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75V21h-4z"/></svg>',
    github: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 5h18v14H3z"/><circle cx="9" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5.5 16.5c.6-1.6 1.9-2.4 3.5-2.4s2.9.8 3.5 2.4M15 10h3M15 13.5h3"/></svg>',
    arch: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 4h6v6H4zM14 14h6v6h-6zM14 4h6v6h-6zM7 10v7h7M17 10v4"/></svg>',
    lead: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 20c.8-3.4 3.2-5.2 6-5.2s5.2 1.8 6 5.2M16 5.2a3 3 0 0 1 0 5.6M18 14.5c1.6.7 2.6 2.4 3 5.5"/></svg>',
    fin: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20V4M4 20h16M7 15l4-4 3 3 5-6"/></svg>',
  };

  // ---------- UI bits ----------
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  const tip = $('tooltip');
  function showTip(target, content, evt) {
    tip.replaceChildren(...content);
    tip.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = evt && evt.clientX ? evt.clientX : r.left + r.width / 2;
    let y = r.top - th - 10;
    if (y < 72) y = r.bottom + 10;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x - tw / 2));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  window.addEventListener('scroll', hideTip, { passive: true });

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' }, text);
      document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    toast(`Copied ${text}`);
  }

  // Base64 of the profile photo for the vCard, or null if it can't be loaded.
  async function photoBase64(src) {
    if (!src) return null;
    try {
      const blob = await (await fetch(src)).blob();
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result); r.onerror = reject;
        r.readAsDataURL(blob);
      });
      return String(url).split(',')[1] || null;
    } catch (e) { return null; }
  }

  async function downloadVCard(b) {
    const [first, ...rest] = b.name.split(' ');
    const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1');
    // vCard lines must be folded at 75 characters; continuation lines start with a space.
    const fold = (line) => line.length <= 75 ? line : line.match(/.{1,74}/g).join('\r\n ');
    const current = (data.exps || []).find((e) => e.roles.some((r) => !r.end));
    const [city, ...country] = (b.location || '').split(',').map((s) => s.trim());
    // Plain URL entries show up as "homepage" in iOS Contacts; grouping each one
    // with an X-ABLabel gives it a proper label (LinkedIn, GitHub, Profile).
    const links = [...(b.links || []), { label: 'Profile', url: location.href.split(/[?#]/)[0] }];
    const photo = await photoBase64(b.photo);
    const lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${esc(rest.join(' '))};${esc(first)};;;`,
      `FN:${esc(b.name)}`,
      `TITLE:${esc(b.title)}`,
      current && `ORG:${esc(current.company)}`,
      b.email && `EMAIL;TYPE=INTERNET,WORK:${b.email}`,
      b.phone && `TEL;TYPE=CELL:${b.phone}`,
      `ADR;TYPE=WORK:;;;${esc(city)};;;${esc(country.join(', '))}`,
      ...links.flatMap((l, i) => [`item${i + 1}.URL:${l.url}`, `item${i + 1}.X-ABLabel:${esc(l.label)}`]),
      photo && `PHOTO;ENCODING=b;TYPE=JPEG:${photo}`,
      'END:VCARD',
    ].filter(Boolean).map(fold);
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/vcard' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${slug(b.name)}.vcf` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Contact card downloaded');
  }

  // Button with a static SVG icon and a text label (label set as text, never HTML).
  function iconBtn(tag, attrs, icon, label) {
    const node = el(tag, { ...attrs, html: icon || '' });
    node.append(el('span', null, label));
    return node;
  }

  function ctaButtons(b) {
    return [
      iconBtn('a', { class: 'btn btn-primary', href: `mailto:${b.email}` }, ICONS.mail, 'Email me'),
      b.cv ? iconBtn('a', { class: 'btn', href: b.cv, download: fileName(b.cv) }, ICONS.download, 'Download CV') : null,
      iconBtn('button', { class: 'btn', type: 'button', title: b.email, 'aria-label': `Copy email address ${b.email}`, onclick: () => copy(b.email) }, ICONS.copy, 'Copy email'),
      ...(b.links || []).map((l) => iconBtn('a', { class: 'btn', href: l.url, target: '_blank', rel: 'noopener' }, ICONS[l.label.toLowerCase()], l.label)),
      iconBtn('button', { class: 'btn', type: 'button', onclick: () => downloadVCard(b) }, ICONS.card, 'Save contact'),
    ].filter(Boolean);
  }

  // ---------- render ----------
  let state = { tech: null };
  let data, techIndex;

  function render(p) {
    data = p;
    const b = p.basics;
    const exps = p.experience.map((e) => ({ ...e, id: slug(e.short || e.company), spans: e.roles.map(span) }));
    data.exps = exps;

    // Basics
    document.title = `${b.name} · ${b.title}`;
    $('name').textContent = b.name;
    $('footer-name').textContent = b.name;
    $('brand').textContent = b.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
    $('location').textContent = b.location;
    if (b.photo) {
      const img = $('photo');
      img.addEventListener('error', () => img.remove(), { once: true });
      img.alt = `Photo of ${b.name}`;
      img.src = b.photo;
      img.hidden = false;
    }
    $('title').textContent = [b.title, ...(b.focus || [])].join(' · ');
    $('stack').textContent = b.stack || '';
    setupCv(b);
    $('cta').append(...ctaButtons(b));
    $('cta-contact').append(...ctaButtons(b));
    $('summary').textContent = b.summary;
    // Phones show a clamped summary with a toggle (see #summary.clamp in CSS).
    $('summary').classList.add('clamp');
    $('summary').after(el('button', {
      class: 'more more-summary', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'summary',
      onclick: (ev) => {
        const open = $('summary').classList.toggle('open');
        ev.currentTarget.setAttribute('aria-expanded', String(open));
        ev.currentTarget.textContent = open ? 'Show less' : 'Read more';
      },
    }, 'Read more'));
    $('year').textContent = new Date().getFullYear();
    $('stack').after(el('p', { class: 'print-contact' },
      [b.email, b.phone, ...(b.links || []).map((l) => l.url.replace(/^https?:\/\/(www\.)?/, ''))].filter(Boolean).join('  ·  ')));

    // Stats
    const allSpans = exps.flatMap((e) => e.spans);
    const totalM = unionMonths(allSpans);
    const finM = unionMonths(exps.filter((e) => e.domain === 'finance').flatMap((e) => e.spans));
    const current = exps.find((e) => e.roles.some((r) => !r.end));
    const orgM = current ? unionMonths(exps.filter((e) => e.short === current.short || e.client === current.short).flatMap((e) => e.spans)) : 0;
    const stats = [
      { n: Math.floor(totalM / 12), suffix: '+', label: 'years building software' },
      { n: Math.floor(finM / 12), suffix: '+', label: 'years in financial services' },
      current && { n: Math.floor(orgM / 12), suffix: '+', label: `years delivering for ${current.short}` },
      { n: exps.length, suffix: '', label: 'companies' },
    ].filter(Boolean);
    $('stats').append(...stats.map((s) => el('div', { class: 'stat' },
      el('dt', null, s.label),
      el('dd', null, el('span', { class: 'count', 'data-n': s.n }, reduceMotion ? s.n : 0), s.suffix ? el('small', null, s.suffix) : null))));
    // dt after dd visually: swap order for reading "16+ / years ..."
    $('stats').querySelectorAll('.stat').forEach((s) => s.append(s.firstChild));

    // Expertise
    const icons = [ICONS.arch, ICONS.lead, ICONS.fin];
    $('expertise').append(...(p.expertise || []).map((x, i) => el('article', { class: 'card exp-card reveal' },
      el('div', { class: 'ico', html: icons[i % icons.length] }),
      el('h3', null, x.title),
      el('ul', null, x.items.map((it) => el('li', null, it))))));

    // Tech index: tag -> companies that used it
    techIndex = new Map();
    for (const e of exps) {
      for (const t of e.tags || []) {
        if (!techIndex.has(t)) techIndex.set(t, { exps: [] });
        const ti = techIndex.get(t);
        ti.exps.push(e);
      }
    }

    // One failing section must not blank the rest of the page.
    safe('timeline', () => renderGantt(exps));
    safe('experience', () => renderJobs(exps));
    safe('skills', () => renderSkillGroups(p.skills || []));
    safe('education', () => renderTrio(p));

    // Deep link: ?tech=React
    safe('deep link', () => {
      const q = new URLSearchParams(location.search).get('tech');
      if (q && techIndex.has(q)) setTech(q, { silent: true });
    });
  }

  function safe(label, fn) {
    try { fn(); } catch (err) { console.error(`Could not render ${label}:`, err); }
  }

  function renderGantt(exps) {
    const g = $('gantt');
    const min = Math.min(...exps.flatMap((e) => e.spans.map((s) => s.from)));
    const startYear = Math.floor(min / 12);
    const endYear = Math.floor(NOW / 12) + 1;
    const lo = startYear * 12, hi = endYear * 12;
    const pct = (m) => ((m - lo) / (hi - lo)) * 100;

    const ticks = el('div', { class: 'g-ticks' });
    const grid = el('div', { class: 'g-grid', 'aria-hidden': 'true' });
    const step = endYear - startYear > 12 ? 2 : 1;
    for (let y = startYear; y <= endYear; y += step) {
      ticks.append(el('span', { class: 'g-tick', style: `left:${pct(y * 12)}%` }, `’${String(y).slice(2)}`));
      grid.append(el('span', { style: `left:${pct(y * 12)}%` }));
    }
    const axis = el('div', { class: 'g-axis', 'aria-hidden': 'true' }, el('span'), ticks);

    const body = el('div', { class: 'g-body' }, grid);
    for (const e of exps) {
      const track = el('div', { class: 'g-track' });
      e.roles.forEach((r, i) => {
        const s = e.spans[i];
        const isCurrent = !r.end;
        const nextStartsSame = e.roles.some((o, j) => j !== i && ym(o.start) === ym(r.end));
        const w = pct(s.to) - pct(s.from);
        const bar = el('button', {
          class: `g-bar${isCurrent ? '' : ' past'}`,
          type: 'button',
          'data-exp': e.id,
          style: `left:${pct(s.from)}%;width:calc(${w}% - ${nextStartsSame ? 2 : 0}px)`,
          'aria-label': `${r.title}, ${e.company}, ${fmtYm(r.start)} to ${fmtYm(r.end)}`,
          onclick: () => focusJob(e.id),
        });
        const content = () => [
          el('strong', null, r.title),
          el('div', null, e.company + (e.client ? ` · for ${e.client}` : '')),
          el('div', { class: 't-mono' }, `${fmtYm(r.start)} – ${fmtYm(r.end)} · ${fmtDur(s.to - s.from)}`),
        ];
        bar.addEventListener('pointermove', (ev) => showTip(bar, content(), ev));
        bar.addEventListener('focus', () => showTip(bar, content()));
        bar.addEventListener('pointerleave', hideTip);
        bar.addEventListener('blur', hideTip);
        track.append(bar);
      });
      body.append(el('div', { class: 'g-row', role: 'listitem' },
        el('span', { class: 'g-label', title: e.company }, e.short || e.company),
        track));
    }
    const nowMark = el('div', { class: 'g-now', style: `left:calc(var(--label) + (100% - var(--label)) * ${pct(NOW + 1) / 100})`, 'aria-hidden': 'true' }, el('span', null, 'Now'));
    body.append(nowMark);

    const legend = el('div', { class: 'g-legend' },
      el('span', null, el('i', { style: 'background:var(--accent)' }), 'Current role'),
      el('span', null, el('i', { style: 'background:color-mix(in srgb,var(--accent) 55%,var(--surface))' }), 'Previous roles'));
    g.append(axis, body, legend);
  }

  function jobCard(e) {
    const total = unionMonths(e.spans);
    const first = e.roles[e.roles.length - 1], last = e.roles[0];
    const multi = e.roles.length > 1;
    return el('li', { class: 'card job reveal', id: `job-${e.id}`, 'data-exp': e.id },
      el('div', { class: 'job-head' },
        el('h3', null, e.company, e.client ? el('span', { class: 'client' }, ` · for ${e.client}`) : null),
        el('span', { class: 'where' }, e.location)),
      el('ul', { class: 'roles' }, e.roles.map((r, i) => el('li', null,
        el('span', { class: 'role' }, r.title),
        el('span', { class: 'dates' }, `${fmtYm(r.start)} – ${fmtYm(r.end)}`,
          !multi ? el('b', null, ` · ${fmtDur(total)}`) : null)))),
      multi ? el('div', { class: 'dates', style: 'margin-top:2px' }, `${fmtDur(total)} in total, ${fmtYm(first.start)} – ${fmtYm(last.end)}`) : null,
      el('ul', { class: `bullets${e.highlights.length > 2 ? ' clamp' : ''}`, id: `bullets-${e.id}` }, e.highlights.map((h) => el('li', null, h))),
      // On phones only the first two bullets show until expanded (see .clamp in CSS).
      e.highlights.length > 2 ? el('button', {
        class: 'more', type: 'button', 'aria-expanded': 'false', 'aria-controls': `bullets-${e.id}`,
        onclick: (ev) => {
          const card = ev.currentTarget.closest('.job');
          const open = card.classList.toggle('open');
          ev.currentTarget.setAttribute('aria-expanded', String(open));
          ev.currentTarget.textContent = open ? 'Show less' : `Show ${e.highlights.length - 2} more`;
        },
      }, `Show ${e.highlights.length - 2} more`) : null,
      el('div', { class: 'tags' }, (e.tags || []).map((t) => el('button', {
        class: 'tag', type: 'button', 'data-tech': t, 'aria-label': `Filter by ${t}`, onclick: () => setTech(state.tech === t ? null : t),
      }, t))));
  }

  function renderJobs(exps) {
    $('jobs').append(...exps.filter((e) => !e.earlier).map(jobCard));
    const earlier = exps.filter((e) => e.earlier);
    if (earlier.length) $('jobs-earlier').append(...earlier.map(jobCard));
    else { $('earlier-head').remove(); $('jobs-earlier').remove(); }
  }

  function techChip(t, { jump = false } = {}) {
    return el('button', {
      class: 'chip', type: 'button', 'data-tech': t, 'aria-pressed': 'false',
      onclick: () => {
        const next = state.tech === t ? null : t;
        setTech(next);
        if (jump && next) $('experience').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      },
    }, t);
  }

  function renderSkillGroups(groups) {
    $('skill-groups').append(...groups.map((g) => el('div', { class: 'sg' },
      el('h3', null, g.group),
      el('div', { class: 'chips' }, g.items.map((s) => techIndex.has(s)
        ? techChip(s, { jump: true })
        : el('span', { class: 'chip static' }, s))))));
  }

  function renderTrio(p) {
    const cards = [];
    if (p.education?.length) cards.push(el('div', { class: 'card' }, el('h3', null, 'Education'),
      p.education.map((e) => el('div', null,
        el('div', { class: 'big' }, e.degree),
        el('p', null, e.school), el('p', { class: 'dates' }, [e.start, e.end].filter(Boolean).join(' – '))))));
    if (p.certifications?.length) cards.push(el('div', { class: 'card' }, el('h3', null, 'Certification'),
      p.certifications.map((c) => el('div', null, el('div', { class: 'big' }, c.name), c.authority ? el('p', { class: 'muted' }, c.authority) : null))));
    if (p.languages?.length) cards.push(el('div', { class: 'card' }, el('h3', null, 'Languages'),
      p.languages.map((l) => el('p', null, el('span', { class: 'big' }, l.name), el('span', { class: 'muted' }, ` · ${l.proficiency}`)))));
    $('trio').append(...cards);
  }

  // ---------- interactions ----------
  function setTech(t, { silent } = {}) {
    state.tech = t;
    const ti = t ? techIndex.get(t) : null;
    const ids = new Set(ti ? ti.exps.map((e) => e.id) : []);

    document.querySelectorAll('[data-tech]').forEach((n) => {
      const on = (n.dataset.tech || null) === t;
      if (n.hasAttribute('aria-pressed')) n.setAttribute('aria-pressed', String(on));
      n.classList.toggle('on', on && !n.hasAttribute('aria-pressed'));
    });
    document.querySelectorAll('.job').forEach((j) => {
      j.classList.toggle('dim', !!t && !ids.has(j.dataset.exp));
      j.classList.toggle('match', !!t && ids.has(j.dataset.exp));
    });
    document.querySelectorAll('.g-bar').forEach((b) => b.classList.toggle('dim', !!t && !ids.has(b.dataset.exp)));

    const res = $('filter-result');
    if (t) {
      res.replaceChildren(
        el('span', null, el('strong', null, t), ` · used at ${ti.exps.length} ${ti.exps.length === 1 ? 'company' : 'companies'}: ${ti.exps.map((e) => e.short || e.company).join(', ')}`),
        el('button', { type: 'button', onclick: () => setTech(null) }, 'Clear filter'));
      res.hidden = false;
    } else res.hidden = true;

    const url = new URL(location.href);
    if (t) url.searchParams.set('tech', t); else url.searchParams.delete('tech');
    history.replaceState(null, '', url);
    if (!silent && t) toast(`Showing roles with ${t}`);
  }

  function focusJob(id) {
    const card = $(`job-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
  }

  function animateCounts() {
    document.querySelectorAll('.count').forEach((c) => {
      const target = +c.dataset.n;
      if (reduceMotion) { c.textContent = target; return; }
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        c.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function setupReveal() {
    const items = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('in')); animateCounts(); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    items.forEach((i) => io.observe(i));
    animateCounts();
  }

  // Scroll spy + progress + top bar border
  function setupNav() {
    const links = [...document.querySelectorAll('.nav-links a')];
    const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - innerHeight;
      $('progress').style.transform = `scaleX(${h > 0 ? y / h : 0})`;
      $('topbar').classList.toggle('scrolled', y > 8);
      let active = -1;
      sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .35) active = i; });
      links.forEach((l, i) => l.classList.toggle('active', i === active));
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  // Theme + accent
  function setupTheme() {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const syncMeta = () => { meta.content = getComputedStyle(root).getPropertyValue('--accent').trim() || '#1d4f91'; };
    $('theme-toggle').addEventListener('click', () => {
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
      syncMeta();
    });
    const sw = document.querySelectorAll('.swatches button');
    const mark = () => sw.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.accent === root.dataset.accent)));
    sw.forEach((b) => b.addEventListener('click', () => {
      root.dataset.accent = b.dataset.accent;
      try { localStorage.setItem('accent', b.dataset.accent); } catch (e) {}
      mark(); syncMeta();
    }));
    mark(); syncMeta();
  }

  // CV: download the PDF from basics.cv, or fall back to the print layout.
  function setupCv(b) {
    const btn = $('cv-btn');
    if (b.cv) {
      btn.href = b.cv;
      btn.download = fileName(b.cv);
    } else {
      btn.removeAttribute('download');
      btn.addEventListener('click', (e) => { e.preventDefault(); window.print(); });
    }
  }

  // Esc clears the filter
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.tech) setTech(null); });

  setupTheme();
  setupNav();
  fetch('data/profile.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((p) => safe('profile', () => render(p)), (err) => {
      console.error(err);
      $('name').textContent = 'Profile unavailable';
    })
    .finally(setupReveal);
})();
