// Adapted from spotbye/SpotiFLAC backend/spotfetch.go at
// 90f51a4da5bff0ec51183dd5e789a78e6f6a009d (MIT, Copyright 2026 afkarxyz).
// See licenses/SpotiFLAC. Requests are scoped to the caller's context.
package spotify

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"
)

var SpotifyError = errors.New("spotify error")

const spotifyAccessTokenCacheSkew = 30 * time.Second

var spotifyAccessTokenCache = struct {
	sync.Mutex
	accessToken string
	clientID    string
	expiresAt   time.Time
}{}

type webPlayerClient struct {
	client        *http.Client
	mu            sync.Mutex
	accessToken   string
	clientToken   string
	clientID      string
	deviceID      string
	clientVersion string
	cookies       map[string]string
}

func newWebPlayerClient() *webPlayerClient {
	return &webPlayerClient{
		client:  &http.Client{Timeout: 30 * time.Second},
		cookies: make(map[string]string),
	}
}

func (c *webPlayerClient) requestAccessTokenAt(ctx context.Context, now time.Time) (map[string]interface{}, []*http.Cookie, error) {
	totpCode, version, err := generateSpotifyTOTP(now)
	if err != nil {
		return nil, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://open.spotify.com/api/token", nil)
	if err != nil {
		return nil, nil, err
	}

	q := req.URL.Query()
	q.Add("reason", "init")
	q.Add("productType", "web-player")
	q.Add("totp", totpCode)
	q.Add("totpVer", strconv.Itoa(version))
	q.Add("totpServer", totpCode)
	req.URL.RawQuery = q.Encode()

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36")
	req.Header.Set("Content-Type", "application/json;charset=UTF-8")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, nil, err
	}

	if resp.StatusCode != 200 {
		return nil, nil, fmt.Errorf("%w: access token request failed: HTTP %d", SpotifyError, resp.StatusCode)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, nil, err
	}

	return data, resp.Cookies(), nil
}

func spotifyAccessTokenExpiresAt(data map[string]interface{}) time.Time {
	if expiresAtMs := getFloat64(data, "accessTokenExpirationTimestampMs"); expiresAtMs > 0 {
		return time.UnixMilli(int64(expiresAtMs))
	}

	return time.Now().Add(55 * time.Minute)
}

func spotifyCachedAccessTokenValid(now time.Time) bool {
	return spotifyAccessTokenCache.accessToken != "" &&
		spotifyAccessTokenCache.clientID != "" &&
		now.Before(spotifyAccessTokenCache.expiresAt.Add(-spotifyAccessTokenCacheSkew))
}

func invalidateSpotifyAccessTokenCache() {
	spotifyAccessTokenCache.Lock()
	defer spotifyAccessTokenCache.Unlock()
	spotifyAccessTokenCache.accessToken = ""
	spotifyAccessTokenCache.clientID = ""
	spotifyAccessTokenCache.expiresAt = time.Time{}
}

