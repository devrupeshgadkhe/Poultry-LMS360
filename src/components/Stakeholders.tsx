import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Building2, Phone, Mail, MapPin, Edit, Search } from 'lucide-react';
import { Customer, Supplier } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { stakeholderService, salesService, purchaseService, financeService } from '../lib/dataService';

export default function Stakeholders({ currentLanguage = 'en', mode }: { currentLanguage?: Language; mode?: 'Customers' | 'Suppliers' }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [activeTab, setActiveTab] = useState<'Customers' | 'Suppliers'>('Customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState<Customer | null>(null);
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState<Supplier | null>(null);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified Form Fields
  const [cForm, setCForm] = useState({
    FullName: '',
    Email: '',
    Phone: '',
    Company: '',
    OpeningCreditBalance: 0,
    CurrentCreditBalance: 0,
    Address: ''
  });

  const [sForm, setSForm] = useState({
    CompanyName: '',
    ContactPerson: '',
    Email: '',
    Phone: '',
    OpeningCreditBalance: 0,
    CurrentCreditBalance: 0,
    Address: ''
  });

  useEffect(() => {
    if (mode) {
      setActiveTab(mode);
    }
  }, [mode]);

  useEffect(() => {
    fetchStakeholders();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-customer-form, #add-supplier-form');
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
  }, [showAddForm, activeTab]);

  const fetchStakeholders = async () => {
    try {
      setLoading(true);
      const [cData, sData, salesData, purData, transData] = await Promise.all([
        stakeholderService.getCustomers(farmId).catch(() => []),
        stakeholderService.getSuppliers(farmId).catch(() => []),
        salesService.getSales(farmId).catch(() => []),
        purchaseService.getPurchases(farmId).catch(() => []),
        financeService.getTransactions(farmId).catch(() => [])
      ]);

      setCustomers(Array.isArray(cData) ? cData : []);
      setSuppliers(Array.isArray(sData) ? sData : []);
      setAllSales(Array.isArray(salesData) ? salesData : []);
      setAllPurchases(Array.isArray(purData) ? purData : []);
      setAllTransactions(Array.isArray(transData) ? transData : []);
    } catch (e) {
      console.error(e);
      setCustomers([]);
      setSuppliers([]);
      setAllSales([]);
      setAllPurchases([]);
      setAllTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!cForm.FullName) return alert('Name is required');
    try {
      setIsSubmitting(true);
      const bodyPayload = {
        ...cForm,
        CurrentCreditBalance: editingCustomerId ? cForm.CurrentCreditBalance : cForm.OpeningCreditBalance
      };

      if (editingCustomerId) {
        await stakeholderService.updateCustomer(farmId, editingCustomerId, bodyPayload);
      } else {
        await stakeholderService.createCustomer(farmId, bodyPayload);
      }

      setShowAddForm(false);
      setEditingCustomerId(null);
      setCForm({ FullName: '', Email: '', Phone: '', Company: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
      fetchStakeholders();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!sForm.CompanyName) return alert('Company name is required');
    try {
      setIsSubmitting(true);
      const bodyPayload = {
        ...sForm,
        CurrentCreditBalance: editingSupplierId ? sForm.CurrentCreditBalance : sForm.OpeningCreditBalance
      };

      if (editingSupplierId) {
        await stakeholderService.updateSupplier(farmId, editingSupplierId, bodyPayload);
      } else {
        await stakeholderService.createSupplier(farmId, bodyPayload);
      }

      setShowAddForm(false);
      setEditingSupplierId(null);
      setSForm({ CompanyName: '', ContactPerson: '', Email: '', Phone: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
      fetchStakeholders();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer registry record?')) return;
    try {
      await stakeholderService.deleteCustomer(farmId, id);
      fetchStakeholders();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to delete customer');
    }
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this supplier registry record?')) return;
    try {
      await stakeholderService.deleteSupplier(farmId, id);
      fetchStakeholders();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="space-y-6" id="stakeholders-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            {mode === 'Customers' ? 'Customers Ledger Registry' : mode === 'Suppliers' ? 'Suppliers accounts Registry' : t.stakeholderTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.stakeholderSub}</p>
        </div>
        
        {/* Tab Selector */}
        {!mode && (
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start sm:self-center">
            <button
              onClick={() => { setActiveTab('Customers'); setShowAddForm(false); }}
              className={`px-3 py-1.5 text-xs font-bold font-display rounded-lg transition-all ${activeTab === 'Customers' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Customers (Receivables)
            </button>
            <button
              onClick={() => { setActiveTab('Suppliers'); setShowAddForm(false); }}
              className={`px-3 py-1.5 text-xs font-bold font-display rounded-lg transition-all ${activeTab === 'Suppliers' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Suppliers (Payables)
            </button>
          </div>
        )}
      </div>

      {/* Grid view headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full max-w-lg">
          <div className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">
            Viewing Registered {activeTab}
          </div>
          {/* Stakeholder Search bar */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()} by name, phone, company, address...`}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:outline-hidden focus:border-indigo-500 focus:bg-white smooth-hover"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false);
              setEditingCustomerId(null);
              setEditingSupplierId(null);
              setCForm({ FullName: '', Email: '', Phone: '', Company: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
              setSForm({ CompanyName: '', ContactPerson: '', Email: '', Phone: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
            } else {
              setShowAddForm(true);
            }
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold smooth-hover self-start sm:self-center"
          id="add-stakeholder-btn"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {editingCustomerId || editingSupplierId ? 'Finish Editing' : t.addStakeholderBtn}
        </button>
      </div>

      {/* Add Forms */}
      {showAddForm && activeTab === 'Customers' && (
        <form onSubmit={handleCreateCustomer} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md max-w-2xl space-y-4" id="add-customer-form">
          <h3 className="text-base font-bold text-slate-800">{editingCustomerId ? 'Edit Customer' : 'Add New Customer'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Name / Retailer</label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Egg Distributors LLC"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={cForm.FullName}
                onChange={e => setCForm({ ...cForm, FullName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company / Unit</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={cForm.Company}
                onChange={e => setCForm({ ...cForm, Company: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primary E-mail</label>
              <input
                type="email"
                placeholder="e.g. sales@acmedist.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={cForm.Email}
                onChange={e => setCForm({ ...cForm, Email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone Contacts</label>
              <input
                type="text"
                placeholder="e.g. +1 (555) 0182"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={cForm.Phone}
                onChange={e => setCForm({ ...cForm, Phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opening Dr Balance (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={cForm.OpeningCreditBalance}
                onChange={e => setCForm({ ...cForm, OpeningCreditBalance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing/Postal Address</label>
            <input
              type="text"
              placeholder="e.g. 102 Industrial Parkway, Suite #3"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={cForm.Address}
              onChange={e => setCForm({ ...cForm, Address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingCustomerId(null);
                setCForm({ FullName: '', Email: '', Phone: '', Company: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : (editingCustomerId ? 'Update Customer' : 'Save Customer')}
            </button>
          </div>
        </form>
      )}

      {showAddForm && activeTab === 'Suppliers' && (
        <form onSubmit={handleCreateSupplier} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md max-w-2xl space-y-4" id="add-supplier-form">
          <h3 className="text-base font-bold text-slate-800">{editingSupplierId ? 'Edit Supplier' : 'Add New Supplier Entity'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company / Vendor Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Midwest Milling Co."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={sForm.CompanyName}
                onChange={e => setSForm({ ...sForm, CompanyName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Person Representative</label>
              <input
                type="text"
                placeholder="e.g. Thomas Wayne"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={sForm.ContactPerson}
                onChange={e => setSForm({ ...sForm, ContactPerson: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales E-mail</label>
              <input
                type="email"
                placeholder="e.g. Thomas@midwestmilling.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={sForm.Email}
                onChange={e => setSForm({ ...sForm, Email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Enterprise Phone</label>
              <input
                type="text"
                placeholder="e.g. +1 (312) 555-0988"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={sForm.Phone}
                onChange={e => setSForm({ ...sForm, Phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opening Outstanding Credit (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono"
                value={sForm.OpeningCreditBalance}
                onChange={e => setSForm({ ...sForm, OpeningCreditBalance: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fulfillment/Silo Warehouse Address</label>
            <input
              type="text"
              placeholder="e.g. Rural Highway 14, Mile Marker 45"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
              value={sForm.Address}
              onChange={e => setSForm({ ...sForm, Address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingSupplierId(null);
                setSForm({ CompanyName: '', ContactPerson: '', Email: '', Phone: '', OpeningCreditBalance: 0, CurrentCreditBalance: 0, Address: '' });
              }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving...' : (editingSupplierId ? 'Update Supplier' : 'Save Supplier')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="stakeholder-list">
          {activeTab === 'Customers' ? (
            customers.filter(c => {
              const q = searchQuery.toLowerCase();
              return (
                (c.FullName || '').toLowerCase().includes(q) ||
                (c.Company || '').toLowerCase().includes(q) ||
                (c.Phone || '').toLowerCase().includes(q) ||
                (c.Email || '').toLowerCase().includes(q) ||
                (c.Address || '').toLowerCase().includes(q)
              );
            }).map((c) => (
              <div key={c.Id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4" id={`customer-card-${c.Id}`}>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base font-display">{c.FullName}</h3>
                      {c.Company && <span className="text-[11px] text-slate-400 font-medium font-mono">{c.Company}</span>}
                    </div>
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => {
                          setEditingCustomerId(c.Id);
                          setCForm({
                            FullName: c.FullName,
                            Email: c.Email || '',
                            Phone: c.Phone || '',
                            Company: c.Company || '',
                            OpeningCreditBalance: c.OpeningCreditBalance || 0,
                            CurrentCreditBalance: c.CurrentCreditBalance ?? 0,
                            Address: c.Address || ''
                          });
                          setShowAddForm(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 smooth-hover"
                        title="Edit Customer"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCustomer(c.Id)}
                        className="p-1 text-slate-400 hover:text-red-500 smooth-hover"
                        title="Delete Customer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-500 space-y-1.5 border-t border-slate-50">
                    {c.Phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{c.Phone}</span></div>}
                    {c.Email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{c.Email}</span></div>}
                    {c.Address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span className="truncate">{c.Address}</span></div>}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs border border-slate-100">
                  <span className="text-slate-500 font-semibold">Current Ledger Outstanding</span>
                  <span className={`font-mono font-bold text-sm ${c.CurrentCreditBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{Number(c.CurrentCreditBalance || 0).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLedgerCustomer(c)}
                  className="w-full mt-1 px-3 py-2 bg-slate-900 border border-transparent hover:bg-slate-850 hover:shadow-xs text-white rounded-xl text-xs font-semibold smooth-hover transition-all flex items-center justify-center gap-1.5"
                >
                  📊 View Detailed Ledger
                </button>
              </div>
            ))
          ) : (
            suppliers.filter(s => {
              const q = searchQuery.toLowerCase();
              return (
                (s.CompanyName || '').toLowerCase().includes(q) ||
                (s.ContactPerson || '').toLowerCase().includes(q) ||
                (s.Phone || '').toLowerCase().includes(q) ||
                (s.Email || '').toLowerCase().includes(q) ||
                (s.Address || '').toLowerCase().includes(q)
              );
            }).map((s) => (
              <div key={s.Id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4" id={`supplier-card-${s.Id}`}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base font-display">{s.CompanyName}</h3>
                      {s.ContactPerson && <span className="text-[11px] text-indigo-600 font-bold font-mono uppercase">Rep: {s.ContactPerson}</span>}
                    </div>
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => {
                          setEditingSupplierId(s.Id);
                          setSForm({
                            CompanyName: s.CompanyName,
                            ContactPerson: s.ContactPerson || '',
                            Email: s.Email || '',
                            Phone: s.Phone || '',
                            OpeningCreditBalance: s.OpeningCreditBalance || 0,
                            CurrentCreditBalance: s.CurrentCreditBalance ?? 0,
                            Address: s.Address || ''
                          });
                          setShowAddForm(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 smooth-hover"
                        title="Edit Supplier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSupplier(s.Id)}
                        className="p-1 text-slate-400 hover:text-red-500 smooth-hover"
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-slate-500 space-y-1.5 border-t border-slate-50">
                    {s.Phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{s.Phone}</span></div>}
                    {s.Email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span>{s.Email}</span></div>}
                    {s.Address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" /><span className="truncate">{s.Address}</span></div>}
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-3 rounded-xl flex justify-between items-center text-xs border border-indigo-100/30">
                  <span className="text-slate-500 font-semibold">Landed Accounts Payable</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    ₹{Number(s.CurrentCreditBalance || 0).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLedgerSupplier(s)}
                  className="w-full mt-1 px-3 py-2 bg-indigo-900 border border-transparent hover:bg-indigo-850 hover:shadow-xs text-white rounded-xl text-xs font-semibold smooth-hover transition-all flex items-center justify-center gap-1.5 font-sans"
                >
                  📊 View Supplier Ledger
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {selectedLedgerCustomer && (() => {
        // Compute ledger rows
        const customerSales = allSales.filter(s => s.CustomerId === selectedLedgerCustomer.Id);
        const customerTrans = allTransactions.filter(t => t.CustomerId === selectedLedgerCustomer.Id);

        const rows: any[] = [];
        
        // 1. Opening Balance
        if (selectedLedgerCustomer.OpeningCreditBalance > 0) {
          rows.push({
            date: 'Opening',
            particulars: 'Opening Credit Balance (Account Initiation Debit)',
            debit: selectedLedgerCustomer.OpeningCreditBalance,
            credit: 0,
            type: 'Debit',
            timestamp: 0
          });
        }

        // 2. Add sales (debits) and POS cash received payments (credits)
        customerSales.forEach(s => {
          rows.push({
            date: s.SaleDate ? s.SaleDate.split('T')[0] : 'N/A',
            particulars: `Sales POS Invoice #${s.InvoiceNumber || s.Id}`,
            debit: s.GrandTotal,
            credit: 0,
            type: 'Debit',
            timestamp: new Date(s.SaleDate).getTime()
          });

          if (s.ReceivedAmount > 0) {
            rows.push({
              date: s.SaleDate ? s.SaleDate.split('T')[0] : 'N/A',
              particulars: `Receipt payment for POS Invoice #${s.InvoiceNumber || s.Id}`,
              debit: 0,
              credit: s.ReceivedAmount,
              type: 'Credit',
              timestamp: new Date(s.SaleDate).getTime() + 1 // slight offset for clean receipt sorting
            });
          }
        });

        // 3. Add secondary transactions
        customerTrans.forEach(t => {
          // Avoid double counting POS invoice collections that were automatically registered
          if (t.Notes && t.Notes.includes('Cash Collection') && t.Notes.includes('Invoice #')) {
            return;
          }

          rows.push({
            date: t.Date ? t.Date.split('T')[0] : 'N/A',
            particulars: t.Notes || `Manual Collection Receipt - ${t.CategoryName || 'General Income'}`,
            debit: t.Type === 'Expense' ? t.Amount : 0,
            credit: t.Type === 'Income' ? t.Amount : 0,
            type: t.Type === 'Income' ? 'Credit' : 'Debit',
            timestamp: new Date(t.Date).getTime()
          });
        });

        // Sort chronologically
        rows.sort((a, b) => {
          if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
          return a.particulars.localeCompare(b.particulars);
        });

        // Compute running balance
        let runningBal = 0;
        const computedRows = rows.map(r => {
          if (r.type === 'Debit') {
            runningBal += r.debit;
          } else {
            runningBal -= r.credit;
          }
          return {
            ...r,
            balance: runningBal
          };
        });

        const totalDebits = computedRows.reduce((sum, r) => sum + r.debit, 0);
        const totalCredits = computedRows.reduce((sum, r) => sum + r.credit, 0);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div id="printable-ledger-layout" className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-100">
              <div className="flex justify-between items-start border-b border-sidebar pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">
                    Detailed Customer Ledger Account
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedLedgerCustomer.FullName} {selectedLedgerCustomer.Company && `| ${selectedLedgerCustomer.Company}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLedgerCustomer(null)}
                  className="p-1 px-2.5 text-xs font-semibold uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                >
                  ✕ Close Ledger
                </button>
              </div>

              {/* Financial scorecard totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Init Balance</span>
                  <span className="text-sm font-bold text-slate-700 font-mono">
                    ₹{Number(selectedLedgerCustomer.OpeningCreditBalance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/30 space-y-1">
                  <span className="text-[10px] text-indigo-500 block font-semibold uppercase">Total Debits (Sales)</span>
                  <span className="text-sm font-bold text-indigo-900 font-mono">
                    ₹{Number(totalDebits || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/30 space-y-1">
                  <span className="text-[10px] text-emerald-600 block font-semibold uppercase">Total Payments</span>
                  <span className="text-sm font-bold text-emerald-950 font-mono">
                    ₹{Number(totalCredits || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Active Outstanding</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    ₹{Number(selectedLedgerCustomer.CurrentCreditBalance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Detailed Ledger statement table */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Particulars / Transaction Narrative</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                      <th className="p-3 text-right">Outstanding Bal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {computedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-sans italic">
                          No transactions recorded for this debtor customer account.
                        </td>
                      </tr>
                    ) : (
                      computedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                          <td className="p-3 font-sans text-slate-700 font-medium">{row.particulars}</td>
                          <td className="p-3 text-right text-rose-600 font-semibold">
                            {Number(row.debit || 0) > 0 ? `₹${Number(row.debit || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">
                            {Number(row.credit || 0) > 0 ? `₹${Number(row.credit || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            ₹{Number(row.balance || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold smooth-hover transition-all flex items-center gap-1.5"
                >
                  🖨️ Print Ledger Statement
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedLedgerSupplier && (() => {
        // Compute ledger rows
        const supplierPurchases = allPurchases.filter(p => p.SupplierId === selectedLedgerSupplier.Id);
        const supplierTrans = allTransactions.filter(t => t.SupplierId === selectedLedgerSupplier.Id);

        const rows: any[] = [];
        
        // 1. Opening Balance
        if (selectedLedgerSupplier.OpeningCreditBalance > 0) {
          rows.push({
            date: 'Opening',
            particulars: 'Opening credit balance (Accounts Payable initiation)',
            debit: 0,
            credit: selectedLedgerSupplier.OpeningCreditBalance,
            type: 'Credit',
            timestamp: 0
          });
        }

        // 2. Add purchases (credits) and cash paid payments (debits)
        supplierPurchases.forEach(p => {
          rows.push({
            date: p.PurchaseDate ? p.PurchaseDate.split('T')[0] : 'N/A',
            particulars: `Purchase Invoiced PO #${p.InvoiceNumber || p.Id}`,
            debit: 0,
            credit: p.TotalAmount,
            type: 'Credit',
            timestamp: new Date(p.PurchaseDate).getTime()
          });

          if (p.ReceivedAmount > 0) {
            rows.push({
              date: p.PurchaseDate ? p.PurchaseDate.split('T')[0] : 'N/A',
              particulars: `Direct Payment for PO #${p.InvoiceNumber || p.Id}`,
              debit: p.ReceivedAmount,
              credit: 0,
              type: 'Debit',
              timestamp: new Date(p.PurchaseDate).getTime() + 1 // slight offset
            });
          }
        });

        // 3. Add secondary transactions
        supplierTrans.forEach(t => {
          // Avoid double counting direct purchase payments that were registered
          if (t.Notes && t.Notes.includes('Direct Payment for PO #')) {
            return;
          }

          rows.push({
            date: t.Date ? t.Date.split('T')[0] : 'N/A',
            particulars: t.Notes || `Manual Account Payment - ${t.CategoryName || 'General Expense'}`,
            debit: t.Type === 'Expense' ? t.Amount : 0, // paying them reduces our liability (debit)
            credit: t.Type === 'Income' ? t.Amount : 0, // income from them increases or represents a liability increase
            type: t.Type === 'Expense' ? 'Debit' : 'Credit',
            timestamp: new Date(t.Date).getTime()
          });
        });

        // Sort chronologically
        rows.sort((a, b) => {
          if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
          return a.particulars.localeCompare(b.particulars);
        });

        // Compute running balance
        let runningBal = 0;
        const computedRows = rows.map(r => {
          if (r.type === 'Credit') {
            runningBal += r.credit;
          } else {
            runningBal -= r.debit;
          }
          return {
            ...r,
            balance: runningBal
          };
        });

        const totalDebits = computedRows.reduce((sum, r) => sum + r.debit, 0);
        const totalCredits = computedRows.reduce((sum, r) => sum + r.credit, 0);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div id="printable-ledger-layout" className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto border border-slate-100">
              <div className="flex justify-between items-start border-b border-sidebar pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">
                    Detailed Supplier Ledger Account
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedLedgerSupplier.CompanyName} {selectedLedgerSupplier.ContactPerson && `| Rep: ${selectedLedgerSupplier.ContactPerson}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLedgerSupplier(null)}
                  className="p-1 px-2.5 text-xs font-semibold uppercase bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                >
                  ✕ Close Ledger
                </button>
              </div>

              {/* Financial scorecard totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Init Balance</span>
                  <span className="text-sm font-bold text-slate-700 font-mono">
                    ₹{Number(selectedLedgerSupplier.OpeningCreditBalance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/30 space-y-1">
                  <span className="text-[10px] text-emerald-600 block font-semibold uppercase">Total Paid (Debits)</span>
                  <span className="text-sm font-bold text-emerald-950 font-mono">
                    ₹{Number(totalDebits || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/30 space-y-1">
                  <span className="text-[10px] text-indigo-500 block font-semibold uppercase">Total Purchased (Credits)</span>
                  <span className="text-sm font-bold text-indigo-900 font-mono">
                    ₹{Number(totalCredits || 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">Active Outstanding Due</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    ₹{Number(selectedLedgerSupplier.CurrentCreditBalance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Detailed Ledger statement table */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Particulars / Transaction Narrative</th>
                      <th className="p-3 text-right">Debit (Payment) (₹)</th>
                      <th className="p-3 text-right">Credit (Purchased) (₹)</th>
                      <th className="p-3 text-right">Payable Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {computedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-sans italic">
                          No transaction records for this supplier/creditor account.
                        </td>
                      </tr>
                    ) : (
                      computedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                          <td className="p-3 font-sans text-slate-700 font-medium">{row.particulars}</td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">
                            {Number(row.debit || 0) > 0 ? `₹${Number(row.debit || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-3 text-right text-indigo-600 font-semibold">
                            {Number(row.credit || 0) > 0 ? `₹${Number(row.credit || 0).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            ₹{Number(row.balance || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold smooth-hover transition-all flex items-center gap-1.5"
                >
                  🖨️ Print Ledger Statement
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
