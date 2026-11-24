/* SELF • SENSE — админ-панель.
   Редактирует content/content.json и медиафайлы прямо в GitHub-репозитории через GitHub API.
   Каждая публикация = один коммит. GitHub Pages пересобирает сайт автоматически (~1 мин). */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(k => { if (k === null || k === undefined || k === false) return; el.append(k.nodeType ? k : document.createTextNode(k)); });
  return el;
};
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const slug = s => String(s || '').toLowerCase().split('').map(c => TR[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
const thumbOf = p => (p && p.startsWith('media/img/')) ? p.replace('media/img/', 'media/thumb/') : p;

/* ---------- состояние ---------- */
const A = {
  mode: 'github', token: '', owner: '', repo: '', branch: 'main',
  content: null, saved: '', remoteSha: null, dirty: false,
  section: 'settings', blobs: {}, tree: null
};
const LS = { cred: 'ss_admin_cred', draft: 'ss_admin_draft', preview: 'ss_preview' };

/* ---------- схема редактора ---------- */
const LINK = [{ k: 'label', t: 'text', l: 'Текст кнопки' }, { k: 'href', t: 'anchor', l: 'Ссылка (якорь или URL)' }];
const VIDEO = [{ k: 'src', t: 'video', l: 'Видео (mp4)', poster: 'poster' }, { k: 'poster', t: 'image', l: 'Обложка видео' }];
const SCHEMA = [
  { group: 'Основное' },
  { id: 'settings', title: 'Общие настройки', icon: '⚙', fields: [
    { k: 'brandLeft', t: 'text', l: 'Логотип — левая часть', w: 'half' },
    { k: 'brandRight', t: 'text', l: 'Логотип — правая часть', w: 'half' },
    { k: 'descriptor', t: 'text', l: 'Подпись бренда' },
    { k: 'accent', t: 'color', l: 'Акцентный (винный) цвет', w: 'third' },
    { k: 'ink', t: 'color', l: 'Тёмный цвет', w: 'third' },
    { k: 'paper', t: 'color', l: 'Светлый фон', w: 'third' },
    { k: 'preloader', t: 'toggle', l: 'Показывать прелоадер с логотипом', w: 'third' },
    { k: 'cursor', t: 'toggle', l: 'Фирменный курсор', w: 'third' },
    { k: 'smoothScroll', t: 'toggle', l: 'Плавный скролл', w: 'third' },
    { k: 'seo', t: 'group', l: 'SEO и соцсети', fields: [
      { k: 'title', t: 'text', l: 'Заголовок страницы (title)' },
      { k: 'description', t: 'textarea', l: 'Описание для поисковиков' },
      { k: 'ogImage', t: 'image', l: 'Картинка для превью в мессенджерах (1200×630)' }
    ] }
  ] },
  { id: 'contacts', title: 'Контакты', icon: '☎', fields: [
    { k: 'phone', t: 'text', l: 'Телефон', w: 'half' },
    { k: 'email', t: 'text', l: 'E-mail', w: 'half' },
    { k: 'telegram', t: 'text', l: 'Telegram (без @)', w: 'half' },
    { k: 'whatsapp', t: 'text', l: 'WhatsApp (только цифры, 79001234567)', w: 'half' },
    { k: 'instagram', t: 'text', l: 'Instagram (без @)', w: 'half' },
    { k: 'vk', t: 'text', l: 'VK (ссылка или короткое имя)', w: 'half' },
    { k: 'address', t: 'text', l: 'Адрес' },
    { k: 'hours', t: 'text', l: 'Время работы' }
  ], hint: 'Пустые поля на сайте не показываются.' },
  { id: 'nav', title: 'Меню', icon: '≡', root: 'list', item: LINK.map(f => f.k === 'label' ? { ...f, l: 'Пункт меню' } : f), itemLabel: 'label', add: { label: 'Новый пункт', href: '#apply' } },
  { id: 'sections', title: 'Порядок и видимость секций', icon: '⇅', special: 'sections' },
  { id: 'footer', title: 'Подвал', icon: '▁', fields: [
    { k: 'text', t: 'text', l: 'Фраза над кнопкой' },
    { k: 'copyright', t: 'text', l: 'Копирайт' }
  ] },
  { group: 'Секции сайта' },
  { id: 'hero', title: 'Главный экран', icon: '◉', fields: [
    { k: 'kicker', t: 'text', l: 'Надпись сверху слева', w: 'half' },
    { k: 'tagline', t: 'text', l: 'Надпись сверху справа', w: 'half' },
    { k: 'subtitle', t: 'rich', l: 'Подзаголовок' },
    { k: 'note', t: 'text', l: 'Строка справа внизу' },
    { k: 'cta', t: 'group', l: 'Кнопка 1', fields: LINK, w: 'half' },
    { k: 'cta2', t: 'group', l: 'Кнопка 2', fields: LINK, w: 'half' },
    { k: 'videos', t: 'list', l: 'Видео (3 шт.: слева, по центру, справа; на телефоне — центральное)', item: VIDEO, itemLabel: (it, i) => ['Слева', 'По центру', 'Справа'][i] || `Видео ${i + 1}`, thumb: 'poster', add: { src: '', poster: '' }, max: 3 }
  ] },
  { id: 'manifesto', title: 'Философия', icon: '❝', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'text', t: 'rich', l: 'Текст манифеста', rows: 6, hint: '*слово* — курсив акцентным цветом. [img:media/img/имя.webp] — маленькое фото прямо в тексте (путь можно взять в медиатеке).', insertImg: true },
    { k: 'signature', t: 'text', l: 'Подпись' }
  ] },
  { id: 'values', title: 'Ценности', icon: '◇', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'items', t: 'list', l: 'Карточки', item: [{ k: 'title', t: 'text', l: 'Название' }, { k: 'text', t: 'textarea', l: 'Текст' }, { k: 'image', t: 'image', l: 'Фото' }], itemLabel: 'title', thumb: 'image', add: { title: 'Новая ценность', text: '', image: '' } }
  ] },
  { id: 'marquee', title: 'Бегущая строка', icon: '⇢', fields: [
    { k: 'items', t: 'strings', l: 'Слова' },
    { k: 'images', t: 'images', l: 'Фото между словами' }
  ] },
  { id: 'audience', title: 'Для кого', icon: '☺', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'items', t: 'list', l: 'Колонки', item: [{ k: 'age', t: 'text', l: 'Возраст (крупно)', w: 'half' }, { k: 'title', t: 'text', l: 'Название', w: 'half' }, { k: 'text', t: 'textarea', l: 'Текст' }, { k: 'image', t: 'image', l: 'Фото (если пусто — колонка будет акцентной с цифрой)' }], itemLabel: it => `${it.age} — ${it.title}`, thumb: 'image', add: { age: '', title: 'Новая колонка', text: '', image: '' } }
  ] },
  { id: 'courses', title: 'Курсы', icon: '✎', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Вступительный текст' },
    { k: 'items', t: 'list', l: 'Курсы', itemLabel: 'title', thumb: 'image', add: () => ({ id: 'course-' + Date.now().toString(36), tag: 'Новый курс', title: 'Название курса', duration: '', hours: '', start: '', program: [], included: [], bonus: '', priceMonth: '', priceMonthLabel: 'за 4 недели', priceFull: '', priceFullLabel: 'за весь курс', image: '', image2: '' }), item: [
      { k: 'title', t: 'text', l: 'Название курса' },
      { k: 'tag', t: 'text', l: 'Метка (например: Дети · 3+)', w: 'half' },
      { k: 'id', t: 'text', l: 'ID (латиницей, для формы записи)', w: 'half' },
      { k: 'duration', t: 'text', l: 'Длительность', w: 'third' },
      { k: 'hours', t: 'text', l: 'Объём (часы)', w: 'third' },
      { k: 'start', t: 'text', l: 'Старт', w: 'third' },
      { k: 'program', t: 'strings', l: 'В программе' },
      { k: 'included', t: 'strings', l: 'Входит в курс' },
      { k: 'bonus', t: 'text', l: 'Бонус' },
      { k: 'priceMonth', t: 'text', l: 'Цена 1', w: 'half' },
      { k: 'priceMonthLabel', t: 'text', l: 'Подпись к цене 1', w: 'half' },
      { k: 'priceFull', t: 'text', l: 'Цена 2', w: 'half' },
      { k: 'priceFullLabel', t: 'text', l: 'Подпись к цене 2', w: 'half' },
      { k: 'image', t: 'image', l: 'Главное фото', w: 'half' },
      { k: 'image2', t: 'image', l: 'Маленькое фото', w: 'half' }
    ] }
  ] },
  { id: 'disciplines', title: 'Программа (дисциплины)', icon: '☰', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'items', t: 'list', l: 'Дисциплины', item: [{ k: 'title', t: 'text', l: 'Название' }, { k: 'text', t: 'text', l: 'Описание' }, { k: 'image', t: 'image', l: 'Фото при наведении' }], itemLabel: 'title', thumb: 'image', add: { title: 'Новая дисциплина', text: '', image: '' } }
  ] },
  { id: 'stats', title: 'Цифры', icon: '#', fields: [
    { k: 'items', t: 'list', l: 'Показатели', item: [{ k: 'value', t: 'text', l: 'Число (анимируется, если только цифры)', w: 'half' }, { k: 'suffix', t: 'text', l: 'Знак после числа (+, %, ∞)', w: 'half' }, { k: 'label', t: 'text', l: 'Подпись' }], itemLabel: it => `${it.value}${it.suffix || ''} — ${it.label}`, add: { value: '10', suffix: '', label: 'Подпись' } }
  ] },
  { id: 'runway', title: 'Выпускной показ', icon: '★', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст' },
    { k: 'video', t: 'video', l: 'Большое видео', w: 'half', poster: 'poster' },
    { k: 'poster', t: 'image', l: 'Обложка большого видео', w: 'half' },
    { k: 'video2', t: 'video', l: 'Малое видео', w: 'half', poster: 'poster2' },
    { k: 'poster2', t: 'image', l: 'Обложка малого видео', w: 'half' }
  ] },
  { id: 'zoom', title: 'Акцентный кадр', icon: '⤢', fields: [
    { k: 'titleLeft', t: 'text', l: 'Слово слева', w: 'half' },
    { k: 'titleRight', t: 'text', l: 'Слово справа', w: 'half' },
    { k: 'image', t: 'image', l: 'Фото, раскрывающееся на весь экран' },
    { k: 'caption', t: 'rich', l: 'Подпись на фото' }
  ] },
  { id: 'catalog', title: 'Каталог моделей', icon: '♛', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Подсказка справа' },
    { k: 'models', t: 'list', l: 'Модели', cards: true, itemLabel: 'name', thumb: 'photos', sub: it => [catName(it.category), ageText(it.birthYear), it.height ? it.height + ' см' : ''].filter(Boolean).join(' · '),
      add: () => ({ id: '', name: 'Новая модель', category: 'kids', gender: 'f', birthYear: new Date().getFullYear() - 10, city: '', height: '', bust: '', waist: '', hips: '', shoes: '', clothes: '', hair: '', eyes: '', about: '', photos: [], featured: false, tags: [] }),
      item: [
        { k: 'name', t: 'text', l: 'Имя', w: 'half', onChange: (it) => { if (!it.id || it._autoId) { it.id = slug(it.name); it._autoId = true; } } },
        { k: 'id', t: 'text', l: 'ID для ссылки (латиницей)', w: 'half', onChange: it => { it._autoId = false; } },
        { k: 'category', t: 'select', l: 'Категория', w: 'third', options: () => (A.content.catalog.categories || []).map(c => [c.id, `${c.label} (${c.range})`]) },
        { k: 'gender', t: 'select', l: 'Пол', w: 'third', options: [['f', 'Девушка / девочка'], ['m', 'Юноша / мальчик']] },
        { k: 'birthYear', t: 'number', l: 'Год рождения (возраст считается сам)', w: 'third' },
        { k: 'height', t: 'text', l: 'Рост, см', w: 'third' },
        { k: 'bust', t: 'text', l: 'Грудь', w: 'third' },
        { k: 'waist', t: 'text', l: 'Талия', w: 'third' },
        { k: 'hips', t: 'text', l: 'Бёдра', w: 'third' },
        { k: 'shoes', t: 'text', l: 'Обувь', w: 'third' },
        { k: 'clothes', t: 'text', l: 'Размер одежды', w: 'third' },
        { k: 'hair', t: 'text', l: 'Волосы', w: 'third' },
        { k: 'eyes', t: 'text', l: 'Глаза', w: 'third' },
        { k: 'city', t: 'text', l: 'Город', w: 'third' },
        { k: 'about', t: 'textarea', l: 'Описание' },
        { k: 'tags', t: 'strings', l: 'Теги (fashion, коммерция…)' },
        { k: 'featured', t: 'toggle', l: 'Метка «Selected» на карточке' },
        { k: 'photos', t: 'images', l: 'Фотографии (первые 6 листаются при наведении, первая — обложка)' }
      ] },
    { k: 'categories', t: 'list', l: 'Категории (фильтры)', item: [{ k: 'label', t: 'text', l: 'Название', w: 'third' }, { k: 'range', t: 'text', l: 'Возраст', w: 'third' }, { k: 'id', t: 'text', l: 'ID (латиницей)', w: 'third' }], itemLabel: 'label', add: { id: 'new', label: 'Новая', range: '' } },
    { k: 'emptyTitle', t: 'text', l: 'Заголовок, если в категории нет моделей' },
    { k: 'emptyText', t: 'textarea', l: 'Текст, если в категории нет моделей' }
  ] },
  { id: 'campaigns', title: 'Кампании брендов', icon: '✦', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст' },
    { k: 'brands', t: 'strings', l: 'Бренды в бегущей строке' },
    { k: 'items', t: 'list', l: 'Работы', cards: true, item: [{ k: 'image', t: 'image', l: 'Фото' }, { k: 'brand', t: 'text', l: 'Подпись (бренд)' }], itemLabel: 'brand', thumb: 'image', add: { image: '', brand: '' }, bulk: { field: 'image', base: { brand: '' } } }
  ] },
  { id: 'portfolio', title: 'Съёмки портфолио', icon: '◎', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст' },
    { k: 'features', t: 'list', l: 'Что входит', item: [{ k: 'title', t: 'text', l: 'Пункт' }, { k: 'text', t: 'text', l: 'Пояснение' }], itemLabel: 'title', add: { title: 'Новый пункт', text: '' } },
    { k: 'price', t: 'text', l: 'Цена' },
    { k: 'cta', t: 'group', l: 'Кнопка', fields: LINK },
    { k: 'videos', t: 'list', l: 'Видео бэкстейджа', item: VIDEO, itemLabel: (it, i) => `Видео ${i + 1}`, thumb: 'poster', add: { src: '', poster: '' } },
    { k: 'images', t: 'images', l: 'Фото' }
  ] },
  { id: 'promotion', title: 'Онлайн-продвижение', icon: '➚', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст', rows: 5 },
    { k: 'format', t: 'text', l: 'Формат', w: 'half' },
    { k: 'price', t: 'text', l: 'Цена', w: 'half' },
    { k: 'steps', t: 'list', l: 'Шаги', item: [{ k: 'title', t: 'text', l: 'Шаг' }, { k: 'text', t: 'textarea', l: 'Описание' }], itemLabel: 'title', add: { title: 'Новый шаг', text: '' } },
    { k: 'image', t: 'image', l: 'Большое фото', w: 'half' },
    { k: 'image2', t: 'image', l: 'Малое фото', w: 'half' },
    { k: 'cta', t: 'group', l: 'Кнопка', fields: LINK }
  ] },
  { id: 'services', title: 'Доп. услуги', icon: '+', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'items', t: 'list', l: 'Услуги', item: [{ k: 'title', t: 'text', l: 'Название' }, { k: 'text', t: 'textarea', l: 'Описание' }, { k: 'image', t: 'image', l: 'Фото' }], itemLabel: 'title', thumb: 'image', add: { title: 'Новая услуга', text: '', image: '' } }
  ] },
  { id: 'senior', title: 'Модели 60+ / 70+', icon: '♥', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'big1', t: 'text', l: 'Крупная цифра 1', w: 'half' },
    { k: 'big2', t: 'text', l: 'Крупная цифра 2', w: 'half' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст' },
    { k: 'cta', t: 'group', l: 'Кнопка', fields: LINK }
  ] },
  { id: 'gallery', title: 'Галерея', icon: '▦', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'row1', t: 'images', l: 'Ряд 1' },
    { k: 'row2', t: 'images', l: 'Ряд 2' },
    { k: 'row3', t: 'images', l: 'Ряд 3' }
  ] },
  { id: 'faq', title: 'Вопросы и ответы', icon: '?', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'items', t: 'list', l: 'Вопросы', item: [{ k: 'q', t: 'text', l: 'Вопрос' }, { k: 'a', t: 'textarea', l: 'Ответ' }], itemLabel: 'q', add: { q: 'Новый вопрос', a: '' } }
  ] },
  { id: 'apply', title: 'Запись и заявки', icon: '✉', fields: [
    { k: 'label', t: 'text', l: 'Метка секции' },
    { k: 'title', t: 'rich', l: 'Заголовок' },
    { k: 'text', t: 'textarea', l: 'Текст' },
    { k: 'image', t: 'image', l: 'Фото' },
    { k: 'trialDays', t: 'days', l: 'Дни пробных уроков' },
    { k: 'trialTimes', t: 'strings', l: 'Время пробных уроков' },
    { k: 'trialDaysAhead', t: 'number', l: 'На сколько дней вперёд показывать даты' },
    { k: 'consent', t: 'text', l: 'Текст согласия' },
    { k: 'success', t: 'textarea', l: 'Сообщение после отправки' },
    { k: 'delivery', t: 'group', l: 'Куда приходят заявки', hint: 'Самый простой надёжный вариант — Web3Forms: зайдите на web3forms.com, введите вашу почту, получите Access Key и вставьте его ниже. Заявки будут приходить на почту. Без настройки заявка открывается в WhatsApp / Telegram / почте с готовым текстом.', fields: [
      { k: 'method', t: 'select', l: 'Способ', options: [['messenger', 'Без сервера: открыть мессенджер/почту с текстом'], ['web3forms', 'Web3Forms — на e-mail (рекомендуется)'], ['formspree', 'Formspree — на e-mail'], ['telegram', 'Telegram-бот (токен будет виден в коде сайта)']] },
      { k: 'messenger', t: 'select', l: 'Мессенджер для способа «Без сервера»', options: [['whatsapp', 'WhatsApp (номер из Контактов)'], ['telegram', 'Telegram (ник из Контактов)'], ['email', 'Почта (e-mail из Контактов)']] },
      { k: 'web3formsKey', t: 'text', l: 'Web3Forms Access Key', w: 'half' },
      { k: 'formspreeId', t: 'text', l: 'Formspree ID формы', w: 'half' },
      { k: 'telegramBotToken', t: 'text', l: 'Telegram: токен бота', w: 'half' },
      { k: 'telegramChatId', t: 'text', l: 'Telegram: chat_id', w: 'half' }
    ] }
  ] },
  { group: 'Инструменты' },
  { id: '_media', title: 'Медиатека', icon: '▣', special: 'media' },
  { id: '_json', title: 'JSON (для профи)', icon: '{}', special: 'json' },
  { id: '_help', title: 'Помощь', icon: 'i', special: 'help' }
];
const SEC = Object.fromEntries(SCHEMA.filter(s => s.id).map(s => [s.id, s]));
const catName = id => ((A.content.catalog.categories || []).find(c => c.id === id) || {}).label || id;
const ageText = y => { const a = new Date().getFullYear() - Number(y); if (!isFinite(a) || a <= 0 || a > 120) return ''; const n = a % 100, n1 = a % 10; return a + ' ' + (n > 10 && n < 20 ? 'лет' : n1 === 1 ? 'год' : n1 > 1 && n1 < 5 ? 'года' : 'лет'); };

