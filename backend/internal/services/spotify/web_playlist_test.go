package spotify

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type spotifyTransport func(*http.Request) (*http.Response, error)

func (f spotifyTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func testResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}

// Exercise the actual public method: app-token metadata omits tracks, session
// negotiation succeeds, and a playlist is assembled across multiple pages.
func TestPlaylistWebFallback(t *testing.T) {
	invalidateSpotifyAccessTokenCache()
	defer invalidateSpotifyAccessTokenCache()
	pages := 0
	c := NewAPIClient("test-id", "test-secret")
	c.httpClient = &http.Client{Transport: spotifyTransport(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Host {
		case "accounts.spotify.com":
			return testResponse(200, `{"access_token":"app-token","expires_in":3600}`), nil
		case "api.spotify.com":
			return testResponse(200, `{"name":"Gym"}`), nil
		case "open.spotify.com":
			if r.URL.Path == "/api/token" {
				return testResponse(200, `{"accessToken":"web-token","clientId":"web-client"}`), nil
			}
			config := base64.StdEncoding.EncodeToString([]byte(`{"clientVersion":"test-version"}`))
			response := testResponse(200, `<script id="appServerConfig" type="text/plain">`+config+`</script>`)
			response.Header.Set("Set-Cookie", "sp_t=device; Path=/")
			return response, nil
		case "clienttoken.spotify.com":
			return testResponse(200, `{"response_type":"RESPONSE_GRANTED_TOKEN_RESPONSE","granted_token":{"token":"client-token"}}`), nil
		case "api-partner.spotify.com":
			if r.Header.Get("Authorization") != "Bearer web-token" {
				t.Fatal("wrong web authorization")
			}
			var payload struct {
				Variables struct {
					Offset int `json:"offset"`
				} `json:"variables"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
				t.Fatal(err)
			}
			if payload.Variables.Offset != pages {
				t.Fatalf("offset=%d, want %d", payload.Variables.Offset, pages)
			}
			pages++
			return testResponse(200, fmt.Sprintf(`{"data":{"playlistV2":{"name":"Gym","ownerV2":{"data":{"name":"Owner"}},"content":{"totalCount":2,"items":[{"itemV2":{"data":{"uri":"spotify:track:track%d","name":"Song","artists":{"items":[{"profile":{"name":"Artist"}}]},"trackDuration":{"totalMilliseconds":123456},"albumOfTrack":{"name":"Album","uri":"spotify:album:album1","coverArt":{"sources":[{"url":"cover","width":640}]}},"contentRating":{"label":"EXPLICIT"}}}}]}}}}`, pages)), nil
		}
		t.Fatalf("unexpected host %s", r.URL.Host)
		return nil, nil
	})}
	result, err := c.GetPlaylistTracks(context.Background(), "playlist1")
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Tracks) != 2 || pages != 2 || result.Name != "Gym" {
		t.Fatalf("incomplete result: %+v", result)
	}
	track := result.Tracks[0]
	if track.ID != "track1" || track.Artist != "Artist" || track.AlbumID != "album1" || track.DurationMs != 123456 || !track.Explicit || track.CoverArtURL != "cover" {
		t.Fatalf("lost track metadata: %+v", track)
	}
}

func TestPlaylistEmptyDoesNotFallback(t *testing.T) {
	c := NewAPIClient("test", "test")
	c.cachedToken = "token"
	c.tokenExpiry = time.Now().Add(time.Hour)
	c.httpClient = &http.Client{Transport: spotifyTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "api.spotify.com" {
			t.Fatal("unexpected fallback")
		}
		return testResponse(200, `{"name":"Empty","tracks":{"items":[],"total":0}}`), nil
	})}
	result, err := c.GetPlaylistTracks(context.Background(), "empty")
	if err != nil || result.Name != "Empty" || len(result.Tracks) != 0 {
		t.Fatalf("result=%+v err=%v", result, err)
	}
}

func TestSpotifyLongRateLimitReturnsPromptly(t *testing.T) {
	c := NewAPIClient("test", "test")
	c.cachedToken = "token"
	c.tokenExpiry = time.Now().Add(time.Hour)
	c.httpClient = &http.Client{Transport: spotifyTransport(func(r *http.Request) (*http.Response, error) {
		response := testResponse(429, `{}`)
		response.Header.Set("Retry-After", "86401")
		return response, nil
	})}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, err := c.GetTrack(ctx, "track")
	if err == nil || !strings.Contains(err.Error(), "rate limited") || ctx.Err() != nil {
		t.Fatalf("expected prompt rate-limit error, got %v", err)
	}
}

func TestWebPlaylistRejectsGraphQLErrors(t *testing.T) {
	c := newWebPlayerClient()
	c.accessToken = "token"
	c.clientToken = "client"
	c.client = &http.Client{Transport: spotifyTransport(func(r *http.Request) (*http.Response, error) {
		return testResponse(200, `{"errors":[{"message":"Not found"}]}`), nil
	})}
	if _, err := c.Query(context.Background(), map[string]interface{}{}); err == nil {
		t.Fatal("GraphQL error was treated as success")
	}
}
