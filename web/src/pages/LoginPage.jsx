import {useState} from 'react';
import {Button} from '../components/Button.jsx';
import {useAsyncAction} from '../hooks/useAsyncAction.js';

function RecordArt() {
  return (
    <div className="login-art" aria-hidden="true">
      <div className="record">
        <div className="record-label"><span>PRIVA</span><span>MUSIC</span></div>
      </div>
      <div className="art-caption"><span>Lossless / FLAC</span><span>Synced to Navidrome</span></div>
    </div>
  );
}

export function LoginPage({onLogin}) {
  const [error, setError] = useState(null);
  const [submit, busy] = useAsyncAction(async (event) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    await onLogin(Object.fromEntries(new FormData(form)));
    form.reset();
  }, setError);

  return (
    <section className="login" aria-labelledby="login-title">
      <div className="login-copy">
        <p className="eyebrow">Private music library</p>
        <h1 id="login-title">Music you keep,<br />on a server you own.</h1>
        <p className="lede">Paste a Spotify link, get lossless FLAC in your Navidrome library. Nothing leaves your machine.</p>
        <form className="form stack" onSubmit={submit} autoComplete="on">
          <label className="field">
            <span>Email</span>
            <input name="username" type="email" autoComplete="username" placeholder="you@example.com" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" placeholder="••••••••••••" required />
          </label>
          <Button type="submit" variant="primary" size="large" disabled={busy}>Sign in</Button>
        </form>
        <p className="message" role="status" aria-live="polite">{error?.message}</p>
      </div>
      <RecordArt />
    </section>
  );
}