/* ---------- GitHub API ---------- */
async function gh(path, opts = {}) {
  const headers = { Authorization: 'Bearer ' + A.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) };
  if (opts.body) headers['Content-Type'] = 'application/json';
  const api = localStorage.getItem('ss_api_base') || 'https://api.github.com'; // для локального тестирования
  const r = await fetch(api + path, { ...opts, headers, cache: 'no-store' });
  if (!r.ok) {
    let msg = ''; try { msg = (await r.json()).message; } catch (e) { /* ignore */ }
    const err = new Error(`GitHub ${r.status}${msg ? ': ' + msg : ''}`); err.status = r.status; throw err;
  }
  return r.status === 204 ? null : r.json();
}
const repoPath = p => `/repos/${A.owner}/${A.repo}${p}`;
const b64FromUtf8 = str => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const utf8FromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const b64FromBlob = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });

async function readFile(path) {
  const j = await gh(repoPath(`/contents/${path}?ref=${encodeURIComponent(A.branch)}&t=${Date.now()}`));
  return { text: utf8FromB64(j.content || ''), sha: j.sha };
}

/** Коммит набора файлов одним коммитом. files: [{path, b64}] или {path, delete:true} */
async function commitFiles(files, message) {
  const blobs = [];
  for (const f of files) {
    if (f.delete) { blobs.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
    const b = await gh(repoPath('/git/blobs'), { method: 'POST', body: JSON.stringify({ content: f.b64, encoding: 'base64' }) });
    blobs.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = await gh(repoPath(`/git/ref/heads/${encodeURIComponent(A.branch)}`));
    const baseSha = ref.object.sha;
    const baseCommit = await gh(repoPath(`/git/commits/${baseSha}`));
    const tree = await gh(repoPath('/git/trees'), { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }) });
    const commit = await gh(repoPath('/git/commits'), { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }) });
    try {
      await gh(repoPath(`/git/refs/heads/${encodeURIComponent(A.branch)}`), { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      return commit;
    } catch (e) { if (e.status === 422 && attempt < 3) continue; throw e; }
  }
}

