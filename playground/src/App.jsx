import './lib.js';
import { Pipette, Layers, Contrast, Palette, Terminal } from 'lucide-react';
import { RouterProvider, Link, useRoute } from './router.jsx';
import { ColorProvider } from './color-state.jsx';
import Home from './pages/Home.jsx';
import PalettePage from './pages/PalettePage.jsx';
import ContrastPage from './pages/ContrastPage.jsx';
import ThemePage from './pages/ThemePage.jsx';

const NAV = [
  { to: '/', label: 'Picker', icon: <Pipette size={15} /> },
  { to: '/palette', label: 'Palette', icon: <Layers size={15} /> },
  { to: '/contrast', label: 'Contrast', icon: <Contrast size={15} /> },
  { to: '/theme', label: 'Theme', icon: <Palette size={15} /> },
  { to: '/#cli', label: 'CLI', icon: <Terminal size={15} /> },
];

const PAGES = { '/': Home, '/palette': PalettePage, '/contrast': ContrastPage, '/theme': ThemePage };

function NotFound() {
  return (
    <section className="section">
      <h2 className="section-title">Nothing here</h2>
      <p className="section-desc">
        <Link to="/">Back to the picker</Link>
      </p>
    </section>
  );
}

function Shell() {
  const path = useRoute().replace(/\/+$/, '') || '/';
  const Page = PAGES[path] ?? NotFound;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <img className="brand-mark" src="/favicon.svg" alt="" width="26" height="26" />
            <span className="brand-name">colordx</span>
          </Link>
          <nav className="topnav" aria-label="Pages">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={path === n.to ? 'on' : ''} aria-current={path === n.to ? 'page' : undefined}>
                {n.icon}
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
          <span className="topbar-divider" />
          <a className="ext-link" href="https://www.npmjs.com/package/@colordx/core" target="_blank" rel="noopener noreferrer">
            npm ↗
          </a>
          <a className="ext-link" href="https://github.com/dkryaklin/colordx" target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        </div>
      </header>

      <main id="top">
        <Page />
      </main>

      <footer className="footer">
        <span className="footer-mark">colordx · MIT</span>
        <nav className="footer-nav">
          <a href="https://github.com/dkryaklin/colordx" target="_blank" rel="noopener noreferrer">
            @colordx/core
          </a>
          <a href="https://github.com/dkryaklin/colordx-a11y" target="_blank" rel="noopener noreferrer">
            @colordx/cli
          </a>
          <a href="https://dkryaklin.com" target="_blank" rel="noopener noreferrer">
            dkryaklin.com
          </a>
        </nav>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ColorProvider>
        <Shell />
      </ColorProvider>
    </RouterProvider>
  );
}
