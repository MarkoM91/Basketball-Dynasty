export const GA_MEASUREMENT_ID = 'G-W86NQW4BFB';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackPageView(path: string, title?: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title ?? document.title,
  });
}
