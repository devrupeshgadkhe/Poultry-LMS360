import React, { useState, useRef } from 'react';
import { useFarm } from '../context/FarmContext';
import {
  Database,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldAlert,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  FileText,
  Check,
  Calendar,
  AlertTriangle,
  FolderSync
} from 'lucide-react';

interface AnalysisResult {
  totalRecords: number;
  flocksCount: number;
  flockNames: string[];
  dailyLogsCount: number;
  inventoriesCount: number;
  customersCount: number;
  suppliersCount: number;
  purchasesCount: number;
  salesCount: number;
  financialTransactionsCount: number;
  vaccinationsCount: number;
  recipesCount: number;
  dateRange: { earliest: string; latest: string };
  tableSummary: { name: string; count: number }[];
  integrityIssues: string[];
}

export default function LegacyMigrator({ userRole = 'Developer' }: { userRole?: string | null }) {
  const { farms, currentFarm, switchFarm } = useFarm();

  // State
  const [targetFarmId, setTargetFarmId] = useState<number>(currentFarm?.Id || 1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePayload, setFilePayload] = useState<any>(null);
  const [fileType, setFileType] = useState<'json' | 'sqlite' | null>(null);

  const [migrationMode, setMigrationMode] = useState<'merge' | 'replace_farm_data'>('merge');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security barrier check
  if (userRole !== 'Developer') {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Restricted Developer Console</h2>
        <p className="text-sm text-slate-600 mt-2">
          The Legacy-to-MultiFarm migration tool is strictly reserved for System Developers (SuperAdmin).
          Farm Administrators have access only to their standard single-farm database backup and restoration tool.
        </p>
      </div>
    );
  }

  const selectedTargetFarm = farms.find((f) => f.Id === targetFarmId) || farms[0];

  // Handle file drag/drop or input change
  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setAnalysisResult(null);
    setMigrationSuccess(null);
    setSelectedFile(file);

    const isSqlite = file.name.endsWith('.db') || file.name.endsWith('.sqlite') || file.name.endsWith('.sqlite3');
    const isJson = file.name.endsWith('.json');

    if (!isSqlite && !isJson) {
      setErrorMsg('Please upload a valid SQLite database file (.db, .sqlite) or Poultry LMS backup JSON (.json).');
      setSelectedFile(null);
      setFilePayload(null);
      return;
    }

    try {
      if (isSqlite) {
        setFileType('sqlite');
        // Read file as Base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setFilePayload({ sqliteBase64: base64, fileName: file.name });
        };
        reader.readAsDataURL(file);
      } else {
        setFileType('json');
        const text = await file.text();
        const parsed = JSON.parse(text);
        setFilePayload(parsed);
      }
    } catch (err: any) {
      setErrorMsg('Failed to read selected file: ' + err.message);
      setSelectedFile(null);
      setFilePayload(null);
    }
  };

  // Run Pre-migration Analysis
  const handleAnalyze = async () => {
    if (!filePayload) {
      setErrorMsg('Please select a legacy backup or database file first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);
    setMigrationSuccess(null);

    try {
      const res = await fetch('/api/migration/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Developer'
        },
        body: JSON.stringify(filePayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed.');
      }

      setAnalysisResult(data.summary);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error during pre-migration analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute Live Migration
  const handleExecuteMigration = async () => {
    if (!filePayload || !targetFarmId) {
      setErrorMsg('Missing file or target farm selection.');
      return;
    }

    if (!window.confirm(`Are you sure you want to migrate legacy database records into Farm #${targetFarmId} (${selectedTargetFarm?.FarmName})?`)) {
      return;
    }

    setIsMigrating(true);
    setErrorMsg(null);
    setMigrationSuccess(null);

    try {
      const payloadToSend = {
        ...filePayload,
        targetFarmId,
        mode: migrationMode
      };

      const res = await fetch('/api/migration/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Developer'
        },
        body: JSON.stringify(payloadToSend)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Migration failed.');
      }

      setMigrationSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Migration execution failed.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Developer Only Migration Suite
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Database className="w-7 h-7 text-indigo-400" />
              Legacy Single-Farm to Multi-Tenant Migrator
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Seamlessly import historical database records or encrypted backup files from legacy desktop setups into
              isolated cloud tenant farms. Automatically injects <code className="text-indigo-300 font-mono">FarmId</code> and remaps relational keys.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/10 text-xs shrink-0">
            <span className="text-slate-400 block font-medium">Restricted Access</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
              <Check className="w-3.5 h-3.5" /> Authenticated as Developer
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Migration Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {migrationSuccess && (
        <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-emerald-900">
                Migration Successfully Completed!
              </h3>
              <p className="text-sm text-emerald-700 mt-0.5">
                Legacy database has been completely ported to{' '}
                <strong>
                  Farm #{migrationSuccess.targetFarm.id} ({migrationSuccess.targetFarm.name})
                </strong>{' '}
                in {(migrationSuccess.durationMs / 1000).toFixed(2)} seconds.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {Object.entries(migrationSuccess.stats || {}).map(([tbl, cnt]: any) => (
                  <div key={tbl} className="bg-white/80 p-3 rounded-xl border border-emerald-200 text-center">
                    <span className="text-xs text-slate-500 font-medium block">{tbl}</span>
                    <span className="text-lg font-black text-slate-800">{cnt}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => switchFarm(migrationSuccess.targetFarm.id)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow"
                >
                  <FolderSync className="w-4 h-4" />
                  Switch Active View to Farm #{migrationSuccess.targetFarm.id}
                </button>
                <button
                  onClick={() => {
                    setMigrationSuccess(null);
                    setAnalysisResult(null);
                    setSelectedFile(null);
                    setFilePayload(null);
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Migrate Another Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Workflow Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Select Target Farm */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Building2 className="w-4 h-4" /> Step 1: Target Tenant Farm
            </div>
            <h2 className="text-base font-bold text-slate-800">Select Destination Farm</h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose which multi-tenant account this historical dataset belongs to.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Farm</label>
                <select
                  value={targetFarmId}
                  onChange={(e) => setTargetFarmId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {farms.map((f) => (
                    <option key={f.Id} value={f.Id}>
                      #{f.Id} — {f.FarmName} ({f.OwnerName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTargetFarm && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Farm ID:</span>
                    <span className="font-mono font-bold text-slate-800">#{selectedTargetFarm.Id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Business Name:</span>
                    <span className="font-semibold text-slate-800">{selectedTargetFarm.FarmName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Owner:</span>
                    <span className="text-slate-700">{selectedTargetFarm.OwnerName}</span>
                  </div>
                  {selectedTargetFarm.ContactPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="text-slate-700">{selectedTargetFarm.ContactPhone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              Need a new tenant? Create the farm first in the Super Admin Console.
            </span>
          </div>
        </div>

        {/* Step 2: Upload Legacy File */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Upload className="w-4 h-4" /> Step 2: Source File
            </div>
            <h2 className="text-base font-bold text-slate-800">Upload Legacy Database / Backup</h2>
            <p className="text-xs text-slate-500 mt-1">
              Supports database backup files (<code className="text-indigo-600">.db</code>, <code className="text-indigo-600">.sqlite</code>) or standard backup (<code className="text-indigo-600">.json</code>).
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
              }}
              className={`mt-4 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                selectedFile
                  ? 'border-indigo-400 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.sqlite,.sqlite3,.json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />

              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                <Database className="w-5 h-5" />
              </div>

              {selectedFile ? (
                <div>
                  <span className="text-xs font-bold text-indigo-900 block truncate max-w-[200px] mx-auto">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Type: {fileType?.toUpperCase()}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Click to browse or drag file here
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    .db, .sqlite, .sqlite3, or .json
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleAnalyze}
              disabled={!selectedFile || isAnalyzing}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing Dataset...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" /> Analyze & Inspect Backup
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step 3: Migration Execution Config */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Layers className="w-4 h-4" /> Step 3: Execution Settings
            </div>
            <h2 className="text-base font-bold text-slate-800">Target Isolation Strategy</h2>
            <p className="text-xs text-slate-500 mt-1">
              Specify how legacy records should be introduced into the farm.
            </p>

            <div className="mt-4 space-y-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  migrationMode === 'merge'
                    ? 'border-indigo-500 bg-indigo-50/40 text-indigo-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="migrationMode"
                  value="merge"
                  checked={migrationMode === 'merge'}
                  onChange={() => setMigrationMode('merge')}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <span className="font-bold block">Merge with Existing Data (Safe)</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Appends legacy flocks, logs, and ledger without removing any current records.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                  migrationMode === 'replace_farm_data'
                    ? 'border-amber-500 bg-amber-50/40 text-amber-950 font-medium'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="migrationMode"
                  value="replace_farm_data"
                  checked={migrationMode === 'replace_farm_data'}
                  onChange={() => setMigrationMode('replace_farm_data')}
                  className="mt-0.5 text-amber-600"
                />
                <div>
                  <span className="font-bold block text-amber-800">Clean Slate (Replace Farm Data)</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Clears prior records strictly for this FarmId before importing. (Never touches other farms).
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={handleExecuteMigration}
              disabled={!analysisResult || isMigrating}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
            >
              {isMigrating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Migrating Data...
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" /> Execute Multi-Farm Migration
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Preview Card */}
      {analysisResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full mb-1">
                <Check className="w-3.5 h-3.5" /> Ready for Migration
              </div>
              <h2 className="text-lg font-bold text-slate-800">Pre-Migration Audit & Summary</h2>
              <p className="text-xs text-slate-500">
                Found {analysisResult.totalRecords.toLocaleString()} legacy records ready to map into Farm #{targetFarmId}.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>
                Timeline: <strong>{analysisResult.dateRange.earliest}</strong> to{' '}
                <strong>{analysisResult.dateRange.latest}</strong>
              </span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Flocks / Batches</span>
              <span className="text-xl font-bold text-slate-800">{analysisResult.flocksCount}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Daily Logs</span>
              <span className="text-xl font-bold text-slate-800">{analysisResult.dailyLogsCount}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Inventory Items</span>
              <span className="text-xl font-bold text-slate-800">{analysisResult.inventoriesCount}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Customers & Supp.</span>
              <span className="text-xl font-bold text-slate-800">
                {analysisResult.customersCount + analysisResult.suppliersCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Invoices (Sales/Pur)</span>
              <span className="text-xl font-bold text-slate-800">
                {analysisResult.salesCount + analysisResult.purchasesCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-semibold block">Financial Ledger</span>
              <span className="text-xl font-bold text-slate-800">{analysisResult.financialTransactionsCount}</span>
            </div>
          </div>

          {/* Flock Details */}
          {analysisResult.flockNames.length > 0 && (
            <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
              <span className="text-xs font-bold text-indigo-900 block mb-2">Identified Flock Batches:</span>
              <div className="flex flex-wrap gap-2">
                {analysisResult.flockNames.map((name, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-white text-indigo-800 font-semibold text-xs rounded-lg border border-indigo-200 shadow-2xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Table Breakdown Table */}
          <div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Detected Database Tables
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {analysisResult.tableSummary.map((t, idx) => (
                <div key={idx} className="px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between">
                  <span className="text-slate-600 truncate">{t.name}</span>
                  <span className="font-mono font-bold text-slate-800">{t.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Integrity warnings */}
          {analysisResult.integrityIssues.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-xs space-y-1">
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Relational Warnings:
              </span>
              {analysisResult.integrityIssues.map((issue, idx) => (
                <p key={idx} className="text-amber-800 pl-5">
                  &bull; {issue}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety Notice Footer */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-800">Developer Architecture Isolation Guarantee:</span>{' '}
          This migration process operates within strict multi-tenant sandboxes. Target records are remapped and
          injected with <code className="text-indigo-600 font-bold">FarmId = #{targetFarmId}</code>. System users,
          SuperAdmin accounts, and other customer farms are guaranteed to remain untouched.
        </div>
      </div>
    </div>
  );
}
