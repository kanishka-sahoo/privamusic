The Spotify web-player session and playlist integration in
`backend/internal/services/spotify/web_player.go` and `web_playlist.go`
is adapted from https://github.com/spotbye/SpotiFLAC at commit
`90f51a4da5bff0ec51183dd5e789a78e6f6a009d`:

- `backend/spotfetch.go`: session initialization, access/client tokens, queries, playlist field mapping.
- `backend/spotify_metadata.go`: public playlist query and pagination.
- `backend/spotify_totp.go`: web-player session parameters; TOTP implemented here using Go's standard library.

Copyright (c) 2026 afkarxyz. The upstream MIT license is preserved in `licenses/SpotiFLAC`.
Local adaptations add request cancellation, bounded response reads, GraphQL error
handling, mapping to the existing Track model, and regression tests. No upstream
desktop UI or audio decryption code is included.
