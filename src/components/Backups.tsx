import React, { useState, useEffect, useRef } from 'react';
import { Download, Cloud, ShieldAlert, CheckCircle, RefreshCcw, Upload, Trash2, HardDrive, AlertTriangle, Key } from 'lucide-react';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';

export default function Backups({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const activeFarmId = currentFarm?.Id || Number(localStorage.getItem('active_farm_id')) || Number(localStorage.getItem('userFarmId')) || 1;
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Automated Cloud backup connection status
  const [cloudStatus, setCloudStatus] = useState<{ isLinked: boolean; isEnabled: boolean; email: string; repo?: string; branch?: string; folderPath?: string }>({ isLinked: false, isEnabled: false, email: '' });
  // Local database backups history
  const [localBackups, setLocalBackups] = useState<any[]>([]);

  // GitHub Backup custom states
  const [showGitConfig, setShowGitConfig] = useState(false);
  const [gitPat, setGitPat] = useState('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');
  const [gitRepo, setGitRepo] = useState('devrupeshgadkhe/Poultry360-Backups');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitFolder, setGitFolder] = useState('backups');

  // Staged / Loaded file backup state for manual restoration step
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stagedBackupData, setStagedBackupData] = useState<any | null>(null);
  // Auto-reload countdown
  const [countdown, setCountdown] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch cloud connection state and historical local backups list
  const fetchStatusAndBackups = async () => {
    try {
      const statusRes = await fetch('/api/backups/status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setCloudStatus(statusData);
        if (statusData.repo) setGitRepo(statusData.repo);
        if (statusData.branch) setGitBranch(statusData.branch);
        if (statusData.folderPath) setGitFolder(statusData.folderPath);
      }

      const localRes = await fetch('/api/backups/local');
      if (localRes.ok) {
        const localData = await localRes.json();
        setLocalBackups(localData);
      }
    } catch (err) {
      console.error('Failed to load system backup database statuses:', err);
    }
  };

  useEffect(() => {
    fetchStatusAndBackups();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleDownloadBackup = () => {
    // Download current database schema and data as formal JSON export
    window.location.href = '/api/backups/export';
  };

  // Stage selected JSON file and display stats/save buttons
  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const text = await file.text();
      let payload: any = null;
      const cleanText = text.trim();

      // Check if raw cipher text was uploaded (e.g. cipher.txt)
      if (cleanText.includes(':') && /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(cleanText)) {
        payload = { encrypted: true, data: cleanText };
      } else {
        try {
          payload = JSON.parse(cleanText);
        } catch (parseErr) {
          // Check if payload string itself is raw encrypted text
          if (cleanText.includes(':')) {
            payload = { encrypted: true, data: cleanText };
          } else {
            throw parseErr;
          }
        }
      }

      // Validate formatting structure (can be plain database JSON or encrypted JSON)
      if (payload && payload.encrypted === true && typeof payload.data === 'string') {
        setSelectedFile(file);
        setStagedBackupData({
          ...payload,
          fileName: file.name,
          fileSize: file.size,
          totalTablesCount: 'Encrypted',
          totalRowsCount: 'Encrypted'
        });
      } else if (payload && Array.isArray(payload.tables)) {
        // Count total table rows
        let totalRows = 0;
        payload.tables.forEach((table: any) => {
          if (table.rows && Array.isArray(table.rows)) {
            totalRows += table.rows.length;
          }
        });

        setSelectedFile(file);
        setStagedBackupData({
          ...payload,
          fileName: file.name,
          fileSize: file.size,
          totalTablesCount: payload.tables.length,
          totalRowsCount: totalRows
        });
      } else {
        throw new Error('This file format is invalid. It does not contain a recognized database backup schema.');
      }
    } catch (err: any) {
      setErrMsg(err.message || 'Restoration load failed. Ensure target file is a valid generated backup JSON document.');
      setSelectedFile(null);
      setStagedBackupData(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Execute restore command on active staged backup data
  const handleExecuteRestore = async () => {
    if (!stagedBackupData) return;

    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);

    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Farm-Id': String(activeFarmId)
        },
        body: JSON.stringify({
          ...stagedBackupData,
          farmId: activeFarmId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'The system database engine rejected the restoration schema.');
      }

      setSuccessMsg('Database restoration completed successfully! All tables and data cells have been reconstructed.');
      setSelectedFile(null);
      setStagedBackupData(null);
      fetchStatusAndBackups();

      // Trigger automatic reload countdown for fully responsive sync
      setCountdown(3);
    } catch (err: any) {
      setErrMsg(err.message || 'Restoration failed. Ensure backup is a valid JSON database schema format.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/backups/auto', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger snapshot.');
      setSuccessMsg('A new offline data snapshot has been created and saved successfully!');
      fetchStatusAndBackups();
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloudSyncNow = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/backups/gdrive/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cloud synchronization failed.');
      setSuccessMsg('Success: High security system database backup successfully synchronized to the secure cloud repository.');
      fetchStatusAndBackups();
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGitHubConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/backups/github/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pat: gitPat,
          repo: gitRepo,
          branch: gitBranch,
          folderPath: gitFolder
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration.');
      setSuccessMsg('GitHub Backup connection successfully configured and verified!');
      setShowGitConfig(false);
      fetchStatusAndBackups();
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!window.confirm('Are you sure you want to disconnect and clear the GitHub Cloud Backup configuration?')) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/backups/gdrive/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect.');
      setSuccessMsg('GitHub Cloud connection successfully unlinked and deactivated.');
      setGitPat('');
      setGitRepo('');
      fetchStatusAndBackups();
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocalFile = async (filename: string) => {
    const confirmRestore = window.confirm(
      `⚠️ CRITICAL DANGER ZONE:\n\nReverting database back to physical snapshot "${filename}" will instantly delete and overwrite all current database entries.\n\nType OK to proceed.`
    );
    if (!confirmRestore) return;

    setLoading(true);
    setSuccessMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch(`/api/backups/local/${filename}/restore`, { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Farm-Id': String(activeFarmId)
        },
        body: JSON.stringify({ farmId: activeFarmId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Snapshot restoration rejected.');
      setSuccessMsg(`System database successfully reverted to physical snapshot: "${filename}"!`);
      fetchStatusAndBackups();
      
      // Trigger automatic reload countdown for fully responsive state update
      setCountdown(3);
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocalFile = async (filename: string) => {
    if (!window.confirm(`Delete older local snapshot file "${filename}" permanently?`)) return;

    setLoading(true);
    try {
      await fetch(`/api/backups/local/${filename}`, { method: 'DELETE' });
      setSuccessMsg('Database snapshot file deleted.');
      fetchStatusAndBackups();
    } catch (err: any) {
      setErrMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6" id="backups-module">
      {/* Reloader overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full border border-slate-100 shadow-2xl text-center space-y-6 animate-in fade-in duration-300">
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-950 font-display">Database Restored!</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                All poultry databases, sales logs, and system metrics have been loaded successfully. Re-syncing active application states.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <span className="text-slate-400 text-[10px] uppercase font-mono tracking-widest font-bold">Refreshing Client App in</span>
              <span className="text-3xl font-extrabold text-indigo-600 font-display">{countdown}s</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 3) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            {t.backupTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.backupSub}</p>
        </div>
      </div>

      {/* Success & Error State Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs sm:text-sm rounded-2xl flex items-start gap-3 shadow-xs">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Operation Completed</p>
            <p className="mt-0.5 opacity-90">{successMsg}</p>
          </div>
        </div>
      )}

      {errMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Action Blocked / Failure Exception</p>
            <p className="mt-0.5 opacity-90">{errMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module 1: Export & Manual Import */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4 shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-md sm:text-lg font-bold text-slate-800 font-display flex items-center gap-1.5">
              <Download className="h-5 w-5 text-indigo-600" />
              Manual JSON Export & Restore
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Generate a universal data document encompassing all schemas and record histories. 
              This document is saved as a standardized JSON format. You can re-upload any saved backup file 
              at any point to reset your system logs.
            </p>

            {stagedBackupData && (
              <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950 font-display">Backup Snapshot Loaded</h4>
                    <p className="text-[10px] text-amber-900 leading-normal mt-0.5 animate-pulse">
                      Ready to rewrite database. This will overwrite all active state records.
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-700 bg-white border border-amber-100 rounded-xl p-3 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[120px]" title={stagedBackupData.fileName}>
                      {stagedBackupData.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Data Weight:</span>
                    <span className="font-semibold text-slate-800">{formatSize(stagedBackupData.fileSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Database Tables:</span>
                    <span className="font-semibold text-indigo-600">
                      {typeof stagedBackupData.totalTablesCount === 'number' ? `${stagedBackupData.totalTablesCount} tables` : stagedBackupData.totalTablesCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Entries:</span>
                    <span className="font-semibold text-indigo-600">
                      {typeof stagedBackupData.totalRowsCount === 'number' ? `${stagedBackupData.totalRowsCount} items` : stagedBackupData.totalRowsCount}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    onClick={handleExecuteRestore}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl smooth-hover shadow-xs flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    id="save-restore-database-btn"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Save & Restore
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setStagedBackupData(null);
                    }}
                    disabled={loading}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl smooth-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {!stagedBackupData && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row lg:flex-col gap-3">
              <button
                onClick={handleDownloadBackup}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-2xl smooth-hover shadow-xs w-full"
                id="download-json-btn"
              >
                <Download className="h-4.5 w-4.5" />
                Export System Data JSON
              </button>

              <label className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-300 hover:border-indigo-600 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-2xl cursor-pointer smooth-hover w-full text-center">
                <Upload className="h-4.5 w-4.5 text-indigo-600" />
                Upload Backup File
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleFileSelection}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          )}
        </div>

        {/* Module 2: Cloud Sync */}
        <div className="bg-indigo-50/40 border border-indigo-100 p-6 rounded-3xl space-y-4 shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-md sm:text-lg font-bold text-slate-900 font-display flex items-center gap-1.5 font-sans">
              <Cloud className="h-5 w-5 text-indigo-600" />
              Automated Cloud Sync
            </h3>
            <p className="text-xs text-indigo-950/80 mt-2 leading-relaxed">
              100% automated backup replication with <strong>zero browser logins or click dependency</strong> to secure GitHub.
            </p>
            
            {/* Status detail */}
            <div className="mt-4 p-3.5 bg-white/70 rounded-2xl border border-indigo-100/80 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Connection Status:</span>
                <span className={`font-semibold px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono ${cloudStatus.isLinked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {cloudStatus.isLinked ? 'Linked / Connected' : 'Disconnected'}
                </span>
              </div>
              {cloudStatus.isLinked && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Repository:</span>
                    <span className="font-mono text-slate-800 font-semibold break-all text-right">{cloudStatus.repo}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Branch:</span>
                    <span className="font-mono text-slate-800 font-semibold text-right">{cloudStatus.branch}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Folder Path:</span>
                    <span className="font-mono text-slate-800 font-semibold text-right">{cloudStatus.folderPath}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Configure form toggler or active form */}
            {showGitConfig && (
              <form onSubmit={handleSaveGitHubConfig} className="mt-4 p-4 bg-white/95 border border-indigo-100 rounded-2xl space-y-3 shadow-sm text-left">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-indigo-600" />
                  GitHub Repository Link
                </h4>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={gitPat}
                    onChange={(e) => setGitPat(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Repository (owner/repo)</label>
                  <input
                    type="text"
                    placeholder="e.g. rupeshgadkhe/poultry360-backups"
                    value={gitRepo}
                    onChange={(e) => setGitRepo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Branch</label>
                    <input
                      type="text"
                      placeholder="main"
                      value={gitBranch}
                      onChange={(e) => setGitBranch(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Folder Path</label>
                    <input
                      type="text"
                      placeholder="backups"
                      value={gitFolder}
                      onChange={(e) => setGitFolder(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Save & Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGitConfig(false)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="pt-4 border-t border-indigo-100 flex flex-col gap-2">
            {!showGitConfig && (
              <>
                {cloudStatus.isLinked ? (
                  <div className="flex flex-col gap-2 w-full">
                    <button
                      onClick={handleCloudSyncNow}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-2xl smooth-hover shadow-xs w-full cursor-pointer"
                      id="cloud-sync-now-btn"
                    >
                      <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Trigger Manual Sync Now
                    </button>
                    <div className="w-full">
                      <button
                        onClick={() => setShowGitConfig(true)}
                        className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200"
                      >
                        Edit Connection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 w-full">
                    <div className="p-3 bg-indigo-50/60 border border-indigo-200/40 rounded-2xl text-[11px] text-indigo-950/90 leading-relaxed">
                      <p className="font-semibold text-slate-700">GitHub Connection is offline or disconnected.</p>
                      <p className="text-slate-500 mt-0.5">Please click below to connect and repair the GitHub backup linkage.</p>
                    </div>
                    <button
                      onClick={() => setShowGitConfig(true)}
                      className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-2xl smooth-hover shadow-xs w-full cursor-pointer"
                    >
                      Connect / Repair GitHub Connection
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Module 3: Automatic Lifecycles Indicator */}
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4 shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-md sm:text-lg font-bold text-slate-800 font-display flex items-center gap-1.5">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              Automated Safety Protocols
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Auto-snapshot routines run automatically during critical application lifecycle events to shield 
              record keeping against local data corruption or computer failures.
            </p>

            <ul className="mt-4 space-y-2 text-xs text-slate-600 bg-white border border-slate-100 p-3 rounded-2xl">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>User Sign-In successful</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>User Logout request</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Application Start-up hook</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>Direct browser termination / close</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleCreateSnapshot}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-2xl smooth-hover shadow-xs w-full"
              id="trigger-snapshot-btn"
            >
              <HardDrive className="h-4.5 w-4.5" />
              Trigger Instant Snapshot
            </button>
          </div>
        </div>

      </div>

      {/* Historical Backup Snapshots Ledger (Saved locally) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-150 flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-indigo-600" />
              System Snapshot Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Historical registry of dynamic system backup point-saves, capped at a running history of 10.</p>
          </div>
        </div>

        {localBackups.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <HardDrive className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            No system snapshots generated. Trigger or perform an autodeployment action.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4 rounded-2xl border border-slate-100">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="p-4">Filename / Point-save ID</th>
                  <th className="p-4">Snapshot Saved Age</th>
                  <th className="p-4 text-right">Data Weight</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {localBackups.map((bk) => (
                  <tr key={bk.filename} className="hover:bg-slate-50/50">
                    <td className="p-4 font-mono text-slate-800 text-[11px] font-semibold">{bk.filename}</td>
                    <td className="p-4">{new Date(bk.createdAt).toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-slate-500 font-medium">{formatSize(bk.size)}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleRestoreLocalFile(bk.filename)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-lg smooth-hover text-[11px]"
                      >
                        Restore State
                      </button>
                      <a
                        href={`/api/backups/local/${bk.filename}/download`}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg smooth-hover text-[11px] flex items-center justify-center"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDeleteLocalFile(bk.filename)}
                        disabled={loading}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg smooth-hover"
                        title="Delete snapshot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
