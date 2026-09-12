import {Button} from './Button.jsx';
import {ProgressBar} from './ProgressBar.jsx';
import {TrackList} from './TrackList.jsx';
import {CANCELLABLE_STATUSES, RETRYABLE_STATUSES, STATUS_LABEL, coverUrl, jobNotes, progressPercent} from '../lib/jobs.js';

function Cover({job}) {
  const url = coverUrl(job);
  return url
    ? <img className="cover" src={url} alt="" loading="lazy" width="64" height="64" />
    : <div className="cover cover-blank" aria-hidden="true" />;
}

function JobAction({job, onAction, busy}) {
  if (RETRYABLE_STATUSES.includes(job.status)) {
    return <Button variant="small" disabled={busy} onClick={() => onAction(job.id, 'retry')}>Retry</Button>;
  }
  if (CANCELLABLE_STATUSES.includes(job.status)) {
    return <Button variant="small" className="quiet" disabled={busy} onClick={() => onAction(job.id, 'cancel')}>Cancel</Button>;
  }
  return null;
}

export function JobCard({job, progress, onAction, busy}) {
  const notes = jobNotes(job, progress);
  return (
    <article className="job" data-job-id={job.id} data-status={job.status}>
      <div className="job-top">
        <Cover job={job} />
        <div className="job-info">
          <h3>{job.name}</h3>
          <p className="meta">
            <span className="kind">{job.kind}</span> · {job.tracks.length || '…'} tracks{job.playlistId ? ' · In Navidrome' : ''}
          </p>
        </div>
        <span className={`badge ${job.status}`}>{STATUS_LABEL[job.status] || job.status}</span>
      </div>
      <ProgressBar value={progressPercent(job)} />
      <div className="job-footer">
        <span className="job-counts">
          <b>{job.done}</b> collected
          {job.failed ? <> · <b className="failed-count">{job.failed}</b> failed</> : null}
          {notes.length ? ` · ${notes.join(' · ')}` : null}
        </span>
        <JobAction job={job} onAction={onAction} busy={busy} />
      </div>
      {job.error && <p className="error">{job.error}</p>}
      <TrackList jobId={job.id} tracks={job.tracks} />
    </article>
  );
}
