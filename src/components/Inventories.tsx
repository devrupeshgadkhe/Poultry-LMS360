import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Sliders, ShoppingBag, ShieldAlert, Edit, Search } from 'lucide-react';
import { Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { inventoryService } from '../lib/dataService';

export default function Inventories({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItem, setNewItem] = useState({
    ItemName: '',
    Category: 'Feed',
    UnitOfMeasurement: 'Kg',
    UnitPrice: 0.50,
    SellingPrice: 0.75,
    CurrentStock: 1000,
    WeightPerUnit: 1.0,
    MinThreshold: 100,
    Notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const firstInput = document.querySelector('#add-inv-form input:not([type="hidden"]), #add-inv-form select, #add-inv-form textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (firstInput) {
          firstInput.removeAttribute('readonly');
          firstInput.removeAttribute('disabled');
          firstInput.focus();
          if (typeof (firstInput as any).select === 'function') {
            (firstInput as any).select();
          }
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [showAddForm]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await inventoryService.getInventories(farmId);
      setItems(data);
    } catch (e) {
      console.error('Supabase getInventories error, fallback to local:', e);
      try {
        const res = await fetch('/api/inventories');
        const data = await res.json();
        setItems(data);
      } catch (err) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newItem.ItemName) return alert('Please enter an item name.');
    try {
      setIsSubmitting(true);
      try {
        const itemPayload = {
          ...newItem,
          Category: newItem.Category as Inventory['Category']
        };
        if (editingItemId) {
          await inventoryService.updateInventory(farmId, editingItemId, itemPayload);
        } else {
          await inventoryService.createInventory(farmId, itemPayload);
        }
        setShowAddForm(false);
        setEditingItemId(null);
        setNewItem({
          ItemName: '',
          Category: 'Feed',
          UnitOfMeasurement: 'Kg',
          UnitPrice: 0.50,
          SellingPrice: 0.75,
          CurrentStock: 1000,
          WeightPerUnit: 1.0,
          MinThreshold: 100,
          Notes: ''
        });
        fetchItems();
      } catch (cloudErr: any) {
        console.error('Supabase inventory save error, fallback to local:', cloudErr);
        const url = editingItemId ? `/api/inventories/${editingItemId}` : '/api/inventories';
        const method = editingItemId ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': localStorage.getItem('userEmail') || 'admin'
          },
          body: JSON.stringify(newItem)
        });
        if (res.ok) {
          setShowAddForm(false);
          setEditingItemId(null);
          fetchItems();
        } else {
          const err = await res.json();
          alert(err.error || cloudErr.message || `Failed to ${editingItemId ? 'update' : 'create'} inventory item`);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      try {
        await inventoryService.deleteInventory(farmId, id);
        fetchItems();
      } catch (cloudErr) {
        console.error('Supabase inventory delete error, fallback to local:', cloudErr);
        await fetch(`/api/inventories/${id}`, {
          method: 'DELETE',
          headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
        });
        fetchItems();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      (item.ItemName || '').toLowerCase().includes(q) ||
      (item.Category || '').toLowerCase().includes(q) ||
      (item.Notes || '').toLowerCase().includes(q) ||
      (item.UnitOfMeasurement || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6" id="inventories-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            {t.stockTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.stockSub}</p>
        </div>
        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setEditingItemId(null);
            } else {
              setEditingItemId(null);
              setNewItem({
                ItemName: '',
                Category: 'Feed',
                UnitOfMeasurement: 'Kg',
                UnitPrice: 0.50,
                SellingPrice: 0.75,
                CurrentStock: 1000,
                WeightPerUnit: 1.0,
                MinThreshold: 100,
                Notes: ''
              });
              setShowAddForm(true);
            }
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold smooth-hover shadow-xs shrink-0 self-start sm:self-center"
          id="toggle-add-inv-btn"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {t.newItemBtn}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-inv-form">
          <h3 className="text-lg font-bold font-display text-slate-800">{editingItemId ? 'Edit General Store Item' : 'Add General Store Item'}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name / ID</label>
              <input
                type="text"
                required
                placeholder="e.g. Soya Meal Concentrate (G-4)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newItem.ItemName}
                onChange={e => setNewItem({ ...newItem, ItemName: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Storage Category</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newItem.Category}
                onChange={e => setNewItem({ ...newItem, Category: e.target.value })}
              >
                <option value="Feed">Feed (Layer/Milling Mash)</option>
                <option value="Raw Ingredient">Raw Ingredient (Cereals/Protein Concentrate)</option>
                <option value="Medicine">Medicine & Health</option>
                <option value="Equipment">Coop Equipment</option>
                <option value="Sales Item">Direct Sales Item</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit of Measurement</label>
              <input
                type="text"
                required
                placeholder="e.g. Kg, Bags, Bottles, Pcs"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={newItem.UnitOfMeasurement}
                onChange={e => setNewItem({ ...newItem, UnitOfMeasurement: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost Price Per Unit (₹)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={newItem.UnitPrice}
                onChange={e => setNewItem({ ...newItem, UnitPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Selling Price (₹)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={newItem.SellingPrice}
                onChange={e => setNewItem({ ...newItem, SellingPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current In-Stock Quantity</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={newItem.CurrentStock}
                onChange={e => setNewItem({ ...newItem, CurrentStock: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight Per Unit (Kg)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={newItem.WeightPerUnit}
                onChange={e => setNewItem({ ...newItem, WeightPerUnit: parseFloat(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Minimum Threshold (Alarm limit Check)</label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono text-red-500"
                value={newItem.MinThreshold}
                onChange={e => setNewItem({ ...newItem, MinThreshold: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Storage Slot Notes & Details</label>
            <textarea
              placeholder="e.g. Silo C-North Row. Store in ambient dry state."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={newItem.Notes}
              onChange={e => setNewItem({ ...newItem, Notes: e.target.value })}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
               type="button"
               onClick={() => {
                 setShowAddForm(false);
                 setEditingItemId(null);
                 setNewItem({
                   ItemName: '',
                   Category: 'Feed',
                   UnitOfMeasurement: 'Kg',
                   UnitPrice: 0.50,
                   SellingPrice: 0.75,
                   CurrentStock: 1000,
                   WeightPerUnit: 1.0,
                   MinThreshold: 100,
                   Notes: ''
                 });
               }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold smooth-hover ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              id="save-inv-btn"
            >
              {isSubmitting ? 'Saving...' : (editingItemId ? 'Update Item' : 'Commit Item')}
            </button>
          </div>
        </form>
      )}

      {/* Search and item tables */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="inv-history-grid">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 col-inv">
            <div>
              <h3 className="text-base font-semibold text-slate-800 font-display">Inventory Storage Slots</h3>
              <p className="text-xs text-slate-400 font-mono">Weighted average costing recalculates on procurements</p>
            </div>
            <div className="relative max-w-xs w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:outline-hidden focus:border-indigo-500 focus:bg-white smooth-hover"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="px-5 py-3 col-item">Item Name</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">In-Stock Quantity</th>
                  <th className="px-5 py-3 text-right">Landed Cost/Unit</th>
                  <th className="px-5 py-3 text-right">Selling Price</th>
                  <th className="px-5 py-3 text-right">Min Threshold</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isAlert = item.CurrentStock < item.MinThreshold;
                    return (
                      <tr key={item.Id} className={`hover:bg-slate-50/50 smooth-hover ${isAlert ? 'bg-amber-50/30' : ''}`} id={`inv-row-${item.Id}`}>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span>{item.ItemName}</span>
                            {isAlert && (
                              <span className="p-1 bg-amber-50 text-amber-600 rounded-sm" title="Stock alert below threshold!">
                                <ShieldAlert className="h-3 w-3 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase font-mono">{item.Category}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-800">
                          {item.CurrentStock.toLocaleString()} <span className="text-xs text-slate-400">{item.UnitOfMeasurement}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600">₹{item.UnitPrice.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-800 font-semibold font-sans">₹{item.SellingPrice.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-red-500 font-semibold">
                          {item.MinThreshold} {item.UnitOfMeasurement}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate" title={item.Notes}>{item.Notes || '-'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.Id);
                                setNewItem({
                                  ItemName: item.ItemName || '',
                                  Category: item.Category || 'Feed',
                                  UnitOfMeasurement: item.UnitOfMeasurement || 'Kg',
                                  UnitPrice: item.UnitPrice || 0,
                                  SellingPrice: item.SellingPrice || 0,
                                  CurrentStock: item.CurrentStock || 0,
                                  WeightPerUnit: item.WeightPerUnit || 1,
                                  MinThreshold: item.MinThreshold || 0,
                                  Notes: item.Notes || ''
                                });
                                setShowAddForm(true);
                              }}
                              className="p-1 px-2 border border-slate-200 hover:border-indigo-200 text-slate-400 hover:text-indigo-700 hover:bg-slate-50 rounded-lg smooth-hover text-xs flex gap-1 items-center"
                              id={`edit-inv-btn-${item.Id}`}
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => deleteItem(item.Id)}
                              className="p-1 px-2 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg smooth-hover text-xs flex gap-1 items-center"
                              id={`del-inv-btn-${item.Id}`}
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
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-xs">No matching store items found.</td>
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
