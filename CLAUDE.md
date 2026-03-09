# Death & Taxes — Project Context

## Identity
- **Project**: Death & Taxes (fuckthetaxman.xyz)
- **Stack**: React 18 / Vite 6 / Canvas 2D / Vercel Serverless / Neon PostgreSQL
- **Repo**: https://github.com/txc0ld/FTTM.git
- **Status**: Active development

## Build & Run
```bash
npm install          # Install dependencies
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
git push origin main # Deploy (auto-deploys via Vercel + GitHub)
```

## Architecture
```
src/
  main.jsx              — Entry point, ThemeProvider + SoundProvider wrappers
  App.jsx               — Main orchestrator, nav, 19 canvas templates (~4300 lines)
  DailyRiot.jsx         — Riot voting system + leaderboard (~1400 lines)
  TaxTracker.jsx        — On-chain tax status per citizen
  IrsWatchdog.jsx       — Global contract audit scanner
  Citizenship.jsx       — Wallet friend groups + social
  Boneyard.jsx          — Evader (burned citizen) gallery
  Census.jsx            — Population stats + class breakdown
  KillFeed.jsx          — Kill/audit leaderboard + ticker
  WhaleWatch.jsx        — Top holders ranked
  ShareCard.jsx         — 1200x630 social card generator
  shared/
    theme.jsx           — Light/dark theme context
    sound.jsx           — Web Audio API UI sounds
    gif.js              — GIF89a encoder (zero deps)

api/
  tax-status.js         — POST: batch on-chain tax queries via LlamaRPC
  riot/
    vote.js             — POST: record vote + verify wallet signature (ethers)
    check-votes.js      — GET: vote limits for wallet/epoch
    leaderboard.js      — GET: top 100 fighters by win-loss
    history.js          — GET: last 50 votes

public/                 — Static assets (reaper.png, fingerprints, overlays)
```

## Key Constants
| Constant | Value |
|----------|-------|
| Citizens contract | `0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae` |
| Evader contract | `0x075f90ff6b89a1c164fb352bebd0a16f55804ca2` |
| Game contract (tax) | `0xa448c7f618087dda1a3b128cad8a424fbae4b71f` |
| Alchemy base | `https://eth-mainnet.g.alchemy.com/nft/v3/demo` |
| RPC | `https://eth.llamarpc.com` |
| Canvas size | 1080x1350 |
| BG color | `#dfff00` |
| Heading font | Bajern |
| Body font | DeptBody |

## Nav Views
`registry` (default) | `riot` | `boneyard` | `killfeed` | `whalewatch` | `watchdog` | `census` | `taxtracker` | `citizenship`

URL params: `?view=<tab>`, `?crew=<base64>` (citizenship)

## Code Conventions
- **Plain JSX** — no TypeScript
- **Inline styles** — no CSS files, no styled-components
- **Canvas rendering** — all art templates are pure Canvas 2D (no libraries)
- **Self-contained components** — each view is standalone, constants/helpers kept local
- **Context only for cross-cutting** — theme + sound via React Context, everything else is useState
- **localStorage caching** — all API data cached with TTLs
- **Wallet auth** — raw `window.ethereum` (no wagmi/reown), `personal_sign` once per session
- **Commits**: descriptive message + `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Database (Neon PostgreSQL)
Tables:
- `riot_fighters` — fighter_key (PK), token_id, is_evader, image, class, wins, losses
- `riot_votes` — winner/loser keys + images, wallet, timestamp
- `riot_vote_limits` — wallet + epoch (PK), main_voted, street_votes

Vote limits: 1 daily riot + 10 street riots per wallet per epoch (resets 19:00 UTC)

## localStorage Keys
| Key | TTL | Purpose |
|-----|-----|---------|
| `dt_theme` | — | Dark/light pref |
| `dt_sound_muted` | — | Sound toggle |
| `dt_boneyard_cache` | 12h | Evader list |
| `dt_census_cache` | 6h | Population stats |
| `dt_owners_cache` | 4h | Whale list |
| `dt_kill_leaderboard` | 5m | Kill feed data |
| `dt_riot_lb` | — | Leaderboard fallback |
| `dt_riot_main_${epoch}` | — | Daily vote flag |
| `dt_riot_street_${epoch}` | — | Street vote count |
| `dt_citizenship_friends` | — | Friend wallets |

## External Services
- **Alchemy NFT v3** (demo key) — metadata, ownership, contract scans
- **LlamaRPC** — free Ethereum RPC for tax contract calls
- **Neon DB** — PostgreSQL serverless (DATABASE_URL in Vercel env)
- **IPFS** (`ipfs.io`) — evader image source (proper backgrounds)
- **External leaderboard** — `dt-leaderboard-livid.vercel.app` (kill feed)
- **Vercel** — hosting + serverless functions

## Known Limitations
- Alchemy demo key has CORS issues on production for `v2/demo` endpoint
- No tests, no linting configured
- All contract addresses hardcoded in components
- No request deduplication on parallel fetches
- CORS `*` on all API endpoints

## Security Rules
- Wallet signatures verified server-side via `ethers.verifyMessage()`
- DATABASE_URL stored in Vercel env vars only (not in code)
- No secrets in source — `.env` is gitignored
- Vote limits enforced server-side (localStorage is just client cache)

## Key Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03 | Raw window.ethereum over wagmi/reown | Reown free tier limits to 1 project |
| 2026-03 | Session signature (sign once) | Per-vote signing too annoying UX |
| 2026-03 | IPFS over Alchemy CDN for evaders | Alchemy strips backgrounds on grayscale PNGs |
| 2026-03 | LlamaRPC for tax queries | Free, no API key, CORS-friendly |
| 2026-03 | Server-side vote limits | Can't trust localStorage-only enforcement |
