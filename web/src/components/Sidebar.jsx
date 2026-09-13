import {Brand} from './Brand.jsx';
import {Button, ExternalIcon} from './Button.jsx';
import {AlbumIcon, CloseIcon, DesktopIcon, HomeIcon, PlaylistIcon, PlusIcon, QueueIcon, TrackIcon} from './Icons.jsx';
import {Link} from './Link.jsx';
import {StatusPill} from './StatusPill.jsx';
import {KINDS, libraryUrl} from '../lib/jobs.js';

function NavItem({to, icon: IconComponent, count, end, children, onNavigate}) {
  return (
    <li>
      <Link to={to} end={end} className="nav-item" activeClassName="active" onClick={onNavigate}>
        <IconComponent />
        <span className="nav-label">{children}</span>
        {count ? <span className="nav-count">{count}</span> : null}
      </Link>
    </li>
  );
}

// Primary navigation. On small screens it becomes a drawer controlled by the top bar.
export function Sidebar({summary, connection, library, onLogout, open, onClose}) {
  const [state, label] = connection;
  return (
    <>
      <div className={`scrim${open ? ' visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-head">
          <Brand />
          <button type="button" className="icon-button drawer-close" onClick={onClose} aria-label="Close menu"><CloseIcon /></button>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-group">Library</p>
          <ul>
            <NavItem to="/" icon={HomeIcon} end onNavigate={onClose}>Overview</NavItem>
            <NavItem to="/queue" icon={QueueIcon} count={summary.active} onNavigate={onClose}>Queue</NavItem>
            <NavItem to={KINDS.playlist.path} icon={PlaylistIcon} count={summary.playlists} onNavigate={onClose}>{KINDS.playlist.label}</NavItem>
            <NavItem to={KINDS.album.path} icon={AlbumIcon} count={summary.albums} onNavigate={onClose}>{KINDS.album.label}</NavItem>
            <NavItem to={KINDS.track.path} icon={TrackIcon} count={summary.singles} onNavigate={onClose}>{KINDS.track.label}</NavItem>
          </ul>
          <p className="nav-group">Tools</p>
          <ul>
            <NavItem to="/add" icon={PlusIcon} onNavigate={onClose}>Add from Spotify</NavItem>
            <NavItem to="/downloader" icon={DesktopIcon} onNavigate={onClose}>Downloader</NavItem>
          </ul>
        </nav>
        <div className="sidebar-foot">
          <StatusPill id="connection" state={state}>{label}</StatusPill>
          <Button as="a" id="library-link" variant="ghost" block href={libraryUrl(library)} target="_blank" rel="noopener">
            Open library <ExternalIcon />
          </Button>
          <Button variant="quiet" block onClick={onLogout}>Sign out</Button>
        </div>
      </aside>
    </>
  );
}
