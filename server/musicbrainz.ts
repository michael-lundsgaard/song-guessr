import type { Plugin } from 'vite';

// MusicBrainz proxy for the original-year check. The browser can't set the User-Agent MusicBrainz asks for,
// and its rate limit (about 1 request per second per IP) is easiest to keep in one place, so every request
// goes through here: GET /api/musicbrainz/recording?query=… -> https://musicbrainz.org/ws/2/recording?query=…&fmt=json

// SONG_GUESSR_MUSICBRAINZ_URL lets the end-to-end tests point this somewhere harmless.
const BASE_URL = process.env.SONG_GUESSR_MUSICBRAINZ_URL ?? 'https://musicbrainz.org/ws/2';
// MusicBrainz asks for an app name, version and contact; add a contact if it ever starts refusing requests.
const USER_AGENT = 'SongGuessr/0.1 ( private, localhost only )';
const GAP_MS = 1100;
const RETRIES = 4;
const TIMEOUT_MS = 20_000;
// Only what the year check uses, so this isn't an open proxy.
const PATH_RE = /^\/api\/musicbrainz\/(recording|release-group|isrc)(\/[\w-]+)?$/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One queue for all requests: each waits until GAP_MS after the previous one started.
let nextStart = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Waits for this request's turn. Returns false, without using a turn, if the browser gave up meanwhile. */
function turn(gaveUp: () => boolean): Promise<boolean> {
  const mine = queue.then(async () => {
    if (gaveUp()) return false;
    const wait = nextStart - Date.now();
    if (wait > 0) await sleep(wait);
    nextStart = Date.now() + GAP_MS;
    return true;
  });
  queue = mine.catch(() => {});
  return mine;
}

async function fetchWithRetry(url: string, gaveUp: () => boolean): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    if (!(await turn(gaveUp))) return null;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if ((res.status !== 503 && res.status !== 429) || attempt >= RETRIES) return res;
    // Busy: slow the whole queue down, not just this request.
    const retryAfter = Number(res.headers.get('retry-after'));
    const pause = retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
    nextStart = Math.max(nextStart, Date.now() + pause);
  }
}

export function musicBrainzApi(): Plugin {
  const handler = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/musicbrainz/')) return next();
    const url = new URL(req.url, 'http://local');
    const match = PATH_RE.exec(url.pathname);
    if (req.method !== 'GET' || !match) {
      res.statusCode = req.method !== 'GET' ? 405 : 404;
      res.end();
      return;
    }
    // A closed tab or a stopped check shouldn't keep the queue busy.
    let closed = false;
    req.on('close', () => (closed = true));
    url.searchParams.set('fmt', 'json');
    const target = `${BASE_URL}/${match[1]}${match[2] ?? ''}?${url.searchParams}`;
    try {
      const upstream = await fetchWithRetry(target, () => closed);
      if (!upstream) return;
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
      res.end(await upstream.text());
    } catch (e) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `MusicBrainz not reachable: ${e instanceof Error ? e.message : String(e)}` }));
    }
  };
  return {
    name: 'musicbrainz-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}
