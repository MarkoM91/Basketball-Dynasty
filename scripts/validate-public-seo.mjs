import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const site = 'https://basketballdynasty.com';
const pages = [
  {
    path: '/',
    file: 'index.html',
    h1: 'Free basketball GM simulator',
    content: ['salary cap', 'free agency'],
    links: ['/start', '/guide', '/compare'],
    schema: ['WebApplication', 'Organization', 'VideoGame', 'FAQPage'],
  },
  {
    path: '/start',
    file: 'start.html',
    h1: 'Choose a franchise',
    content: ['Pick your scenario', 'Or pick any team yourself'],
    links: ['/'],
    schema: ['WebApplication', 'Organization', 'VideoGame'],
  },
  {
    path: '/guide',
    file: 'guide.html',
    h1: 'How to play Basketball Dynasty',
    content: ['GM tips', 'Guide FAQ', 'Run the regular season'],
    links: ['/', '/start', '/compare'],
    schema: ['WebApplication', 'Organization', 'VideoGame', 'FAQPage', 'HowTo'],
  },
  {
    path: '/compare',
    file: 'compare.html',
    h1: 'Compare basketball manager games',
    content: ['Basketball GM', 'Account required', 'Browser, no download'],
    links: ['/', '/start', '/guide'],
    schema: ['WebApplication', 'Organization', 'VideoGame', 'FAQPage'],
  },
];

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    if (name.startsWith('#')) {
      const hexadecimal = name[1].toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
    }
    return named[name.toLowerCase()] ?? entity;
  });
}

function textContent(html) {
  return decodeEntities(html
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g),
    ([, name, doubleQuoted, singleQuoted, unquoted]) => [
      name.toLowerCase(), decodeEntities(doubleQuoted ?? singleQuoted ?? unquoted),
    ]));
}

function tags(html, name) {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi')), ([tag]) => attributes(tag));
}

function exactlyOne(items, label) {
  assert.equal(items.length, 1, `${label}: expected exactly one, found ${items.length}`);
  return items[0];
}

