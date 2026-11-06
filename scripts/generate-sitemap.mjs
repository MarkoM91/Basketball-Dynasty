import { writeFileSync } from 'node:fs';

const SITE_URL = 'https://basketballdynasty.com';

// Only public pages that work without a saved franchise belong in the sitemap.
const pages = ['/', '/start', '/guide', '/compare'];

const urls = pages
  .map((path) => {
    const url = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
    return `  <url>\n    <loc>${url}</loc>\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync('public/sitemap.xml', xml);
console.log(`Generated public/sitemap.xml (${pages.length} URLs)`);
