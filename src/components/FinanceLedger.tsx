import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Wallet, Landmark, Receipt, CircleAlert, Search, Filter, Pencil, Check, X, Tag, Calendar, Users, Eye } from 'lucide-react';
import { FinancialTransaction, TransactionCategory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { financeService, stakeholderService, flockService } from '../lib/dataService';

export default function FinanceLedger({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [txs, setTxs] = useState<any[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Lists for attribution selectors
  const [staffList, setStaffList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [flocksList, setFlocksList] = useState<any[]>([]);

  // Toggles
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCategoryMgr, setShowCategoryMgr] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterMethod, setFilterMethod] = useState<'All' | 'Cash' | 'Bank'>('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Form states for transaction adding/editing
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'Income' | 'Expense'>('Expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(150.00);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');

  // Optional attributions
  const [attrStaffId, setAttrStaffId] = useState('');
  const [attrCustomerId, setAttrCustomerId] = useState('');
  const [attrSupplierId, setAttrSupplierId] = useState('');
  const [attrFlockId, setAttrFlockId] = useState('');

  // Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatIsIncome, setNewCatIsIncome] = useState(false);
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIsIncome, setEditCatIsIncome] = useState(false);
  const [editCatDesc, setEditCatDesc] = useState('');

  // Balance summaries
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTx();
    fetchCategories();
    fetchAttributionOptions();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-tx-form');
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

  const fetchTx = async () => {
    try {
      setLoading(true);
      const data = await financeService.getTransactions(farmId);
      const transactions = Array.isArray(data) ? data : [];
      setTxs(transactions);

      // Summarize balances securely casting any amounts to numeric
      const cashIn = transactions.filter((t: any) => t.PaymentMethod === 'Cash' && t.Type === 'Income').reduce((s: number, t: any) => s + Number(t.Amount || 0), 0);
      const cashOut = transactions.filter((t: any) => t.PaymentMethod === 'Cash' && t.Type === 'Expense').reduce((s: number, t: any) => s + Number(t.Amount || 0), 0);
      setCashBalance(Number(cashIn - cashOut) || 0);

      const bankIn = transactions.filter((t: any) => t.PaymentMethod === 'Bank' && t.Type === 'Income').reduce((s: number, t: any) => s + Number(t.Amount || 0), 0);
      const bankOut = transactions.filter((t: any) => t.PaymentMethod === 'Bank' && t.Type === 'Expense').reduce((s: number, t: any) => s + Number(t.Amount || 0), 0);
      setBankBalance(Number(bankIn - bankOut) || 0);
    } catch (e) {
      console.error(e);
      setTxs([]);
      setCashBalance(0);
      setBankBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await financeService.getCategories(farmId);
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCategories([]);
    }
  };

  const fetchAttributionOptions = async () => {
    try {
      const [staffData, custData, suppData, flockData] = await Promise.all([
        stakeholderService.getStaff(farmId).catch(() => []),
        stakeholderService.getCustomers(farmId).catch(() => []),
        stakeholderService.getSuppliers(farmId).catch(() => []),
        flockService.getFlocks(farmId).catch(() => [])
      ]);
      setStaffList(staffData);
      setCustomersList(custData);
      setSuppliersList(suppData);
      setFlocksList(flockData);
    } catch (e) {
      console.error(e);
    }
  };

  const getCategoryCode = (name: string): string => {
    if (!name) return 'GEN-TX';
    const clean = name.trim().toUpperCase();
    if (clean.includes('EGG')) return 'EGG-SL';
    if (clean.includes('BIRD')) return 'BRD-SL';
    if (clean.includes('FEED') && clean.includes('PUR')) return 'FED-PR';
    if (clean.includes('FEED') && clean.includes('CON')) return 'FED-CN';
    if (clean.includes('MEDICINE') || clean.includes('VACCINE')) return 'MED-VC';
    if (clean.includes('SALARY') || clean.includes('WAGE')) return 'SAL-WG';
    if (clean.includes('EQUIPMENT')) return 'EQP-PR';
    if (clean.includes('UTILITIES') || clean.includes('ELECTRICITY') || clean.includes('WATER') || clean.includes('BILL')) return 'UTL-OV';
    if (clean.includes('PERSONAL') || clean.includes('SELF')) return 'PR-CON';
    if (clean.includes('GIFT') || clean.includes('DONAT')) return 'GFT-DN';
    if (clean.includes('CREDIT') || clean.includes('RECOV')) return 'CRD-RC';
    if (clean.includes('SUPPLIER')) return 'SPL-PY';

    const parts = clean.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].slice(0, 3)}-${parts[1].slice(0, 2)}`;
    }
    return clean.slice(0, 6);
  };

  // Create Transaction
  const handleSubmitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!categoryId) return alert('Please select account category code');
    try {
      setIsSubmitting(true);
      await financeService.createTransaction(farmId, {
        Date: txDate,
        Type: type,
        CategoryId: parseInt(categoryId),
        Amount: amount,
        PaymentMethod: paymentMethod,
        Reference: reference,
        Notes: description,
        StaffId: attrStaffId ? parseInt(attrStaffId) : null,
        CustomerId: attrCustomerId ? parseInt(attrCustomerId) : null,
        SupplierId: attrSupplierId ? parseInt(attrSupplierId) : null,
        FlockId: attrFlockId ? parseInt(attrFlockId) : null
      });

      setShowAddForm(false);
      resetTxForm();
      fetchTx();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit ledger entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Transaction
  const handleUpdateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!categoryId) return alert('Select Category');
    if (!editingTxId) return;

    try {
      setIsSubmitting(true);
      await financeService.updateTransaction(farmId, editingTxId, {
        Date: txDate,
        Type: type,
        CategoryId: parseInt(categoryId),
        Amount: amount,
        PaymentMethod: paymentMethod,
        Reference: reference,
        Notes: description,
        StaffId: attrStaffId ? parseInt(attrStaffId) : null,
        CustomerId: attrCustomerId ? parseInt(attrCustomerId) : null,
        SupplierId: attrSupplierId ? parseInt(attrSupplierId) : null,
        FlockId: attrFlockId ? parseInt(attrFlockId) : null
      });

      setEditingTxId(null);
      resetTxForm();
      fetchTx();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditTx = (tx: any) => {
    setEditingTxId(tx.Id);
    setTxDate((tx.Date || '').split('T')[0]);
    setType(tx.Type);
    setCategoryId(String(tx.CategoryId));
    setAmount(tx.Amount);
    setPaymentMethod(tx.PaymentMethod || 'Cash');
    setReference(tx.Reference || '');
    setDescription(tx.Notes || '');
    setAttrStaffId(tx.StaffId ? String(tx.StaffId) : '');
    setAttrCustomerId(tx.CustomerId ? String(tx.CustomerId) : '');
    setAttrSupplierId(tx.SupplierId ? String(tx.SupplierId) : '');
    setAttrFlockId(tx.FlockId ? String(tx.FlockId) : '');
    setShowAddForm(true);
  };

  const deleteTx = async (id: number) => {
    if (!confirm('Are you absolutely sure you want to delete this financial ledger voucher entry? Outstanding debtor and supplier balance adjustments will be auto-rebalanced.')) return;
    try {
      await financeService.deleteTransaction(farmId, id);
      fetchTx();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to delete transaction');
    }
  };

  const resetTxForm = () => {
    setTxDate(new Date().toISOString().split('T')[0]);
    setType('Expense');
    setCategoryId('');
    setAmount(150.00);
    setPaymentMethod('Cash');
    setReference('');
    setDescription('');
    setAttrStaffId('');
    setAttrCustomerId('');
    setAttrSupplierId('');
    setAttrFlockId('');
    setEditingTxId(null);
  };

  // Add Dynamic Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newCatName) return;
    try {
      setIsSubmitting(true);
      await financeService.createCategory(farmId, {
        Name: newCatName,
        IsIncome: newCatIsIncome,
        Description: newCatDesc
      });
      setNewCatName('');
      setNewCatDesc('');
      setNewCatIsIncome(false);
      fetchCategories();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to add type');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Dynamic Category
  const handleUpdateCategory = async (id: number) => {
    if (!editCatName) return;
    try {
      await financeService.updateCategory(farmId, id, {
        Name: editCatName,
        IsIncome: editCatIsIncome,
        Description: editCatDesc
      });
      setEditingCatId(null);
      fetchCategories();
      fetchTx(); // Category names might have updated
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update category');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this transaction type / category?')) return;
    try {
      await financeService.deleteCategory(farmId, id);
      fetchCategories();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Could not delete category');
    }
  };

  const startEditCategory = (cat: any) => {
    setEditingCatId(cat.Id);
    setEditCatName(cat.Name);
    setEditCatIsIncome(cat.IsIncome === 1);
    setEditCatDesc(cat.Description || '');
  };

  // Filtering Logic
  const filteredTxs = txs.filter(tx => {
    // Search query constraint
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      const matchLabel = `${tx.Notes || ''} ${tx.Reference || ''} ${tx.CategoryName || ''} ${tx.CustomerName || ''} ${tx.SupplierName || ''} ${tx.StaffName || ''} ${tx.FlockName || ''}`.toLowerCase();
      if (!matchLabel.includes(query)) return false;
    }

    // Is Income vs Expense constraint
    if (filterType !== 'All') {
      if (tx.Type !== filterType) return false;
    }

    // Category constraint
    if (filterCategory !== 'All') {
      if (String(tx.CategoryId) !== filterCategory) return false;
    }

    // Payment method constraint
    if (filterMethod !== 'All') {
      if (tx.PaymentMethod !== filterMethod) return false;
    }

    // Start date constraint
    if (filterStartDate) {
      const txD = new Date(tx.Date).getTime();
      const startD = new Date(filterStartDate).getTime();
      if (txD < startD) return false;
    }

    // End date constraint
    if (filterEndDate) {
      const txD = new Date(tx.Date).getTime();
      const endD = new Date(filterEndDate).getTime();
      if (txD > endD) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6" id="finance-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            {t.financeTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.financeSub}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setShowCategoryMgr(!showCategoryMgr)}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold smooth-hover"
            id="toggle-category-mgr-btn"
          >
            <Tag className="h-4 w-4 text-indigo-500 shrink-0" />
            Manage Transaction Types
          </button>
          <button
            onClick={() => {
              if (showAddForm) {
                resetTxForm();
                setShowAddForm(false);
              } else {
                resetTxForm();
                setShowAddForm(true);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-semibold smooth-hover shadow-xs"
            id="toggle-add-tx-btn"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {editingTxId ? 'Modify Voucher' : t.addTransactionBtn}
          </button>
        </div>
      </div>

      {/* Floating Cash/Bank Balance widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Office cash vault balance</span>
            <div className={`text-2xl font-bold font-mono ${cashBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              ₹{cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet className="h-6 w-6 shrink-0" />
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Central Bank accounts balance</span>
            <div className={`text-2xl font-bold font-mono ${bankBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              ₹{bankBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Landmark className="h-6 w-6 shrink-0" />
          </span>
        </div>
      </div>

      {/* Account Categories Manager Panel */}
      {showCategoryMgr && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-6" id="category-mgr-panel">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
              <Tag className="h-5 w-5 text-indigo-500" />
              Manage Transaction Types / Account Ledgers
            </h3>
            <button onClick={() => setShowCategoryMgr(false)} className="p-1 hover:bg-slate-100 rounded-md">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side: Add list Type Category */}
            <form onSubmit={handleAddCategory} className="border border-slate-100 p-4 rounded-xl space-y-3 bg-slate-50/20">
              <span className="text-xs font-bold text-indigo-600 block uppercase tracking-wider">Create New Transaction Type</span>
              
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Transaction Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water utility bill"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase block">Flow Orientation</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      checked={!newCatIsIncome}
                      onChange={() => setNewCatIsIncome(false)}
                      className="text-indigo-600 focus:ring-0"
                    />
                    Expense / Outflow (-)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      checked={newCatIsIncome}
                      onChange={() => setNewCatIsIncome(true)}
                      className="text-indigo-600 focus:ring-0"
                    />
                    Revenue / Income (+)
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Memo Explanation</label>
                <input
                  type="text"
                  placeholder="e.g. Electricity, Water, general utility payments"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold smooth-hover ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Adding...' : 'Add Transaction Type'}
              </button>
            </form>

            {/* Right side: Categories lists */}
            <div className="lg:col-span-2 overflow-hidden border border-slate-100 rounded-xl bg-white">
              <span className="text-xs font-bold text-slate-500 block p-3 bg-slate-50 border-b border-slate-100 uppercase tracking-wider">
                Existing Types / Ledger Codes
              </span>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 font-sans">
                {categories.map(c => {
                  const isEditing = editingCatId === c.Id;
                  return (
                    <div key={c.Id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      {isEditing ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 mr-4">
                          <input
                            type="text"
                            required
                            className="px-2 py-1 border border-indigo-400 rounded text-xs"
                            value={editCatName}
                            onChange={e => setEditCatName(e.target.value)}
                          />
                          <select
                            className="px-1 py-1 border border-indigo-400 rounded text-xs bg-white"
                            value={String(editCatIsIncome)}
                            onChange={e => setEditCatIsIncome(e.target.value === 'true')}
                          >
                            <option value="false">Expense Outflow</option>
                            <option value="true">Income Inflow</option>
                          </select>
                          <input
                            type="text"
                            className="px-2 py-1 border border-indigo-400 rounded text-xs"
                            value={editCatDesc}
                            onChange={e => setEditCatDesc(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-600 rounded font-mono">
                              {getCategoryCode(c.Name)}
                            </span>
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">{c.Name}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded uppercase ${c.IsIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {c.IsIncome ? 'Revenue' : 'Expense'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{c.Description || 'No description added'}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleUpdateCategory(c.Id)}
                              className="p-1 px-2.5 bg-indigo-600 text-white font-bold rounded flex items-center gap-1 hover:bg-indigo-700"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCatId(null)}
                              className="p-1 px-2.5 bg-slate-100 text-slate-500 rounded flex items-center gap-1 hover:bg-slate-200"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditCategory(c)}
                              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded"
                              title="Edit Category Type"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.Id)}
                              className="p-1 hover:bg-red-50 text-red-600 rounded"
                              title="Delete Category Type"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Voucher Journal Form */}
      {showAddForm && (
        <form onSubmit={editingTxId ? handleUpdateTx : handleSubmitTx} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md max-w-2xl space-y-4" id="add-tx-form">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-lg font-bold text-slate-800 font-display">
              {editingTxId ? `Edit Ledger Voucher Voucher #${editingTxId}` : 'New Journal / Ledger Voucher'}
            </h3>
            <button type="button" onClick={() => { resetTxForm(); setShowAddForm(false); }} className="p-1 hover:bg-slate-100 rounded-md">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flow Direction Type</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold text-slate-800"
                value={type}
                onChange={e => setType(e.target.value as any)}
              >
                <option value="Expense">Expense Outlay (-)</option>
                <option value="Income">Income Revenue (+)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Voucher Date</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 text-slate-800"
                value={txDate}
                onChange={e => setTxDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Account Category / Ledger Name</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold"
                value={categoryId}
                onChange={e => {
                  const val = e.target.value;
                  setCategoryId(val);
                  if (val) {
                    const matched = categories.find(c => c.Id === parseInt(val));
                    if (matched) {
                      setType(matched.IsIncome ? 'Income' : 'Expense');
                    }
                  }
                }}
              >
                <option value="">-- Choose Account Category Type --</option>
                {categories.map(c => (
                  <option key={c.Id} value={c.Id}>[{getCategoryCode(c.Name)}] {c.Name} ({c.IsIncome ? 'Inflow' : 'Outflow'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 font-mono">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Direct Amount (₹)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-bold"
                value={amount}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Settlement Method</label>
              <select
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-semibold"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
              >
                <option value="Cash">Physical Cash Book</option>
                <option value="Bank">Bank Ledger Transfer</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Audit Reference No / Bill No</label>
              <input
                type="text"
                placeholder="e.g. BD-8927"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 text-slate-800"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* System attribution links section (staff, flocks, customers etc) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase block tracking-wider">Secondary Ledger Integration (Optional Attribution link)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Staff Member / Employee</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  value={attrStaffId}
                  onChange={e => setAttrStaffId(e.target.value)}
                >
                  <option value="">-- No Staff link --</option>
                  {staffList.map(s => (
                    <option key={s.Id} value={s.Id}>{s.FullName} ({s.Role})</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400">Log explicit wage outflows or personal advances</p>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Customer Credit Settlement</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  value={attrCustomerId}
                  onChange={e => setAttrCustomerId(e.target.value)}
                >
                  <option value="">-- No Customer link --</option>
                  {customersList.map(c => (
                    <option key={c.Id} value={c.Id}>{c.FullName} (Bal: ₹{c.CurrentCreditBalance})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Supplier Settlement Payment</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  value={attrSupplierId}
                  onChange={e => setAttrSupplierId(e.target.value)}
                >
                  <option value="">-- No Supplier link --</option>
                  {suppliersList.map(s => (
                    <option key={s.Id} value={s.Id}>{s.CompanyName} (Bal: ₹{s.CurrentCreditBalance})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Allocated Flock</label>
                <select
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
                  value={attrFlockId}
                  onChange={e => setAttrFlockId(e.target.value)}
                >
                  <option value="">-- No Flock link --</option>
                  {flocksList.map(f => (
                    <option key={f.Id} value={f.Id}>{f.FlockName} ({f.Breed})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ledger Narratives / Transaction Description</label>
            <textarea
              placeholder="e.g. Settle electricity utility of house 4 & 5"
              required
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 text-slate-800"
              value={description}
              onChange={e => setDescription(e.target.value)}
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { resetTxForm(); setShowAddForm(false); }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold smooth-hover hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold smooth-hover ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              id="confirm-tx-btn"
            >
              {isSubmitting ? 'Posting...' : (editingTxId ? 'Confirm Updates' : 'Post Ledger Entry')}
            </button>
          </div>
        </form>
      )}

      {/* Advanced Filter Box */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-indigo-500 shrink-0" />
          General Ledger Search Engine & Multi-Filters
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Search Narrative / Ref No</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search keywords..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Flow Orientation</label>
            <select
              className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg text-slate-700 font-semibold"
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
            >
              <option value="All">All Cash Flows</option>
              <option value="Expense">Debits / Outflows (-)</option>
              <option value="Income">Credits / Inflow (+)</option>
            </select>
          </div>

          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Settlement Method</label>
            <select
              className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg text-slate-700 font-semibold"
              value={filterMethod}
              onChange={e => setFilterMethod(e.target.value as any)}
            >
              <option value="All">All Settlement Books</option>
              <option value="Cash">Physical Cash Book</option>
              <option value="Bank">Bank Ledger Transfer</option>
            </select>
          </div>

          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Account Category Type</label>
            <select
              className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg text-slate-700 font-semibold"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="All">All Ledger Accounts</option>
              {categories.map(c => (
                <option key={c.Id} value={c.Id}>[{getCategoryCode(c.Name)}] {c.Name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Voucher Date From</label>
            <input
              type="date"
              className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg text-slate-700"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-1 font-sans">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Voucher Date To</label>
            <input
              type="date"
              className="w-full px-3 py-1.5 border border-slate-200 bg-white text-xs rounded-lg text-slate-700"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          {(searchQuery || filterType !== 'All' || filterCategory !== 'All' || filterMethod !== 'All' || filterStartDate || filterEndDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('All');
                setFilterCategory('All');
                setFilterMethod('All');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Reset Engine Filters ({filteredTxs.length} matches found)
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="tx-history-grid">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800 font-display">General Ledger Flow Ledger</h3>
            <span className="text-xs text-slate-400 font-mono">Showing {filteredTxs.length} journals in audit ledger</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3">Tx Date</th>
                  <th className="px-5 py-3">Category Code</th>
                  <th className="px-5 py-3 col-ledger">Account Details & Linked Entity</th>
                  <th className="px-5 py-3">Payment Book</th>
                  <th className="px-5 py-3 text-right">Debit / Outflow (-)</th>
                  <th className="px-5 py-3 text-right text-emerald-600">Credit / Inflow (+)</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredTxs.length > 0 ? (
                  filteredTxs.map((tx: any) => {
                    const isExp = tx.Type === 'Expense';
                    return (
                      <tr key={tx.Id} className="hover:bg-slate-50/50 smooth-hover text-xs text-slate-700" id={`tx-row-${tx.Id}`}>
                        <td className="px-5 py-3.5 font-mono text-slate-500">{(tx.Date || '').split('T')[0]}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 bg-indigo-50/60 text-indigo-700 font-bold col-cat-code rounded font-mono text-[10px]">
                            {getCategoryCode(tx.CategoryName || '')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-800 block text-xs">{tx.CategoryName || 'General Journal Entry'}</span>
                          <span className="text-[11px] text-slate-400 sm:max-w-xs block truncate" title={tx.Notes}>{tx.Notes || '-'}</span>
                          
                          {/* Rich entity attributes badges */}
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {tx.Reference && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded" title="Ref No">
                                Ref: #{tx.Reference}
                              </span>
                            )}
                            {tx.StaffName && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded flex items-center gap-1" title="Staff connection">
                                <Users className="h-2.5 w-2.5" /> Staff: {tx.StaffName}
                              </span>
                            )}
                            {tx.CustomerName && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded" title="Customer connection">
                                Cust: {tx.CustomerName}
                              </span>
                            )}
                            {tx.SupplierName && (
                              <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-semibold rounded" title="Supplier connection">
                                Supplier: {tx.SupplierName}
                              </span>
                            )}
                            {tx.FlockName && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded" title="Flock attribution">
                                Flock: {tx.FlockName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono font-bold text-[10px] uppercase">
                          {tx.PaymentMethod === 'Bank' ? '🏛️ Bank Transfer' : '💵 Cash Hand'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-500">
                          {isExp ? `-₹${Number(tx.Amount || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600">
                          {!isExp ? `+₹${Number(tx.Amount || 0).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-sans text-xs">
                          <div className="flex items-center justify-end gap-1.5 ml-auto">
                            <button
                              onClick={() => startEditTx(tx)}
                              className="p-1 px-2 border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg smooth-hover flex gap-1 items-center"
                              id={`edit-tx-${tx.Id}`}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => deleteTx(tx.Id)}
                              className="p-1 px-2 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-700 hover:bg-rose-50/40 rounded-lg smooth-hover flex gap-1 items-center"
                              id={`del-tx-${tx.Id}`}
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
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">No financial ledgers matched the filtering requirements.</td>
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
