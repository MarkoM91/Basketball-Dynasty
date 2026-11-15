/**
 * Game stories for the user's games: quarter-by-quarter scores that add up exactly to the final,
 * a turning point, and a headline based on what HAPPENED (not on the pre-game talent gap, which
 * made every comfortable win read "Starters dominated — bench sealed it in the fourth").
 */

export type QuarterLine = [number, number]; // [us, them]

export interface GameStory {
  quarters: QuarterLine[];
  headline: string;
  turningPoint: string;
}

const QUARTER_NAMES = ['1st', '2nd', '3rd', '4th'];

function randInt(min: number, max: number, rnd: () => number): number {
  return Math.floor(min + rnd() * (max - min + 1));
}

function pick<T>(items: T[], rnd: () => number): T {
  return items[Math.floor(rnd() * items.length)];
}

type Script = 'comeback' | 'collapse' | 'steady';

/** Split a final score into four quarters that follow a script and sum exactly to the final. */
function buildQuarters(teamScore: number, oppScore: number, script: Script, rnd: () => number): QuarterLine[] {
  const margin = teamScore - oppScore;
  // Quarter margins d1..d3; d4 absorbs the rest so the total is exact.
  let firstThree: number[];
  if (script === 'comeback') {
    const deficit = randInt(6, 14, rnd);
    firstThree = [-randInt(2, 6, rnd), -randInt(1, 5, rnd)];
    firstThree.push(-deficit - firstThree[0] - firstThree[1]);
  } else if (script === 'collapse') {
    const lead = randInt(6, 12, rnd);
    firstThree = [randInt(2, 6, rnd), randInt(1, 5, rnd)];
    firstThree.push(lead - firstThree[0] - firstThree[1]);
  } else {
    firstThree = [0, 1, 2].map(() => Math.round(margin / 4 + (rnd() - 0.5) * 12));
  }

  const ours = [0, 1, 2].map(() => Math.round(teamScore / 4 + (rnd() - 0.5) * 8));
  ours.push(teamScore - ours.reduce((a, b) => a + b, 0));
  const theirs = ours.slice(0, 3).map((q, i) => q - firstThree[i]);
  theirs.push(oppScore - theirs.reduce((a, b) => a + b, 0));

  // Keep every quarter in a believable range; if not, fall back to an even split.
  const ok = [...ours, ...theirs].every((q) => q >= 12 && q <= 46);
  if (!ok) {
    const even = (total: number) => {
      const q = [0, 1, 2].map(() => Math.round(total / 4));
      q.push(total - q[0] - q[1] - q[2]);
      return q;
    };
    const a = even(teamScore);
    const b = even(oppScore);
    return a.map((q, i) => [q, b[i]] as QuarterLine);
  }
  return ours.map((q, i) => [q, theirs[i]] as QuarterLine);
}

export function buildGameStory(
  teamScore: number,
  oppScore: number,
  opponent: string,
  winChance: number | undefined,
  rnd: () => number = Math.random,
): GameStory {
  const won = teamScore > oppScore;
  const margin = teamScore - oppScore;
  const abs = Math.abs(margin);

  let script: Script = 'steady';
  if (won && abs <= 14 && rnd() < 0.08) script = 'comeback';
  else if (!won && abs <= 12 && rnd() < 0.08) script = 'collapse';

  const quarters = buildQuarters(teamScore, oppScore, script, rnd);
  const after3 = quarters.slice(0, 3).reduce((s, [a, b]) => s + a - b, 0);
  const actualScript: Script =
    won && after3 < 0 ? 'comeback' : !won && after3 > 0 ? 'collapse' : 'steady';

  // Turning point: the quarter that swung it most in the winner's favour.
  const swings = quarters.map(([a, b]) => (won ? a - b : b - a));
  const tpIndex = swings.indexOf(Math.max(...swings));
  const [tpUs, tpThem] = quarters[tpIndex];
  const turningPoint = won
    ? `Won the ${QUARTER_NAMES[tpIndex]} ${tpUs}–${tpThem}`
    : `Lost the ${QUARTER_NAMES[tpIndex]} ${tpUs}–${tpThem}`;

  const team = opponent.split(' ').slice(-1)[0];
  const upsetWin = won && winChance !== undefined && winChance < 35;
  const upsetLoss = !won && winChance !== undefined && winChance > 70;

  let headline: string;
  if (upsetWin) headline = pick([`Upset! Stunned the ${team}`, `Nobody gave you a chance — and you won`], rnd);
  else if (upsetLoss) headline = pick([`Upset loss to the ${team}`, `Should have won this one`], rnd);
  else if (actualScript === 'comeback') headline = `Came back from ${Math.abs(after3)} down after three`;
  else if (actualScript === 'collapse') headline = `Blew a ${after3}-point lead in the 4th`;
  else if (won && abs >= 18) headline = pick([`Rout of the ${team}`, 'Never in doubt', `Ran the ${team} off the floor`], rnd);
  else if (!won && abs >= 18) headline = pick([`Blown out by the ${team}`, 'Never in it', 'A night to forget'], rnd);
  else if (abs <= 3) headline = won ? pick(['Survived a nail-biter', 'Held on at the buzzer'], rnd) : pick(['Fell short in a one-possession game', 'So close'], rnd);
  else if (won) {
    const big = swings[tpIndex] >= 8;
    const q = QUARTER_NAMES[tpIndex];
    const pool =
      tpIndex === 3 ? ['Closed it out in the 4th', 'Pulled away late', `Strong finish against the ${team}`]
      : tpIndex === 0 ? ['Fast start carried them', 'Set the tone early', `Jumped on the ${team} from the tip`]
      : big ? [`Took control in the ${q}`, `A ${q}-quarter run decided it`, `Broke it open in the ${q}`]
      : abs >= 12 ? ['Comfortable win', `Handled the ${team}`, 'Business as usual']
      : ['Gritty win', `Ground out a win over the ${team}`, 'Did enough'];
    headline = pick(pool, rnd);
  } else {
    const q = QUARTER_NAMES[tpIndex];
    const pool =
      tpIndex === 0 ? ['Slow start, never caught up', 'Dug an early hole']
      : tpIndex === 3 ? [`Faded in the 4th`, `Couldn't close against the ${team}`]
      : abs >= 12 ? [`Outplayed by the ${team}`, 'Not their night']
      : [`Couldn't answer in the ${q}`, `Came up short against the ${team}`, 'One bad quarter cost them'];
    headline = pick(pool, rnd);
  }

  return { quarters, headline, turningPoint };
}