/* ---------- вход ---------- */
function detectRepo() {
  const host = location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean);
    const repo = seg.length > 1 ? seg[0] : `${owner}.github.io`;
    return { owner, repo };
  }
  return {};
}
function initLogin() {
  const f = $('#loginForm');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS.cred) || sessionStorage.getItem(LS.cred) || '{}'); } catch (e) { /* ignore */ }
  const det = detectRepo();
  f.owner.value = saved.owner || det.owner || '';
  f.repo.value = saved.repo || det.repo || '';
  f.branch.value = saved.branch || 'main';
  if (saved.token) { f.token.value = saved.token; login(saved, true); }
  f.addEventListener('submit', e => {
    e.preventDefault();
    const cred = { token: f.token.value.trim(), owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || 'main' };
    (f.remember.checked ? localStorage : sessionStorage).setItem(LS.cred, JSON.stringify(cred));
    login(cred);
  });
  $('#localMode').addEventListener('click', async () => {
    A.mode = 'local';
    try {
      const r = await fetch('../content/content.json?t=' + Date.now(), { cache: 'no-store' });
      startApp(await r.json());
      toast('Локальный режим: изменения сохраняются в файл content.json (кнопка «Скачать»). Загрузка фото недоступна.', 'warn', 7000);
    } catch (e) { showLoginErr('Не удалось прочитать ../content/content.json. Откройте админку через веб-сервер.'); }
  });
}
function showLoginErr(msg) { const el = $('#loginErr'); el.textContent = msg; el.hidden = false; }
async function login(cred, silent) {
  Object.assign(A, cred, { mode: 'github' });
  busy('Проверяем доступ…');
  try {
    const repo = await gh(repoPath(''));
    if (repo.permissions && repo.permissions.push === false) throw new Error('У токена нет прав на запись в этот репозиторий (нужно Contents: Read and write).');
    const file = await readFile('content/content.json');
    A.remoteSha = file.sha;
    startApp(JSON.parse(file.text));
  } catch (e) {
    console.error(e);
    if (!silent || e.status !== 401) showLoginErr(e.status === 401 ? 'Неверный или просроченный токен.' : e.status === 404 ? 'Репозиторий или файл content/content.json не найден. Проверьте владельца, имя репозитория и ветку, и что у токена есть доступ к этому репозиторию.' : e.message);
    if (e.status === 401) { localStorage.removeItem(LS.cred); sessionStorage.removeItem(LS.cred); }
  } finally { unbusy(); }
}

