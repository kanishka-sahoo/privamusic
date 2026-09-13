import {AddForm} from '../components/AddForm.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Panel} from '../components/Panel.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {jobPath} from '../lib/jobs.js';
import {navigate} from '../lib/router.js';

export function AddPage() {
  const {actions} = useApp();
  useDocumentTitle('Add from Spotify');

  // A successful submission opens the new collection's page, where progress is easiest to follow.
  async function submit(url) {
    const job = await actions.addJob(url);
    if (job?.id && job.kind) navigate(jobPath(job));
    return job;
  }

  return (
    <>
      <PageHeader eyebrow="Tools" title="Add from Spotify" description="Paste a link from Spotify. Playlists and albums keep their track order; singles land in the library on their own." />
      <div className="two-column">
        <AddForm onSubmit={submit} busy={actions.adding} />
        <Panel className="side-card muted-card" title="What happens next" titleId="how-title">
          <ol className="steps">
            <li>The track list is read from Spotify through the authenticated downloader.</li>
            <li>Each file is fetched, checked for FLAC audio and a plausible duration, then published to the music folder.</li>
            <li>Missing artwork and lyrics are filled in before Navidrome scans the new files.</li>
            <li>Playlists are created in Navidrome in the same order. Partial results still produce a playlist you can retry.</li>
          </ol>
          <p className="hint">Requests are spaced at least ten seconds apart. Provider rate limits pause the whole queue with an automatic, growing cooldown.</p>
        </Panel>
      </div>
    </>
  );
}
