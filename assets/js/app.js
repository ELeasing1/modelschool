/* SELF • SENSE — сайт модельного агентства и школы моделей
   Весь контент берётся из content/content.json (редактируется через /admin/) */
(() => {
'use strict';

/* ---------- утилиты ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
const plain = s => String(s ?? '').replace(/\*/g, '').replace(/\[img:[^\]]+\]/g, '');
const thumb = src => (src && src.startsWith('media/img/')) ? src.replace('media/img/', 'media/thumb/') : src;
const pad = n => String(n).padStart(2, '0');
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => innerWidth > 1024;
const plural = (n, f) => { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return f[2]; if (n1 > 1 && n1 < 5) return f[1]; if (n1 === 1) return f[0]; return f[2]; };
const ageOf = y => { const a = new Date().getFullYear() - Number(y); return isFinite(a) && a > 0 && a < 120 ? a : null; };
const ageStr = y => { const a = ageOf(y); return a ? `${a} ${plural(a, ['год', 'года', 'лет'])}` : ''; };
const toArr = v => Array.isArray(v) ? v : [];
const has = v => v !== undefined && v !== null && String(v).trim() !== '';

let C = null;          // контент
let lenis = null;      // плавный скролл
let velocity = 0;      // скорость скролла
const state = { cat: 'all', gender: 'all', q: '', modelIndex: -1, filtered: [] };

/* ---------- загрузка контента ---------- */
async function loadContent() {
  const params = new URLSearchParams(location.search);
  if (params.has('preview')) {
    try { const d = localStorage.getItem('ss_preview'); if (d) return JSON.parse(d); } catch (e) { /* ignore */ }
  }
  const res = await fetch('content/content.json?v=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' });
  if (!res.ok) throw new Error('content.json not found');
  return res.json();
}

/* ---------- общие фрагменты разметки ---------- */
let labelIndex = 0;
const label = text => text ? `<div class="label" data-reveal><span class="label__num">(${pad(++labelIndex)})</span><span class="label__txt">${esc(text)}</span></div>` : '';
const btn = (b, cls = 'btn--accent', extra = '') => b && b.label ? `<a href="${esc(b.href || '#apply')}" class="btn ${cls} magnetic" data-scroll-to ${extra}><span data-text="${esc(b.label)}">${esc(b.label)}</span></a>` : '';
const img = (src, alt = '', cls = '', lazy = true, useThumb = false) => src ? `<img src="${esc(useThumb ? thumb(src) : src)}" alt="${esc(alt)}" class="${cls}" ${lazy ? 'loading="lazy" decoding="async"' : 'decoding="async"'}>` : '';
const video = (v, cls = '', eager = false) => v && v.src ? `<video class="${cls}" muted loop playsinline ${eager ? 'autoplay preload="auto"' : 'preload="none"'} ${eager ? `src="${esc(v.src)}"` : `data-src="${esc(v.src)}"`} poster="${esc(v.poster || '')}" data-autoplay></video>` : '';

/* ---------- секции ---------- */
const T = {};

T.hero = h => {
  const s = C.settings || {};
  const vids = toArr(h.videos);
  const chars = w => [...String(w || '')].map(c => `<span class="ch">${esc(c)}</span>`).join('');
  return `
  <section class="s s-hero" id="top" data-theme="dark">
    <div class="hero__stage">
      <div class="hero__media">
        <div class="hero__vid hero__vid--l"><div class="hero__in">${video(vids[0], '', true)}</div></div>
        <div class="hero__vid hero__vid--c"><div class="hero__in">${video(vids[1] || vids[0], '', true)}</div></div>
        <div class="hero__vid hero__vid--r"><div class="hero__in">${video(vids[2] || vids[0], '', true)}</div></div>
      </div>
      <div class="hero__shade"></div>
      <h1 class="hero__title" aria-label="${esc(s.brandLeft)} ${esc(s.brandRight)}">
        <span class="hero__word hero__word--l"><span class="hero__mask">${chars(s.brandLeft)}</span></span>
        <span class="hero__dot"><i></i></span>
        <span class="hero__word hero__word--r"><span class="hero__mask">${chars(s.brandRight)}</span></span>
      </h1>
      <div class="hero__top">
        <span class="hero__kicker hero__fade">${esc(h.kicker)}</span>
        ${has(h.tagline) ? `<span class="hero__year hero__fade">${esc(h.tagline)}</span>` : ''}
      </div>
      <div class="hero__bottom">
        <p class="hero__sub hero__fade">${rich(h.subtitle)}</p>
        <div class="hero__ctas hero__fade">${btn(h.cta, 'btn--light', 'data-prefill="trial"')}${btn(h.cta2, 'btn--ghost-light')}</div>
        <div class="hero__note hero__fade">${esc(h.note)}</div>
      </div>
      <div class="hero__scroll hero__fade" aria-hidden="true"><span>Scroll</span><i></i></div>
    </div>
  </section>`;
};

T.manifesto = m => {
  const parts = String(m.text || '').split(/(\[img:[^\]]+\]|\*[^*]+\*)/g).filter(Boolean);
  const words = parts.map(p => {
    if (p.startsWith('[img:')) { const src = p.slice(5, -1).trim(); return `<span class="mf-img"><img src="${esc(thumb(src))}" alt="" loading="lazy"></span>`; }
    if (p.startsWith('*') && p.endsWith('*')) return p.slice(1, -1).split(/\s+/).filter(Boolean).map(w => `<span class="mw mw--em">${esc(w)}</span>`).join(' ');
    return p.split(/\s+/).filter(Boolean).map(w => `<span class="mw">${esc(w)}</span>`).join(' ');
  }).join(' ');
  return `
  <section class="s s-manifesto" id="manifesto" data-theme="light">
    <div class="container">
      ${label(m.label)}
      <p class="manifesto__text">${words}</p>
      <div class="manifesto__sig" data-reveal><i></i><span>${esc(m.signature)}</span></div>
    </div>
  </section>`;
};

T.values = v => `
  <section class="s s-values" id="values" data-theme="light">
    <div class="container values__head">
      ${label(v.label)}
      <h2 class="h2" data-split>${rich(v.title)}</h2>
    </div>
    <div class="values__stack">
      ${toArr(v.items).map((it, i) => `
        <article class="vcard vcard--${i % 3}" style="--i:${i}">
          <div class="vcard__inner">
            <div class="vcard__dim"></div>
            <div class="vcard__media">${img(it.image, it.title)}</div>
            <div class="vcard__body">
              <div class="vcard__num">${pad(i + 1)}<span>/${pad(toArr(v.items).length)}</span></div>
              <h3 class="vcard__title">${esc(it.title)}</h3>
              <p class="vcard__text">${esc(it.text)}</p>
            </div>
          </div>
        </article>`).join('')}
    </div>
  </section>`;

T.marquee = m => {
  const items = toArr(m.items), imgs = toArr(m.images);
  const seq = items.map((t, i) => `<span class="mq__item">${esc(t)}</span>${imgs.length ? `<span class="mq__img">${img(imgs[i % imgs.length], '', '', true, true)}</span>` : '<span class="mq__star">✦</span>'}`).join('');
  const seq2 = items.slice().reverse().map(t => `<span class="mq__item">${esc(t)}</span><span class="mq__star">✦</span>`).join('');
  return `
  <section class="s s-marquee" data-theme="light" aria-label="${esc(items.join(', '))}">
    <div class="mq" data-dir="-1" data-speed="0.6"><div class="mq__track">${seq}${seq}</div></div>
    <div class="mq mq--outline" data-dir="1" data-speed="0.45"><div class="mq__track">${seq2}${seq2}</div></div>
  </section>`;
};

T.audience = a => `
  <section class="s s-audience" id="audience" data-theme="light">
    <div class="container">
      <div class="sec-head">
        ${label(a.label)}
        <h2 class="h2" data-split>${rich(a.title)}</h2>
      </div>
      <div class="aud">
        ${toArr(a.items).map((it, i) => `
          <article class="aud__item ${it.image ? '' : 'aud__item--accent'}" data-cursor="${it.image ? '' : '60+'}">
            <div class="aud__media">${it.image ? img(it.image, it.title) : `<div class="aud__ghost">${esc(it.age)}</div>`}</div>
            <div class="aud__shade"></div>
            <div class="aud__age">${esc(it.age)}</div>
            <div class="aud__info">
              <span class="aud__idx">${pad(i + 1)}</span>
              <h3>${esc(it.title)}</h3>
              <p>${esc(it.text)}</p>
            </div>
          </article>`).join('')}
      </div>
    </div>
  </section>`;

