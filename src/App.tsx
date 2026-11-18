import React, { useEffect, useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { PublicPortal } from './components/PublicPortal';

export default function App() {
  const [route, setRoute] = useState<'public' | 'admin'>(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'public'
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'public');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (target: 'public' | 'admin') => {
    const nextPath = target === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(target);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (route === 'admin') {
    return <AdminPortal onBackToSite={() => navigateTo('public')} />;
  }

  return <PublicPortal onNavigateAdmin={() => navigateTo('admin')} />;
}
