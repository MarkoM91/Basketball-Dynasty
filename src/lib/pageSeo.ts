import {
  PUBLIC_PAGES, SITE_KEYWORDS, SITE_NAME, SITE_URL, absoluteUrl,
  faqPageJsonLd, organizationJsonLd, videoGameJsonLd, webApplicationJsonLd,
} from '../seo';
import { guideFaqJsonLd, howToJsonLd } from '../content/guide';
import { compareFaqJsonLd } from '../content/compare';

/** Shared by the static publisher and client navigation so their metadata stays aligned. */
export function getPageSeo(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = PUBLIC_PAGES[path];
  const title = page?.title ?? SITE_NAME;
  const description = page?.description ?? 'Browser basketball GM simulation.';
  const canonical = page ? absoluteUrl(path) : `${SITE_URL}/`;
  const meta = [
    { name: 'description', content: description },
    { name: 'keywords', content: SITE_KEYWORDS },
    { name: 'robots', content: page ? 'index, follow' : 'noindex, nofollow' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'en_US' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
  ];
  const jsonLd: Record<string, object | null> = {
    'seo-jsonld-app': webApplicationJsonLd(),
    'seo-jsonld-org': organizationJsonLd(),
    'seo-jsonld-game': videoGameJsonLd(),
    'seo-jsonld-faq': path === '/' ? faqPageJsonLd() : null,
    'seo-jsonld-howto': path === '/guide' ? howToJsonLd() : null,
    'seo-jsonld-guide-faq': path === '/guide' ? guideFaqJsonLd() : null,
    'seo-jsonld-compare-faq': path === '/compare' ? compareFaqJsonLd() : null,
  };
  return { title, canonical, meta, jsonLd };
}