/* ---------- приложение ---------- */
function startApp(content) {
  A.content = content;
  A.saved = JSON.stringify(content);
  $('#login').hidden = true; $('#app').hidden = false;
  $('#repoInfo').innerHTML = A.mode === 'github' ? `<b>${esc(A.owner)}/${esc(A.repo)}</b><span>ветка ${esc(A.branch)}</span>` : '<b>Локальный режим</b><span>без GitHub</span>';
  $('#publishBtn').textContent = A.mode === 'github' ? 'Опубликовать' : 'Скачать content.json';
  // восстановление черновика
  try {
    const d = JSON.parse(localStorage.getItem(LS.draft) || 'null');
    if (d && d.repo === `${A.owner}/${A.repo}` && d.json !== A.saved && d.base === A.saved) {
      if (confirm('Найден несохранённый черновик с прошлого раза. Восстановить его?')) { A.content = JSON.parse(d.json); }
      else localStorage.removeItem(LS.draft);
    }
  } catch (e) { /* ignore */ }
  buildNav();
  const hash = location.hash.slice(1);
  openSection(SEC[hash] ? hash : 'settings');
  updateStatus();
  bindTop();
}

function buildNav() {
  const nav = $('#sideNav'); nav.innerHTML = '';
  SCHEMA.forEach(s => {
    if (s.group) { nav.append(h('div', { class: 'side__group' }, s.group)); return; }
    nav.append(h('button', { class: 'side__item', 'data-sec': s.id, onclick: () => { openSection(s.id); document.body.classList.remove('side-open'); } }, h('i', {}, s.icon || '•'), h('span', {}, s.title)));
  });
}

function openSection(id) {
  A.section = id;
  history.replaceState(null, '', '#' + id);
  $$('.side__item').forEach(b => b.classList.toggle('is-on', b.dataset.sec === id));
  const s = SEC[id];
  $('#topTitle').textContent = s.title;
  const c = $('#content'); c.innerHTML = ''; c.scrollTop = 0;
  const head = h('div', { class: 'sec-head' }, h('h1', {}, s.title));
  const siteSection = (A.content.sections || []).find(x => x.id === id);
  if (siteSection) {
    const vis = h('label', { class: 'switch' }, h('input', { type: 'checkbox', ...(siteSection.visible !== false ? { checked: true } : {}), onchange: e => { siteSection.visible = e.target.checked; changed(); } }), h('span', {}), 'Показывать на сайте');
    head.append(h('div', { class: 'sec-head__tools' }, vis, h('a', { class: 'a-btn a-btn--sm', href: `../#${id === 'hero' ? 'top' : id}`, target: '_blank', rel: 'noopener' }, 'Открыть на сайте ↗')));
  }
  c.append(head);
  if (s.hint) c.append(h('p', { class: 'hint' }, s.hint));
  if (s.special === 'sections') return renderSectionsOrder(c);
  if (s.special === 'media') return renderMediaPage(c);
  if (s.special === 'json') return renderJson(c);
  if (s.special === 'help') return renderHelp(c);
  if (s.root === 'list') {
    if (!Array.isArray(A.content[id])) A.content[id] = [];
    c.append(renderList(A.content[id], s, () => { openSection(id); return $('#content .list'); }));
    return;
  }
  if (!A.content[id] || typeof A.content[id] !== 'object') A.content[id] = {};
  c.append(renderFields(A.content[id], s.fields));
}

