// Presentation helpers for job and track state coming from /api/state.
export const ACTIVE_STATUSES = ['queued', 'resolving', 'downloading', 'syncing'];
export const RETRYABLE_STATUSES = ['partial', 'failed', 'cancelled'];
export const CANCELLABLE_STATUSES = ['queued', 'resolving', 'downloading'];
export const ATTENTION_STATUSES = ['partial', 'failed'];

export const STATUS_LABEL = {
  queued: 'Queued',
  resolving: 'Resolving',
  downloading: 'Downloading',
  syncing: 'Syncing',
  completed: 'Complete',
  partial: 'Partial',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const TRACK_LABEL = {
  queued: 'Waiting',
  downloading: 'Downloading',
  completed: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
};

// Each media type has its own section, list page, and detail route.
export const KINDS = {
  playlist: {path: '/playlists', label: 'Playlists', singular: 'Playlist', noun: 'playlist', description: 'Spotify playlists, mirrored to Navidrome as ordered playlists.'},
  album: {path: '/albums', label: 'Albums', singular: 'Album', noun: 'album', description: 'Complete albums, kept together in your library.'},
  track: {path: '/tracks', label: 'Singles', singular: 'Single', noun: 'single', description: 'Individual tracks added on their own.'},
  listenbrainz: {path: '/discover', label: 'Discoveries', singular: 'ListenBrainz', noun: 'feed', description: 'ListenBrainz Weekly Jams, Daily Jams and Weekly Exploration, imported as Navidrome playlists.'},
};

export const isActive = (job) => ACTIVE_STATUSES.includes(job.status);
// Feed imports can be retried even when complete, to look again for recordings that had no Spotify match.
export const canRetry = (job) => RETRYABLE_STATUSES.includes(job.status) || (job.kind === 'listenbrainz' && job.status === 'completed' && job.tracks.some((t) => t.status === 'skipped'));
export const needsAttention = (job) => ATTENTION_STATUSES.includes(job.status);

export function jobPath(job) {
  return `${KINDS[job.kind]?.path || '/playlists'}/${job.id}`;
}

export function progressPercent(job) {
  return job.tracks.length ? Math.round(((job.done + job.failed) / job.tracks.length) * 100) : 0;
}

// Only Spotify's CDN is allowed by the image CSP.
export function coverUrl(job) {
  return typeof job.cover === 'string' && /^https:\/\/i\.scdn\.co\//.test(job.cover) ? job.cover : null;
}

// Where Navidrome lives, from the dashboard's point of view. Precedence: an explicit public URL; the
// sibling tailnet hostname when the dashboard itself is being viewed through the tailnet (the suffix is
// taken from the current address, so the tailnet name is never configured); otherwise the same host on
// Navidrome's port.
export function libraryUrl(state, path = '/') {
  const {navidromePort, library = {}} = state;
  const current = new URL(window.location.href);
  let url;
  if (library.url) {
    url = new URL(library.url);
  } else if (library.tailnetHost && /\.ts\.net$/.test(current.hostname)) {
    url = new URL(`https://${library.tailnetHost}.${current.hostname.split('.').slice(1).join('.')}/`);
  } else {
    url = current;
    url.port = String(navidromePort);
  }
  url.pathname = path;
  url.search = '';
  url.hash = '';
  return url.href;
}

export function navidromePlaylistUrl(state, playlistId) {
  return `${libraryUrl(state, '/app/')}#/playlist/${encodeURIComponent(playlistId)}/show`;
}

export function jobBytes(job) {
  return job.tracks.reduce((sum, t) => sum + (t.status === 'completed' ? t.bytes || 0 : 0), 0);
}

export function jobDuration(job) {
  return job.tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
}

// Distinct artists across a collection, for the detail header.
export function jobArtists(job, limit = 3) {
  const names = [];
  for (const track of job.tracks) {
    for (const name of String(track.artists || '').split(/,\s*/)) {
      if (name && !names.includes(name)) names.push(name);
    }
  }
  if (!names.length) return '';
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} and ${names.length - limit} more`;
}

export function summarize(jobs) {
  const completed = new Set(jobs.flatMap((j) => j.tracks.filter((t) => t.status === 'completed').map((t) => t.spotify_id)));
  const bytesById = new Map();
  for (const job of jobs) for (const t of job.tracks) if (t.status === 'completed' && t.bytes) bytesById.set(t.spotify_id, t.bytes);
  return {
    tracks: completed.size,
    bytes: [...bytesById.values()].reduce((a, b) => a + b, 0),
    active: jobs.filter(isActive).length,
    attention: jobs.filter(needsAttention).length,
    playlists: jobs.filter((j) => j.kind === 'playlist').length,
    albums: jobs.filter((j) => j.kind === 'album').length,
    singles: jobs.filter((j) => j.kind === 'track').length,
    discoveries: jobs.filter((j) => j.kind === 'listenbrainz').length,
    synced: jobs.filter((j) => j.playlistId).length,
  };
}

// Human-readable notes shown beside the collected/failed counts.
export function jobNotes(job, progress, now = Date.now()) {
  const current = job.tracks.find((t) => t.status === 'downloading');
  const notes = [];
  if (current) notes.push(`Now: ${current.name}`);
  if (current && progress?.mb_downloaded) notes.push(`${Number(progress.mb_downloaded).toFixed(1)} MB`);
  if (job.retryAt > now) notes.push(`Cooling down · resumes ${new Date(job.retryAt).toLocaleTimeString()}`);
  if (job.status === 'syncing') notes.push('Updating Navidrome…');
  if (job.cancelRequested && isActive(job)) notes.push('Stopping after current track');
  return notes;
}

// Status filter groups used by the list pages.
export const STATUS_FILTERS = [
  {value: 'all', label: 'All', test: () => true},
  {value: 'active', label: 'In progress', test: isActive},
  {value: 'completed', label: 'Complete', test: (job) => job.status === 'completed'},
  {value: 'attention', label: 'Needs attention', test: (job) => needsAttention(job) || job.status === 'cancelled'},
];

export function filterJobs(jobs, {kind, status = 'all', query = ''}) {
  const filter = STATUS_FILTERS.find((f) => f.value === status) || STATUS_FILTERS[0];
  const needle = query.trim().toLowerCase();
  return jobs.filter((job) => {
    if (kind && job.kind !== kind) return false;
    if (!filter.test(job)) return false;
    if (!needle) return true;
    const haystack = [job.name, ...job.tracks.slice(0, 200).flatMap((t) => [t.name, t.artists, t.album_name])].join('\n').toLowerCase();
    return haystack.includes(needle);
  });
}

export function filterTracks(tracks, {status = 'all', query = ''}) {
  const needle = query.trim().toLowerCase();
  return tracks.filter((track) => {
    if (status !== 'all' && track.status !== status) return false;
    if (!needle) return true;
    return [track.name, track.artists, track.album_name].join('\n').toLowerCase().includes(needle);
  });
}
