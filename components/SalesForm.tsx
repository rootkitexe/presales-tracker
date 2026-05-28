'use client';

import { useState } from 'react';
import type { Assessment, PresalesRecord } from '@/lib/types';
import { STATUS_OPTIONS, TARA_OPTIONS } from '@/lib/constants';
import { createRecords } from '@/lib/api';
import AssessmentsEditor from './AssessmentsEditor';

interface Props {
  records: PresalesRecord[];
  reload: () => Promise<void>;
  showToast: (msg: string, type?: '' | 'ok' | 'err') => void;
  goToTab: (t: string) => void;
}

export default function SalesForm({ records, reload, showToast, goToTab }: Props) {
  const persons = [...new Set(records.map((r) => r.person.trim()).filter(Boolean))].sort();

  const [person, setPerson] = useState('');
  const [customer, setCustomer] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [account, setAccount] = useState('');
  const [tara, setTara] = useState('');
  const [notes, setNotes] = useState('');
  const [assessments, setAssessments] = useState<Assessment[]>([{ name: '', qb: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setPerson('');
    setCustomer('');
    setDate('');
    setStatus('');
    setAccount('');
    setTara('');
    setNotes('');
    setAssessments([{ name: '', qb: '' }]);
    setSuccess(false);
  }

  async function submit() {
    if (!person.trim() || !customer.trim()) {
      showToast('Your name and customer name are required.', 'err');
      return;
    }
    const cleaned = assessments
      .map((a) => ({ name: a.name.trim(), qb: a.qb.trim() }))
      .filter((a) => a.name);
    setSubmitting(true);
    try {
      await createRecords([
        {
          person: person.trim(),
          customer: customer.trim(),
          status,
          date,
          account: account.trim(),
          tara,
          notes: notes.trim(),
          assessments: cleaned,
          jd_files: [],
        },
      ]);
      await reload();
      setSuccess(true);
      showToast('✓ Request submitted to the tracker', 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="form-view">
        <div className="sf-success">
          <div style={{ fontSize: 30, marginBottom: 6 }}>✅</div>
          <h3>Request Submitted!</h3>
          <p style={{ fontSize: 12.5, color: 'var(--success)', marginBottom: 12 }}>
            It&apos;s now in the shared tracker.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-p" onClick={reset}>
              Submit Another
            </button>
            <button className="btn" onClick={() => goToTab('tracker')}>
              View in Tracker
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-view">
      <div className="form-card">
        <div className="form-head">
          <div style={{ fontSize: 28, marginBottom: 6 }}>📝</div>
          <h2>Presales Request Form</h2>
          <p>Submissions save straight into the shared tracker.</p>
        </div>

        <div className="fr2">
          <div className="fr">
            <label className="fl">Your Name *</label>
            <div className="combo-wrap">
              <input
                className="fi"
                list="sf-person-list"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="e.g. Monika Jamdar"
              />
              <datalist id="sf-person-list">
                {persons.map((p) => (
                  <option value={p} key={p} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="fr">
            <label className="fl">Customer Name *</label>
            <input
              className="fi"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="e.g. Frasers Property"
            />
          </div>
        </div>

        <div className="fr2">
          <div className="fr">
            <label className="fl">Date</label>
            <input
              className="fi"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="fr">
            <label className="fl">Status</label>
            <select className="fi" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">— Select —</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="fr2">
          <div className="fr">
            <label className="fl">Account Email</label>
            <input
              className="fi"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="email@domain.com"
            />
          </div>
          <div className="fr">
            <label className="fl">TARA Status</label>
            <select className="fi" value={tara} onChange={(e) => setTara(e.target.value)}>
              <option value="">— Not Requested —</option>
              {TARA_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="fr">
          <label className="fl">Assessments &amp; QB Topics</label>
          <AssessmentsEditor value={assessments} onChange={setAssessments} />
        </div>

        <div className="fr">
          <label className="fl">Notes</label>
          <input
            className="fi"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            className="btn btn-p"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : '📤 Submit Request'}
          </button>
          <button className="btn" onClick={reset} disabled={submitting}>
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
