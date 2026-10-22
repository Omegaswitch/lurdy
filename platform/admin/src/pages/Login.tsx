import { t } from '@lurdy/shared';
import { useState, type FormEvent } from 'react';
import { supabase as sb } from '../supabase';
import { Notice } from '../icons';
import { useAuth } from '../session';
import { formatInvitationCode, normaliseInvitationCode } from '@lurdy/shared';
import { signInWithCode, type CodeLoginError } from '../supabase';

const messages: Record<CodeLoginError, string> = {
  invalid: t('login.invalid'),
  throttled: t('login.throttled'),
  offline: t('login.offline'),
  error: t('login.error'),
};

function CodeLogin({ onBack }: { onBack: () => void }) {
  const { refresh } = useAuth();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [error, setError] = useState<CodeLoginError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signInWithCode(code, secret, eventCode);
    setBusy(false);
    setError(err);
    if (!err) await refresh();
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit} noValidate>
        <div className="brand"><img src="/img/shield.svg" alt="" /></div>
        <div>
          <h1>{t('app.name')}</h1>
          <p style={{ textAlign: 'center', margin: '4px 0 0', color: 'var(--muted)' }}>Nastavení přístupu do administrace</p>
        </div>
        <Notice kind="info">Jen poprvé (nebo když jste zapomněli heslo a e-mail nepřišel): přihlaste se kódy z pozvánky a kódem pouti, potvrďte aplikací a nastavte si e-mail a heslo. Dál se do administrace přihlašujete e-mailem, heslem a aplikací.</Notice>
        {error && <Notice kind="error">{messages[error]}</Notice>}
        <div className="field">
          <label htmlFor="code">{t('login.code')}</label>
          <input id="code" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="\d{4}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-invalid={error === 'invalid'} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="secret">{t('login.secret')}</label>
          <input id="secret" className="code" autoCapitalize="characters" autoComplete="off" maxLength={9} spellCheck={false}
            value={formatInvitationCode(secret)} onChange={(e) => setSecret(normaliseInvitationCode(e.target.value))} aria-invalid={error === 'invalid'} required />
          <span className="help">{t('login.secret.help')}</span>
        </div>
        <div className="field">
          <label htmlFor="event">{t('login.eventCode')}</label>
          <input id="event" className="code" autoCapitalize="characters" autoComplete="off" maxLength={6}
            value={eventCode} onChange={(e) => setEventCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-invalid={error === 'invalid'} />
          <span className="help">{t('login.eventCode.help')}</span>
        </div>
        <button className="btn primary" type="submit" disabled={code.length !== 4 || secret.length !== 8 || eventCode.length !== 6 || busy} aria-busy={busy}>
          {busy ? t('common.loading') : 'Pokračovat'}
        </button>
        <button className="btn quiet" type="button" onClick={onBack}>Zpět na přihlášení e-mailem</button>
      </form>
    </div>
  );
}

// A message for the next sign-in screen (after the setup or a password change the session is closed on purpose).
let flash: string | null = null;
export const setLoginFlash = (m: string) => { flash = m; };

// The admin sign-in: e-mail + password, then the authenticator (Mfa). Like the school websites. The phone app keeps the
// simple sign-in with codes; here the codes only serve the one-time setup of the e-mail and password.
export function Login() {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'ok' | 'info'; text: string } | null>(() => (flash ? { kind: 'ok', text: flash } : null));
  const [busy, setBusy] = useState(false);
  flash = null;
  if (mode === 'code') return <CodeLogin onBack={() => setMode('password')} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      return setMessage({ kind: 'error', text: /invalid/i.test(error.message) ? 'E-mail nebo heslo nesouhlasí.'
        : /rate|many/i.test(error.message) ? 'Příliš mnoho pokusů. Počkejte chvíli a zkuste to znovu.' : 'Přihlášení se nepodařilo. Zkuste to za chvíli znovu.' });
    }
    setPassword('');
    await refresh();
  }
  async function forgot() {
    if (!email.trim()) return setMessage({ kind: 'error', text: 'Napište svůj e-mail do pole výše a klepněte znovu.' });
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    setMessage(error ? { kind: 'error', text: 'Odkaz se nepodařilo odeslat. Zkuste to za chvíli, nebo nastavte heslo znovu přes kódy z pozvánky.' }
      : { kind: 'info', text: `Pokud účet existuje, poslali jsme na ${email.trim()} odkaz pro nastavení nového hesla.` });
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit} noValidate>
        <div className="brand"><img src="/img/shield.svg" alt="" /></div>
        <div>
          <h1>{t('app.name')}</h1>
          <p style={{ textAlign: 'center', margin: '4px 0 0', color: 'var(--muted)' }}>Administrace</p>
        </div>
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="password">Heslo</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <span className="help">Potom ještě šestimístné číslo z aplikace pro ověřování.</span>
        </div>
        <button className="btn primary" type="submit" disabled={!email.trim() || !password || busy} aria-busy={busy}>{busy ? t('common.loading') : t('login.submit')}</button>
        <button className="btn quiet" type="button" onClick={forgot}>Zapomenuté heslo</button>
        <button className="btn quiet" type="button" onClick={() => setMode('code')}>První přihlášení: nastavit e-mail a heslo</button>
      </form>
    </div>
  );
}