T.courses = c => {
  const items = toArr(c.items);
  return `
  <section class="s s-courses" id="courses" data-theme="wine">
    <div class="courses__pin">
      <div class="courses__track">
        <div class="courses__intro">
          ${label(c.label)}
          <h2 class="h2 h2--xl" data-split>${rich(c.title)}</h2>
          <p class="lead" data-reveal>${esc(c.text)}</p>
          <div class="courses__hint" data-reveal><span>Листайте</span><i></i></div>
        </div>
        ${items.map((it, i) => `
        <article class="course" data-course="${esc(it.id)}">
          <div class="course__media">
            <div class="course__img">${img(it.image, it.title)}</div>
            ${it.image2 ? `<div class="course__img2">${img(it.image2, it.title, '', true, true)}</div>` : ''}
            <div class="course__bignum">${pad(i + 1)}</div>
          </div>
          <div class="course__body">
            <div class="course__tag">${esc(it.tag)}</div>
            <h3 class="course__title">${esc(it.title)}</h3>
            <dl class="course__meta">
              ${has(it.duration) ? `<div><dt>Длительность</dt><dd>${esc(it.duration)}</dd></div>` : ''}
              ${has(it.hours) ? `<div><dt>Объём</dt><dd>${esc(it.hours)}</dd></div>` : ''}
              ${has(it.start) ? `<div><dt>Старт</dt><dd>${esc(it.start)}</dd></div>` : ''}
            </dl>
            ${toArr(it.program).length ? `<div class="course__block"><h4>В программе</h4><ul class="chips">${toArr(it.program).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
            ${toArr(it.included).length ? `<div class="course__block"><h4>Входит в курс</h4><ul class="checks">${toArr(it.included).map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
            ${has(it.bonus) ? `<div class="course__bonus"><span>Бонус</span>${esc(it.bonus)}</div>` : ''}
            <div class="course__foot">
              <div class="course__price">
                ${has(it.priceMonth) ? `<div><b>${esc(it.priceMonth)}</b><span>${esc(it.priceMonthLabel)}</span></div>` : ''}
                ${has(it.priceFull) ? `<div><b>${esc(it.priceFull)}</b><span>${esc(it.priceFullLabel)}</span></div>` : ''}
              </div>
              <a href="#apply" class="btn btn--light magnetic" data-scroll-to data-prefill="trial" data-course="${esc(it.id)}"><span data-text="Записаться">Записаться</span></a>
            </div>
          </div>
        </article>`).join('')}
      </div>
      <div class="courses__ui">
        <div class="courses__count"><span class="courses__cur">01</span> / ${pad(items.length)}</div>
        <div class="courses__progress"><i></i></div>
      </div>
    </div>
  </section>`;
};

T.disciplines = d => `
  <section class="s s-disc" id="disciplines" data-theme="light">
    <div class="container">
      <div class="sec-head sec-head--row">
        <div>${label(d.label)}<h2 class="h2" data-split>${rich(d.title)}</h2></div>
        <p class="sec-head__aside" data-reveal>${toArr(d.items).length} ${plural(toArr(d.items).length, ['дисциплина', 'дисциплины', 'дисциплин'])} — один путь к себе</p>
      </div>
      <ul class="disc">
        ${toArr(d.items).map((it, i) => `
          <li class="disc__row" data-img="${esc(thumb(it.image))}">
            <span class="disc__line"></span>
            <span class="disc__num">${pad(i + 1)}</span>
            <span class="disc__title"><span>${esc(it.title)}</span></span>
            <span class="disc__text">${esc(it.text)}</span>
            ${it.image ? `<span class="disc__thumb">${img(it.image, it.title, '', true, true)}</span>` : ''}
            <span class="disc__arrow">↗</span>
          </li>`).join('')}
      </ul>
    </div>
    <div class="disc__float" aria-hidden="true"><div class="disc__float-in"></div></div>
  </section>`;

T.stats = s => `
  <section class="s s-stats" data-theme="light">
    <div class="container stats">
      ${toArr(s.items).map((it, i) => {
        const num = /^\d+$/.test(String(it.value).trim());
        return `<div class="stat" data-reveal style="--d:${i * 0.08}s">
          <div class="stat__val">${num ? `<span class="count" data-to="${esc(it.value)}">0</span>` : `<span>${esc(it.value)}</span>`}<span class="stat__suf">${esc(it.suffix)}</span></div>
          <p class="stat__label">${esc(it.label)}</p>
        </div>`;
      }).join('')}
    </div>
  </section>`;

T.runway = r => `
  <section class="s s-runway" id="runway" data-theme="dark">
    <div class="container runway">
      <div class="runway__text">
        ${label(r.label)}
        <h2 class="h2 h2--xxl" data-split>${rich(r.title)}</h2>
        <p class="lead" data-reveal>${esc(r.text)}</p>
        ${btn({ label: 'Записаться на пробный урок', href: '#apply' }, 'btn--light', 'data-prefill="trial"')}
      </div>
      <div class="runway__media">
        <div class="runway__v1" data-reveal-img>${video({ src: r.video, poster: r.poster })}</div>
        ${r.video2 ? `<div class="runway__v2" data-parallax="-0.25">${video({ src: r.video2, poster: r.poster2 })}</div>` : ''}
        <div class="runway__tag"><span>Live</span> Выпускной показ</div>
      </div>
    </div>
  </section>`;

T.zoom = z => `
  <section class="s s-zoom" data-theme="light">
    <div class="zoom__pin">
      <div class="zoom__frame">${img(z.image, plain(z.caption), '', false)}<div class="zoom__veil"></div></div>
      <div class="zoom__title" aria-hidden="true"><span class="zl">${esc(z.titleLeft)}</span><span class="zr">${esc(z.titleRight)}</span></div>
      <p class="zoom__cap">${rich(z.caption)}</p>
    </div>
  </section>`;

T.catalog = c => {
  const models = toArr(c.models);
  const cats = toArr(c.categories);
  const count = id => id === 'all' ? models.length : models.filter(m => m.category === id).length;
  return `
  <section class="s s-catalog" id="catalog" data-theme="light">
    <div class="container">
      <div class="sec-head sec-head--row">
        <div>${label(c.label)}<h2 class="h2" data-split>${rich(c.title)}</h2></div>
        <p class="sec-head__aside" data-reveal>${esc(c.text)}</p>
      </div>
      <div class="cat__bar" data-reveal>
        <div class="cat__tabs" role="tablist" aria-label="Категории">
          <button class="cat__tab is-active" data-cat="all" role="tab">Все<sup>${count('all')}</sup></button>
          ${cats.map(k => `<button class="cat__tab" data-cat="${esc(k.id)}" role="tab">${esc(k.label)}<sup>${count(k.id)}</sup></button>`).join('')}
          <span class="cat__ind"></span>
        </div>
        <div class="cat__tools">
          <div class="seg" role="group" aria-label="Пол">
            <button class="is-active" data-gender="all">Все</button><button data-gender="f">Девушки</button><button data-gender="m">Юноши</button>
          </div>
          <label class="cat__search"><input type="search" placeholder="Поиск по имени" aria-label="Поиск по имени"><span>⌕</span></label>
        </div>
      </div>
      <div class="cat__grid" id="catGrid"></div>
      <div class="cat__empty" id="catEmpty" hidden>
        <div class="cat__empty-big">${esc((cats.find(k => k.id === 'senior') || {}).range || '60+')}</div>
        <h3>${esc(c.emptyTitle)}</h3>
        <p>${esc(c.emptyText)}</p>
        <a href="#apply" class="btn btn--accent magnetic" data-scroll-to data-prefill="base"><span data-text="Подать заявку">Подать заявку</span></a>
      </div>
    </div>
  </section>`;
};

T.campaigns = c => {
  const items = toArr(c.items);
  const cols = isDesktop() ? 4 : 2;
  const colArr = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => colArr[i % cols].push({ ...it, i }));
  const brands = toArr(c.brands).map(b => `<span class="mq__item">${esc(b)}</span><span class="mq__star">✦</span>`).join('');
  return `
  <section class="s s-camp" id="campaigns" data-theme="dark">
    <div class="container">
      <div class="sec-head sec-head--row">
        <div>${label(c.label)}<h2 class="h2" data-split>${rich(c.title)}</h2></div>
        <p class="sec-head__aside" data-reveal>${esc(c.text)}</p>
      </div>
    </div>
    ${brands ? `<div class="mq mq--brands" data-dir="-1" data-speed="0.5"><div class="mq__track">${brands}${brands}${brands}</div></div>` : ''}
    <div class="camp__cols" style="--cols:${cols}">
      ${colArr.map((col, ci) => `<div class="camp__col" data-col="${ci}">${col.map(it => `
        <figure class="camp__item" data-lb="campaigns" data-index="${it.i}" data-cursor="Открыть">
          ${img(it.image, it.brand, '', true, true)}
          <figcaption>${esc(it.brand)}</figcaption>
        </figure>`).join('')}</div>`).join('')}
    </div>
  </section>`;
};

T.portfolio = p => {
  const vids = toArr(p.videos), imgs = toArr(p.images);
  const media = [];
  const max = Math.max(vids.length, imgs.length);
  for (let i = 0; i < max; i++) {
    if (vids[i]) media.push(`<div class="port__card port__card--video" data-reveal-img>${video(vids[i])}<span class="port__rec"><i></i>Backstage</span></div>`);
    if (imgs[i]) media.push(`<div class="port__card" data-reveal-img data-lb="portfolio" data-index="${i}" data-cursor="Открыть">${img(imgs[i], 'Портфолио', '', true)}</div>`);
  }
  const half = Math.ceil(media.length / 2);
  return `
  <section class="s s-portfolio" id="portfolio" data-theme="light">
    <div class="container port">
      <div class="port__sticky">
        ${label(p.label)}
        <h2 class="h2" data-split>${rich(p.title)}</h2>
        <p class="lead" data-reveal>${esc(p.text)}</p>
        <ol class="port__list">
          ${toArr(p.features).map((f, i) => `<li data-reveal style="--d:${i * 0.06}s"><span>${pad(i + 1)}</span><div><b>${esc(f.title)}</b><p>${esc(f.text)}</p></div></li>`).join('')}
        </ol>
        <div class="port__foot" data-reveal>
          ${has(p.price) ? `<div class="port__price">${esc(p.price)}</div>` : ''}
          ${btn(p.cta, 'btn--accent', 'data-prefill="shoot"')}
        </div>
      </div>
      <div class="port__media">
        <div class="port__col">${media.slice(0, half).join('')}</div>
        <div class="port__col port__col--offset" data-parallax="-0.12">${media.slice(half).join('')}</div>
      </div>
    </div>
  </section>`;
};

T.promotion = p => `
  <section class="s s-promo" id="promotion" data-theme="wine">
    <div class="container promo">
      <div class="promo__head">
        ${label(p.label)}
        <h2 class="h2 h2--xl" data-split>${rich(p.title)}</h2>
        <p class="lead" data-reveal>${esc(p.text)}</p>
        <div class="promo__meta" data-reveal>
          ${has(p.format) ? `<span>${esc(p.format)}</span>` : ''}
          ${has(p.price) ? `<span>${esc(p.price)}</span>` : ''}
        </div>
        ${btn(p.cta, 'btn--light', 'data-prefill="online"')}
      </div>
      <div class="promo__visual">
        ${p.image ? `<div class="promo__img" data-reveal-img>${img(p.image, 'Онлайн-продвижение')}</div>` : ''}
        ${p.image2 ? `<div class="promo__img2" data-parallax="-0.3">${img(p.image2, '', '', true, true)}</div>` : ''}
        <div class="promo__stamp" aria-hidden="true"><svg viewBox="0 0 200 200"><defs><path id="circ" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs><text><textPath href="#circ">ОНЛАЙН • ИЗ ЛЮБОГО ГОРОДА • ОНЛАЙН • ИЗ ЛЮБОГО ГОРОДА • </textPath></text></svg><i>✦</i></div>
      </div>
      <div class="promo__steps">
        <div class="promo__line"><i></i></div>
        <ol>
          ${toArr(p.steps).map((s, i) => `
            <li class="step">
              <span class="step__dot"></span>
              <span class="step__num">Шаг ${pad(i + 1)}</span>
              <h3 class="step__title">${esc(s.title)}</h3>
              <p class="step__text">${esc(s.text)}</p>
            </li>`).join('')}
        </ol>
      </div>
    </div>
  </section>`;

T.services = s => `
  <section class="s s-services" id="services" data-theme="light">
    <div class="container">
      <div class="sec-head">
        ${label(s.label)}
        <h2 class="h2" data-split>${rich(s.title)}</h2>
      </div>
      <div class="svc">
        ${toArr(s.items).map((it, i) => `
          <article class="svc__card tilt" data-reveal style="--d:${i * 0.1}s">
            <div class="svc__media">${img(it.image, it.title, '', true, true)}</div>
            <div class="svc__body">
              <span class="svc__num">${pad(i + 1)}</span>
              <h3>${esc(it.title)}</h3>
              <p>${esc(it.text)}</p>
            </div>
          </article>`).join('')}
      </div>
    </div>
  </section>`;

T.senior = s => `
  <section class="s s-senior" id="senior" data-theme="light">
    <div class="senior__big" aria-hidden="true">
      <div class="senior__row sr1"><span>${esc(s.big1)}</span><span class="o">${esc(s.big2)}</span><span>${esc(s.big1)}</span><span class="o">${esc(s.big2)}</span></div>
      <div class="senior__row sr2"><span class="o">${esc(s.big2)}</span><span>${esc(s.big1)}</span><span class="o">${esc(s.big2)}</span><span>${esc(s.big1)}</span></div>
    </div>
    <div class="container senior__body">
      ${label(s.label)}
      <h2 class="h2" data-split>${rich(s.title)}</h2>
      <p class="lead" data-reveal>${esc(s.text)}</p>
      ${btn(s.cta, 'btn--accent', 'data-prefill="base"')}
    </div>
  </section>`;

T.gallery = g => {
  const rows = [toArr(g.row1), toArr(g.row2), toArr(g.row3)].filter(r => r.length);
  let n = 0;
  return `
  <section class="s s-gallery" id="gallery" data-theme="dark">
    <div class="container">
      <div class="sec-head">
        ${label(g.label)}
        <h2 class="h2" data-split>${rich(g.title)}</h2>
      </div>
    </div>
    <div class="gal">
      ${rows.map((r, ri) => `<div class="gal__row" data-row="${ri}">${r.concat(r).map((src, i) => `<figure class="gal__item" data-lb="gallery" data-index="${i < r.length ? n + i : n + i - r.length}" data-cursor="Открыть">${img(src, '', '', true, true)}</figure>`).join('')}</div>${(() => { n += r.length; return ''; })()}`).join('')}
    </div>
  </section>`;
};

T.faq = f => `
  <section class="s s-faq" id="faq" data-theme="light">
    <div class="container faq">
      <div class="faq__head">
        ${label(f.label)}
        <h2 class="h2" data-split>${rich(f.title)}</h2>
      </div>
      <div class="faq__list">
        ${toArr(f.items).map((it, i) => `
          <div class="faq__item" data-reveal>
            <button class="faq__q" aria-expanded="false"><span class="faq__n">${pad(i + 1)}</span><span class="faq__t">${esc(it.q)}</span><span class="faq__pm"></span></button>
            <div class="faq__a"><div class="faq__a-in"><p>${rich(it.a)}</p></div></div>
          </div>`).join('')}
      </div>
    </div>
  </section>`;

/* --- формы --- */
const FORMS = {
  trial: { tab: 'Пробный урок', title: 'Запись на пробный урок' },
  base: { tab: 'В базу моделей', title: 'Заявка в базу моделей' },
  shoot: { tab: 'Съёмка портфолио', title: 'Заявка на съёмку портфолио' },
  online: { tab: 'Онлайн-курс', title: 'Заявка на онлайн-продвижение' },
  booking: { tab: 'Пригласить модель', title: 'Приглашение модели на съёмку / кастинг' }
};
const field = (name, lbl, type = 'text', req = false, extra = '') => `
  <label class="fld ${type === 'textarea' ? 'fld--area' : ''}">
    ${type === 'textarea' ? `<textarea name="${name}" rows="3" placeholder=" " ${req ? 'required' : ''} ${extra}></textarea>` : `<input name="${name}" type="${type}" placeholder=" " ${req ? 'required' : ''} ${extra}>`}
    <span>${esc(lbl)}${req ? ' *' : ''}</span>
  </label>`;
const chips = (name, opts, req = false) => `<div class="chipset" data-name="${name}">${opts.map((o, i) => `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}" ${req && i === 0 ? 'required' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;

