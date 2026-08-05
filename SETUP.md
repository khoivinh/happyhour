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

## GitHub account

Everything under `~/Developer` belongs to the **`khoivinh`** account. The `khoivinh-hl` work
account lives in a different folder tree entirely — but `gh` has both authenticated, and its
git credential helper serves only whichever account is *active*, globally. If `khoivinh-hl`
happens to be active, pushes here fail with `403 … denied to khoivinh-hl` even though reads
and commits work fine.

`.git/config` is untracked, so a fresh clone does **not** inherit the fix. Pin this repo to
the right account once, from the repo root:

```bash
git config --local --replace-all credential.https://github.com.helper ""
git config --local --add credential.https://github.com.helper '!f() { test "$1" = get && printf "username=khoivinh\npassword=%s\n" "$(gh auth token --user khoivinh)"; }; f'
```

The empty first value resets the inherited global helper; the second pins this repo. No token
is written to disk — it shells out to `gh` per call, so re-authing `gh` needs no change here.
Verify with `git push --dry-run origin main`: success means it worked, a 403 means it didn't.

Prefer this over `gh auth switch --user khoivinh`, which flips every repo on the machine and
breaks pushes in the `khoivinh-hl` tree until switched back.

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
npx playwright install   # browser binaries; not covered by npm install
```

## Verify

```bash
npm run dev          # Vite dev server
npx tsc --noEmit     # type check — must be clean
npm test             # Playwright (`playwright test`) — needs the browsers above
```

Open the dev server and confirm clock tiles render with live times. Weather comes from
Open-Meteo and needs no key, so a blank weather row means a network problem, not config.

## Gotchas

- **Path alias `@/*` → `client/src/*`.** Editors that don't read `tsconfig.json` will show
  phantom import errors.
- **The Time Zone Names backend is unshipped.** D1 migration `0003` must be applied *before*
  `wrangler deploy`, not after. The frontend is already live against the old API.
- **`wrangler` is not installed globally** on either Mac — invoke it with `npx wrangler`.
- **`.gitignore` ignores iCloud conflict copies** — the patterns `* 2.md`, `* 2.ts`, `* 2.sql`,
  `* 2/` match any path ending in ` 2.<ext>`. There is no bare `*` and no negation list, so
  new files are tracked normally; only a genuinely `… 2.md`-shaped filename needs `git add -f`.
- **`node_modules.nosync/`** is the real dependency directory — iCloud skips any path ending
  in `.nosync`. Plain `node_modules` is ignored too, so both spellings stay out of git.