/* ---------- поля ---------- */
function renderFields(obj, fields) {
  const wrap = h('div', { class: 'fields' });
  fields.forEach(f => wrap.append(renderField(obj, f)));
  return wrap;
}
function fieldBox(f, ...kids) {
  return h('div', { class: `fld fld--${f.t} ${f.w ? 'w-' + f.w : ''}` }, f.l ? h('div', { class: 'fld__label' }, f.l) : null, ...kids, f.hint ? h('div', { class: 'fld__hint' }, f.hint) : null);
}
function renderField(obj, f) {
  const set = v => { obj[f.k] = v; if (f.onChange) f.onChange(obj); changed(); };
  const val = obj[f.k];
  switch (f.t) {
    case 'text': case 'anchor': {
      const inp = h('input', { type: 'text', value: val ?? '', oninput: e => set(e.target.value) });
      if (f.t === 'anchor') {
        const dl = 'anchors'; inp.setAttribute('list', dl);
        if (!$('#' + dl)) document.body.append(h('datalist', { id: dl }, ['#top', ...(A.content.sections || []).map(s => '#' + s.id)].map(v => h('option', { value: v }))));
      }
      if (f.onChange && f.k === 'name') inp.addEventListener('input', () => { const fs = inp.closest('.fields'); const idInp = fs && fs.querySelector('[data-k="id"] input'); if (idInp && obj._autoId) idInp.value = obj.id; });
      const box = fieldBox(f, inp); box.dataset.k = f.k; return box;
    }
    case 'number': return fieldBox(f, h('input', { type: 'number', value: val ?? '', oninput: e => set(e.target.value === '' ? '' : Number(e.target.value)) }));
    case 'textarea': case 'rich': {
      const ta = h('textarea', { rows: f.rows || (f.t === 'rich' ? 2 : 3), oninput: e => set(e.target.value) }); ta.value = val ?? '';
      const extra = [];
      if (f.t === 'rich' && !f.hint) extra.push(h('div', { class: 'fld__hint' }, 'Подсказка: *слово* — курсив акцентным цветом.'));
      if (f.insertImg) extra.push(h('button', { class: 'a-btn a-btn--sm', type: 'button', onclick: () => pickMedia({ type: 'img' }).then(sel => { if (!sel || !sel[0]) return; const ins = ` [img:${sel[0]}] `; const p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + ins + ta.value.slice(p); set(ta.value); }) }, '＋ Вставить фото в текст'));
      return fieldBox(f, ta, ...extra);
    }
    case 'toggle': return fieldBox({ ...f, l: '' }, h('label', { class: 'switch' }, h('input', { type: 'checkbox', ...(val ? { checked: true } : {}), onchange: e => set(e.target.checked) }), h('span', {}), f.l));
    case 'color': {
      const txt = h('input', { type: 'text', value: val || '', class: 'color-txt', oninput: e => { set(e.target.value); pick.value = /^#[0-9a-f]{6}$/i.test(e.target.value) ? e.target.value : pick.value; } });
      const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#000000', oninput: e => { txt.value = e.target.value; set(e.target.value); } });
      return fieldBox(f, h('div', { class: 'color' }, pick, txt));
    }
    case 'select': {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      const sel = h('select', { onchange: e => set(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, ...(String(val) === String(v) ? { selected: true } : {}) }, l)));
      if (!opts.some(([v]) => String(v) === String(val)) && val) sel.prepend(h('option', { value: val, selected: true }, val));
      return fieldBox(f, sel);
    }
    case 'days': {
      const days = Array.isArray(val) ? val.map(Number) : [];
      const names = [[1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [0, 'Вс']];
      return fieldBox(f, h('div', { class: 'days' }, names.map(([n, l]) => h('label', { class: 'day' }, h('input', { type: 'checkbox', ...(days.includes(n) ? { checked: true } : {}), onchange: e => { const cur = new Set((obj[f.k] || []).map(Number)); e.target.checked ? cur.add(n) : cur.delete(n); set([...cur].sort()); } }), h('span', {}, l)))));
    }
    case 'strings': return fieldBox(f, renderStrings(obj, f));
    case 'image': return fieldBox(f, renderImage(obj, f));
    case 'video': return fieldBox(f, renderVideo(obj, f));
    case 'images': return fieldBox(f, renderImages(obj, f));
    case 'group': {
      if (!obj[f.k] || typeof obj[f.k] !== 'object') obj[f.k] = {};
      return h('fieldset', { class: `group ${f.w ? 'w-' + f.w : ''}` }, h('legend', {}, f.l), f.hint ? h('p', { class: 'hint' }, f.hint) : null, renderFields(obj[f.k], f.fields));
    }
    case 'list': {
      if (!Array.isArray(obj[f.k])) obj[f.k] = [];
      const box = h('div', { class: 'fld fld--list w-full' }, h('div', { class: 'fld__label' }, f.l));
      const rerender = () => { const n = renderList(obj[f.k], f, rerender); box.replaceChild(n, box.lastChild); return n; };
      box.append(renderList(obj[f.k], f, rerender));
      return box;
    }
    default: return fieldBox(f, h('div', {}, 'Неизвестный тип поля'));
  }
}

/* --- список строк (теги) --- */
function renderStrings(obj, f) {
  if (!Array.isArray(obj[f.k])) obj[f.k] = [];
  const arr = obj[f.k];
  const box = h('div', { class: 'tags' });
  const draw = () => {
    box.innerHTML = '';
    arr.forEach((s, i) => {
      const chip = h('span', { class: 'tag', draggable: 'true' }, h('span', { contenteditable: 'true', spellcheck: 'false', oninput: e => { arr[i] = e.target.textContent; changed(); } }, s), h('button', { type: 'button', title: 'Удалить', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, '×'));
      dnd(chip, arr, i, draw);
      box.append(chip);
    });
    const inp = h('input', { class: 'tags__inp', placeholder: '+ добавить (Enter)', onkeydown: e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); inp.value.split(/\s*[;,]\s*/).filter(Boolean).forEach(v => arr.push(v)); changed(); draw(); box.querySelector('.tags__inp').focus(); } } });
    box.append(inp);
  };
  draw();
  return box;
}

/* --- одно изображение --- */
function mediaUrl(path) {
  if (!path) return '';
  if (A.blobs[path]) return A.blobs[path];
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return '../' + path;
}
function thumbUrl(path) { return A.blobs[path] || A.blobs[thumbOf(path)] || mediaUrl(thumbOf(path)); }
function renderImage(obj, f) {
  const box = h('div', { class: 'img1' });
  const draw = () => {
    const v = obj[f.k];
    box.innerHTML = '';
    box.append(
      h('div', { class: 'img1__pic' + (v ? '' : ' is-empty'), onclick: () => choose() }, v ? h('img', { src: thumbUrl(v), loading: 'lazy', onerror: e => { e.target.src = mediaUrl(v); e.target.onerror = null; } }) : h('span', {}, 'Нет фото')),
      h('div', { class: 'img1__side' },
        h('input', { type: 'text', value: v || '', placeholder: 'media/img/…', onchange: e => { obj[f.k] = e.target.value.trim(); changed(); draw(); } }),
        h('div', { class: 'img1__btns' },
          h('button', { type: 'button', class: 'a-btn a-btn--sm', onclick: () => choose() }, 'Медиатека'),
          h('button', { type: 'button', class: 'a-btn a-btn--sm', onclick: () => uploadPick('image/*', false).then(p => { if (p && p[0]) { obj[f.k] = p[0]; changed(); draw(); } }) }, 'Загрузить'),
          v ? h('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--ghost', onclick: () => { obj[f.k] = ''; changed(); draw(); } }, 'Убрать') : null)));
  };
  const choose = () => pickMedia({ type: 'img' }).then(sel => { if (sel && sel[0]) { obj[f.k] = sel[0]; changed(); draw(); } });
  draw();
  return box;
}
function renderVideo(obj, f) {
  const box = h('div', { class: 'img1' });
  const draw = () => {
    const v = obj[f.k];
    box.innerHTML = '';
    box.append(
      h('div', { class: 'img1__pic img1__pic--video' + (v ? '' : ' is-empty') }, v ? h('video', { src: mediaUrl(v), muted: true, loop: true, playsinline: true, preload: 'metadata', onmouseenter: e => e.target.play().catch(() => {}), onmouseleave: e => e.target.pause() }) : h('span', {}, 'Нет видео')),
      h('div', { class: 'img1__side' },
        h('input', { type: 'text', value: v || '', placeholder: 'media/video/…mp4', onchange: e => { obj[f.k] = e.target.value.trim(); changed(); draw(); } }),
        h('div', { class: 'img1__btns' },
          h('button', { type: 'button', class: 'a-btn a-btn--sm', onclick: () => pickMedia({ type: 'video' }).then(sel => { if (sel && sel[0]) { obj[f.k] = sel[0]; autoPoster(obj, f, sel[0]); changed(); redrawSection(); } }) }, 'Медиатека'),
          h('button', { type: 'button', class: 'a-btn a-btn--sm', onclick: () => uploadPick('video/mp4,video/webm,video/quicktime', false).then(p => { if (p && p[0]) { obj[f.k] = p[0]; autoPoster(obj, f, p[0]); changed(); redrawSection(); } }) }, 'Загрузить'),
          v ? h('button', { type: 'button', class: 'a-btn a-btn--sm a-btn--ghost', onclick: () => { obj[f.k] = ''; changed(); draw(); } }, 'Убрать') : null),
        h('div', { class: 'fld__hint' }, 'Лучше MP4 (H.264), 5–15 секунд, до 20 МБ. Видео без звука.')));
  };
  draw();
  return box;
}
function autoPoster(obj, f, videoPath) {
  // подставляем обложку с тем же именем, если она есть (при загрузке админка создаёт её сама)
  if (!f.poster) return;
  const base = videoPath.replace(/\.(mp4|webm|mov)$/i, '');
  const cands = [base + '.webp', base + '.jpg'];
  const found = cands.find(c => A.blobs[c] || (A.tree && A.tree.some(t => t.path === c)));
  if (found) obj[f.poster] = found;
  else if (A.mode === 'local') obj[f.poster] = cands[0];
}
function redrawSection() { const y = $('#content').scrollTop; openSection(A.section); requestAnimationFrame(() => { $('#content').scrollTop = y; }); }

/* --- набор изображений --- */
function renderImages(obj, f) {
  if (!Array.isArray(obj[f.k])) obj[f.k] = [];
  const arr = obj[f.k];
  const box = h('div', { class: 'imgs' });
  const draw = () => {
    box.innerHTML = '';
    arr.forEach((p, i) => {
      const it = h('div', { class: 'imgs__it', draggable: 'true', title: p },
        h('img', { src: thumbUrl(p), loading: 'lazy', onerror: e => { e.target.src = mediaUrl(p); e.target.onerror = null; } }),
        i === 0 ? h('span', { class: 'imgs__badge' }, 'обложка') : null,
        h('button', { type: 'button', class: 'imgs__x', title: 'Убрать из списка', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, '×'),
        h('span', { class: 'imgs__n' }, i + 1));
      dnd(it, arr, i, draw);
      box.append(it);
    });
    box.append(
      h('button', { type: 'button', class: 'imgs__add', onclick: () => uploadPick('image/*', true).then(ps => { if (ps && ps.length) { arr.push(...ps); changed(); draw(); } }) }, h('b', {}, '＋'), 'Загрузить'),
      h('button', { type: 'button', class: 'imgs__add', onclick: () => pickMedia({ type: 'img', multi: true }).then(sel => { if (sel && sel.length) { arr.push(...sel); changed(); draw(); } }) }, h('b', {}, '▣'), 'Медиатека'));
  };
  draw();
  return box;
}

/* перетаскивание для сортировки */
let dragFrom = null, dragArr = null;
function dnd(el, arr, i, redraw) {
  el.addEventListener('dragstart', e => { dragFrom = i; dragArr = arr; el.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) { /* ignore */ } });
  el.addEventListener('dragend', () => { el.classList.remove('is-drag'); $$('.is-over').forEach(x => x.classList.remove('is-over')); });
  el.addEventListener('dragover', e => { if (dragArr === arr) { e.preventDefault(); el.classList.add('is-over'); } });
  el.addEventListener('dragleave', () => el.classList.remove('is-over'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('is-over');
    if (dragArr !== arr || dragFrom === null || dragFrom === i) return;
    const [m] = arr.splice(dragFrom, 1); arr.splice(i, 0, m); dragFrom = null; changed(); redraw();
  });
}

