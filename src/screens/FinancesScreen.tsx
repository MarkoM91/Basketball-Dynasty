import { computeTeamFinances, formatFin } from '../engine/finances';

import { useGameStore } from '../store/gameStore';

import { Panel, ProgressBar } from '../components/UI';



export function FinancesScreen() {

  const { franchise, setScreen, setFinancesPolicy } = useGameStore();

  if (!franchise) return null;



  const ticketBias = franchise.ticketPriceBias ?? 0;

  const scoutingBudget = franchise.scoutingBudget ?? 5;

  const fin = computeTeamFinances(franchise);

  const marginPct = fin.revenue.total > 0 ? Math.round((fin.profit / fin.revenue.total) * 100) : 0;



  return (

    <div className="page">

      <div className="header-bar">

        <div>

          <p className="eyebrow">Team finances</p>

          <h1 className="title-lg">Revenue & expenses</h1>

        </div>

        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>

      </div>



      <Panel accent>

        <div className="stat-grid">

          <div className="stat-cell">

            <div className="stat-label">Projected profit</div>

            <div className={`stat-value ${fin.profit >= 0 ? 'success' : 'danger'}`}>{formatFin(fin.profit)}</div>

          </div>

          <div className="stat-cell">

            <div className="stat-label">Revenue</div>

            <div className="stat-value">{formatFin(fin.revenue.total)}</div>

          </div>

          <div className="stat-cell">

            <div className="stat-label">Expenses</div>

            <div className="stat-value">{formatFin(fin.expenses.total)}</div>

          </div>

          <div className="stat-cell">

            <div className="stat-label">Margin</div>

            <div className="stat-value">{marginPct}%</div>

          </div>

        </div>

        <ProgressBar value={Math.max(0, Math.min(100, 50 + marginPct))} />

      </Panel>



      <Panel accent>

        <p className="eyebrow">Owner controls</p>

        <label className="fin-slider">

          <span>Ticket price vs league default ({ticketBias >= 0 ? '+' : ''}{ticketBias}%)</span>

          <input

            type="range"

            min={-20}

            max={20}

            step={1}

            value={ticketBias}

            onChange={(e) => setFinancesPolicy({ ticketPriceBias: Number(e.target.value) })}

          />

        </label>

        <p className="body" style={{ fontSize: 12, marginTop: 6 }}>

          Higher prices boost short-term cash but can hurt attendance if fans are unhappy.

        </p>

        <label className="fin-slider" style={{ marginTop: 14 }}>

          <span>Scouting & player development budget ({scoutingBudget}/10)</span>

          <input

            type="range"

            min={1}

            max={10}

            step={1}

            value={scoutingBudget}

            onChange={(e) => setFinancesPolicy({ scoutingBudget: Number(e.target.value) })}

          />

        </label>

        <p className="body" style={{ fontSize: 12, marginTop: 6 }}>

          Invest more for sharper rating reports and faster young-player growth.

        </p>

      </Panel>



      <Panel>

        <p className="eyebrow">Revenue</p>

        <div className="analysis-block" style={{ marginTop: 0 }}>

          <div className="analysis-row"><span>Ticket sales</span><strong>{formatFin(fin.revenue.tickets)}</strong></div>

          <div className="analysis-row"><span>Local / national media</span><strong>{formatFin(fin.revenue.media)}</strong></div>

          <div className="analysis-row"><span>Merchandise</span><strong>{formatFin(fin.revenue.merch)}</strong></div>

        </div>

        <p className="body" style={{ marginTop: 10, fontSize: 12 }}>

          Avg attendance {fin.attendance.toLocaleString()} / {fin.capacity.toLocaleString()} · Ticket price ${fin.ticketPrice}

        </p>

      </Panel>



      <Panel>

        <p className="eyebrow">Expenses</p>

        <div className="analysis-block" style={{ marginTop: 0 }}>

          <div className="analysis-row"><span>Player payroll</span><strong>{formatFin(fin.expenses.payroll)}</strong></div>

          <div className="analysis-row"><span>Luxury tax</span><strong>{formatFin(fin.expenses.luxuryTax)}</strong></div>

          <div className="analysis-row"><span>Facilities</span><strong>{formatFin(fin.expenses.facilities)}</strong></div>

          <div className="analysis-row"><span>Scouting / player dev</span><strong>{formatFin(fin.expenses.scouting)}</strong></div>

        </div>

      </Panel>



      <Panel accent>

        <p className="eyebrow">Ownership pressure</p>

        <p className="body">{franchise.ownership.goal}</p>

        <p className="body" style={{ marginTop: 8, fontSize: 12 }}>

          Cash on hand estimate: {formatFin(fin.cashOnHand)} · Job security {franchise.jobSecurity}%

        </p>

      </Panel>

    </div>

  );

}

