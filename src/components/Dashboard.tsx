import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { LayoutDashboard, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Egg, Users, DollarSign, Activity } from 'lucide-react';
import { translations, Language, languages } from '../translations';
import { useFarm } from '../context/FarmContext';
import { reportsService } from '../lib/dataService';

interface Alert {
  ItemName: string;
  CurrentStock: number;
  MinThreshold: number;
  UnitOfMeasurement: string;
}

interface DashboardStats {
  totalBirds: number;
  freshCount: number;
  damagedCount: number;
  accountsPayable: number;
  accountsReceivable: number;
  totalIncome: number;
  totalExpense: number;
  alerts: Alert[];
  laymanRatePercentage: number;
  averageEggProductionCost?: number;
}

interface DashboardProps {
  currentLanguage: Language;
  setCurrentLanguage: (lang: Language) => void;
}

export default function Dashboard({ currentLanguage, setCurrentLanguage }: DashboardProps) {
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyLogTrend, setDailyLogTrend] = useState<any[]>([]);
  const [financeTrend, setFinanceTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[currentLanguage];

  useEffect(() => {
    fetchStats();
  }, [farmId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await reportsService.getDashboardData(farmId);
      setStats(data.stats);
      setDailyLogTrend(data.dailyLogTrend || []);
      setFinanceTrend(data.financeTrend || []);
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900" id="spinner-load"></div>
      </div>
    );
  }

  // Safe fallback properties to prevent Uncaught TypeErrors on undefined/null values
  const totalBirds = stats.totalBirds ?? 0;
  const laymanRatePercentage = stats.laymanRatePercentage ?? 0;
  const freshCount = stats.freshCount ?? 0;
  const damagedCount = stats.damagedCount ?? 0;
  const accountsReceivable = stats.accountsReceivable ?? 0;
  const accountsPayable = stats.accountsPayable ?? 0;
  const totalIncome = stats.totalIncome ?? 0;
  const totalExpense = stats.totalExpense ?? 0;
  const averageEggProductionCost = stats.averageEggProductionCost ?? 0;

  const netBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-6" id="dashboard-module">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
            <LayoutDashboard className="h-7 w-7 text-indigo-600 shrink-0" />
            <span>{t.dashboardTitle}</span>
            {currentFarm && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/70 font-sans">
                {currentFarm.FarmName}
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-xs mt-1">{t.dashboardSub}</p>
        </div>
        
        {/* Language selector and refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 font-sans flex items-center gap-1.5">
              Language:
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase bg-indigo-50 text-indigo-600 border border-indigo-150 animate-pulse select-none font-mono">
                Beta
              </span>
            </span>
            <select
              value={currentLanguage}
              onChange={(e) => setCurrentLanguage(e.target.value as Language)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              id="dash-lang-selector"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold smooth-hover shadow-sm"
            id="refresh-dash-btn"
          >
            {t.syncData}
          </button>
        </div>
      </div>

      {/* Bento Grid Analytics - 5 Cards Adaptive spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Active Birds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start justify-between" id="stat-card-birds">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.activeLayers}</span>
            <div className="text-2xl font-bold font-display text-slate-800">{totalBirds.toLocaleString()}</div>
            <span className="text-xs text-slate-500">{t.liveHensInfo}</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Today's Laying Rate HDP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start justify-between" id="stat-card-laying">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.avgLayingRate}</span>
            <div className="text-2xl font-bold font-display text-slate-800">{laymanRatePercentage.toFixed(1)}%</div>
            <span className="text-xs text-slate-500">{t.hdpTargetInfo}</span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Egg className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Fresh Eggs level */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start justify-between" id="stat-card-eggs">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.eggsInStock}</span>
            <div className="text-2xl font-bold font-display text-slate-800">{freshCount.toLocaleString()}</div>
            <span className="text-xs font-mono text-red-500 block">{damagedCount} {t.damagedEggsInfo}</span>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Egg className="h-5 w-5 fill-current" />
          </div>
        </div>

        {/* Card 4: Accounts Receivable / Credit balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-start justify-between" id="stat-card-ledger">
          <div className="space-y-2 w-full min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider block truncate" title={t.receivablesPayables}>{t.receivablesPayables}</span>
            <div className="text-base font-bold text-slate-800 space-y-0.5 min-w-0">
              <div className="text-slate-700 truncate" title={`${t.rxLabel}: ₹${accountsReceivable.toLocaleString()}`}>{t.rxLabel}: <span className="font-mono text-emerald-600 font-bold">₹{accountsReceivable.toLocaleString()}</span></div>
              <div className="text-slate-500 truncate text-xs" title={`${t.txLabel}: ₹${accountsPayable.toLocaleString()}`}>{t.txLabel}: <span className="font-mono text-rose-500 font-semibold">₹{accountsPayable.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card 5: Per Egg Cost (New Metric!) */}
        <div className="bg-gradient-to-br from-indigo-50/50 to-white p-5 rounded-2xl border border-indigo-100 shadow-xs flex items-start justify-between" id="stat-card-per-egg">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">{t.perEggCostDashboard}</span>
            <div className="text-2xl font-extrabold font-mono text-indigo-950">₹{(averageEggProductionCost || 0).toFixed(2)}</div>
            <span className="text-[10px] text-slate-500 block leading-tight">{t.eggProductionCostDesc}</span>
          </div>
          <div className="p-2.5 bg-indigo-100/50 text-indigo-700 rounded-xl shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Threshold Alarms warning */}
      {stats.alerts && Array.isArray(stats.alerts) && stats.alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3" id="warning-alarms-panel">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900 font-display">{t.lowStockAlert}</h4>
            <p className="text-xs text-amber-700">{t.lowStockDesc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {stats.alerts.map((alert, i) => (
                <div key={i} className="bg-white/80 p-2 rounded-lg text-xs border border-amber-100 flex justify-between items-center">
                  <span className="font-medium text-slate-700">{alert.ItemName}</span>
                  <span className="font-mono text-amber-700 font-semibold">{alert.CurrentStock} / {alert.MinThreshold} {alert.UnitOfMeasurement}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Eggs Collected vs Feed Consumed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4" id="chart-eggs-feed">
          <div>
            <h3 className="text-base font-bold font-display text-slate-800">{t.eggProductionvsFeed}</h3>
            <p className="text-xs text-slate-500">Synchronized logging feedback values over past entries.</p>
          </div>
          <div className="h-80 w-full">
            {dailyLogTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyLogTrend}>
                  <defs>
                    <linearGradient id="colorEggs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFeed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} className="font-mono" />
                  <YAxis stroke="#94a3b8" fontSize={11} className="font-mono" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Area type="monotone" dataKey="Eggs Collected" stroke="#d97706" strokeWidth={2} fillOpacity={1} fill="url(#colorEggs)" />
                  <Area type="monotone" dataKey="Feed Consumed (Kg)" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorFeed)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Add daily log entries mapping feed to display laying rate vectors.</div>
            )}
          </div>
        </div>

        {/* Chart 2: Direct revenue Inflow vs Expense Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4" id="chart-money">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-slate-800">{t.earningsExpenseChart}</h3>
              <p className="text-xs text-slate-500">M-T-D cash streams and checkout disbursements.</p>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${netBalance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              Net: ₹{netBalance.toLocaleString()}
            </div>
          </div>
          <div className="h-80 w-full">
            {financeTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} className="font-mono" />
                  <YAxis stroke="#94a3b8" fontSize={11} className="font-mono" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">Submit invoices or disbursements mapping expenses to overlay charts.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
