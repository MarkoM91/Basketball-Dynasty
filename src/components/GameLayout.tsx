import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { NavBar, Toast } from './UI';
import { DesktopHeader, DesktopSidebar } from './DesktopSidebar';
import { pathFromScreen } from '../routes';
import { useGameStore, normalizeFranchise } from '../store/gameStore';
import type { ScreenId } from '../types/game';
function useMobileLayout() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 959px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 959px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return mobile;
}

export function HydrationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(useGameStore.persist.hasHydrated());

  useEffect(() => {
    const finish = () => {
      const { franchise } = useGameStore.getState();
      if (franchise) {
        try {
          useGameStore.setState({ franchise: normalizeFranchise(franchise) });
        } catch (err) {
          console.error('Failed to normalize franchise on load:', err);
        }
      }
      setReady(true);
    };

    if (useGameStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useGameStore.persist.onFinishHydration(finish);
  }, []);

  if (!ready) {
    return (
      <div className="boot-screen">
        <p className="eyebrow">Basketball Dynasty</p>
        <h1 className="title-lg">Loading franchise data…</h1>
        <p className="body">Restoring your save from this device.</p>
      </div>
    );
  }

  return children;
}

export function GameLayout() {
  const navigate = useNavigate();
  const franchise = useGameStore((s) => s.franchise);
  const screen = useGameStore((s) => s.screen);
  const toast = useGameStore((s) => s.toast);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const setScreen = useGameStore((s) => s.setScreen);
  const isMobile = useMobileLayout();

  useEffect(() => {
    if (isMobile && toast) dismissToast();
  }, [isMobile, toast, dismissToast]);

  const goTo = (next: ScreenId) => {
    setScreen(next);
    navigate(pathFromScreen(next));
  };
  return (
    <div className="app-shell">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />
      {franchise && <DesktopSidebar screen={screen} onNavigate={goTo} />}
      <div className="app-main">
        {franchise && <DesktopHeader />}
        {toast && !isMobile && <Toast message={toast} onDismiss={dismissToast} />}
        {franchise && (
          <div className="mobile-game-nav">
            <Link to="/" className="back-link">← Main menu</Link>
          </div>
        )}
        <Outlet context={{ goTo }} />
        {franchise && <NavBar screen={screen} phase={franchise.phase} onNavigate={goTo} />}
      </div>
    </div>
  );
}

export function RequireFranchise() {
  const started = useGameStore((s) => s.started);
  const franchise = useGameStore((s) => s.franchise);
  if (!started || !franchise) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function useGameNav() {
  const navigate = useNavigate();
  const setScreen = useGameStore((s) => s.setScreen);
  return (screen: ScreenId) => {
    setScreen(screen);
    navigate(pathFromScreen(screen));
  };
}