/* --- список объектов --- */
function renderList(arr, def, rerender) {
  const wrap = h('div', { class: 'list' + (def.cards ? ' list--cards' : '') });
  const labelOf = (it, i) => {
    if (typeof def.itemLabel === 'function') return def.itemLabel(it, i);
    return (def.itemLabel && it[def.itemLabel]) || `Элемент ${i + 1}`;
  };
  const thumbOfItem = it => { if (!def.thumb) return ''; const v = it[def.thumb]; return Array.isArray(v) ? v[0] : v; };
  const openState = wrap._open || (wrap._open = new Set());
  arr.forEach((it, i) => {
    const th = thumbOfItem(it);
    const head = h('div', { class: 'li__head', onclick: e => { if (e.target.closest('.li__tools')) return; item.classList.toggle('is-open'); if (!item.querySelector('.li__body').childElementCount) item.querySelector('.li__body').append(renderFields(it, def.item)); } },
      h('span', { class: 'li__drag', title: 'Перетащите, чтобы изменить порядок' }, '⋮⋮'),
      def.thumb ? h('span', { class: 'li__thumb' }, th ? h('img', { src: thumbUrl(th), loading: 'lazy', onerror: e => { e.target.src = mediaUrl(th); e.target.onerror = null; } }) : null) : null,
      h('span', { class: 'li__title' }, h('b', {}, labelOf(it, i)), def.sub ? h('small', {}, def.sub(it)) : null),
      h('span', { class: 'li__tools' },
        h('button', { type: 'button', title: 'Выше', onclick: () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; changed(); rerender(); } } }, '↑'),
        h('button', { type: 'button', title: 'Ниже', onclick: () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; changed(); rerender(); } } }, '↓'),
        h('button', { type: 'button', title: 'Дублировать', onclick: () => { const c = clone(it); if ('id' in c && c.id) c.id = c.id + '-copy'; if (c.name) c.name += ' (копия)'; arr.splice(i + 1, 0, c); changed(); rerender(); } }, '⧉'),
        h('button', { type: 'button', title: 'Удалить', class: 'danger', onclick: () => { if (confirm(`Удалить «${labelOf(it, i)}»?`)) { arr.splice(i, 1); changed(); rerender(); } } }, '✕')),
      h('span', { class: 'li__chev' }, '⌄'));
    const item = h('div', { class: 'li' }, head, h('div', { class: 'li__body' }));
    const handle = head.querySelector('.li__drag');
    handle.addEventListener('mousedown', () => { item.draggable = true; });
    item.addEventListener('dragend', () => { item.draggable = false; });
    document.addEventListener('mouseup', () => { item.draggable = false; });
    dnd(item, arr, i, rerender);
    // при правке названия обновляем заголовок
    item.addEventListener('input', () => { const b = head.querySelector('.li__title b'); if (b) b.textContent = labelOf(it, i); const s = head.querySelector('.li__title small'); if (s && def.sub) s.textContent = def.sub(it); });
    wrap.append(item);
  });
  const canAdd = !def.max || arr.length < def.max;
  const tools = h('div', { class: 'list__add' });
  if (canAdd) tools.append(h('button', { type: 'button', class: 'a-btn', onclick: () => {
    const n = typeof def.add === 'function' ? def.add() : clone(def.add || {});
    arr.push(n); changed(); const nw = rerender();
    const items = nw ? nw.querySelectorAll(':scope > .li') : []; const last = items[items.length - 1]; if (last) { last.querySelector('.li__head').click(); last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  } }, '＋ Добавить'));
  if (def.bulk) tools.append(h('button', { type: 'button', class: 'a-btn', onclick: () => uploadPick('image/*', true).then(ps => { if (ps && ps.length) { ps.forEach(p => arr.push({ ...clone(def.bulk.base), [def.bulk.field]: p })); changed(); rerender(); } }) }, '＋ Загрузить пачкой'));
  if (def.cards && arr.length > 4) tools.append(h('span', { class: 'hint' }, `Всего: ${arr.length}`));
  wrap.append(tools);
  return wrap;
}

/* --- порядок секций --- */
function renderSectionsOrder(c) {
  const arr = A.content.sections || (A.content.sections = []);
  c.append(h('p', { class: 'hint' }, 'Перетащите секции, чтобы изменить порядок на странице. Выключите — секция скроется с сайта (данные сохранятся).'));
  const box = h('div', { class: 'order' });
  const draw = () => {
    box.innerHTML = '';
    arr.forEach((s, i) => {
      const row = h('div', { class: 'order__row', draggable: 'true' },
        h('span', { class: 'li__drag' }, '⋮⋮'), h('span', { class: 'order__n' }, String(i + 1).padStart(2, '0')),
        h('b', {}, (SEC[s.id] && SEC[s.id].title) || s.label || s.id),
        h('label', { class: 'switch' }, h('input', { type: 'checkbox', ...(s.visible !== false ? { checked: true } : {}), onchange: e => { s.visible = e.target.checked; changed(); } }), h('span', {})),
        h('button', { type: 'button', class: 'a-btn a-btn--sm', onclick: () => openSection(s.id) }, 'Редактировать'));
      dnd(row, arr, i, draw);
      box.append(row);
    });
  };
  draw();
  c.append(box);
}

/* --- JSON --- */
function renderJson(c) {
  c.append(h('p', { class: 'hint' }, 'Полный контент сайта в формате JSON. Правьте осторожно: после «Применить» изменения попадут в редактор, а затем нужно нажать «Опубликовать».'));
  const ta = h('textarea', { class: 'json', spellcheck: 'false' }); ta.value = JSON.stringify(A.content, null, 2);
  const err = h('div', { class: 'json__err' });
  c.append(ta, err, h('div', { class: 'row' }, h('button', { class: 'a-btn a-btn--primary', onclick: () => { try { A.content = JSON.parse(ta.value); err.textContent = ''; changed(); toast('JSON применён', 'ok'); } catch (e) { err.textContent = 'Ошибка в JSON: ' + e.message; } } }, 'Применить'), h('button', { class: 'a-btn', onclick: () => { ta.value = JSON.stringify(A.content, null, 2); err.textContent = ''; } }, 'Сбросить')));
}

/* --- помощь --- */
function renderHelp(c) {
  c.append(h('div', { class: 'help', html: `
    <h3>Как это работает</h3>
    <p>Все тексты, цены, фото, видео и модели хранятся в файле <code>content/content.json</code> в вашем репозитории. Админка меняет этот файл и загружает медиафайлы прямо в GitHub. После нажатия <b>«Опубликовать»</b> GitHub Pages сам пересобирает сайт — обычно это занимает 30–90 секунд.</p>
    <h3>Фото</h3>
    <p>Загружайте JPG/PNG/WebP — админка сама уменьшит фото до 1600 px и сделает миниатюру. Формат HEIC (iPhone) браузеры обычно не читают — сохраните фото как JPG. Порядок фото меняется перетаскиванием.</p>
    <h3>Модели</h3>
    <p>«Каталог моделей» → «Модели» → «＋ Добавить». Первое фото — обложка карточки, первые шесть листаются при наведении. Возраст считается автоматически по году рождения. Ссылка на профиль: <code>ваш-сайт/#model-ID</code>.</p>
    <h3>Заявки с сайта</h3>
    <p>Откройте «Запись и заявки» → «Куда приходят заявки». Рекомендуем Web3Forms: бесплатно, заявки приходят на почту. Ключ получается за минуту на web3forms.com.</p>
    <h3>Предпросмотр</h3>
    <p>Кнопка «Предпросмотр» открывает сайт с вашими несохранёнными правками (только в этом браузере). Только что загруженные фото на предпросмотре появятся после публикации.</p>
    <h3>Безопасность</h3>
    <p>Токен хранится только в этом браузере. Если потеряли устройство — удалите токен в GitHub (Settings → Developer settings → Tokens). Не давайте токену доступ ко всем репозиториям — только к репозиторию сайта.</p>` }));
}

