import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { GuideScreen } from './screens/GuideScreen';
import { CompareScreen } from './components/LandingCompareSection';
import { PUBLIC_PAGES } from './seo';
import { getPageSeo } from './lib/pageSeo';

const screens = {
  '/': MainMenuScreen,
  '/start': OnboardingScreen,
  '/guide': GuideScreen,
  '/compare': CompareScreen,
};

export function renderPublicPages() {
  return Object.keys(PUBLIC_PAGES).map((path) => {
    const Screen = screens[path as keyof typeof screens];
    if (!Screen) throw new Error(`Missing public renderer for ${path}`);
    const seo = getPageSeo(path);
    const head = renderToStaticMarkup(<>
      <title>{seo.title}</title>
      {seo.meta.map((meta) => <meta key={meta.name ?? meta.property} {...meta} />)}
      <link rel="canonical" href={seo.canonical} />
      {Object.entries(seo.jsonLd).map(([id, data]) => data && (
        <script key={id} id={id} type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
      ))}
    </>);
    const body = renderToString(<StaticRouter location={path}><Screen /></StaticRouter>);
    return { path, head, body };
  });
}
