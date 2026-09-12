import {JobCard} from './JobCard.jsx';

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-disc" aria-hidden="true" />
      <h3>Your library starts here.</h3>
      <p>Add your first Spotify link above. Each collection shows up in this list with live progress.</p>
    </div>
  );
}

export function JobList({jobs, progress, onAction, busyJobId}) {
  const count = jobs.length;
  return (
    <section className="activity" aria-labelledby="activity-title">
      <div className="section-head">
        <h2 id="activity-title">Downloads</h2>
        <span className="section-note">{count ? `${count} ${count === 1 ? 'collection' : 'collections'}` : 'Nothing yet'}</span>
      </div>
      <div className="jobs">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} progress={progress} onAction={onAction} busy={busyJobId === job.id} />
        ))}
      </div>
      {!count && <EmptyState />}
    </section>
  );
}
