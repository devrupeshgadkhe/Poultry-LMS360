import React, { useEffect, useState } from 'react';
import { 
  Terminal, 
  Shield, 
  Play, 
  Database, 
  History, 
  RefreshCw, 
  ShieldAlert, 
  Trash2, 
  Globe, 
  Server 
} from 'lucide-react';
import { translations, Language } from '../translations';

export default function DeveloperTools({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  
  // Developer Tools tab navigation
  const [activeDevTab, setActiveDevTab] = useState<'sql' | 'audit' | 'errors'>('sql');

  // SQL State
  const [sql, setSql] = useState('SELECT * FROM Users;');
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);
  const [runningSql, setRunningSql] = useState(false);

  // Audit Logs State
  const [audits, setAudits] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  // JavaScript/Runtime Errors State
  const [jsErrors, setJsErrors] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);

  useEffect(() => {
    fetchAudits();
    fetchErrors();
  }, []);

  const fetchAudits = async () => {
    try {
      setLoadingAudits(true);
      const res = await fetch('/api/audit_logs');
      if (res.ok) {
        setAudits(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudits(false);
    }
  };

  const fetchErrors = async () => {
    try {
      setLoadingErrors(true);
      const res = await fetch('/api/errors');
      if (res.ok) {
        setJsErrors(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch JS errors:', e);
    } finally {
      setLoadingErrors(false);
    }
  };

  const handleClearErrors = async () => {
    if (!window.confirm('Are you sure you want to clear all logged JavaScript and runtime errors?')) return;
    try {
      const res = await fetch('/api/errors', { method: 'DELETE' });
      if (res.ok) {
        setJsErrors([]);
        setExpandedErrorId(null);
      }
    } catch (e) {
      console.error('Failed to purge error logs:', e);
    }
  };

  const handleRunSql = async () => {
    if (!sql.trim()) return;
    try {
      setRunningSql(true);
      setSqlError(null);
      setSqlResult(null);

      const res = await fetch('/api/admin/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': localStorage.getItem('userEmail') || 'admin'
        },
        body: JSON.stringify({ statement: sql })
      });

      const body = await res.json();
      if (!res.ok) {
        setSqlError(body.error || 'SQL statement failed.');
      } else {
        setSqlResult(body || []);
      }
    } catch (err: any) {
      setSqlError(err.message || 'Network failure running SQL');
    } finally {
      setRunningSql(false);
    }
  };

  return (
    <div className="space-y-6" id="dev-tools-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6 sm:h-7 sm:w-7 text-black shrink-0" />
            Developer Console & Logs
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Debug database schemas, inspect live mutation tracking audit trails, or check javascript runtime exception logs.
          </p>
        </div>
      </div>

      {/* Internal Navigation Sub-tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveDevTab('sql')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono border-b-2 tracking-wide whitespace-nowrap smooth-hover ${
            activeDevTab === 'sql'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-850'
          }`}
          id="tab-btn-sql"
        >
          <Database className="h-4 w-4" />
          SQL Terminal & Sandbox
        </button>
        <button
          onClick={() => {
            setActiveDevTab('audit');
            fetchAudits();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono border-b-2 tracking-wide whitespace-nowrap smooth-hover ${
            activeDevTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-850'
          }`}
          id="tab-btn-audit"
        >
          <History className="h-4 w-4" />
          Mutations & Audit Trail ({audits.length})
        </button>
        <button
          onClick={() => {
            setActiveDevTab('errors');
            fetchErrors();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono border-b-2 tracking-wide whitespace-nowrap smooth-hover ${
            activeDevTab === 'errors'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-rose-500'
          }`}
          id="tab-btn-errors"
        >
          <ShieldAlert className={`h-4 w-4 text-rose-600 ${jsErrors.length > 0 ? 'animate-pulse' : ''}`} />
          JS & Runtime Error Logger ({jsErrors.length})
        </button>
      </div>

      {/* Conditional Rendering of active developer view */}
      {activeDevTab === 'sql' && (
        <div className="bg-slate-950 text-slate-100 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4 animate-fade-in" id="sql-prompt-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-indigo-400 f-display flex items-center gap-2">
              <Database className="h-4.5 w-4.5" />
              System Database Terminal Prompt:
            </h3>
            <span className="text-[10px] text-slate-500 font-mono font-semibold">DQL / DML Sandbox</span>
          </div>

          <textarea
            className="w-full bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden min-h-[120px]"
            value={sql}
            onChange={e => setSql(e.target.value)}
            placeholder="write SQL code here..."
          ></textarea>

          <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-slate-800 col-actions flex-wrap gap-2">
            <span className="text-[10px] text-slate-400 italic font-mono">WARNING: Destructive statements can cascadingly deplete database records.</span>
            <button
              onClick={handleRunSql}
              disabled={runningSql}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold font-mono smooth-hover"
              id="run-sql-btn"
            >
              {runningSql ? 'Running...' : t.runQueryBtn}
            </button>
          </div>

          {sqlError && (
            <div className="p-4 bg-red-950/50 border border-red-900/50 text-red-400 font-mono text-xs rounded-2xl shrink-0">
              <b>Error Exception:</b> {sqlError}
            </div>
          )}

          {sqlResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" id="sql-results-viewer">
              <div className="p-3 bg-slate-850/50 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono">
                Command execution results ({sqlResult.length} lines)
              </div>

              <div className="overflow-x-auto max-h-[300px]">
                {sqlResult.length > 0 ? (
                  <table className="w-full text-left text-xs font-mono text-slate-300">
                    <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-800">
                      <tr>
                        {Object.keys(sqlResult[0]).map((key, i) => (
                          <th key={i} className="px-4 py-2">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {sqlResult.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-800/30">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-4 py-2 text-slate-300 max-w-xs truncate" title={String(val)}>{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">Query returned empty set matching execution parameters.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeDevTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-fade-in" id="audit-trail-panel">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-800 font-display flex items-center gap-1.5">
              <History className="h-5 w-5 text-indigo-600" />
              Historical Mutations & Audit Trail Logs
            </h3>
            <button
              onClick={fetchAudits}
              className="p-1 px-2 border border-slate-200 hover:border-slate-400 rounded-lg text-slate-500 hover:text-slate-700 smooth-hover text-xs flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {loadingAudits ? (
            <div className="flex items-center justify-center py-10 font-mono text-xs">Reloading traces...</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-2.5">Timestamp</th>
                    <th className="px-5 py-2.5">User operator</th>
                    <th className="px-5 py-2.5">Trigger action</th>
                    <th className="px-5 py-2.5 col-audit-params">Payload Parameters</th>
                    <th className="px-5 py-2.5">Execution Status</th>
                    <th className="px-5 py-2.5">Exception / Outcome msg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {audits.map(it => (
                    <tr key={it.Id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2 text-slate-500 whitespace-nowrap">{it.Timestamp}</td>
                      <td className="px-5 py-2 font-semibold text-slate-800">{it.UserEmail}</td>
                      <td className="px-5 py-2 font-bold text-slate-705 whitespace-nowrap">{it.Action}</td>
                      <td className="px-5 py-2 text-slate-400 max-w-xs truncate" title={it.Parameters}>{it.Parameters}</td>
                      <td className="px-5 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded-sm uppercase font-bold text-[9px] ${it.Status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {it.Status}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-xs text-slate-600 max-w-sm truncate" title={it.ExceptionMessage || it.OutcomeMessage}>{it.ExceptionMessage || it.OutcomeMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeDevTab === 'errors' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-fade-in" id="js-errors-panel">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-base font-semibold text-slate-800 font-display flex items-center gap-1.5">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                Captured JavaScript & Runtime Error Logs
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Includes unhandled client crashes, UI rendering errors, promise rejections, and server-side route handler exceptions.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={fetchErrors}
                className="p-1 px-3 border border-slate-200 hover:border-slate-400 rounded-lg text-slate-500 hover:text-slate-700 smooth-hover text-xs flex items-center gap-1 bg-white font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Logs
              </button>
              <button
                onClick={handleClearErrors}
                disabled={jsErrors.length === 0}
                className="p-1 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg smooth-hover text-xs flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge All
              </button>
            </div>
          </div>

          {loadingErrors ? (
            <div className="flex items-center justify-center py-10 font-mono text-xs">Loading error audit traces...</div>
          ) : jsErrors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2 bg-white">
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                <RefreshCw className="h-6 w-6 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <p className="text-slate-700 text-sm font-semibold">System Running Clean & Stable</p>
              <p className="text-slate-400 text-xs max-w-xs">No client-side UI crashes or server exceptions have been registered in the database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-2.5">Time</th>
                    <th className="px-5 py-2.5">Origin</th>
                    <th className="px-5 py-2.5">Error Message / Context</th>
                    <th className="px-5 py-2.5">Operator</th>
                    <th className="px-5 py-2.5">URL / Route</th>
                    <th className="px-5 py-2.5 text-right">Inspect Stack</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {jsErrors.map(err => {
                    const isExpanded = expandedErrorId === err.Id;
                    return (
                      <React.Fragment key={err.Id}>
                        <tr className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setExpandedErrorId(isExpanded ? null : err.Id)}>
                          <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{err.Timestamp}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide flex items-center w-fit gap-1 ${
                              err.Source === 'Server' 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' 
                                : 'bg-rose-50 text-rose-700 border border-rose-150'
                            }`}>
                              {err.Source === 'Server' ? <Server className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                              {err.Source}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-800 max-w-md truncate" title={err.Message}>
                            {err.Message}
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-xs truncate" title={err.UserEmail}>{err.UserEmail || 'Guest'}</td>
                          <td className="px-5 py-3 text-slate-500 max-w-xs truncate font-sans text-xs" title={err.Url}>{err.Url}</td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedErrorId(isExpanded ? null : err.Id);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md font-semibold text-[10px] text-slate-600 transition-colors"
                            >
                              {isExpanded ? 'Collapse' : 'Show Stack'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-950 p-5 border-y border-slate-800 text-slate-100">
                              <div className="space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide font-mono border-b border-slate-800 pb-2">
                                  <span>Runtime Error Details (Log ID: #{err.Id})</span>
                                  <span>Logged: {err.Timestamp}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-rose-400 font-bold text-xs leading-relaxed">
                                    Message: {err.Message}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    <b>URL Target:</b> {err.Url}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    <b>Client UserAgent:</b> {err.UserAgent}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    <b>Active Operator:</b> {err.UserEmail || 'Guest'}
                                  </div>
                                </div>
                                {err.Stack ? (
                                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl overflow-auto max-h-[300px]">
                                    <pre className="text-slate-300 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                                      {err.Stack}
                                    </pre>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-500 italic">No stack trace was available for this exception log context.</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
