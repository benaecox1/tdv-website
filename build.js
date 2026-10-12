// The Director's Vision website builder.
// No packages needed: Netlify runs `node build.js`, which reads /content and writes /_site.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (f) => JSON.parse(read('content/' + f));

// ---------- helpers ----------
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *words* -> gold italic accent
const acc = (s, cls = 'acc') => esc(s).replace(/\*([^*]+)\*/g, `<span class="${cls}">$1</span>`);
// plain text with line breaks kept
const txt = (s) => esc(s).replace(/\r?\n/g, '<br>');
const list = (a) => (Array.isArray(a) ? a : []).filter((x) => x !== null && x !== undefined && x !== '');
const pad = (n) => String(n).padStart(2, '0');
const img = (src) => esc(src || '');
const dia = '<b>&#9670;</b>';
const ticker = (items, { dark = false, serif = false, speed = 0, label = '' } = {}) => {
  const words = list(items);
  if (!words.length) return '';
  const run = `<span>${words.map((w) => `${esc(w)} ${dia}`).join(' ')}</span>`;
  const reps = words.join(' ').length > 80 ? 2 : 4;
  return `<div class="tick${dark ? ' dark' : ''}${serif ? ' tick-serif' : ''}"${label ? ` aria-label="${esc(label)}"` : ' aria-hidden="true"'}>
<div class="tick-track" aria-hidden="true"${speed ? ` style="animation-duration:${speed}s"` : ''}>${run.repeat(reps)}</div></div>`;
};
const vf = (cls = '', style = '') => `<div class="vf ${cls}" aria-hidden="true"${style ? ` style="${style}"` : ''}><span></span><span></span><span></span><span></span></div>`;
const scene = (num, label, light = false, center = false) =>
  `<p class="scene${light ? ' light' : ''}"${center ? ' style="justify-content:center"' : ''}>${num ? `${num} <span class="sl">/</span> ` : ''}${esc(label)}</p>`;

