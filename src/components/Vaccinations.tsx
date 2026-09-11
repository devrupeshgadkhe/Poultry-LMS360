import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, HeartPulse, User, Edit2, ShieldAlert, Clock } from 'lucide-react';
import { Vaccination, Flock } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { vaccinationService, flockService } from '../lib/dataService';

export default function Vaccinations({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [vaccines, setVaccines] = useState<any[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVaccineId, setEditingVaccineId] = useState<number | null>(null);

  const [newVaccine, setNewVaccine] = useState({
    FlockId: '',
    VaccineName: '',
    Date: new Date().toISOString().split('T')[0],
    Cost: 60.00,
    AdministeredBy: '',
    Notes: '',
    Phase: 'Administered', // 'Administered' | 'Scheduled'
    ScheduledDate: ''
  });

  useEffect(() => {
    fetchVaccines();
    fetchFlocks();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-vac-form');
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

  const fetchVaccines = async () => {
    try {
      setLoading(true);
      const data = await vaccinationService.getVaccinations(farmId);
      setVaccines(data);
    } catch (e) {
      console.error('Supabase getVaccinations error, fallback to local:', e);
      try {
        const res = await fetch('/api/vaccinations');
        const data = await res.json();
        setVaccines(data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFlocks = async () => {
    try {
      try {
        const flockData = await flockService.getFlocks(farmId);
        setFlocks(flockData.filter((f: Flock) => f.Status === 'Active'));
      } catch {
        const res = await fetch('/api/flocks');
        const data = await res.json();
        setFlocks(data.filter((f: Flock) => f.Status === 'Active'));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaccine.FlockId) return alert('Please select a flock.');
    
    // Validate if Phase is Scheduled, we must have a Scheduled Date
    if (newVaccine.Phase === 'Scheduled' && !newVaccine.ScheduledDate) {
      alert('Please specify a scheduled target date.');
      return;
    }

    try {
      const payload = {
        ...newVaccine,
        FlockId: parseInt(newVaccine.FlockId),
        Phase: newVaccine.Phase as 'Administered' | 'Scheduled',
        ScheduledDate: newVaccine.Phase === 'Scheduled' ? newVaccine.ScheduledDate : null
      };

      try {
        await vaccinationService.createVaccination(farmId, payload);
        cancelForm();
        fetchVaccines();
      } catch (cloudErr: any) {
        console.error('Supabase createVaccination error, fallback to local:', cloudErr);
        const url = editingVaccineId ? `/api/vaccinations/${editingVaccineId}` : '/api/vaccinations';
        const method = editingVaccineId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': localStorage.getItem('userEmail') || 'admin'
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          cancelForm();
          fetchVaccines();
        } else {
          const err = await res.json();
          alert(err.error || cloudErr.message || 'Failed to save vaccination');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditVaccine = (v: any) => {
    setEditingVaccineId(v.Id);
    setNewVaccine({
      FlockId: String(v.FlockId),
      VaccineName: v.VaccineName || '',
      Date: v.Date ? v.Date.split('T')[0] : new Date().toISOString().split('T')[0],
      Cost: v.Cost || 0,
      AdministeredBy: v.AdministeredBy || '',
      Notes: v.Notes || '',
      Phase: v.Phase || 'Administered',
      ScheduledDate: v.ScheduledDate ? v.ScheduledDate.split('T')[0] : ''
    });
    setShowAddForm(true);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingVaccineId(null);
    setNewVaccine({
      FlockId: '',
      VaccineName: '',
      Date: new Date().toISOString().split('T')[0],
      Cost: 60.00,
      AdministeredBy: '',
      Notes: '',
      Phase: 'Administered',
      ScheduledDate: ''
    });
  };

  const deleteVaccine = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vaccination schedule record?')) return;
    try {
      try {
        await vaccinationService.deleteVaccination(farmId, id);
        fetchVaccines();
      } catch (cloudErr) {
        console.error('Supabase deleteVaccination error, fallback to local:', cloudErr);
        await fetch(`/api/vaccinations/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
        });
        fetchVaccines();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to calculate alert warning
  const isAlertUpcoming = (v: any) => {
    if (v.Phase !== 'Scheduled' || !v.ScheduledDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(v.ScheduledDate);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  // Total alert warnings active
  const activeAlertCount = vaccines.filter(isAlertUpcoming).length;

  return (
    <div className="space-y-6" id="vaccinations-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 sm:h-7 sm:w-7 text-rose-500 shrink-0" />
            {t.vaccineTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.vaccineSub}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {activeAlertCount > 0 && (
            <div className="px-3 py-1 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-lg animate-pulse flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-red-600 animate-bounce" />
              <span>{activeAlertCount} vaccine alert(s) due soon</span>
            </div>
          )}
          
          <button
            onClick={() => {
              if (showAddForm) {
                cancelForm();
              } else {
                setShowAddForm(true);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold smooth-hover shadow-xs shrink-0 self-start sm:self-center"
            id="toggle-add-vac-btn"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {editingVaccineId ? 'Editing Record' : t.logVaccineBtn}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-vac-form">
          <h3 className="text-lg font-bold font-display text-slate-800 font-display">
            {editingVaccineId ? 'Edit Flock Immunization Record' : 'Log Flock Immunization'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Active Flock</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newVaccine.FlockId}
                onChange={e => setNewVaccine({ ...newVaccine, FlockId: e.target.value })}
              >
                <option value="">-- Choose Active Flock --</option>
                {flocks.map(f => (
                  <option key={f.Id} value={f.Id}>{f.FlockName} ({f.Breed})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vaccine / Vial Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Newcastle Lasota / Gumboro"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newVaccine.VaccineName}
                onChange={e => setNewVaccine({ ...newVaccine, VaccineName: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phase / Status</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold text-slate-800"
                value={newVaccine.Phase}
                onChange={e => {
                  const val = e.target.value;
                  setNewVaccine({
                    ...newVaccine, 
                    Phase: val,
                    ScheduledDate: val === 'Scheduled' && !newVaccine.ScheduledDate 
                      ? new Date(Date.now() + 86400000).toISOString().split('T')[0] // default Tomorrow
                      : newVaccine.ScheduledDate
                  });
                }}
              >
                <option value="Administered">🎯 Administered (Completed)</option>
                <option value="Scheduled">⏳ Scheduled (Planned)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Log Record Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newVaccine.Date}
                onChange={e => setNewVaccine({ ...newVaccine, Date: e.target.value })}
              />
            </div>

            {newVaccine.Phase === 'Scheduled' && (
              <div className="space-y-1 animate-fade-in sm:col-span-2 bg-rose-50/30 p-3 rounded-xl border border-rose-100">
                <label className="text-xs font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Scheduled Target Date (Alert triggers 2 days before)
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white font-semibold text-rose-600 focus:ring-1 focus:ring-rose-300 outline-hidden"
                  value={newVaccine.ScheduledDate}
                  onChange={e => setNewVaccine({ ...newVaccine, ScheduledDate: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-1 col-span-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Acquisition Cost (₹)</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={newVaccine.Cost}
                onChange={e => setNewVaccine({ ...newVaccine, Cost: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Administered By / Contact</label>
              <input
                type="text"
                placeholder="e.g. Dr. Arthur Pendelton (Vet Inspector)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newVaccine.AdministeredBy}
                onChange={e => setNewVaccine({ ...newVaccine, AdministeredBy: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes & Reaction Observations</label>
            <textarea
              placeholder="e.g. Administered via oral water dropper. Monitor for side-effects."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={newVaccine.Notes}
              onChange={e => setNewVaccine({ ...newVaccine, Notes: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold smooth-hover flex items-center gap-1 animate-fade-in"
              id="save-vac-btn"
            >
              <ShieldCheck className="h-4 w-4" />
              {editingVaccineId ? 'Save Changes' : 'Save Record'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="vac-history-grid">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800 font-display">Immunization History</h3>
            <span className="text-xs text-indigo-600 font-semibold font-mono bg-indigo-50 px-2.5 py-1 rounded-full">Automated Cost Accumulations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="px-5 py-3 col-date">Date</th>
                  <th className="px-5 py-3">Flock</th>
                  <th className="px-5 py-3 col-vaccine">Vaccine Name</th>
                  <th className="px-5 py-3">Phase / Status</th>
                  <th className="px-5 py-3">Direct Cost</th>
                  <th className="px-5 py-3">Administered By</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vaccines.length > 0 ? (
                  vaccines.map((v) => {
                    const alertActive = isAlertUpcoming(v);
                    
                    return (
                      <tr key={v.Id} className={`smooth-hover ${alertActive ? 'bg-red-50/40 hover:bg-red-50/80' : 'hover:bg-slate-50/50'}`} id={`vac-row-${v.Id}`}>
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                          {(v.Date || '').split('T')[0]}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{v.FlockName}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-indigo-700 bg-indigo-50/65 border border-indigo-100/40 px-2.5 py-0.5 rounded-md text-xs">{v.VaccineName}</span>
                          {/* Alert notes if scheduled */}
                          {v.Phase === 'Scheduled' && v.ScheduledDate && (
                            <div className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              Scheduled: <b className={`${alertActive ? 'text-red-650' : 'text-slate-600'}`}>{(v.ScheduledDate || '').split('T')[0]}</b>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {v.Phase === 'Scheduled' ? (
                            alertActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-800 bg-red-100 border border-red-200 rounded-lg animate-pulse">
                                <ShieldAlert className="h-3.5 w-3.5 text-red-600 animate-bounce" /> Scheduled (Alert)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100/60 rounded-lg">
                                <Clock className="h-3.5 w-3.5 text-indigo-400" /> Scheduled
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Administered
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-slate-800">
                          ₹{(Number(v.Cost) || 0).toFixed(2)}
                          {v.Phase === 'Administered' && (Number(v.Cost) || 0) > 0 && (
                            <div className="text-[9px] text-emerald-600 italic font-semibold">Logged in Ledger</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{v.AdministeredBy || 'Farm Staff'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEditVaccine(v)}
                              className="p-1 px-2 border border-slate-200 hover:border-blue-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg smooth-hover text-xs flex gap-1 items-center"
                              id={`edit-vac-btn-${v.Id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => deleteVaccine(v.Id)}
                              className="p-1 px-2 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg smooth-hover text-xs flex gap-1 items-center"
                              id={`del-vac-btn-${v.Id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">No vaccinations logged yet. Log the health charts to track vaccine ROI.</td>
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
