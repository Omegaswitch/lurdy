import { t } from '@lurdy/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Notice } from '../icons';
import { useAuth } from '../session';
import { supabase } from '../supabase';

// Organisers confirm with an authenticator app (TOTP). First time: enrol by scanning a QR code.
export function Mfa({ enrolled }: { enrolled: boolean }) {
  const { refresh, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === 'verified');
      if (enrolled && verified) {
        setFactorId(verified.id);
        return;
      }
      // An enrolment that was started but never confirmed is discarded and started again.
      for (const f of data?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: en, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Lurdy ${Date.now()}` });
      if (e || !en) return setError(t('login.error'));
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
    })();
  }, [enrolled]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (err) return setError(t('mfa.invalid'));
    await refresh();
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand"><img src="/img/shield.svg" alt="" /></div>
        <h1>{t('mfa.title')}</h1>
        <Notice kind="info">{t('admin.mfaRequired')}</Notice>
        {qr && (
          <div className="stack" style={{ justifyItems: 'center' }}>
            <p style={{ margin: 0 }}>{t('mfa.enroll')}</p>
            <img src={qr} alt="QR kód pro aplikaci" width={180} height={180} />
            <code style={{ fontSize: '.8rem', wordBreak: 'break-all' }}>{secret}</code>
          </div>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <div className="field">
          <label htmlFor="totp">{t('mfa.code')}</label>
          <input id="totp" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
        </div>
        <button className="btn primary" type="submit" disabled={code.length !== 6 || busy || !factorId} aria-busy={busy}>{t('mfa.submit')}</button>
        <button className="btn quiet" type="button" onClick={signOut}>{t('common.signOut')}</button>
      </form>
    </div>
  );
}
