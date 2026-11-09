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
- [x] Deck: shuffle with no repeats within a game; songs played in recent games (last 500, this browser, starting cards included) go to the back of the deck, so back-to-back games use new songs until the deck runs out. Setup shows how many are new and can forget the history.
- [x] Big-screen layout: large card, scoreboard, keyboard shortcuts (space = play/pause, R = replay, Enter = reveal, → = next song).
- [x] Persist an in-progress game (this browser), so a page reload resumes it.
- [x] Fixed-size cards; the timeline wraps onto rows (tested with 30 cards); main buttons in a bar fixed to the bottom.
- [x] English / Danish and light / dark / auto theme in the top bar.
- [x] Winner screen with medals and **Play again** (same teams and settings, fresh songs).
- [x] Play a real game night and tune sizes, defaults and flow. First one played (October 2026); findings are in section 7.

## 5. Game modes

- [x] A revealed card shows a year that may be off (still ⚠: compilation or remaster year) as "≈ 1981". In Timeline, such a card also counts as correct one slot earlier, since the real year can only be earlier.
- [x] **Guess the song**: play a song with the card hidden, then reveal title, artist and year; the host awards a point per correct part.
- [x] **Timeline** (Hitster rules): each team starts with one face-up card; place the new song before, between or after the existing cards; a correct placement keeps the card; first to N cards wins.
- [x] Timeline: pick a slot, then confirm it (button or Enter), so a misclick can be changed.
- [x] Timeline extra points (setup option): +1 each for the exact year, the artist and the title, only when the card was placed right. They only break a tie on cards.
- [ ] Timeline "steal": another team may place a card the current team got wrong.
- [x] **Closest year**: everyone guesses the year; closest wins the point, and an exact year scores a bonus.
- [x] **Which decade?** and **Who's singing?** (four artists to choose from): quick formats for younger players. A ≈ year also accepts the decade before. Who's singing uses the first credited artist; the wrong choices never include another credited artist or a near-identical name (Macklemore / Macklemore & Ryan Lewis), so exactly one option is credited on the song (also in the rules).
- [x] Rules for every mode: on the setup screen and in a dialog during the game, in English and Danish.
- [ ] More ideas: a speed round (first team to buzz), "finish the lyric", a team-vs-team Timeline "steal".

## 6. Nice to have

- [ ] Printable cards with QR codes (Hitster style) for playing away from the PC.
- [ ] Per-song stats: times played, how often it was guessed right; use them to flag songs that are too easy or too hard. Move storage to SQLite at this point, since play history is append-heavy and query-shaped. The JSON file is fine until then (1.2k songs ≈ 0.7 MB).
- [ ] Export and import a collection as a file to share with other families. Not needed for now: the family has tablets, not laptops that can run the app.

## 7. After the first game night

In priority order.

- [x] **Guard on Next.** In Timeline, Decade and Artist the Confirm button becomes Next in the same spot, so a double click skipped the reveal (and the chance to give extra points). Next (button and →) now ignores input for 0.8 s after the reveal.
- [ ] *Maybe later:* **Undo**, if the guard turns out not to be enough. Tried and dropped (2026-11-09): stepping back through every click, or back to the start of a face-down card, was more confusing than useful. If it comes back, it should take the game back to the previous card **already revealed**, so the host can move it to another spot on the timeline (re-scored) and change the extra points; the new song goes back on top of the deck. Game state only; a year fixed during the game stays fixed.
- [x] **Dispute and fix year during the game.** On the revealed card:
  - **Overrule** ("Count it as right / wrong"; Timeline, Decade and Artist): the host flips the verdict for this round only; the data is unchanged. An overruled Timeline card goes where its year belongs, not where it was placed, so the timeline stays in order.
  - **Fix year** (every mode): the host types the real year; it is saved on the song (override, and confirmed so no longer ⚠) and the round is re-scored with the same answer. Extra points already given stay if the answer is still right; an overrule is dropped.
  - Built on a snapshot of the teams before the round was scored (`round.before`), so a disputed round is scored again from scratch. Only the round's own song can be fixed; starting cards and earlier cards still need the library.
- [ ] **Equal turns, but only when they can matter.** When a team reaches the target, the game continues until the end of that round only if a team that hasn't had its turn yet could still tie (its score + the most it can win in one turn ≥ the leader's). Otherwise it ends at once (A on 10 and B on 6 ends the game). After equal turns, a tie on points goes to extra points, then a sudden-death round (one more song each until someone leads). Closest year is unaffected (everyone answers every round).
- [ ] **Timer, visual only.** Setup option (off / 30 / 45 / 60 s). A ring counts down from when the song starts; at zero it turns red and keeps counting (+5, +12…) so the team knows to hurry. It never stops anything; the host decides.
- [ ] **Better original years: test MusicBrainz first.** Example: "Never Gonna Give You Up - 2022 Remaster" is in the library as 2022 (≈, but one slot of leniency doesn't help when it's 35 years off); about 220 songs still have an uncertain year.
  - First try the API by hand on a handful of songs (well-known, Danish, remasters, compilations) and compare with the real years before building anything.
  - Tested (2026-11-09, 21 songs; the "real" years are from memory, not checked): 15 matched exactly, 6 were 1 year off, none missing. It fixed all six big errors: Rick Astley 2022→1987, Laid Back *Sunshine Reggae* 2008→1982, Charlie Daniels Band 1988→1979, Daft Punk *One More Time* 2006→2000, Culture Club 1989→1983, Madonna 1985→1984. Two of them were already marked ✓, so confirmed songs need a check too. Danish acts were all found (Volbeat, Lukas Graham, D-A-D, Dizzy Mizz Lizzy, Rocazino, Laid Back, Safri Duo).
  - What worked: a recording search on the title without version suffixes + artist; keep exact title and artist matches; skip live/remix/edit versions; take the **earliest** first-release year (the most common year is useless: compilations dominate).
  - Two requests out of 21 were refused at one request every 1.1 s, so the lookup needs a retry with backoff.
  - MusicBrainz is open (no key), allows ~1 request/s and wants an app name in the User-Agent, so calls would go through the dev server backend.
  - Possible approach: match on ISRC first, then title + artist search; accept only artist matches; offer as a one-click suggestion; in bulk, accept automatically only when it agrees with the Spotify lookup.
  - Plus a setup option to leave out songs whose year is still uncertain.
- [ ] **Sound when the board is on the TV.** Casting the Chrome tab to a Chromecast also sends its audio, and the re-encoding makes it sound poor through the soundbar. To test first: cast the whole screen instead, with the PC's sound on Bluetooth. Option to discuss later: a separate "TV view" window (board only, no controls, no audio) to cast, while the main tab plays to the speaker. Spotify Connect straight to a TV Chromecast would show the title on screen, and a phone scanning a song QR would show it in the Spotify app.
- [ ] *Staged:* phones as controllers (join by QR, send answers). It needs the dev server reachable on the home network, which goes beyond localhost-only; decide before building.
