import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'robots.txt', 'ads.txt', 'sitemap.xml', '_routes.json'],
    manifest: {
      name: 'Basketball Dynasty',
      short_name: 'Basketball Dynasty',
      description: 'Build a basketball dynasty where every contract, pick, trade, and playoff run matters.',
      theme_color: '#0a0c10',
      background_color: '#0a0c10',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        },
        {
          src: '/icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
    },
  }), cloudflare()],
});