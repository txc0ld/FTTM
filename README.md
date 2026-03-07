# Death and Taxes — Dead Boys Club

Generative art tool for the Death and Taxes NFT collection (Contract: `0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae`).

## Features

- **Wallet Lookup** — Paste any wallet address to pull all owned Death & Taxes NFTs
- **Auto-populate** — Click a citizen to load image + metadata into templates
- **Direct ID Fetch** — Enter any citizen ID (0-6969) and pull metadata from chain
- **6 Templates** — Tombstone, Wanted, Death Certificate, Mugshot, Audit Notice, Obituary
- **Hollywood Distress** — Film grain, scratches, ink splatter, fold creases, torn edges, coffee stains
- **Metadata-Driven** — Templates auto-fill class, insurance status, and traits from NFT metadata
- **1080×1350px PNG** — Download-ready for social media

## Setup

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npx vercel --prod
```

Or connect your GitHub repo at [vercel.com](https://vercel.com) for auto-deploys.

## API

Uses [Reservoir](https://reservoir.tools) REST API for NFT data (no API key required for basic reads). Endpoints:

- `GET /users/{wallet}/tokens/v10` — Fetch all NFTs owned by wallet, filtered by collection
- `GET /tokens/v7` — Fetch single token metadata by contract:id

## Stack

- React 18 + Vite
- Canvas 2D rendering (no dependencies)
- Reservoir API (free tier, no key)
- Cloister Black (CDNFonts) + Space Mono + Special Elite (Google Fonts)

## Color Palette

- `#CCFF00` — Neon lime (background)
- `#000000` — Black (all details)
- No other colors. Ever.
