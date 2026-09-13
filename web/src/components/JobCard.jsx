import {Button} from './Button.jsx';
import {Cover} from './Cover.jsx';
import {Link} from './Link.jsx';
import {ProgressBar} from './ProgressBar.jsx';
import {formatRelative, plural} from '../lib/format.js';
import {CANCELLABLE_STATUSES, KINDS, RETRYABLE_STATUSES, STATUS_LABEL, jobNotes, jobPath, progressPercent} from '../lib/jobs.js';

export function JobActionButton({job, onAction, busy}) {
  if (RETRYABLE_STATUSES.includes(job.status)) {
    return <Button variant="small" disabled={busy} onClick={() => onAction(job.id, 'retry')}>Retry</Button>;
  }
  if (CANCELLABLE_STATUSES.includes(job.status)) {
    return <Button variant="small" className="quiet" disabled={busy} onClick={() => onAction(job.id, 'cancel')}>Cancel</Button>;
  }
  return null;
}

export function StatusBadge({status}) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

// One collection in a list: artwork, title, status, progress and the primary action. The title links to its page.
export function JobCard({job, progress, onAction, busy, position}) {
  const notes = jobNotes(job, progress);
  const count = job.tracks.length;
  return (
    <article className="job" data-job-id={job.id} data-status={job.status}>
      <div className="job-top">
        {position !== undefined && <span className="job-position" aria-label={`Position ${position}`}>{position}</span>}
        <Link to={jobPath(job)} className="cover-link" aria-hidden="true" tabIndex={-1}><Cover job={job} /></Link>
        <div className="job-info">
          <h3><Link to={jobPath(job)}>{job.name}</Link></h3>
          <p className="meta">
            <span className="kind">{KINDS[job.kind]?.singular || job.kind}</span>
            {' · '}{count ? plural(count, 'track') : 'Reading…'}
            {job.playlistId ? ' · In Navidrome' : ''}
            {job.createdAt ? ` · ${formatRelative(job.createdAt)}` : ''}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <ProgressBar value={progressPercent(job)} />
      <div className="job-footer">
        <span className="job-counts">
          <b>{job.done}</b> collected
          {job.failed ? <> · <b className="failed-count">{job.failed}</b> failed</> : null}
          {notes.length ? ` · ${notes.join(' · ')}` : null}
        </span>
        <JobActionButton job={job} onAction={onAction} busy={busy} />
      </div>
      {job.error && <p className="error">{job.error}</p>}
    </article>
  );
}
