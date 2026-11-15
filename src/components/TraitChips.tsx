import { useState } from 'react';
import type { PlayerTrait } from '../types/game';
import { playerTraits, TRAITS } from '../engine/personality';

/** Personality chips. Tap one to see what it does (title tooltips don't exist on phones). */
export function TraitChips({
  subject,
}: {
  subject: { id: string; age: number; overall: number; traits?: PlayerTrait[] };
}) {
  const traits = playerTraits(subject);
  const [open, setOpen] = useState<PlayerTrait | null>(null);
  if (!traits.length) return null;
  return (
    <div className="trait-row">
      <div className="trait-row-chips">
        {traits.map((t) => (
          <button
            key={t}
            type="button"
            className={`trait-pill trait-pill--${TRAITS[t].tone} ${open === t ? 'is-open' : ''}`}
            aria-expanded={open === t}
            title={TRAITS[t].short}
            onClick={() => setOpen(open === t ? null : t)}
          >
            {TRAITS[t].label}
          </button>
        ))}
      </div>
      {open && <p className="trait-row-note">{TRAITS[open].short}</p>}
    </div>
  );
}
