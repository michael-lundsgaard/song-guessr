# Roadmap

Goal: a family Hitster on the PC. Pick a collection, songs play through the PC's speaker, and we guess title, artist and year, or build a timeline.

## 1. Spotify access (blocker)

- [x] Get Premium on the account that owns the Spotify developer app. Development-mode apps stop working without it, and playback needs it anyway.
- [x] Add that account under **User Management** in the developer dashboard.
- [ ] Verify an end-to-end import with each input type: a track link, a free-text search, an album, and a playlist you own.
- [x] Single track import works.
- [x] Verify the Liked Songs import (needs a reconnect for the new permission).

## 2. Library polish

- [x] Paste import (links, playlists, albums, free text), collections, year correction, storage in `data/library.json`
- [ ] **Find original year**: for a ⚠ song, search other versions of the same title/artist and suggest the earliest non-compilation release year (one click to accept).
- [ ] Detect duplicates (same title + artist, different track id, e.g. original vs remaster) and offer a merge.
- [ ] Preview a song in the library (short play button) to check that the version is right.
- [ ] Show a collection's readiness: song count, songs still marked ⚠, decade spread.

## 3. Playback

- [ ] Play inside the browser with the **Web Playback SDK**, so the PC becomes a Spotify device and the audio goes to the Bluetooth speaker.
- [ ] Fallback: choose an existing Spotify Connect device (e.g. the desktop app) and control it via `PUT /me/player/play`.
- [ ] Controls: play/pause, replay, optional random start offset (harder mode), volume.
- [ ] Make sure the song title can't leak: the Spotify desktop app, Windows media overlay or the browser tab title may show "now playing". Check each one and work around it.

## 4. Game shell

- [ ] Navigation between **Library** and **Play**.
- [ ] Game setup: choose one or more collections, optional decade filter, players or teams, and a target score / number of rounds.
- [ ] Deck: shuffle with no repeats within a game; remember recently played songs across games.
- [ ] Big-screen layout: large text, keyboard shortcuts (space = play/pause, enter = reveal, arrows = next).
- [ ] Persist an in-progress game so a page reload doesn't lose it.

## 5. Game modes

- [ ] **Guess the song**: play a song with the card hidden, then reveal title, artist and year; the host awards points per correct field.
- [ ] **Timeline** (Hitster rules): each player/team has a timeline; place the new song before, between or after the existing cards; a correct placement keeps the card; first to N cards wins. Optional "steal" for other teams.
- [ ] **Closest year**: everyone guesses the year; closest wins the point, and an exact year scores a bonus.
- [ ] **Decade round** or **artist speed round**: quick formats for younger players.

## 6. Nice to have

- [ ] Printable cards with QR codes (Hitster style) for playing away from the PC.
- [ ] Per-song stats: times played, how often it was guessed right; use them to flag songs that are too easy or too hard. Move storage to SQLite at this point, since play history is append-heavy and query-shaped. The JSON file is fine until then (1.2k songs ≈ 0.7 MB).
- [ ] Export and import a collection as a file to share with other families.
