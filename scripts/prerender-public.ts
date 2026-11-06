import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { Plugin } from 'vite';

interface PublicPage { path: string; head: string; body: string }

/** Publish before PWA closeBundle so Workbox hashes the final HTML, including subpages. */
export function prerenderPublicPages(): Plugin {
  return {
    name: 'prerender-public-pages',
    apply: 'build',
    async writeBundle() {
      if (this.environment.name !== 'client') return;
      const config = this.environment.config;
      const outDir = resolve(config.root, config.build.outDir);
      const template = await readFile(resolve(outDir, 'index.html'), 'utf8');
      if (!template.includes('<!-- public-seo:start -->') || !template.includes('<div id="root"></div>')) {
        throw new Error('Public HTML template markers are missing');
      }
      const outfile = resolve(config.root, 'node_modules/.tmp/public-prerender.mjs');
      await build({
        entryPoints: [resolve(config.root, 'src/entry-public.tsx')],
        outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(process.cwd() + '/package.json');" },
      });
      const { renderPublicPages } = await import(`${pathToFileURL(outfile).href}?build=${Date.now()}`) as {
        renderPublicPages: () => PublicPage[];
      };
      for (const page of renderPublicPages()) {
        const html = template
          .replace(/<!-- public-seo:start -->[\s\S]*?<!-- public-seo:end -->/, () => `<!-- public-seo:start -->${page.head}<!-- public-seo:end -->`)
          .replace('<div id="root"></div>', () => `<div id="root">${page.body}</div>`);
        // Flat .html assets let Cloudflare serve canonical /guide URLs without a slash redirect.
        const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
        await writeFile(resolve(outDir, file), html);
      }
      config.logger.info('Prerendered four public pages with route-specific metadata.');
    },
  };
}
