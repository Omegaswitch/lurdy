import { t } from '@lurdy/shared';
import { useEffect, useState } from 'react';
import { Icon, Notice, type IconName } from './icons';
import { Accommodation } from './pages/Accommodation';
import { Badges } from './pages/Badges';
import { Care } from './pages/Care';
import { Communication } from './pages/Communication';
import { Edition } from './pages/Edition';
import { Login } from './pages/Login';
import { Mfa } from './pages/Mfa';
import { Overview } from './pages/Overview';
import { Participants } from './pages/Participants';
import { Programme } from './pages/Programme';
import { Reports } from './pages/Reports';
import { Transport } from './pages/Transport';
import { useAuth, useReady } from './session';

const routes: { path: string; label: string; icon: IconName; page: () => React.ReactElement }[] = [
  { path: '', label: t('admin.overview'), icon: 'home', page: Overview },
  { path: 'ucastnici', label: t('admin.participants'), icon: 'users', page: Participants },
  { path: 'doprava', label: t('admin.transport'), icon: 'bus', page: Transport },
  { path: 'ubytovani', label: 'Ubytování', icon: 'bed', page: Accommodation },
  { path: 'pece', label: 'Péče', icon: 'heart', page: Care },
  { path: 'program', label: 'Program', icon: 'calendar', page: Programme },
  { path: 'kontakty', label: 'Kontakty a oznámení', icon: 'phone', page: Communication },
  { path: 'jmenovky', label: t('admin.badges'), icon: 'badge', page: Badges },
  { path: 'tisk', label: 'Tisk', icon: 'printer', page: Reports },
  { path: 'rocnik', label: t('admin.edition'), icon: 'flag', page: Edition },
];

function useHashPath() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

function Shell() {
  const { signOut } = useAuth();
  const { edition, me } = useReady();
  const path = useHashPath();
  const route = routes.find((r) => r.path === path) ?? routes[0]!;
  const Page = route.page;
  useEffect(() => {
    document.title = `${route.label} · ${t('app.name')} ${edition.year}`;
  }, [route, edition.year]);

  return (
    <div className="shell">
      <a className="skip" href="#main">Přeskočit na obsah</a>
      <header className="top">
        <img src="/img/lockup-cs.svg" alt="Maltézský řád" />
        <div className="edition">
          {t('app.name')} {edition.year}
          <small>{edition.title}</small>
        </div>
        <div className="who">
          {me && <span>{me.first_name} {me.last_name}</span>}
          <button className="btn small" onClick={signOut}>
            <Icon name="logout" width={16} height={16} /> {t('common.signOut')}
          </button>
        </div>
      </header>
      <nav className="rail" aria-label="Hlavní menu">
        <ul>
          {routes.map((r) => (
            <li key={r.path}>
              <a href={`#/${r.path}`} aria-current={r === route ? 'page' : undefined}>
                <Icon name={r.icon} /> {r.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" tabIndex={-1}>
        <Page />
      </main>
    </div>
  );
}

export function App() {
  const { state, signOut } = useAuth();
  if (state.status === 'loading') return <div className="login" aria-busy="true" />;
  if (state.status === 'signedOut') return <Login />;
  if (state.status === 'needsMfa') return <Mfa enrolled={state.enrolled} />;
  if (state.status === 'noAccess')
    return (
      <div className="login">
        <div className="card">
          <Notice kind="warn">{t('admin.noAccess')}</Notice>
          <button className="btn" onClick={signOut}>{t('common.signOut')}</button>
        </div>
      </div>
    );
  return <Shell />;
}
