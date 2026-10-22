# Song Guessr

A home-made Hitster: a Spotify-backed song library (React + Vite, TypeScript) with game modes to come. [README.md](README.md) is the user guide; [ROADMAP.md](ROADMAP.md) is the plan, so tick items off and add notes there as work lands.

## Commands

- `npm run dev`: app at http://127.0.0.1:5173 (never `localhost`: Spotify only accepts loopback-IP redirect URIs).
- `npx tsc --noEmit -p .`: typecheck. `npm run build`: typecheck + bundle (delete `dist/` afterwards).
- There is no test framework. For pure logic, bundle a scratch script with `npx esbuild <file> --bundle --platform=node` and run it with node.

## Layout

- `src/spotify.ts`: auth (PKCE, scopes, token refresh) and every Web API call. Adding a scope makes the app show "Reconnect Spotify".
- `src/player.ts`: playback store (Web Playback SDK in the tab, or a Spotify Connect device), read with `usePlayer()`.
- `src/library.ts`: the `Library` type's pure update functions (each returns a new Library), plus persistence through the dev server.
- `src/parse.ts` / `src/importer.ts`: paste import. `src/versions.ts`: original-year lookup.
- `src/game.ts`: game rules as pure functions over a `Game` value, plus its localStorage persistence. UI in `src/components/PlayPage.tsx`, `GameSetup.tsx`, `GameScreen.tsx`. Game screens must never show the song before reveal (no `titleFor` on the `PlayerBar`).
- `vite.config.ts`: tiny backend that stores the library in `data/library.json` (git-ignored, personal data).

## Spotify constraints (development-mode app)

- Search returns at most 10 results per page (`limit=10`, page with `offset`).
- Playlist contents come from `/playlists/{id}/items` (older `/tracks` as fallback), and only for playlists the user owns or collaborates on.
- No 30-second `preview_url`; previews go through the player.
- Rate limit is a rolling 30-second window, lower in development mode. Calls retry on 429 using `Retry-After`; keep bulk work in small pools (3–4 concurrent) and only call the API on a user action.
- The game modes knowingly break the Developer Policy (no games/trivia; metadata shown during playback). The owner accepted this for a private, localhost-only game; see README.md. Never add hosting, deployment or sharing of the game.

## Conventions

- Song years: `songYear()` (override, else Spotify's album year); `isYearSuspect()` flags likely remaster/compilation years.
- Keep `package-lock.json` out of diffs unless dependencies changed (`npm` rewrites `peer` flags).
- The shell is Windows with Git Bash and PowerShell; Python is not installed.
- The user tests Spotify-dependent behaviour in the browser. Say what's untested rather than claiming it works.