function rootMarkup(html, label) {
  const opening = /<div\b[^>]*\bid=(?:"root"|'root')[^>]*>/i.exec(html);
  assert.ok(opening, `${label}: #root is missing`);
  const start = opening.index + opening[0].length;
  const divs = /<\/?div\b[^>]*>/gi;
  divs.lastIndex = start;
  let depth = 1;
  for (let match = divs.exec(html); match; match = divs.exec(html)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  assert.fail(`${label}: #root has no closing div`);
}

function jsonLdNodes(head, label) {
  const nodes = [];
  for (const [, attributeText, body] of head.matchAll(/<script\b([^>]*)>([^]*?)<\/script>/gi)) {
    if (attributes(attributeText).type !== 'application/ld+json') continue;
    let data;
    try {
      data = JSON.parse(body);
    } catch (error) {
      assert.fail(`${label}: invalid JSON-LD (${error.message})`);
    }
    for (const entry of Array.isArray(data) ? data : [data]) {
      assert.equal(entry['@context'], 'https://schema.org', `${label}: JSON-LD needs the schema.org context`);
      nodes.push(...(entry['@graph'] ?? [entry]));
    }
  }
  assert.ok(nodes.length, `${label}: JSON-LD is missing from the raw HTML head`);
  return nodes;
}

async function builtFile(name) {
  try {
    return await readFile(new URL(name, dist));
  } catch (error) {
    if (error.code === 'ENOENT') {
      assert.fail(`Missing ${fileURLToPath(new URL(name, dist))}. Run npm run build before validating public SEO.`);
    }
    throw error;
  }
}

async function validate() {
  const titles = new Set();
  const descriptions = new Set();
  const renderedRoots = new Set();
  const htmlBuffers = new Map();

  for (const page of pages) {
    const buffer = await builtFile(page.file);
    htmlBuffers.set(page.file, buffer);
    const html = buffer.toString('utf8');
    const head = exactlyOne(Array.from(html.matchAll(/<head\b[^>]*>([^]*?)<\/head>/gi)), `${page.path} head`)[1];
    const title = textContent(exactlyOne(Array.from(head.matchAll(/<title\b[^>]*>([^]*?)<\/title>/gi)), `${page.path} title`)[1]);
    assert.ok(title.length >= 20 && title.includes('Basketball Dynasty'), `${page.path}: expected a descriptive page title`);
    titles.add(title);

    const metas = tags(head, 'meta');
    const description = exactlyOne(metas.filter((meta) => meta.name === 'description'), `${page.path} description`).content;
    assert.ok(description?.length >= 70, `${page.path}: expected a useful meta description`);
    descriptions.add(description);
    const canonical = exactlyOne(tags(head, 'link').filter((link) => link.rel === 'canonical'), `${page.path} canonical`).href;
    assert.equal(canonical, `${site}${page.path}`, `${page.path}: canonical must identify this public page`);
    const robots = exactlyOne(metas.filter((meta) => meta.name === 'robots'), `${page.path} robots`).content;
    assert.ok(/\bindex\b/.test(robots) && !/\bnoindex\b/.test(robots), `${page.path}: public page must be indexable`);
    for (const [property, expected] of [['og:title', title], ['og:description', description], ['og:url', canonical]]) {
      assert.equal(exactlyOne(metas.filter((meta) => meta.property === property), `${page.path} ${property}`).content, expected);
    }

    const h1 = exactlyOne(Array.from(html.matchAll(/<h1\b[^>]*>([^]*?)<\/h1>/gi)), `${page.path} H1`);
    assert.equal(textContent(h1[1]), page.h1, `${page.path}: expected this page's rendered H1`);
    const root = rootMarkup(html, page.path);
    const visibleText = textContent(root);
    assert.ok(visibleText.length >= 400, `${page.path}: #root must contain useful rendered content before JavaScript`);
    assert.ok(!visibleText.includes('Loading franchise data'), `${page.path}: a loading placeholder was prerendered`);
    for (const content of page.content) {
      assert.ok(visibleText.toLowerCase().includes(content.toLowerCase()), `${page.path}: missing rendered content "${content}"`);
    }
    renderedRoots.add(root);

    const hrefs = new Set(tags(root, 'a').map((anchor) => anchor.href));
    for (const href of page.links) assert.ok(hrefs.has(href), `${page.path}: missing crawlable <a href="${href}">`);
    if (page.path === '/' || page.path === '/guide') {
      for (const article of ['first-season', 'trade-strategy', 'draft-scouting', 'salary-cap']) {
        assert.ok(hrefs.has(`/guides/${article}/`), `${page.path}: missing crawlable link to the ${article} article`);
      }
    }
    const schemaTypes = jsonLdNodes(head, page.path).flatMap((node) => [node['@type']].flat());
    assert.deepEqual(schemaTypes.toSorted(), page.schema.toSorted(), `${page.path}: wrong structured data types for this public page`);
    assert.ok(tags(html, 'script').some((script) => script.type === 'module' && script.src?.startsWith('/assets/')),
      `${page.path}: built application module is missing`);
  }

  assert.equal(titles.size, pages.length, 'Every public page needs its own raw HTML title');
  assert.equal(descriptions.size, pages.length, 'Every public page needs its own raw HTML description');
  assert.equal(renderedRoots.size, pages.length, 'Public pages must contain their own rendered content');
  const sitemap = (await builtFile('sitemap.xml')).toString('utf8');
  const sitemapUrls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => decodeEntities(url));
  assert.deepEqual(sitemapUrls.toSorted(), pages.map((page) => `${site}${page.path}`).toSorted(),
    'The sitemap must contain exactly the four public URLs');

  const serviceWorker = (await builtFile('sw.js')).toString('utf8');
  const entries = new Map(Array.from(serviceWorker.matchAll(/\{\s*["']?url["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?revision["']?\s*:\s*(null|["']([^"']+)["'])\s*\}/g),
    ([, url, , revision]) => [url.replace(/^\.?\//, ''), revision]));
  for (const page of pages) {
    const revision = createHash('md5').update(htmlBuffers.get(page.file)).digest('hex');
    assert.equal(entries.get(page.file), revision,
      `${page.path}: sw.js must precache ${page.file} with its current HTML revision (prerender before PWA generation)`);
  }
  console.log(`Public SEO validation passed: ${pages.length} prerendered pages, four-URL sitemap, and current service worker revisions.`);
}

await validate().catch((error) => {
  console.error(`Public SEO validation failed: ${error.message}`);
  process.exitCode = 1;
});