/* ---------- медиатека ---------- */
async function loadTree(force) {
  if (A.mode !== 'github') {
    // локально: пытаемся прочитать листинг папки (python http.server), иначе берём пути из контента
    const found = new Set();
    for (const dir of ['media/img/', 'media/video/']) {
      try {
        const html = await (await fetch('../' + dir, { cache: 'no-store' })).text();
        [...html.matchAll(/href="([^"?#]+\.(?:webp|jpe?g|png|gif|mp4|webm))"/gi)].forEach(m => found.add(dir + decodeURIComponent(m[1]).split('/').pop()));
      } catch (e) { /* ignore */ }
    }
    if (!found.size) (JSON.stringify(A.content).match(/media\/(?:img|video)\/[^"\]\s]+\.(?:webp|jpe?g|png|mp4|webm)/g) || []).forEach(p => found.add(p));
    A.tree = [...found].map(p => ({ path: p, size: 0 }));
    return A.tree;
  }
  if (A.tree && !force) return A.tree;
  const t = await gh(repoPath(`/git/trees/${encodeURIComponent(A.branch)}?recursive=1`));
  A.tree = t.tree.filter(x => x.type === 'blob' && /^media\/(img|video)\/[^/]+\.(webp|jpe?g|png|gif|mp4|webm|mov)$/i.test(x.path)).map(x => ({ path: x.path, size: x.size }));
  return A.tree;
}
let libResolve = null, libSel = [], libOpts = {};
async function pickMedia(opts = {}) {
  libOpts = { type: 'img', multi: false, ...opts }; libSel = [];
  const lib = $('#lib'); lib.hidden = false;
  $$('[data-lib-tab]').forEach(b => b.classList.toggle('is-on', b.dataset.libTab === libOpts.type));
  $('.lib__search').value = '';
  $('#libChoose').hidden = false;
  await drawLib();
  return new Promise(res => { libResolve = res; });
}
function closeLib(result) { $('#lib').hidden = true; if (libResolve) { libResolve(result); libResolve = null; } }
async function drawLib() {
  const grid = $('#libGrid'); grid.innerHTML = '<div class="lib__loading">Загрузка…</div>';
  let tree;
  try { tree = await loadTree(); } catch (e) { grid.innerHTML = `<div class="lib__loading">Ошибка: ${esc(e.message)}</div>`; return; }
  const q = $('.lib__search').value.trim().toLowerCase();
  const isVid = libOpts.type === 'video';
  const used = JSON.stringify(A.content);
  const list = tree.filter(t => (isVid ? /^media\/video\/.+\.(mp4|webm|mov)$/i : /^media\/img\//).test(t.path) && (!q || t.path.toLowerCase().includes(q)))
    .sort((a, b) => (b.path.includes('/up-') - a.path.includes('/up-')) || a.path.localeCompare(b.path));
  grid.innerHTML = '';
  if (!list.length) grid.innerHTML = '<div class="lib__loading">Файлов нет. Нажмите «Загрузить».</div>';
  list.forEach(t => {
    const p = t.path;
    const isUsed = used.includes(p);
    const cell = h('div', { class: 'lib__it' + (libSel.includes(p) ? ' is-sel' : ''), title: p, onclick: () => {
      if (!libResolve) return;
      if (libOpts.multi) { const k = libSel.indexOf(p); k > -1 ? libSel.splice(k, 1) : libSel.push(p); cell.classList.toggle('is-sel'); const n = cell.querySelector('.lib__num'); if (n) n.textContent = libSel.indexOf(p) + 1 || ''; }
      else { libSel = [p]; closeLib(libSel); return; }
      updLib();
    } },
    isVid ? h('video', { src: mediaUrl(p), muted: true, preload: 'metadata', onmouseenter: e => e.target.play().catch(() => {}), onmouseleave: e => e.target.pause() }) : h('img', { src: thumbUrl(p), loading: 'lazy', onerror: e => { e.target.src = mediaUrl(p); e.target.onerror = null; } }),
    h('span', { class: 'lib__name' }, p.split('/').pop()),
    isUsed ? h('span', { class: 'lib__used', title: 'Используется на сайте' }, '●') : null,
    h('span', { class: 'lib__num' }, libSel.indexOf(p) > -1 ? libSel.indexOf(p) + 1 : ''),
    A.mode === 'github' && !isUsed ? h('button', { class: 'lib__del', title: 'Удалить файл из репозитория', onclick: async e => { e.stopPropagation(); if (!confirm(`Удалить ${p}? Это действие публикуется сразу.`)) return; busy('Удаляем…'); try { const files = [{ path: p, delete: true }]; if (p.startsWith('media/img/') && A.tree.some(x => x.path === thumbOf(p))) files.push({ path: thumbOf(p), delete: true }); await commitFiles(files, `Удаление ${p.split('/').pop()}`); A.tree = A.tree.filter(x => x.path !== p); drawLib(); toast('Файл удалён', 'ok'); } catch (er) { toast(er.message, 'err'); } finally { unbusy(); } } }, '🗑') : null);
    grid.append(cell);
  });
  updLib();
}
function updLib() {
  $('#libCount').textContent = libOpts.multi ? `Выбрано: ${libSel.length}` : (libResolve ? 'Нажмите на файл, чтобы выбрать' : '');
  $('#libChoose').disabled = !libSel.length;
  $('#libChoose').hidden = !libOpts.multi || !libResolve;
}
function initLib() {
  $$('[data-lib-close]').forEach(b => b.addEventListener('click', () => closeLib(null)));
  $$('[data-lib-tab]').forEach(b => b.addEventListener('click', () => { libOpts.type = b.dataset.libTab; $$('[data-lib-tab]').forEach(x => x.classList.toggle('is-on', x === b)); drawLib(); }));
  let tm; $('.lib__search').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(drawLib, 200); });
  $('#libChoose').addEventListener('click', () => closeLib(libSel.slice()));
  $('#libUpload').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    const paths = await uploadFiles(files);
    if (paths && paths.length) { if (libResolve && libOpts.multi) libSel.push(...paths.filter(p => (libOpts.type === 'video') === p.startsWith('media/video/'))); await drawLib(); }
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lib').hidden) closeLib(null); });
}
function renderMediaPage(c) {
  c.append(h('p', { class: 'hint' }, 'Все фото и видео сайта. Зелёная точка — файл используется. Неиспользуемые файлы можно удалить.'));
  c.append(h('button', { class: 'a-btn a-btn--primary', onclick: async () => { libResolve = null; libOpts = { type: 'img', multi: false }; $('#lib').hidden = false; await drawLib(); } }, 'Открыть медиатеку'));
}

/* ---------- загрузка файлов ---------- */
function uploadPick(accept, multiple) {
  return new Promise(res => {
    const inp = h('input', { type: 'file', accept, ...(multiple ? { multiple: true } : {}) });
    inp.addEventListener('change', async () => res(await uploadFiles([...inp.files])));
    inp.click();
  });
}
async function resizeImage(file, max, q) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Браузер не может прочитать этот файл (возможно, HEIC). Сохраните фото как JPG.')); im.src = URL.createObjectURL(file); }); }
  const W = bmp.width, H = bmp.height, s = Math.min(1, max / Math.max(W, H));
  const cv = document.createElement('canvas'); cv.width = Math.round(W * s); cv.height = Math.round(H * s);
  const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', q));
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q)); ext = 'jpg'; }
  return { blob, ext };
}
async function videoPoster(file) {
  const url = URL.createObjectURL(file);
  const v = h('video', { muted: true, playsinline: true, preload: 'auto', src: url });
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Не удалось прочитать видео. Используйте MP4 (H.264).')); setTimeout(res, 8000); });
  v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
  await new Promise(res => { v.onseeked = res; setTimeout(res, 3000); });
  const s = Math.min(1, 1080 / Math.max(v.videoWidth || 720, v.videoHeight || 1280));
  const cv = document.createElement('canvas'); cv.width = Math.round((v.videoWidth || 720) * s); cv.height = Math.round((v.videoHeight || 1280) * s);
  cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', 0.75)); let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8)); ext = 'jpg'; }
  return { blob, ext, url };
}
async function uploadFiles(files) {
  if (A.mode !== 'github') { toast('Загрузка файлов доступна только при входе через GitHub. В локальном режиме положите файлы в папку media/ вручную.', 'warn', 6000); return []; }
  const out = [], commit = [];
  busy(`Обрабатываем файлы: 0 / ${files.length}`);
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      $('#busyText').textContent = `Обрабатываем файлы: ${i + 1} / ${files.length}`;
      const base = `up-${Date.now().toString(36)}${i}-${slug(f.name.replace(/\.[^.]+$/, ''))}`;
      if (f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name)) {
        if (f.size > 45 * 1024 * 1024) { toast(`${f.name}: файл больше 45 МБ — сожмите видео.`, 'err', 6000); continue; }
        const ext = (f.name.match(/\.(mp4|webm|mov)$/i) || [, 'mp4'])[1].toLowerCase();
        const vp = `media/video/${base}.${ext}`;
        commit.push({ path: vp, b64: await b64FromBlob(f) });
        A.blobs[vp] = URL.createObjectURL(f);
        try { const p = await videoPoster(f); const pp = `media/video/${base}.${p.ext}`; commit.push({ path: pp, b64: await b64FromBlob(p.blob) }); A.blobs[pp] = URL.createObjectURL(p.blob); } catch (e) { console.warn(e); }
        out.push(vp);
      } else {
        const main = await resizeImage(f, 1600, 0.82), th = await resizeImage(f, 720, 0.78);
        const mp = `media/img/${base}.${main.ext}`, tp = `media/thumb/${base}.${th.ext}`;
        commit.push({ path: mp, b64: await b64FromBlob(main.blob) }, { path: tp, b64: await b64FromBlob(th.blob) });
        A.blobs[mp] = URL.createObjectURL(main.blob); A.blobs[tp] = URL.createObjectURL(th.blob);
        out.push(mp);
      }
    }
    if (commit.length) {
      $('#busyText').textContent = 'Загружаем в GitHub…';
      await commitFiles(commit, `Загрузка медиа: ${files.length} файл(ов)`);
      if (A.tree) commit.forEach(c => { if (/^media\/(img|video)\//.test(c.path)) A.tree.push({ path: c.path, size: 0 }); });
      toast(`Загружено: ${out.length}. Не забудьте нажать «Опубликовать», чтобы сохранить изменения на страницах.`, 'ok', 5000);
    }
  } catch (e) { console.error(e); toast('Ошибка загрузки: ' + e.message, 'err', 7000); return []; }
  finally { unbusy(); }
  return out;
}

/* ---------- сохранение ---------- */
function changed() {
  A.dirty = JSON.stringify(A.content) !== A.saved;
  updateStatus();
  clearTimeout(changed.t);
  changed.t = setTimeout(() => {
    try { localStorage.setItem(LS.draft, JSON.stringify({ repo: `${A.owner}/${A.repo}`, base: A.saved, json: JSON.stringify(A.content) })); } catch (e) { /* ignore */ }
  }, 400);
}
function updateStatus(text, kind) {
  const st = $('#status');
  st.className = 'top__status ' + (kind || (A.dirty ? 'is-dirty' : 'is-ok'));
  st.querySelector('span').textContent = text || (A.dirty ? 'Есть неопубликованные изменения' : A.mode === 'github' ? 'Всё опубликовано' : 'Локальный режим');
  $('#publishBtn').classList.toggle('is-pulse', A.dirty);
}
function cleanForSave(o) {
  const c = JSON.parse(JSON.stringify(o, (k, v) => k.startsWith('_') ? undefined : v));
  const models = (c.catalog && c.catalog.models) || [];
  const seen = new Set();
  models.forEach(m => { let id = slug(m.id || m.name); const b = id; let n = 2; while (seen.has(id)) id = `${b}-${n++}`; seen.add(id); m.id = id; });
  return c;
}
async function publish() {
  const data = cleanForSave(A.content);
  const json = JSON.stringify(data, null, 1) + '\n';
  if (A.mode !== 'github') { download('content.json', json); A.saved = JSON.stringify(A.content); A.dirty = false; updateStatus('Файл скачан — замените им content/content.json'); return; }
  busy('Публикуем…');
  try {
    // проверяем, не изменился ли контент в репозитории с момента загрузки
    const remote = await readFile('content/content.json');
    if (A.remoteSha && remote.sha !== A.remoteSha && !confirm('Контент в репозитории изменился после того, как вы открыли админку (например, правки с другого устройства). Перезаписать вашей версией?')) { unbusy(); return; }
    const files = [{ path: 'content/content.json', b64: b64FromUtf8(json) }];
    // SEO в index.html (для поисковиков и превью ссылок)
    try {
      const idx = await readFile('index.html');
      const seo = (data.settings && data.settings.seo) || {};
      const block = `<!--SEO-->\n<title>${esc(seo.title)}</title>\n<meta name="description" content="${esc(seo.description)}">\n<meta property="og:title" content="${esc(seo.title)}">\n<meta property="og:description" content="${esc(seo.description)}">\n<meta property="og:image" content="${esc(seo.ogImage || 'media/brand/og.jpg')}">\n<!--/SEO-->`;
      const next = idx.text.replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->/, block);
      if (next !== idx.text) files.push({ path: 'index.html', b64: b64FromUtf8(next) });
    } catch (e) { console.warn('SEO patch skipped', e); }
    const c = await commitFiles(files, 'Обновление контента через админку');
    const after = await readFile('content/content.json');
    A.remoteSha = after.sha;
    A.saved = JSON.stringify(A.content); A.dirty = false;
    localStorage.removeItem(LS.draft);
    updateStatus('Опубликовано. Сайт обновится через ~1 минуту', 'is-ok');
    toast('Изменения опубликованы ✓ Сайт обновится через 30–90 секунд.', 'ok', 6000);
    watchPages(c && c.sha);
  } catch (e) { console.error(e); toast('Не удалось опубликовать: ' + e.message, 'err', 8000); updateStatus('Ошибка публикации', 'is-err'); }
  finally { unbusy(); }
}
async function watchPages(sha) {
  const started = Date.now();
  const tick = async () => {
    if (Date.now() - started > 4 * 60 * 1000) return;
    try {
      const b = await gh(repoPath('/pages/builds/latest'));
      if (b.status === 'built' && (!sha || b.commit === sha)) { updateStatus('Сайт обновлён ✓', 'is-ok'); return; }
      if (b.status === 'errored') { updateStatus('Ошибка сборки GitHub Pages', 'is-err'); return; }
      updateStatus('GitHub Pages обновляет сайт…', 'is-wait');
    } catch (e) { return; }
    setTimeout(tick, 6000);
  };
  setTimeout(tick, 4000);
}
function download(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
}

