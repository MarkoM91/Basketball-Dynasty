import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RouteSync } from './components/RouteSync';
import { SeoHead } from './components/SeoHead';
import { trackPageView } from './lib/analytics';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameLayout, HydrationGate, RequireFranchise } from './components/GameLayout';
import { HomeScreen } from './screens/HomeScreen';
import { RosterScreen } from './screens/RosterScreen';
import { TradeScreen } from './screens/TradeScreen';
import { DraftScreen } from './screens/DraftScreen';
import { CapScreen } from './screens/CapScreen';
import { DevelopmentScreen } from './screens/DevelopmentScreen';
import { CoachScreen } from './screens/CoachScreen';
import { MediaScreen } from './screens/MediaScreen';
import { GhostsScreen } from './screens/GhostsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { PlayGameScreen } from './screens/PlayGameScreen';
import { PlayoffsScreen } from './screens/PlayoffsScreen';
import { FreeAgencyScreen } from './screens/FreeAgencyScreen';
import { LeagueScreen } from './screens/LeagueScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { FinancesScreen } from './screens/FinancesScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { TeamRosterScreen } from './screens/TeamRosterScreen';
import { GuideScreen } from './screens/GuideScreen';
import { ContractRenewalsScreen } from './screens/ContractRenewalsScreen';
import { CompareScreen } from './components/LandingCompareSection';

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return null;
}

function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <AnalyticsTracker />
        <SeoHead />
        <RouteSync />
        <HydrationGate>
          <Routes>
            <Route path="/" element={<MainMenuScreen />} />
            <Route path="/start" element={<OnboardingScreen />} />
            <Route path="/guide" element={<GuideScreen />} />
            <Route path="/compare" element={<CompareScreen />} />
            <Route element={<RequireFranchise />}>
              <Route element={<GameLayout />}>
                <Route path="/office" element={<HomeScreen />} />
                <Route path="/roster" element={<RosterScreen />} />
                <Route path="/trades" element={<TradeScreen />} />
                <Route path="/draft" element={<DraftScreen />} />
                <Route path="/cap" element={<CapScreen />} />
                <Route path="/development" element={<DevelopmentScreen />} />
                <Route path="/coach" element={<CoachScreen />} />
                <Route path="/media" element={<MediaScreen />} />
                <Route path="/history" element={<HistoryScreen />} />
                <Route path="/ghosts" element={<GhostsScreen />} />
                <Route path="/playoffs" element={<PlayoffsScreen />} />
                <Route path="/free-agency" element={<FreeAgencyScreen />} />
                <Route path="/renewals" element={<ContractRenewalsScreen />} />
                <Route path="/league" element={<LeagueScreen />} />
                <Route path="/results" element={<ResultsScreen />} />
                <Route path="/play" element={<PlayGameScreen />} />
                <Route path="/schedule" element={<ScheduleScreen />} />
                <Route path="/finances" element={<FinancesScreen />} />
                <Route path="/team/:teamId/roster" element={<TeamRosterScreen />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HydrationGate>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
