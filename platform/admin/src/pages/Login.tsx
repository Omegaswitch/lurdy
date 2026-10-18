import { t } from '@lurdy/shared';
import { useState, type FormEvent } from 'react';
import { Notice } from '../icons';
import { useAuth } from '../session';
import { signInWithCode, type CodeLoginError } from '../supabase';

const messages: Record<CodeLoginError, string> = {
  invalid: t('login.invalid'),
  throttled: t('login.throttled'),
  offline: t('login.offline'),
  error: t('login.error'),
};

export function Login() {
  const { refresh } = useAuth();
  const [code, setCode] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [error, setError] = useState<CodeLoginError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signInWithCode(code, eventCode);
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
          <p style={{ textAlign: 'center', margin: '4px 0 0', color: 'var(--muted)' }}>Administrace</p>
        </div>
        {error && <Notice kind="error">{messages[error]}</Notice>}
        <div className="field">
          <label htmlFor="code">{t('login.code')}</label>
          <input id="code" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={4} pattern="\d{4}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-invalid={error === 'invalid'} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="event">{t('login.eventCode')}</label>
          <input id="event" className="code" autoCapitalize="characters" autoComplete="off" maxLength={6}
            value={eventCode} onChange={(e) => setEventCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} aria-invalid={error === 'invalid'} />
          <span className="help">{t('login.eventCode.help')}</span>
        </div>
        <button className="btn primary" type="submit" disabled={code.length !== 4 || busy} aria-busy={busy}>
          {busy ? t('common.loading') : t('login.submit')}
        </button>
      </form>
    </div>
  );
}
