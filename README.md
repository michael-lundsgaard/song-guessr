# Song Guessr

A home-made Hitster: manage your own song library from Spotify, organise it into collections, and (soon) play game modes from it. See [ROADMAP.md](ROADMAP.md) for what's next.

## Run

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (use the IP, not `localhost`. Spotify only accepts loopback-IP redirect URIs).

## Spotify setup (once)

1. Go to https://developer.spotify.com/dashboard, log in, and **Create app**.
2. Name/description: anything. **Redirect URI:** `http://127.0.0.1:5173/` (exactly, including the trailing slash).
3. Under *Which API/SDKs are you planning to use?* tick **Web API** and **Web Playback SDK**. Save.
4. Copy the **Client ID** from the app's settings page and set it as `DEFAULT_CLIENT_ID` in `src/spotify.ts` (or paste it in the app's ⚙ settings). It's public; no client secret is needed because the app uses PKCE.
5. In the app, click **Connect Spotify**.
6. Under **User Management**, add **your own** Spotify account (name + the email of the Spotify account you log in with). Development-mode apps reject API calls with a 403 for unlisted accounts, even the owner's. Family members playing along on your PC don't need to be added.

Note: Spotify only lets development-mode apps read the songs of playlists you own or collaborate on. For anyone else's playlist (including Spotify's own), open it in Spotify, click a song, press Ctrl+A then Ctrl+C, and paste the copied track links into the app. Alternatively, drag the selection onto a playlist of your own and import that playlist.

## Adding songs

Paste into **+ Add songs**, one per line:

- Playlist links import all their songs (optionally creating a collection named after the playlist).
- Track or album links.
- Free text like `Queen - Bohemian Rhapsody (1975)` searches Spotify. A `(year)` on the line overrides Spotify's year.
- **Liked Songs**: use the *Liked Songs* button (or paste `Liked Songs` on a line).
- In the Spotify desktop app, click a song, press Ctrl+A then Ctrl+C. The songs paste as track links. This works in playlists, albums and artist pages, but not in Liked Songs (use the button for those).

Songs already in the library (and previous text searches) are never fetched again.

## Years

Spotify reports the album's release year, which for remasters and compilations is often wrong for a timeline game. Songs where this looks likely are flagged ⚠. Click a year to correct it (✎ marks corrected years; clear the field to reset).

## Storage

Everything is saved to `data/library.json` by the dev server. The `data/` folder is git-ignored (the library is personal), so back it up yourself.
