# Live verification — 2026-09-11

## Separate-port deployment

- `./deploy.sh` completed twice, including build, startup, readiness checks, and preservation of existing data.
- Dashboard: `http://localhost:18780`; Navidrome: `http://localhost:4533`. Both bind to loopback by default.
- The former tunnel container was removed. The dashboard no longer proxies `/library/`, and Navidrome no longer trusts external identity headers.
- Browser checks passed for both independent logins, the dashboard's separate-port library link, rejected identity-header spoofing, CSRF protection, and the delayed-initial-response login regression.
- Five Node unit tests passed for URL validation, native metadata mapping, SQLite recovery, playlist ordering/idempotency, and playlist verification failures.
- The Go Spotify service regression tests passed in the Docker builder.
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
