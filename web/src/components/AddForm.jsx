import {useState} from 'react';
import {Button} from './Button.jsx';
import {LinkIcon} from './Icons.jsx';
import {Panel} from './Panel.jsx';

// onSubmit resolves to the created job (or null on failure). The field clears on success.
export function AddForm({onSubmit, busy, compact = false}) {
  const [url, setUrl] = useState('');
  async function submit(event) {
    event.preventDefault();
    const added = await onSubmit(url);
    if (added) setUrl('');
  }
  return (
    <Panel className={`add-panel${compact ? ' compact' : ''}`} title="Add to library" titleId="add-title">
      <form className="add-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="spotify-url">Spotify playlist, album, or track URL</label>
        <div className="add-input">
          <span className="add-icon"><LinkIcon /></span>
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
      {!compact && <p className="hint">Playlists, albums, and single tracks. Downloads are validated as FLAC and synced to Navidrome as an ordered playlist.</p>}
    </Panel>
  );
}
