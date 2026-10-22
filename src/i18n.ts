import { useSyncExternalStore } from 'react';
import type { Mode } from './game';

// UI text in English and Danish. `en` defines the keys; `da` must match it (the type checker enforces
// that), including each function's arguments. Components read the current language with useT();
// non-React code (importer logs, player errors) uses t().

export type Lang = 'en' | 'da';

const en = {
  // Top bar
  navLibrary: 'Library',
  navPlay: 'Play',
  saveSaving: 'Saving…',
  saveFailed: 'Save failed!',
  saveSaved: 'Saved',
  saveTitle: 'Library changes are saved automatically to data/library.json in the project folder',
  reconnect: 'Reconnect Spotify',
  reconnectTitle: 'The app needs new Spotify permissions (e.g. for playback)',
  connected: '● Spotify connected',
  disconnect: 'Disconnect',
  connect: 'Connect Spotify',
  setUpSpotify: 'Set up Spotify',
  settingsTitle: 'Spotify settings',
  themeNames: { auto: 'Auto (follows Windows)', light: 'Light', dark: 'Dark' },
  themeTitle: (current: string, next: string) => `Theme: ${current}. Click for ${next.toLowerCase()}.`,
  themeAria: (current: string) => `Theme: ${current}`,
  languageTitle: 'Language',
  loadErrorTitle: "Couldn't load the library",
  loadErrorHelp: 'The library is stored by the dev server. Start the app with',
  loadingLibrary: 'Loading library…',

  // Decades
  decadeShort: (decade: number) => `${String(decade).slice(2)}s`,
  decade: (decade: number) => `${decade}s`,

  // Library: sidebar and views
  allSongs: 'All songs',
  unsorted: 'Not in a collection',
  duplicates: 'Duplicates',
  collections: 'Collections',
  newCollection: (selected: number) => (selected ? `+ New collection from ${selected} selected` : '+ New collection'),
  collectionNamePrompt: 'Collection name',
  renameCollectionPrompt: 'Rename collection',
  rename: 'Rename',
  deleteCollection: 'Delete collection',
  confirmDeleteCollection: (name: string) => `Delete collection "${name}"? The songs stay in the library.`,
  hideImport: 'Hide import',
  addSongs: '+ Add songs',
  searchLibrary: 'Search title, artist, album…',
  checkYear: (n: number) => `⚠ Check year (${n})`,
  checkYearTitle: 'Songs whose Spotify year may be a remaster or compilation year',
  findYears: '🔍 Find original years',
  findingYears: 'Finding original years…',
  findYearsTitle: 'Search Spotify for the earliest release of every ⚠ song in this view',
  useFoundYears: (n: number) => `Use found years (${n})`,
  useFoundYearsTitle: 'Use the earliest release year found for each ⚠ song',
  decadesTitle: 'Songs per decade: handy for a balanced timeline',
  selectedCount: (n: number) => `${n} selected`,
  addToCollection: 'Add to collection…',
  removeFrom: (name: string) => `Remove from "${name}"`,
  confirmDeleteSongs: (n: number) => `Delete ${n} songs from the library?`,
  deleteFromLibrary: 'Delete from library',
  clearSelection: 'Clear selection',
  showing: (shown: number, total: number) => `Showing ${shown} of ${total} songs`,

  // Readiness
  readyOk: '✓ Ready to play',
  readyNotQuite: 'Not quite ready',
  readySongs: (n: number) => `${n} songs`,
  readySpan: (count: number, first: string, last: string) => `${count} decades, ${first}–${last}`,
  readyNoYears: 'no years',
  readyFewSongs: (n: number, min: number) => `only ${n} songs (aim for ${min}+)`,
  readyYearsToCheck: (n: number) => `${n} years to check ⚠`,
  readyWithoutYear: (n: number) => `${n} songs without a year`,
  readyFewDecades: (n: number) => (n === 1 ? 'only 1 decade' : `only ${n} decades`),
  readyDecadeShare: (pct: number, decade: string) => `${pct}% from the ${decade}`,

  // Song table
  selectAllShown: 'Select all shown',
  colTitle: 'Title',
  colArtist: 'Artist',
  colAlbum: 'Album',
  colYear: 'Year',
  colCollections: 'Collections',
  colAdded: 'Added',
  openInSpotify: 'Open in Spotify',
  noSongs: 'No songs here yet.',
  loadingMore: 'Loading more…',
  yearCorrectedTitle: (spotifyYear: string) => `Corrected by you (Spotify says ${spotifyYear}). Clear to reset.`,
  yearSuspectTitle: (album: string) =>
    `From "${album}": this may be a remaster or compilation year. Check the original release year.`,
  yearReleaseTitle: (date: string) => `Release date on Spotify: ${date}`,
  findYearTitle: 'Find the original release year on Spotify',
  retryTitle: (message: string) => `${message}. Click to retry.`,
  earliestFoundTitle: (album: string, year: number) =>
    `Earliest release found: "${album}" (${year}). Click to use this year.`,
  noEarlier: 'none',
  noEarlierTitle: 'Spotify has no earlier release of this song',
  confirmYearTitle: "Spotify's year is right: stop flagging it",

  // Player
  play: 'Play',
  pause: 'Pause',
  replayTitle: 'Play again from the start',
  playPauseTitle: 'Play / pause',
  nothingPlaying: 'Nothing playing',
  volume: 'Volume',
  playOn: 'Play on',
  playOnTitle: 'Play in this browser tab, or on another Spotify device (open the Spotify app there first)',
  thisBrowser: 'This browser',
  browserUnavailable: ' (unavailable)',
  browserStarting: ' (starting…)',
  lastDevice: 'Last used device (not found)',
  sdkInitError: "This browser can't play Spotify (it needs encrypted-media support; use Chrome or Edge)",
  sdkAuthError: 'Spotify rejected the login. Disconnect and connect Spotify again',
  sdkAccountError: 'Playing in the browser needs Spotify Premium',
  sdkLoadError: "Couldn't load the Spotify player (offline?)",
  playbackFailed: (message: string) => `Playback failed: ${message}`,
  browserPlayerStarting: 'The browser player is still starting. Try again in a moment',
  deviceGone: 'That Spotify device is gone. Pick another one',
  needsPremium: (message: string) => `${message}. Playback needs Spotify Premium`,

  // Spotify login and library file
  setClientIdFirst: 'Set your Spotify Client ID in settings first.',
  loginFailed: (error: string) => `Spotify login failed: ${error}`,
  loginStateLost: 'Login state was lost. Please try connecting again.',
  notConnected: 'Not connected to Spotify.',
  sessionExpired: 'Spotify session expired. Please connect again.',
  couldNotLoadLibrary: (status: number) => `Could not load library (${status})`,
  couldNotSaveLibrary: (status: number) => `Could not save library (${status})`,

  // Import panel
  tabPaste: 'Paste links',
  tabSearch: 'Search',
  connectToAdd: 'Connect Spotify (top right) to add songs.',
  addTo: 'Add to',
  noCollection: 'No collection',
  newCollectionOption: '+ New collection…',
  pastePlaceholder: [
    'Paste Spotify links, one per line:',
    'https://open.spotify.com/playlist/…   (playlist → all its songs)',
    'https://open.spotify.com/album/…      (album → all its songs)',
    'https://open.spotify.com/track/… (1975)   (single song; a year in brackets is kept)',
    '',
    'Liked Songs                            (or use the button below)',
    '',
    'Tip: in the Spotify app, click a song, Ctrl+A, Ctrl+C, and paste here (copies the songs as links).',
  ].join('\n'),
  likedSongs: 'Liked Songs',
  likedButton: '♥ Liked Songs',
  trackLinks: (n: number) => `${n} track links`,
  playlists: (n: number) => `${n} playlists`,
  albums: (n: number) => `${n} albums`,
  unrecognisedLines: (n: number) => `${n} lines without a Spotify link (use Search for those)`,
  nothingToImport: 'Nothing to import yet',
  collectionPerPlaylist: 'Collection per playlist',
  importing: 'Importing…',
  importButton: 'Import',
  importedSongs: (n: number) => `Imported ${n} songs`,
  searchSpotify: 'Search Spotify: title, artist…',
  searching: 'Searching…',
  compilationSuffix: ' (compilation)',
  inLibrary: 'In library',
  add: '+ Add',

  // Importer log
  loadingWhat: (what: 'playlist' | 'album' | 'liked') =>
    ({ playlist: 'Loading playlist…', album: 'Loading album…', liked: 'Loading Liked Songs…' })[what],
  loadingCount: (what: 'playlist' | 'liked', n: number) =>
    what === 'playlist' ? `Loading playlist… ${n} tracks` : `Loading Liked Songs… ${n} tracks`,
  listLoaded: (kind: 'playlist' | 'album' | 'liked', name: string, n: number) =>
    `${{ playlist: 'Playlist', album: 'Album', liked: 'Collection' }[kind]} "${name}": ${n} songs`,
  listSkipped: (name: string, n: number) => `"${name}": skipped ${n} podcast episodes, local files or unavailable items`,
  couldNotLoad: (what: string, message: string) => `Couldn't load ${what}: ${message}`,
  notPlayable: (id: string) => `Track ${id} is not playable on Spotify`,
  trackFailed: (id: string, message: string) => `Track ${id}: ${message}`,
  alreadyInLibrary: (n: number) => `${n} songs were already in the library (not fetched again)`,
  lookingUp: (done: number, total: number) => `Looking up songs… ${done}/${total}`,
  notRegistered: (message: string) =>
    `${message}. Add your Spotify account's email under User Management in the Spotify developer dashboard, then disconnect and connect again here.`,
  likedNeedsReconnect: (message: string) =>
    `${message}. Click Disconnect, then Connect Spotify again to grant access to Liked Songs.`,
  playlistNotAccessible: (message: string) =>
    `not accessible (${message}). Spotify only lets apps read playlists you own or collaborate on. Tip: open it in Spotify, click a song, press Ctrl+A then Ctrl+C, and paste the copied links here instead.`,

  // Duplicates
  noDuplicates: 'No duplicates found.',
  duplicatesIntro: (n: number) =>
    `${n} songs are in the library more than once. Merging keeps the chosen version, adds it to every collection of the others, and keeps the earliest year.`,
  mergeAll: (n: number) => `Merge all (${n})`,
  mergeAllTitle: 'Keep the preselected version of every song',
  keepAndMerge: (others: number) => `Keep selected, merge ${others} other${others > 1 ? 's' : ''}`,
  notDuplicates: 'Not duplicates',
  notDuplicatesTitle: 'These are different songs: stop listing them',

  // Settings dialog
  setupTitle: 'Spotify setup',
  setupStep1: 'Create an app at',
  setupStep1After: '(tick Web API and Web Playback SDK).',
  setupStep2: 'Add this Redirect URI:',
  setupStep3: 'Under User Management, add your own Spotify account (the email you log in with).',
  setupStep4: "Paste the app's Client ID below.",
  clientId: 'Client ID',
  clientIdPlaceholder: 'e.g. 1a2b3c…',
  cancel: 'Cancel',
  save: 'Save',

  // Game setup
  connectToPlay: 'Connect Spotify (top right) to play.',
  newGame: 'New game',
  gameHeading: 'Game',
  modeNames: {
    timeline: 'Timeline',
    guess: 'Guess the song',
    closest: 'Closest year',
    decade: 'Which decade?',
    artist: "Who's singing?",
  } satisfies Record<Mode, string>,
  modeHelp: {
    timeline: 'Hitster rules: place each song before, between or after the cards on your timeline. A correct card stays.',
    guess: 'Name the title, artist and year. One point for each.',
    closest: 'Every team guesses the year at once. Closest gets a point, the exact year two.',
    decade: 'Pick the decade the song is from. Quick, and good for younger players.',
    artist: 'Pick the artist from four choices. Good for younger players.',
  } satisfies Record<Mode, string>,
  modeTarget: {
    timeline: 'Cards to win',
    guess: 'Points to win',
    closest: 'Points to win',
    decade: 'Points to win',
    artist: 'Points to win',
  } satisfies Record<Mode, string>,
  songsFrom: 'Songs from',
  makeCollectionFirst: 'Make a collection in the library first.',
  decadeFilterTitle: 'Leave all off to play every decade',
  deckCount: (n: number) => `${n} songs in the deck`,
  uncertainCount: (n: number) => ` · ${n} with an uncertain year (shown as ≈ and judged leniently)`,
  playedNote: (played: number, fresh: number) =>
    `${played} of these were played in earlier games, so they come last: the next ${fresh} songs are all new.`,
  forgetPlayed: 'Forget played songs',
  confirmForgetPlayed: 'Forget which songs were played? Every song counts as new again.',
  teamsHeading: 'Teams',
  teamName: (i: number) => `Team ${i}`,
  removeTeam: 'Remove',
  addTeam: '+ Team',
  optionsHeading: 'Options',
  randomStart: 'Harder: random start',
  randomStartTitle: 'Start each song somewhere in the middle instead of at the beginning',
  extraPoints: 'Extra points for the exact year, artist and title (tiebreaker)',
  extraPointsTitle:
    'After each card, one extra point each for naming the exact year, the artist and the title. They only decide a tie.',
  startGame: 'Start game',
  needMoreSongs: 'Pick collections with more songs',

  // Game screen
  confirmEndGame: 'End the game now? The current scores decide the winner.',
  wins: (team: string) => `${team} wins!`,
  draw: "It's a draw!",
  songsPlayed: (n: number) => `${n} songs played`,
  extraSuffix: (n: number) => ` (+${n} extra)`,
  extraOnlyTie: 'Extra points only decide a tie',
  progress: (song: number, left: number, target: number) => `Song ${song} · ${left} left · first to ${target}`,
  endGame: 'End game',
  nextSong: 'Next song →',
  pickSpot: 'Pick a spot on the timeline',
  confirmPlacement: 'Confirm placement (Enter)',
  reveal: 'Reveal (Enter)',
  turn: (team: string) => `${team}${/s$/i.test(team) ? "'" : "'s"} turn`,
  hintTimeline: 'Where does this song go on your timeline? Pick a spot below, then confirm.',
  hintGuess: 'Name the title, the artist and the year, then reveal the card.',
  hintClosest: 'Every team guesses the year. Type in the guesses, then reveal.',
  hintDecade: 'Which decade is this song from?',
  hintArtist: "Who's singing?",
  everyoneGuesses: 'Everyone guesses',
  yearPlaceholder: 'Year',
  pickAnswer: 'Pick an answer',
  confirmAnswer: 'Confirm answer (Enter)',
  correctAnswer: '✓ Correct!',
  wrongDecade: (decade: string) => `✗ Wrong. It's from the ${decade}.`,
  wrongArtist: (artist: string) => `✗ Wrong. It's ${artist}.`,
  noGuess: 'no guess',
  yearsOff: (n: number) => (n === 0 ? 'exact!' : n === 1 ? '1 year off' : `${n} years off`),
  plusPoints: (n: number) => `+${n}`,
  correct: '✓ Correct! The card stays.',
  wrong: (year: string) => `✗ Wrong. It was ${year}.`,
  extraPointsLabel: 'Extra points (tiebreaker):',
  awardTitle: 'Title',
  awardArtist: 'Artist',
  awardYear: 'Year',
  awardExactYear: 'Exact year',
  replayKey: 'Replay (R)',
  playPauseKey: 'Play / pause (space)',
  placeHere: 'Place the song here',
  approxYearTitle: "Spotify's year; the original may be earlier",
};

