import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, ShieldAlert, Egg, Flame, CircleAlert, Edit2, RotateCcw } from 'lucide-react';
import { DailyLog, Flock, Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { dailyLogService, flockService, inventoryService } from '../lib/dataService';

export default function DailyLogs({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [logs, setLogs] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [feeds, setFeeds] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);

  // User role and granular permissions
  const userRole = localStorage.getItem('userRole') || 'Staff';
  const userPermsStr = (localStorage.getItem('userPermissions') || '').toLowerCase();
  const isSuperOrAdmin = userRole === 'Developer' || userRole === 'Admin' || userPermsStr === 'all' || userPermsStr.includes('admin');

  const canCreate = isSuperOrAdmin || userPermsStr.includes('dailylogs.create');
  const canEdit = isSuperOrAdmin || userPermsStr.includes('dailylogs.edit');
  const canDelete = isSuperOrAdmin || userPermsStr.includes('dailylogs.delete');
  
  const [newLog, setNewLog] = useState({
    FlockId: '',
    FeedItemId: '',
    FeedConsumedKg: 0,
    MortalityCount: 0,
    EggsCollected: 0,
    DamagedEggsCollected: 0,
    DailyAverageWeight: 0,
    WaterConsumed: 0,
    LogDate: new Date().toISOString().split('T')[0],
    Notes: '',
    BirdsEatenBySelf: 0,
    BirdsEatenValue: 150.00,
    EggsGifted: 0,
    EggsGiftedValue: 5.00
  });

  const [feedAlert, setFeedAlert] = useState<string | null>(null);
  const [traysInput, setTraysInput] = useState<string>('');
  const [damagedTraysInput, setDamagedTraysInput] = useState<string>('');

  useEffect(() => {
    fetchLogs();
    fetchOptions();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-log-form');
        if (activeForm) {
          const firstInput = activeForm.querySelector('input:not([type="hidden"]), select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          if (firstInput) {
            firstInput.removeAttribute('readonly');
            firstInput.removeAttribute('disabled');
            firstInput.focus();
            if (typeof (firstInput as any).select === 'function') {
              (firstInput as any).select();
            }
          }
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showAddForm]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await dailyLogService.getDailyLogs(farmId);
      setLogs(data);
    } catch (e) {
      console.error('Supabase getDailyLogs error, fallback to local:', e);
      try {
        const res = await fetch('/api/daily_logs');
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      // 1. Flocks
      try {
        const flockData = await flockService.getFlocks(farmId);
        setFlocks(flockData.filter((f: Flock) => f.Status === 'Active'));
      } catch {
        const flockRes = await fetch('/api/flocks');
        const flockData = await flockRes.json();
        setFlocks(flockData.filter((f: Flock) => f.Status === 'Active'));
      }

      // 2. Feeds
      try {
        const invData = await inventoryService.getInventories(farmId);
        setFeeds(invData.filter((i: Inventory) => i.Category === 'Feed' || i.Category === 'Raw Ingredient'));
      } catch {
        const invRes = await fetch('/api/inventories');
        const invData = await invRes.json();
        setFeeds(invData.filter((i: Inventory) => i.Category === 'Feed' || i.Category === 'Raw Ingredient'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Live feed check helper
  const handleFeedChange = (feedId: string, consumedVal: number) => {
    setFeedAlert(null);
    const idNum = parseInt(feedId);
    if (!idNum) return;
    const feed = feeds.find(f => f.Id === idNum);
    if (feed) {
      if (feed.CurrentStock < consumedVal) {
        setFeedAlert(`Notice: Insufficient local stock in silo! Silo contains ${feed.CurrentStock} Kg, trying to consume: ${consumedVal} Kg.`);
      }
    }
  };

  const handleSameAsYesterday = () => {
    if (!newLog.FlockId) {
      alert('Please select an active target flock first.');
      return;
    }
    const flockIdNum = parseInt(newLog.FlockId);
    const flockLogs = logs
      .filter(l => l.FlockId === flockIdNum)
      .sort((a, b) => new Date(b.LogDate).getTime() - new Date(a.LogDate).getTime());

    const lastRecord = flockLogs[0];
    if (!lastRecord) {
      alert('No previous record found for this flock to copy inputs from.');
      return;
    }

    setNewLog(prev => ({
      ...prev,
      FeedItemId: lastRecord.FeedItemId ? String(lastRecord.FeedItemId) : '',
      FeedConsumedKg: lastRecord.FeedConsumedKg || 0,
      MortalityCount: lastRecord.MortalityCount || 0,
      EggsCollected: lastRecord.EggsCollected || 0,
      DamagedEggsCollected: lastRecord.DamagedEggsCollected || 0,
      DailyAverageWeight: lastRecord.DailyAverageWeight || 0,
      WaterConsumed: lastRecord.WaterConsumed || 0,
      Notes: lastRecord.Notes || '',
      BirdsEatenBySelf: lastRecord.BirdsEatenBySelf || 0,
      BirdsEatenValue: lastRecord.BirdsEatenValue || 150.00,
      EggsGifted: lastRecord.EggsGifted || 0,
      EggsGiftedValue: lastRecord.EggsGiftedValue || 5.00
    }));

    setTraysInput(String(Math.round(((lastRecord.EggsCollected || 0) / 30) * 100) / 100));
    setDamagedTraysInput(String(Math.round(((lastRecord.DamagedEggsCollected || 0) / 30) * 100) / 100));

    if (lastRecord.FeedItemId) {
      handleFeedChange(String(lastRecord.FeedItemId), lastRecord.FeedConsumedKg || 0);
    }
  };

  const startEditLog = (log: any) => {
    setEditingLogId(log.Id);
    setNewLog({
      FlockId: String(log.FlockId),
      FeedItemId: log.FeedItemId ? String(log.FeedItemId) : '',
      FeedConsumedKg: log.FeedConsumedKg || 0,
      MortalityCount: log.MortalityCount || 0,
      EggsCollected: log.EggsCollected || 0,
      DamagedEggsCollected: log.DamagedEggsCollected || 0,
      DailyAverageWeight: log.DailyAverageWeight || 0,
      WaterConsumed: log.WaterConsumed || 0,
      LogDate: (log.LogDate || '').split('T')[0],
      Notes: log.Notes || '',
      BirdsEatenBySelf: log.BirdsEatenBySelf || 0,
      BirdsEatenValue: log.BirdsEatenValue || 150.00,
      EggsGifted: log.EggsGifted || 0,
      EggsGiftedValue: log.EggsGiftedValue || 5.00
    });
    setTraysInput(String(Math.round(((log.EggsCollected || 0) / 30) * 100) / 100));
    setDamagedTraysInput(String(Math.round(((log.DamagedEggsCollected || 0) / 30) * 100) / 100));
    setFeedAlert(null);
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingLogId(null);
    setNewLog({
      FlockId: '',
      FeedItemId: '',
      FeedConsumedKg: 0,
      MortalityCount: 0,
      EggsCollected: 0,
      DamagedEggsCollected: 0,
      DailyAverageWeight: 0,
      WaterConsumed: 0,
      LogDate: new Date().toISOString().split('T')[0],
      Notes: '',
      BirdsEatenBySelf: 0,
      BirdsEatenValue: 150.00,
      EggsGifted: 0,
      EggsGiftedValue: 5.00
    });
    setTraysInput('');
    setDamagedTraysInput('');
    setFeedAlert(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLogId && !canEdit) {
      alert('Security Alert: You do not have permission to edit daily logs.');
      return;
    }
    if (!editingLogId && !canCreate) {
      alert('Security Alert: You do not have permission to add daily logs.');
      return;
    }
    if (!newLog.FlockId) return alert('Please select a flock.');
    
    try {
      setSubmitting(true);
      const parseNum = (val: any) => (val === '' || val === null || val === undefined || isNaN(Number(val)) ? 0 : Number(val));

      const payload = {
        ...newLog,
        FarmId: farmId,
        FlockId: parseInt(newLog.FlockId),
        FeedItemId: newLog.FeedItemId ? parseInt(newLog.FeedItemId) : null,
        FeedConsumedKg: parseNum(newLog.FeedConsumedKg),
        MortalityCount: parseNum(newLog.MortalityCount),
        EggsCollected: parseNum(newLog.EggsCollected),
        DamagedEggsCollected: parseNum(newLog.DamagedEggsCollected),
        DailyAverageWeight: parseNum(newLog.DailyAverageWeight),
        WaterConsumed: parseNum(newLog.WaterConsumed),
        BirdsEatenBySelf: parseNum(newLog.BirdsEatenBySelf),
        BirdsEatenValue: parseNum(newLog.BirdsEatenValue),
        EggsGifted: parseNum(newLog.EggsGifted),
        EggsGiftedValue: parseNum(newLog.EggsGiftedValue),
        CustomEggPrice: (newLog as any).CustomEggPrice !== '' && (newLog as any).CustomEggPrice !== null && (newLog as any).CustomEggPrice !== undefined ? parseNum((newLog as any).CustomEggPrice) : null,
        CustomBirdPrice: (newLog as any).CustomBirdPrice !== '' && (newLog as any).CustomBirdPrice !== null && (newLog as any).CustomBirdPrice !== undefined ? parseNum((newLog as any).CustomBirdPrice) : null,
      };

      try {
        if (editingLogId) {
          await dailyLogService.updateDailyLog(farmId, editingLogId, payload);
        } else {
          await dailyLogService.createDailyLog(farmId, payload);
        }
        cancelForm();
        fetchLogs();
        fetchOptions();
      } catch (cloudErr: any) {
        console.error('Daily log service error, fallback to local backend:', cloudErr);
        const url = editingLogId ? `/api/daily_logs/${editingLogId}` : '/api/daily_logs';
        const method = editingLogId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Farm-Id': String(farmId),
            'X-User-Email': localStorage.getItem('userEmail') || 'admin'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          cancelForm();
          fetchLogs();
          fetchOptions();
        } else {
          const err = await res.json();
          alert(err.error || cloudErr.message || 'Failed to submit log');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLog = async (id: number) => {
    if (!canDelete) {
      alert('Security Alert: You do not have permission to revert or delete daily logs.');
      return;
    }
    if (!confirm('Revert log? This reverses historical feed values and subtracts collected eggs.')) return;
    try {
      try {
        await dailyLogService.deleteDailyLog(farmId, id);
        fetchLogs();
        fetchOptions();
      } catch (cloudErr) {
        console.error('Supabase deleteDailyLog error, fallback to local:', cloudErr);
        await fetch(`/api/daily_logs/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
        });
        fetchLogs();
        fetchOptions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" id="dailylogs-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Egg className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 shrink-0" />
            {t.dailyLogsTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.dailyLogsSub}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              if (showAddForm) {
                cancelForm();
              } else {
                setShowAddForm(true);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold smooth-hover shadow-xs shrink-0 self-start sm:self-center cursor-pointer"
            id="toggle-add-log-btn"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {editingLogId ? 'Editing Record' : t.addDailyLog}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-log-form">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <h3 className="text-lg font-bold font-display text-slate-800">
              {editingLogId ? 'Edit Daily Flock Entry' : 'Add Daily Flock Entry'}
            </h3>
            <button
              type="button"
              onClick={handleSameAsYesterday}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold smooth-hover shadow-2xs border border-slate-200"
              title="Auto-fill inputs with latest entry"
            >
              <RotateCcw className="h-3 w-3 text-slate-500" />
              Same as yesterday
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Active Flock</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newLog.FlockId}
                onChange={e => setNewLog({ ...newLog, FlockId: e.target.value })}
              >
                <option value="">-- Choose Active Flock --</option>
                {flocks.map(f => (
                  <option key={f.Id} value={f.Id}>{f.FlockName} ({f.Breed})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Record Entry Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 fill-none"
                value={newLog.LogDate}
                onChange={e => setNewLog({ ...newLog, LogDate: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Allocated Feed Stock</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newLog.FeedItemId}
                onChange={e => {
                  setNewLog({ ...newLog, FeedItemId: e.target.value });
                  handleFeedChange(e.target.value, newLog.FeedConsumedKg);
                }}
              >
                <option value="">-- Choose Feed Silo --</option>
                {feeds.map(f => (
                  <option key={f.Id} value={f.Id}>{f.ItemName} [Stock: {f.CurrentStock} {f.UnitOfMeasurement}]</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Feed Consumed (Kg)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newLog.FeedConsumedKg}
                onChange={e => {
                  const valStr = e.target.value;
                  const val = valStr === '' ? '' : (parseFloat(valStr) || 0);
                  setNewLog({ ...newLog, FeedConsumedKg: val as any });
                  handleFeedChange(newLog.FeedItemId, valStr === '' ? 0 : (parseFloat(valStr) || 0));
                }}
              />
            </div>

            {(() => {
              const selectedFeed = feeds.find(f => String(f.Id) === String(newLog.FeedItemId));
              if (!selectedFeed) return null;
              const costPerUnit = selectedFeed.AverageLandedCost ?? selectedFeed.UnitPrice ?? 0;
              const estimatedTotalCost = costPerUnit * (newLog.FeedConsumedKg || 0);
              return (
                <div className="col-span-1 sm:col-span-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase block tracking-wider">Average Landed Cost</span>
                    <span className="text-xs font-semibold text-slate-700">
                      ₹{costPerUnit.toFixed(2)} per {selectedFeed.UnitOfMeasurement}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase block tracking-wider">Estimated Cost of Consumption</span>
                    <span className="text-sm font-extrabold text-indigo-900 font-mono">
                      ₹{estimatedTotalCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hen House Mortality Count</label>
              <input
                type="number"
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 text-red-500 font-semibold"
                value={newLog.MortalityCount}
                onChange={e => {
                  const valStr = e.target.value;
                  setNewLog({ ...newLog, MortalityCount: valStr === '' ? '' : (parseInt(valStr) || 0) as any });
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Water Consumed (Ltr)</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold text-blue-600"
                value={newLog.WaterConsumed}
                onChange={e => {
                  const valStr = e.target.value;
                  setNewLog({ ...newLog, WaterConsumed: valStr === '' ? '' : (parseFloat(valStr) || 0) as any });
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Average Weight (Kg)</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold text-indigo-600"
                value={newLog.DailyAverageWeight}
                onChange={e => {
                  const valStr = e.target.value;
                  setNewLog({ ...newLog, DailyAverageWeight: valStr === '' ? '' : (parseFloat(valStr) || 0) as any });
                }}
              />
            </div>
          </div>

          {/* Mutual Eggs & Trays Conversion blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200 mt-2">
            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Egg className="h-3.5 w-3.5 text-emerald-600" />
                Fresh Eggs Collected (30 per Tray)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Eggs Count</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                    value={newLog.EggsCollected}
                    onChange={e => {
                      const valStr = e.target.value;
                      const val = valStr === '' ? '' : (parseInt(valStr) || 0);
                      const numericVal = valStr === '' ? 0 : (parseInt(valStr) || 0);
                      setNewLog({ ...newLog, EggsCollected: val as any });
                      setTraysInput(valStr === '' ? '' : String(Math.round((numericVal / 30) * 100) / 100));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Trays Equivalent</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                    value={traysInput}
                    onChange={e => {
                      const valStr = e.target.value;
                      setTraysInput(valStr);
                      const val = valStr === '' ? '' : (parseFloat(valStr) || 0);
                      setNewLog({ ...newLog, EggsCollected: val === '' ? 0 : Math.round(val * 30) });
                    }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 text-right">
                = {Math.floor((Number(newLog.EggsCollected) || 0) / 30)} Trays & {(Number(newLog.EggsCollected) || 0) % 30} Eggs
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <Egg className="h-3.5 w-3.5 text-amber-600" />
                Damaged/Cracked Eggs (30 per Tray)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Eggs Count</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                    value={newLog.DamagedEggsCollected}
                    onChange={e => {
                      const valStr = e.target.value;
                      const val = valStr === '' ? '' : (parseInt(valStr) || 0);
                      const numericVal = valStr === '' ? 0 : (parseInt(valStr) || 0);
                      setNewLog({ ...newLog, DamagedEggsCollected: val as any });
                      setDamagedTraysInput(valStr === '' ? '' : String(Math.round((numericVal / 30) * 100) / 100));
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold uppercase">Trays Equivalent</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                    value={damagedTraysInput}
                    onChange={e => {
                      const valStr = e.target.value;
                      setDamagedTraysInput(valStr);
                      const val = valStr === '' ? '' : (parseFloat(valStr) || 0);
                      setNewLog({ ...newLog, DamagedEggsCollected: val === '' ? 0 : Math.round(val * 30) });
                    }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1 text-right">
                = {Math.floor((Number(newLog.DamagedEggsCollected) || 0) / 30)} Trays & {(Number(newLog.DamagedEggsCollected) || 0) % 30} Eggs
              </div>
            </div>
          </div>

          {/* Personal Consumption & Gifts / Donations with price override calculations */}
          <div className="bg-orange-50/20 p-4 rounded-xl border border-orange-100/60 mt-2 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Flame className="h-4 w-4 text-orange-500 shrink-0" />
              Personal Consumption & Internal Gifting
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Birds Eaten by Self</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Quantity (Qty)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono font-bold text-orange-600"
                      value={newLog.BirdsEatenBySelf}
                      onChange={e => {
                        const valStr = e.target.value;
                        setNewLog({ ...newLog, BirdsEatenBySelf: valStr === '' ? '' : Math.max(0, parseInt(valStr) || 0) as any });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Value (₹/Bird)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 150"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono text-slate-700"
                      value={newLog.BirdsEatenValue}
                      onChange={e => {
                        const valStr = e.target.value;
                        setNewLog({ ...newLog, BirdsEatenValue: valStr === '' ? '' : Math.max(0, parseFloat(valStr) || 0) as any });
                      }}
                    />
                  </div>
                </div>
                {newLog.BirdsEatenBySelf > 0 && (
                  <div className="text-[10px] text-orange-600 font-semibold font-mono">
                    Ledger Outflow: -₹{(newLog.BirdsEatenBySelf * newLog.BirdsEatenValue).toFixed(2)} [Personal Consumption]
                  </div>
                )}
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Eggs Gifted to Someone</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Quantity (Qty)</label>
                    <input
                      type="number"
                      placeholder="e.g. 30"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono font-bold text-indigo-600"
                      value={newLog.EggsGifted}
                      onChange={e => {
                        const valStr = e.target.value;
                        setNewLog({ ...newLog, EggsGifted: valStr === '' ? '' : Math.max(0, parseInt(valStr) || 0) as any });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Value (₹/Egg)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono text-slate-700"
                      value={newLog.EggsGiftedValue}
                      onChange={e => {
                        const valStr = e.target.value;
                        setNewLog({ ...newLog, EggsGiftedValue: valStr === '' ? '' : Math.max(0, parseFloat(valStr) || 0) as any });
                      }}
                    />
                  </div>
                </div>
                {newLog.EggsGifted > 0 && (
                  <div className="text-[10px] text-indigo-600 font-semibold font-mono">
                    Ledger Outflow: -₹{(newLog.EggsGifted * newLog.EggsGiftedValue).toFixed(2)} [Gifts & Donations]
                  </div>
                )}
              </div>
            </div>
          </div>

          {feedAlert && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{feedAlert}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Daily Observations / Air / Temp / Nesting Notes</label>
            <textarea
              placeholder="e.g. Temperature 78F, healthy water flow, egg shells are firm structure."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={newLog.Notes}
              onChange={e => setNewLog({ ...newLog, Notes: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={cancelForm}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold smooth-hover flex items-center gap-2"
              id="submit-log-btn"
            >
              {submitting ? 'Processing...' : (editingLogId ? 'Save Updates' : 'Save Entries')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="logs-history-grid">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800 font-display">Daily Logs Ledger Flow</h3>
            <span className="text-xs text-slate-400 font-mono">Real-time inventory decrement calculations linked</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="px-5 py-3">Log Date</th>
                  <th className="px-5 py-3 col-flock">Flock Details</th>
                  <th className="px-5 py-3">Feeding Details</th>
                  <th className="px-5 py-3 text-red-500">Mortality</th>
                  <th className="px-5 py-3 text-emerald-600">Eggs Collected</th>
                  <th className="px-5 py-3">Feed Cost (₹)</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.Id} className="hover:bg-slate-50/50 smooth-hover" id={`log-row-${log.Id}`}>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">{(log.LogDate || '').split('T')[0]}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{log.FlockName}</div>
                        <div className="text-[11px] text-indigo-600 font-semibold font-mono">Weight: {log.DailyAverageWeight || 0} Kg</div>
                        {(log as any).AgeInDaysAtLog !== undefined && (log as any).AgeInDaysAtLog !== null && (
                          <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                            Age: {(log as any).AgeInDaysAtLog} days ({Math.floor((log as any).AgeInDaysAtLog / 7)}w {(log as any).AgeInDaysAtLog % 7}d)
                          </div>
                        )}
                        {(log as any).ClosingBirds !== undefined && (log as any).ClosingBirds !== null && (
                          <div className="text-[11px] text-slate-600 font-medium">
                            Closing Stock: <b className="font-mono text-slate-700">{(log as any).ClosingBirds}</b> birds
                          </div>
                        )}
                        {(log as any).HdepToday !== undefined && (log as any).HdepToday !== null && (
                          <div className="text-[11px] text-rose-600 font-bold">
                            HDEP %: <b className="font-mono">{(log as any).HdepToday.toFixed(1)}%</b>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-700">{log.FeedConsumedKg} Kg</span>
                        <div className="text-[11px] text-blue-600 font-semibold font-mono">Water: {log.WaterConsumed || 0} Ltr</div>
                        <div className="text-[11px] text-slate-400 font-mono italic mt-0.5">{log.FeedItemName || 'Manual Feed'}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        <div className="font-semibold text-red-600">{log.MortalityCount} birds</div>
                        {log.BirdsEatenBySelf > 0 && (
                          <div className="text-[10px] text-orange-600 font-bold">Self Eaten: {log.BirdsEatenBySelf} (@₹{log.BirdsEatenValue})</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-sans text-xs">
                        <div className="font-semibold text-emerald-600 font-mono">+{log.EggsCollected} eggs ({Math.round(log.EggsCollected / 30 * 10) / 10} Trays)</div>
                        <div className="text-[11px] text-slate-400 font-mono">+{log.DamagedEggsCollected} cracked ({Math.round(log.DamagedEggsCollected / 30 * 10) / 10} Trays)</div>
                        {log.EggsGifted > 0 && (
                          <div className="text-[10px] text-indigo-600 font-bold font-mono mt-1">Gifted: {log.EggsGifted} (@₹{log.EggsGiftedValue})</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold">₹{log.FeedCost?.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate" title={log.Notes}>{log.Notes || '-'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 ml-auto">
                          {canEdit && (
                            <button
                              onClick={() => startEditLog(log)}
                              className="p-1 px-2 border border-slate-200 hover:border-blue-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg smooth-hover text-xs flex gap-1 items-center cursor-pointer"
                              id={`edit-log-btn-${log.Id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => deleteLog(log.Id)}
                              className="p-1 px-2 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg smooth-hover text-xs flex gap-1 items-center cursor-pointer"
                              id={`del-log-btn-${log.Id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                              Revert
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <span className="text-[10px] text-slate-400 font-mono italic">Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-xs">No daily flock logs recorded yet. Add your first daily sheet entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
