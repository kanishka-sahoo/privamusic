import {useCallback, useEffect, useRef, useState} from 'react';
import RFB from '@novnc/novnc';
import {Brand} from '../components/Brand.jsx';
import {Button} from '../components/Button.jsx';
import {StatusPill} from '../components/StatusPill.jsx';

const MESSAGES = {
  pending: 'Connecting to downloader…',
  ok: 'Complete the app’s normal login below. Your session is saved on this server.',
  error: 'Disconnected. Reconnect, or sign in to the dashboard again.',
};

function socketUrl() {
  const target = new URL('/native/websockify', location.href);
  target.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return target.href;
}

// Hosts the noVNC client for the native downloader's own login screen.
export function NativeDesktopPage() {
  const screen = useRef(null);
  const connection = useRef(null);
  const [state, setState] = useState('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState('pending');
    const rfb = new RFB(screen.current, socketUrl());
    rfb.scaleViewport = true;
    rfb.addEventListener('connect', () => setState('ok'));
    rfb.addEventListener('disconnect', () => setState('error'));
    connection.current = rfb;
    return () => rfb.disconnect();
  }, [attempt]);

  // The deployment check waits for this class before inspecting the canvas.
  useEffect(() => {
    document.documentElement.classList.toggle('noVNC_connected', state === 'ok');
  }, [state]);

  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <>
      <header className="topbar native-toolbar">
        <Brand label="Back to dashboard" />
        <StatusPill id="desktop-status" state={state}>{MESSAGES[state]}</StatusPill>
        <nav className="topnav" aria-label="Downloader">
          <Button as="a" variant="ghost" href="/">Dashboard</Button>
          <Button variant="quiet" onClick={reconnect}>Reconnect</Button>
        </nav>
      </header>
      <div id="native-screen" ref={screen} aria-label="Native downloader login screen" />
    </>
  );
}
