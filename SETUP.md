# Setup — Happyhour

Bootstrap manifest for a fresh clone. Walked by the `machine-parity` skill.
Git parity is not setup parity: everything below is deliberately untracked.

## Prerequisites

| Tool | Version here | Install |
|---|---|---|
| Node | v22.22.2 | `brew install node` |
| npm | 10.9.7 | ships with Node |

## Clone

```bash
git clone https://github.com/khoivinh/happyhour.git ~/Developer/Happyhour
```

## Secrets

Copy `.env.example` → `.env`, then fill in. **Values are not in this repo and never should be.**

| Variable | Where the value lives |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys (publishable key is not secret, but is per-environment) |
| `VITE_API_URL` | Cloudflare Workers API URL; `http://localhost:8787` for local dev |

`.env` and `.env.local` are gitignored. If the app builds but shows no data, an empty
`VITE_API_URL` is the first thing to check — Vite silently substitutes an empty string
rather than failing the build.

## Bootstrap

```bash
cd ~/Developer/Happyhour
npm install
```

## Verify

```bash
npm run dev          # Vite dev server
npx tsc --noEmit     # type check — must be clean
npm test             # Vitest
```

Open the dev server and confirm clock tiles render with live times. Weather comes from
Open-Meteo and needs no key, so a blank weather row means a network problem, not config.

## Gotchas

- **Path alias `@/*` → `client/src/*`.** Editors that don't read `tsconfig.json` will show
  phantom import errors.
- **The Time Zone Names backend is unshipped.** D1 migration `0003` must be applied *before*
  `wrangler deploy`, not after. The frontend is already live against the old API.
- **`wrangler` is not installed globally** on either Mac — invoke it with `npx wrangler`.
- The `.gitignore` contains a bare `*` line plus negations; adding a new tracked file may
  require an explicit `git add -f`.
