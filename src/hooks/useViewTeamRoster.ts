import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

/** Open a league team's roster — user franchise goes to /roster, others to /team/:id/roster. */
export function useViewTeamRoster() {
  const navigate = useNavigate();
  const franchise = useGameStore((s) => s.franchise);
  const setScreen = useGameStore((s) => s.setScreen);

  return (teamId: string) => {
    if (!teamId) return;
    if (franchise?.leagueTeamId === teamId) {
      setScreen('roster');
      navigate('/roster');
      return;
    }
    navigate(`/team/${teamId}/roster`);
  };
}
