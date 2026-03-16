import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { downloadJSON, downloadCSV, downloadPDF } from '../utils/download';

const REFRESH_S = 300; // 5 minutes
const PIE_COLORS = ['#16a34a', '#d97706', '#dc2626', '#94a3b8'];

// ── Smart value formatter ──────────────────────────────────────────────────────
function fmtVal(val) {
  if (val === null || val === undefined) return { text: '—', cls: '' };
  if (typeof val === 'boolean') return { text: val ? '✓ Yes' : '✗ No', cls: val ? 'bool-t' : 'bool-f' };
  if (typeof val === 'number')  return { text: val.toLocaleString(), cls: 'num' };
  if (typeof val === 'string') {
    if (/^https?:\/\//.test(val)) return { text: val, cls: 'url', isUrl: true };
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      try { return { text: new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), cls: '' }; } catch {}
    }
    return { text: val, cls: '' };
  }
  if (typeof val === 'object') return { text: JSON.stringify(val).slice(0, 80), cls: '' };
  return { text: String(val), cls: '' };
}

function fmtKey(k) {
  return String(k).replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function statusCls(code) {
  return code >= 500 ? 'pill-err' : code >= 400 ? 'pill-warn' : 'pill-ok';
}

// ── Smart data renderer ────────────────────────────────────────────────────────
function SmartData({ data }) {
  if (data === null || data === undefined) return <div className="plain-value">null</div>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="plain-value">[ ] — empty array</div>;
    if (typeof data[0] === 'object' && data[0] !== null) return <ArrayTable arr={data} />;
    return <PrimitiveList arr={data} />;
  }

  if (typeof data === 'object') return <KVGrid obj={data} />;

  return <div className="plain-value">{String(data)}</div>;
}

