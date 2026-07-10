'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import type { PresalesRecord } from '@/lib/types';
import { fetchRecords, logout } from '@/lib/api';
import Tracker from './Tracker';
import TrackerV2 from './TrackerV2';
import ImportTab from './ImportTab';
import BulkJD from './BulkJD';
import SalesForm from './SalesForm';
import Dashboard from './Dashboard';
import HubspotTab from './HubspotTab';
import RecordModal from './RecordModal';
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog';
import OutlookConnect from './OutlookConnect';
import RecentRequests from './RecentRequests';
import type { RecordInput } from '@/lib/types';

type Tab =
  | 'tracker'
  | 'tracker-v2'
  | 'recent-requests'
  | 'import'
  | 'bulkjd'
  | 'salesform'
  | 'dashboard'
  | 'hubspot';

const TABS: { id: Tab; label: string; hideInNav?: boolean }[] = [
  { id: 'recent-requests', label: 'Recent Requests' },
  { id: 'tracker-v2', label: 'All Requests' },
  { id: 'tracker', label: 'All Requests (v1)', hideInNav: true },
  { id: 'import', label: 'Import Excel', hideInNav: true },
  { id: 'bulkjd', label: 'Bulk JD Upload', hideInNav: true },
  { id: 'salesform', label: 'Sales Form', hideInNav: true },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'hubspot', label: 'HubSpot' },
];

export default function App() {
  const router = useRouter();
  const [records, setRecords] = useState<PresalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('tracker-v2');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState<PresalesRecord | null>(null);
  const [modalInitial, setModalInitial] = useState<Partial<RecordInput> | undefined>(undefined);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentRefreshTick, setRecentRefreshTick] = useState(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await fetchRecords());
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const showToast = useCallback((msg: string, type: '' | 'ok' | 'err' = '') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setConfirmState({ opts, resolve })),
    [],
  );

  function resolveConfirm(v: boolean) {
    confirmState?.resolve(v);
    setConfirmState(null);
  }

  function openModal(record: PresalesRecord | null) {
    setModalRecord(record);
    setModalInitial(undefined);
    setPendingSourceId(null);
    setModalOpen(true);
  }

  function openModalFromRecent(initial: Partial<RecordInput>, sourceId: string) {
    setModalRecord(null);
    setModalInitial(initial);
    setPendingSourceId(sourceId);
    setModalOpen(true);
  }

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/recent-requests');
      const data = await res.json();
      if (data.ok) setPendingCount(data.items?.length ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const t = window.setInterval(fetchPendingCount, 60_000);
    return () => window.clearInterval(t);
  }, [fetchPendingCount]);

  async function doLogout() {
    await logout();
    router.replace('/login');
    router.refresh();
  }

  function exportExcel() {
    if (!records.length) {
      showToast('Nothing to export.', 'err');
      return;
    }
    const aoa: (string | number)[][] = [
      ['Date', 'Request From', 'Customer', 'Status', 'Assessment', 'QB Topics', 'Account', 'TARA', 'JD Files', 'Notes'],
    ];
    records.forEach((r) => {
      const jd = r.jd_files.map((f) => f.name).join(', ');
      if (!r.assessments.length) {
        aoa.push([r.date, r.person, r.customer, r.status, '', '', r.account, r.tara, jd, r.notes]);
      } else {
        r.assessments.forEach((a, i) => {
          if (i === 0)
            aoa.push([r.date, r.person, r.customer, r.status, a.name, a.qb, r.account, r.tara, jd, r.notes]);
          else aoa.push(['', '', '', '', a.name, a.qb, '', '', '', '']);
        });
      }
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [12, 18, 20, 20, 32, 38, 26, 16, 28, 28].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presales Tracker');
    XLSX.writeFile(wb, 'Presales_Tracker.xlsx');
  }

  const persons = [...new Set(records.map((r) => r.person.trim()).filter(Boolean))].sort();
  const goToTab = (t: string) => setTab(t as Tab);

  return (
    <div className="app">
      <header className="hdr">
        <div className="logo">
          <img
            src="/imocha-logo.jpeg"
            alt="iMocha"
            className="logo-img"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="logo-divider" aria-hidden="true">/</span>
          <span className="logo-product">Presales Tracker</span>
        </div>
        <div className="hdr-right">
          <button className="btn btn-p" onClick={() => openModal(null)}>
            + New Request
          </button>
          <button className="btn" onClick={exportExcel}>
            ↓ Excel
          </button>
          <button className="btn" onClick={reload}>
            ↻ Refresh
          </button>
          <OutlookConnect
            showToast={showToast}
            onPollComplete={() => {
              fetchPendingCount();
              setRecentRefreshTick((t) => t + 1);
            }}
          />
          <button className="btn btn-d" onClick={doLogout}>
            ⎋ Log out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.filter((t) => !t.hideInNav).map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'recent-requests' && pendingCount > 0 && (
              <span className="tab-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="main">
        {loading && records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <span className="spinner" />
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              Loading records…
            </div>
          </div>
        ) : error && records.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid #f5c6c2',
              borderRadius: 10,
              padding: 24,
              maxWidth: 560,
              margin: '24px auto',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>
              ⚠️ Could not load records
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              {error}
            </div>
            <button className="btn btn-p" onClick={reload}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {tab === 'tracker' && (
              <Tracker
                records={records}
                reload={reload}
                showToast={showToast}
                confirm={confirm}
                onEdit={(r) => openModal(r)}
              />
            )}
            {tab === 'tracker-v2' && (
              <TrackerV2
                records={records}
                reload={reload}
                showToast={showToast}
                confirm={confirm}
                onEdit={(r) => openModal(r)}
              />
            )}
            {tab === 'recent-requests' && (
              <RecentRequests
                showToast={showToast}
                onAddToTracker={openModalFromRecent}
                refreshTick={recentRefreshTick}
              />
            )}
            {tab === 'import' && (
              <ImportTab
                records={records}
                reload={reload}
                showToast={showToast}
                goToTab={goToTab}
              />
            )}
            {tab === 'bulkjd' && (
              <BulkJD records={records} reload={reload} showToast={showToast} />
            )}
            {tab === 'salesform' && (
              <SalesForm
                records={records}
                reload={reload}
                showToast={showToast}
                goToTab={goToTab}
              />
            )}
            {tab === 'dashboard' && <Dashboard records={records} showToast={showToast} />}
            {tab === 'hubspot' && <HubspotTab />}
          </>
        )}
      </main>

      {modalOpen && (
        <RecordModal
          record={modalRecord}
          persons={persons}
          reload={reload}
          showToast={showToast}
          onClose={() => setModalOpen(false)}
          initial={modalInitial}
          onSaved={async () => {
            if (pendingSourceId) {
              try {
                await fetch(`/api/recent-requests/${pendingSourceId}/mark-processed`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ processedRecordId: null }),
                });
              } catch {
                // ignore — record was saved successfully; the source will just remain pending
              }
              setRecentRefreshTick((t) => t + 1);
              fetchPendingCount();
            }
          }}
        />
      )}

      {confirmState && <ConfirmDialog opts={confirmState.opts} onResolve={resolveConfirm} />}

      {toast && (
        <div className="toast-wrap">
          <div className={'toast ' + toast.type}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
