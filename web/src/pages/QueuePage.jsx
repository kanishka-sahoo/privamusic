import {Button} from '../components/Button.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {SegmentedControl, Toolbar} from '../components/Filters.jsx';
import {JobCard} from '../components/JobCard.jsx';
import {Link} from '../components/Link.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Pagination} from '../components/Pagination.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {isActive, needsAttention} from '../lib/jobs.js';
import {paginate} from '../lib/paginate.js';
import {useQueryParam} from '../lib/router.js';

const PAGE_SIZE = 10;

const TABS = [
  {value: 'active', label: 'In progress', test: isActive},
  {value: 'attention', label: 'Needs attention', test: needsAttention},
  {value: 'finished', label: 'Finished', test: (job) => job.status === 'completed' || job.status === 'cancelled'},
];

function HaltedBanner() {
  return (
    <div className="banner error-banner" role="alert">
      <b>The downloader stopped after a timeout.</b> Restart the dashboard container, then retry the affected collection.
    </div>
  );
}

function CooldownBanner({until}) {
  return (
    <div className="banner warn-banner" role="status">
      <b>Provider rate limit.</b> The queue is paused and resumes automatically at {new Date(until).toLocaleTimeString()}.
    </div>
  );
}

export function QueuePage() {
  const {data, actions} = useApp();
  useDocumentTitle('Queue');
  const [tab, setTab] = useQueryParam('tab', 'active');
  const [page, setPage] = useQueryParam('page', '1');
  const current = TABS.find((t) => t.value === tab) || TABS[0];
  const counts = Object.fromEntries(TABS.map((t) => [t.value, data.jobs.filter(t.test).length]));
  const jobs = data.jobs.filter(current.test);
  const result = paginate(jobs, page, PAGE_SIZE);
  const cooldown = data.jobs.find((job) => isActive(job) && job.retryAt > Date.now());

  function changeTab(value) {
    setTab(value);
    setPage('1');
  }

  const empty = {
    active: ['The queue is clear.', 'New links start downloading right away.'],
    attention: ['Nothing needs attention.', 'Failed or partial collections show up here for retrying.'],
    finished: ['No finished downloads yet.', 'Completed collections are listed here once they are in Navidrome.'],
  }[current.value];

  return (
    <>
      <PageHeader eyebrow="Activity" title="Queue" description="One track downloads at a time, in the order collections were added." actions={<Button as={Link} to="/add" variant="primary">Add link</Button>} />
      {data.halted && <HaltedBanner />}
      {cooldown && <CooldownBanner until={cooldown.retryAt} />}
      <Toolbar>
        <SegmentedControl label="Queue view" value={current.value} onChange={changeTab} options={TABS.map((t) => ({value: t.value, label: t.label, count: counts[t.value]}))} />
      </Toolbar>
      {result.total
        ? (
          <div className="jobs">
            {result.items.map((job, i) => (
              <JobCard key={job.id} job={job} progress={data.progress} onAction={actions.jobAction} busy={actions.busyJobId === job.id} position={current.value === 'active' ? result.from + i : undefined} />
            ))}
          </div>
        )
        : <EmptyState title={empty[0]}>{empty[1]}</EmptyState>}
      <Pagination result={result} onPage={setPage} label="collections" />
    </>
  );
}
