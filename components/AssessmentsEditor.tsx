'use client';

import type { Assessment } from '@/lib/types';

/** Reusable editable list of assessments (name + QB topics). */
export default function AssessmentsEditor({
  value,
  onChange,
}: {
  value: Assessment[];
  onChange: (v: Assessment[]) => void;
}) {
  function update(i: number, patch: Partial<Assessment>) {
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...value, { name: '', qb: '' }]);
  }

  return (
    <div>
      {value.map((a, i) => (
        <div className="assess-item" key={i}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              className="fi"
              placeholder="Assessment name"
              value={a.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              className="fi"
              placeholder="QB topics"
              value={a.qb}
              onChange={(e) => update(i, { qb: e.target.value })}
              style={{ fontSize: 12 }}
            />
          </div>
          <button type="button" className="rb" onClick={() => remove(i)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="ab" onClick={add}>
        + Add Assessment
      </button>
    </div>
  );
}
