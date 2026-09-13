# Live verification — 2026-09-11

Historical results from before the application was moved to the repository root.

## Separate-port deployment

- `./deploy.sh` completed twice, including build, startup, readiness checks, and preservation of existing data.
- Dashboard: `http://localhost:18780`; Navidrome: `http://localhost:4533`. Both bind to loopback by default.
- The former tunnel container was removed. The dashboard no longer proxies `/library/`, and Navidrome no longer trusts external identity headers.
- Browser checks passed for both independent logins, the dashboard's separate-port library link, rejected identity-header spoofing, CSRF protection, and the delayed-initial-response login regression.
- Five Node unit tests passed for URL validation, native metadata mapping, SQLite recovery, playlist ordering/idempotency, and playlist verification failures.
- The WebSocket dependency was updated to 8.21.3; npm audit reported zero vulnerabilities.

## Download and playlist verification

The supplied SpotiFLAC Next 1.5.4 AppImage was tested with its existing authenticated session and Navidrome 0.63.2.

- Native metadata, download, and progress calls worked through the local WebKit bridge.
- A track and an album completed through the dashboard queue and appeared in Navidrome; the album reused the valid existing audio file.
- The supplied Spotify playlist `5FwoQeE2v5BGBvNj4JvdWl` resolved to 161 tracks.
- At the initial verification checkpoint, nine FLAC files totaling 199,535,098 bytes passed full FFmpeg decoding.
- Cancelling at a track boundary created a nine-entry Navidrome playlist in Spotify order. A second synchronization retained the same playlist ID and contents.
- Internal Docker-network checks verified FLAC streaming with byte ranges and embedded artwork delivery.
- Restarting preserved queue state, native authentication, and completed files.

The full playlist was resumed after that checkpoint. These results do not claim that all 161 tracks downloaded successfully: upstream provider misses are displayed per track and can be retried.

## Local artifacts

- `build/screenshots/separate-dashboard.png`
- `build/screenshots/separate-navidrome.png`
- `build/ACCESS.md`: private credentials and current service addresses

Build artifacts, media, native sessions, credentials and the supplied application archive are excluded from Git.

## Repository-root migration — 2026-09-12

- All application files were moved from the nested layout to the repository root; the retired Go/Next.js application and its deployment configuration were removed.
- `npm test` passed all five test files. Compose configuration, shell syntax, and Git whitespace checks passed.
- `./deploy.sh` built both local images and recreated the existing services successfully. Dashboard readiness passed.
- Container mounts were verified against root `build/data`, `build/music`, and `build/navidrome`; the existing external native-session path was retained.
- Browser checks passed for both logins, the library link, delayed login, CSRF protection, and rejected trusted-header spoofing. The checks used the host's installed Chromium via `CHROMIUM_PATH`.
- Existing dashboard credentials and persistent data were retained. No new download was submitted as part of this migration.

## React frontend redesign — 2026-09-12

- The dashboard and downloader login pages were rebuilt as a React 19 + Vite project under `web/` with a component, hook, and page structure; `npm run build` produces hashed assets in `dist/` with no inline scripts or styles, so the existing Content Security Policy is unchanged.
- The noVNC client is now bundled into the build instead of being proxied from `node_modules`, and the Docker image copies `dist/` rather than `web/` and the noVNC package.
- `npm test` passed all unit tests, including the updated native-route test. `scripts/check-scroll.mjs` passed against the build: polling preserves open track lists, scroll positions, and progress-bar animations.
- The real server was started locally against `dist/`: the index, favicon, and hashed assets are public with immutable caching; `/native/vnc.html`, `/native.html`, and `/index.html` require a session.
- Screenshots in `build/screenshots/v2-*.png` cover login, dashboard, expanded track details, dark mode, empty state, mobile, and the native login page. No console errors and no horizontal overflow at 390px.
- Not exercised here: `./deploy.sh` and the end-to-end smoke test against a live downloader session.

## Netcup deployment — 2026-09-12

- Migrated `/home/ksahoo/privamusic` on `ksahoo-srv-netcup` to the repository-root layout and successfully ran `./deploy.sh` with Node 24.20.0.
- Previous source and configuration are backed up privately at `/home/ksahoo/privamusic-root-update-20260912`; the deployment log and pre-migration data inventory are stored there too.
- Dashboard readiness passed, and both containers use the root `build/` bind mounts, including the existing native session.
- All 12 tests passed inside the deployment image, including FFmpeg enrichment checks. On the host, the two FFmpeg-dependent tests skip because FFmpeg is only installed in the image.
- Browser checks passed through the existing Tailscale HTTPS endpoints on ports 18780 and 4533, including both logins and native desktop connectivity/access controls.
- The before/after inventory matched: four jobs, 390 FLAC files, and 8,544,007,139 bytes of music-directory files. Existing partial job statuses were unchanged.
- All four Navidrome playlists retained the expected track order. Existing FLAC byte-range streaming and cover-art delivery passed. No new downloads were submitted.

## Multi-page dashboard — 2026-09-13

- The dashboard became a routed, multi-page app: sidebar navigation, an overview, a queue with tabs, paginated and searchable playlist/album/single sections, and one page per collection with a paginated track table. `src/server.mjs` now serves the app shell for extensionless paths and exposes album, duration and release fields per track.
- `npm run build` succeeded; `npm test` passed all unit tests. The real server was started locally against `dist/`: `/playlists`, `/albums/<id>` and `/queue?page=2` return the shell, while `/api/state`, `/native/vnc.html`, `/index.html` and unknown files still require a session.
- `scripts/check-scroll.mjs` was rewritten for the new routes and passed: polling on a collection page retains DOM nodes and scroll position, status changes update in place, unchanged progress bars do not re-animate, pagination and filters update the URL, the queue keeps existing cards when a new collection is inserted, and the browser back button works.
- Screenshots in `build/screenshots/v3-*.png` cover every page, dark mode, the empty state, mobile layouts and the navigation drawer. No console errors and no horizontal overflow at 390px.
- Not exercised here: `./deploy.sh` and the end-to-end smoke test against a live downloader session.

## Tailnet hostnames — 2026-09-13

- Two `tailscale/tailscale` sidecars (Compose profile `tailnet`) joined the tailnet from `ksahoo-srv-netcup` as `privamusic` and `navidrome-privamusic`, in userspace mode, proxying to the services over the Compose network. `./deploy.sh` printed the assigned HTTPS URLs and wrote them to `build/ACCESS.md`.
- From another tailnet machine: the dashboard shell, `/playlists`, and `/api/state` (401 without a session) answered over HTTPS with valid certificates on the dashboard hostname; Navidrome's login redirect and `/ping` answered on its own hostname. The first request took about twenty seconds while Tailscale issued the certificate.
- On the server, a real login through the new dashboard hostname returned a Secure, HttpOnly session cookie; `/api/state` reported the bridge and Navidrome ready and carried Navidrome's tailnet hostname for the library link; a cross-origin write was rejected with 403.
- The host-level Tailscale Serve entries on ports 18780 and 4533 were re-created after the tailnet rename and remain active alongside the sidecars.
