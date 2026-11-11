import { defineConfig } from '@playwright/test';

// The tests run their own dev server on another port, with a throwaway library in e2e/.data, so they
// never touch data/library.json and don't clash with a running `npm run dev`.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1366, height: 768 },
  },
  webServer: {
    command: 'npx vite --port 5174',
    url: 'http://127.0.0.1:5174',
    // MusicBrainz goes to a closed port, so no test ever reaches the real service; tests fake it with page.route.
    env: { SONG_GUESSR_DATA_DIR: 'e2e/.data', SONG_GUESSR_MUSICBRAINZ_URL: 'http://127.0.0.1:9/ws/2' },
    reuseExistingServer: false,
  },
});
