import { writeFileSync } from 'node:fs';

const SITE_URL = 'https://basketballdynasty.com';

const pages = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/start', changefreq: 'monthly', priority: '0.9' },
  { path: '/guide', changefreq: 'monthly', priority: '0.85' },
  { path: '/compare', changefreq: 'monthly', priority: '0.85' },
];

const lastmod = new Date().toISOString().slice(0, 10);

function loc(path) {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${loc(page.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

writeFileSync('public/sitemap.xml', `${xml}\n`);
console.log(`Generated public/sitemap.xml (${pages.length} URLs)`);
