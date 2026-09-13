import {AddForm} from '../components/AddForm.jsx';
import {Button} from '../components/Button.jsx';
import {CollectionTile} from '../components/CollectionTile.jsx';
import {EmptyState} from '../components/EmptyState.jsx';
import {JobCard} from '../components/JobCard.jsx';
import {Link} from '../components/Link.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Stat, StatGrid} from '../components/Stats.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {formatBytes} from '../lib/format.js';
import {KINDS, isActive, needsAttention, summarize} from '../lib/jobs.js';

const RECENT_LIMIT = 8;
const ACTIVE_LIMIT = 3;

function Section({title, note, to, children}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {to ? <Link to={to} className="section-link">{note}</Link> : <span className="section-note">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const {data, actions} = useApp();
  useDocumentTitle('Overview');
  const jobs = data.jobs;
  const summary = summarize(jobs);
  const active = jobs.filter(isActive);
  const attention = jobs.filter(needsAttention);
  const recent = jobs.slice(0, RECENT_LIMIT);

  return (
    <>
      <PageHeader eyebrow="Your collection" title="Bring it home." description={jobs.length ? `${summary.tracks} lossless tracks across ${jobs.length} collections, ${formatBytes(summary.bytes)} on disk.` : 'Paste a Spotify link and every track lands in your Navidrome library as validated FLAC.'} />
      <AddForm onSubmit={actions.addJob} busy={actions.adding} compact />

      <StatGrid>
        <Stat value={summary.tracks} label="Tracks collected" />
        <Stat value={summary.playlists} label={KINDS.playlist.label} to={KINDS.playlist.path} />
        <Stat value={summary.albums} label={KINDS.album.label} to={KINDS.album.path} />
        <Stat value={summary.singles} label={KINDS.track.label} to={KINDS.track.path} />
        <Stat value={summary.active} label="In the queue" to="/queue" tone={summary.active ? 'accent' : undefined} />
        <Stat value={summary.attention} label="Need attention" to="/queue?tab=attention" tone={summary.attention ? 'warn' : undefined} />
      </StatGrid>

      {active.length > 0 && (
        <Section title="Downloading now" note={active.length > ACTIVE_LIMIT ? `View all ${active.length} in queue` : 'View queue'} to="/queue">
          <div className="jobs">
            {active.slice(0, ACTIVE_LIMIT).map((job) => (
              <JobCard key={job.id} job={job} progress={data.progress} onAction={actions.jobAction} busy={actions.busyJobId === job.id} />
            ))}
          </div>
        </Section>
      )}

      {attention.length > 0 && (
        <Section title="Needs attention" note={`${attention.length} to review`} to="/queue?tab=attention">
          <div className="jobs">
            {attention.slice(0, ACTIVE_LIMIT).map((job) => (
              <JobCard key={job.id} job={job} progress={data.progress} onAction={actions.jobAction} busy={actions.busyJobId === job.id} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Recently added" note={jobs.length ? `${jobs.length} collections` : 'Nothing yet'}>
        {recent.length
          ? <div className="tile-grid">{recent.map((job) => <CollectionTile key={job.id} job={job} />)}</div>
          : <EmptyState title="Your library starts here." action={<Button as={Link} to="/add" variant="primary">Add your first link</Button>}>Add a Spotify playlist, album, or track. Each one gets its own page with live progress.</EmptyState>}
      </Section>
    </>
  );
}