function trialDates() {
  const a = C.apply || {};
  const days = toArr(a.trialDays).map(Number);
  const ahead = Number(a.trialDaysAhead) || 21;
  const out = [];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= ahead && out.length < 14; i++) {
    const x = new Date(d); x.setDate(d.getDate() + i);
    if (!days.length || days.includes(x.getDay())) out.push(x);
  }
  return out;
}
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

T.apply = a => {
  const courses = toArr((C.courses || {}).items);
  const consent = `<label class="consent"><input type="checkbox" name="consent" required><span>${esc(a.consent)}</span></label>`;
  const submit = t => `<button type="submit" class="btn btn--accent btn--wide magnetic"><span data-text="${t}">${t}</span></button>`;
  const dates = trialDates();
  return `
  <section class="s s-apply" id="apply" data-theme="light">
    <div class="container apply">
      <div class="apply__left">
        ${label(a.label)}
        <h2 class="h2 h2--xl" data-split>${rich(a.title)}</h2>
        <p class="lead" data-reveal>${esc(a.text)}</p>
        ${a.image ? `<div class="apply__img" data-reveal-img>${img(a.image, '')}</div>` : ''}
        <div class="apply__contacts" data-reveal>${contactsList()}</div>
      </div>
      <div class="apply__right" data-reveal>
        <div class="ftabs" role="tablist">
          ${Object.entries(FORMS).map(([k, f], i) => `<button class="ftab ${i === 0 ? 'is-active' : ''}" data-ftab="${k}" role="tab">${esc(f.tab)}</button>`).join('')}
        </div>
        <div class="fwrap">
          <form class="form is-active" data-form="trial" novalidate>
            <h3 class="form__title">Запись на пробный урок</h3>
            <div class="form__grid">
              ${field('name', 'Ваше имя', 'text', true, 'autocomplete="name"')}
              ${field('phone', 'Телефон', 'tel', true, 'autocomplete="tel" data-phone')}
            </div>
            <div class="form__group"><div class="form__lbl">Для кого</div>${chips('who', ['Ребёнок 3–11', 'Подросток 12–17', 'Взрослый 18+', '60+'], true)}</div>
            <div class="form__grid">
              ${field('age', 'Возраст ученика', 'text')}
              <label class="fld fld--select"><select name="course"><option value="">Не знаю, нужна консультация</option>${courses.map(c => `<option value="${esc(c.title)}" data-id="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select><span>Курс</span></label>
            </div>
            ${dates.length ? `<div class="form__group"><div class="form__lbl">Дата</div><div class="dates">${dates.map((d, i) => `<label class="date"><input type="radio" name="date" value="${WD[d.getDay()]}, ${d.getDate()} ${MN[d.getMonth()]}" ${i === 0 ? 'required' : ''}><span><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b><small>${MN[d.getMonth()].slice(0, 3)}</small></span></label>`).join('')}</div></div>` : ''}
            ${toArr(a.trialTimes).length ? `<div class="form__group"><div class="form__lbl">Время</div>${chips('time', toArr(a.trialTimes), true)}</div>` : ''}
            ${field('comment', 'Комментарий', 'textarea')}
            ${consent}${submit('Записаться')}
          </form>
          <form class="form" data-form="base" novalidate>
            <h3 class="form__title">Заявка в базу моделей</h3>
            <div class="form__grid">
              ${field('name', 'Имя и фамилия', 'text', true)}
              ${field('age', 'Возраст', 'text', true)}
              ${field('city', 'Город', 'text', true)}
              ${field('height', 'Рост, см', 'text', true, 'inputmode="numeric"')}
              ${field('params', 'Параметры (грудь/талия/бёдра)', 'text')}
              ${field('shoes', 'Размер обуви', 'text')}
              ${field('phone', 'Телефон', 'tel', true, 'data-phone')}
              ${field('social', 'Instagram / Telegram', 'text')}
            </div>
            ${field('photos', 'Ссылка на фото (облако, соцсети)', 'url', true)}
            ${field('parent', 'ФИО родителя (если вам нет 18)', 'text')}
            ${field('about', 'Опыт и о себе', 'textarea')}
            ${consent}${submit('Отправить заявку')}
          </form>
          <form class="form" data-form="shoot" novalidate>
            <h3 class="form__title">Съёмка портфолио «под ключ»</h3>
            <div class="form__grid">
              ${field('name', 'Ваше имя', 'text', true)}
              ${field('phone', 'Телефон', 'tel', true, 'data-phone')}
            </div>
            <div class="form__group"><div class="form__lbl">Кто снимается</div>${chips('who', ['Ребёнок', 'Подросток', 'Взрослый', '60+'], true)}</div>
            ${field('wish', 'Пожелания: стиль, цели, удобные даты', 'textarea')}
            ${consent}${submit('Записаться на съёмку')}
          </form>
          <form class="form" data-form="online" novalidate>
            <h3 class="form__title">Онлайн-продвижение для иногородних</h3>
            <div class="form__grid">
              ${field('name', 'Ваше имя', 'text', true)}
              ${field('city', 'Город', 'text', true)}
              ${field('age', 'Возраст', 'text', true)}
              ${field('phone', 'Телефон', 'tel', true, 'data-phone')}
            </div>
            ${field('social', 'Ссылка на соцсети или фото', 'text')}
            ${field('goal', 'Ваша цель и вопросы', 'textarea')}
            ${consent}${submit('Отправить заявку')}
          </form>
          <form class="form" data-form="booking" novalidate>
            <h3 class="form__title">Пригласить модель на съёмку или кастинг</h3>
            <div class="form__grid">
              ${field('company', 'Имя / компания', 'text', true)}
              ${field('phone', 'Телефон', 'tel', true, 'data-phone')}
              ${field('model', 'Модель', 'text', true)}
              ${field('dates', 'Даты проекта', 'text')}
            </div>
            ${field('project', 'О проекте: бренд, формат, бюджет', 'textarea')}
            ${consent}${submit('Отправить запрос')}
          </form>
          <div class="form__success" hidden>
            <div class="form__check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
            <h3>Заявка отправлена</h3>
            <p>${esc(a.success)}</p>
            <button class="btn btn--line" data-form-reset><span data-text="Отправить ещё">Отправить ещё</span></button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
};

