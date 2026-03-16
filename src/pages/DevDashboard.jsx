import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { useEvents } from '../hooks/useEvents';
import { downloadJSON, downloadCSV, downloadPDF } from '../utils/download';

const AUTO_HIT_SECONDS = 300; // 5 minutes

// ── Syntax highlight ────────────────────────────────────────────────────────────
function highlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (m) => {
        const cls = /^"/.test(m)
          ? (/:$/.test(m) ? 'j-key' : 'j-str')
          : /true|false/.test(m) ? 'j-bool'
          : /null/.test(m) ? 'j-null'
          : 'j-num';
        return `<span class="${cls}">${m}</span>`;
      }
    );
}

function statusCls(code) {
  return code >= 500 ? 'pill-err' : code >= 400 ? 'pill-warn' : 'pill-ok';
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getRaw(ev) {
  return typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data, null, 2);
}

function numericChartData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data)
    .filter(([, v]) => typeof v === 'number' && isFinite(v))
    .map(([key, value]) => ({ key: key.replace(/_/g, ' '), value }));
}

// ── DownloadMenu (reusable) ────────────────────────────────────────────────────
function DownloadMenu({ events, filename = 'events', label = '⬇ Download' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DevDashboard() {
  const { events, streamStatus, clearEvents } = useEvents();

  const [selected, setSelected]       = useState(null);
  const [inputUrl, setInputUrl]       = useState('');
  const [defaultUrl, setDefaultUrl]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [toast, setToast]             = useState(null);
  const [autoActive, setAutoActive]   = useState(false);
  const [secsLeft, setSecsLeft]       = useState(AUTO_HIT_SECONDS);

  const activeUrlRef  = useRef('');
  const secsLeftRef   = useRef(AUTO_HIT_SECONDS);
  const toastTimer    = useRef(null);

  // Auto-select latest event
  useEffect(() => {
    if (events.length > 0) setSelected(events[events.length - 1]);
  }, [events]);

  // Load health/default URL
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => { if (d.apiUrl) { setDefaultUrl(d.apiUrl); } })
      .catch(() => {});
  }, []);

  // 5-minute auto-hit countdown
  useEffect(() => {
    if (!autoActive) return;
    const t = setInterval(() => {
      secsLeftRef.current -= 1;
      setSecsLeft(secsLeftRef.current);
      if (secsLeftRef.current <= 0) {
        doTrigger(activeUrlRef.current, true);
        secsLeftRef.current = AUTO_HIT_SECONDS;
        setSecsLeft(AUTO_HIT_SECONDS);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [autoActive]);

  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  const doTrigger = useCallback(async (url, isAuto = false) => {
    const target = url || inputUrl.trim() || defaultUrl;
    if (!target) { showToast('Enter a URL first', 'error'); return; }

    if (!isAuto) setLoading(true);
    try {
      const res  = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Trigger failed');
      showToast(isAuto ? '⏱ Auto-hit ✓' : 'Response captured ✓', 'ok');

      // First manual hit → start auto-hit with that URL
      if (!isAuto) {
        activeUrlRef.current  = target;
        secsLeftRef.current   = AUTO_HIT_SECONDS;
        setSecsLeft(AUTO_HIT_SECONDS);
        setAutoActive(true);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (!isAuto) setLoading(false);
    }
  }, [inputUrl, defaultUrl]);

  const cdDisplay = (() => {
    const m = Math.floor(secsLeft / 60);
    const s = String(secsLeft % 60).padStart(2, '0');
    return `${m}:${s}`;
  })();

  const chartData = selected ? numericChartData(selected.data) : [];

  return (
    <div className="shell">
      {/* ── TOPBAR ── */}
      <div className="topbar">
        <div className="logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          API Stream
        </div>

        <div className={`pulse-dot${streamStatus === 'live' ? ' live' : ''}`} />
        <span className="stream-status" style={{ color: streamStatus === 'live' ? 'var(--ok)' : 'var(--warn)' }}>
          {streamStatus === 'live' ? 'LIVE' : 'RECONNECTING…'}
        </span>

        <div className="topbar-right">
          {autoActive && (
            <div className="refresh-info">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Auto-hit in <span className="countdown">{cdDisplay}</span>
            </div>
          )}
          <div className="count-badge">Events: <span>{events.length}</span></div>
          <DownloadMenu events={events} filename="all-events" label="⬇ Export All" />
          <Link to="/viewer" className="btn-viewer" target="_blank">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Client View
          </Link>
          <button className="btn-ghost" onClick={() => {
            if (confirm('Clear the dashboard view?')) {
              clearEvents();
              setSelected(null);
              setAutoActive(false);
            }
          }}>
            Clear UI
          </button>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className="workspace">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="trigger-panel">
            <div className="panel-label">// Trigger API</div>

            <div className="input-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doTrigger()}
                placeholder={defaultUrl || 'https://api.example.com/data'}
              />
            </div>

            {autoActive && (
              <div className="auto-hit-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />
                  Auto-hit active · next in <strong>{cdDisplay}</strong>
                </div>
                <button
                  style={{ marginTop: 5, fontSize: 11, color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setAutoActive(false)}
                >
                  Stop auto-hit
                </button>
              </div>
            )}

            <button className="btn-hit" disabled={loading} onClick={() => doTrigger()}>
              {loading
                ? <><span className="spinner" /> Fetching…</>
                : <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                    Hit API
                  </>
              }
            </button>
          </div>

          {/* Event list */}
          <div className="events-scroll">
            <div className="panel-label" style={{ padding: '4px 4px 10px' }}>// Event Log</div>
            {events.length === 0 ? (
              <div className="empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <p>No events yet.<br />Hit the API to see results here.</p>
              </div>
            ) : (
              <div className="events-list">
                {[...events].reverse().map((ev) => {
                  const uid = ev.id != null ? `id-${ev.id}` : `ts-${ev.timestamp}`;
                  const isActive = selected && (
                    (selected.id != null && selected.id === ev.id) ||
                    selected.timestamp === ev.timestamp
                  );
                  return (
                    <div
                      key={uid}
                      className={`event-card${isActive ? ' active' : ''}`}
                      onClick={() => setSelected(ev)}
                    >
                      <div className="card-top">
                        <span className={`status-pill ${statusCls(ev.status)}`}>{ev.status}</span>
                        <span className="card-time">{fmtTime(ev.timestamp)}</span>
                      </div>
                      <div className="card-preview">
                        {(typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)).slice(0, 55)}…
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* DETAIL PANE */}
        <section className="detail-pane">
          {!selected ? (
            <div className="detail-empty">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <h2>No event selected</h2>
              <p>Enter a URL above and click <strong>Hit API</strong>. The response will stream here in realtime.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="detail-header">
                <span className={`status-pill ${statusCls(selected.status)}`}>{selected.status}</span>
                <span className="detail-ts">{new Date(selected.timestamp).toLocaleString()}</span>
                <span className="detail-ctype">{selected.contentType || '—'}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <DownloadMenu events={[selected]} filename="event" label="⬇ Download" />
                  <button
                    className="btn-copy"
                    onClick={() => {
                      navigator.clipboard.writeText(getRaw(selected));
                      showToast('Copied!', 'ok');
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </div>

              <div className="detail-body">
                {/* Bar chart for numeric fields */}
                {chartData.length >= 2 && (
                  <div className="chart-card">
                    <div className="chart-card-title">Numeric Fields at a Glance</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="key" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* JSON viewer */}
                <pre
                  className="json-viewer"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      try {
                        const parsed = typeof selected.data === 'string'
                          ? JSON.parse(selected.data)
                          : selected.data;
                        return highlight(JSON.stringify(parsed, null, 2));
                      } catch {
                        return getRaw(selected).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                      }
                    })()
                  }}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.type} show`}>
          <span className="tdot" />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
