import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageSeo } from '../lib/pageSeo';

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
  useEffect(() => {
    const seo = getPageSeo(pathname);
    document.title = seo.title;
    upsertLink('canonical', seo.canonical);
    seo.meta.forEach((meta) => upsertMeta(meta.name ?? meta.property!, meta.content, !!meta.property));
    Object.entries(seo.jsonLd).forEach(([id, data]) => upsertJsonLd(id, data));
  }, [pathname]);

  return null;
}
