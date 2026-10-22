# Song Guessr

A home-made Hitster: a Spotify-backed song library (React + Vite, TypeScript) with game modes to come. [README.md](README.md) is the user guide; [ROADMAP.md](ROADMAP.md) is the plan, so tick items off and add notes there as work lands.

## Commands

- `npm run dev`: app at http://127.0.0.1:5173 (never `localhost`: Spotify only accepts loopback-IP redirect URIs).
- `npx tsc --noEmit -p .`: typecheck. `npm run build`: typecheck + bundle (delete `dist/` afterwards).
- `npm run test:e2e`: Playwright tests in `e2e/` (Chromium). They start their own dev server on port 5174 with a generated library in `e2e/.data` (via `SONG_GUESSR_DATA_DIR`), block all Spotify traffic and seed localStorage, so they never touch `data/library.json` and run next to `npm run dev`. Tests save screenshots to `e2e/.results/screens/`; look at them after UI changes.
- For pure logic, a scratch script bundled with `npx esbuild <file> --bundle --platform=node` and run with node is quickest.

## Layout

- `src/spotify.ts`: auth (PKCE, scopes, token refresh) and every Web API call. Adding a scope makes the app show "Reconnect Spotify".
- `src/player.ts`: playback store (Web Playback SDK in the tab, or a Spotify Connect device), read with `usePlayer()`.
- `src/library.ts`: the `Library` type's pure update functions (each returns a new Library), plus persistence through the dev server.
- `src/parse.ts` / `src/importer.ts`: paste import. `src/versions.ts`: original-year lookup.
- `src/game.ts`: game rules as pure functions over a `Game` value, plus its localStorage persistence. UI in `src/components/PlayPage.tsx`, `GameSetup.tsx`, `GameScreen.tsx`. Game screens must never show the song before reveal (no `titleFor` on the `PlayerBar`).
- `src/i18n.ts`: all UI text (English + Danish). `src/theme.ts`: light/dark/auto theme. `src/components/Rules.tsx`: per-mode rules (text in i18n).
- `e2e/`: Playwright tests and fixtures (generated library, game states).
- `vite.config.ts`: tiny backend that stores the library in `data/library.json` (git-ignored, personal data).

## Spotify constraints (development-mode app)

- Search returns at most 10 results per page (`limit=10`, page with `offset`).
- Playlist contents come from `/playlists/{id}/items` (older `/tracks` as fallback), and only for playlists the user owns or collaborates on.
- No 30-second `preview_url`; previews go through the player.
- Rate limit is a rolling 30-second window, lower in development mode. Calls retry on 429 using `Retry-After`, except `QUOTA_EXCEEDED` (the app's quota is used up), which fails at once and stops imports and bulk lookups (`isQuotaExceeded`); keep bulk work in small pools (3–4 concurrent) and only call the API on a user action.
- The game modes knowingly break the Developer Policy (no games/trivia; metadata shown during playback). The owner accepted this for a private, localhost-only game; see README.md. Never add hosting, deployment or sharing of the game.

## Conventions

- All UI text lives in `src/i18n.ts`, in English (`en`, which defines the keys) and Danish (`da`). Components use `const t = useT()`; non-React code uses `t()`. Never hard-code visible text in components. Write Danish as a Dane would say it, not word for word.
- Colours are CSS tokens on `:root`, with light values under `[data-theme=light]` and the `prefers-color-scheme: light` media query (see `src/theme.ts`). No hard-coded colours in rules.
- Song years: `songYear()` (override, else Spotify's album year); `isYearSuspect()` flags likely remaster/compilation years.
- Keep `package-lock.json` out of diffs unless dependencies changed (`npm` rewrites `peer` flags).
- The shell is Windows with Git Bash and PowerShell; Python is not installed.
- Never link `node_modules` into another folder (junction/symlink): `git worktree remove --force` and `rm -rf` follow the link and delete the real packages. If they get damaged, run `npm install` (`npm ci` fails while `npm run dev` holds rollup's native module open).
- The user tests Spotify-dependent behaviour in the browser. Say what's untested rather than claiming it works.
