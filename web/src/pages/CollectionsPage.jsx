import {Button} from '../components/Button.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {SearchBox, SegmentedControl, Toolbar} from '../components/Filters.jsx';
import {JobCard} from '../components/JobCard.jsx';
import {Link} from '../components/Link.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Pagination} from '../components/Pagination.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {KINDS, STATUS_FILTERS, filterJobs} from '../lib/jobs.js';
import {paginate} from '../lib/paginate.js';
import {useQueryParam} from '../lib/router.js';

const PAGE_SIZE = 12;

// List page for one media type: playlists, albums, or singles.
export function CollectionsPage({kind}) {
  const {data, actions} = useApp();
  const meta = KINDS[kind];
  useDocumentTitle(meta.label);
  const [status, setStatus] = useQueryParam('status', 'all');
  const [query, setQuery] = useQueryParam('q', '');
  const [page, setPage] = useQueryParam('page', '1');
  const ofKind = data.jobs.filter((job) => job.kind === kind);
  const jobs = filterJobs(ofKind, {kind, status, query});
  const result = paginate(jobs, page, PAGE_SIZE);
  const options = STATUS_FILTERS.map((f) => ({value: f.value, label: f.label, count: ofKind.filter(f.test).length}));

  function update(setter) {
    return (value) => {
      setter(value);
      setPage('1');
    };
  }

  return (
    <>
      <PageHeader eyebrow="Library" title={meta.label} description={meta.description} actions={<Button as={Link} to="/add" variant="primary">Add {meta.noun}</Button>} />
      <Toolbar>
        <SegmentedControl label="Filter by status" value={status} onChange={update(setStatus)} options={options} />
        <SearchBox value={query} onChange={update(setQuery)} placeholder={`Search ${meta.label.toLowerCase()}`} />
      </Toolbar>
      {result.total
        ? (
          <div className="jobs">
            {result.items.map((job) => (
              <JobCard key={job.id} job={job} progress={data.progress} onAction={actions.jobAction} busy={actions.busyJobId === job.id} />
            ))}
          </div>
        )
        : ofKind.length
          ? <EmptyState title="No matches.">Try a different search or status filter.</EmptyState>
          : <EmptyState title={`No ${meta.label.toLowerCase()} yet.`} action={<Button as={Link} to="/add" variant="primary">Add {meta.noun}</Button>}>Paste a Spotify {meta.noun} link and it will show up here with its own page.</EmptyState>}
      <Pagination result={result} onPage={setPage} label={meta.label.toLowerCase()} />
    </>
  );
}
