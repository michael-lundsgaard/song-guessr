import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// SONG_GUESSR_DATA_DIR lets the end-to-end tests use their own library instead of the real one.
const LIBRARY_FILE = path.resolve(__dirname, process.env.SONG_GUESSR_DATA_DIR ?? 'data', 'library.json');

// Tiny local "backend": the library lives in data/library.json so it survives browser
// resets and can be backed up or shared. Only available while running via Vite.
function libraryFileApi(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    if (req.url !== '/api/library') return next();
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(fs.existsSync(LIBRARY_FILE) ? fs.readFileSync(LIBRARY_FILE, 'utf8') : 'null');
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk));
      req.on('end', () => {
        try {
          const json = JSON.parse(body);
          fs.mkdirSync(path.dirname(LIBRARY_FILE), { recursive: true });
          // Write to a temp file first so a crash mid-write can't corrupt the library.
          fs.writeFileSync(LIBRARY_FILE + '.tmp', JSON.stringify(json, null, 2));
          fs.renameSync(LIBRARY_FILE + '.tmp', LIBRARY_FILE);
          res.statusCode = 204;
          res.end();
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e));
        }
      });
      return;
    }
    res.statusCode = 405;
    res.end();
  };
  return {
    name: 'library-file-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

// Spotify no longer accepts "localhost" redirect URIs, so serve on the loopback IP.
export default defineConfig({
  plugins: [react(), libraryFileApi()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, watch: { ignored: ['**/data/**', '**/e2e/**'] } },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
});
