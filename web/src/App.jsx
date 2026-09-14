import {useEffect, useMemo, useState} from 'react';
import {Brand} from './components/Brand.jsx';
import {Footer} from './components/Footer.jsx';
import {Sidebar} from './components/Sidebar.jsx';
import {StatusPill} from './components/StatusPill.jsx';
import {Toast} from './components/Toast.jsx';
import {TopBar} from './components/TopBar.jsx';
import {useJobActions} from './hooks/useJobActions.js';
import {useSession} from './hooks/useSession.js';
import {useToast} from './hooks/useToast.js';
import {AppContext} from './lib/context.js';
import {summarize} from './lib/jobs.js';
import {matchPath, useLocation} from './lib/router.js';
import {AddPage} from './pages/AddPage.jsx';
import {CollectionPage} from './pages/CollectionPage.jsx';
import {CollectionsPage} from './pages/CollectionsPage.jsx';
import {DashboardPage} from './pages/DashboardPage.jsx';
import {DiscoverPage} from './pages/DiscoverPage.jsx';
import {DownloaderPage} from './pages/DownloaderPage.jsx';
import {LoginPage} from './pages/LoginPage.jsx';
import {NotFoundPage} from './pages/NotFoundPage.jsx';
import {QueuePage} from './pages/QueuePage.jsx';

const ROUTES = [
  ['/', () => <DashboardPage />],
  ['/queue', () => <QueuePage />],
  ['/playlists', () => <CollectionsPage kind="playlist" />],
  ['/albums', () => <CollectionsPage kind="album" />],
  ['/tracks', () => <CollectionsPage kind="track" />],
  ['/playlists/:id', ({id}) => <CollectionPage kind="playlist" id={id} />],
  ['/albums/:id', ({id}) => <CollectionPage kind="album" id={id} />],
  ['/tracks/:id', ({id}) => <CollectionPage kind="track" id={id} />],
  ['/discover', () => <DiscoverPage />],
  ['/discover/:id', ({id}) => <CollectionPage kind="listenbrainz" id={id} />],
  ['/add', () => <AddPage />],
  ['/downloader', () => <DownloaderPage />],
];

function resolve(path) {
  for (const [pattern, render] of ROUTES) {
    const params = matchPath(pattern, path);
    if (params) return {key: pattern, element: render(params)};
  }
  return {key: '404', element: <NotFoundPage />};
}

function connectionState(data) {
  if (data.halted) return ['error', 'Worker needs restart'];
  if (data.connected && data.navReady) return ['ok', 'Library connected'];
  return ['pending', 'Starting services…'];
}

function Shell({session, show}) {
  const {path} = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const actions = useJobActions(session.refresh, show);
  const summary = summarize(session.data.jobs);
  const connection = connectionState(session.data);
  const route = resolve(path);
  const value = useMemo(() => ({data: session.data, refresh: session.refresh, actions}), [session.data, session.refresh, actions]);

  // New page: close the drawer and start at the top.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [route.key, path]);

  async function logout() {
    try {
      await session.logout();
    } catch (e) {
      show(e);
    }
  }

  return (
    <AppContext.Provider value={value}>
      <div className="shell">
        <Sidebar summary={summary} connection={connection} library={session.data} onLogout={logout} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="shell-main">
          <TopBar onMenu={() => setMenuOpen(true)} status={<StatusPill state={connection[0]} className="compact">{connection[1]}</StatusPill>} />
          <main id="main" className="page">{route.element}</main>
          <Footer />
        </div>
      </div>
    </AppContext.Provider>
  );
}

export function App() {
  const session = useSession();
  const {toast, show, dismiss} = useToast();
  const signedIn = session.status === 'authenticated' && session.data;

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      {session.status === 'loading' && <p className="loading centered" role="status">Opening your library…</p>}
      {session.status === 'anonymous' && (
        <div className="login-shell">
          <header className="topbar"><Brand /></header>
          <main id="main" className="page"><LoginPage onLogin={session.login} /></main>
          <Footer />
        </div>
      )}
      {signedIn && <Shell session={session} show={show} />}
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
