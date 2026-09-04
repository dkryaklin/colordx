import { createContext, useContext, useEffect, useState } from 'react';

const RouteCtx = createContext('/');

if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

function scrollToHash(hash) {
  if (!hash) {
    window.scrollTo({ top: 0 });
    return;
  }
  const el = document.getElementById(hash.slice(1));
  if (el) el.scrollIntoView({ block: 'start' });
}

export function navigate(to) {
  const [path, hash = ''] = to.split('#');
  const target = path || '/';
  if (target !== window.location.pathname) {
    window.history.pushState(null, '', target + (hash ? `#${hash}` : ''));
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.history.replaceState(null, '', target + (hash ? `#${hash}` : ''));
    scrollToHash(hash ? `#${hash}` : '');
  }
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  // a new page starts at the top, or at its hash
  useEffect(() => {
    scrollToHash(window.location.hash);
  }, [path]);
  return <RouteCtx.Provider value={path}>{children}</RouteCtx.Provider>;
}

export const useRoute = () => useContext(RouteCtx);

export function Link({ to, children, ...rest }) {
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