function contactsList() {
  const k = C.contacts || {};
  const rows = [];
  if (has(k.phone)) rows.push(`<a href="tel:${esc(k.phone.replace(/[^\d+]/g, ''))}" class="clink"><small>Телефон</small><span>${esc(k.phone)}</span></a>`);
  if (has(k.email)) rows.push(`<a href="mailto:${esc(k.email)}" class="clink"><small>Почта</small><span>${esc(k.email)}</span></a>`);
  if (has(k.telegram)) rows.push(`<a href="https://t.me/${esc(k.telegram.replace('@', ''))}" target="_blank" rel="noopener" class="clink"><small>Telegram</small><span>@${esc(k.telegram.replace('@', ''))}</span></a>`);
  if (has(k.whatsapp)) rows.push(`<a href="https://wa.me/${esc(k.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" class="clink"><small>WhatsApp</small><span>Написать</span></a>`);
  if (has(k.instagram)) rows.push(`<a href="https://instagram.com/${esc(k.instagram.replace('@', ''))}" target="_blank" rel="noopener" class="clink"><small>Instagram</small><span>@${esc(k.instagram.replace('@', ''))}</span></a>`);
  if (has(k.vk)) rows.push(`<a href="${esc(k.vk.startsWith('http') ? k.vk : 'https://vk.com/' + k.vk)}" target="_blank" rel="noopener" class="clink"><small>VK</small><span>ВКонтакте</span></a>`);
  if (has(k.address)) rows.push(`<div class="clink"><small>Адрес</small><span>${esc(k.address)}</span></div>`);
  if (has(k.hours)) rows.push(`<div class="clink"><small>Время работы</small><span>${esc(k.hours)}</span></div>`);
  return rows.join('');
}

function renderFooter() {
  const s = C.settings || {}, f = C.footer || {};
  const letters = w => [...String(w || '')].map(c => `<span class="fl"><span>${esc(c)}</span></span>`).join('');
  $('#footer').innerHTML = `
    <div class="container footer__top">
      <div class="footer__cta">
        <p class="footer__kicker">${esc(f.text)}</p>
        <a href="#apply" class="footer__big-link" data-scroll-to data-prefill="trial" data-cursor="Записаться"><span>Записаться</span><i>→</i></a>
      </div>
      <div class="footer__cols">
        <div class="footer__col"><h4>Навигация</h4>${toArr(C.nav).map(n => `<a href="${esc(n.href)}" data-scroll-to>${esc(n.label)}</a>`).join('')}</div>
        <div class="footer__col"><h4>Контакты</h4>${contactsList()}</div>
      </div>
    </div>
    <div class="footer__word" aria-hidden="true">${letters(s.brandLeft)}<span class="fl fl--dot"><i></i></span>${letters(s.brandRight)}</div>
    <div class="container footer__bottom">
      <span>${esc(f.copyright)}</span>
      <span>${esc(s.descriptor)}</span>
      <a href="#top" data-scroll-to class="footer__up">Наверх ↑</a>
    </div>`;
}

function renderNav() {
  const nav = toArr(C.nav);
  $('#nav').innerHTML = nav.map(n => `<a href="${esc(n.href)}" data-scroll-to class="nav__link"><span data-text="${esc(n.label)}">${esc(n.label)}</span></a>`).join('');
  $('#menuNav').innerHTML = nav.map((n, i) => `<a href="${esc(n.href)}" data-scroll-to class="menu__link"><small>${pad(i + 1)}</small><span>${esc(n.label)}</span></a>`).join('');
  $('#menuFoot').innerHTML = contactsList();
  $$('[data-brand-left]').forEach(e => e.textContent = C.settings.brandLeft);
  $$('[data-brand-right]').forEach(e => e.textContent = C.settings.brandRight);
}

function applyTheme() {
  const s = C.settings || {}, r = document.documentElement.style;
  if (s.accent) r.setProperty('--accent', s.accent);
  if (s.ink) r.setProperty('--ink', s.ink);
  if (s.paper) r.setProperty('--paper', s.paper);
  const seo = s.seo || {};
  if (seo.title) document.title = seo.title;
  const md = $('meta[name="description"]'); if (md && seo.description) md.content = seo.description;
}

function render() {
  labelIndex = 0;
  const html = toArr(C.sections).filter(s => s.visible !== false && T[s.id] && C[s.id]).map(s => T[s.id](C[s.id])).join('');
  $('#app').innerHTML = html;
  renderNav();
  renderFooter();
}

/* ---------- текст: разбивка на слова и буквы ---------- */
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const walk = (node, parent) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = p;
          w.append(wi); frag.append(w);
        });
        parent.replaceChild(frag, n);
      } else if (n.nodeType === 1 && n.nodeName !== 'BR') {
        walk(n, n);
      }
    });
  };
  walk(el, el);
}

/* ---------- плавный скролл ---------- */
function initScroll() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (!reduceMotion && C.settings.smoothScroll !== false && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', e => { velocity = e.velocity || 0; ScrollTrigger.update(); });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  } else {
    let last = scrollY;
    addEventListener('scroll', () => { velocity = (scrollY - last); last = scrollY; }, { passive: true });
  }
}
function scrollToTarget(target, immediate = false) {
  const el = typeof target === 'string' ? (target === '#top' ? document.body : $(target)) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el === document.body ? 0 : el, { offset: 0, duration: immediate ? 0 : 1.6, immediate, easing: t => 1 - Math.pow(1 - t, 4) });
  else (el === document.body ? scrollTo({ top: 0, behavior: 'smooth' }) : el.scrollIntoView({ behavior: 'smooth' }));
}

/* ---------- прелоадер ---------- */
function preloader() {
  const pl = $('#preloader');
  return new Promise(resolve => {
    if (!pl || C.settings.preloader === false || reduceMotion) { pl && pl.remove(); resolve(); return; }
    const count = $('#plCount');
    const o = { v: 0 };
    gsap.set('.preloader__word .pl-l', { yPercent: 110 });
    gsap.set('.preloader__word .pl-dot', { scale: 0 });
    const tl = gsap.timeline();
    tl.to('.preloader__word .pl-l', { yPercent: 0, opacity: 1, stagger: 0.06, duration: 1, ease: 'expo.out' }, 0.1)
      .to('.preloader__word .pl-dot', { scale: 1, duration: 0.8, ease: 'expo.out' }, 0.35)
      .to('.preloader__sub', { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.6)
      .to(o, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: () => { count.textContent = Math.round(o.v); $('.preloader__bar i').style.transform = `scaleX(${o.v / 100})`; } }, 0)
      .to('.preloader__word .pl-l', { yPercent: -110, opacity: 0, stagger: 0.03, duration: 0.6, ease: 'power3.in' }, '+=0.15')
      .to('.preloader__word .pl-dot', { scale: 0, duration: 0.5, ease: 'power3.in' }, '<0.1')
      .to('.preloader__sub, .preloader__count, .preloader__bar', { opacity: 0, duration: 0.4 }, '<')
      .to(pl, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut', onStart: () => setTimeout(resolve, 380) }, '-=0.2')
      .add(() => pl.remove());
  });
}

/* ---------- интро первого экрана ---------- */
function heroIntro() {
  const hero = $('.s-hero'); if (!hero) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo('.hero__vid .hero__in', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, stagger: 0.12, ease: 'expo.inOut' }, 0)
    .fromTo('.hero__vid video', { scale: 1.35 }, { scale: 1, duration: 2.2, stagger: 0.12 }, 0.1)
    .fromTo('.hero__word .ch', { yPercent: 115 }, { yPercent: 0, duration: 1.5, stagger: 0.045 }, 0.3)
    .fromTo('.hero__dot i', { scale: 0 }, { scale: 1, duration: 1.2 }, 0.9)
    .fromTo('.hero__fade', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 1.1);
}