export type Messages = typeof en;

const da: Messages = {
  navLibrary: 'Bibliotek',
  navPlay: 'Spil',
  saveSaving: 'Gemmer…',
  saveFailed: 'Kunne ikke gemme!',
  saveSaved: 'Gemt',
  saveTitle: 'Ændringer i biblioteket gemmes automatisk i data/library.json i projektmappen',
  reconnect: 'Forbind Spotify igen',
  reconnectTitle: 'Appen skal have nye Spotify-tilladelser (f.eks. til afspilning)',
  connected: '● Spotify forbundet',
  disconnect: 'Afbryd',
  connect: 'Forbind Spotify',
  setUpSpotify: 'Opsæt Spotify',
  settingsTitle: 'Spotify-indstillinger',
  themeNames: { auto: 'Auto (følger Windows)', light: 'Lyst', dark: 'Mørkt' },
  themeTitle: (current, next) => `Tema: ${current}. Klik for ${next.toLowerCase()}.`,
  themeAria: (current) => `Tema: ${current}`,
  languageTitle: 'Sprog',
  loadErrorTitle: 'Kunne ikke indlæse biblioteket',
  loadErrorHelp: 'Biblioteket gemmes af udviklingsserveren. Start appen med',
  loadingLibrary: 'Indlæser biblioteket…',

  decadeShort: (decade) => `${String(decade).slice(2)}'erne`,
  decade: (decade) => `${decade}'erne`,

  allSongs: 'Alle sange',
  unsorted: 'Ikke i en samling',
  duplicates: 'Dubletter',
  collections: 'Samlinger',
  newCollection: (selected) => (selected ? `+ Ny samling med ${selected} valgte` : '+ Ny samling'),
  collectionNamePrompt: 'Navn på samlingen',
  renameCollectionPrompt: 'Omdøb samlingen',
  rename: 'Omdøb',
  deleteCollection: 'Slet samling',
  confirmDeleteCollection: (name) => `Slet samlingen "${name}"? Sangene bliver i biblioteket.`,
  hideImport: 'Skjul import',
  addSongs: '+ Tilføj sange',
  searchLibrary: 'Søg i titel, kunstner, album…',
  checkYear: (n) => `⚠ Tjek år (${n})`,
  checkYearTitle: 'Sange hvor Spotifys år måske er året for en remaster eller opsamling',
  findYears: '🔍 Find de oprindelige år',
  findingYears: 'Finder de oprindelige år…',
  findYearsTitle: 'Søg på Spotify efter den tidligste udgivelse af hver ⚠-sang i visningen',
  useFoundYears: (n) => `Brug de fundne år (${n})`,
  useFoundYearsTitle: 'Brug det tidligste udgivelsesår, der blev fundet for hver ⚠-sang',
  decadesTitle: 'Sange pr. årti: praktisk for en jævn tidslinje',
  selectedCount: (n) => `${n} valgt`,
  addToCollection: 'Tilføj til samling…',
  removeFrom: (name) => `Fjern fra "${name}"`,
  confirmDeleteSongs: (n) => `Slet ${n} sange fra biblioteket?`,
  deleteFromLibrary: 'Slet fra biblioteket',
  clearSelection: 'Ryd valg',
  showing: (shown, total) => `Viser ${shown} af ${total} sange`,

  readyOk: '✓ Klar til at spille',
  readyNotQuite: 'Ikke helt klar',
  readySongs: (n) => `${n} sange`,
  readySpan: (count, first, last) => `${count} årtier, ${first}–${last}`,
  readyNoYears: 'ingen år',
  readyFewSongs: (n, min) => `kun ${n} sange (sigt efter ${min}+)`,
  readyYearsToCheck: (n) => `${n} år at tjekke ⚠`,
  readyWithoutYear: (n) => `${n} sange uden år`,
  readyFewDecades: (n) => (n === 1 ? 'kun 1 årti' : `kun ${n} årtier`),
  readyDecadeShare: (pct, decade) => `${pct}% fra ${decade}`,

  selectAllShown: 'Vælg alle viste',
  colTitle: 'Titel',
  colArtist: 'Kunstner',
  colAlbum: 'Album',
  colYear: 'År',
  colCollections: 'Samlinger',
  colAdded: 'Tilføjet',
  openInSpotify: 'Åbn i Spotify',
  noSongs: 'Ingen sange her endnu.',
  loadingMore: 'Indlæser flere…',
  yearCorrectedTitle: (spotifyYear) => `Rettet af dig (Spotify siger ${spotifyYear}). Ryd feltet for at nulstille.`,
  yearSuspectTitle: (album) =>
    `Fra "${album}": det kan være året for en remaster eller opsamling. Tjek det oprindelige udgivelsesår.`,
  yearReleaseTitle: (date) => `Udgivelsesdato på Spotify: ${date}`,
  findYearTitle: 'Find det oprindelige udgivelsesår på Spotify',
  retryTitle: (message) => `${message}. Klik for at prøve igen.`,
  earliestFoundTitle: (album, year) => `Tidligste udgivelse fundet: "${album}" (${year}). Klik for at bruge året.`,
  noEarlier: 'ingen',
  noEarlierTitle: 'Spotify har ingen tidligere udgivelse af sangen',
  confirmYearTitle: 'Spotifys år er rigtigt: stop med at markere det',

  play: 'Afspil',
  pause: 'Pause',
  replayTitle: 'Afspil igen fra start',
  playPauseTitle: 'Afspil / pause',
  nothingPlaying: 'Intet spiller',
  volume: 'Lydstyrke',
  playOn: 'Afspil på',
  playOnTitle: 'Afspil i denne browserfane eller på en anden Spotify-enhed (åbn Spotify-appen der først)',
  thisBrowser: 'Denne browser',
  browserUnavailable: ' (utilgængelig)',
  browserStarting: ' (starter…)',
  lastDevice: 'Sidst brugte enhed (ikke fundet)',
  sdkInitError: 'Denne browser kan ikke afspille Spotify (den skal understøtte krypterede medier; brug Chrome eller Edge)',
  sdkAuthError: 'Spotify afviste login. Afbryd og forbind Spotify igen',
  sdkAccountError: 'Afspilning i browseren kræver Spotify Premium',
  sdkLoadError: 'Kunne ikke indlæse Spotify-afspilleren (offline?)',
  playbackFailed: (message) => `Afspilning mislykkedes: ${message}`,
  browserPlayerStarting: 'Browserafspilleren starter stadig. Prøv igen om et øjeblik',
  deviceGone: 'Den Spotify-enhed er væk. Vælg en anden',
  needsPremium: (message) => `${message}. Afspilning kræver Spotify Premium`,

  setClientIdFirst: 'Angiv først dit Spotify Client ID i indstillingerne.',
  loginFailed: (error) => `Spotify-login mislykkedes: ${error}`,
  loginStateLost: 'Login-tilstanden gik tabt. Prøv at forbinde igen.',
  notConnected: 'Ikke forbundet til Spotify.',
  sessionExpired: 'Spotify-sessionen er udløbet. Forbind igen.',
  couldNotLoadLibrary: (status) => `Kunne ikke indlæse biblioteket (${status})`,
  couldNotSaveLibrary: (status) => `Kunne ikke gemme biblioteket (${status})`,

  tabPaste: 'Indsæt links',
  tabSearch: 'Søg',
  connectToAdd: 'Forbind Spotify (øverst til højre) for at tilføje sange.',
  addTo: 'Tilføj til',
  noCollection: 'Ingen samling',
  newCollectionOption: '+ Ny samling…',
  pastePlaceholder: [
    'Indsæt Spotify-links, ét pr. linje:',
    'https://open.spotify.com/playlist/…   (playliste → alle dens sange)',
    'https://open.spotify.com/album/…      (album → alle dets sange)',
    'https://open.spotify.com/track/… (1975)   (én sang; et år i parentes bliver brugt)',
    '',
    'Liked Songs                            (eller brug knappen nedenfor)',
    '',
    'Tip: i Spotify-appen, klik på en sang, Ctrl+A, Ctrl+C, og indsæt her (kopierer sangene som links).',
  ].join('\n'),
  likedSongs: 'Likede sange',
  likedButton: '♥ Likede sange',
  trackLinks: (n) => `${n} sanglinks`,
  playlists: (n) => `${n} playlister`,
  albums: (n) => `${n} albums`,
  unrecognisedLines: (n) => `${n} linjer uden Spotify-link (brug Søg til dem)`,
  nothingToImport: 'Intet at importere endnu',
  collectionPerPlaylist: 'Samling pr. playliste',
  importing: 'Importerer…',
  importButton: 'Importér',
  importedSongs: (n) => `Importerede ${n} sange`,
  searchSpotify: 'Søg på Spotify: titel, kunstner…',
  searching: 'Søger…',
  compilationSuffix: ' (opsamling)',
  inLibrary: 'I biblioteket',
  add: '+ Tilføj',

  loadingWhat: (what) =>
    ({ playlist: 'Indlæser playliste…', album: 'Indlæser album…', liked: 'Indlæser likede sange…' })[what],
  loadingCount: (what, n) =>
    what === 'playlist' ? `Indlæser playliste… ${n} sange` : `Indlæser likede sange… ${n} sange`,
  listLoaded: (kind, name, n) =>
    `${{ playlist: 'Playliste', album: 'Album', liked: 'Samling' }[kind]} "${name}": ${n} sange`,
  listSkipped: (name, n) => `"${name}": sprang ${n} podcastafsnit, lokale filer eller utilgængelige numre over`,
  couldNotLoad: (what, message) => `Kunne ikke indlæse ${what}: ${message}`,
  notPlayable: (id) => `Sangen ${id} kan ikke afspilles på Spotify`,
  trackFailed: (id, message) => `Sangen ${id}: ${message}`,
  alreadyInLibrary: (n) => `${n} sange var allerede i biblioteket (ikke hentet igen)`,
  lookingUp: (done, total) => `Slår sange op… ${done}/${total}`,
  notRegistered: (message) =>
    `${message}. Tilføj din Spotify-kontos e-mail under User Management i Spotifys developer dashboard, og afbryd og forbind så igen her.`,
  likedNeedsReconnect: (message) =>
    `${message}. Klik Afbryd og derefter Forbind Spotify igen for at give adgang til likede sange.`,
  playlistNotAccessible: (message) =>
    `ikke tilgængelig (${message}). Spotify lader kun apps læse playlister, du ejer eller samarbejder om. Tip: åbn den i Spotify, klik på en sang, tryk Ctrl+A og derefter Ctrl+C, og indsæt de kopierede links her i stedet.`,

  noDuplicates: 'Ingen dubletter fundet.',
  duplicatesIntro: (n) =>
    `${n} sange er i biblioteket mere end én gang. Ved sammenlægning beholdes den valgte version, den kommer med i alle de andres samlinger, og det tidligste år beholdes.`,
  mergeAll: (n) => `Læg alle sammen (${n})`,
  mergeAllTitle: 'Behold den forvalgte version af hver sang',
  keepAndMerge: (others) => `Behold den valgte, læg ${others} ${others > 1 ? 'andre' : 'anden'} sammen`,
  notDuplicates: 'Ikke dubletter',
  notDuplicatesTitle: 'Det er forskellige sange: vis dem ikke mere',

  setupTitle: 'Opsætning af Spotify',
  setupStep1: 'Opret en app på',
  setupStep1After: '(vælg Web API og Web Playback SDK).',
  setupStep2: 'Tilføj denne Redirect URI:',
  setupStep3: 'Under User Management: tilføj din egen Spotify-konto (den e-mail, du logger ind med).',
  setupStep4: 'Indsæt appens Client ID herunder.',
  clientId: 'Client ID',
  clientIdPlaceholder: 'f.eks. 1a2b3c…',
  cancel: 'Annullér',
  save: 'Gem',

  connectToPlay: 'Forbind Spotify (øverst til højre) for at spille.',
  newGame: 'Nyt spil',
  gameHeading: 'Spil',
  modeNames: {
    timeline: 'Tidslinje',
    guess: 'Gæt sangen',
    closest: 'Tættest på året',
    decade: 'Hvilket årti?',
    artist: 'Hvem synger?',
  },
  modeHelp: {
    timeline: 'Hitster-regler: placér hver sang før, mellem eller efter kortene på jeres tidslinje. Et rigtigt kort bliver liggende.',
    guess: 'Sig titel, kunstner og år. Ét point for hver.',
    closest: 'Alle hold gætter året på én gang. Tættest på får et point, det præcise år to.',
    decade: 'Vælg det årti, sangen er fra. Hurtigt og godt for de yngste.',
    artist: 'Vælg kunstneren blandt fire muligheder. Godt for de yngste.',
  },
  modeTarget: {
    timeline: 'Kort for at vinde',
    guess: 'Point for at vinde',
    closest: 'Point for at vinde',
    decade: 'Point for at vinde',
    artist: 'Point for at vinde',
  },
  songsFrom: 'Sange fra',
  makeCollectionFirst: 'Lav først en samling i biblioteket.',
  decadeFilterTitle: 'Lad alle være slået fra for at spille alle årtier',
  deckCount: (n) => `${n} sange i bunken`,
  uncertainCount: (n) => ` · ${n} med usikkert år (vises som ≈ og bedømmes mildt)`,
  playedNote: (played, fresh) =>
    `${played} af dem er spillet i tidligere spil, så de kommer sidst: de næste ${fresh} sange er alle nye.`,
  forgetPlayed: 'Glem spillede sange',
  confirmForgetPlayed: 'Glem hvilke sange der er spillet? Alle sange tæller som nye igen.',
  teamsHeading: 'Hold',
  teamName: (i) => `Hold ${i}`,
  removeTeam: 'Fjern',
  addTeam: '+ Hold',
  optionsHeading: 'Indstillinger',
  randomStart: 'Sværere: tilfældig start',
  randomStartTitle: 'Start hver sang et sted i midten i stedet for fra begyndelsen',
  extraPoints: 'Ekstrapoint for præcist år, kunstner og titel (afgør uafgjort)',
  extraPointsTitle:
    'Efter hvert kort ét ekstrapoint for hvert af: det præcise år, kunstneren og titlen. De afgør kun uafgjort.',
  startGame: 'Start spillet',
  needMoreSongs: 'Vælg samlinger med flere sange',

  confirmEndGame: 'Afslut spillet nu? Den nuværende stilling afgør vinderen.',
  wins: (team) => `${team} vinder!`,
  draw: 'Uafgjort!',
  songsPlayed: (n) => `${n} sange spillet`,
  extraSuffix: (n) => ` (+${n} ekstra)`,
  extraOnlyTie: 'Ekstrapoint afgør kun uafgjort',
  progress: (song, left, target) => `Sang ${song} · ${left} tilbage · først til ${target}`,
  endGame: 'Afslut spil',
  nextSong: 'Næste sang →',
  pickSpot: 'Vælg en plads på tidslinjen',
  confirmPlacement: 'Bekræft placering (Enter)',
  reveal: 'Vis kortet (Enter)',
  turn: (team) => `${team}${/[sxz]$/i.test(team) ? "'" : 's'} tur`,
  hintTimeline: 'Hvor hører sangen til på jeres tidslinje? Vælg en plads herunder, og bekræft.',
  hintGuess: 'Sig titlen, kunstneren og året, og vis så kortet.',
  hintClosest: 'Alle hold gætter året. Skriv gættene ind, og vis så kortet.',
  hintDecade: 'Hvilket årti er sangen fra?',
  hintArtist: 'Hvem synger?',
  everyoneGuesses: 'Alle gætter',
  yearPlaceholder: 'År',
  pickAnswer: 'Vælg et svar',
  confirmAnswer: 'Bekræft svar (Enter)',
  correctAnswer: '✓ Rigtigt!',
  wrongDecade: (decade) => `✗ Forkert. Den er fra ${decade}.`,
  wrongArtist: (artist) => `✗ Forkert. Det er ${artist}.`,
  noGuess: 'intet gæt',
  yearsOff: (n) => (n === 0 ? 'præcis!' : n === 1 ? '1 år ved siden af' : `${n} år ved siden af`),
  plusPoints: (n) => `+${n}`,
  correct: '✓ Rigtigt! Kortet bliver liggende.',
  wrong: (year) => `✗ Forkert. Det var ${year}.`,
  extraPointsLabel: 'Ekstrapoint (afgør uafgjort):',
  awardTitle: 'Titel',
  awardArtist: 'Kunstner',
  awardYear: 'År',
  awardExactYear: 'Præcist år',
  replayKey: 'Afspil igen (R)',
  playPauseKey: 'Afspil / pause (mellemrum)',
  placeHere: 'Placér sangen her',
  approxYearTitle: 'Spotifys år; originalen kan være ældre',
};

const MESSAGES: Record<Lang, Messages> = { en, da };
const KEY = 'sg.lang';
const listeners = new Set<() => void>();

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'en' || stored === 'da') return stored;
  } catch {}
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('da') ? 'da' : 'en';
}

let lang = initialLang();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** The current language's text, for code outside React components. */
export const t = (): Messages => MESSAGES[lang];

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useLang = (): Lang => useSyncExternalStore(subscribe, () => lang);

/** The current language's text; re-renders the component when the language changes. */
export const useT = (): Messages => MESSAGES[useLang()];

/** Locale for dates and numbers. */
export const locale = () => (lang === 'da' ? 'da-DK' : 'en-GB');
