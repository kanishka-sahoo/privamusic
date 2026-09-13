import {formatBytes, formatDuration} from '../lib/format.js';
import {TRACK_LABEL} from '../lib/jobs.js';

function TrackRow({track, index, showAlbum}) {
  return (
    <tr className="track" data-status={track.status}>
      <td className="track-index">{index}</td>
      <td className="track-body">
        <span className="track-name">{track.name}</span>
        <small className="track-artist">{track.artists}</small>
        {track.error && <p className="error">{track.error}</p>}
      </td>
      {showAlbum && <td className="track-album">{track.album_name || '—'}</td>}
      <td className="track-duration">{formatDuration(track.duration_ms)}</td>
      <td className="track-size">{track.status === 'completed' ? formatBytes(track.bytes) : '—'}</td>
      <td className="track-status">{TRACK_LABEL[track.status] || track.status}</td>
    </tr>
  );
}

// Tracks of one collection. `offset` keeps the row numbers continuous across pages.
export function TrackTable({tracks, offset = 0, showAlbum = true}) {
  if (!tracks.length) return null;
  return (
    <div className="table-wrap">
      <table className="track-table">
        <thead>
          <tr>
            <th scope="col" className="track-index">#</th>
            <th scope="col">Title</th>
            {showAlbum && <th scope="col" className="track-album">Album</th>}
            <th scope="col" className="track-duration">Length</th>
            <th scope="col" className="track-size">Size</th>
            <th scope="col" className="track-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, i) => <TrackRow key={`${track.spotify_id}-${offset + i}`} track={track} index={offset + i + 1} showAlbum={showAlbum} />)}
        </tbody>
      </table>
    </div>
  );
}