function KVGrid({ obj }) {
  return (
    <div className="kv-grid">
      {Object.entries(obj).map(([k, v]) => {
        const { text, cls, isUrl } = fmtVal(v);
        return (
          <div className="kv-item" key={k}>
            <div className="kv-key">{fmtKey(k)}</div>
            <div className={`kv-val ${cls}`}>
              {isUrl ? <a href={text} target="_blank" rel="noopener noreferrer">{text.length > 50 ? text.slice(0, 47) + '…' : text}</a> : text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArrayTable({ arr }) {
  const keys = [...new Set(arr.flatMap((o) => Object.keys(o || {})))];
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{keys.map((k) => <th key={k}>{fmtKey(k)}</th>)}</tr>
        </thead>
        <tbody>
          {arr.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => {
                const { text, cls, isUrl } = fmtVal(row[k]);
                return (
                  <td key={k} className={cls} title={String(row[k] ?? '')}>
                    {isUrl ? <a href={text} target="_blank" rel="noopener noreferrer">{text.length > 40 ? text.slice(0, 37) + '…' : text}</a> : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrimitiveList({ arr }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>#</th><th>Value</th></tr></thead>
        <tbody>
          {arr.map((v, i) => <tr key={i}><td>{i + 1}</td><td>{String(v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

// ── Numeric bar chart from object data ─────────────────────────────────────────
function NumericChart({ data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const pts = Object.entries(data)
    .filter(([, v]) => typeof v === 'number' && isFinite(v))
    .map(([key, value]) => ({ key: fmtKey(key), value }));
  if (pts.length < 2) return null;
  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <div className="chart-card-title">Numeric Fields</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={pts} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
          <RTooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
          <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Collapsible event panel ────────────────────────────────────────────────────
function EventPanel({ ev, index, total, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`event-panel${!open ? ' collapsed' : ''}`}>
      <div className="event-panel-hdr" onClick={() => setOpen((o) => !o)}>
        <span className="event-num">#{total - index}</span>
        <span className={`status-pill ${statusCls(ev.status)}`}>{ev.status}</span>
        <span className="event-time">{new Date(ev.timestamp).toLocaleString()}</span>
        {ev.contentType && <span className="event-ctype">{ev.contentType}</span>}
        <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <div className="event-panel-body">
          <SmartData data={ev.data} />
          <NumericChart data={ev.data} />
        </div>
      )}
    </div>
  );
}

// ── Download menu ──────────────────────────────────────────────────────────────
function DownloadMenu({ events, filename = 'events', label = '⬇ Download' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="dropdown-wrap" ref={ref}>
      <button className="btn-copy" onClick={() => setOpen((o) => !o)}>{label}</button>
      {open && (
        <div className="dropdown-menu">
          <button onClick={() => { downloadJSON(events, filename); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            JSON
          </button>
          <button onClick={() => { downloadCSV(events, filename); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            CSV
          </button>
          <button onClick={() => { downloadPDF(events, filename); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Charts tab ─────────────────────────────────────────────────────────────────
function ChartsTab({ events }) {
  if (!events.length) return <div className="no-data"><h3>No data</h3><p>Hit an API first.</p></div>;

  const statusDist = [
    { name: '2xx Success', value: events.filter((e) => e.status >= 200 && e.status < 300).length },
    { name: '4xx Client',  value: events.filter((e) => e.status >= 400 && e.status < 500).length },
    { name: '5xx Server',  value: events.filter((e) => e.status >= 500).length },
    { name: 'Other',       value: events.filter((e) => e.status < 200 || (e.status >= 300 && e.status < 400)).length }
  ].filter((d) => d.value > 0);

  const timeline = events.map((e) => ({
    time:   new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: e.status
  }));

  const latest = events[events.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Pie chart */}
        <div className="chart-card">
          <div className="chart-card-title">Response Status Distribution</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <RTooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
              <Legend iconSize={12} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Line chart — status over time */}
        <div className="chart-card">
          <div className="chart-card-title">Status Code Over Time</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeline} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={45} domain={['auto', 'auto']} />
              <RTooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
              <Line type="monotone" dataKey="status" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Numeric fields from latest event */}
      {latest && <NumericChart data={latest.data} />}
    </div>
  );
}

// ── Main ClientViewer ──────────────────────────────────────────────────────────
export default function ClientViewer() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [tab, setTab]             = useState('latest');
  const [secsLeft, setSecsLeft]   = useState(REFRESH_S);
  const [toast, setToast]         = useState(null);

  const secsRef   = useRef(REFRESH_S);
  const toastTimer = useRef(null);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch('/api/events');
      const data = await res.json();
      setEvents(data.events || []);
      setUpdatedAt(new Date());
      if (!silent) showToast('Data refreshed');
    } catch {
      if (!silent) showToast('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchEvents(false); }, [fetchEvents]);

  // 5-minute auto-refresh countdown
  useEffect(() => {
    const t = setInterval(() => {
      secsRef.current -= 1;
      setSecsLeft(secsRef.current);
      if (secsRef.current <= 0) {
        fetchEvents(true);
        secsRef.current = REFRESH_S;
        setSecsLeft(REFRESH_S);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  const cdDisplay = (() => {
    const m = Math.floor(secsLeft / 60);
    const s = String(secsLeft % 60).padStart(2, '0');
    return `${m}:${s}`;
  })();

  const ok   = events.filter((e) => e.status >= 200 && e.status < 300).length;
  const warn = events.filter((e) => e.status >= 400 && e.status < 500).length;
  const err  = events.filter((e) => e.status >= 500).length;
  const pct  = events.length ? Math.round((ok / events.length) * 100) : 0;
  const latest = events[events.length - 1];

  return (
    <div className="viewer-page">
      {/* ── TOPBAR ── */}
      <div className="viewer-topbar">
        <div className="viewer-logo">
          <div className="viewer-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          API Data Viewer
        </div>

        <div className="viewer-topbar-right">
          {updatedAt && (
            <div className="last-updated">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Updated: <strong>{updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
            </div>
          )}

          <div className="countdown-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {cdDisplay}
            <div className="cd-bar-wrap">
              <div className="cd-bar" style={{ width: `${(secsLeft / REFRESH_S) * 100}%` }} />
            </div>
          </div>

          <DownloadMenu events={events} filename="api-events-report" label="⬇ Download All" />

          <button
            className="btn-copy"
            onClick={() => { secsRef.current = REFRESH_S; setSecsLeft(REFRESH_S); fetchEvents(false); }}
          >
            Refresh Now
          </button>

          <Link to="/" className="btn-dev-link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Dev View
          </Link>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="viewer-body">

        {/* Summary cards */}
        <div className="summary-row">
          <div className="stat-card info">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-sub">captured responses</div>
          </div>
          <div className="stat-card ok">
            <div className="stat-label">Successful</div>
            <div className="stat-value">{ok}</div>
            <div className="stat-sub">{events.length ? `${pct}% success rate` : 'HTTP 2xx'}</div>
          </div>
          <div className="stat-card warn">
            <div className="stat-label">Client Errors</div>
            <div className="stat-value">{warn}</div>
            <div className="stat-sub">HTTP 4xx responses</div>
          </div>
          <div className="stat-card err">
            <div className="stat-label">Server Errors</div>
            <div className="stat-value">{err}</div>
            <div className="stat-sub">HTTP 5xx responses</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {['latest', 'history', 'charts'].map((t) => (
            <button
              key={t}
              className={`tab-btn${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'latest' ? 'Latest Response' : t === 'history' ? 'All Events' : 'Charts'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading ? (
          <div className="viewer-loading">
            <div className="loading-ring" />
            <span>Loading data…</span>
          </div>
        ) : !events.length ? (
          <div className="no-data">
            <h3>No data yet</h3>
            <p>Go to the <Link to="/">developer dashboard</Link>, enter a URL, and click <strong>Hit API</strong>.</p>
          </div>
        ) : (
          <>
            {/* Latest tab */}
            {tab === 'latest' && latest && (
              <div>
                <div className="section-head">
                  <div className="section-title">
                    Latest Response
                    <span className={`status-pill ${statusCls(latest.status)}`} style={{ marginLeft: 8 }}>{latest.status}</span>
                  </div>
                  <DownloadMenu events={[latest]} filename="latest-event" label="⬇ Download" />
                </div>
                <div className="event-panel">
                  <div className="event-panel-hdr" style={{ cursor: 'default' }}>
                    <span className="event-time">{new Date(latest.timestamp).toLocaleString()}</span>
                    {latest.contentType && <span className="event-ctype">{latest.contentType}</span>}
                  </div>
                  <div className="event-panel-body">
                    <SmartData data={latest.data} />
                    <NumericChart data={latest.data} />
                  </div>
                </div>
              </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
              <div>
                <div className="section-head">
                  <div className="section-title">All Events ({events.length})</div>
                  <DownloadMenu events={events} filename="all-events" label="⬇ Download All" />
                </div>
                {[...events].reverse().map((ev, i) => (
                  <EventPanel
                    key={ev.id ?? ev.timestamp}
                    ev={ev}
                    index={i}
                    total={events.length}
                    defaultOpen={i === 0}
                  />
                ))}
              </div>
            )}

            {/* Charts tab */}
            {tab === 'charts' && (
              <div>
                <div className="section-head">
                  <div className="section-title">Visualizations</div>
                </div>
                <ChartsTab events={events} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="viewer-toast show">
          <span className="vtdot" />
          {toast}
        </div>
      )}
    </div>
  );
}
