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
- [ ] _Maybe later:_ **Undo**, if the guard turns out not to be enough. Tried and dropped (2026-11-09): stepping back through every click, or back to the start of a face-down card, was more confusing than useful. If it comes back, it should take the game back to the previous card **already revealed**, so the host can move it to another spot on the timeline (re-scored) and change the extra points; the new song goes back on top of the deck. Game state only; a year fixed during the game stays fixed.
- [x] **Dispute and fix year during the game.** On the revealed card:
  - **Overrule** ("Count it as right / wrong"; Timeline, Decade and Artist): the host flips the verdict for this round only; the data is unchanged. An overruled Timeline card goes where its year belongs, not where it was placed, so the timeline stays in order.
  - **Fix year** (every mode): the host types the real year; it is saved on the song (override, and confirmed so no longer ⚠) and the round is re-scored with the same answer. Extra points already given stay if the answer is still right; an overrule is dropped.
  - Built on a snapshot of the teams before the round was scored (`round.before`), so a disputed round is scored again from scratch. Only the round's own song can be fixed; starting cards and earlier cards still need the library.
- [x] **Equal turns, but only when they can matter.** When a team reaches the target, the game continues until the end of that round only if a team that hasn't had its turn yet could still tie (its score + the most it can win in one turn ≥ the leader's). Otherwise it ends at once (A on 10 and B on 6 ends the game). After equal turns, a tie on points goes to extra points, then a sudden-death round (one more song each until someone leads). Closest year is unaffected (everyone answers every round).
  - Built (2026-11-10): teams that can't draw level are skipped, not just the ones after them (A 10, B 6, C 8 in Guess: C plays, B doesn't). Sudden death plays only the tied teams, in team order, and uses the same rule. A line on the game screen says when the last round or sudden death is on. "End game" and an empty deck still end at once (a tie there is a draw).
- [x] **Timer, visual only.** Setup option (off / 30 / 45 / 60 s). A ring counts down from when the song starts; at zero it turns red and keeps counting (+5, +12…) so the team knows to hurry. It never stops anything; the host decides.
  - First version (2026-11-10), to iterate on: the hidden card is the clock. Its outline drains like a fuse, the seconds left are at the top of the card, amber for the last 10 s, and at zero the card turns red and glows, counting on as +12. It starts when the round's song first plays (after a reload, when play is pressed) and keeps running when the music is paused (the team is still thinking). Hidden once the card is revealed. Remembered with the last setup; listed in the in-game rules.
  - Toned down (same day): plain seconds, 30 → 0 → −12 (stage-timer style; "0:" added nothing with limits of 60 s or less, and the minus hangs outside so the digits stay centred), and a calm overtime: the outline turns red with one soft flash, no glow, pulse or popping numbers, and the "?" stays green. A "strict" mode with the louder look could come back as a setup option if a game needs it.
