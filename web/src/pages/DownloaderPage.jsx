import {Button, ExternalIcon} from '../components/Button.jsx';
import {PageHeader} from '../components/PageHeader.jsx';
import {Panel} from '../components/Panel.jsx';
import {StatusPill} from '../components/StatusPill.jsx';
import {useDocumentTitle} from '../hooks/useDocumentTitle.js';
import {useApp} from '../lib/context.js';
import {libraryUrl} from '../lib/jobs.js';

function Service({name, state, children}) {
  return (
    <div className="service">
      <StatusPill state={state}>{name}</StatusPill>
      <p>{children}</p>
    </div>
  );
}

export function DownloaderPage() {
  const {data} = useApp();
  useDocumentTitle('Downloader');
  const bridge = data.halted ? 'error' : data.connected ? 'ok' : 'pending';
  return (
    <>
      <PageHeader eyebrow="Tools" title="Downloader" description="The native downloader runs beside the dashboard and keeps its own Spotify login." />
      <div className="two-column">
        <Panel className="side-card" title="Session" titleId="session-title">
          <p>Open the downloader's screen to sign in for the first time, or to renew an expired session. Nothing is stored outside this server.</p>
          <Button as="a" variant="primary" block href="/native/vnc.html" target="_blank" rel="noopener">
            Open downloader <ExternalIcon />
          </Button>
        </Panel>
        <Panel className="side-card" title="Services" titleId="services-title">
          <div className="services">
            <Service name="Native bridge" state={bridge}>
              {data.halted ? 'Stopped after a timeout. Restart the container, then retry the affected collection.' : data.connected ? 'Connected and accepting downloads.' : 'Starting up. This can take a minute after a restart.'}
            </Service>
            <Service name="Navidrome" state={data.navReady ? 'ok' : 'pending'}>
              {data.navReady ? 'Ready to scan and sync playlists.' : 'Waiting for the library to answer.'}
            </Service>
          </div>
          <Button as="a" variant="ghost" block href={libraryUrl(data)} target="_blank" rel="noopener">
            Open library <ExternalIcon />
          </Button>
        </Panel>
      </div>
      <Panel className="side-card muted-card" title="How it works" titleId="how-title">
        <ol className="steps">
          <li>Tracks are fetched through the authenticated downloader over a loopback bridge.</li>
          <li>Each file is checked for FLAC audio and a plausible duration before it is published.</li>
          <li>Finished files are moved into the music folder and Navidrome playlists are updated in order.</li>
        </ol>
      </Panel>
    </>
  );
}
