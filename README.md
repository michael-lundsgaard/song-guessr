# Song Guessr

A home-made Hitster: manage your own song library from Spotify, organise it into collections, and play Hitster-style games from it on the PC. See [ROADMAP.md](ROADMAP.md) for what's next.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (use the IP, not `localhost`. Spotify only accepts loopback-IP redirect URIs).

The top bar switches between **English and Danish** (EN / DA; a Danish browser starts in Danish) and between **auto, light and dark** theme.

## Spotify setup (once)

1. Go to https://developer.spotify.com/dashboard, log in, and **Create app**.
2. Name/description: anything. **Redirect URI:** `http://127.0.0.1:5173/` (exactly, including the trailing slash).
3. Under *Which API/SDKs are you planning to use?* tick **Web API** and **Web Playback SDK**. Save.
4. Copy the **Client ID** from the app's settings page and set it as `DEFAULT_CLIENT_ID` in `src/spotify.ts` (or paste it in the app's ⚙ settings). It's public; no client secret is needed because the app uses PKCE.
5. In the app, click **Connect Spotify**.
6. Under **User Management**, add **your own** Spotify account (name + the email of the Spotify account you log in with). Development-mode apps reject API calls with a 403 for unlisted accounts, even the owner's. Family members playing along on your PC don't need to be added.

Note: Spotify only lets development-mode apps read the songs of playlists you own or collaborate on. For anyone else's playlist (including Spotify's own), open it in Spotify, click a song, press Ctrl+A then Ctrl+C, and paste the copied track links into the app. Alternatively, drag the selection onto a playlist of your own and import that playlist.

## Adding songs

**+ Add songs** has two tabs.

**Paste links**, one per line:

- Playlist links import all their songs (optionally creating a collection named after the playlist).
- Track or album links. A `(1975)` on a line with a single track link overrides Spotify's year.
- **Liked Songs**: use the *Liked Songs* button (or paste `Liked Songs` on a line).
- In the Spotify desktop app, click a song, press Ctrl+A then Ctrl+C. The songs paste as track links. This works in playlists, albums and artist pages, but not in Liked Songs (use the button for those).

Songs already in the library are never fetched again.

**Search** searches Spotify as you type. ▶ previews a result, **+ Add** adds it. Use this for songs you only know by name: you see which version you get (original album, compilation, live…).

## Playback

▶ on a song plays it, and the player bar at the bottom of the page has replay, play/pause, volume and **Play on**:

- **This browser**: the tab itself becomes a Spotify device (Web Playback SDK), so the sound goes wherever the PC's audio goes. Needs Spotify Premium and Chrome or Edge.
- Any other Spotify device on the account (desktop app, phone, speaker). Open Spotify there first so it shows up in the list.

If the app shows **Reconnect Spotify**, click it once: playback needs two extra permissions.

## Years

Spotify reports the album's release year, which for remasters and compilations is often wrong for a timeline game. Songs where this looks likely are flagged ⚠. Click a year to correct it (✎ marks corrected years; clear the field to reset).

Next to a ⚠ year, 🔍 searches Spotify for the earliest non-compilation, non-live release of the same song and offers its year (→ 1975, click to use). **Find original years** does this for every ⚠ song in the view, and **Use found years** accepts all the results. If Spotify's year is right, click ✓ to stop flagging it.

## Duplicates and readiness

**Duplicates** in the sidebar lists songs that are in the library more than once (e.g. the original and a remaster). Merging keeps the version you pick, adds it to all the collections the others were in, and keeps the earliest year. Use **Not duplicates** for genuinely different songs.

When viewing a collection, a readiness line shows whether it's good to play: at least 50 songs, no ⚠ years left, and songs spread over several decades.

## Playing

Open **Play** in the top bar, pick a game, the collections (and optionally decades), the teams and the target, then **Start game**. Pick "This browser" as the player so no other app shows the song title.

- **Timeline** (Hitster rules): every team starts with one face-up card. The song plays, and the team whose turn it is picks a **+** slot on their timeline and confirms it (**Confirm placement** or Enter). A correct guess keeps the card; first to the target number of cards wins. With **Extra points** on, the host can also give +1 each for the exact year, the artist and the title. Extra points only break a tie on cards.
- **Guess the song**: the song plays, **Reveal** shows the card, and the host clicks **+1 Title / Artist / Year** for each part the team got right.
- **Closest year**: every team guesses the year at the same time; the host types the guesses in (Enter jumps to the next team). The closest team gets a point, an exact year two.
- **Which decade?**: the team picks the decade from big buttons. Quick, and good for younger players.
- **Who's singing?**: the team picks the artist from four choices drawn from the deck.

Each mode has its **rules** on the setup screen, and a **Rules** button during the game shows them again.

Keys: **space** play/pause, **R** replay, **Enter** reveal (Guess) or confirm placement (Timeline), **→** next song.

A year shown as **≈ 1981** is still flagged ⚠ in the library: it may be a remaster or compilation year, so the real year can be earlier. In Timeline, such a card also counts as correct one slot earlier.

A game in progress survives a page reload. Songs played in earlier games (including the starting cards) go to the back of the deck, so back-to-back games get new songs until the deck runs out. Game setup shows how many songs are still new, and **Forget played songs** resets that.

## Storage

The **Saved** indicator in the top bar is about the library: every change is saved automatically. Everything is saved to `data/library.json` by the dev server. The `data/` folder is git-ignored (the library is personal), so back it up yourself. The game in progress, the last game setup and the recently-played list are stored in the browser.

## Spotify Developer Policy

This app knowingly breaks two rules of Spotify's [Developer Policy](https://developer.spotify.com/policy):

- **III.2:** "Do not create a game, including trivia quizzes." The game modes are exactly that.
- **II.5:** cover art and metadata must be shown during playback. The game screens hide them on purpose, since guessing the song is the point.

It's built anyway as a private family game: it runs only on `127.0.0.1`, is never hosted or published, makes no money, and uses a development-mode Spotify app limited to the owner's account. It still streams through Spotify for a Premium subscriber, so artists are paid as for any other play. If you fork this, don't deploy the game modes publicly. The likely consequence of a breach is that Spotify revokes the app's API access.
