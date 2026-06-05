import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isGamePath, isPublicPath, pathFromScreen, screenFromPath } from '../routes';
import { useGameStore } from '../store/gameStore';

/** Keep game screen state and URLs aligned without overriding public pages like /guide. */
export function RouteSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => {
    if (isPublicPath(location.pathname)) return;
    const fromUrl = screenFromPath(location.pathname);
    if (fromUrl && fromUrl !== useGameStore.getState().screen) {
      setScreen(fromUrl);
    }
  }, [location.pathname, setScreen]);

  useEffect(() => {
    return useGameStore.subscribe((state, prevState) => {
      if (state.screen === prevState.screen) return;
      if (isPublicPath(window.location.pathname)) return;
      const path = pathFromScreen(state.screen);
      if (window.location.pathname !== path) {
        navigate(path);
      }
    });
  }, [navigate]);

  return null;
}

export function isMarketingPath(pathname: string): boolean {
  return isPublicPath(pathname) && !isGamePath(pathname);
}
