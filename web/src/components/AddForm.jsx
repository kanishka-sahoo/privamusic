import {useState} from 'react';
import {Button} from './Button.jsx';
import {Panel} from './Panel.jsx';

function LinkIcon() {
  return (
    <span className="add-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </svg>
    </span>
  );
}

export function AddForm({onSubmit, busy}) {
  const [url, setUrl] = useState('');
  async function submit(event) {
    event.preventDefault();
    const added = await onSubmit(url);
    if (added) setUrl('');
  }
  return (
    <Panel className="add-panel" title="Add to library" titleId="add-title">
      <form className="add-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="spotify-url">Spotify playlist, album, or track URL</label>
        <div className="add-input">
          <LinkIcon />
          <input
            id="spotify-url"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://open.spotify.com/playlist/…"
            spellCheck="false"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>Add to library</Button>
      </form>
      <p className="hint">Playlists, albums, and single tracks. Downloads are validated as FLAC and synced to Navidrome as an ordered playlist.</p>
    </Panel>
  );
}
