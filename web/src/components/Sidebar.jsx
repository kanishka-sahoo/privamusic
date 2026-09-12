import {Button, ExternalIcon} from './Button.jsx';
import {Panel} from './Panel.jsx';

function Stat({value, label}) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function StatsPanel({summary}) {
  return (
    <Panel className="stats" aria-label="Library summary">
      <Stat value={summary.tracks} label="Tracks collected" />
      <Stat value={summary.active} label="In the queue" />
      <Stat value={summary.playlists} label="Playlists synced" />
    </Panel>
  );
}

export function DownloaderPanel() {
  return (
    <Panel className="side-card" title="Downloader session" titleId="downloader-title">
      <p>The native downloader keeps its own login. Open its screen to sign in for the first time or to renew an expired session.</p>
      <Button as="a" variant="ghost" block href="/native/vnc.html" target="_blank" rel="noopener">
        Open downloader <ExternalIcon />
      </Button>
    </Panel>
  );
}

export function HowItWorksPanel() {
  return (
    <Panel className="side-card muted-card" title="How it works" titleId="how-title">
      <ol className="steps">
        <li>Tracks are fetched through the authenticated downloader.</li>
        <li>Each file is checked for FLAC audio and a plausible duration.</li>
        <li>Finished files are published to the music folder and Navidrome playlists are updated in order.</li>
      </ol>
    </Panel>
  );
}
