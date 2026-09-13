import {Button, ExternalIcon} from '../components/Button.jsx';
import {Cover} from '../components/Cover.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {SearchBox, SegmentedControl, Toolbar} from '../components/Filters.jsx';
import {ArrowLeftIcon} from '../components/Icons.jsx';
import {JobActionButton, StatusBadge} from '../components/JobCard.jsx';
import {Link} from '../components/Link.jsx';
import {Pagination} from '../components/Pagination.jsx';
import {ProgressBar} from '../components/ProgressBar.jsx';
import {TrackTable} from '../components/TrackTable.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {formatBytes, formatDate, formatLength, plural} from '../lib/format.js';
import {KINDS, filterTracks, jobArtists, jobBytes, jobDuration, jobNotes, navidromePlaylistUrl, progressPercent} from '../lib/jobs.js';
import {paginate} from '../lib/paginate.js';
import {useQueryParam} from '../lib/router.js';

const PAGE_SIZE = 50;

const TRACK_FILTERS = [
  {value: 'all', label: 'All'},
  {value: 'completed', label: 'Done'},
  {value: 'queued', label: 'Waiting'},
  {value: 'failed', label: 'Failed'},
];

function Fact({label, children}) {
  return (
    <div className="fact">
      <span className="fact-label">{label}</span>
      <span className="fact-value">{children}</span>
    </div>
  );
}

// Detail page for one playlist, album, or single, with a paginated track table.
export function CollectionPage({kind, id}) {
  const {data, actions} = useApp();
  const meta = KINDS[kind];
  const job = data.jobs.find((j) => j.id === id && j.kind === kind);
  useDocumentTitle(job ? job.name : meta.singular);
  const [status, setStatus] = useQueryParam('status', 'all');
  const [query, setQuery] = useQueryParam('q', '');
  const [page, setPage] = useQueryParam('page', '1');

  if (!job) {
    return (
      <>
        <Link to={meta.path} className="back-link"><ArrowLeftIcon size={16} /> All {meta.label.toLowerCase()}</Link>
        <EmptyState title={`This ${meta.noun} is not in your library.`}>It may have been added under a different type, or the link has expired.</EmptyState>
      </>
    );
  }

  const tracks = filterTracks(job.tracks, {status, query});
  const result = paginate(tracks, page, PAGE_SIZE);
  const notes = jobNotes(job, data.progress);
  const artists = jobArtists(job);
  const length = formatLength(jobDuration(job));
  const single = kind === 'track';
  const trackOptions = TRACK_FILTERS.map((f) => ({...f, count: f.value === 'all' ? job.tracks.length : job.tracks.filter((t) => t.status === f.value).length}));

  function update(setter) {
    return (value) => {
      setter(value);
      setPage('1');
    };
  }

  return (
    <>
      <Link to={meta.path} className="back-link"><ArrowLeftIcon size={16} /> All {meta.label.toLowerCase()}</Link>
      <header className="detail" data-job-id={job.id} data-status={job.status}>
        <Cover job={job} size="lg" />
        <div className="detail-body">
          <p className="eyebrow">{meta.singular}{artists ? ` · ${artists}` : ''}</p>
          <h1 className="detail-title">{job.name}</h1>
          <p className="detail-meta">
            <StatusBadge status={job.status} />
            {job.tracks.length ? <span>{plural(job.tracks.length, 'track')}</span> : <span>Reading Spotify…</span>}
            {length && <span>{length}</span>}
            {jobBytes(job) ? <span>{formatBytes(jobBytes(job))}</span> : null}
          </p>
          <ProgressBar value={progressPercent(job)} />
          <p className="job-counts detail-counts">
            <b>{job.done}</b> collected
            {job.failed ? <> · <b className="failed-count">{job.failed}</b> failed</> : null}
            {notes.length ? ` · ${notes.join(' · ')}` : null}
          </p>
          {job.error && <p className="error">{job.error}</p>}
          <div className="detail-actions">
            <JobActionButton job={job} onAction={actions.jobAction} busy={actions.busyJobId === job.id} />
            {job.playlistId && (
              <Button as="a" variant="small" href={navidromePlaylistUrl(data.navidromePort, job.playlistId)} target="_blank" rel="noopener">
                Open in Navidrome <ExternalIcon />
              </Button>
            )}
            <Button as="a" variant="small" className="quiet" href={job.url} target="_blank" rel="noopener">
              View on Spotify <ExternalIcon />
            </Button>
          </div>
        </div>
      </header>

      <div className="facts">
        <Fact label="Added">{formatDate(job.createdAt)}</Fact>
        <Fact label="Last update">{formatDate(job.updatedAt)}</Fact>
        <Fact label="Navidrome">{job.playlistId ? 'Synced as playlist' : kind === 'playlist' ? 'Not synced yet' : 'Library scan'}</Fact>
        {single && job.tracks[0]?.album_name && <Fact label="Album">{job.tracks[0].album_name}</Fact>}
        {single && job.tracks[0]?.release_date && <Fact label="Released">{job.tracks[0].release_date}</Fact>}
      </div>

      {job.tracks.length > 0 && (
        <section className="section" aria-labelledby="tracks-title">
          <div className="section-head">
            <h2 id="tracks-title">{single ? 'Track' : 'Tracks'}</h2>
            <span className="section-note">{plural(job.tracks.length, 'track')}</span>
          </div>
          {!single && (
            <Toolbar>
              <SegmentedControl label="Filter tracks" value={status} onChange={update(setStatus)} options={trackOptions} />
              <SearchBox value={query} onChange={update(setQuery)} placeholder="Search tracks" />
            </Toolbar>
          )}
          {result.total
            ? <TrackTable tracks={result.items} offset={result.from - 1} showAlbum={kind !== 'album'} />
            : <EmptyState title="No matching tracks.">Try a different search or filter.</EmptyState>}
          <Pagination result={result} onPage={setPage} label="tracks" />
        </section>
      )}
    </>
  );
}
