import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, TrendingUp, Archive, Activity, Edit, X, CheckCircle, AlertTriangle } from 'lucide-react';
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

  // New flock state with arrival age in weeks and days
  const [newFlock, setNewFlock] = useState({
    FlockName: '',
    Breed: '',
    InitialCount: 1000,
    ArrivalDate: new Date().toISOString().split('T')[0],
    StartDate: new Date().toISOString().split('T')[0],
    TotalPurchasePrice: 1500,
    ArrivalAgeWeeks: 0,
    ArrivalAgeDays: 0,
    AgeInDays: 0,
    Notes: ''
  });

  const [editingFlock, setEditingFlock] = useState<any | null>(null);
  const [flockToDelete, setFlockToDelete] = useState<any | null>(null);
  const [flockToClose, setFlockToClose] = useState<any | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchFlocks();
  }, [farmId]);

  // Auto-dismiss notification after 3.5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Programmatic focus for keyboard compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-flock-form');
        if (activeForm) {
          const firstInput = activeForm.querySelector('input:not([type="hidden"]), select, textarea') as HTMLInputElement;
          if (firstInput) {
            firstInput.focus();
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
        const res = await fetch(`/api/flocks?farmId=${farmId}`);
        const data = await res.json();
        setFlocks(data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Vice-versa conversion for New Flock
  const handleNewArrivalWeeksChange = (weeksVal: string) => {
    const weeks = parseFloat(weeksVal);
    if (isNaN(weeks) || weeks < 0) {
      setNewFlock(prev => ({ ...prev, ArrivalAgeWeeks: 0, ArrivalAgeDays: 0, AgeInDays: 0 }));
      return;
    }
    const totalDays = Math.round(weeks * 7);
    setNewFlock(prev => ({
      ...prev,
      ArrivalAgeWeeks: weeks,
      ArrivalAgeDays: totalDays,
      AgeInDays: totalDays
    }));
  };

  const handleNewArrivalDaysChange = (daysVal: string) => {
    const days = parseInt(daysVal, 10);
    if (isNaN(days) || days < 0) {
      setNewFlock(prev => ({ ...prev, ArrivalAgeWeeks: 0, ArrivalAgeDays: 0, AgeInDays: 0 }));
      return;
    }
    const weeks = Number((days / 7).toFixed(1));
    setNewFlock(prev => ({
      ...prev,
      ArrivalAgeDays: days,
      ArrivalAgeWeeks: weeks,
      AgeInDays: days
    }));
  };

  // Vice-versa conversion for Editing Flock
  const handleEditArrivalWeeksChange = (weeksVal: string) => {
    const weeks = parseFloat(weeksVal);
    if (isNaN(weeks) || weeks < 0) {
      setEditingFlock((prev: any) => ({ ...prev, ArrivalAgeWeeks: 0, ArrivalAgeDays: 0, AgeInDays: 0 }));
      return;
    }
    const totalDays = Math.round(weeks * 7);
    setEditingFlock((prev: any) => ({
      ...prev,
      ArrivalAgeWeeks: weeks,
      ArrivalAgeDays: totalDays,
      AgeInDays: totalDays
    }));
  };

  const handleEditArrivalDaysChange = (daysVal: string) => {
    const days = parseInt(daysVal, 10);
    if (isNaN(days) || days < 0) {
      setEditingFlock((prev: any) => ({ ...prev, ArrivalAgeWeeks: 0, ArrivalAgeDays: 0, AgeInDays: 0 }));
      return;
    }
    const weeks = Number((days / 7).toFixed(1));
    setEditingFlock((prev: any) => ({
      ...prev,
      ArrivalAgeDays: days,
      ArrivalAgeWeeks: weeks,
      AgeInDays: days
    }));
  };

  const startEditFlock = (flock: any) => {
    const arrivalDays = Number(flock.ArrivalAgeDays ?? flock.AgeInDays) || 0;
    const arrivalWeeks = Number((arrivalDays / 7).toFixed(1));
    setEditingFlock({
      ...flock,
      ArrivalAgeDays: arrivalDays,
      ArrivalAgeWeeks: arrivalWeeks,
      AgeInDays: arrivalDays,
      ArrivalDate: (flock.ArrivalDate || '').split('T')[0],
      StartDate: (flock.StartDate || flock.ArrivalDate || '').split('T')[0],
      EndDate: flock.EndDate ? flock.EndDate.split('T')[0] : ''
    });
    setEditErrors({});
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
        ArrivalAgeWeeks: 0,
        ArrivalAgeDays: 0,
        AgeInDays: 0,
        Notes: ''
      });
      setNotification({ type: 'success', message: 'Flock registered successfully.' });
      fetchFlocks();
    } catch (err: any) {
      console.error('Error creating flock in Supabase:', err);
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
          setNotification({ type: 'success', message: 'Flock registered successfully.' });
          fetchFlocks();
        } else {
          setErrors({ form: err.message || 'Failed to create flock' });
        }
      } catch (fallbackErr: any) {
        setErrors({ form: err.message || 'Failed to create flock' });
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
      const updatedName = editingFlock.FlockName;
      setEditingFlock(null);
      setNotification({ type: 'success', message: `Flock "${updatedName}" updated successfully.` });
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
          setNotification({ type: 'success', message: 'Flock updated successfully.' });
          fetchFlocks();
        } else {
          setEditErrors({ form: err.message || 'Failed to update flock' });
        }
      } catch (fallbackErr: any) {
        setEditErrors({ form: err.message || 'Failed to update flock' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteFlock = async (id: number) => {
    try {
      setIsSubmitting(true);
      await flockService.deleteFlock(farmId, id);
      setFlockToDelete(null);
      setNotification({ type: 'success', message: 'Flock and linked logs removed successfully.' });
      window.dispatchEvent(new CustomEvent('farm-data-updated'));
      fetchFlocks();
    } catch (e: any) {
      console.error('Error deleting flock in Supabase:', e);
      try {
        await fetch(`/api/flocks/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
        });
        setFlockToDelete(null);
        setNotification({ type: 'success', message: 'Flock removed successfully.' });
        window.dispatchEvent(new CustomEvent('farm-data-updated'));
        fetchFlocks();
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Failed to delete flock' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCloseFlock = async (id: number) => {
    try {
      setIsSubmitting(true);
      const target = flocks.find(f => f.Id === id);
      if (!target) return;
      await flockService.updateFlock(farmId, id, {
        ...target,
        Status: 'Sold',
        IsActive: 0,
        EndDate: new Date().toISOString().split('T')[0]
      });
      setFlockToClose(null);
      setNotification({ type: 'success', message: `Flock "${target.FlockName}" marked as Sold/Closed.` });
      fetchFlocks();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to close flock' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="flocks-module">
      {/* Toast Notification Banner (No window.alert) */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in slide-in-from-top-2 duration-200 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
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
            setErrors({});
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold smooth-hover shadow-xs cursor-pointer"
          id="toggle-add-flock-btn"
        >
          <Plus className="h-4 w-4" />
          {t.registerFlock}
        </button>
      </div>

      {/* Add New Flock Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-flock-form">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold font-display text-slate-800">New Layer Flock Parameters</h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              {errors.form}
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flock Identifier</label>
              <input
                type="text"
                required
                placeholder="e.g. Batch #42 (Laying House A)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                placeholder="e.g. BV 300 / Lohmann Brown"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                value={newFlock.Breed}
                onChange={e => setNewFlock({ ...newFlock, Breed: e.target.value })}
              />
              {errors.Breed && <p className="text-red-500 text-[11px] font-medium">{errors.Breed}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Initial Chix / Bird Count</label>
              <input
                type="number"
                required
                min="1"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                value={newFlock.StartDate}
                onChange={e => setNewFlock({ ...newFlock, StartDate: e.target.value })}
              />
              {errors.StartDate && <p className="text-red-500 text-[11px] font-medium">{errors.StartDate}</p>}
            </div>
          </div>

          {/* Age at Time of Arrival with Vice-Versa Weeks/Days Conversion */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Age at Time of Arrival
              </label>
              <span className="text-[11px] font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {Math.floor((Number(newFlock.ArrivalAgeDays) || 0) / 7)} Wks {((Number(newFlock.ArrivalAgeDays) || 0) % 7)} Days ({newFlock.ArrivalAgeDays || 0} Total Days)
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Age in Weeks</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 18"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pr-12"
                    value={newFlock.ArrivalAgeWeeks === 0 && newFlock.ArrivalAgeDays === 0 ? '' : newFlock.ArrivalAgeWeeks}
                    onChange={e => handleNewArrivalWeeksChange(e.target.value)}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs font-semibold text-slate-400">Weeks</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Age in Days (Vice-Versa)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 126"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pr-12"
                    value={newFlock.ArrivalAgeDays === 0 && newFlock.ArrivalAgeWeeks === 0 ? '' : newFlock.ArrivalAgeDays}
                    onChange={e => handleNewArrivalDaysChange(e.target.value)}
                  />
                  <span className="absolute right-2.5 top-2.5 text-xs font-semibold text-slate-400">Days</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              Entering weeks auto-converts to days (1 week = 7 days), and entering days auto-converts to weeks. Day-old chicks (DOC) = 0 weeks / 1 day.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes & House Layout Descriptions</label>
            <textarea
              placeholder="e.g. Housed under Shed 2 with automatic nipple drinkers"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              value={newFlock.Notes}
              onChange={e => setNewFlock({ ...newFlock, Notes: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold smooth-hover flex items-center gap-2 cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              id="save-flock-btn"
            >
              {isSubmitting ? 'Saving...' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      )}

      {/* Flocks Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
                  className="bg-white rounded-2xl border-2 border-indigo-500 shadow-xl p-5 space-y-3"
                  id={`flock-edit-form-${flock.Id}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <h3 className="text-xs font-bold font-display text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5 text-indigo-600" />
                      Edit Flock Information
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setEditingFlock(null); setEditErrors({}); }}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {editErrors.form && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                      {editErrors.form}
                    </div>
                  )}

                  <div className="space-y-2.5 text-[11px]">
                    <div className="space-y-0.5">
                      <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Flock Identifier</label>
                      <input
                        type="text"
                        required
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs"
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
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs"
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
                          min="1"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          min="0"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          min="0"
                          step="any"
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.TotalPurchasePrice}
                          onChange={e => setEditingFlock({ ...editingFlock, TotalPurchasePrice: parseFloat(e.target.value) || 0 })}
                        />
                        {editErrors.TotalPurchasePrice && <p className="text-red-500 text-[10px] font-medium">{editErrors.TotalPurchasePrice}</p>}
                      </div>

                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Status</label>
                        <select
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.Status}
                          onChange={e => setEditingFlock({ ...editingFlock, Status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Sold">Sold</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Arrival Date</label>
                        <input
                          type="date"
                          required
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.ArrivalDate}
                          onChange={e => setEditingFlock({ ...editingFlock, ArrivalDate: e.target.value })}
                        />
                        {editErrors.ArrivalDate && <p className="text-red-500 text-[10px] font-medium">{editErrors.ArrivalDate}</p>}
                      </div>

                      <div className="space-y-0.5">
                        <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Lay Cycle Start</label>
                        <input
                          type="date"
                          required
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          value={editingFlock.StartDate}
                          onChange={e => setEditingFlock({ ...editingFlock, StartDate: e.target.value })}
                        />
                        {editErrors.StartDate && <p className="text-red-500 text-[10px] font-medium">{editErrors.StartDate}</p>}
                      </div>
                    </div>

                    {/* Edit Arrival Age with Vice-Versa Sync */}
                    <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-indigo-900 uppercase">Age at Arrival (Synced)</label>
                        <span className="text-[10px] font-mono font-semibold text-indigo-700">
                          {Math.floor((Number(editingFlock.ArrivalAgeDays) || 0) / 7)}w {((Number(editingFlock.ArrivalAgeDays) || 0) % 7)}d ({editingFlock.ArrivalAgeDays || 0}d)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-500">Weeks</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white font-mono text-xs"
                            value={editingFlock.ArrivalAgeWeeks ?? ''}
                            onChange={e => handleEditArrivalWeeksChange(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500">Days (Vice-Versa)</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white font-mono text-xs"
                            value={editingFlock.ArrivalAgeDays ?? ''}
                            onChange={e => handleEditArrivalDaysChange(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <label className="font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Notes & House Descriptions</label>
                      <textarea
                        rows={2}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        value={editingFlock.Notes || ''}
                        onChange={e => setEditingFlock({ ...editingFlock, Notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setEditingFlock(null); setEditErrors({}); }}
                      className="px-3 py-1.5 text-slate-600 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              );
            }

            // Calculations for display
            const currentWeeks = flock.AgeWeeks ?? Math.floor((flock.AgeInDays || 0) / 7);
            const currentRemDays = flock.AgeDaysRem ?? ((flock.AgeInDays || 0) % 7);
            const arrivalDays = Number(flock.ArrivalAgeDays ?? 0);
            const arrivalWeeks = Math.floor(arrivalDays / 7);
            const arrivalRemDays = arrivalDays % 7;

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
                        onClick={() => setFlockToClose(flock)}
                        title="Finalize & Close Flock"
                        className="p-1 px-2 border border-slate-200 hover:border-slate-400 rounded-lg text-slate-500 hover:text-slate-700 smooth-hover text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Archive className="h-3 w-3" />
                        Sell
                      </button>
                    )}
                    <button
                      onClick={() => startEditFlock(flock)}
                      title="Edit Flock Parameters"
                      className="p-1.5 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-slate-400 hover:text-indigo-600 smooth-hover cursor-pointer"
                      id={`edit-flock-btn-${flock.Id}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setFlockToDelete(flock)}
                      title="Delete Flock"
                      className="p-1.5 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg text-slate-400 hover:text-rose-600 smooth-hover cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Age & Date Tracker Badge (Comprehensive Breakdown) */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      Current Age:
                    </span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                      {currentWeeks} Wks {currentRemDays} Days <span className="text-slate-400 font-normal">({flock.AgeInDays || 0}d)</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-1.5">
                    <span>Arrival Age:</span>
                    <span className="font-mono font-medium text-slate-700">
                      {arrivalWeeks} Wks {arrivalRemDays} Days ({arrivalDays}d)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t.launched}:</span>
                    <span className="font-mono font-medium text-slate-700">
                      {(flock.ArrivalDate || '').split('T')[0]}
                    </span>
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

      {/* Modern In-App Confirmation Modal for Deletion (No window.confirm / alert) */}
      {flockToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Flock</h3>
                <p className="text-xs text-slate-500">Confirmation required</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Are you sure you want to delete <b className="text-slate-900 font-semibold">"{flockToDelete.FlockName}"</b>?
            </p>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs text-rose-700">
              This action will permanently delete this flock along with all linked daily logs, mortality records, and egg collection statistics.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFlockToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => confirmDeleteFlock(flockToDelete.Id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete Flock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern In-App Confirmation Modal for Closing Flock */}
      {flockToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Close / Finalize Flock</h3>
                <p className="text-xs text-slate-500">Status change confirmation</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Finalize and mark flock <b className="text-slate-900 font-semibold">"{flockToClose.FlockName}"</b> as Sold/Inactive?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFlockToClose(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => confirmCloseFlock(flockToClose.Id)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Finalizing...' : 'Yes, Finalize Flock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
