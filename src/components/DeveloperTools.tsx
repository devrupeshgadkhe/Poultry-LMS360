import React, { useEffect, useState } from 'react';
import { 
  Terminal, 
  Shield, 
  History, 
  RefreshCw, 
  ShieldAlert, 
  Trash2, 
  Globe, 
  Server,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Building2,
  Key,
  Plus,
  Check,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import { translations, Language } from '../translations';

export default function DeveloperTools({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  
  // Developer Tools tab navigation
  const [activeDevTab, setActiveDevTab] = useState<'gemini-keys' | 'audit' | 'errors' | 'hard-reset'>('gemini-keys');

  // Gemini API Keys State
  const [geminiKeys, setGeminiKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [keyInputVisible, setKeyInputVisible] = useState(false);
  const [addingKey, setAddingKey] = useState(false);
  const [keyActionMsg, setKeyActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [id: string]: { success: boolean; message: string } }>({});

  // Audit Logs State
  const [audits, setAudits] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  // JavaScript/Runtime Errors State
  const [jsErrors, setJsErrors] = useState<any[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [expandedErrorId, setExpandedErrorId] = useState<number | null>(null);

  // Hard Reset State
  const [farms, setFarms] = useState<any[]>([]);
  const [resetScope, setResetScope] = useState<'particular' | 'all'>('particular');
  const [selectedFarmId, setSelectedFarmId] = useState<number>(1);
  const [confirmText, setConfirmText] = useState('');
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchKeys();
    fetchAudits();
    fetchErrors();
    fetchFarms();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoadingKeys(true);
      const res = await fetch('/api/developer/gemini-keys');
      if (res.ok) {
        const data = await res.json();
        setGeminiKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Failed to fetch Gemini keys:', e);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKey.trim()) return;
    setAddingKey(true);
    setKeyActionMsg(null);
    try {
      const res = await fetch('/api/developer/gemini-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newApiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setKeyActionMsg({ type: 'error', text: data.error || 'Failed to add API key' });
      } else {
        setKeyActionMsg({ type: 'success', text: data.message || 'Key added successfully!' });
        setNewApiKey('');
        setTestResult({});
        setGeminiKeys(data.keys || []);
      }
    } catch (err: any) {
      setKeyActionMsg({ type: 'error', text: err.message || 'Network error while adding key' });
    } finally {
      setAddingKey(false);
    }
  };

  const handleRemoveKey = async (id: string, label: string) => {
    setKeyActionMsg(null);
    try {
      const res = await fetch(`/api/developer/gemini-keys/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        setKeyActionMsg({ type: 'error', text: data.error || 'Failed to remove API key' });
      } else {
        setKeyActionMsg({ type: 'success', text: data.message || 'Key removed successfully' });
        setGeminiKeys(data.keys || []);
      }
    } catch (err: any) {
      setKeyActionMsg({ type: 'error', text: err.message || 'Network error while removing key' });
    }
  };

  const handleTestKey = async (id: string, isEnv: boolean) => {
    setTestingKeyId(id);
    try {
      const res = await fetch('/api/developer/gemini-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(prev => ({ ...prev, [id]: { success: true, message: 'Verified (Connected)' } }));
      } else {
        setTestResult(prev => ({ ...prev, [id]: { success: false, message: data.error || 'Connection check failed' } }));
      }
    } catch (e: any) {
      setTestResult(prev => ({ ...prev, [id]: { success: false, message: e.message || 'Network test failed' } }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const fetchFarms = async () => {
    try {
      const res = await fetch('/api/farms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFarms(data);
          setSelectedFarmId(data[0].Id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch farms:', e);
    }
  };

  const handleExecuteHardReset = async () => {
    if (confirmText !== 'RESET') {
      alert('Please type "RESET" to confirm.');
      return;
    }
    if (!understandChecked) {
      alert('Please check the confirmation box acknowledging that this data wipe is permanent.');
      return;
    }

    try {
      setIsResetting(true);
      setResetResult(null);

      const res = await fetch('/api/developer/hard-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': localStorage.getItem('userEmail') || 'admin'
        },
        body: JSON.stringify({
          scope: resetScope,
          farmId: selectedFarmId
        })
      });

      const body = await res.json();
      if (!res.ok) {
        setResetResult({ success: false, message: body.error || 'Hard reset request failed.' });
      } else {
        setResetResult({ success: true, message: body.message || 'Hard reset completed successfully.' });
        setConfirmText('');
        setUnderstandChecked(false);
        window.dispatchEvent(new CustomEvent('farm-data-updated'));
        fetchAudits();
      }
    } catch (err: any) {
      setResetResult({ success: false, message: err.message || 'Network error during hard reset.' });
    } finally {
      setIsResetting(false);
    }
  };

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
          onClick={() => {
            setActiveDevTab('gemini-keys');
            fetchKeys();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono border-b-2 tracking-wide whitespace-nowrap smooth-hover ${
            activeDevTab === 'gemini-keys'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-850'
          }`}
          id="tab-btn-gemini-keys"
        >
          <Key className="h-4 w-4 text-emerald-600" />
          Gemini API Keys ({geminiKeys.length})
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
        <button
          onClick={() => {
            setActiveDevTab('hard-reset');
            fetchFarms();
            setResetResult(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono border-b-2 tracking-wide whitespace-nowrap smooth-hover ${
            activeDevTab === 'hard-reset'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-red-500'
          }`}
          id="tab-btn-hard-reset"
        >
          <RotateCcw className="h-4 w-4 text-red-600" />
          Data Wipe & Hard Reset
        </button>
      </div>

      {/* TAB: GEMINI API KEYS POOL (DEVELOPER ONLY) */}
      {activeDevTab === 'gemini-keys' && (
        <div className="space-y-6 animate-fade-in" id="gemini-keys-panel">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                    <Key className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 font-display">Gemini API Key Pool Configuration</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure Google Gemini API keys for AI Photo & PDF Purchase Bill Scanning. Strictly restricted to Developer Login.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchKeys}
                  disabled={loadingKeys}
                  className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Reload configured keys"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingKeys ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => handleTestKey('pool', false)}
                  disabled={Boolean(testingKeyId) || geminiKeys.length === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title={geminiKeys.length === 0 ? "Please add a Gemini API key below first to test" : "Run live AI ping test"}
                >
                  <CheckCircle2 className={`h-3.5 w-3.5 ${testingKeyId === 'pool' ? 'animate-spin' : ''}`} />
                  {testingKeyId === 'pool' ? 'Testing Connection...' : 'Test Active AI Key'}
                </button>
              </div>
            </div>

            {/* Test result banner */}
            {testResult['pool'] && (
              <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 animate-fade-in ${
                testResult['pool'].success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {testResult['pool'].success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{testResult['pool'].message}</span>
              </div>
            )}

            {/* Key Action Message */}
            {keyActionMsg && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-fade-in ${
                keyActionMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <span>{keyActionMsg.text}</span>
                <button
                  type="button"
                  onClick={() => setKeyActionMsg(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Add New Key Form */}
            <form onSubmit={handleAddKey} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-600" />
                  Add New Gemini API Key to Pool
                </label>
                <span className="text-[11px] text-slate-500">
                  Multiple keys rotate automatically on quota limits
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type={keyInputVisible ? 'text' : 'password'}
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key (e.g. AIzaSy...)"
                    className="w-full px-3.5 py-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setKeyInputVisible(!keyInputVisible)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={keyInputVisible ? 'Hide key' : 'Show key'}
                  >
                    {keyInputVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={addingKey || !newApiKey.trim()}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  {addingKey ? 'Adding Key...' : 'Add to Pool'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                You can obtain free API keys from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Google AI Studio</a>. Add as many keys as needed for high-volume automated invoice processing.
              </p>
            </form>

            {/* List of Configured Keys */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Active Server Key Pool ({geminiKeys.length} {geminiKeys.length === 1 ? 'key' : 'keys'})
                </h4>
                {geminiKeys.length === 0 && (
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    No API keys active!
                  </span>
                )}
              </div>

              {loadingKeys ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">
                  Loading configured keys...
                </div>
              ) : geminiKeys.length === 0 ? (
                <div className="py-8 px-4 text-center bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs text-amber-800 space-y-2">
                  <AlertCircle className="h-6 w-6 text-amber-600 mx-auto" />
                  <p className="font-bold">No Gemini API keys are currently configured on the server.</p>
                  <p className="text-slate-600 max-w-md mx-auto">
                    To use the photo/PDF purchase bill scanner, please paste at least one valid Gemini API key in the box above and click "Add to Pool".
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                  {geminiKeys.map((item, idx) => {
                    const isCoolingDown = item.cooldownUntil && item.cooldownUntil > Date.now();
                    return (
                      <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-800 tracking-wide">
                                {item.maskedKey}
                              </span>
                              {item.isEnv && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Server Env
                                </span>
                              )}
                              {isCoolingDown ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Quota Cooldown
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Ready
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.label} • Failures: {item.failedCount || 0}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {!item.isEnv ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveKey(item.id, item.label)}
                              className="px-2.5 py-1.5 border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Delete key from pool"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic px-2">Managed via System Env</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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

      {/* Hard Reset View Panel */}
      {activeDevTab === 'hard-reset' && (
        <div className="space-y-6 animate-fade-in" id="hard-reset-panel">
          {/* Warning Banner */}
          <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-2xl text-red-600 shrink-0 mt-0.5">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-red-950 flex items-center gap-2">
                  System Database Hard Reset & Factory Purge
                </h2>
                <p className="text-sm text-red-700 leading-relaxed">
                  Use this tool to completely wipe test data, remove lingering logs, and reset egg inventory counts to zero. All operations are atomic, recorded in the audit trail, and synchronize across both local SQLite and cloud Supabase tables.
                </p>
              </div>
            </div>
          </div>

          {/* Reset Result Message */}
          {resetResult && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              resetResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {resetResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <div className="text-sm font-semibold">{resetResult.message}</div>
            </div>
          )}

          {/* Scope Selection Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A: Particular Farm */}
            <div 
              onClick={() => setResetScope('particular')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                resetScope === 'particular'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${resetScope === 'particular' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Particular Farm Reset</h3>
                </div>
                <input 
                  type="radio" 
                  name="resetScope" 
                  checked={resetScope === 'particular'} 
                  onChange={() => setResetScope('particular')}
                  className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Wipes all transactional data (Flocks, Daily Records, Vaccinations, Sales, Purchases, Feed Logs, Finances) for ONE selected farm. Egg inventories are reset to zero. Farm profile and users remain intact.
              </p>
              
              {resetScope === 'particular' && (
                <div className="mt-4 pt-4 border-t border-indigo-100 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Select Target Farm to Reset:
                  </label>
                  <select
                    value={selectedFarmId}
                    onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {farms.map((f: any) => (
                      <option key={f.Id} value={f.Id}>
                        {f.FarmName} (Farm #{f.Id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Option B: All Farms Reset */}
            <div 
              onClick={() => setResetScope('all')}
              className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                resetScope === 'all'
                  ? 'border-red-600 bg-red-50/40 shadow-md ring-2 ring-red-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${resetScope === 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <RotateCcw className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">All Farms Hard Reset (Fresh Start)</h3>
                </div>
                <input 
                  type="radio" 
                  name="resetScope" 
                  checked={resetScope === 'all'} 
                  onChange={() => setResetScope('all')}
                  className="h-4 w-4 text-red-600 border-slate-300 focus:ring-red-500" 
                />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Purges ALL operational records across ALL farms in the entire system, restarts SQLite auto-increment ID counters to 1, and resets all egg inventories to zero. Restores a clean slate while preserving master Farm and User records.
              </p>
              {resetScope === 'all' && (
                <div className="mt-4 pt-4 border-t border-red-100">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
                    Caution: Clears records for all {farms.length} registered farms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Confirmation & Action Box */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-700" />
              Safety Verification & Execution
            </h4>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  To confirm, type <span className="font-mono font-bold text-red-600">RESET</span> in the box below:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="RESET"
                  className="w-full max-w-xs px-3.5 py-2.5 border-2 border-slate-300 rounded-xl text-sm font-mono tracking-widest focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="understand-check"
                  checked={understandChecked}
                  onChange={(e) => setUnderstandChecked(e.target.checked)}
                  className="h-4 w-4 text-red-600 rounded border-slate-300 focus:ring-red-500 mt-0.5"
                />
                <label htmlFor="understand-check" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                  I confirm that I understand this hard reset is permanent, irreversible, and will completely wipe the selected records and reset egg inventories.
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExecuteHardReset}
                  disabled={confirmText !== 'RESET' || !understandChecked || isResetting}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold font-mono tracking-wider transition-all shadow-sm ${
                    confirmText === 'RESET' && understandChecked && !isResetting
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 cursor-pointer active:scale-95'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  }`}
                  id="btn-execute-hard-reset"
                >
                  <RotateCcw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                  {isResetting ? 'RESETTING SYSTEM DATA...' : `EXECUTE HARD RESET (${resetScope.toUpperCase()})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
