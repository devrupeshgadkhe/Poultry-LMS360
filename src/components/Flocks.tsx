import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, TrendingUp, Archive, Activity, Edit, X } from 'lucide-react';
import { Flock } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { flockService } from '../lib/dataService';

interface FlocksProps {
  currentLanguage?: Language;
}

export default function Flocks({ currentLanguage = 'en' }: FlocksProps) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFlock, setNewFlock] = useState({
    FlockName: '',
    Breed: '',
    InitialCount: 1000,
    ArrivalDate: new Date().toISOString().split('T')[0],
    StartDate: new Date().toISOString().split('T')[0],
    TotalPurchasePrice: 1500,
    Notes: ''
  });

  const [editingFlock, setEditingFlock] = useState<any | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFlocks();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-flock-form');
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

  const fetchFlocks = async () => {
    try {
      setLoading(true);
      const data = await flockService.getFlocks(farmId);
      setFlocks(data);
    } catch (e) {
      console.error('Supabase fetchFlocks error, trying local fallback:', e);
      try {
        const res = await fetch('/api/flocks');
        const data = await res.json();
        setFlocks(data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const validateFlock = (data: any) => {
    const errs: Record<string, string> = {};
    if (!data.FlockName || data.FlockName.trim() === '') {
      errs.FlockName = 'Flock Identifier is required';
    }
    if (!data.Breed || data.Breed.trim() === '') {
      errs.Breed = 'Breed is required';
    }
    if (typeof data.InitialCount !== 'number' || data.InitialCount <= 0) {
      errs.InitialCount = 'Initial bird count must be greater than 0';
    }
    if (typeof data.CurrentCount !== 'undefined') {
      if (typeof data.CurrentCount !== 'number' || data.CurrentCount < 0) {
        errs.CurrentCount = 'Current bird count cannot be negative';
      } else if (data.CurrentCount > data.InitialCount) {
        errs.CurrentCount = 'Current count cannot exceed initial deployment count';
      }
    }
    if (typeof data.TotalPurchasePrice !== 'number' || data.TotalPurchasePrice < 0) {
      errs.TotalPurchasePrice = 'Purchase price cannot be negative';
    }
    if (!data.ArrivalDate) {
      errs.ArrivalDate = 'Arrival Date is required';
    }
    if (!data.StartDate) {
      errs.StartDate = 'Production Start Date is required';
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validateFlock(newFlock);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    try {
      setIsSubmitting(true);
      await flockService.createFlock(farmId, newFlock);
      setShowAddForm(false);
      setNewFlock({
        FlockName: '',
        Breed: '',
        InitialCount: 1000,
        ArrivalDate: new Date().toISOString().split('T')[0],
        StartDate: new Date().toISOString().split('T')[0],
        TotalPurchasePrice: 1500,
        Notes: ''
      });
      fetchFlocks();
    } catch (err: any) {
      console.error('Error creating flock in Supabase:', err);
      // Fallback to local server
      try {
        const res = await fetch('/api/flocks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': localStorage.getItem('userEmail') || 'admin'
          },
          body: JSON.stringify(newFlock)
        });
        if (res.ok) {
          setShowAddForm(false);
          fetchFlocks();
        } else {
          alert(err.message || 'Failed to create flock');
        }
      } catch (fallbackErr) {
        alert(err.message || 'Failed to create flock');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !editingFlock) return;

    const validationErrors = validateFlock(editingFlock);
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }
    setEditErrors({});

    try {
      setIsSubmitting(true);
      await flockService.updateFlock(farmId, editingFlock.Id, editingFlock);
      setEditingFlock(null);
      fetchFlocks();
    } catch (err: any) {
      console.error('Error updating flock in Supabase:', err);
      try {
        const res = await fetch(`/api/flocks/${editingFlock.Id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': localStorage.getItem('userEmail') || 'admin'
          },
          body: JSON.stringify(editingFlock)
        });
        if (res.ok) {
          setEditingFlock(null);
          fetchFlocks();
        } else {
          alert(err.message || 'Failed to update flock');
        }
      } catch (fallbackErr) {
        alert(err.message || 'Failed to update flock');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteFlock = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flock record? All daily records will cascadingly deplete.')) return;
    try {
      await flockService.deleteFlock(farmId, id);
      fetchFlocks();
    } catch (e: any) {
      console.error('Error deleting flock in Supabase:', e);
      try {
        await fetch(`/api/flocks/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
        });
        fetchFlocks();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const closeFlock = async (id: number) => {
    if (!confirm('Close this flock? This sets status to Sold/Inactive.')) return;
    try {
      const target = flocks.find(f => f.Id === id);
      if (!target) return;
      const res = await fetch(`/api/flocks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': localStorage.getItem('userEmail') || 'admin'
        },
        body: JSON.stringify({
          ...target,
          Status: 'Sold',
          EndDate: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) fetchFlocks();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" id="flocks-module">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-indigo-600" />
            {t.activeLayerFlocksTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1">{t.flocksSub}</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingFlock(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold smooth-hover shadow-xs"
          id="toggle-add-flock-btn"
        >
          <Plus className="h-4 w-4" />
          {t.registerFlock}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-flock-form">
          <h3 className="text-lg font-bold font-display text-slate-800">New Layer Flock Parameters</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flock Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Batch #42 (Laying Houses)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.FlockName}
                onChange={e => setNewFlock({ ...newFlock, FlockName: e.target.value })}
              />
              {errors.FlockName && <p className="text-red-500 text-[11px] font-medium">{errors.FlockName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Breed / Genetic Variety</label>
              <input
                type="text"
                required
                placeholder="e.g. Lohmann Brown / Hy-Line"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.Breed}
                onChange={e => setNewFlock({ ...newFlock, Breed: e.target.value })}
              />
              {errors.Breed && <p className="text-red-500 text-[11px] font-medium">{errors.Breed}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Initial Chix/Bird Count</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.InitialCount}
                onChange={e => setNewFlock({ ...newFlock, InitialCount: parseInt(e.target.value) || 0 })}
              />
              {errors.InitialCount && <p className="text-red-500 text-[11px] font-medium">{errors.InitialCount}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Purchase Value (₹)</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.TotalPurchasePrice}
                onChange={e => setNewFlock({ ...newFlock, TotalPurchasePrice: parseFloat(e.target.value) || 0 })}
              />
              {errors.TotalPurchasePrice && <p className="text-red-500 text-[11px] font-medium">{errors.TotalPurchasePrice}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Arrival Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.ArrivalDate}
                onChange={e => setNewFlock({ ...newFlock, ArrivalDate: e.target.value })}
              />
              {errors.ArrivalDate && <p className="text-red-500 text-[11px] font-medium">{errors.ArrivalDate}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Production Lay Cycle Start</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newFlock.StartDate}
                onChange={e => setNewFlock({ ...newFlock, StartDate: e.target.value })}
              />
              {errors.StartDate && <p className="text-red-500 text-[11px] font-medium">{errors.StartDate}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes & House Layout Descriptions</label>
            <textarea
              placeholder="e.g. Housed under Cage-tier ventilation system standard setup"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={newFlock.Notes}
              onChange={e => setNewFlock({ ...newFlock, Notes: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold smooth-hover flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              id="save-flock-btn"
            >
              {isSubmitting ? 'Deploying...' : 'Confirm Deployment'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="flock-grid-list">
          {flocks.map((flock) => {
            const isEditing = editingFlock?.Id === flock.Id;

            if (isEditing) {
              return (
                <form
                  key={flock.Id}
                  onSubmit={handleUpdate}
                  className="bg-white rounded-2xl border border-indigo-200 shadow-md p-5 space-y-3"
                  id={`flock-edit-form-${flock.Id}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                    <h3 className="text-xs font-bold font-display text-indigo-950 uppercase tracking-wider">Edit Flock Parameters</h3>
                    <button
                      type="button"
                      onClick={() => { setEditingFlock(null); setEditErrors({}); }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-50 smooth-hover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="space-y-0.5">
                      <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Flock Identifier</label>
                      <input
                        type="text"
                        required
                        className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        value={editingFlock.FlockName}
                        onChange={e => setEditingFlock({ ...editingFlock, FlockName: e.target.value })}
                      />
                      {editErrors.FlockName && <p className="text-red-500 text-[10px] font-medium">{editErrors.FlockName}</p>}
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Breed / Genetic Variety</label>
                      <input
                        type="text"
                        required
                        className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        value={editingFlock.Breed}
                        onChange={e => setEditingFlock({ ...editingFlock, Breed: e.target.value })}
                      />
                      {editErrors.Breed && <p className="text-red-500 text-[10px] font-medium">{editErrors.Breed}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Initial Count</label>
                        <input
                          type="number"
                          required
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.InitialCount}
                          onChange={e => setEditingFlock({ ...editingFlock, InitialCount: parseInt(e.target.value) || 0 })}
                        />
                        {editErrors.InitialCount && <p className="text-red-500 text-[10px] font-medium">{editErrors.InitialCount}</p>}
                      </div>

                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Current Count</label>
                        <input
                          type="number"
                          required
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.CurrentCount}
                          onChange={e => setEditingFlock({ ...editingFlock, CurrentCount: parseInt(e.target.value) || 0 })}
                        />
                        {editErrors.CurrentCount && <p className="text-red-500 text-[10px] font-medium">{editErrors.CurrentCount}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Purchase Value (₹)</label>
                        <input
                          type="number"
                          required
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.TotalPurchasePrice}
                          onChange={e => setEditingFlock({ ...editingFlock, TotalPurchasePrice: parseFloat(e.target.value) || 0 })}
                        />
                        {editErrors.TotalPurchasePrice && <p className="text-red-500 text-[10px] font-medium">{editErrors.TotalPurchasePrice}</p>}
                      </div>

                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Status</label>
                        <select
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.Status}
                          onChange={e => setEditingFlock({ ...editingFlock, Status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Sold">Sold</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Arrival Date</label>
                        <input
                          type="date"
                          required
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.ArrivalDate?.split('T')[0]}
                          onChange={e => setEditingFlock({ ...editingFlock, ArrivalDate: e.target.value })}
                        />
                        {editErrors.ArrivalDate && <p className="text-red-500 text-[10px] font-medium">{editErrors.ArrivalDate}</p>}
                      </div>

                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Lay Cycle Start</label>
                        <input
                          type="date"
                          required
                          className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.StartDate?.split('T')[0]}
                          onChange={e => setEditingFlock({ ...editingFlock, StartDate: e.target.value })}
                        />
                        {editErrors.StartDate && <p className="text-red-500 text-[10px] font-medium">{editErrors.StartDate}</p>}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Notes & House Descriptions</label>
                      <textarea
                        rows={2}
                        className="w-full px-2 py-1 border border-slate-200 rounded-md bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                        value={editingFlock.Notes || ''}
                        onChange={e => setEditingFlock({ ...editingFlock, Notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => { setEditingFlock(null); setEditErrors({}); }}
                      className="px-2.5 py-1 text-slate-600 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold smooth-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold smooth-hover ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              );
            }

             const hasLosing = flock.InitialCount - flock.CurrentCount;
            return (
              <div
                key={flock.Id}
                className={`bg-white rounded-2xl border ${flock.Status === 'Active' ? 'border-slate-200/80 shadow-xs' : 'border-slate-200 bg-slate-50/40 opacity-75'} p-5 space-y-4`}
                id={`flock-item-${flock.Id}`}
              >
                {/* Header Section */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${flock.Status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                      {flock.Status}
                    </span>
                    <h3 className="text-lg font-bold font-display text-slate-800 mt-1">{flock.FlockName}</h3>
                    <p className="text-xs text-slate-400 font-mono italic mt-0.5">{flock.Breed}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {flock.Status === 'Active' && (
                      <button
                        onClick={() => closeFlock(flock.Id)}
                        title="Finalize & Close Flock"
                        className="p-1 px-2 border border-slate-200 hover:border-slate-400 rounded-lg text-slate-500 hover:text-slate-700 smooth-hover text-xs flex items-center gap-1"
                      >
                        <Archive className="h-3 w-3" />
                        Sell
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingFlock({ ...flock });
                        setEditErrors({});
                      }}
                      title="Edit Flock Parameters"
                      className="p-1.5 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-slate-400 hover:text-indigo-600 smooth-hover"
                      id={`edit-flock-btn-${flock.Id}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteFlock(flock.Id)}
                      className="p-1.5 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-slate-400 hover:text-rose-600 smooth-hover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Age Calendar Track */}
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div className="flex justify-between w-full">
                    <span>{t.launched}: <b className="font-mono">{(flock.ArrivalDate || '').split('T')[0]}</b></span>
                    <span>{t.ageDays}: <b className="font-mono text-slate-800">{flock.AgeInDays}</b></span>
                  </div>
                </div>

                {/* Flock KPIs Bento Section */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-medium">{t.headBalance}</span>
                    <div className="text-sm font-bold text-slate-800 mt-1">
                      {flock.CurrentCount} / {flock.InitialCount}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-medium font-display">{t.mortalityRate}</span>
                    <div className="text-sm font-bold text-red-600 mt-1 font-mono">
                      {(Number(flock.MortalityRate) || 0).toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-medium font-display">{t.avgLayingRate}</span>
                    <div className="text-sm font-bold text-amber-600 mt-1 font-mono">
                      {(Number(flock.HDP) || 0).toFixed(1)}%
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl">
                    <span className="text-slate-400 font-medium font-display">{t.perBirdPrice}</span>
                    <div className="text-sm font-bold text-slate-800 mt-1 font-mono">
                      ₹{(Number(flock.PerBirdPurchasePrice) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Aggregate Accumulators Outlays */}
                <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>{t.cumulativeValue}:</span>
                    <span className="font-mono font-bold text-slate-700">₹{(Number(flock.TotalPurchasePrice) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.accruedFeedCost}:</span>
                    <span className="font-mono font-bold text-slate-700">₹{(Number(flock.TotalFeedCost) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.vaccineCost}:</span>
                    <span className="font-mono font-bold text-slate-700">₹{(Number(flock.TotalVaccineCost) || 0).toFixed(2)}</span>
                  </div>

                  {/* Per Egg Production Cost dynamic highlight */}
                  <div className="flex justify-between bg-indigo-50/60 p-2 rounded-xl mt-3 border border-indigo-100/40">
                    <span className="text-indigo-900 font-bold font-sans">{t.perEggProductionCost}:</span>
                    <span className="font-mono font-black text-indigo-700">₹{(Number(flock.PerEggCost) || 0).toFixed(2)}</span>
                  </div>
                </div>

                {flock.Notes && (
                  <p className="text-xs italic text-slate-400 border-t border-slate-50 pt-2 shrink-0">{flock.Notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
