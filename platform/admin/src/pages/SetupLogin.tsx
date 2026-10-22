import { useState, type FormEvent } from 'react';
import { Notice } from '../icons';
import { useAuth } from '../session';
import { supabase } from '../supabase';
import { setLoginFlash } from './Login';

// One-time: the organiser signed in with the codes and the authenticator; now they choose the e-mail and password
// they will use from then on (the database gives organiser rights only to a password session).
export function SetupLogin() {
  const { signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errors: Record<string, string> = {
    email: 'E-mail nemá platný tvar.', password: 'Heslo musí mít alespoň 12 znaků.', weak: 'Heslo je příliš slabé nebo uniklo na internetu. Zvolte jiné.',
    taken: 'Tento e-mail už používá jiný účet.', mfa: 'Nejdřív se ověřte aplikací.', forbidden: 'Tento účet nemá přístup do administrace.',
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== again) return setError('Hesla se neshodují.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('admin-login-setup', { body: { email: email.trim(), password } });
    setBusy(false);
    if (err || !data?.ok) {
      let code = 'server';
      try { code = (await (err as { context?: Response })?.context?.json())?.error ?? code; } catch { /* no body */ }
      return setError(errors[code] ?? 'Nastavení se nepodařilo. Zkuste to za chvíli znovu.');
    }
    setLoginFlash(`Přístup je nastaven. Přihlaste se e-mailem ${email.trim()}, heslem a kódem z aplikace.`);
    await signOut();
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit} noValidate>
        <div className="brand"><img src="/img/shield.svg" alt="" /></div>
        <h1>Nastavte si přihlášení</h1>
        <Notice kind="info">Do administrace se nově přihlašujete e-mailem, heslem a kódem z aplikace. Kódy z pozvánky zůstávají pro mobilní aplikaci.</Notice>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="field">
          <label htmlFor="se">E-mail</label>
          <input id="se" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <span className="help">Sem přijde odkaz, kdybyste zapomněli heslo.</span>
        </div>
        <div className="field">
          <label htmlFor="sp">Nové heslo</label>
          <input id="sp" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <span className="help">Alespoň 12 znaků. Nejlépe několik slov, která si zapamatujete.</span>
        </div>
        <div className="field">
          <label htmlFor="sa">Heslo znovu</label>
          <input id="sa" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        </div>
        <button className="btn primary" type="submit" disabled={!email.trim() || password.length < 12 || !again || busy} aria-busy={busy}>{busy ? 'Ukládá se…' : 'Uložit a přihlásit se znovu'}</button>
        <button className="btn quiet" type="button" onClick={signOut}>Zrušit a odhlásit</button>
      </form>
    </div>
  );
}

// After the link from "Zapomenuté heslo": a new password (with the authenticator code when one is set up).
export function ResetPassword() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data: f } = await supabase.auth.mfa.listFactors();
    const factor = f?.totp.find((x) => x.status === 'verified');
    if (factor) {
      const { error: mfaErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (mfaErr) { setBusy(false); return setError('Kód z aplikace nesouhlasí.'); }
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(/weak|pwned|leak/i.test(err.message) ? 'Heslo je příliš slabé nebo uniklo na internetu. Zvolte jiné.' : 'Heslo se nepodařilo uložit. Zkuste to znovu.');
    window.history.replaceState(null, '', window.location.pathname);
    setLoginFlash('Heslo je změněno. Přihlaste se e-mailem, novým heslem a kódem z aplikace.');
    await signOut();
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit} noValidate>
        <div className="brand"><img src="/img/shield.svg" alt="" /></div>
        <h1>Nové heslo</h1>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="field">
          <label htmlFor="np">Nové heslo</label>
          <input id="np" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          <span className="help">Alespoň 12 znaků.</span>
        </div>
        <div className="field">
          <label htmlFor="nc">Šestimístné číslo z aplikace</label>
          <input id="nc" className="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </div>
        <button className="btn primary" type="submit" disabled={password.length < 12 || busy} aria-busy={busy}>{busy ? 'Ukládá se…' : 'Uložit heslo'}</button>
      </form>
    </div>
  );
}
