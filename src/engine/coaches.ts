import type { Coach, CoachCandidate, Franchise } from '../types/game';
import { uid } from '../data/scenarios';
import {
  coachParodyName,
  coachRatingsFromTemplate,
  getTeamParodyCoach,
  pickCoachMarketParodies,
  type ParodyCoachTemplate,
} from '../data/parodyCoaches';
import { roundSalary } from './salaries';

const OFFENSE = ['Pace-and-space motion', 'Pick-and-roll heavy', 'Triangle principles', 'Five-out spacing', 'Transition attack'];
const DEFENSE = ['Switch everything', 'Drop coverage', 'Aggressive blitz', 'Zone hybrid', 'Physical half-court'];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function reputationFromRatings(devRating: number, playoffRating: number): CoachCandidate['reputation'] {
  if (devRating >= 82 || playoffRating >= 82) return 'Elite';
  if (devRating >= 72 && playoffRating >= 68) return 'Solid';
  return 'Risky';
}

function coachBlurb(reputation: CoachCandidate['reputation']): string {
  if (reputation === 'Elite') return 'Hot name on the market. Ownership will notice if you swing big.';
  if (reputation === 'Solid') return 'Reliable hire — fits a team with a defined timeline.';
  return 'Upside hire. Cheap, but the star may push back.';
}

function coachTraits(devRating: number, playoffRating: number) {
  return {
    strengths: [
      devRating >= 78 ? 'Elite player development' : 'Connects with young core',
      playoffRating >= 78 ? 'Playoff adjustment master' : 'Defensive identity',
    ],
    weaknesses: [
      devRating < 72 ? 'Limited star management' : 'Conservative late-game sets',
      playoffRating < 70 ? 'Playoff inexperience' : 'Roster fit dependent',
    ],
    lockerRoom: (devRating >= 75 ? 'Stable' : 'Concerned') as Coach['lockerRoom'],
    starRelationship: (playoffRating >= 75 ? 'Stable' : 'Concerned') as Coach['starRelationship'],
  };
}

function candidateFromTemplate(template: ParodyCoachTemplate): CoachCandidate {
  const { devRating, playoffRating } = coachRatingsFromTemplate(template);
  const reputation = reputationFromRatings(devRating, playoffRating);
  const traits = coachTraits(devRating, playoffRating);

  return {
    id: uid('cand'),
    name: coachParodyName(template),
    offensiveSystem: rand(OFFENSE),
    defensiveSystem: rand(DEFENSE),
    ...traits,
    devRating,
    playoffRating,
    askingYears: 3 + Math.floor(Math.random() * 2),
    reputation,
    blurb: coachBlurb(reputation),
  };
}

export function buildTeamCoach(city: string, name: string): Coach {
  const template = getTeamParodyCoach(city, name);
  const { devRating, playoffRating } = coachRatingsFromTemplate(
    template ?? { firstName: 'Marcus', lastName: 'Ellison', tier: 'solid' },
  );
  const traits = coachTraits(devRating, playoffRating);
  const coachName = template ? coachParodyName(template) : 'Marcus Ellison';

  return {
    id: uid('coach'),
    name: coachName,
    offensiveSystem: 'Motion-heavy, pace-and-space',
    defensiveSystem: 'Switch-heavy, disciplined help',
    ...traits,
    devRating,
    playoffRating,
    contractYearsRemaining: 2,
    annualSalary: roundSalary(2_500_000 + devRating * 45_000 + playoffRating * 35_000),
  };
}

export function generateCoachMarket(count = 5, excludeName?: string): CoachCandidate[] {
  const salt = Math.floor(Math.random() * 40);
  const templates = pickCoachMarketParodies(excludeName, count, salt);
  return templates
    .map((template) => candidateFromTemplate(template))
    .sort((a, b) => b.playoffRating + b.devRating - (a.playoffRating + a.devRating));
}

export function fireCoach(franchise: Franchise): Franchise {
  const firedName = franchise.coach.name;

  return {
    ...franchise,
    coach: {
      ...franchise.coach,
      name: '(Interim) Assistant Staff',
      devRating: Math.max(55, franchise.coach.devRating - 18),
      playoffRating: Math.max(50, franchise.coach.playoffRating - 15),
      lockerRoom: 'Concerned',
      starRelationship: 'Frustrated',
    },
    jobSecurity: Math.max(5, franchise.jobSecurity - 8),
    lockerRoom: 'Concerned',
    starHappiness: franchise.starHappiness === 'Happy' ? 'Stable' : 'Frustrated',
    coachMarket: franchise.coachMarket.length
      ? franchise.coachMarket
      : generateCoachMarket(5, firedName.includes('Interim') ? undefined : firedName),
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Fired ${firedName}. The locker room is watching who you hire next.`,
        type: 'firing',
      },
      ...franchise.memory,
    ],
  };
}

export function hireCoach(franchise: Franchise, candidateId: string): { franchise: Franchise; message: string } {
  const candidate = franchise.coachMarket.find((c) => c.id === candidateId);
  if (!candidate) return { franchise, message: 'Candidate unavailable.' };

  const next: Franchise = {
    ...franchise,
    coach: {
      id: candidate.id,
      name: candidate.name,
      offensiveSystem: candidate.offensiveSystem,
      defensiveSystem: candidate.defensiveSystem,
      strengths: candidate.strengths,
      weaknesses: candidate.weaknesses,
      lockerRoom: 'Stable',
      starRelationship: candidate.reputation === 'Elite' ? 'Stable' : 'Concerned',
      devRating: candidate.devRating,
      playoffRating: candidate.playoffRating,
      contractYearsRemaining: candidate.askingYears,
      annualSalary: roundSalary(2_500_000 + candidate.devRating * 45_000 + candidate.playoffRating * 35_000),
    },
    coachMarket: franchise.coachMarket.filter((c) => c.id !== candidateId),
    jobSecurity: Math.min(99, franchise.jobSecurity + (candidate.reputation === 'Elite' ? 6 : 2)),
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Hired ${candidate.name} (${candidate.reputation} reputation) on a ${candidate.askingYears}-year deal.`,
        type: 'milestone',
      },
      ...franchise.memory,
    ],
  };

  return {
    franchise: next,
    message: `${candidate.name} takes the sideline. ${candidate.blurb}`,
  };
}
