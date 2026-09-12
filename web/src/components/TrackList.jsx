import {TRACK_LABEL} from '../lib/jobs.js';

function TrackRow({track, index}) {
  return (
    <div className="track" data-status={track.status}>
      <span className="track-index">{index + 1}</span>
      <span className="track-body">
        <span className="track-name">{track.name}</span>
        <small className="track-artist">{track.artists}</small>
        {track.error && <p className="error">{track.error}</p>}
      </span>
      <small className="track-status">{TRACK_LABEL[track.status] || track.status}</small>
    </div>
  );
}

// <details> stays uncontrolled so the open state and list scroll position survive polling re-renders.
export function TrackList({jobId, tracks}) {
  if (!tracks.length) return null;
  return (
    <details data-id={jobId}>
      <summary>Track details</summary>
      <div className="track-list">
        {tracks.map((track, index) => <TrackRow key={`${track.spotify_id}-${index}`} track={track} index={index} />)}
      </div>
    </details>
  );
}
