import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  APP_ROUTE_PATHS,
  PUBLIC_PAGES,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  faqPageJsonLd,
  organizationJsonLd,
  videoGameJsonLd,
  webApplicationJsonLd,
} from '../seo';
import { guideFaqJsonLd, howToJsonLd } from '../content/guide';
import { compareFaqJsonLd } from '../content/compare';

function upsertMeta(name: string, content: string, property = false) {
  const attr = property ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, data: object | null) {
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement('script');
  el.id = id;
  el.setAttribute('type', 'application/ld+json');
  el.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(el);
}

export function SeoHead() {
  const { pathname } = useLocation();
  const publicPage = PUBLIC_PAGES[pathname];
  const isAppRoute = APP_ROUTE_PATHS.includes(pathname as (typeof APP_ROUTE_PATHS)[number]);

  useEffect(() => {
    const title = publicPage?.title ?? SITE_NAME;
    const description = publicPage?.description ?? 'Browser basketball GM simulation.';
    const url = absoluteUrl(pathname);

    document.title = title;
    upsertMeta('description', description);
    upsertMeta('keywords', SITE_KEYWORDS);
    upsertMeta('robots', isAppRoute ? 'noindex, nofollow' : 'index, follow');
    upsertLink('canonical', publicPage ? url : `${SITE_URL}/`);

    upsertMeta('og:title', title, true);
    upsertMeta('og:description', description, true);
    upsertMeta('og:url', url, true);
    upsertMeta('og:type', 'website', true);
    upsertMeta('og:site_name', SITE_NAME, true);
    upsertMeta('og:locale', 'en_US', true);

    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);

    upsertJsonLd('seo-jsonld-app', webApplicationJsonLd());
    upsertJsonLd('seo-jsonld-org', organizationJsonLd());
    upsertJsonLd('seo-jsonld-game', videoGameJsonLd());
    upsertJsonLd('seo-jsonld-faq', pathname === '/' ? faqPageJsonLd() : null);
    upsertJsonLd('seo-jsonld-howto', pathname === '/guide' ? howToJsonLd() : null);
    upsertJsonLd('seo-jsonld-guide-faq', pathname === '/guide' ? guideFaqJsonLd() : null);
    upsertJsonLd('seo-jsonld-compare-faq', pathname === '/compare' ? compareFaqJsonLd() : null);
  }, [pathname, publicPage, isAppRoute]);

  return null;
}
