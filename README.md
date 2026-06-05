# Basketball Dynasty

Build a basketball dynasty where every contract, pick, trade, and playoff loss reshapes the future of the franchise.

Premium mobile-first NBA front office simulator — a **production web app** with routing, auto-save, PWA install, and export/import.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

The static app outputs to `dist/`.

## Deploy

Works on any static host with SPA fallback:

- **Vercel** — `vercel.json` included (`vercel deploy`)
- **Netlify** — `netlify.toml` included
- **Cloudflare Pages** — build command `npm run build`, output `dist`

## Web app features

| Feature | Description |
|---------|-------------|
| **URL routing** | `/office`, `/trades`, `/playoffs`, etc. — back button works |
| **Auto-save** | Dynasty persists in `localStorage` on this device |
| **Main menu** | Continue dynasty, start new, export/import saves |
| **PWA** | Install to home screen; offline shell after first load |
| **Error boundary** | Crash recovery without losing local save |
| **Export/import** | JSON dynasty files for backup or device transfer |

## Game features

- Scenario onboarding — inherit a franchise at a crossroads
- Executive home — franchise pulse, window, ownership pressure
- Living roster — contracts, morale, trade value, GM notes
- Trade war room — league AI with acceptance analysis
- Draft board — uncertain prospects, bust risk
- Cap office — luxury tax warnings, extension risk
- Development plans — focused training with tradeoffs
- Playoff bracket — best-of-7 series simulation
- Free agency — pitch types, competing AI offers
- 30-team league AI — standings, strategies, headlines
- Franchise memory — long-term record of your decisions

## Stack

React 19 · TypeScript · Vite · Zustand · React Router · PWA

## North star

> I am building a dynasty, but every decision could destroy it.
