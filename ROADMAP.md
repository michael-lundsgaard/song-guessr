# Roadmap

Goal: a family Hitster on the PC. Pick a collection, songs play through the PC's speaker, and we guess title, artist and year, or build a timeline.

> **Spotify policy:** the game modes go against Spotify's Developer Policy. Decided (2026-10-22): build them anyway as a private, localhost-only family game. See [README.md](README.md#spotify-developer-policy).

## 1. Spotify access

- [x] Get Premium on the account that owns the Spotify developer app. Development-mode apps stop working without it, and playback needs it anyway.
- [x] Add that account under **User Management** in the developer dashboard.
- [x] Verified imports: track links, album links, playlists you own, Liked Songs, and Ctrl+A / Ctrl+C from the Spotify app.

## 2. Library polish

- [x] Paste import (links, playlists, albums), collections, year correction, storage in `data/library.json`
- [x] Free-text lines in the paste box are gone (a blind top-1 search often picked the wrong song). The **Search** tab searches as you type and you pick the right version.
- [x] **Find original year**: for a ⚠ song, search other versions of the same title/artist and suggest the earliest non-compilation release year (one click to accept). Also in bulk for a whole view, plus ✓ to confirm that Spotify's year is right. It often finds nothing; that's fine, the game shows the year as uncertain instead (see section 5).
- [x] Detect duplicates (same title + artist, different track id, e.g. original vs remaster) and offer a merge.
- [x] Show a collection's readiness: song count, songs still marked ⚠, decade spread.
- [x] Preview a song in the library and in search results (▶ button, player bar at the bottom).

## 3. Playback

- [x] Play inside the browser with the **Web Playback SDK**, so the PC becomes a Spotify device and the audio goes to the Bluetooth speaker. Needs a reconnect for two new permissions.
- [ ] Fallback: choose an existing Spotify Connect device (e.g. the desktop app) and control it via `PUT /me/player/play`. Built, but on the desktop app the command succeeds and nothing plays. Parked: the browser player is what the game uses.
- [x] Controls: play/pause, replay, volume. A random start offset (harder mode) is in `player.play(song, { randomStart: true })`, to be switched on from game setup.
- [x] Browser player tested (with a headset).
- [x] Make sure the song title can't leak with the browser player: the tab title never names the song and the media-session info is replaced with "Song Guessr / Mystery song". Tested: the title only appears in the library's own player bar. Still worth a glance: Spotify on a phone logged into the same account shows "now playing" on Song Guessr.

## 4. Game shell

Built, not yet played for real.

- [x] Navigation between **Library** and **Play** (top bar; remembers the last page).
- [x] Game setup: mode, one or more collections, optional decade filter, teams, target (cards or points to win), "random start" harder mode. Remembers the last setup.
- [x] Deck: shuffle with no repeats within a game; songs played in recent games (last 500, this browser) go to the back of the deck.
- [x] Big-screen layout: large card, scoreboard, keyboard shortcuts (space = play/pause, R = replay, Enter = reveal, → = next song).
- [x] Persist an in-progress game (this browser), so a page reload resumes it.
- [ ] Play a real game night and tune sizes, defaults and flow.

## 5. Game modes

- [x] A revealed card shows a year that may be off (still ⚠: compilation or remaster year) as "≈ 1981". In Timeline, such a card also counts as correct one slot earlier, since the real year can only be earlier.
- [x] **Guess the song**: play a song with the card hidden, then reveal title, artist and year; the host awards a point per correct part.
- [x] **Timeline** (Hitster rules): each team starts with one face-up card; place the new song before, between or after the existing cards; a correct placement keeps the card; first to N cards wins.
- [ ] Timeline extras: "steal" (another team may place a card the current team got wrong), and a bonus for also naming title and artist.
- [ ] **Closest year**: everyone guesses the year; closest wins the point, and an exact year scores a bonus.
- [ ] **Decade round** or **artist speed round**: quick formats for younger players.

## 6. Nice to have

- [ ] Printable cards with QR codes (Hitster style) for playing away from the PC.
- [ ] Per-song stats: times played, how often it was guessed right; use them to flag songs that are too easy or too hard. Move storage to SQLite at this point, since play history is append-heavy and query-shaped. The JSON file is fine until then (1.2k songs ≈ 0.7 MB).
- [ ] Export and import a collection as a file to share with other families.
