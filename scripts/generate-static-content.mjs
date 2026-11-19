import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE_URL = 'https://basketballdynasty.com';
const published = '2026-06-11';

const sources = [
  ['scripts/static-content/01-games-like-basketball-gm.md', '/games-like-basketball-gm'],
  ['scripts/static-content/02-first-season-guide.md', '/guides/first-season'],
  ['scripts/static-content/03-trade-strategy-guide.md', '/guides/trade-strategy'],
  ['scripts/static-content/04-draft-scouting-guide.md', '/guides/draft-scouting'],
  ['scripts/static-content/05-salary-cap-guide.md', '/guides/salary-cap'],
  ['scripts/static-content/06-game-plan-guide.md', '/guides/game-plan'],
  ['scripts/static-content/07-player-personalities-guide.md', '/guides/player-personalities'],
  ['scripts/static-content/08-nba-free-agency-rules.md', '/guides/nba-free-agency-rules'],
];

/**
 * Cloudflare serves each article from its folder and redirects /guides/x to /guides/x/, so the
 * trailing-slash URL is the one that answers 200. Canonicals, schema, sitemap and links all use it.
 */
export function articleUrl(slug) {
  return `${SITE_URL}${slug}/`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${href}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function extractField(raw, label, fallback = '') {
  const match = raw.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return match?.[1]?.trim() ?? fallback;
}

function titleFromSlug(slug) {
  return slug
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ') ?? 'Guide';
}

function cleanMarkdown(raw) {
  return raw
    .replace(/^# Page.+\n+/m, '')
    .replace(/^\*\*URL slug:\*\*.+\n/m, '')
    .replace(/^\*\*Title tag:\*\*.+\n/m, '')
    .replace(/^\*\*Meta description:\*\*.+\n/m, '')
    .replace(/^\*\*H1:\*\*.+\n/m, '')
    .replace(/^\*\*Updated:\*\*.+\n/m, '')
    .replace(/^---\n+/gm, '')
    .trim();
}

function extractFaq(markdown) {
  const faqIndex = markdown.indexOf('## FAQ');
  if (faqIndex < 0) return [];
  const faqText = markdown.slice(faqIndex);
  const matches = [...faqText.matchAll(/\*\*([^*?]+\??)\*\*\n([^*]+)/g)];
  return matches.map((match) => ({
    question: match[1].trim(),
    answer: match[2].replace(/\n+/g, ' ').trim(),
  }));
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let list = [];
  let table = [];

  const flushList = () => {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table
      .filter((row) => !/^\|?\s*:?-{2,}/.test(row))
      .map((row, rowIndex) => {
        const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => inlineMarkdown(cell.trim()));
        const tag = rowIndex === 0 ? 'th' : 'td';
        return `<tr>${cells.map((cell) => `<${tag}>${cell}</${tag}>`).join('')}</tr>`;
      })
      .join('');
    html.push(`<table>${rows}</table>`);
    table = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushTable();
      continue;
    }
    if (trimmed.startsWith('|')) {
      flushList();
      table.push(trimmed);
      continue;
    }
    if (trimmed.startsWith('*Internal links')) {
      // Editorial note in the source: publish only the linked pages, never the CTA notes.
      flushList();
      flushTable();
      const paths = [...new Set(trimmed.match(/\/(?:guides\/[a-z-]+|games-like-basketball-gm|trade-checker|guide|compare)\b/g) ?? [])];
      if (paths.length) {
        const links = paths.map((path) => `<a href="${hrefFor(path)}">${escapeHtml(NAV_LABELS[path] ?? path)}</a>`).join(' · ');
        html.push(`<p class="source-note">Related: ${links}</p>`);
      }
      continue;
    }
    const image = trimmed.match(/^!\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)$/);
    if (image) {
      flushList();
      flushTable();
      const [, alt, src, caption] = image;
      // Phone screenshots are captured at 750x1624 and shown at half size.
      html.push(`<figure><img src="${src}" alt="${escapeHtml(alt)}" width="375" height="812" loading="lazy" decoding="async">${caption ? `<figcaption>${inlineMarkdown(caption)}</figcaption>` : ''}</figure>`);
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushList();
      flushTable();
      html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      flushTable();
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      flushTable();
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      flushTable();
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    const numbered = trimmed.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      list.push(numbered[1]);
      continue;
    }
    flushList();
    flushTable();
    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  flushTable();
  return html.join('\n');
}

/** Articles live at /x/ (the 200 URL); app pages like /guide and /trade-checker have no slash. */
function hrefFor(path) {
  return /^\/(?:guides\/|games-like-basketball-gm)/.test(path) ? `${path}/` : path;
}