// tiny markdown for the legal pages
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u}">${t}</a>`);
}
function markdown(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = []; const toc = []; let para = []; let items = null; let ordered = false;
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushL = () => { if (items) { const t = ordered ? 'ol' : 'ul'; out.push(`<${t}>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</${t}>`); items = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = line.match(/^#{1,3}\s+(.*)$/))) {
      flushP(); flushL();
      const title = m[1].replace(/^\d+\.?\s+/, '').trim();
      const id = 's' + (toc.length + 1);
      toc.push({ id, title });
      out.push(`<h2 id="${id}">${inline(title)}</h2>`);
    } else if ((m = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) {
      flushP();
      const isOl = /\d/.test(m[1]);
      if (items && isOl !== ordered) flushL();
      if (!items) { items = []; ordered = isOl; }
      items.push(m[2]);
    } else if (items && /^\s{2,}/.test(raw)) {
      items[items.length - 1] += ' ' + line.trim();
    } else {
      flushL(); para.push(line.trim());
    }
  }
  flushP(); flushL();
  return { html: out.join('\n'), toc };
}

// front matter (handles the simple YAML the dashboard writes)
function frontMatter(src) {
  const m = src.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {}; const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    if (/^[|>][-+]?$/.test(val)) {
      const fold = val[0] === '>'; const buf = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) buf.push(lines[++i].trim());
      val = fold ? buf.join(' ').replace(/\s+/g, ' ').trim() : buf.join('\n').trim();
    } else if (/^".*"$/.test(val)) {
      try { val = JSON.parse(val); } catch (e) { val = val.slice(1, -1); }
    } else if (/^'.*'$/.test(val)) {
      val = val.slice(1, -1).replace(/''/g, "'");
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

// ---------- content ----------
const S = json('settings.json');
const HOME = json('home.json');
const SERV = json('services.json');
const ABOUT = json('about.json');
const CONT = json('contact.json');
const START = json('start.json');
const services = list(SERV.services);

const emailText = S.email || '[your email]';
const emailHref = S.email ? `mailto:${S.email}` : '/contact/';
const ext = (u) => (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '');

// ---------- layout ----------
const NAV = [['/', 'Home', 'home'], ['/services/', 'Services', 'services'], ['/about/', 'About', 'about'], ['/contact/', 'Contact', 'contact']];
function layout({ key, title, description, body, bodyClass }) {
  const nav = NAV.map(([h, t, k]) => `<a href="${h}"${k === key ? ' class="on" aria-current="page"' : ''}>${t}</a>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || S.seo_description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || S.seo_description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${img(HOME.hero.image)}">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body class="p-${key}${bodyClass ? ' ' + bodyClass : ''}">
<div class="page">
<header class="site-header">
<div class="wrap">
<a href="/" class="logo-link"><img src="${img(S.logo)}" alt="${esc(S.site_name)}" width="233" height="50"></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>
<nav class="nav" id="main-nav" aria-label="Main">
${nav}
<a href="/start/" class="btn btn-gold"${key === 'start' ? ' aria-current="page"' : ''}>${esc(S.header_button)}</a>
</nav>
</div>
</header>
<main>
${body}
</main>
${footer(key)}
</div>
<script>
(function(){var b=document.querySelector('.menu-toggle'),n=document.getElementById('main-nav');if(!b||!n)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');b.textContent=o?'Close':'Menu';});})();
</script>
</body>
</html>
`;
}

function footer(key) {
  const legal = key === 'privacy' || key === 'terms';
  return `<footer style="background:#101C3C">
${legal ? '' : ticker(S.footer_ticker, { dark: true, speed: 56 })}
<div class="wrap" style="padding-top:80px;padding-bottom:40px">
<div style="display:flex;flex-wrap:wrap;gap:48px 72px;justify-content:space-between">
<div style="flex:1 1 300px;min-width:0;max-width:380px">
<img src="${img(S.monogram)}" alt="${esc(S.site_name)} monogram" style="width:64px;height:auto;display:block">
<p class="serif" style="margin:24px 0 0;font-style:italic;font-size:24px;line-height:1.35;color:#FFFFDB">${esc(S.footer_tagline)}</p>
</div>
<div class="foot foot-col">
<p class="eyebrow light" style="margin:0 0 8px">Explore</p>
${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}
</div>
<div class="foot foot-col">
<p class="eyebrow light" style="margin:0 0 8px">Connect</p>
${S.instagram ? `<a href="${esc(S.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ''}${S.linkedin ? `<a href="${esc(S.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
</div>
<div class="foot foot-col">
<p class="eyebrow light" style="margin:0 0 8px">${key === 'contact' ? 'Based in' : 'On location'}</p>
<p class="body light-text">${esc(S.location)}<br>${esc(S.location_note)}</p>
</div>
</div>
<div style="margin-top:64px;padding-top:24px;border-top:1px solid rgba(201,154,86,0.4);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px">
<p class="legalbar body" style="font-size:13px;color:#AEB5C6">&#169; ${new Date().getFullYear()} ${esc(S.legal_name)} &#8226; <a href="/privacy/">Privacy Policy</a> &#8226; <a href="/terms/">Terms &amp; Conditions</a></p>
<p class="body" style="font-size:13px;color:#AEB5C6">${esc(S.footer_values)}</p>
</div>
</div>
</footer>`;
}

// ---------- pages ----------
function homePage() {
  const H = HOME;
  const steps = list(H.schedule.steps).map((s, i, a) => {
    const last = i === a.length - 1;
    return `<div class="card${last ? ' dark' : ''}">
<div class="circle">${pad(i + 1)}</div>
<p class="eyebrow${last ? ' light' : ''}" style="margin:12px 0 0">${esc(s.stage)}</p>
<p class="h3">${esc(s.title)}</p>
<p class="body${last ? ' light-text' : ''}">${txt(s.text)}</p>
${s.tags ? `<p class="tags">${esc(s.tags)}</p>` : ''}
</div>`;
  }).join('\n');
  const review = H.review && H.review.show && H.review.quote ? `
<section class="wrap sec-pad" style="padding-top:130px;padding-bottom:120px;display:flex;flex-wrap:wrap;gap:48px 80px">
<div style="flex:1 1 260px;min-width:0">
<p class="scene">${esc(H.review.label || 'Reviews')}</p>
<p aria-label="Five stars" style="margin:0;font-size:22px;letter-spacing:6px;color:#C99A56">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
</div>
<div style="flex:3 1 560px;min-width:0">
<p class="serif" style="margin:0;font-size:clamp(28px,2.8vw,40px);line-height:1.3;color:#101C3C">${txt(H.review.quote)}</p>
<p style="margin:32px 0 0;font-family:'Poppins',sans-serif;font-size:13px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#101C3C">${esc(H.review.name)}</p>
${H.review.business ? `<p class="body" style="margin-top:4px">${esc(H.review.business)}</p>` : ''}
</div>
</section>` : '';

  const body = `
<section class="hero home-hero on-dark" style="position:relative;min-height:580px;overflow:hidden;display:flex;align-items:center;background:#101C3C">
<img src="${img(H.hero.image)}" alt="${esc(H.hero.image_alt)}" class="hero-img">
<div class="hero-fade" aria-hidden="true"></div>
${vf('dark')}
<p class="slate rec slate-corner" style="position:absolute;top:52px;left:56px">Rec</p>
<p class="slate slate-corner" style="position:absolute;top:52px;right:56px">${esc(H.hero.corner_label)}</p>
<div class="hero-cap" style="position:absolute;right:56px;bottom:52px;text-align:right">
<p class="serif" style="margin:0;font-style:italic;font-size:22px;color:#FFFFDB">${esc(H.hero.caption)}</p>
<p class="slate" style="margin-top:6px;color:#E1BC7A">${esc(H.hero.caption_2)}</p>
</div>
<div class="wrap" style="position:relative;width:100%;padding-top:92px;padding-bottom:88px">
<div style="max-width:560px">
${scene('01', H.hero.label, true)}
<h1 class="h1" style="color:#FFFFDB;font-size:clamp(42px,4.8vw,72px)">${acc(H.hero.headline)}</h1>
<p class="lead light-text" style="margin-top:22px;max-width:480px;font-size:17px;line-height:1.75">${txt(H.hero.text)}</p>
<div class="btn-row" style="margin-top:30px">
<a href="/start/" class="btn btn-gold">${esc(H.hero.button)}</a>
<a href="/services/" class="btn btn-line-light">${esc(H.hero.button_2)}</a>
</div>
${H.hero.scripture ? `<p style="margin:32px 0 0;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px"><span class="serif" style="font-style:italic;font-size:22px;color:#FFFFDB">${esc(H.hero.scripture)}</span><span class="slate" style="color:#E1BC7A">${esc(H.hero.scripture_ref)}</span></p>` : ''}
</div>
</div>
</section>

${ticker(H.ticker, { label: list(H.ticker).join('. ') })}

<section class="wrap sec-pad" style="padding-top:130px;padding-bottom:130px">
<div class="frame-box" style="position:relative;max-width:1000px;margin:0 auto;padding:88px 72px;text-align:center">
${vf('dark', 'top:0;left:0;right:0;bottom:0')}
${scene('02', H.founder.label, false, true)}
<p class="serif" style="margin:0;font-style:italic;font-weight:400;font-size:clamp(34px,4.4vw,60px);line-height:1.15;color:#101C3C">${esc(H.founder.quote)}</p>
<p class="lead" style="margin:36px auto 0;max-width:640px">${txt(H.founder.text)}</p>
</div>
</section>

<section class="wrap" style="padding-top:0;padding-bottom:130px;display:flex;flex-wrap:wrap;gap:72px">
<div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:40px">
<div>
${scene('03', H.familiar.label)}
<h2 class="h2">${acc(H.familiar.headline)}</h2>
</div>
<div class="photo" style="min-height:440px">
<img src="${img(H.familiar.image)}" alt="${esc(H.familiar.image_alt)}" style="object-position:50% 55%">
${vf('tight')}
</div>
</div>
<div style="flex:1 1 480px;min-width:0;border-top:1px solid #D8CBAE">
${list(H.familiar.questions).map((q) => `<p class="q">${esc(q)}</p>`).join('\n')}
</div>
</section>

<section style="background:#EFE7D6">
<div class="wrap sec-pad" style="padding-top:130px;padding-bottom:130px">
<div style="max-width:760px">
${scene('04', H.gap.label)}
<h2 class="h2">${acc(H.gap.headline)}</h2>
<p class="lead" style="margin-top:28px">${txt(H.gap.text)}</p>
</div>
<div style="display:flex;flex-wrap:wrap;align-items:stretch;gap:24px;margin-top:64px">
<div style="flex:1 1 340px;min-width:0;border:1px solid #C9B894;padding:44px 40px">
<p class="eyebrow" style="color:#5A5F6E">Before</p>
<p class="serif" style="margin:0;font-size:34px;line-height:1.2;color:#101C3C">${acc(H.gap.before, 'acc-plain')}</p>
</div>
<div aria-hidden="true" style="flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:48px;color:#C99A56">&#8594;</div>
<div class="on-dark" style="flex:1 1 340px;min-width:0;background:#101C3C;padding:44px 40px">
<p class="eyebrow light">After</p>
<p class="serif" style="margin:0;font-size:34px;line-height:1.2;color:#FFFFDB">${acc(H.gap.after)}</p>
</div>
</div>
</div>
</section>

${ticker([H.services_ticker_label, ...services.map((s) => s.short_name || s.title)], { dark: true, serif: true, speed: 60, label: 'Services offered' })}

<section class="on-dark" style="background:#101C3C">
<div class="wrap" style="padding-top:120px;padding-bottom:64px">
<div style="display:flex;flex-wrap:wrap;gap:32px 72px;align-items:flex-end">
<div style="flex:1 1 560px;min-width:0">
${scene('05', H.help.label, true)}
<h2 class="h2" style="color:#FFFFDB">${acc(H.help.headline)}</h2>
</div>
<p class="body light-text" style="flex:1 1 340px;min-width:0;font-size:16px">${txt(H.help.text)}</p>
</div>
</div>
<div style="display:flex;flex-wrap:wrap;border-top:1px solid #26355E">
<nav aria-label="Services" style="flex:1 1 560px;min-width:0;display:flex;flex-direction:column">
${services.map((s, i) => `<a href="/services/#service-${i + 1}" class="svc-row"><span class="n">${pad(i + 1)}</span><span class="t">${esc(s.title)}</span><span class="a" aria-hidden="true">&#8594;</span></a>`).join('\n')}
</nav>
<div class="photo" style="flex:1 1 440px;min-width:0;min-height:600px">
<img src="${img(H.help.image)}" alt="${esc(H.help.image_alt)}" style="object-position:45% 30%">
${vf()}
${H.help.image_label ? `<p class="slate" style="position:absolute;bottom:52px;right:56px">${esc(H.help.image_label)}</p>` : ''}
</div>
</div>
</section>

<section class="wrap sec-pad" style="padding-top:130px;padding-bottom:130px">
<div style="display:flex;flex-wrap:wrap;gap:40px 72px;align-items:flex-end;margin-bottom:64px">
<div style="flex:1 1 520px;min-width:0">
${scene('06', H.schedule.label)}
<h2 class="h2">${acc(H.schedule.headline)}</h2>
</div>
<p class="body" style="flex:1 1 360px;min-width:0;font-size:16px">${txt(H.schedule.text)}</p>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px">
${steps}
</div>
</section>

<section class="on-dark" style="background:#101C3C;position:relative;overflow:hidden">
<img src="${img(S.monogram)}" alt="" aria-hidden="true" style="position:absolute;right:-80px;top:50%;transform:translateY(-50%);width:480px;opacity:0.07">
<div class="wrap sec-pad" style="position:relative;padding-top:130px;padding-bottom:130px;display:flex;flex-wrap:wrap;gap:64px 96px;align-items:center">
<div style="flex:1 1 480px;min-width:0">
${scene('', H.note.label, true)}
<h2 class="h2" style="color:#FFFFDB">${acc(H.note.headline)}</h2>
<p class="lead light-text" style="margin-top:28px">${txt(H.note.text)}</p>
<div class="btn-row" style="margin-top:40px">
<a href="/about/" class="btn btn-gold">${esc(H.note.button)}</a>
<a href="/about/#crew" class="btn btn-line-light">${esc(H.note.button_2)}</a>
</div>
</div>
<div style="flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:28px">
<div class="photo" style="min-height:420px">
<img src="${img(H.note.image)}" alt="${esc(H.note.image_alt)}" style="object-position:65% 60%">
${vf('tight')}
${H.note.image_label ? `<p class="slate" style="position:absolute;bottom:40px;left:44px">${esc(H.note.image_label)}</p>` : ''}
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;text-align:center;border-top:1px solid rgba(201,154,86,0.4);padding-top:28px">
${list(H.note.credits).map((c, i) => `<div><p class="credit-l">${esc(c.role)}</p><p class="credit-n" style="font-size:26px${i === 0 ? ';font-style:italic' : ''}">${acc(c.name, 'acc-plain')}</p></div>`).join('\n')}
</div>
</div>
</div>
</section>
${review}
<section style="background:#EFE7D6">
<div class="wrap" style="padding-top:100px;padding-bottom:100px;text-align:center;max-width:900px">
<img src="${img(S.monogram_dark)}" alt="" aria-hidden="true" style="width:54px;height:auto;display:block;margin:0 auto 32px">
<p class="serif" style="margin:0;font-style:italic;font-size:clamp(28px,3vw,42px);line-height:1.3;color:#101C3C">${esc(H.scripture.quote)}</p>
<p class="eyebrow" style="margin:24px 0 0">${esc(H.scripture.ref)}</p>
</div>
</section>

<section class="wrap sec-pad" style="padding-top:130px;padding-bottom:130px;text-align:center;max-width:1000px">
${scene('', H.closing.label, false, true)}
<h2 class="h2">${acc(H.closing.headline)}</h2>
<p class="lead" style="margin:28px auto 0;max-width:620px">${txt(H.closing.text)}</p>
<a href="/start/" class="btn btn-navy" style="margin-top:44px">${esc(H.closing.button)}</a>
</section>`;
  return layout({ key: 'home', title: H.seo_title, body });
}

function servicesPage() {
  const V = SERV;
  const rows = services.map((s, i) => {
    const f = !!s.featured;
    return `<div class="svc${f ? ' featured on-dark' : ''}" id="service-${i + 1}"${i === 0 && !f ? ' style="border-top:1px solid #101C3C"' : ''}>
${f ? vf('', 'top:18px;left:18px;right:18px;bottom:18px') : ''}
<div style="flex:0 0 120px"><p class="num">${pad(i + 1)}</p></div>
<div style="flex:2 1 380px;min-width:0">
${f && s.featured_label ? `<p class="eyebrow light" style="margin-bottom:12px">${esc(s.featured_label)}</p>` : ''}
<h2 class="h3">${esc(s.title)}</h2>
<p class="body" style="margin-top:14px">${txt(s.text)}</p>
<a href="/start/" class="textlink" style="margin-top:18px">Inquire about this <span aria-hidden="true">&#8594;</span></a>
</div>
<div style="flex:2 1 320px;min-width:0">
${list(s.includes).length ? `<p class="mini">What this can include</p><ul class="list">${list(s.includes).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
</div>
</div>`;
  }).join('\n');
  const body = `
${ticker(V.ticker)}
<section class="split-hero" style="display:flex;flex-wrap:wrap">
<div style="flex:1.2 1 560px;min-width:0;padding:110px 64px 100px;max-width:760px;margin-left:auto">
${scene('', V.hero.label)}
<h1 class="h1">${acc(V.hero.headline)}</h1>
<p class="lead" style="margin-top:32px;max-width:540px">${txt(V.hero.text)}</p>
</div>
<div style="flex:1 1 440px;min-width:0;background:#101C3C;position:relative;padding:96px 72px;display:flex;flex-direction:column;justify-content:center">
${vf()}
<p class="slate" style="margin-bottom:20px">${esc(V.hero.panel_label)}</p>
${list(V.hero.shot_list).map((s, i) => `<div class="shot"${i === 0 ? ' style="border-top:1px solid #26355E"' : ''}><span class="k">${pad(i + 1)}</span><span class="v"${i % 2 ? ' style="font-style:italic"' : ''}>${esc(s)}</span></div>`).join('\n')}
<p class="body light-text" style="margin-top:24px;font-size:14px">${txt(V.hero.panel_note)}</p>
</div>
</section>

<section class="wrap" style="padding-top:100px;padding-bottom:110px">
${scene('', V.lineup_label)}
${rows}
</section>

<section style="background:#EFE7D6">
<div class="wrap sec-pad" style="padding-top:110px;padding-bottom:110px;display:flex;flex-wrap:wrap;gap:48px 80px;align-items:center">
<div style="flex:1 1 440px;min-width:0">
${scene('', V.investment.label)}
<h2 class="h2">${acc(V.investment.headline)}</h2>
</div>
<div style="flex:1 1 400px;min-width:0">
<p class="lead">${txt(V.investment.text)}</p>
<a href="/start/" class="btn btn-navy" style="margin-top:36px">${esc(V.investment.button)}</a>
</div>
</div>
</section>

<section class="wrap" style="padding-top:120px;padding-bottom:110px">
${scene('', V.process.label)}
<h2 class="h2" style="max-width:720px">${acc(V.process.headline)}</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:40px 32px;margin-top:64px">
${list(V.process.steps).map((s, i, a) => `<div><div class="circle"${i === a.length - 1 ? ' style="background:#101C3C;color:#FFFFDB"' : ''}>${pad(i + 1)}</div><p class="h3" style="margin-top:22px;font-size:26px">${esc(s.title)}</p><p class="body" style="margin-top:10px">${txt(s.text)}</p></div>`).join('\n')}
</div>
</section>

<section class="wrap" style="padding-top:40px;padding-bottom:120px;display:flex;flex-wrap:wrap;gap:48px 80px">
<div style="flex:1 1 300px;min-width:0">
${scene('', V.faq.label)}
<h2 class="h2">${acc(V.faq.headline)}</h2>
</div>
<div style="flex:2 1 560px;min-width:0;border-top:1px solid #D8CBAE">
${list(V.faq.items).map((q, i) => `<details class="faq"${i === 0 ? ' open' : ''}><summary>${esc(q.question)}</summary><p class="body">${txt(q.answer)}</p></details>`).join('\n')}
</div>
</section>

<section class="on-dark" style="background:#101C3C">
<div class="wrap sec-pad" style="padding-top:120px;padding-bottom:120px;text-align:center;max-width:960px">
${scene('', V.closing.label, true, true)}
<h2 class="h2" style="color:#FFFFDB">${acc(V.closing.headline)}</h2>
<p class="lead light-text" style="margin:28px auto 0;max-width:600px">${txt(V.closing.text)}</p>
<a href="/start/" class="btn btn-gold" style="margin-top:44px">${esc(V.closing.button)}</a>
</div>
</section>`;
  return layout({ key: 'services', title: V.seo_title, body });
}

function aboutPage() {
  const A = ABOUT;
  const body = `
<section class="on-dark" style="display:flex;flex-wrap:wrap;background:#101C3C">
<div class="about-hero-text" style="flex:1 1 560px;min-width:0;position:relative;padding:120px 64px 110px;display:flex;flex-direction:column;justify-content:center">
${scene('', A.hero.label, true)}
<h1 class="h1" style="color:#FFFFDB;font-size:clamp(50px,6.2vw,96px)">${acc(A.hero.headline)}</h1>
<p class="lead light-text" style="margin-top:32px;max-width:520px">${txt(A.hero.text)}</p>
</div>
<div class="photo about-hero-photo" style="flex:1 1 440px;min-width:0;min-height:720px">
<img src="${img(A.hero.image)}" alt="${esc(A.hero.image_alt)}" style="object-position:42% 30%">
${vf()}
<p class="slate rec slate-corner" style="position:absolute;top:52px;left:56px">Rec</p>
<p class="slate slate-corner" style="position:absolute;top:52px;right:56px">${esc(A.hero.corner_label)}</p>
<p class="serif" style="position:absolute;bottom:52px;left:56px;margin:0;font-style:italic;font-size:22px;color:#FFFFDB">${esc(A.hero.caption)}</p>
</div>
</section>

${ticker(A.ticker)}

<section class="wrap sec-pad" style="padding-top:130px;padding-bottom:130px;display:flex;flex-wrap:wrap;gap:56px 96px">
<div style="flex:1 1 340px;min-width:0">
${scene('01', A.story.label)}
<h2 class="h2">${acc(A.story.headline)}</h2>
${A.story.quote ? `<p class="serif" style="margin:48px 0 0;padding-left:28px;border-left:1px solid #C99A56;font-style:italic;font-size:28px;line-height:1.35;color:#101C3C">${esc(A.story.quote)}</p>` : ''}
<div class="photo" style="margin-top:48px;height:460px">
<img src="${img(A.story.image)}" alt="${esc(A.story.image_alt)}" style="object-position:50% 45%">
${vf('', 'top:18px;left:18px;right:18px;bottom:18px')}
${A.story.image_label ? `<p class="slate" style="position:absolute;bottom:36px;left:40px">${esc(A.story.image_label)}</p>` : ''}
</div>
</div>
<div style="flex:1.3 1 460px;min-width:0;display:flex;flex-direction:column;gap:22px">
<p class="lead">${txt(A.story.lead)}</p>
${list(A.story.paragraphs).map((p) => `<p class="body" style="font-size:16px">${txt(p)}</p>`).join('\n')}
</div>
</section>

<section style="background:#101C3C;position:relative;overflow:hidden">
<img src="${img(S.monogram)}" alt="" aria-hidden="true" style="position:absolute;left:-80px;top:50%;transform:translateY(-50%);width:440px;opacity:0.07">
<div class="wrap sec-pad" style="position:relative;padding-top:130px;padding-bottom:130px;display:flex;flex-wrap:wrap;gap:64px 96px">
<div style="flex:1 1 440px;min-width:0">
${scene('02', A.mission.label, true)}
<p class="serif" style="margin:0;font-style:italic;font-size:clamp(30px,3.2vw,44px);line-height:1.25;color:#FFFFDB">${esc(A.mission.statement)}</p>
</div>
<div style="flex:1 1 400px;min-width:0;display:flex;flex-direction:column;gap:40px">
${list(A.mission.points).map((p) => `<div><p class="eyebrow light" style="margin-bottom:14px">${esc(p.label)}</p><p class="body light-text" style="font-size:16px">${txt(p.text)}</p></div>`).join('\n')}
</div>
</div>
</section>

<section class="wrap" style="padding-top:130px;padding-bottom:110px">
<div style="display:flex;flex-wrap:wrap;gap:40px 72px;align-items:flex-end;margin-bottom:56px">
<div style="flex:1 1 520px;min-width:0">
${scene('03', A.beliefs.label)}
<h2 class="h2">${acc(A.beliefs.headline)}</h2>
</div>
<p class="body" style="flex:1 1 340px;min-width:0;font-size:16px">${txt(A.beliefs.intro)}</p>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0;border-top:1px solid #101C3C">
${list(A.beliefs.items).map((b, i) => `<div class="belief"><p class="bnum">${pad(i + 1)}</p><h3 class="h3">${esc(b.title)}</h3><p class="body">${txt(b.text)}</p></div>`).join('\n')}
</div>
</section>

<section class="wrap" style="padding-top:40px;padding-bottom:130px">
<div style="display:flex;flex-wrap:wrap;gap:64px 96px;align-items:center">
<div class="photo" style="flex:1 1 400px;min-width:0;max-width:480px;margin:0 auto;min-height:580px">
<img src="${img(A.founder.image)}" alt="${esc(A.founder.image_alt)}" style="object-position:50% 30%">
${vf('tight')}
${A.founder.image_label ? `<p class="slate" style="position:absolute;bottom:40px;left:44px">${esc(A.founder.image_label)}</p>` : ''}
</div>
<div style="flex:1.2 1 460px;min-width:0">
${scene('', A.founder.label)}
<h2 class="h2">${esc(A.founder.name)}</h2>
<p style="margin:14px 0 0;font-family:'Poppins',sans-serif;font-size:12px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#5A5F6E">${esc(A.founder.title)}</p>
${A.founder.quote ? `<p class="serif" style="margin:32px 0 0;font-style:italic;font-size:26px;line-height:1.4;color:#101C3C">${esc(A.founder.quote)}</p>` : ''}
${list(A.founder.paragraphs).map((p) => `<p class="body" style="margin-top:22px;font-size:16px">${txt(p)}</p>`).join('\n')}
</div>
</div>
</section>

<section id="crew" class="on-dark" style="background:#0A1330;position:relative;overflow:hidden">
${vf('dark')}
<div class="wrap sec-pad" style="position:relative;padding-top:140px;padding-bottom:140px;text-align:center;max-width:980px">
${scene('', A.crew.label, true, true)}
<h2 class="h2" style="color:#FFFFDB">${acc(A.crew.headline)}</h2>
<p class="lead light-text" style="margin:28px auto 0;max-width:640px">${txt(A.crew.text)}</p>
<div style="display:flex;flex-direction:column;gap:52px;margin-top:88px">
${list(A.crew.credits).map((c) => `<div><p class="credit-l">${esc(c.role)}</p><p class="credit-n">${acc(c.name, 'acc-plain')}</p>${c.note ? `<p class="credit-s">${esc(c.note)}</p>` : ''}</div>`).join('\n')}
</div>
<div class="btn-row" style="justify-content:center;margin-top:80px">
<a href="/start/" class="btn btn-gold">${esc(A.crew.button)}</a>
${A.crew.button_2 ? `<a href="${esc(emailHref)}" class="btn btn-line-light">${esc(A.crew.button_2)}</a>` : ''}
</div>
</div>
</section>

<section class="on-dark" style="background:#101C3C">
<div class="wrap sec-pad" style="padding-top:120px;padding-bottom:120px">
<div style="max-width:720px">
${scene('', A.traits.label, true)}
<h2 class="h2" style="color:#FFFFDB">${acc(A.traits.headline)}</h2>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:40px 48px;margin-top:64px">
${list(A.traits.items).map((t) => `<div class="trait"><h3 class="h3" style="color:#FFFFDB">${esc(t.title)}</h3><p class="body light-text" style="margin-top:8px">${txt(t.text)}</p></div>`).join('\n')}
</div>
</div>
</section>

<section style="background:#EFE7D6">
<div class="wrap sec-pad" style="padding-top:120px;padding-bottom:120px;text-align:center;max-width:960px">
<img src="${img(S.monogram_dark)}" alt="" aria-hidden="true" style="width:54px;height:auto;display:block;margin:0 auto 32px">
${scene('', A.closing.label, false, true)}
<h2 class="h2">${acc(A.closing.headline)}</h2>
<a href="/start/" class="btn btn-navy" style="margin-top:44px">${esc(A.closing.button)}</a>
</div>
</section>`;
  return layout({ key: 'about', title: A.seo_title, body });
}

function replyLine() {
  return S.reply_days ? `<p class="body" style="font-size:13px;color:#5A5F6E">We'll reply within ${esc(S.reply_days)} business day${String(S.reply_days).trim() === '1' ? '' : 's'}.</p>` : '';
}
const consentLine = `<p class="body" style="flex-basis:100%;font-size:12px;color:#5A5F6E">By submitting, you agree to our <a href="/privacy/" style="color:#8A5A1C">Privacy Policy</a>.</p>`;
const formBox = 'flex:2 1 560px;min-width:0;background:#FFFFFF;border:1px solid #E4D9C2;padding:56px 52px;display:flex;flex-direction:column;gap:28px;scroll-margin-top:24px';

function heroBlock(h, { imgClass = 'c-hero-img', fade = false } = {}) {
  return `<section class="c-hero on-dark" style="position:relative;overflow:hidden;background:#0A1530;min-height:440px;display:flex;align-items:center">
<img src="${img(h.image)}" alt="${esc(h.image_alt)}" class="${imgClass}">
${fade ? '<div class="start-fade" aria-hidden="true"></div>' : ''}
${vf()}
<p class="slate rec slate-corner" aria-hidden="true" style="position:absolute;top:52px;left:56px">Rec</p>
<p class="slate slate-corner" aria-hidden="true" style="position:absolute;top:52px;right:56px">${esc(h.corner_label)}</p>
<div class="wrap" style="position:relative;width:100%;padding-top:84px;padding-bottom:64px">
<div style="max-width:640px">
${scene('', h.label, true)}
<h1 class="h1" style="color:#FFFFDB;font-size:clamp(40px,4.4vw,64px);line-height:1.02">${acc(h.headline)}</h1>
<p class="lead" style="margin-top:18px;max-width:540px;color:#D8DDE8;font-size:17px;line-height:1.7">${txt(h.text)}</p>
${h.show_status && h.status ? `<p style="margin:18px 0 0;display:flex;align-items:center;gap:10px;font-family:'Poppins',sans-serif;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;color:#AEB5C6"><span style="width:8px;height:8px;border-radius:50%;background:#F8C540;display:inline-block"></span>${esc(h.status)}</p>` : ''}
${h.scripture ? `<div style="margin-top:26px;padding-left:22px;border-left:1px solid #C99A56;max-width:520px">
<p class="serif" style="margin:0;font-style:italic;font-size:21px;line-height:1.4;color:#FFFFDB">${esc(h.scripture)}</p>
<p style="margin:12px 0 0;font-family:'Poppins',sans-serif;font-size:11px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#E1BC7A">${esc(h.scripture_ref)}</p>
</div>` : ''}
</div>
</div>
</section>`;
}

function reachUs() {
  return `<div style="border-top:1px solid rgba(201,154,86,0.4);padding-top:32px;display:flex;flex-direction:column;gap:18px">
<div><p class="eyebrow light" style="margin-bottom:6px">Email</p><a href="${esc(emailHref)}" style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:300">${esc(emailText)}</a></div>
<div><p class="eyebrow light" style="margin-bottom:6px">Based in</p><p class="body light-text">${esc(S.location)}. ${esc(S.location_note)}.</p></div>
<div><p class="eyebrow light" style="margin-bottom:6px">Follow along</p><p style="margin:0;display:flex;gap:20px">${S.instagram ? `<a href="${esc(S.instagram)}" target="_blank" rel="noopener" style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:300">Instagram</a>` : ''}${S.linkedin ? `<a href="${esc(S.linkedin)}" target="_blank" rel="noopener" style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:300">LinkedIn</a>` : ''}</p></div>
</div>`;
}

function embedBox(code, height, headingHtml, title, id) {
  const inner = code.startsWith('<')
    ? code
    : `<iframe src="${esc(code)}" title="${esc(title)}" loading="lazy" style="width:100%;height:${height}px;border:0;display:block;background:#FFFFFF"></iframe>
<p class="body" style="margin-top:16px;font-size:13px;color:#5A5F6E">Form not loading? <a href="${esc(code)}" target="_blank" rel="noopener" style="color:#8A5A1C">Open it in a new tab</a>.</p>`;
  return `<div id="${id}" class="inquiry embed-box" style="flex:2 1 560px;min-width:0;background:#FFFFFF;border:1px solid #E4D9C2;padding:48px 44px;scroll-margin-top:24px">
${headingHtml ? headingHtml.replace('<div>', '<div style="margin-bottom:24px">') : ''}
${code.startsWith('<') ? inner : inner}
</div>`;
}

// ---- Contact: general questions ----
function contactPage() {
  const C = CONT;
  const F = C.form || {};
  const P = C.panel || {};
  const topics = list(F.topics);
  const contactEmbed = String(S.contact_form || '').trim();
  const contactHeading = F.heading ? `<div><p class="eyebrow" style="margin-bottom:10px">${esc(F.label)}</p><h2 class="h3" style="font-size:30px">${acc(F.heading)}</h2></div>` : '';
  const messageBlock = contactEmbed
    ? embedBox(contactEmbed, parseInt(S.contact_form_height, 10) || 900, contactHeading, 'Contact form', 'message')
    : `<form id="message" class="inquiry" name="contact" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="company-url" style="${formBox}">
<input type="hidden" name="form-name" value="contact">
<p class="hidden"><label>Leave this empty: <input name="company-url" tabindex="-1" autocomplete="off"></label></p>
${F.heading ? `<div><p class="eyebrow" style="margin-bottom:10px">${esc(F.label)}</p><h2 class="h3" style="font-size:30px">${acc(F.heading)}</h2></div>` : ''}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">
<div class="field"><label for="m-name">Your name</label><input id="m-name" name="name" type="text" autocomplete="name" required></div>
<div class="field"><label for="m-email">Email</label><input id="m-email" name="email" type="email" autocomplete="email" required></div>
</div>
${topics.length ? `<div class="field">
<label for="m-topic">What's this about?</label>
<select id="m-topic" name="topic"><option value="">Choose one</option>${topics.map((o) => `<option>${esc(o)}</option>`).join('')}</select>
</div>` : ''}
<div class="field"><label for="m-msg">Message</label><textarea id="m-msg" name="message" required placeholder="${esc(F.message_placeholder || '')}"></textarea></div>
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:8px">
<button type="submit" class="btn btn-navy">${esc(F.button || 'Send message')}</button>
${replyLine()}
${consentLine}
</div>
</form>`;
  const body = `
${ticker(C.ticker)}
${heroBlock(C.hero)}

<section class="wrap" style="padding-top:72px;padding-bottom:130px;display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start">
${messageBlock}

<aside class="side" style="flex:1 1 320px;min-width:0;background:#101C3C;padding:60px 48px;display:flex;flex-direction:column;gap:32px;position:relative">
${vf()}
<div>
<p class="eyebrow light" style="margin-bottom:12px">${esc(P.book_label)}</p>
${P.book_text ? `<p class="body light-text" style="margin-bottom:20px">${txt(P.book_text)}</p>` : ''}
<a href="/start/" class="btn btn-gold" style="width:100%">${esc(P.book_button)}</a>
</div>
${reachUs()}
</aside>
</section>`;
  return layout({ key: 'contact', title: C.seo_title, body });
}

// ---- Start the conversation: discovery call form ----
function startPage() {
  const T = START;
  const F = T.form || {};
  const P = T.panel || {};
  const embed = String(S.discovery_form || '').trim();
  const embedHeight = parseInt(S.discovery_form_height, 10) || 1100;
  const heading = F.heading ? `<div><p class="eyebrow" style="margin-bottom:10px">${esc(F.label)}</p><h2 class="h3" style="font-size:30px">${acc(F.heading)}</h2></div>` : '';
  let formBlock;
  if (embed) {
    formBlock = embedBox(embed, embedHeight, heading, 'Discovery call form', 'inquiry');
  } else {
    const opts = (a) => list(a).map((o) => `<option>${esc(o)}</option>`).join('');
    const interests = [...services.map((s) => s.title), F.extra_interest].filter(Boolean);
    formBlock = `<form id="inquiry" class="inquiry" name="inquiry" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="company-url" style="${formBox}">
<input type="hidden" name="form-name" value="inquiry">
<p class="hidden"><label>Leave this empty: <input name="company-url" tabindex="-1" autocomplete="off"></label></p>
${heading}
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px">
<div class="field"><label for="c-name">Your name</label><input id="c-name" name="name" type="text" autocomplete="name" required></div>
<div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="c-biz">Business name</label><input id="c-biz" name="business" type="text" autocomplete="organization"></div>
<div class="field"><label for="c-web">Website or Instagram</label><input id="c-web" name="website" type="text"></div>
</div>
<div class="field"><label for="c-what">What does your business do?</label><input id="c-what" name="what-you-do" type="text"></div>
<div class="field">
<label for="c-stage">How long have you been in business?</label>
<select id="c-stage" name="time-in-business"><option value="">Choose one</option>${opts(F.stage_options)}</select>
</div>
<fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
<legend class="legend" style="margin-bottom:12px">What are you interested in? (Choose any)</legend>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 24px">
${interests.map((t) => `<label class="check"><input type="checkbox" name="interested-in[]" value="${esc(t)}"> ${esc(t)}</label>`).join('\n')}
</div>
</fieldset>
<div class="field"><label for="c-heavy">What's taking up more of your time than it should?</label><textarea id="c-heavy" name="taking-up-time" placeholder="${esc(F.heavy_placeholder || '')}"></textarea></div>
<div class="field">
<label for="c-heard">How did you hear about us?</label>
<select id="c-heard" name="heard-about-us"><option value="">Choose one</option>${opts(F.heard_options)}</select>
</div>
<div style="display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:8px">
<button type="submit" class="btn btn-navy">${esc(F.button || 'Send my inquiry')}</button>
${replyLine()}
${consentLine}
</div>
</form>`;
  }
  const body = `
${ticker(T.ticker)}
${heroBlock(T.hero)}

<section class="wrap" style="padding-top:72px;padding-bottom:130px;max-width:1000px">
${formBlock}

</section>`;
  return layout({ key: 'start', title: T.seo_title, body });
}

function thanksPage() {
  const T = CONT.thanks || {};
  const body = `
<section class="on-dark" style="background:#101C3C;position:relative;overflow:hidden">
${vf('dark')}
<div class="wrap sec-pad" style="position:relative;padding-top:150px;padding-bottom:150px;text-align:center;max-width:900px">
<p class="scene light" style="justify-content:center">That's a wrap</p>
<h1 class="h2" style="color:#FFFFDB">${acc(T.headline || 'Thank you.')}</h1>
<p class="lead light-text" style="margin:28px auto 0;max-width:600px">${txt(T.text || '')}</p>
<div class="btn-row" style="justify-content:center;margin-top:44px">
<a href="/" class="btn btn-gold">Back to home</a>
<a href="/services/" class="btn btn-line-light">Explore our services</a>
</div>
</div>
</section>`;
  return layout({ key: 'thanks', title: `Thank you | ${S.site_name}`, body });
}

function legalPage(key, file) {
  const { data, body: md } = frontMatter(read('content/' + file));
  const filled = md
    .replace(/\{email\}/g, S.email || '[your email]')
    .replace(/\{mailing_address\}/g, S.mailing_address || '[mailing address], Nashville, Tennessee');
  const { html, toc } = markdown(filled);
  const body = `
<section class="legal-hero on-dark" style="background:#0A1330;border-top:1px solid #26355E">
<div class="wrap" style="padding-top:72px;padding-bottom:64px">
<p class="scene">Legal</p>
<h1 class="serif" style="margin:0;font-weight:500;font-size:clamp(42px,5vw,68px);line-height:1.02;color:#FFFFDB">${acc(data.title || '')}</h1>
${data.subtitle ? `<p class="body light-text" style="margin-top:18px;max-width:620px">${esc(data.subtitle)}</p>` : ''}
${data.effective_date ? `<p style="margin:22px 0 0;font-family:'Poppins',sans-serif;font-size:11px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#E1BC7A">Effective date: ${esc(data.effective_date)}</p>` : ''}
</div>
</section>
<section class="wrap" style="padding-top:72px;padding-bottom:120px;display:flex;flex-wrap:wrap;gap:48px 80px;align-items:flex-start">
<nav class="toc" aria-label="On this page" style="flex:0 1 260px;min-width:0">
<p class="eyebrow" style="margin-bottom:10px">On this page</p>
${toc.map((t) => `<a href="#${t.id}">${inline(t.title)}</a>`).join('\n')}
</nav>
<article class="legal" style="flex:1 1 560px;min-width:0;max-width:780px">
${data.intro ? `<p class="intro">${esc(data.intro)}</p>` : ''}
${html}
</article>
</section>`;
  return layout({ key, title: data.seo_title || `${S.site_name}`, body });
}

function notFound() {
  const body = `
<section class="on-dark" style="background:#101C3C;position:relative;overflow:hidden">
${vf('dark')}
<div class="wrap sec-pad" style="position:relative;padding-top:150px;padding-bottom:150px;text-align:center;max-width:900px">
<p class="scene light" style="justify-content:center">Cut</p>
<h1 class="h2" style="color:#FFFFDB">This page isn't in the script.</h1>
<a href="/" class="btn btn-gold" style="margin-top:44px">Back to home</a>
</div>
</section>`;
  return layout({ key: '404', title: `Page not found | ${S.site_name}`, body });
}

// ---------- write ----------
function write(rel, html) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}
function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f); const d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
write('index.html', homePage());
write('services/index.html', servicesPage());
write('about/index.html', aboutPage());
write('contact/index.html', contactPage());
write('start/index.html', startPage());
write('thank-you/index.html', thanksPage());
write('privacy/index.html', legalPage('privacy', 'privacy.md'));
write('terms/index.html', legalPage('terms', 'terms.md'));
write('404.html', notFound());
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
copyDir(path.join(ROOT, 'images'), path.join(OUT, 'images'));
copyDir(path.join(ROOT, 'admin'), path.join(OUT, 'admin'));
console.log('Built the site into _site/');
