// Presentation helpers for job and track state coming from /api/state.
export const ACTIVE_STATUSES = ['queued', 'resolving', 'downloading', 'syncing'];
export const RETRYABLE_STATUSES = ['partial', 'failed', 'cancelled'];
export const CANCELLABLE_STATUSES = ['queued', 'resolving', 'downloading'];

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

export const isActive = (job) => ACTIVE_STATUSES.includes(job.status);

export function progressPercent(job) {
  return job.tracks.length ? Math.round(((job.done + job.failed) / job.tracks.length) * 100) : 0;
}

// Only Spotify's CDN is allowed by the image CSP.
export function coverUrl(job) {
  return typeof job.cover === 'string' && /^https:\/\/i\.scdn\.co\//.test(job.cover) ? job.cover : null;
}

export function libraryUrl(navidromePort) {
  const url = new URL(window.location.href);
  url.port = String(navidromePort);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.href;
}

export function summarize(jobs) {
  const completed = new Set(jobs.flatMap((j) => j.tracks.filter((t) => t.status === 'completed').map((t) => t.spotify_id)));
  return {
    tracks: completed.size,
    active: jobs.filter(isActive).length,
    playlists: jobs.filter((j) => j.playlistId).length,
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
