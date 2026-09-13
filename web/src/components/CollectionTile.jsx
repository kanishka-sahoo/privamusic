import {Cover} from './Cover.jsx';
import {StatusBadge} from './JobCard.jsx';
import {Link} from './Link.jsx';
import {plural} from '../lib/format.js';
import {KINDS, jobPath, progressPercent} from '../lib/jobs.js';

// Grid tile for the overview's recent additions.
export function CollectionTile({job}) {
  const count = job.tracks.length;
  return (
    <Link to={jobPath(job)} className="tile" data-status={job.status}>
      <Cover job={job} size="lg" />
      <span className="tile-body">
        <span className="tile-name">{job.name}</span>
        <span className="tile-meta">{KINDS[job.kind]?.singular} · {count ? plural(count, 'track') : 'Reading…'}</span>
        <span className="tile-foot">
          <StatusBadge status={job.status} />
          {job.status !== 'completed' && count ? <span className="tile-percent">{progressPercent(job)}%</span> : null}
        </span>
      </span>
    </Link>
  );
}