function pageFromSource([file, slug]) {
  // Normalise Windows line endings: the field and FAQ parsers expect plain \n.
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const title = extractField(raw, 'Title tag', titleFromSlug(slug));
  const meta = extractField(raw, 'Meta description', '');
  const h1 = extractField(raw, 'H1', title);
  const updated = extractField(raw, 'Updated', published);
  const markdown = cleanMarkdown(raw).replace(new RegExp(`#\\s*${h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`), '');
  return {
    slug,
    title,
    meta,
    h1,
    updated,
    body: renderMarkdown(markdown),
    image: markdown.match(/!\[[^\]]*\]\(([^)\s]+)/)?.[1],
    faq: extractFaq(markdown),
  };
}

function schema(page) {
  return JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.h1,
      datePublished: published,
      dateModified: page.updated,
      image: page.image ? `${SITE_URL}${page.image}` : undefined,
      mainEntityOfPage: articleUrl(page.slug),
      url: articleUrl(page.slug),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ]);
}

const NAV_LABELS = {
  '/games-like-basketball-gm': 'Games like Basketball GM',
  '/guides/first-season': 'First season guide',
  '/guides/trade-strategy': 'Trade strategy',
  '/guides/draft-scouting': 'Draft and scouting',
  '/guides/salary-cap': 'Salary cap guide',
  '/guides/game-plan': 'Game plan guide',
  '/guides/player-personalities': 'Player personalities',
  '/guides/nba-free-agency-rules': 'NBA free agency rules',
  '/trade-checker': 'NBA trade checker',
  '/guide': 'How to play',
  '/compare': 'Compare games',
};

function navFor(page) {
  const ref = page.slug.split('/').filter(Boolean).at(-1);
  // Descriptive anchor text and the 200-status (trailing-slash) URLs, plus the main guide hub.
  const links = [
    ['/', 'Home'],
    ['/guide', 'How to play'],
    [`/play?ref=guide-${ref}`, 'Play free'],
    ['/trade-checker', 'NBA trade checker'],
    ...sources
      .map(([, slug]) => slug)
      .filter((slug) => slug !== page.slug)
      .map((slug) => [`${slug}/`, NAV_LABELS[slug] ?? slug]),
  ];
  return links.map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`).join('');
}

function render(page) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.meta)}">
  <link rel="canonical" href="${articleUrl(page.slug)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl(page.slug)}">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.meta)}">
  <meta property="og:image" content="${SITE_URL}${page.image ?? '/promo/01-landing-hero.png'}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${schema(page)}</script>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f8fafc;color:#111827;line-height:1.65}
    main{max-width:880px;margin:0 auto;padding:40px 20px 64px}
    nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:32px}
    nav a{color:#0f766e;text-decoration:none;font-weight:700}
    h1{font-size:clamp(2rem,4vw,3.4rem);line-height:1.08;margin:0 0 18px}
    h2{margin-top:34px;color:#0f172a}
    h3{margin-top:24px}
    .lede{font-size:1.18rem;color:#334155}
    .cta{display:inline-block;margin:20px 0 10px;padding:12px 18px;background:#0f766e;color:white;border-radius:8px;text-decoration:none;font-weight:800}
    blockquote{border-left:4px solid #0f766e;margin:24px 0;padding:8px 18px;background:#ecfeff;color:#164e63}
    table{border-collapse:collapse;width:100%;margin:24px 0;background:white}
    th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}
    .source-note{border-top:1px solid #cbd5e1;margin-top:34px;padding-top:18px;color:#64748b}
    footer{margin-top:44px;color:#64748b;font-size:.95rem}
    .updated{margin:0;color:#64748b;font-size:.95rem}
    figure{margin:28px auto;max-width:340px;text-align:center}
    figure img{width:100%;height:auto;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.25);background:#0a0c10}
    figcaption{margin-top:10px;color:#475569;font-size:.92rem}
    main a{color:#0f766e}
  </style>
</head>
<body>
  <main>
    <nav>${navFor(page)}</nav>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="lede">${escapeHtml(page.meta)}</p>
    <p class="updated">Updated <time datetime="${page.updated}">${new Date(`${page.updated}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time></p>
    <a class="cta" href="/play?ref=guide-${page.slug.split('/').filter(Boolean).at(-1)}">Play free</a>
    ${page.body}
    <footer>Basketball Dynasty guide page. Static HTML, separate from the game bundle.</footer>
  </main>
</body>
</html>
`;
}

const pages = sources.map(pageFromSource);

for (const page of pages) {
  const file = join('public', page.slug.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(page), 'utf8');
}

writeFileSync(
  'public/static-content-manifest.json',
  JSON.stringify(pages.map(({ slug, title, meta, updated }) => ({ slug, url: articleUrl(slug), title, meta, lastmod: updated })), null, 2),
);
console.log(`Generated ${pages.length} static SEO pages from markdown sources`);