/* ---------- верхняя панель ---------- */
function bindTop() {
  if (bindTop.done) return; bindTop.done = true;
  $('#publishBtn').addEventListener('click', publish);
  $('#previewBtn').addEventListener('click', () => {
    try { localStorage.setItem(LS.preview, JSON.stringify(cleanForSave(A.content))); } catch (e) { toast('Не удалось подготовить предпросмотр', 'err'); return; }
    const sec = A.section && (A.content.sections || []).some(s => s.id === A.section) ? '#' + (A.section === 'hero' ? 'top' : A.section) : '';
    window.open('../?preview=1' + sec, '_blank');
  });
  $('#moreBtn').addEventListener('click', e => { e.stopPropagation(); $('#moreMenu').classList.toggle('is-open'); });
  document.addEventListener('click', () => $('#moreMenu').classList.remove('is-open'));
  $('#moreMenu').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'download') download('content.json', JSON.stringify(cleanForSave(A.content), null, 1) + '\n');
    if (act === 'upload') $('#jsonUpload').click();
    if (act === 'reload') { if (!A.dirty || confirm('Отменить неопубликованные изменения и загрузить версию с сервера?')) { localStorage.removeItem(LS.draft); location.reload(); } }
  });
  $('#jsonUpload').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { A.content = JSON.parse(await f.text()); changed(); openSection(A.section); toast('Файл загружен. Проверьте и нажмите «Опубликовать».', 'ok'); }
    catch (err) { toast('Это не похоже на корректный JSON: ' + err.message, 'err'); }
  });
  $('#logout').addEventListener('click', () => {
    if (A.dirty && !confirm('Есть неопубликованные изменения. Всё равно выйти?')) return;
    localStorage.removeItem(LS.cred); sessionStorage.removeItem(LS.cred); location.hash = ''; location.reload();
  });
  $('#sideToggle').addEventListener('click', () => document.body.classList.toggle('side-open'));
  addEventListener('beforeunload', e => { if (A.dirty) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); publish(); } });
}

/* ---------- уведомления ---------- */
function toast(msg, kind = '', ms = 3500) {
  const t = h('div', { class: 'toast ' + kind }, msg);
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, ms);
}
function busy(text) { $('#busyText').textContent = text || 'Подождите…'; $('#busy').hidden = false; }
function unbusy() { $('#busy').hidden = true; }

initLogin();
initLib();
})();
