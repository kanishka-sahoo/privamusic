import {Button, ExternalIcon} from './components/Button.jsx';
import {Footer} from './components/Footer.jsx';
import {StatusPill} from './components/StatusPill.jsx';
import {Toast} from './components/Toast.jsx';
import {TopBar} from './components/TopBar.jsx';
import {useSession} from './hooks/useSession.js';
import {useToast} from './hooks/useToast.js';
import {libraryUrl} from './lib/jobs.js';
import {DashboardPage} from './pages/DashboardPage.jsx';
import {LoginPage} from './pages/LoginPage.jsx';

function connectionState(data) {
  if (data.halted) return ['error', 'Worker needs restart'];
  if (data.connected && data.navReady) return ['ok', 'Library connected'];
  return ['pending', 'Starting services…'];
}

export function App() {
  const session = useSession();
  const {toast, show, dismiss} = useToast();
  const signedIn = session.status === 'authenticated' && session.data;
  const [state, label] = signedIn ? connectionState(session.data) : [];

  async function logout() {
    try {
      await session.logout();
    } catch (e) {
      show(e);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopBar status={signedIn && <StatusPill id="connection" state={state}>{label}</StatusPill>}>
        {signedIn && (
          <>
            <Button as="a" variant="ghost" href={libraryUrl(session.data.navidromePort)} target="_blank" rel="noopener">
              Open library <ExternalIcon />
            </Button>
            <Button variant="quiet" onClick={logout}>Sign out</Button>
          </>
        )}
      </TopBar>
      <main id="main" className="page">
        {session.status === 'loading' && <p className="loading" role="status">Opening your library…</p>}
        {session.status === 'anonymous' && <LoginPage onLogin={session.login} />}
        {signedIn && <DashboardPage data={session.data} refresh={session.refresh} onError={show} />}
        <Toast toast={toast} onDismiss={dismiss} />
      </main>
      <Footer />
    </>
  );
}