/* ---------- анимации ---------- */
function initAnimations() {
  const mm = gsap.matchMedia();

  /* смена темы по секциям + шапка */
  $$('[data-theme]').forEach(sec => {
    if (sec.id === 'footer') return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: self => { if (self.isActive) document.body.dataset.theme = sec.dataset.theme; }
    });
  });
  ScrollTrigger.create({ trigger: '#footer', start: 'top 55%', onToggle: s => { if (s.isActive) document.body.dataset.theme = 'dark'; }, end: 'bottom bottom' });

  /* прогресс-бар */
  gsap.to('#scrollProgress', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });

  /* шапка: прячем при скролле вниз */
  const header = $('#header');
  ScrollTrigger.create({
    start: 'top -120', end: 'max',
    onUpdate: self => {
      header.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 300 && !document.body.classList.contains('menu-open'));
      header.classList.toggle('is-scrolled', self.scroll() > 40);
    }
  });

  /* заголовки по словам */
  $$('[data-split]').forEach(el => {
    splitWords(el);
    gsap.fromTo($$('.wi', el), { yPercent: 115, rotate: 3 }, {
      yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* плавное появление */
  $$('[data-reveal]').forEach(el => {
    gsap.fromTo(el, { opacity: 0, y: 46 }, {
      opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true }
    });
  });

  /* раскрытие картинок шторкой */
  $$('[data-reveal-img]').forEach(el => {
    const inner = el.querySelector('img, video');
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' });
    if (inner) tl.fromTo(inner, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0.1);
  });

  /* параллакс */
  $$('[data-parallax]').forEach(el => {
    const sp = parseFloat(el.dataset.parallax) || 0.2;
    gsap.fromTo(el, { yPercent: -sp * 50 }, { yPercent: sp * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- HERO ---------- */
  if ($('.s-hero')) {
    mm.add('(min-width: 1025px)', () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.s-hero', start: 'top top', end: '+=130%', scrub: 1, pin: true, anticipatePin: 1, refreshPriority: 10 } });
      tl.fromTo('.hero__vid--c', { top: '10vh', bottom: '10vh', left: '35vw', right: '35vw', borderRadius: 6 }, { top: 0, bottom: 0, left: 0, right: 0, borderRadius: 0, ease: 'power2.inOut' }, 0)
        .to('.hero__vid--l', { xPercent: -80, yPercent: -40, rotate: -6, opacity: 0, ease: 'power2.in' }, 0)
        .to('.hero__vid--r', { xPercent: 80, yPercent: 40, rotate: 6, opacity: 0, ease: 'power2.in' }, 0)
        .to('.hero__word--l', { xPercent: -55, ease: 'power2.in' }, 0)
        .to('.hero__word--r', { xPercent: 55, ease: 'power2.in' }, 0)
        .to('.hero__dot', { scale: 6, opacity: 0, ease: 'power2.in' }, 0)
        .to('.hero__top, .hero__bottom, .hero__scroll', { opacity: 0, y: -60, ease: 'power2.in' }, 0)
        .to('.hero__shade', { opacity: 0.6, ease: 'none' }, 0.3)
        .to('.hero__title', { opacity: 0, ease: 'none' }, 0.55);
    });
    mm.add('(max-width: 1024px)', () => {
      gsap.to('.hero__vid--c video', { scale: 1.2, ease: 'none', scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__title', { yPercent: -40, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__shade', { opacity: 0.7, ease: 'none', scrollTrigger: { trigger: '.s-hero', start: 'top top', end: 'bottom top', scrub: true } });
    });
  }

  /* ---------- MANIFESTO: слова загораются ---------- */
  const mf = $('.manifesto__text');
  if (mf) {
    gsap.fromTo($$('.mw', mf), { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: mf, start: 'top 80%', end: 'bottom 45%', scrub: true } });
    $$('.mf-img', mf).forEach(e => gsap.fromTo(e, { width: 0, opacity: 0 }, { width: '1.9em', opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: e, start: 'top 85%', end: 'top 55%', scrub: true } }));
  }

  /* ---------- VALUES: стопка карточек ---------- */
  const cards = $$('.vcard');
  cards.forEach((card, i) => {
    const media = card.querySelector('.vcard__media img');
    if (media) gsap.fromTo(media, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'top top', scrub: true } });
    if (i === cards.length - 1) return;
    gsap.to(card.querySelector('.vcard__inner'), { scale: 0.9, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 15%', scrub: true } });
    gsap.to(card.querySelector('.vcard__dim'), { opacity: 0.55, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 15%', scrub: true } });
  });

  /* ---------- AUDIENCE ---------- */
  if ($('.aud')) {
    gsap.fromTo('.aud__item', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', stagger: 0.12, scrollTrigger: { trigger: '.aud', start: 'top 85%', once: true } });
    gsap.fromTo('.aud__age', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.5, scrollTrigger: { trigger: '.aud', start: 'top 85%', once: true } });
  }

  /* ---------- COURSES: горизонтальный скролл ---------- */
  if ($('.s-courses')) {
    mm.add('(min-width: 1025px)', () => {
      const track = $('.courses__track');
      const dist = () => track.scrollWidth - innerWidth;
      const cur = $('.courses__cur');
      const n = $$('.course').length;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.s-courses', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 9,
          onUpdate: self => {
            $('.courses__progress i').style.transform = `scaleX(${self.progress})`;
            if (cur) cur.textContent = pad(Math.min(n, Math.max(1, Math.round(self.progress * n + 0.49))));
          }
        }
      });
      $$('.course').forEach(c => {
        const im = c.querySelector('.course__img img');
        if (im) gsap.fromTo(im, { xPercent: -10, scale: 1.2 }, { xPercent: 10, scale: 1.2, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        const im2 = c.querySelector('.course__img2');
        if (im2) gsap.fromTo(im2, { yPercent: 30, rotate: 6 }, { yPercent: -30, rotate: -4, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        gsap.fromTo(c.querySelectorAll('.course__body > *'), { opacity: 0, x: 80 }, { opacity: 1, x: 0, stagger: 0.07, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left 65%', toggleActions: 'play none none reverse' } });
        gsap.fromTo(c.querySelector('.course__bignum'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left 90%', end: 'left 30%', scrub: true } });
      });
      return () => gsap.set(track, { clearProps: 'all' });
    });
    mm.add('(max-width: 1024px)', () => {
      $$('.course').forEach(c => {
        gsap.fromTo(c.querySelectorAll('.course__body > *'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c.querySelector('.course__body'), start: 'top 85%', once: true } });
        const im = c.querySelector('.course__img img');
        if (im) gsap.fromTo(im, { yPercent: -8, scale: 1.15 }, { yPercent: 8, scale: 1.15, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    });
  }

  /* ---------- DISCIPLINES ---------- */
  $$('.disc__row').forEach((row, i) => {
    gsap.fromTo(row.querySelector('.disc__line'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: row, start: 'top 92%', once: true } });
    gsap.fromTo(row.querySelectorAll('.disc__num, .disc__title > span, .disc__text, .disc__arrow'), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: row, start: 'top 92%', once: true } });
  });

  /* ---------- STATS: счётчики ---------- */
  $$('.count').forEach(el => {
    const to = parseInt(el.dataset.to, 10) || 0; const o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.2, ease: 'power3.out', onUpdate: () => el.textContent = Math.round(o.v) }) });
  });

  /* ---------- RUNWAY ---------- */
  if ($('.runway__v1')) gsap.fromTo('.runway__v1 video', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.runway__media', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- ZOOM: кадр раскрывается на весь экран ---------- */
  if ($('.s-zoom')) {
    mm.add({ d: '(min-width: 769px)', m: '(max-width: 768px)' }, ctx => {
      const m = ctx.conditions.m;
      const tl = gsap.timeline({ scrollTrigger: { trigger: '.s-zoom', start: 'top top', end: '+=160%', pin: true, scrub: 1, anticipatePin: 1, refreshPriority: 8 } });
      tl.fromTo('.zoom__frame', { clipPath: m ? 'inset(22% 18% 22% 18% round 999px)' : 'inset(24% 38% 24% 38% round 999px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo('.zoom__frame img', { scale: 1.6, yPercent: 28 }, { scale: 1, yPercent: 0, ease: 'power2.inOut', duration: 1 }, 0)
        .to('.zoom__title .zl', { xPercent: m ? -110 : -70, opacity: 0, ease: 'power2.in', duration: 0.8 }, 0)
        .to('.zoom__title .zr', { xPercent: m ? 110 : 70, opacity: 0, ease: 'power2.in', duration: 0.8 }, 0)
        .fromTo('.zoom__veil', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.7)
        .fromTo('.zoom__cap', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.75)
        .to({}, { duration: 0.25 });
    });
  }

  /* ---------- CAMPAIGNS: колонки с разной скоростью ---------- */
  $$('.camp__col').forEach((col, i) => {
    const sp = [[0, -30], [-12, -20], [-2, -40], [-8, -24]][i % 4];
    gsap.fromTo(col, { yPercent: sp[0] }, { yPercent: sp[1], ease: 'none', scrollTrigger: { trigger: '.camp__cols', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- PORTFOLIO ---------- */
  if ($('.port__list')) {
    gsap.fromTo('.port__list li span', { scale: 0 }, { scale: 1, stagger: 0.08, duration: 0.8, ease: 'back.out(2)', scrollTrigger: { trigger: '.port__list', start: 'top 85%', once: true } });
  }

  /* ---------- PROMOTION: линия шагов ---------- */
  if ($('.promo__steps')) {
    gsap.fromTo('.promo__line i', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.promo__steps', start: 'top 65%', end: 'bottom 60%', scrub: true } });
    $$('.step').forEach(s => {
      ScrollTrigger.create({ trigger: s, start: 'top 65%', onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on') });
      gsap.fromTo(s.querySelectorAll('.step__num, .step__title, .step__text'), { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: s, start: 'top 80%', once: true } });
    });
    const stamp = $('.promo__stamp svg');
    if (stamp) gsap.to(stamp, { rotate: 360, ease: 'none', scrollTrigger: { trigger: '.s-promo', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------- SENIOR: огромные цифры ---------- */
  if ($('.senior__big')) {
    gsap.fromTo('.sr1', { xPercent: 0 }, { xPercent: -25, ease: 'none', scrollTrigger: { trigger: '.s-senior', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.sr2', { xPercent: -25 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.s-senior', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------- GALLERY: ряды едут в разные стороны ---------- */
  $$('.gal__row').forEach((row, i) => {
    const dir = i % 2 ? 1 : -1;
    gsap.fromTo(row, { xPercent: dir > 0 ? -35 : 0 }, { xPercent: dir > 0 ? 0 : -35, ease: 'none', scrollTrigger: { trigger: '.s-gallery', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- FOOTER: буквы поднимаются ---------- */
  if ($('.footer__word')) {
    gsap.fromTo('.footer__word .fl > span, .footer__word .fl--dot i', { yPercent: 110 }, { yPercent: 0, ease: 'none', stagger: 0.04, scrollTrigger: { trigger: '.footer__word', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* бегущие строки и скос от скорости */
  initMarquees();
}

function initMarquees() {
  const mqs = $$('.mq').map(el => ({ el, track: el.querySelector('.mq__track'), x: 0, dir: Number(el.dataset.dir) || -1, speed: Number(el.dataset.speed) || 0.5 }));
  const rows = $$('.gal__item img, .camp__item img');
  let skew = 0;
  gsap.ticker.add(() => {
    const v = Math.max(-60, Math.min(60, velocity || 0));
    mqs.forEach(m => {
      const half = m.track.scrollWidth / (m.el.classList.contains('mq--brands') ? 3 : 2);
      if (!half) return;
      m.x += (m.speed + Math.abs(v) * 0.06) * m.dir * (v < 0 ? -1 : 1);
      if (m.x <= -half) m.x += half; if (m.x > 0) m.x -= half;
      m.track.style.transform = `translate3d(${m.x}px,0,0)`;
    });
    const target = reduceMotion ? 0 : v * 0.12;
    skew += (target - skew) * 0.1;
    if (Math.abs(skew) > 0.01) rows.forEach(r => r.style.transform = `skewY(${skew * 0.25}deg) scale(1.04)`);
  });
}

/* ---------- видео: подгружаем и играем только в зоне видимости ---------- */
function initVideos() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.dataset.src && !v.src) { v.src = v.dataset.src; v.load(); }
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      } else if (!v.paused) v.pause();
    });
  }, { rootMargin: '200px 0px' });
  $$('video[data-autoplay]').forEach(v => { v.muted = true; io.observe(v); });
}

/* ---------- курсор ---------- */
function initCursor() {
  if (isTouch || C.settings.cursor === false) { $('#cursor').remove(); return; }
  document.body.classList.add('has-cursor');
  const cur = $('#cursor'), ring = $('.cursor__ring'), dot = $('.cursor__dot'), lbl = $('.cursor__label');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.1 }), dy = gsap.quickTo(dot, 'y', { duration: 0.1 });
  addEventListener('mousemove', e => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); cur.classList.add('is-visible'); }, { passive: true });
  document.addEventListener('mouseleave', () => cur.classList.remove('is-visible'));
  document.addEventListener('mouseover', e => {
    const c = e.target.closest('[data-cursor]');
    const a = e.target.closest('a, button, label, input, select, textarea, .mcard');
    if (c && c.dataset.cursor) { cur.classList.add('is-label'); lbl.textContent = c.dataset.cursor; }
    else { cur.classList.remove('is-label'); }
    cur.classList.toggle('is-hover', !!a && !(c && c.dataset.cursor));
  });
  document.addEventListener('mousedown', () => cur.classList.add('is-down'));
  document.addEventListener('mouseup', () => cur.classList.remove('is-down'));
}

/* ---------- магнитные кнопки и наклон карточек ---------- */
function initMagnetic() {
  if (isTouch) return;
  document.addEventListener('mousemove', e => {
    const m = e.target.closest('.magnetic');
    $$('.magnetic.is-mag').forEach(x => { if (x !== m) { x.classList.remove('is-mag'); gsap.to(x, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }); } });
    if (!m) return;
    const r = m.getBoundingClientRect();
    m.classList.add('is-mag');
    gsap.to(m, { x: (e.clientX - r.left - r.width / 2) * 0.28, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.5, ease: 'power3.out' });
  }, { passive: true });
  $$('.tilt').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(card, { rotateY: px * 10, rotateX: -py * 10, transformPerspective: 900, duration: 0.6, ease: 'power3.out' });
      gsap.to(card.querySelector('img'), { x: px * -18, y: py * -18, scale: 1.1, duration: 0.6, ease: 'power3.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotateY: 0, rotateX: 0, duration: 1, ease: 'elastic.out(1, 0.5)' });
      gsap.to(card.querySelector('img'), { x: 0, y: 0, scale: 1, duration: 1, ease: 'expo.out' });
    });
  });
}

/* ---------- дисциплины: картинка следует за курсором ---------- */
function initDisciplines() {
  const list = $('.disc'), fl = $('.disc__float'), fin = $('.disc__float-in');
  if (!list || !fl || isTouch) return;
  gsap.set(fl, { xPercent: -50, yPercent: -50, scale: 0.4, opacity: 0 });
  const xTo = gsap.quickTo(fl, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(fl, 'y', { duration: 0.6, ease: 'power3' });
  let lastX = 0, current = '';
  list.addEventListener('mousemove', e => {
    xTo(e.clientX); yTo(e.clientY);
    const dx = e.clientX - lastX; lastX = e.clientX;
    gsap.to(fl, { rotate: Math.max(-12, Math.min(12, dx * 0.6)), duration: 0.6, ease: 'power3' });
  });
  list.addEventListener('mouseenter', () => gsap.to(fl, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }));
  list.addEventListener('mouseleave', () => gsap.to(fl, { scale: 0.4, opacity: 0, duration: 0.5, ease: 'power3.in' }));
  $$('.disc__row').forEach(row => row.addEventListener('mouseenter', () => {
    const src = row.dataset.img; if (!src || src === current) return; current = src;
    const im = new Image(); im.src = src; im.alt = '';
    fin.append(im);
    gsap.fromTo(im, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.3 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.8, ease: 'expo.out' });
    while (fin.children.length > 3) fin.firstElementChild.remove();
  }));
}

/* ---------- аудитория: аккордеон ---------- */
function initAudience() {
  $$('.aud__item').forEach(it => {
    it.addEventListener('mouseenter', () => { $$('.aud__item').forEach(x => x.classList.toggle('is-open', x === it)); });
  });
  const aud = $('.aud');
  if (aud) aud.addEventListener('mouseleave', () => $$('.aud__item').forEach(x => x.classList.remove('is-open')));
}

/* ---------- каталог ---------- */
const catLabel = id => { const c = toArr((C.catalog || {}).categories).find(k => k.id === id); return c ? `${c.label} · ${c.range}` : ''; };

function modelCard(m, i) {
  const photos = toArr(m.photos).slice(0, 6);
  const meta = [ageStr(m.birthYear), has(m.height) ? `${m.height} см` : ''].filter(Boolean).join(' · ');
  return `
  <article class="mcard" data-id="${esc(m.id)}" data-i="${i}" tabindex="0" data-cursor="Профиль" aria-label="${esc(m.name)}">
    <div class="mcard__media">
      ${photos.map((p, k) => k === 0 ? `<img src="${esc(thumb(p))}" alt="${esc(m.name)}" class="is-active" loading="lazy" decoding="async">` : `<img data-src="${esc(thumb(p))}" alt="" decoding="async">`).join('')}
      ${photos.length > 1 ? `<div class="mcard__bars">${photos.map((_, k) => `<i class="${k === 0 ? 'is-active' : ''}"></i>`).join('')}</div>` : ''}
      ${m.featured ? '<span class="mcard__badge">Selected</span>' : ''}
      <span class="mcard__more">Смотреть профиль</span>
    </div>
    <div class="mcard__info">
      <h3 class="mcard__name">${esc(m.name)}</h3>
      <span class="mcard__meta">${esc(meta)}</span>
    </div>
  </article>`;
}

function filterModels() {
  const models = toArr((C.catalog || {}).models);
  const q = state.q.trim().toLowerCase();
  state.filtered = models.filter(m =>
    (state.cat === 'all' || m.category === state.cat) &&
    (state.gender === 'all' || m.gender === state.gender) &&
    (!q || String(m.name).toLowerCase().includes(q)));
  const grid = $('#catGrid'), empty = $('#catEmpty');
  if (!grid) return;
  const draw = () => {
    grid.innerHTML = state.filtered.map((m, i) => modelCard(m, i)).join('');
    empty.hidden = state.filtered.length > 0;
    bindCards();
    gsap.fromTo($$('.mcard', grid), { opacity: 0, y: 60, clipPath: 'inset(20% 0% 0% 0%)' }, { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out', stagger: 0.05, onComplete: () => ScrollTrigger.refresh() });
    if (!empty.hidden) gsap.fromTo(empty.children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1, ease: 'expo.out' });
  };
  if (grid.children.length) gsap.to($$('.mcard', grid), { opacity: 0, y: -20, duration: 0.3, stagger: 0.015, onComplete: draw });
  else draw();
}

function bindCards() {
  $$('.mcard').forEach(card => {
    const imgs = $$('.mcard__media img', card), bars = $$('.mcard__bars i', card);
    let loaded = false, cur = 0;
    const show = k => { if (k === cur) return; imgs[cur].classList.remove('is-active'); bars[cur] && bars[cur].classList.remove('is-active'); cur = k; imgs[k].classList.add('is-active'); bars[k] && bars[k].classList.add('is-active'); };
    const load = () => { if (loaded) return; loaded = true; imgs.forEach(im => { if (im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); } }); };
    if (!isTouch) {
      card.addEventListener('mouseenter', load);
      card.addEventListener('mousemove', e => {
        if (imgs.length < 2) return;
        const r = card.getBoundingClientRect();
        show(Math.min(imgs.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * imgs.length))));
      });
      card.addEventListener('mouseleave', () => show(0));
    }
    card.addEventListener('click', () => openModel(Number(card.dataset.i)));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openModel(Number(card.dataset.i)); });
  });
}

function initCatalog() {
  if (!$('#catGrid')) return;
  const tabs = $$('.cat__tab'), ind = $('.cat__ind');
  const moveInd = t => { if (!t || !ind) return; ind.style.width = t.offsetWidth + 'px'; ind.style.transform = `translateX(${t.offsetLeft}px)`; };
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('is-active', x === t)); moveInd(t);
    state.cat = t.dataset.cat; filterModels();
  }));
  $$('[data-gender]').forEach(b => b.addEventListener('click', () => {
    $$('[data-gender]').forEach(x => x.classList.toggle('is-active', x === b));
    state.gender = b.dataset.gender; filterModels();
  }));
  let tm; const inp = $('.cat__search input');
  if (inp) inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { state.q = inp.value; filterModels(); }, 250); });
  requestAnimationFrame(() => moveInd($('.cat__tab.is-active')));
  addEventListener('resize', () => moveInd($('.cat__tab.is-active')));
  filterModels();
}

/* ---------- профиль модели ---------- */
function openModel(i, fromHash = false) {
  const m = state.filtered[i]; if (!m) return;
  state.modelIndex = i;
  const body = $('#modelModalBody'), modal = $('#modelModal');
  const params = [['Возраст', ageStr(m.birthYear)], ['Рост', has(m.height) ? `${m.height} см` : ''], ['Грудь', m.bust], ['Талия', m.waist], ['Бёдра', m.hips], ['Обувь', m.shoes], ['Одежда', m.clothes], ['Волосы', m.hair], ['Глаза', m.eyes], ['Город', m.city]].filter(p => has(p[1]));
  const photos = toArr(m.photos);
  body.innerHTML = `
    <div class="mm">
      <div class="mm__gallery">
        ${photos.map((p, k) => `<figure class="mm__ph ${k === 0 ? 'mm__ph--lead' : ''}" data-mlb="${k}" data-cursor="Открыть"><img src="${esc(k < 3 ? p : thumb(p))}" alt="${esc(m.name)} — фото ${k + 1}" ${k > 1 ? 'loading="lazy"' : ''}></figure>`).join('')}
      </div>
      <aside class="mm__info">
        <div class="mm__cat">${esc(catLabel(m.category))}</div>
        <h2 class="mm__name" id="mmName">${esc(m.name)}</h2>
        <dl class="mm__params">${params.map(p => `<div><dt>${esc(p[0])}</dt><dd>${esc(p[1])}</dd></div>`).join('')}</dl>
        ${has(m.about) ? `<p class="mm__about">${esc(m.about)}</p>` : ''}
        ${toArr(m.tags).length ? `<div class="mm__tags">${toArr(m.tags).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="mm__actions">
          <a href="#apply" class="btn btn--accent btn--wide" data-book-model="${esc(m.name)}"><span data-text="Пригласить на съёмку">Пригласить на съёмку</span></a>
          <button class="btn btn--line btn--wide" data-share><span data-text="Скопировать ссылку">Скопировать ссылку</span></button>
        </div>
        <div class="mm__nav">
          <button data-mnav="-1">← Предыдущая</button>
          <span>${pad(i + 1)} / ${pad(state.filtered.length)}</span>
          <button data-mnav="1">Следующая →</button>
        </div>
      </aside>
    </div>`;
  const wasOpen = modal.classList.contains('is-open');
  modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  if (lenis) lenis.stop();
  const panel = $('.modal__panel', modal);
  $('.modal__scroll', modal).scrollTop = 0;
  if (!wasOpen) {
    gsap.fromTo('.modal__shade', { opacity: 0 }, { opacity: 1, duration: 0.6 });
    gsap.fromTo(panel, { xPercent: 100 }, { xPercent: 0, duration: 1, ease: 'expo.out' });
  }
  gsap.fromTo($$('.mm__ph', body), { opacity: 0, y: 60 }, { opacity: 1, y: 0, stagger: 0.05, duration: 1, ease: 'expo.out', delay: wasOpen ? 0 : 0.25 });
  gsap.fromTo($$('.mm__info > *', body), { opacity: 0, x: 40 }, { opacity: 1, x: 0, stagger: 0.05, duration: 0.9, ease: 'expo.out', delay: wasOpen ? 0 : 0.35 });
  if (!fromHash) history.replaceState(null, '', '#model-' + m.id);
  $$('[data-mlb]', body).forEach(f => f.addEventListener('click', () => openLightbox(photos, Number(f.dataset.mlb))));
}
function closeModel() {
  const modal = $('#modelModal'); if (!modal.classList.contains('is-open')) return;
  gsap.to('.modal__shade', { opacity: 0, duration: 0.5 });
  gsap.to('.modal__panel', { xPercent: 100, duration: 0.7, ease: 'expo.in', onComplete: () => {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lenis) lenis.start();
  } });
  history.replaceState(null, '', location.pathname + location.search);
}
function initModal() {
  const modal = $('#modelModal');
  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModel();
    const nav = e.target.closest('[data-mnav]');
    if (nav) { const n = state.filtered.length; openModel((state.modelIndex + Number(nav.dataset.mnav) + n) % n); }
    const share = e.target.closest('[data-share]');
    if (share) { const url = location.href.split('#')[0] + '#model-' + state.filtered[state.modelIndex].id; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Ссылка на профиль скопирована'), () => toast(url)); }
    const book = e.target.closest('[data-book-model]');
    if (book) { e.preventDefault(); const name = book.dataset.bookModel; closeModel(); setTimeout(() => { selectForm('booking', { model: name }); scrollToTarget('#apply'); }, 400); }
  });
  addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open') || $('#lightbox').classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModel();
    if (e.key === 'ArrowRight') openModel((state.modelIndex + 1) % state.filtered.length);
    if (e.key === 'ArrowLeft') openModel((state.modelIndex - 1 + state.filtered.length) % state.filtered.length);
  });
  const fromHash = () => {
    const m = location.hash.match(/^#model-(.+)$/); if (!m) return;
    const i = state.filtered.findIndex(x => x.id === decodeURIComponent(m[1]));
    if (i > -1) { scrollToTarget('#catalog', true); setTimeout(() => openModel(i, true), 300); }
  };
  fromHash();
  addEventListener('hashchange', fromHash);
}

/* ---------- лайтбокс ---------- */
const lb = { list: [], i: 0 };
function openLightbox(list, i) {
  lb.list = list; lb.i = i;
  const box = $('#lightbox');
  box.classList.add('is-open'); box.setAttribute('aria-hidden', 'false');
  if (lenis) lenis.stop();
  showLb();
  gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: 0.4 });
}
function showLb() {
  const im = $('#lightboxImg');
  gsap.fromTo(im, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
  im.src = lb.list[lb.i];
  $('#lightboxCount').textContent = `${pad(lb.i + 1)} / ${pad(lb.list.length)}`;
}
function closeLightbox() {
  const box = $('#lightbox');
  gsap.to(box, { opacity: 0, duration: 0.3, onComplete: () => { box.classList.remove('is-open'); box.setAttribute('aria-hidden', 'true'); if (lenis && !document.body.classList.contains('modal-open')) lenis.start(); } });
}
function initLightbox() {
  const box = $('#lightbox');
  box.addEventListener('click', e => {
    if (e.target.closest('[data-lb-close]') || e.target === box) closeLightbox();
    if (e.target.closest('[data-lb-next]')) { lb.i = (lb.i + 1) % lb.list.length; showLb(); }
    if (e.target.closest('[data-lb-prev]')) { lb.i = (lb.i - 1 + lb.list.length) % lb.list.length; showLb(); }
  });
  addEventListener('keydown', e => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') { lb.i = (lb.i + 1) % lb.list.length; showLb(); }
    if (e.key === 'ArrowLeft') { lb.i = (lb.i - 1 + lb.list.length) % lb.list.length; showLb(); }
  });
  let sx = 0;
  box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { lb.i = (lb.i + (dx < 0 ? 1 : -1) + lb.list.length) % lb.list.length; showLb(); } });
  const lists = {
    campaigns: toArr((C.campaigns || {}).items).map(x => x.image),
    portfolio: toArr((C.portfolio || {}).images),
    gallery: [].concat(toArr((C.gallery || {}).row1), toArr((C.gallery || {}).row2), toArr((C.gallery || {}).row3))
  };
  document.addEventListener('click', e => {
    const f = e.target.closest('[data-lb]'); if (!f) return;
    openLightbox(lists[f.dataset.lb] || [], Number(f.dataset.index) || 0);
  });
}

/* ---------- FAQ ---------- */
function initFaq() {
  $$('.faq__item').forEach(it => {
    const q = $('.faq__q', it), a = $('.faq__a', it);
    q.addEventListener('click', () => {
      const open = !it.classList.contains('is-open');
      $$('.faq__item.is-open').forEach(o => { if (o !== it) { o.classList.remove('is-open'); $('.faq__q', o).setAttribute('aria-expanded', 'false'); gsap.to($('.faq__a', o), { height: 0, duration: 0.6, ease: 'expo.inOut' }); } });
      it.classList.toggle('is-open', open); q.setAttribute('aria-expanded', open);
      gsap.to(a, { height: open ? 'auto' : 0, duration: 0.7, ease: 'expo.inOut', onComplete: () => ScrollTrigger.refresh() });
    });
  });
}

/* ---------- формы ---------- */
function selectForm(key, prefill = {}) {
  $$('.ftab').forEach(t => t.classList.toggle('is-active', t.dataset.ftab === key));
  $$('.form').forEach(f => f.classList.toggle('is-active', f.dataset.form === key));
  const succ = $('.form__success'); if (succ) succ.hidden = true;
  const form = $(`.form[data-form="${key}"]`); if (!form) return;
  form.hidden = false;
  if (prefill.model && form.elements.model) form.elements.model.value = prefill.model;
  if (prefill.course && form.elements.course) {
    const opt = [...form.elements.course.options].find(o => o.dataset.id === prefill.course);
    if (opt) form.elements.course.value = opt.value;
    const map = { kids: 'Ребёнок 3–11', teens: 'Подросток 12–17', adults: 'Взрослый 18+' };
    const r = form.querySelector(`input[name="who"][value="${map[prefill.course]}"]`); if (r) r.checked = true;
  }
  gsap.fromTo(form.children, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.03, duration: 0.7, ease: 'expo.out' });
  const at = $('.ftab.is-active'), tabsEl = $('.ftabs');
  if (at && tabsEl) tabsEl.scrollTo({ left: at.offsetLeft - tabsEl.clientWidth / 2 + at.offsetWidth / 2, behavior: 'smooth' });
}

function initForms() {
  $$('.ftab').forEach(t => t.addEventListener('click', () => selectForm(t.dataset.ftab)));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prefill]');
    if (p) selectForm(p.dataset.prefill, { course: p.dataset.course });
  });
  $$('input[data-phone]').forEach(inp => inp.addEventListener('input', () => {
    let d = inp.value.replace(/\D/g, '');
    if (!d) { inp.value = ''; return; }
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    let s = '+7';
    if (d.length > 1) s += ' (' + d.slice(1, 4);
    if (d.length >= 4) s += ')';
    if (d.length > 4) s += ' ' + d.slice(4, 7);
    if (d.length > 7) s += '-' + d.slice(7, 9);
    if (d.length > 9) s += '-' + d.slice(9, 11);
    inp.value = s;
  }));
  $$('.form').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach(el => {
      let valid;
      if (el.type === 'radio') valid = !!form.querySelector(`input[name="${el.name}"]:checked`);
      else if (el.type === 'checkbox') valid = el.checked;
      else if (el.dataset.phone !== undefined) valid = el.value.replace(/\D/g, '').length === 11;
      else valid = el.value.trim().length > 0 && (el.type !== 'url' || /^(https?:\/\/)?\S+\.\S+/.test(el.value.trim()));
      const wrap = el.closest('.fld, .chipset, .dates, .consent');
      if (wrap) wrap.classList.toggle('is-error', !valid);
      if (!valid) ok = false;
    });
    if (!ok) { toast('Пожалуйста, заполните обязательные поля'); gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,0.3)' }); return; }
    const key = form.dataset.form;
    const fields = [];
    $$('input, select, textarea', form).forEach(el => {
      if (!el.name || el.name === 'consent') return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      if (!el.value.trim()) return;
      const lbl = el.type === 'radio' ? (el.closest('.form__group')?.querySelector('.form__lbl')?.textContent || el.name) : (el.closest('label')?.querySelector('span')?.textContent || el.name).replace(' *', '');
      fields.push([lbl, el.value.trim()]);
    });
    const btnEl = form.querySelector('[type=submit]'); btnEl.classList.add('is-loading'); btnEl.disabled = true;
    try { await deliver(FORMS[key].title, fields); success(form); }
    catch (err) { console.error(err); toast('Не удалось отправить. Напишите нам напрямую — контакты рядом.'); }
    finally { btnEl.classList.remove('is-loading'); btnEl.disabled = false; }
  }));
  $$('[data-form-reset]').forEach(b => b.addEventListener('click', () => { $$('.form').forEach(f => f.reset()); const k = $('.ftab.is-active')?.dataset.ftab || 'trial'; selectForm(k); }));
  document.addEventListener('change', e => { const w = e.target.closest('.is-error'); if (w) w.classList.remove('is-error'); });
}

function success(form) {
  form.reset();
  $$('.form').forEach(f => f.classList.remove('is-active'));
  const s = $('.form__success'); s.hidden = false;
  gsap.fromTo(s.children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1, ease: 'expo.out' });
  gsap.fromTo('.form__check circle', { strokeDashoffset: 160 }, { strokeDashoffset: 0, duration: 1, ease: 'power2.out' });
  gsap.fromTo('.form__check path', { strokeDashoffset: 50 }, { strokeDashoffset: 0, duration: 0.6, delay: 0.6, ease: 'power2.out' });
}

async function deliver(title, fields) {
  const d = (C.apply || {}).delivery || {};
  const k = C.contacts || {};
  const text = `Заявка с сайта ${plain(C.settings.brandLeft)} • ${plain(C.settings.brandRight)}\n${title}\n\n` + fields.map(([a, b]) => `${a}: ${b}`).join('\n');
  const obj = Object.fromEntries(fields);
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().catch(() => ({}));
  };
  if (d.method === 'web3forms' && d.web3formsKey) {
    const j = await post('https://api.web3forms.com/submit', { access_key: d.web3formsKey, subject: title, from_name: 'Сайт SELF • SENSE', message: text, ...obj });
    if (j.success === false) throw new Error(j.message || 'web3forms');
    return;
  }
  if (d.method === 'formspree' && d.formspreeId) { await post('https://formspree.io/f/' + d.formspreeId.replace(/^.*\/f\//, ''), { _subject: title, message: text, ...obj }); return; }
  if (d.method === 'telegram' && d.telegramBotToken && d.telegramChatId) { await post(`https://api.telegram.org/bot${d.telegramBotToken}/sendMessage`, { chat_id: d.telegramChatId, text }); return; }
  // мессенджер / почта без сервера
  const ms = d.messenger || 'whatsapp';
  if (ms === 'telegram' && has(k.telegram)) {
    try { await navigator.clipboard.writeText(text); toast('Текст заявки скопирован — вставьте его в чат'); } catch (e) { /* ignore */ }
    window.open('https://t.me/' + k.telegram.replace('@', ''), '_blank', 'noopener');
  } else if (ms === 'email' && has(k.email)) {
    location.href = `mailto:${k.email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  } else if (has(k.whatsapp)) {
    window.open(`https://wa.me/${k.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  } else throw new Error('Не настроен способ отправки');
}

/* ---------- меню и якоря ---------- */
function initNav() {
  const burger = $('#burger'), menu = $('#menu');
  const setMenu = open => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); menu.setAttribute('aria-hidden', !open);
    if (open) {
      lenis && lenis.stop();
      gsap.fromTo('.menu__bg', { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: 1, ease: 'expo.inOut' });
      gsap.fromTo('.menu__link', { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.06, duration: 1, ease: 'expo.out', delay: 0.35 });
      gsap.fromTo('.menu__foot > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.8, delay: 0.6 });
    } else {
      lenis && lenis.start();
      gsap.to('.menu__bg', { clipPath: 'circle(0% at 100% 0%)', duration: 0.8, ease: 'expo.inOut' });
    }
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.length < 2 && href !== '#') return;
    e.preventDefault();
    if (document.body.classList.contains('menu-open')) setMenu(false);
    setTimeout(() => scrollToTarget(href === '#' ? '#top' : href), document.body.classList.contains('menu-open') ? 300 : 0);
  });
  // подсветка активного пункта
  $$('.nav__link').forEach(l => {
    const t = $(l.getAttribute('href')); if (!t) return;
    ScrollTrigger.create({ trigger: t, start: 'top 50%', end: 'bottom 50%', onToggle: s => l.classList.toggle('is-active', s.isActive) });
  });
}

/* ---------- тост ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('is-show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-show'), 3200);
}

/* ---------- старт ---------- */
async function boot() {
  try { C = await loadContent(); }
  catch (e) {
    console.error(e);
    $('#app').innerHTML = '<div class="boot-error">Не удалось загрузить контент. Если вы открыли файл напрямую с диска — запустите сайт через сервер или GitHub Pages.</div>';
    $('#preloader') && $('#preloader').remove(); document.body.classList.remove('is-loading');
    return;
  }
  applyTheme();
  render();
  initScroll();
  initVideos();
  initCursor();
  initNav();
  initCatalog();
  initModal();
  initLightbox();
  initFaq();
  initForms();
  initAudience();
  initDisciplines();
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
  if (!reduceMotion) initAnimations(); else { document.body.classList.add('reduced'); initMarquees(); }
  initMagnetic();
  if (!reduceMotion) gsap.set('.hero__word .ch', { yPercent: 115 });
  await preloader();
  document.body.classList.remove('is-loading');
  if (lenis) lenis.start();
  if (!reduceMotion) heroIntro();
  ScrollTrigger.refresh();
  addEventListener('load', () => ScrollTrigger.refresh());
  if (location.hash && !location.hash.startsWith('#model-')) setTimeout(() => scrollToTarget(location.hash), 300);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