func (c *webPlayerClient) getAccessToken(ctx context.Context) error {
	spotifyAccessTokenCache.Lock()
	defer spotifyAccessTokenCache.Unlock()

	if spotifyCachedAccessTokenValid(time.Now()) {
		c.accessToken = spotifyAccessTokenCache.accessToken
		c.clientID = spotifyAccessTokenCache.clientID
		return nil
	}

	totpWindows := []time.Duration{0, -30 * time.Second, 30 * time.Second}
	var lastErr error
	for attempt, offset := range totpWindows {
		data, cookies, err := c.requestAccessTokenAt(ctx, time.Now().Add(offset))
		if err != nil {
			lastErr = err
			if attempt < len(totpWindows)-1 {
				if err := sleepWithContext(ctx, 400*time.Millisecond); err != nil {
					return err
				}
			}
			continue
		}

		accessToken := getString(data, "accessToken")
		clientID := getString(data, "clientId")
		if accessToken == "" || clientID == "" {
			lastErr = fmt.Errorf("%w: access token response did not include required fields", SpotifyError)
			continue
		}

		c.accessToken = accessToken
		c.clientID = clientID

		spotifyAccessTokenCache.accessToken = accessToken
		spotifyAccessTokenCache.clientID = clientID
		spotifyAccessTokenCache.expiresAt = spotifyAccessTokenExpiresAt(data)

		for _, cookie := range cookies {
			if cookie.Name == "sp_t" {
				c.deviceID = cookie.Value
			}
			c.cookies[cookie.Name] = cookie.Value
		}

		return nil
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("%w: access token request failed", SpotifyError)
}

func (c *webPlayerClient) getSessionInfo(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://open.spotify.com", nil)
	if err != nil {
		return err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36")

	for name, value := range c.cookies {
		req.AddCookie(&http.Cookie{Name: name, Value: value})
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("%w: session initialization failed: HTTP %d", SpotifyError, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}

	re := regexp.MustCompile(`<script id="appServerConfig" type="text/plain">([^<]+)</script>`)
	matches := re.FindStringSubmatch(string(body))
	if len(matches) > 1 {
		decoded, err := base64.StdEncoding.DecodeString(matches[1])
		if err == nil {
			var cfg map[string]interface{}
			if json.Unmarshal(decoded, &cfg) == nil {
				c.clientVersion = getString(cfg, "clientVersion")
			}
		}
	}

	for _, cookie := range resp.Cookies() {
		if cookie.Name == "sp_t" {
			c.deviceID = cookie.Value
		}
		c.cookies[cookie.Name] = cookie.Value
	}

	return nil
}

func (c *webPlayerClient) getClientToken(ctx context.Context) error {
	if c.clientID == "" || c.deviceID == "" || c.clientVersion == "" {
		if err := c.getSessionInfo(ctx); err != nil {
			return err
		}
		if err := c.getAccessToken(ctx); err != nil {
			return err
		}
	}

	payload := map[string]interface{}{
		"client_data": map[string]interface{}{
			"client_version": c.clientVersion,
			"client_id":      c.clientID,
			"js_sdk_data": map[string]interface{}{
				"device_brand": "unknown",
				"device_model": "unknown",
				"os":           "windows",
				"os_version":   "NT 10.0",
				"device_id":    c.deviceID,
				"device_type":  "computer",
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://clienttoken.spotify.com/v1/clienttoken", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Authority", "clienttoken.spotify.com")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("%w: client token request failed: HTTP %d", SpotifyError, resp.StatusCode)
	}

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return err
	}

	if getString(data, "response_type") != "RESPONSE_GRANTED_TOKEN_RESPONSE" {
		return fmt.Errorf("%w: invalid client token response type", SpotifyError)
	}

	grantedToken := getMap(data, "granted_token")
	c.clientToken = getString(grantedToken, "token")

	return nil
}

func (c *webPlayerClient) initializeLocked(ctx context.Context) error {
	if err := c.getSessionInfo(ctx); err != nil {
		return err
	}
	if err := c.getAccessToken(ctx); err != nil {
		return err
	}
	return c.getClientToken(ctx)
}

func (c *webPlayerClient) Initialize(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.initializeLocked(ctx)
}

func (c *webPlayerClient) Query(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
	c.mu.Lock()
	if c.accessToken == "" || c.clientToken == "" {
		if err := c.initializeLocked(ctx); err != nil {
			c.mu.Unlock()
			return nil, err
		}
	}
	accessToken := c.accessToken
	clientToken := c.clientToken
	clientVersion := c.clientVersion
	c.mu.Unlock()

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	doRequest := func(accessToken, clientToken, clientVersion string) (int, []byte, error) {
		req, reqErr := http.NewRequestWithContext(ctx, "POST", "https://api-partner.spotify.com/pathfinder/v2/query", bytes.NewBuffer(jsonData))
		if reqErr != nil {
			return 0, nil, reqErr
		}

		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Client-Token", clientToken)
		req.Header.Set("Spotify-App-Version", clientVersion)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36")

		resp, doErr := c.client.Do(req)
		if doErr != nil {
			return 0, nil, doErr
		}
		defer resp.Body.Close()

		respBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
		if readErr != nil {
			return 0, nil, readErr
		}
		return resp.StatusCode, respBody, nil
	}

	statusCode, body, err := doRequest(accessToken, clientToken, clientVersion)
	if err != nil {
		return nil, err
	}

	if statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden {
		c.mu.Lock()
		if c.accessToken == accessToken && c.clientToken == clientToken {
			invalidateSpotifyAccessTokenCache()
			c.accessToken = ""
			c.clientToken = ""
			if err := c.initializeLocked(ctx); err != nil {
				c.mu.Unlock()
				return nil, err
			}
		}
		accessToken = c.accessToken
		clientToken = c.clientToken
		clientVersion = c.clientVersion
		c.mu.Unlock()

		statusCode, body, err = doRequest(accessToken, clientToken, clientVersion)
		if err != nil {
			return nil, err
		}
	}

	if statusCode != 200 {
		return nil, fmt.Errorf("%w: API query failed: HTTP %d", SpotifyError, statusCode)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if len(getSlice(result, "errors")) > 0 {
		return nil, fmt.Errorf("%w: playlist query returned GraphQL errors", SpotifyError)
	}
	return result, nil
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if val, ok := m[key].(map[string]interface{}); ok {
		return val
	}
	return make(map[string]interface{})
}

func getSlice(m map[string]interface{}, key string) []interface{} {
	if val, ok := m[key].([]interface{}); ok {
		return val
	}
	return nil
}

func getFloat64(m map[string]interface{}, key string) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return 0
}

func getInt(m map[string]interface{}, key string) int {
	if val, ok := m[key].(int); ok {
		return val
	}
	if val, ok := m[key].(float64); ok {
		return int(val)
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if val, ok := m[key].(bool); ok {
		return val
	}
	return false
}
