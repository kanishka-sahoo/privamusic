import {useState} from 'react';
import {Button, ExternalIcon} from '../components/Button.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {JobCard} from '../components/JobCard.jsx';
import {Link} from '../components/Link.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Pagination} from '../components/Pagination.jsx';
import {Panel} from '../components/Panel.jsx';
import {StatusPill} from '../components/StatusPill.jsx';
import {useAsyncAction} from '../hooks/useAsyncAction.js';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {api} from '../lib/api.js';
import {useApp} from '../lib/context.js';
import {formatRelative} from '../lib/format.js';
import {KINDS, STATUS_LABEL, isActive, navidromePlaylistUrl} from '../lib/jobs.js';
import {paginate} from '../lib/paginate.js';
import {useQueryParam} from '../lib/router.js';

const PAGE_SIZE = 10;
const meta = KINDS.listenbrainz;

function feedState(feed) {
  if (!feed.status) return ['pending', 'Waiting for the first edition'];
  if (feed.status === 'completed') return ['ok', 'In Navidrome'];
  if (isActive({status: feed.status})) return ['pending', STATUS_LABEL[feed.status]];
  return ['error', STATUS_LABEL[feed.status] || feed.status];
}

// One ListenBrainz feed: its latest edition, import state and the Navidrome playlist it maintains.
function FeedCard({feed, state}) {
  const [tone, label] = feedState(feed);
  return (
    <Panel className="side-card feed-card" title={feed.name} titleId={`feed-${feed.feed}`} data-feed={feed.feed}>
      <StatusPill state={tone}>{label}</StatusPill>
      <p className="feed-edition">
        {feed.edition ? <Link to={`${meta.path}/${feed.jobId}`}>{feed.edition}</Link> : 'ListenBrainz has not published this playlist for your account yet.'}
      </p>
      {feed.importedAt && <p className="feed-meta">Imported {formatRelative(feed.importedAt)}</p>}
      {feed.playlistId && (
        <Button as="a" variant="small" href={navidromePlaylistUrl(state, feed.playlistId)} target="_blank" rel="noopener">
          Open in Navidrome <ExternalIcon />
        </Button>
      )}
    </Panel>
  );
}

export function DiscoverPage() {
  const {data, actions, refresh} = useApp();
  useDocumentTitle('Discover');
  const discover = data.discover || {enabled: false, feeds: []};
  const jobs = data.jobs.filter((job) => job.kind === 'listenbrainz');
  const [page, setPage] = useQueryParam('page', '1');
  const result = paginate(jobs, page, PAGE_SIZE);
  const [message, setMessage] = useState(null);
  const [check, checking] = useAsyncAction(async () => {
    const {created} = await api.discoverCheck();
    await refresh();
    setMessage({tone: 'ok', text: created.length ? `Queued ${created.map((job) => job.edition).join(', ')}.` : 'No new editions since the last import.'});
  }, (e) => setMessage({tone: 'error', text: e.message}));

  const description = discover.enabled
    ? `ListenBrainz recommendations for ${discover.user}, downloaded as they are published and kept as one Navidrome playlist per feed.`
    : meta.description;

  return (
    <>
      <PageHeader eyebrow="Library" title="Discover" description={description} actions={discover.enabled ? <Button variant="primary" disabled={checking || discover.checking} onClick={check}>Check now</Button> : null} />
      {message && <div className={`banner ${message.tone === 'error' ? 'error-banner' : 'ok-banner'}`} role="status">{message.text}</div>}
      {discover.lastError && <div className="banner warn-banner" role="status"><b>Last check failed.</b> {discover.lastError}</div>}

      {discover.enabled
        ? (
          <>
            <div className="feeds">
              {discover.feeds.map((feed) => <FeedCard key={feed.feed} feed={feed} state={data} />)}
            </div>
            <p className="hint">
              {discover.lastCheck ? `Checked ${formatRelative(discover.lastCheck)}.` : 'First check pending.'}
              {discover.nextCheck ? ` Next automatic check at ${new Date(discover.nextCheck).toLocaleTimeString()}.` : ''}
              {' '}Tracks already in the library are reused; recordings without a Spotify match are skipped.
            </p>
          </>
        )
        : (
          <EmptyState title="ListenBrainz is not connected.">
            Set LISTENBRAINZ_USER in .env and run ./deploy.sh. The README covers scrobbling from Navidrome and the discovery feeds.
          </EmptyState>
        )}

      {jobs.length > 0 && (
        <section className="section" aria-labelledby="imports-title">
          <div className="section-head">
            <h2 id="imports-title">Imports</h2>
            <span className="section-note">{jobs.length} editions</span>
          </div>
          <div className="jobs">
            {result.items.map((job) => (
              <JobCard key={job.id} job={job} progress={data.progress} onAction={actions.jobAction} busy={actions.busyJobId === job.id} />
            ))}
          </div>
          <Pagination result={result} onPage={setPage} label="editions" />
        </section>
      )}
    </>
  );
}
