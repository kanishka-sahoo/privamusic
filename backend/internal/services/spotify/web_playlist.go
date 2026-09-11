package spotify

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"strings"
	"time"
)

// Public web-player session parameters and persisted query adapted from
// SpotiFLAC at 90f51a4da5bff0ec51183dd5e789a78e6f6a009d. See licenses/SpotiFLAC.
const spotifyTOTPSecret = "GM3TMMJTGYZTQNZVGM4DINJZHA4TGOBYGMZTCMRTGEYDSMJRHE4TEOBUG4YTCMRUGQ4DQOJUGQYTAMRRGA2TCMJSHE3TCMBY"
const spotifyTOTPVersion = 61
const playlistQueryHash = "bb67e0af06e8d6f52b531f97468ee4acd44cd0f82b988e15c2ea47b1148efc77"

func generateSpotifyTOTP(now time.Time) (string, int, error) {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(spotifyTOTPSecret)
	if err != nil {
		return "", 0, err
	}
	var counter [8]byte
	binary.BigEndian.PutUint64(counter[:], uint64(now.Unix()/30))
	mac := hmac.New(sha1.New, key)
	mac.Write(counter[:])
	digest := mac.Sum(nil)
	offset := digest[len(digest)-1] & 15
	value := binary.BigEndian.Uint32(digest[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%06d", value%1000000), spotifyTOTPVersion, nil
}

func (c *APIClient) getWebPlaylist(ctx context.Context, id string) (*PlaylistResult, error) {
	client := newWebPlayerClient()
	client.client = c.httpClient
	result := &PlaylistResult{}
	for offset := 0; ; {
		response, err := client.Query(ctx, map[string]interface{}{
			"operationName": "fetchPlaylist",
			"variables":     map[string]interface{}{"uri": "spotify:playlist:" + id, "offset": offset, "limit": 1000, "enableWatchFeedEntrypoint": false},
			"extensions":    map[string]interface{}{"persistedQuery": map[string]interface{}{"version": 1, "sha256Hash": playlistQueryHash}},
		})
		if err != nil {
			return nil, fmt.Errorf("fetch public playlist: %w", err)
		}
		playlist := getMap(getMap(response, "data"), "playlistV2")
		content := getMap(playlist, "content")
		if len(playlist) == 0 || len(content) == 0 {
			return nil, fmt.Errorf("Spotify did not return public playlist contents")
		}
		if offset == 0 {
			result.Name = getString(playlist, "name")
			result.Owner = getString(getMap(getMap(playlist, "ownerV2"), "data"), "name")
			images := getMap(playlist, "images")
			if len(images) == 0 {
				images = getMap(playlist, "imagesV2")
			}
			result.CoverArtURL = webCover(images)
			for _, item := range getSlice(images, "items") {
				if m, ok := item.(map[string]interface{}); ok && result.CoverArtURL == "" {
					result.CoverArtURL = webCover(m)
				}
			}
		}
		items := getSlice(content, "items")
		total := getInt(content, "totalCount")
		if len(items) == 0 && offset < total {
			return nil, fmt.Errorf("Spotify playlist pagination stopped at %d of %d items", offset, total)
		}
		for _, item := range items {
			m, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			data := getMap(getMap(m, "itemV2"), "data")
			track := webTrack(data)
			if track.ID != "" && track.Name != "" {
				result.Tracks = append(result.Tracks, track)
			}
		}
		offset += len(items)
		if offset >= total {
			return result, nil
		}
	}
}

func webCover(m map[string]interface{}) string {
	var best string
	var width int
	for _, s := range getSlice(m, "sources") {
		source, ok := s.(map[string]interface{})
		if !ok {
			continue
		}
		if url := getString(source, "url"); url != "" && (best == "" || getInt(source, "width") > width) {
			best = url
			width = getInt(source, "width")
		}
	}
	return best
}

func webArtists(m map[string]interface{}) []string {
	var names []string
	for _, item := range getSlice(m, "items") {
		artist, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		name := getString(getMap(artist, "profile"), "name")
		if name == "" {
			name = getString(artist, "name")
		}
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func webTrack(data map[string]interface{}) Track {
	uri := getString(data, "uri")
	if !strings.HasPrefix(uri, "spotify:track:") {
		return Track{}
	}
	album := getMap(data, "albumOfTrack")
	artists := webArtists(getMap(data, "artists"))
	albumArtists := webArtists(getMap(album, "artists"))
	if len(albumArtists) == 0 {
		albumArtists = artists
	}
	return Track{
		ID: strings.TrimPrefix(uri, "spotify:track:"), Name: getString(data, "name"),
		Artists: artists, Artist: strings.Join(artists, ", "), Album: getString(album, "name"),
		AlbumID:      strings.TrimPrefix(getString(album, "uri"), "spotify:album:"),
		AlbumArtists: albumArtists, AlbumArtist: strings.Join(albumArtists, ", "),
		DurationMs: getInt(getMap(data, "trackDuration"), "totalMilliseconds"),
		DiscNumber: getInt(data, "discNumber"), TrackNumber: getInt(data, "trackNumber"),
		CoverArtURL: webCover(getMap(album, "coverArt")),
		Explicit:    getString(getMap(data, "contentRating"), "label") == "EXPLICIT",
	}
}