- [ ] **Better original years: test MusicBrainz first.** Example: "Never Gonna Give You Up - 2022 Remaster" is in the library as 2022 (≈, but one slot of leniency doesn't help when it's 35 years off); about 220 songs still have an uncertain year.
  - First try the API by hand on a handful of songs (well-known, Danish, remasters, compilations) and compare with the real years before building anything.
  - Tested (2026-11-09, 21 songs; the "real" years are from memory, not checked): 15 matched exactly, 6 were 1 year off, none missing. It fixed all six big errors: Rick Astley 2022→1987, Laid Back _Sunshine Reggae_ 2008→1982, Charlie Daniels Band 1988→1979, Daft Punk _One More Time_ 2006→2000, Culture Club 1989→1983, Madonna 1985→1984. Two of them were already marked ✓, so confirmed songs need a check too. Danish acts were all found (Volbeat, Lukas Graham, D-A-D, Dizzy Mizz Lizzy, Rocazino, Laid Back, Safri Duo).
  - What worked: a recording search on the title without version suffixes + artist; keep exact title and artist matches; skip live/remix/edit versions; take the **earliest** first-release year (the most common year is useless: compilations dominate).
  - Two requests out of 21 were refused at one request every 1.1 s, so the lookup needs a retry with backoff.
  - MusicBrainz is open (no key), allows ~1 request/s and wants an app name in the User-Agent, so calls would go through the dev server backend.
  - Larger test (2026-11-10, 457 of 2,024 songs, on a copy of the library):
    - **The keyword ⚠ is a poor signal.** 70% of flagged songs (199 of 284) have the right year (mostly "Deluxe"/"Edition" albums from the same year), while about 1 in 16 unflagged songs is wrong (Sabaton on _Primo Victoria (Re-Armed)_ 2010 → 2005). "live" also matches "Alive".
    - **✓ isn't reliable either:** about 20 of 80 confirmed songs are clearly wrong (Billie Jean 2008, Faith Hill _This Kiss_ 2007, Liquido _Narcotic_ 2026). A few overrides look wrong too (D-A-D _Grow or Pay_ 1998, really 1991; Phil Collins _You'll Be in My Heart_ 2004, really 1999).
    - **An earlier MusicBrainz year is nearly always right** (76 cases, one wrong: Snoop Dogg 2011 → 2001). **A later one is always a miss:** big classics have hundreds of recordings and the search's top 50 skips the original (_Imagine_ → 1990). So a year may only ever move earlier.
    - Searching release groups (singles/albums) instead of recordings finds most classics the recording search missed (_Imagine_ 1971, _Roxanne_ 1978), but is sometimes far off the other way. Not found: about 4% (covers, soundtrack choirs, "Yusuf / Cat Stevens").
  - **ISRC works** (2026-11-11): a single track, Liked Songs and playlist pages include `external_ids.isrc` in development mode; the batch `/tracks?ids=` is 403 and album track lists don't include it. MusicBrainz links remaster ISRCs to the original recording (2022 _Never Gonna Give You Up_ remaster → 1987), and a recording search with `isrc:(A OR B …)` looks up many at once, so 150 songs take a few requests.
  - Plan:
    1. [x] Store the ISRC on songs (`toSongData`). Existing songs get it from **↻ Update from Spotify** on Liked Songs and own playlists (~26 calls); the other ~780 (Spotify-owned playlists pasted in, albums) use the search instead.
    2. [x] MusicBrainz proxy in the dev server (`server/musicbrainz.ts`, `/api/musicbrainz/recording|release-group|isrc`): 1 request per 1.1 s for all requests together, retry on 503/429 (pausing the whole queue), requests the browser gave up on are dropped from the queue, User-Agent `SongGuessr/0.1 ( https://github.com/michael-lundsgaard/song-guessr )`. When MusicBrainz is overloaded (it was on 2026-11-11, and two runs stopped), the browser waits 20, 40 and 60 s and asks again before giving up.
    3. [x] Year check, run by the browser (one writer of the library): batched ISRC lookup, title + artist search as fallback, result stored on the song (`yearCheck`: year, via isrc/search, checked at). Runs in the background after an import, plus once over the whole library; stopping just pauses it. Only an earlier year counts. ISRC results are applied automatically, search results are one-click suggestions; ✓ songs and overrides are never changed, only listed for review. Backup of the library before a bulk change.
       - Built (2026-11-11): `src/musicbrainz.ts` (batched ISRC lookup, search), `src/yearCheck.ts` (background runner), **Look up years on MusicBrainz** for the songs in view not checked yet, plus new songs after every import (older unchecked songs from an "Update from Spotify" wait for the button, so a big list doesn't start a long run). ISRC years go through `songYear()` (`autoYear`), so Spotify's year and the user's own decisions stay untouched; typing a year, ✓ or taking a suggestion settles a check (`settled`).
       - Tried on a copy of the library (Rock n Rock, 130 songs): 52 s, 112 by ISRC, 18 by search, all found; 14 years corrected automatically (all of Sabaton's _Primo Victoria (Re-Armed)_ 2010 → 2005, _So Cold_ 2011 → 2004, _T.N.T._ 1976 → 1975, _Mr. Brightside_ 2004 → 2003); ⚠ went from 19 to 1. Nothing outside the collection changed.
       - After the first real run (same day): a summary line when a run ends (corrected / to review / unchanged / not found, each a filter), and a search result equal to Spotify's year now clears the keyword ⚠ too (_Blitzkrieg (Remastered)_: ISRC unknown to MusicBrainz, search found 1984 = Spotify). Rock n Rock: 14 corrected, 116 unchanged, no ⚠ left.
       - Danske Favoritter (112 songs, no ISRCs, all by search): 29 to review, 80 unchanged, 3 not found. Afterwards: the summary is a banner with real buttons, "to review" counts down and only lists songs still waiting, the summary closes on another view, ⚠ shows in the warning colour on a corrected year, and the ✓ next to a suggestion sits further from → and says "keep this year".
    4. [x] ⚠ from evidence (checked / corrected / uncertain) instead of keywords; keywords only for unchecked songs, with word boundaries and without deluxe/edition.
       - Done (2026-11-11): a MusicBrainz match on Spotify's year (or by ISRC) clears ⚠, an earlier year waits as a suggestion; keywords are whole words (no more "Alive") without deluxe/edition, and only count for songs not looked up or not found. ⚠ in the whole library: 265 → 164 before the rest is looked up.
    5. [x] Setup option to leave out songs whose year is still uncertain. **Leave out songs with an uncertain year** in the game setup (remembered); the deck line says how many it leaves out.
    6. [ ] One-time job (after the game nights, it uses a day's Spotify quota): fetch the ISRC for every song without one (~1,900, one `/tracks/{id}` call each, as the batch endpoint is closed in development mode), then look those songs up on MusicBrainz again. Runs in the browser (the Spotify login is there), started from a link such as `?job=isrc`, not a button.
    7. [x] Remove the Spotify "Find original year" search (🔍 per song, **Find original years** and **Use found years**, `src/versions.ts`) once MusicBrainz has checked the whole library: it found the least and costs Spotify quota. Songs MusicBrainz doesn't find get a typed year or ✓.
       - Done early (2026-11-11), before the whole library is looked up: one fewer button to mix up with the MusicBrainz one.
    - All Out lists looked up (2026-11-11, 867 songs, ~36 min, all by search): 187 suggestions in the library (108 of them 1 year: single before album; 41 of 10+ years). Review found two search mistakes, now fixed: remixes, live and acoustic versions are no longer searched by the original's name (HVME's 2021 _Goosebumps - Remix_ got Travis Scott's 2016), and a match crediting all the song's artists wins (Lost Frequencies & Calum Scott's 2021 _Where Are You Now_ got a 2015 song of the same name with another singer).
- [ ] **Sound when the board is on the TV.** Casting the Chrome tab to a Chromecast also sends its audio, and the re-encoding makes it sound poor through the soundbar. To test first: cast the whole screen instead, with the PC's sound on Bluetooth. Option to discuss later: a separate "TV view" window (board only, no controls, no audio) to cast, while the main tab plays to the speaker. Spotify Connect straight to a TV Chromecast would show the title on screen, and a phone scanning a song QR would show it in the Spotify app.
- [ ] _Staged:_ phones as controllers (join by QR, send answers). It needs the dev server reachable on the home network, which goes beyond localhost-only; decide before building.
