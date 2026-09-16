import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Sliders, 
  DollarSign, 
  Calculator, 
  Search, 
  UserPlus, 
  X, 
  Edit2, 
  Undo2, 
  CheckCircle2, 
  Info, 
  Calendar, 
  FileText, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  BadgeIndianRupee 
} from 'lucide-react';
import { Supplier, Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { purchaseService, stakeholderService, inventoryService } from '../lib/dataService';

interface PurchaseItem {
  InventoryId: string;
  ItemType: 'Inventory' | 'Feed Ingredient' | 'Flock';
  Quantity: number | string;
  UnitPrice: number | string;
  GSTPercentage: number | string;
  WeightPerUnit: number | string;
  DiscountPercentage?: number | string;
}

interface ExtraExpense {
  ExpenseName: string;
  Amount: number | string;
  AllocationMethod: 'ByValue' | 'ByWeight' | 'ByQuantity' | 'Equal';
  TargetInventoryId: string;
}

export default function Purchasing({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable invoice log detail tracking
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<any | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Form states (Editing and Adding)
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<number | string>(0);
  
  // Payment Mode selector state: 'full' | 'partial' | 'credit'
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'credit'>('credit');

  const [items, setItems] = useState<PurchaseItem[]>([
    { InventoryId: '', ItemType: 'Inventory', Quantity: 1, UnitPrice: 0, GSTPercentage: 0, WeightPerUnit: 0, DiscountPercentage: 0 }
  ]);
  const [expenses, setExpenses] = useState<ExtraExpense[]>([
    { ExpenseName: 'Transport Freight', Amount: 0, AllocationMethod: 'Equal', TargetInventoryId: '' }
  ]);

  // Autocomplete tracking per row
  const [activeSearchRowIdx, setActiveSearchRowIdx] = useState<number | null>(null);
  const [rowSearchQueries, setRowSearchQueries] = useState<{ [key: number]: string }>({});
  const [focusedSuggestionIdx, setFocusedSuggestionIdx] = useState<number>(0);

  // Landed calculation preview helper
  const [previewLines, setPreviewLines] = useState<any[]>([]);
  const [grandTotalPreview, setGrandTotalPreview] = useState(0);

  // Supplier Autocomplete states
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [activeSupplierSearch, setActiveSupplierSearch] = useState(false);
  const [focusedSupplierSuggestionIdx, setFocusedSupplierSuggestionIdx] = useState(0);

  // Quick Supplier dialog states
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierContact, setQuickSupplierContact] = useState('');

  // Quick Inventory modal states
  const [showQuickInventoryModal, setShowQuickInventoryModal] = useState(false);
  const [quickInventoryName, setQuickInventoryName] = useState('');
  const [quickInventoryCategory, setQuickInventoryCategory] = useState('Feed Ingredient');
  const [quickInventoryUnit, setQuickInventoryUnit] = useState('Kg');
  const [quickInventoryPrice, setQuickInventoryPrice] = useState(0);
  const [quickInventoryWeight, setQuickInventoryWeight] = useState(1.0);
  const [selectedRowIdxForQuickAdd, setSelectedRowIdxForQuickAdd] = useState<number | null>(null);

  // Return Purchase States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchaseId, setReturnPurchaseId] = useState<string | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<any[]>([]);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnNotes, setReturnNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showAddForm || showQuickSupplierModal || showReturnModal || showQuickInventoryModal) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('#add-purchase-form, form');
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
  }, [showAddForm, showQuickSupplierModal, showReturnModal, showQuickInventoryModal]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sData, iData, pData] = await Promise.all([
        stakeholderService.getSuppliers(farmId).catch(() => []),
        inventoryService.getInventories(farmId).catch(() => []),
        purchaseService.getPurchases(farmId).catch(() => [])
      ]);
      setSuppliers(Array.isArray(sData) ? sData : []);
      setInventories(Array.isArray(iData) ? iData : []);
      setPurchases(Array.isArray(pData) ? pData : []);
    } catch (e) {
      console.error(e);
      setSuppliers([]);
      setInventories([]);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  // Switch between Payment Modes & Auto Adjust received values
  useEffect(() => {
    if (paymentMode === 'full') {
      setReceivedAmount(grandTotalPreview);
    } else if (paymentMode === 'credit') {
      setReceivedAmount(0);
    }
  }, [paymentMode, grandTotalPreview]);

  // Re-run algebra on frontend when items or expenses update
  useEffect(() => {
    calculateLandedCostsPreview();
  }, [items, expenses]);

  // Fasttrack Keyboard Shortcuts hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Short-circuits for active form sessions
      if (!showAddForm) return;

      // Escape to dismiss autocomplete or modals
      if (e.key === 'Escape') {
        if (activeSearchRowIdx !== null) {
          e.preventDefault();
          const rowIdx = activeSearchRowIdx;
          const relatedInv = inventories.find(i => i.Id === parseInt(items[rowIdx].InventoryId));
          setRowSearchQueries({
            ...rowSearchQueries,
            [rowIdx]: relatedInv ? relatedInv.ItemName : ''
          });
          setActiveSearchRowIdx(null);
          setFocusedSuggestionIdx(0);
        } else if (showQuickSupplierModal) {
          e.preventDefault();
          setShowQuickSupplierModal(false);
        } else if (showQuickInventoryModal) {
          e.preventDefault();
          setShowQuickInventoryModal(false);
          setSelectedRowIdxForQuickAdd(null);
        }
        return;
      }

      // Alt + A (or F4) -> Add Product line
      if ((e.altKey && e.key.toLowerCase() === 'a') || e.key === 'F4') {
        e.preventDefault();
        handleAddItemRow();
      }

      // Alt + E (or F9) -> Add Overhead expense row
      if ((e.altKey && e.key.toLowerCase() === 'e') || e.key === 'F9') {
        e.preventDefault();
        handleAddExpenseRow();
      }

      // Alt + V (or F2) -> Add quick vendor/supplier
      if ((e.altKey && e.key.toLowerCase() === 'v') || e.key === 'F2') {
        e.preventDefault();
        setShowQuickSupplierModal(true);
      }

      // Ctrl + Enter to submit purchase form
      if (e.ctrlKey && e.key === 'Enter') {
        const formSubmitBtn = document.getElementById('save-purchase-order-btn');
        if (formSubmitBtn) {
          e.preventDefault();
          formSubmitBtn.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    showAddForm,
    activeSearchRowIdx,
    inventories,
    items,
    rowSearchQueries,
    showQuickSupplierModal,
    showQuickInventoryModal
  ]);

  const calculateLandedCostsPreview = () => {
    const rawLines = items.map((item, index) => {
      const baseCostRaw = (parseFloat(String(item.Quantity)) || 0) * (parseFloat(String(item.UnitPrice)) || 0);
      const discountPercentage = parseFloat(String(item.DiscountPercentage)) || 0;
      const discountAmount = baseCostRaw * (discountPercentage / 100);
      const baseCost = baseCostRaw - discountAmount;
      const gst = baseCost * ((parseFloat(String(item.GSTPercentage)) || 0) / 100);
      const totalPrice = baseCost + gst;
      return {
        ...item,
        index,
        BaseCost: baseCost,
        GSTAmount: gst,
        TotalPrice: totalPrice,
        AllocatedOverhead: 0,
        FinalLandedAmount: 0,
        FinalLandedUnitCost: 0
      };
    });

    const sumTotalBaseCost = rawLines.reduce((sum, item) => sum + item.BaseCost, 0);
    const sumTotalWeight = rawLines.reduce((sum, item) => sum + ((parseFloat(String(item.Quantity)) || 0) * (parseFloat(String(item.WeightPerUnit)) || 1.0)), 0);
    const sumTotalQty = rawLines.reduce((sum, item) => sum + (parseFloat(String(item.Quantity)) || 0), 0);

    expenses.forEach(exp => {
      const expAmt = parseFloat(String(exp.Amount || 0));
      if (expAmt <= 0) return;

      if (exp.AllocationMethod === 'ByValue' && sumTotalBaseCost > 0) {
        rawLines.forEach(line => {
          line.AllocatedOverhead += expAmt * (line.BaseCost / sumTotalBaseCost);
        });
      } else if (exp.AllocationMethod === 'ByWeight' && sumTotalWeight > 0) {
        rawLines.forEach(line => {
          const itemTotalWeight = (parseFloat(String(line.Quantity)) || 0) * (parseFloat(String(line.WeightPerUnit)) || 1.0);
          line.AllocatedOverhead += expAmt * (itemTotalWeight / sumTotalWeight);
        });
      } else if (exp.AllocationMethod === 'ByQuantity' && sumTotalQty > 0) {
        rawLines.forEach(line => {
          line.AllocatedOverhead += expAmt * ((parseFloat(String(line.Quantity)) || 0) / sumTotalQty);
        });
      } else if (exp.AllocationMethod === 'Equal') {
        const linesCount = rawLines.length;
        if (linesCount > 0) {
          rawLines.forEach(line => {
            line.AllocatedOverhead += expAmt / linesCount;
          });
        }
      } else if (exp.TargetInventoryId) {
        const tIdRaw = parseInt(exp.TargetInventoryId);
        rawLines.forEach(line => {
          if (parseInt(line.InventoryId) === tIdRaw) {
            line.AllocatedOverhead += expAmt;
          }
        });
      }
    });

    let sumTotalInvoices = 0;
    rawLines.forEach(line => {
      line.FinalLandedAmount = line.TotalPrice + line.AllocatedOverhead;
      const qty = parseFloat(String(line.Quantity)) || 0;
      line.FinalLandedUnitCost = qty > 0 ? line.FinalLandedAmount / qty : 0;
      sumTotalInvoices += line.TotalPrice;
    });

    const sumExpenses = expenses.reduce((sum, exp) => sum + parseFloat(String(exp.Amount || 0)), 0);
    
    setPreviewLines(rawLines);
    setGrandTotalPreview(sumTotalInvoices + sumExpenses);
  };

  const handleAddItemRow = () => {
    const nextIdx = items.length;
    setItems([...items, { InventoryId: '', ItemType: 'Inventory', Quantity: 1, UnitPrice: 0, GSTPercentage: 0, WeightPerUnit: 0, DiscountPercentage: 0 }]);
    setTimeout(() => {
      const el = document.getElementById(`purchase-item-search-${nextIdx}`);
      if (el) {
        (el as HTMLInputElement).focus();
        (el as HTMLInputElement).select();
      }
    }, 50);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
      // clean autocomplete helpers
      const newQueries = { ...rowSearchQueries };
      delete newQueries[idx];
      setRowSearchQueries(newQueries);
    } else {
      alert('You must have at least one purchase item row');
    }
  };

  const handleAddExpenseRow = () => {
    const nextIdx = expenses.length;
    setExpenses([...expenses, { ExpenseName: 'Transport Freight', Amount: 0, AllocationMethod: 'Equal', TargetInventoryId: '' }]);
    setTimeout(() => {
      const el = document.getElementById(`overhead-expense-name-${nextIdx}`);
      if (el) {
        (el as HTMLInputElement).focus();
        (el as HTMLInputElement).select();
      }
    }, 50);
  };

  const handleRemoveExpenseRow = (idx: number) => {
    setExpenses(expenses.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!supplierId) return alert('Please choose a supplier.');
    if (items.some(i => !i.InventoryId)) return alert('Please choose a material/stock item for each row.');

    // frontend sanitization to avoid NaN
    const payloadItems = items.map(i => ({
      InventoryId: parseInt(i.InventoryId),
      ItemType: i.ItemType || 'Inventory',
      Quantity: parseFloat(String(i.Quantity)) || 0,
      UnitPrice: parseFloat(String(i.UnitPrice)) || 0,
      GSTPercentage: parseFloat(String(i.GSTPercentage)) || 0,
      DiscountPercentage: parseFloat(String(i.DiscountPercentage)) || 0,
      WeightPerUnit: parseFloat(String(i.WeightPerUnit)) || 1.0
    }));

    const payloadExpenses = expenses.map(e => ({
      ExpenseName: e.ExpenseName || 'Overhead Charge',
      Amount: parseFloat(String(e.Amount)) || 0,
      AllocationMethod: e.AllocationMethod || 'Equal',
      TargetInventoryId: e.TargetInventoryId ? parseInt(e.TargetInventoryId) : null
    }));

    try {
      setIsSubmitting(true);
      const purchasePayload = {
        SupplierId: supplierId ? parseInt(supplierId) : null,
        PurchaseDate: purchaseDate,
        InvoiceNumber: invoiceNumber,
        ReceivedAmount: parseFloat(String(receivedAmount)) || 0,
        Notes: notes
      };

      if (editPurchaseId) {
        await purchaseService.updatePurchase(farmId, parseInt(editPurchaseId), purchasePayload, payloadItems, payloadExpenses);
      } else {
        await purchaseService.createPurchase(farmId, purchasePayload, payloadItems, payloadExpenses);
      }

      setShowAddForm(false);
      setEditPurchaseId(null);
      // Reset inputs
      setItems([{ InventoryId: '', ItemType: 'Inventory', Quantity: 1, UnitPrice: 0, GSTPercentage: 0, WeightPerUnit: 0, DiscountPercentage: 0 }]);
      setExpenses([{ ExpenseName: 'Transport Freight', Amount: 0, AllocationMethod: 'Equal', TargetInventoryId: '' }]);
      setNotes('');
      setInvoiceNumber('');
      setReceivedAmount(0);
      setSupplierId('');
      setSupplierSearchQuery('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('credit');
      setRowSearchQueries({});
      fetchData();
      alert(editPurchaseId ? 'Purchase transaction updated successfully!' : 'Purchase saved successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while saving the purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger quick supplier add
  const handleAddQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!quickSupplierName.trim()) return alert('Please enter a supplier company name');

    try {
      setIsSubmitting(true);
      const newSup = await stakeholderService.createSupplier(farmId, {
        CompanyName: quickSupplierName,
        ContactPerson: quickSupplierContact || 'Direct Head',
        Phone: quickSupplierPhone || 'N/A',
        Email: 'info@poultrysupplier.com',
        OpeningCreditBalance: 0,
        Address: 'N/A'
      });

      const sData = await stakeholderService.getSuppliers(farmId);
      setSuppliers(sData);

      if (newSup) {
        setSupplierId(String(newSup.Id));
        setSupplierSearchQuery(newSup.CompanyName);
      }

      // Reset
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setQuickSupplierContact('');
      setShowQuickSupplierModal(false);
      alert('New supplier added successfully');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Cannot add supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger quick inventory add
  const handleAddQuickInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!quickInventoryName.trim()) return alert('Please enter an item name.');

    try {
      setIsSubmitting(true);
      const newInv = await inventoryService.createInventory(farmId, {
        ItemName: quickInventoryName,
        Category: quickInventoryCategory as any,
        UnitOfMeasurement: quickInventoryUnit,
        UnitPrice: parseFloat(String(quickInventoryPrice)) || 0,
        SellingPrice: parseFloat(String(quickInventoryPrice)) * 1.2 || 0,
        CurrentStock: 0,
        WeightPerUnit: parseFloat(String(quickInventoryWeight)) || 1.0,
        MinThreshold: 10,
        Notes: 'Quick added from purchase bill sheet'
      });

      const iData = await inventoryService.getInventories(farmId);
      setInventories(iData);

      // Select item in the triggered row
      if (selectedRowIdxForQuickAdd !== null && newInv) {
        const copy = [...items];
        copy[selectedRowIdxForQuickAdd].InventoryId = String(newInv.Id);
        copy[selectedRowIdxForQuickAdd].UnitPrice = parseFloat(String(quickInventoryPrice)) || 0;
        copy[selectedRowIdxForQuickAdd].WeightPerUnit = parseFloat(String(quickInventoryWeight)) || 1.0;
        if (!copy[selectedRowIdxForQuickAdd].Quantity || copy[selectedRowIdxForQuickAdd].Quantity === 0) {
          copy[selectedRowIdxForQuickAdd].Quantity = 1;
        }
        setItems(copy);

        setRowSearchQueries({
          ...rowSearchQueries,
          [selectedRowIdxForQuickAdd]: quickInventoryName
        });
      }

      // Reset
      setQuickInventoryName('');
      setQuickInventoryCategory('Feed Ingredient');
      setQuickInventoryUnit('Kg');
      setQuickInventoryPrice(0);
      setQuickInventoryWeight(1.0);
      setShowQuickInventoryModal(false);
      setSelectedRowIdxForQuickAdd(null);
      alert('New item added and prefilled successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Cannot add item to inventory');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch full details for a purchase on log click
  const handleToggleExpandPurchase = async (id: number) => {
    const parentId = String(id);
    if (expandedPurchaseId === parentId) {
      setExpandedPurchaseId(null);
      setExpandedDetails(null);
      return;
    }

    try {
      setExpandedPurchaseId(parentId);
      setFetchingDetails(true);
      const data = await purchaseService.getPurchaseDetails(farmId, id);
      setExpandedDetails(data);
    } catch (err: any) {
      alert(err.message || 'Could not fetch invoice ledger detail');
      setExpandedPurchaseId(null);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleDeletePurchase = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this purchase bill? This will reverse stock additions, update supplier credit balances, and adjust financial transactions.')) {
      return;
    }
    try {
      setLoading(true);
      await purchaseService.deletePurchase(farmId, id);
      await fetchData();
      alert('Purchase bill deleted successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error occurred while deleting purchase bill.');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Mode
  const handleEditPurchase = async (p: any) => {
    try {
      const data = await purchaseService.getPurchaseDetails(farmId, p.Id);

      setEditPurchaseId(String(p.Id));
      const supId = data.purchase.SupplierId ? String(data.purchase.SupplierId) : '';
      setSupplierId(supId);
      const matchedSup = suppliers.find(s => String(s.Id) === supId);
      setSupplierSearchQuery(matchedSup ? matchedSup.CompanyName : '');
      setPurchaseDate((data.purchase.PurchaseDate || '').split('T')[0]);
      setInvoiceNumber(data.purchase.InvoiceNumber || '');
      setReceivedAmount(data.purchase.ReceivedAmount || 0);
      setNotes(data.purchase.Notes || '');

      // Set payment mode selection state
      const amtPaid = data.purchase.ReceivedAmount || 0;
      const totAmt = data.purchase.TotalAmount || 0;
      if (amtPaid >= totAmt) {
        setPaymentMode('full');
      } else if (amtPaid === 0) {
        setPaymentMode('credit');
      } else {
        setPaymentMode('partial');
      }

      setItems(data.items.map((i: any) => ({
        InventoryId: String(i.InventoryId || ''),
        ItemType: i.ItemType || 'Inventory',
        Quantity: i.Quantity || 0,
        UnitPrice: i.UnitPrice || 0,
        GSTPercentage: i.GSTPercentage || 0,
        DiscountPercentage: i.DiscountPercentage || 0,
        WeightPerUnit: i.WeightPerUnit || 1.0
      })));

      // Initialize row search text autocomplete filters
      const preloadedSearchQueries: { [key: number]: string } = {};
      data.items.forEach((i: any, idx: number) => {
        preloadedSearchQueries[idx] = i.ItemName || '';
      });
      setRowSearchQueries(preloadedSearchQueries);

      setExpenses(data.expenses.map((e: any) => ({
        ExpenseName: e.ExpenseName || '',
        Amount: e.Amount || 0,
        AllocationMethod: e.AllocationMethod || 'Equal',
        TargetInventoryId: e.TargetInventoryId ? String(e.TargetInventoryId) : ''
      })));

      setShowAddForm(true);

      const section = document.getElementById('procurement-module');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      alert(err.message || 'Error pulling invoice details');
    }
  };

  // Open Returns Modal for partial / full items returns
  const handleOpenReturnModal = async (id: number) => {
    try {
      const data = await purchaseService.getPurchaseDetails(farmId, id);

      setReturnPurchaseId(String(id));
      setReturnItemsState(data.items.map((i: any) => ({
        InventoryId: i.InventoryId,
        ItemName: i.ItemName,
        PurchasedQty: i.Quantity,
        ReturnedQty: i.Quantity - (i.Quantity || 0), // Default 0 returned initially
        ReturnQuantity: 0
      })));
      setReturnDate(new Date().toISOString().split('T')[0]);
      setReturnNotes('');
      setShowReturnModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to prepare return pipeline');
    }
  };

  // Post Return transaction
  const handlePostReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const activeReturnRows = returnItemsState.filter(i => (parseFloat(String(i.ReturnQuantity)) || 0) > 0);
    
    if (activeReturnRows.length === 0) {
      return alert('Please specify a return quantity greater than 0 for at least one item.');
    }

    // Safety checks
    for (const row of activeReturnRows) {
      const q = parseFloat(String(row.ReturnQuantity)) || 0;
      if (q > row.PurchasedQty) {
        return alert(`Cannot return more than purchased amount of ${row.PurchasedQty} for item: ${row.ItemName}`);
      }
    }

    try {
      setIsSubmitting(true);
      await purchaseService.returnPurchase(
        farmId,
        parseInt(returnPurchaseId!),
        returnDate,
        returnNotes,
        activeReturnRows.map(row => ({
          InventoryId: parseInt(row.InventoryId),
          ReturnQuantity: parseFloat(String(row.ReturnQuantity))
        }))
      );

      setShowReturnModal(false);
      setReturnPurchaseId(null);
      setReturnItemsState([]);
      fetchData();
      // Clear expanded states to reload fresh data on next expand
      setExpandedPurchaseId(null);
      setExpandedDetails(null);
      alert('Purchase return completed successfully! Landed WAC pricing, inventory stock, and vendor outstanding credit values have been updated.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to submit purchase return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering list by supplier name or invoice number
  const filteredPurchases = purchases.filter(p => {
    const sName = (p.SupplierName || '').toLowerCase();
    const invNo = (p.InvoiceNumber || `INV-${p.Id}`).toLowerCase();
    const query = searchQuery.toLowerCase();
    return sName.includes(query) || invNo.includes(query);
  });

  return (
    <div className="space-y-6" id="procurement-module">
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0 animate-pulse" />
            Poultry Purchase Ledger
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Standard-billing style panel to register purchases, allocate delivery overheads via landed-cost metrics, log supplier returns, and track accounts outstanding.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditPurchaseId(null);
              // reset states
              setItems([{ InventoryId: '', ItemType: 'Inventory', Quantity: 1, UnitPrice: 0, GSTPercentage: 0, WeightPerUnit: 0, DiscountPercentage: 0 }]);
              setExpenses([{ ExpenseName: 'Transport Freight', Amount: 0, AllocationMethod: 'Equal', TargetInventoryId: '' }]);
              setNotes('');
              setInvoiceNumber('');
              setReceivedAmount(0);
              setSupplierId('');
              setSupplierSearchQuery('');
              setPurchaseDate(new Date().toISOString().split('T')[0]);
              setPaymentMode('credit');
              setRowSearchQueries({});
              setShowAddForm(!showAddForm);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold smooth-hover shadow-md shrink-0 ${
              showAddForm ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            id="toggle-add-purchase-btn"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {showAddForm ? 'Hide Form' : 'New Purchase Bill'}
          </button>
        </div>
      </div>

      {/* Main adding/editing form (BILLING-STYLE COMPACT POS GRID) */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="space-y-6" id="add-purchase-form">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Billing Invoice Worksheet (8 out of 12 columns) */}
            <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BadgeIndianRupee className="h-5 w-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 font-display text-sm sm:text-base">
                    {editPurchaseId ? `Purchase Invoice Correction (Bill #${editPurchaseId})` : 'Purchase Invoicing Sheet'}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>Active POS Session</span>
                </div>
              </div>

              {/* SECTION A: Bill Metadata Header */}
              <div className="bg-slate-50/75 p-4 rounded-xl border border-slate-150 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                
                 {/* Supplier select search shortcut */}
                <div className="space-y-1 relative" id="supplier-autocomplete-container">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Supplier / Vendor</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplierModal(true)}
                      className="text-[9px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
                    >
                      <UserPlus className="h-2.5 w-2.5" />
                      Add Vendor
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Search vendor (e.g. Feed Co)..."
                      className="w-full px-2.5 py-1.5 border border-slate-200 focus:border-indigo-500 rounded-lg text-xs bg-white text-slate-800 font-medium outline-hidden focus:ring-1 focus:ring-indigo-100"
                      value={supplierSearchQuery}
                      onFocus={() => {
                        setActiveSupplierSearch(true);
                        setFocusedSupplierSuggestionIdx(0);
                      }}
                      onChange={e => {
                        setSupplierSearchQuery(e.target.value);
                        if (e.target.value === '') {
                          setSupplierId('');
                        }
                        setActiveSupplierSearch(true);
                        setFocusedSupplierSuggestionIdx(0);
                      }}
                      onKeyDown={e => {
                        const term = supplierSearchQuery.trim().toLowerCase();
                        const matched = suppliers.filter(s => 
                          !term || 
                          s.CompanyName.toLowerCase().includes(term) ||
                          (s.ContactPerson || '').toLowerCase().includes(term) ||
                          (s.Phone || '').toLowerCase().includes(term)
                        );

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (matched.length > 0) {
                            setFocusedSupplierSuggestionIdx(prev => (prev + 1) % matched.length);
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (matched.length > 0) {
                            setFocusedSupplierSuggestionIdx(prev => (prev - 1 + matched.length) % matched.length);
                          }
                        } else if (e.key === 'Enter') {
                          if (matched.length > 0) {
                            e.preventDefault();
                            const selected = matched[focusedSupplierSuggestionIdx] || matched[0];
                            if (selected) {
                              setSupplierId(String(selected.Id));
                              setSupplierSearchQuery(selected.CompanyName);
                              setActiveSupplierSearch(false);
                            }
                          }
                        } else if (e.key === 'Escape') {
                          setActiveSupplierSearch(false);
                        }
                      }}
                    />
                    
                    <input type="hidden" required name="SupplierId" value={supplierId} />

                    {supplierId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierId('');
                          setSupplierSearchQuery('');
                        }}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        title="Clear selection"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {activeSupplierSearch && (
                    <div className="absolute z-100 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 animate-in fade-in duration-100 font-sans">
                      <div className="p-2 text-[9px] uppercase font-bold text-slate-400 bg-slate-50 sticky top-0 px-3 z-10 flex justify-between">
                        <span>Select Vendor</span>
                        <span className="text-indigo-600">Press Enter or Click</span>
                      </div>

                      {(() => {
                        const term = supplierSearchQuery.trim().toLowerCase();
                        const matched = suppliers.filter(s => 
                          !term || 
                          s.CompanyName.toLowerCase().includes(term) ||
                          (s.ContactPerson || '').toLowerCase().includes(term) ||
                          (s.Phone || '').toLowerCase().includes(term)
                        );

                        return (
                          <>
                            {matched.map((s, matchedIdx) => {
                              const isFocused = matchedIdx === focusedSupplierSuggestionIdx;
                              const isSelected = String(s.Id) === supplierId;
                              return (
                                <button
                                  key={s.Id}
                                  type="button"
                                  className={`w-full text-left px-3.5 py-2 text-xs flex justify-between items-center transition-all ${
                                    isFocused 
                                      ? 'bg-indigo-50 font-semibold border-l-4 border-indigo-600 pl-2.5' 
                                      : isSelected 
                                      ? 'bg-indigo-50/40 font-medium'
                                      : 'hover:bg-slate-50'
                                  }`}
                                  onMouseEnter={() => setFocusedSupplierSuggestionIdx(matchedIdx)}
                                  onClick={() => {
                                    setSupplierId(String(s.Id));
                                    setSupplierSearchQuery(s.CompanyName);
                                    setActiveSupplierSearch(false);
                                  }}
                                >
                                  <div className="text-left">
                                    <span className="font-bold text-slate-800 block">{s.CompanyName}</span>
                                    <span className="text-[9px] text-slate-400 font-mono tracking-wide">
                                      {s.ContactPerson && s.ContactPerson !== 'Direct Head' ? `${s.ContactPerson} • ` : ''}{s.Phone || 'No Phone'}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded font-mono">
                                      Bal: ₹{parseFloat(String(s.CurrentCreditBalance || 0)).toFixed(2)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}

                            {term.length > 0 && (
                              <div className="p-2.5 bg-indigo-50/50 flex flex-col gap-1.5 sticky bottom-0 border-t border-indigo-100">
                                <p className="text-[10px] text-slate-500 font-medium">Vendor '{supplierSearchQuery}' not registered?</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickSupplierName(supplierSearchQuery);
                                    setShowQuickSupplierModal(true);
                                    setActiveSupplierSearch(false);
                                  }}
                                  className="w-full text-center py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Quick-Add "{supplierSearchQuery}"
                                </button>
                              </div>
                            )}

                            {matched.length === 0 && term.length === 0 && (
                              <div className="p-4 text-center text-slate-400 text-[11px]">
                                No registered suppliers/vendors found.
                              </div>
                            )}
                          </>
                        );
                      })()}
                      
                      <button
                        type="button"
                        onClick={() => {
                          const matchedSup = suppliers.find(s => String(s.Id) === supplierId);
                          setSupplierSearchQuery(matchedSup ? matchedSup.CompanyName : '');
                          setActiveSupplierSearch(false);
                        }}
                        className="w-full text-center py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-all border-t border-slate-100"
                      >
                        Dismiss Suggestions
                      </button>
                    </div>
                  )}
                </div>

                {/* Bill date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" /> Bill Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold font-mono"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                  />
                </div>

                {/* Invoice number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="h-3 w-3 text-slate-400" /> Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INVC-7721"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold font-mono placeholder:font-sans placeholder:text-slate-300"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                  />
                </div>

              </div>

              {/* SECTION B: POS SPREADSHEET TABLE (Compact Rows) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-slate-100/60 p-2 px-3 rounded-lg border border-slate-200/50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bought Materials Checklist</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg smooth-hover"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Insert Product Line
                  </button>
                </div>

                {/* Keyboard Shortcuts Guidelines Bar */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 px-3 bg-slate-50 border border-slate-200/60 rounded-xl text-[10px] text-slate-500 font-sans shadow-2xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Fasttrack Keys:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">F4</kbd> / <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">Alt+A</kbd> Add Line</span>
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">F9</kbd> / <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">Alt+E</kbd> Add Expense</span>
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">F2</kbd> / <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">Alt+V</kbd> Add Vendor</span>
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">↑/↓</kbd> Nav suggestions</span>
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">Enter</kbd> Select</span>
                    <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-650 shadow-xs">Ctrl+Enter</kbd> Confirm Bill</span>
                  </div>
                </div>

                {/* Autocomplete backdrop dismiss trigger */}
                {activeSearchRowIdx !== null && (
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => {
                    const rowIdx = activeSearchRowIdx;
                    const relatedInv = inventories.find(i => i.Id === parseInt(items[rowIdx].InventoryId));
                    setRowSearchQueries({
                      ...rowSearchQueries,
                      [rowIdx]: relatedInv ? relatedInv.ItemName : ''
                    });
                    setActiveSearchRowIdx(null);
                  }} />
                )}

                <div className={`overflow-x-auto transition-all ${activeSearchRowIdx !== null ? 'relative z-50 min-h-[380px] pb-52' : 'relative z-10'}`}>
                  <table className="w-full text-left text-xs border border-slate-200/85 rounded-xl divide-y divide-slate-150 bg-white">
                    <thead className="bg-slate-50 uppercase tracking-widest text-[9px] font-bold text-slate-500">
                      <tr>
                        <th className="p-2.5 w-[22%] font-sans">Material Item (Search Autocomplete)</th>
                        <th className="p-2.5 text-right w-[10%] font-sans">Quantity</th>
                        <th className="p-2.5 text-right w-[12%] font-sans">Unit Price (₹)</th>
                        <th className="p-2.5 text-right w-[14%] font-sans">Disc (% / ₹)</th>
                        <th className="p-2.5 text-right w-[14%] font-sans">GST (% / ₹)</th>
                        <th className="p-2.5 text-right w-[10%] font-mono">Weight (Kg)</th>
                        <th className="p-2.5 text-right w-[14%] font-sans font-bold text-slate-700">Net Sub Total</th>
                        <th className="p-2.5 text-center w-[4%] font-sans"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item, idx) => {
                        const invIdNumeric = parseInt(item.InventoryId);
                        const invObj = inventories.find(i => i.Id === invIdNumeric);
                        
                        const qty = parseFloat(String(item.Quantity)) || 0;
                        const price = parseFloat(String(item.UnitPrice)) || 0;
                        const disc = parseFloat(String(item.DiscountPercentage)) || 0;
                        const gstPercent = parseFloat(String(item.GSTPercentage)) || 0;
                        const rawBase = qty * price;
                        const discAmt = rawBase * (disc / 100);
                        const discountedBase = rawBase - discAmt;
                        const gstAmt = discountedBase * (gstPercent / 100);
                        const netLineTotal = discountedBase + gstAmt;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 smooth-hover align-middle">
                            
                            {/* Materials Search Autocomplete cell */}
                            <td className="p-2 relative z-50">
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-slate-400">
                                  <Search className="h-3.5 w-3.5" />
                                </span>
                                <input
                                  id={`purchase-item-search-${idx}`}
                                  type="text"
                                  required
                                  placeholder="Type to search stock (e.g. Maize, Medicine)..."
                                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 focus:border-indigo-500 rounded-lg text-xs bg-white font-medium text-slate-800 focus:ring-1 focus:ring-indigo-100 outline-hidden"
                                  value={
                                    rowSearchQueries[idx] !== undefined 
                                      ? rowSearchQueries[idx] 
                                      : (invObj?.ItemName || '')
                                  }
                                  onFocus={(e) => {
                                    e.target.select();
                                    setActiveSearchRowIdx(idx);
                                    setFocusedSuggestionIdx(0);
                                    if (rowSearchQueries[idx] === undefined) {
                                      setRowSearchQueries({
                                        ...rowSearchQueries,
                                        [idx]: invObj?.ItemName || ''
                                      });
                                    }
                                  }}
                                  onChange={e => {
                                    setRowSearchQueries({
                                      ...rowSearchQueries,
                                      [idx]: e.target.value
                                    });
                                    setFocusedSuggestionIdx(0);
                                  }}
                                  onKeyDown={(e) => {
                                    const term = (rowSearchQueries[idx] || '').trim().toLowerCase();
                                    const matchedItems = inventories.filter(inv => {
                                      return !term || 
                                        inv.ItemName.toLowerCase().includes(term) || 
                                        (inv.Category || '').toLowerCase().includes(term);
                                    });

                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      if (matchedItems.length > 0) {
                                        setFocusedSuggestionIdx(prev => (prev + 1) % matchedItems.length);
                                      }
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      if (matchedItems.length > 0) {
                                        setFocusedSuggestionIdx(prev => (prev - 1 + matchedItems.length) % matchedItems.length);
                                      }
                                    } else if (e.key === 'Enter') {
                                      if (matchedItems.length > 0) {
                                        e.preventDefault();
                                        const selectedInv = matchedItems[focusedSuggestionIdx] || matchedItems[0];
                                        if (selectedInv) {
                                          const copy = [...items];
                                          copy[idx].InventoryId = String(selectedInv.Id);
                                          copy[idx].UnitPrice = selectedInv.UnitPrice || 0;
                                          copy[idx].WeightPerUnit = selectedInv.WeightPerUnit || 1.0;
                                          if (!copy[idx].Quantity || copy[idx].Quantity === 0) {
                                            copy[idx].Quantity = 1;
                                          }
                                          setItems(copy);

                                          setRowSearchQueries({
                                            ...rowSearchQueries,
                                            [idx]: selectedInv.ItemName
                                          });
                                          setActiveSearchRowIdx(null);
                                          setFocusedSuggestionIdx(0);
                                        }
                                      }
                                    }
                                  }}
                                />
                                
                                {/* Autocomplete popup selection flyout */}
                                {activeSearchRowIdx === idx && (
                                  <div className="absolute z-50 left-0 right-5 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100 min-w-[300px] animate-in fade-in duration-100 font-sans">
                                    <div className="p-2 text-[9px] uppercase font-bold text-slate-400 bg-slate-50 sticky top-0 px-3 z-10 flex justify-between">
                                      <span>Available Materials</span>
                                      <span className="text-indigo-600">Select to Pre-fill</span>
                                    </div>
                                    {(() => {
                                      const term = (rowSearchQueries[idx] || '').trim().toLowerCase();
                                      const matchedItems = inventories.filter(inv => {
                                        return !term || 
                                          inv.ItemName.toLowerCase().includes(term) || 
                                          (inv.Category || '').toLowerCase().includes(term);
                                      });

                                      return (
                                        <>
                                          {matchedItems.map((inv, matchedIdx) => {
                                            const isFocused = matchedIdx === focusedSuggestionIdx;
                                            return (
                                              <button
                                                key={inv.Id}
                                                type="button"
                                                className={`w-full text-left px-3.5 py-2.5 text-xs flex justify-between items-center transition-all ${
                                                  isFocused 
                                                    ? 'bg-indigo-50 font-semibold border-l-4 border-indigo-600 pl-2.5' 
                                                    : 'hover:bg-slate-50'
                                                }`}
                                                onMouseEnter={() => setFocusedSuggestionIdx(matchedIdx)}
                                                onClick={() => {
                                                  const copy = [...items];
                                                  copy[idx].InventoryId = String(inv.Id);
                                                  copy[idx].UnitPrice = inv.UnitPrice || 0;
                                                  copy[idx].WeightPerUnit = inv.WeightPerUnit || 1.0;
                                                  if (!copy[idx].Quantity || copy[idx].Quantity === 0) {
                                                    copy[idx].Quantity = 1;
                                                  }
                                                  setItems(copy);

                                                  setRowSearchQueries({
                                                    ...rowSearchQueries,
                                                    [idx]: inv.ItemName
                                                  });
                                                  setActiveSearchRowIdx(null);
                                                }}
                                              >
                                                <div className="text-left">
                                                  <span className="font-bold text-slate-800 block">{inv.ItemName}</span>
                                                  <span className="text-[10px] text-slate-400 font-mono tracking-wide">{inv.Category || 'Inventory'}</span>
                                                </div>
                                                <div className="text-right">
                                                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded font-mono">
                                                    Bal: {inv.CurrentStock ?? 0} {inv.UnitOfMeasurement}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400 block mt-0.5">Prefill: ₹{inv.UnitPrice ?? 0}</span>
                                                </div>
                                              </button>
                                            );
                                          })}

                                          {/* In-line Quick Add Shortcut block */}
                                          {term.length > 0 && (
                                            <div className="p-3 bg-indigo-50/50 flex flex-col gap-1.5 sticky bottom-0 border-t border-indigo-100">
                                              <p className="text-[10px] text-slate-500 font-medium">Material '{rowSearchQueries[idx]}' not found?</p>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  // Open Add Item modal and pre-fill its name
                                                  setSelectedRowIdxForQuickAdd(idx);
                                                  setQuickInventoryName(rowSearchQueries[idx] || '');
                                                  setShowQuickInventoryModal(true);
                                                  setActiveSearchRowIdx(null);
                                                }}
                                                className="w-full text-center py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                                              >
                                                <Plus className="h-3.5 w-3.5" />
                                                Quick-Add "{rowSearchQueries[idx]}"
                                              </button>
                                            </div>
                                          )}

                                          {matchedItems.length === 0 && term.length === 0 && (
                                            <div className="p-4 text-center text-slate-400 text-[11px]">
                                              No stock registry items found.
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // restore text query
                                        const copy = { ...rowSearchQueries };
                                        copy[idx] = invObj ? invObj.ItemName : '';
                                        setRowSearchQueries(copy);
                                        setActiveSearchRowIdx(null);
                                      }}
                                      className="w-full text-center py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-50 transition-all border-t border-slate-100"
                                    >
                                      Dismiss Suggestions
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Qty Cell */}
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-right bg-white font-mono"
                                value={item.Quantity}
                                onChange={e => {
                                  const copy = [...items];
                                  copy[idx].Quantity = e.target.value;
                                  setItems(copy);
                                }}
                              />
                            </td>

                            {/* Unit Price Cell */}
                            <td className="p-2 text-right">
                              <div className="relative">
                                <span className="absolute left-1.5 top-1.5 text-slate-400 text-[10px]">₹</span>
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  step="any"
                                  className="w-full pl-4 pr-1.5 py-1 border border-slate-200 rounded-md text-xs text-right bg-white font-mono"
                                  value={item.UnitPrice}
                                  onChange={e => {
                                    const copy = [...items];
                                    copy[idx].UnitPrice = e.target.value;
                                    setItems(copy);
                                  }}
                                />
                              </div>
                            </td>

                            {/* Discount Percentage and Amount Cells */}
                            <td className="p-2 text-right">
                              <div className="space-y-1">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    className="w-full px-1 py-0.5 border border-slate-200 rounded-md text-[11px] text-right bg-white font-mono text-rose-600 font-semibold"
                                    placeholder="0%"
                                    value={item.DiscountPercentage ?? ''}
                                    onChange={e => {
                                      const copy = [...items];
                                      copy[idx].DiscountPercentage = e.target.value;
                                      setItems(copy);
                                    }}
                                  />
                                  <span className="absolute right-1 top-1 text-[8px] text-slate-400 pointer-events-none">%</span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="w-full pl-3 pr-1 py-0.5 border border-slate-200 rounded-md text-[11px] text-right bg-white font-mono text-rose-600"
                                    placeholder="₹0.00"
                                    value={
                                      (() => {
                                        const qty = parseFloat(String(item.Quantity)) || 0;
                                        const price = parseFloat(String(item.UnitPrice)) || 0;
                                        const discPercent = parseFloat(String(item.DiscountPercentage)) || 0;
                                        const baseRaw = qty * price;
                                        return baseRaw > 0 && discPercent > 0 ? (baseRaw * (discPercent / 100)).toFixed(2) : '';
                                      })()
                                    }
                                    onChange={e => {
                                      const copy = [...items];
                                      const valStr = e.target.value;
                                      const amt = valStr === '' ? 0 : parseFloat(valStr) || 0;
                                      const lineRaw = (parseFloat(String(item.Quantity)) || 0) * (parseFloat(String(item.UnitPrice)) || 0);
                                      copy[idx].DiscountPercentage = lineRaw > 0 ? (amt / lineRaw) * 100 : 0;
                                      setItems(copy);
                                    }}
                                  />
                                  <span className="absolute left-1 top-1 text-[8px] text-slate-400 pointer-events-none">₹</span>
                                </div>
                              </div>
                            </td>

                            {/* GST Percentage and Amount Cells */}
                            <td className="p-2 text-right">
                              <div className="space-y-1">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    className="w-full px-1 py-0.5 border border-slate-200 rounded-md text-[11px] text-right bg-white font-mono text-indigo-650 font-semibold"
                                    placeholder="0%"
                                    value={item.GSTPercentage ?? ''}
                                    onChange={e => {
                                      const copy = [...items];
                                      copy[idx].GSTPercentage = e.target.value;
                                      setItems(copy);
                                    }}
                                  />
                                  <span className="absolute right-1 top-1 text-[8px] text-slate-400 pointer-events-none">%</span>
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="w-full pl-3 pr-1 py-0.5 border border-slate-200 rounded-md text-[11px] text-right bg-white font-mono text-indigo-650"
                                    placeholder="₹0.00"
                                    value={
                                      (() => {
                                        const qty = parseFloat(String(item.Quantity)) || 0;
                                        const price = parseFloat(String(item.UnitPrice)) || 0;
                                        const discPercent = parseFloat(String(item.DiscountPercentage)) || 0;
                                        const gstPercent = parseFloat(String(item.GSTPercentage)) || 0;
                                        const baseRaw = qty * price;
                                        const discAmt = baseRaw * (discPercent / 100);
                                        const discountedBase = baseRaw - discAmt;
                                        return discountedBase > 0 && gstPercent > 0 ? (discountedBase * (gstPercent / 100)).toFixed(2) : '';
                                      })()
                                    }
                                    onChange={e => {
                                      const copy = [...items];
                                      const valStr = e.target.value;
                                      const amt = valStr === '' ? 0 : parseFloat(valStr) || 0;
                                      const qty = parseFloat(String(item.Quantity)) || 0;
                                      const price = parseFloat(String(item.UnitPrice)) || 0;
                                      const discPercent = parseFloat(String(item.DiscountPercentage)) || 0;
                                      const baseRaw = qty * price;
                                      const discAmt = baseRaw * (discPercent / 100);
                                      const discountedBase = baseRaw - discAmt;
                                      copy[idx].GSTPercentage = discountedBase > 0 ? (amt / discountedBase) * 100 : 0;
                                      setItems(copy);
                                    }}
                                  />
                                  <span className="absolute left-1 top-1 text-[8px] text-slate-400 pointer-events-none">₹</span>
                                </div>
                              </div>
                            </td>

                            {/* Weight Per Unit Cell */}
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="any"
                                className="w-full px-2 py-1 border border-slate-200 rounded-md text-xs text-right bg-white font-mono text-slate-500"
                                placeholder="1.0"
                                value={item.WeightPerUnit ?? ''}
                                onChange={e => {
                                  const copy = [...items];
                                  copy[idx].WeightPerUnit = e.target.value;
                                  setItems(copy);
                                }}
                              />
                            </td>

                            {/* Net Sub Total Dynamic Preview Cell */}
                            <td className="p-2 text-right font-mono text-slate-850">
                              <span className="font-semibold block">₹{netLineTotal.toFixed(2)}</span>
                              {discAmt > 0 && (
                                <span className="text-[10px] text-rose-500 block">Disc: -₹{discAmt.toFixed(2)}</span>
                              )}
                              {gstAmt > 0 && (
                                <span className="text-[10px] text-indigo-500 block font-semibold">GST: +₹{gstAmt.toFixed(2)}</span>
                              )}
                            </td>

                            {/* Delete line action */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md smooth-hover"
                                title="Remove line item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION C: EXTRA CHARGES & FREIGHTS (Compact Overlay) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-indigo-50/50 p-2 px-3 rounded-lg border border-indigo-100/50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                    <Sliders className="h-4 w-4 text-slate-400" />
                    Allocated Transport Delivery Fees & Extra Overheads
                  </span>
                  <button
                    type="button"
                    onClick={handleAddExpenseRow}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 border border-indigo-150 rounded-lg smooth-hover"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Extra Expense Charge
                  </button>
                </div>

                <div className="space-y-2">
                  {expenses.map((exp, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150 items-end">
                      
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400">Charge Label / Description</label>
                        <input
                          id={`overhead-expense-name-${idx}`}
                          type="text"
                          required
                          className="w-full px-2.5 py-1 border border-slate-200 focus:border-indigo-500 rounded-lg text-xs bg-white font-medium text-slate-800"
                          placeholder="Loading fee, Silo fuel surcharge, Freight etc..."
                          value={exp.ExpenseName}
                          onChange={e => {
                            const copy = [...expenses];
                            copy[idx].ExpenseName = e.target.value;
                            setExpenses(copy);
                          }}
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400">Cost Amt (₹)</label>
                        <input
                          type="number"
                          required
                          className="w-full px-2.5 py-1 border border-slate-200 focus:border-indigo-500 rounded-lg text-xs bg-white font-mono"
                          value={exp.Amount}
                          onChange={e => {
                            const copy = [...expenses];
                            copy[idx].Amount = e.target.value;
                            setExpenses(copy);
                          }}
                        />
                      </div>

                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400">Apportion Landed cost technique</label>
                        <select
                          className="w-full px-2 py-1 border border-slate-200 focus:border-indigo-500 rounded-lg text-xs bg-white font-semibold text-slate-700"
                          value={exp.AllocationMethod}
                          onChange={e => {
                            const copy = [...expenses];
                            copy[idx].AllocationMethod = e.target.value as any;
                            setExpenses(copy);
                          }}
                        >
                          <option value="ByWeight font-sans">By Weight (Heavier products take higher cost share)</option>
                          <option value="ByValue font-sans">By Item Cost (More expensive items take higher cost share)</option>
                          <option value="ByQuantity font-sans">By Qty (Higher item counts take higher cost share)</option>
                          <option value="Equal font-sans">Split equally among all items</option>
                        </select>
                      </div>

                      <div className="sm:col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveExpenseRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-lg smooth-hover font-bold"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: POS Checkout Slip & Settle (4 out of 12 columns) */}
            <div className="lg:col-span-4 bg-slate-900 text-white rounded-2xl border border-slate-900 shadow-xl overflow-hidden self-start">
              
              {/* POS Slip Header */}
              <div className="p-5 bg-slate-800 border-b border-slate-700/60 text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-indigo-400 flex items-center gap-1">
                    <Calculator className="h-4 w-4" /> POS Receipt Summary
                  </span>
                  <span className="text-[10px] bg-slate-750 px-2 py-0.5 rounded font-mono">
                    {invoiceNumber || 'DRAFT'}
                  </span>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="p-5 space-y-3.5 border-b border-slate-800 font-sans text-sm">
                
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>Gross Goods Value:</span>
                  <span className="font-mono">
                    ₹{previewLines.reduce((sum, line) => sum + ((parseFloat(String(line.Quantity)) || 0) * (parseFloat(String(line.UnitPrice)) || 0)), 0).toFixed(2)}
                  </span>
                </div>

                {previewLines.some(line => (parseFloat(String(line.DiscountPercentage)) || 0) > 0) && (
                  <div className="flex justify-between items-center text-rose-400 text-xs font-semibold">
                    <span>Total Item Discounts:</span>
                    <span className="font-mono">
                      -₹{previewLines.reduce((sum, line) => {
                        const base = (parseFloat(String(line.Quantity)) || 0) * (parseFloat(String(line.UnitPrice)) || 0);
                        return sum + (base * ((parseFloat(String(line.DiscountPercentage)) || 0) / 100));
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>Net Taxable Subtotal:</span>
                  <span className="font-mono">
                    ₹{previewLines.reduce((sum, line) => sum + line.BaseCost, 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>GST Taxes Estimate:</span>
                  <span className="font-mono">
                    ₹{previewLines.reduce((sum, line) => sum + line.GSTAmount, 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>Apportioned Overheads:</span>
                  <span className="font-mono text-amber-400">
                    +₹{expenses.reduce((sum, exp) => sum + (parseFloat(String(exp.Amount)) || 0), 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-slate-800 pt-3 text-slate-100 font-bold">
                  <span className="text-xs text-indigo-300">Grand Invoice Total:</span>
                  <span className="font-mono text-lg text-emerald-400">₹{grandTotalPreview.toFixed(2)}</span>
                </div>

              </div>

              {/* PAYMENT SETTLEMENT MODE SELECTOR (FULL / PARTIAL / CREDIT) */}
              <div className="p-5 bg-slate-950/70 border-b border-slate-800 space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Choose Settlement Mode
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('full')}
                    className={`p-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMode === 'full' 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Full Pay
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('partial')}
                    className={`p-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMode === 'partial' 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="h-4 w-4 shrink-0" />
                    Partial Cash
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('credit')}
                    className={`p-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 ${
                      paymentMode === 'credit' 
                        ? 'bg-rose-700 border-rose-600 text-white shadow-lg' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <DollarSign className="h-4 w-4 shrink-0" />
                    Voucher Credit
                  </button>
                </div>

                <div className="pt-2">
                  {paymentMode === 'full' && (
                    <div className="bg-emerald-950/30 font-medium text-emerald-400 p-2.5 rounded-lg text-xs space-y-1 border border-emerald-900/30 leading-snug">
                      <span className="font-bold uppercase tracking-wider block text-[9px]">Status: Fully Paid</span>
                      Locks ₹{grandTotalPreview.toFixed(2)} into cash payment instantly on confirm. Balance remains ₹0.00.
                    </div>
                  )}

                  {paymentMode === 'credit' && (
                    <div className="bg-rose-950/40 text-rose-400 p-2.5 rounded-lg text-xs space-y-1 border border-rose-900/30 leading-snug">
                      <span className="font-bold uppercase tracking-wider block text-[9px]">Status: Accounts Credit</span>
                      Adds ₹{grandTotalPreview.toFixed(2)} to Supplier Credit accounts payable. No cache required now.
                    </div>
                  )}

                  {paymentMode === 'partial' && (
                    <div className="space-y-2 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/40">
                      <label className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">
                        Enter Cash amount paid now (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-slate-400 text-xs">₹</span>
                        <input
                          type="number"
                          required
                          step="any"
                          className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-hidden"
                          value={receivedAmount}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            setReceivedAmount(e.target.value);
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-indigo-300 font-semibold font-mono flex justify-between">
                        <span>Balance Left:</span>
                        <span>₹{(grandTotalPreview - (parseFloat(String(receivedAmount)) || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Settlement Footer fields */}
              <div className="p-5 space-y-4">
                
                <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Remarks / Comments</label>
                  <textarea
                    rows={2}
                    className="w-full bg-transparent border-0 ring-0 focus:outline-hidden text-xs text-slate-100 placeholder:text-slate-600 p-0 mt-1 resize-none"
                    placeholder="e.g. Received grains in silo 4. Inspected and approved by Store Supervisor Mr. Sharma."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditPurchaseId(null);
                      // Reset inputs
                      setItems([{ InventoryId: '', ItemType: 'Inventory', Quantity: 1, UnitPrice: 0, GSTPercentage: 0, WeightPerUnit: 0, DiscountPercentage: 0 }]);
                      setExpenses([{ ExpenseName: 'Transport Freight', Amount: 0, AllocationMethod: 'Equal', TargetInventoryId: '' }]);
                      setNotes('');
                      setInvoiceNumber('');
                      setReceivedAmount(0);
                      setSupplierId('');
                      setSupplierSearchQuery('');
                      setPurchaseDate(new Date().toISOString().split('T')[0]);
                      setPaymentMode('credit');
                      setRowSearchQueries({});
                    }}
                    className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel Bill
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    id="save-purchase-order-btn"
                  >
                    {isSubmitting ? 'Posting...' : (editPurchaseId ? 'Correct Invoice' : 'Confirm & Post')}
                  </button>
                </div>

              </div>

            </div>

          </div>
        </form>
      )}

      {/* Main Table search bar and visual list summary */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="purchase-history-grid">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 font-display">Purchase Logs & Invoices</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click a row below to reveal comprehensive item lists, delivery apportioned overheads, supplier returns, or edit parameters.</p>
          </div>
          {/* Active Search Field */}
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by supplier company or bill code..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden font-medium text-slate-700 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-5 py-3 text-center w-8"></th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Supplier Name</th>
                  <th className="px-5 py-3">Invoice / Bill Number</th>
                  <th className="px-5 py-3 text-right">Refund / Original Total</th>
                  <th className="px-5 py-3 text-right">Remaining Balance</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-xs">
                      No purchase records found matching raw filtering criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => {
                    const isExpanded = expandedPurchaseId === String(p.Id);
                    const returnedAmt = parseFloat(p.TotalReturnAmount || 0);
                    const origTotalAmt = parseFloat(p.TotalAmount || 0);
                    const netTotalAmt = origTotalAmt - returnedAmt;

                    return (
                      <React.Fragment key={p.Id}>
                        <tr 
                          onClick={() => handleToggleExpandPurchase(p.Id)}
                          className={`hover:bg-slate-50/50 smooth-hover cursor-pointer align-middle ${
                            isExpanded ? 'bg-indigo-50/20' : ''
                          }`} 
                          id={`purchase-row-${p.Id}`}
                        >
                          {/* Toggle icon */}
                          <td className="px-5 py-3.5 text-center">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 animate-bounce" />
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                            {(p.PurchaseDate || '').split('T')[0]}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {p.SupplierName || 'Unknown Vendor'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-indigo-600">
                            {p.InvoiceNumber || `BILL-${p.Id}`}
                          </td>
                          
                          {/* Total Amount reflecting return values */}
                          <td className="px-5 py-3.5 text-right">
                            {returnedAmt > 0 ? (
                              <div className="space-y-0.5">
                                <div className="text-xs text-slate-400 line-through">₹{origTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="font-bold text-slate-800">₹{netTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded inline-block font-bold">Returned ₹{returnedAmt}</div>
                              </div>
                            ) : (
                              <div className="font-bold text-slate-800">₹{origTotalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            )}
                          </td>

                          {/* Remaining balance info */}
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-xs">
                            {parseFloat(p.BalanceAmount) > 0 ? (
                              <span className="text-rose-600 px-2 py-1 bg-rose-50 rounded-lg">₹{parseFloat(p.BalanceAmount).toFixed(2)}</span>
                            ) : (
                              <span className="text-emerald-700 px-2 py-1 bg-emerald-50 rounded-lg">Settle / Paid</span>
                            )}
                          </td>

                          {/* Status pill tag */}
                          <td className="px-5 py-3.5 text-center">
                            {parseFloat(p.BalanceAmount) > 0 ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-rose-100 text-rose-800 rounded-sm">
                                Unsettled
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-sm">
                                Full Paid
                              </span>
                            )}
                          </td>

                          {/* Action triggers */}
                          <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditPurchase(p)}
                                title="Edit / Adjust Purchase Record"
                                className="p-1 px-2.5 border border-slate-200 hover:border-indigo-300 text-xs text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 font-semibold smooth-hover"
                              >
                                <Edit2 className="h-3 w-3" />
                                Edit Bill
                              </button>
                              <button
                                onClick={() => handleOpenReturnModal(p.Id)}
                                title="Log Supplier Return"
                                className="p-1 px-2.5 border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-xs text-slate-700 hover:text-amber-700 rounded-lg flex items-center gap-1 font-semibold smooth-hover"
                              >
                                <Undo2 className="h-3 w-3 text-amber-500" />
                                Return items
                              </button>
                              <button
                                onClick={() => handleDeletePurchase(p.Id)}
                                title="Delete Purchase Record"
                                className="p-1 px-2.5 border border-slate-200 hover:border-red-300 hover:bg-red-50 text-xs text-slate-700 hover:text-red-700 rounded-lg flex items-center gap-1 font-semibold smooth-hover"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                                Delete Bill
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* DETAILED INTERACTIVE EXPANDED ROW (The "Net Bill Total" + items log) */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-slate-50/50 p-6 border-b border-indigo-100/50 font-sans text-xs">
                              {fetchingDetails ? (
                                <div className="flex items-center justify-center py-4 gap-2 text-slate-500 font-semibold">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                                  Loading ledger logs...
                                </div>
                              ) : expandedDetails ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                  
                                  {/* Detailed Header info */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b border-slate-250/20">
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Initial Bill Value</span>
                                      <span className="font-mono text-sm font-bold text-slate-700">₹{origTotalAmt.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Returns Registered</span>
                                      <span className="font-mono text-sm font-bold text-rose-600">{returnedAmt > 0 ? `-₹${returnedAmt.toFixed(2)}` : '₹0.00'}</span>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wide block font-display">Net Outstanding Liability</span>
                                      <span className="font-mono text-sm font-bold text-indigo-800">₹{netTotalAmt.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1 col-span-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Audit Cash Disbursed</span>
                                      <span className="font-mono text-sm font-semibold text-slate-500">₹{parseFloat(expandedDetails.purchase.ReceivedAmount || 0).toFixed(2)}</span>
                                    </div>
                                  </div>

                                  {/* Purchased Items List Grid */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                                      <FileText className="h-4 w-4 text-slate-400" />
                                      Line Item Apportionments
                                    </h4>
                                    
                                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                                      <table className="w-full text-left text-[11px] text-slate-600 divide-y divide-slate-100 bg-white">
                                        <thead className="bg-slate-50 font-bold text-slate-500 uppercase text-[9px] tracking-wider">
                                          <tr>
                                            <th className="p-2">Product Registered</th>
                                            <th className="p-2 text-right">Orig Qty Bought</th>
                                            <th className="p-2 text-right text-rose-600">Qty Returned</th>
                                            <th className="p-2 text-right font-bold text-slate-800">Net Remaining Qty</th>
                                            <th className="p-2 text-right">Item Valuation</th>
                                            <th className="p-2 text-right">Extra Overhead Share</th>
                                            <th className="p-2 text-right font-bold text-indigo-700">Landed Unit Cost (WAC)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {expandedDetails.items.map((it: any, index: number) => {
                                            // Calculate returns for this item specifically
                                            const totalItemRefQueries = expandedDetails.returnItems || [];
                                            const returnedQtyOfItem = totalItemRefQueries
                                              .filter((ri: any) => ri.InventoryId === it.InventoryId)
                                              .reduce((sum: number, ri: any) => sum + parseFloat(String(ri.Quantity || 0)), 0);
                                            const netQty = Math.max(0, it.Quantity - returnedQtyOfItem);

                                            const qty = parseFloat(String(it.Quantity)) || 0;
                                            const price = parseFloat(String(it.UnitPrice)) || 0;
                                            const discPercent = parseFloat(String(it.DiscountPercentage)) || 0;
                                            const gstPercent = parseFloat(String(it.GSTPercentage)) || 0;
                                            
                                            const rawBase = qty * price;
                                            const discAmt = rawBase * (discPercent / 100);
                                            const baseAfterDisc = rawBase - discAmt;
                                            const gstAmt = baseAfterDisc * (gstPercent / 100);

                                            return (
                                              <tr key={index} className="hover:bg-slate-50/50">
                                                <td className="p-2">
                                                  <span className="font-bold text-slate-800 block">{it.ItemName}</span>
                                                  <span className="text-[9px] text-slate-400 block">Prefill: ₹{price.toFixed(2)}/unit</span>
                                                </td>
                                                <td className="p-2 text-right font-mono font-semibold">{it.Quantity} Unit</td>
                                                <td className="p-2 text-right font-mono text-rose-600 font-bold">
                                                  {returnedQtyOfItem > 0 ? `${returnedQtyOfItem} Unit` : '-'}
                                                </td>
                                                <td className="p-2 text-right font-mono font-bold text-slate-800 bg-emerald-50/20">
                                                  {netQty} Unit
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                  <span className="font-semibold text-slate-800 block">₹{parseFloat(it.TotalPrice).toFixed(2)}</span>
                                                  {discAmt > 0 && (
                                                    <span className="text-[9px] text-rose-500 block">Disc: -₹{discAmt.toFixed(2)} ({discPercent}%)</span>
                                                  )}
                                                  {gstAmt > 0 && (
                                                    <span className="text-[9px] text-indigo-500 block">GST: +₹{gstAmt.toFixed(2)} ({gstPercent}%)</span>
                                                  )}
                                                </td>
                                                <td className="p-2 text-right font-mono text-indigo-500">+₹{parseFloat(it.AllocatedOverhead).toFixed(2)}</td>
                                                <td className="p-2 text-right font-mono font-bold text-indigo-700">₹{(parseFloat(it.FinalLandedAmount) / (it.Quantity || 1)).toFixed(2)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Extra Delivery Fees details */}
                                  {expandedDetails.expenses && expandedDetails.expenses.length > 0 && (
                                    <div className="space-y-1.5">
                                      <h5 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Landed Cost Apportionments Registered:</h5>
                                      <div className="flex flex-wrap gap-2">
                                        {expandedDetails.expenses.map((exp: any, index: number) => (
                                          <div key={index} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 font-medium">
                                            <span className="font-bold text-slate-800">{exp.ExpenseName}</span> (₹{parseFloat(exp.Amount).toFixed(2)}) &middot; <span className="italic">Div: {exp.AllocationMethod}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* List of active returns logged for this bill */}
                                  {expandedDetails.returns && expandedDetails.returns.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                      <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                                        <RotateCcw className="h-4 w-4" />
                                        Logged Return Returns Record
                                      </h4>
                                      <div className="space-y-1.5">
                                        {expandedDetails.returns.map((ret: any, index: number) => (
                                          <div key={index} className="p-3 bg-rose-50/40 rounded-xl border border-rose-100 text-xs flex justify-between items-start gap-4">
                                            <div>
                                              <div className="font-bold text-rose-950">Return Lot ID {ret.Id} &middot; <span className="font-mono text-[11px] font-normal text-slate-500">{(ret.ReturnDate || '').split('T')[0]}</span></div>
                                              <div className="text-slate-500 mt-1">{ret.Notes || 'No specific return reason provided.'}</div>
                                            </div>
                                            <div className="text-right font-mono font-bold text-rose-700">
                                              Refund Credited: ₹{parseFloat(ret.TotalReturnAmount || 0).toFixed(2)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              ) : (
                                <div className="text-center text-slate-400">Failed to log records.</div>
                              )}
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK SUPPLIER MODAL */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 font-display flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Quick-Add Supplier
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickSupplierModal(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full smooth-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddQuickSupplier} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Golden Feeds Corp"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:outline-hidden"
                  value={quickSupplierName}
                  onChange={e => setQuickSupplierName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Person الاسم</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. John Doe"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:outline-hidden"
                  value={quickSupplierContact}
                  onChange={e => setQuickSupplierContact(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone Telephone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765-43210"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono focus:outline-hidden"
                  value={quickSupplierPhone}
                  onChange={e => setQuickSupplierPhone(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURCHASE RETURN MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 font-display flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-amber-600 animate-pulse" />
                Supplier Item Return Registry
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnPurchaseId(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full smooth-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePostReturn} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Return Date</label>
                  <input
                    type="date"
                    required
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:outline-hidden font-mono"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Purchase Bill ID</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full mt-1 px-3 py-2 border border-slate-100 rounded-lg text-sm bg-slate-100 font-mono text-slate-500 focus:outline-hidden cursor-not-allowed"
                    value={`Bill ID: ${returnPurchaseId}`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide block">Select item and enter quantities to return:</label>
                
                <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-150">
                  {returnItemsState.map((ri, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-white rounded border border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-slate-800">{ri.ItemName}</div>
                        <div className="text-[10px] text-slate-400">Total Bought: {ri.PurchasedQty} Units</div>
                      </div>
                      <div className="w-28 flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={ri.PurchasedQty}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right font-mono"
                          value={ri.ReturnQuantity === 0 ? '' : ri.ReturnQuantity}
                          placeholder="0"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            const copy = [...returnItemsState];
                            copy[index].ReturnQuantity = val;
                            setReturnItemsState(copy);
                          }}
                        />
                        <span className="text-xs text-slate-400">Units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason for Return</label>
                <textarea
                  placeholder="e.g. Materials received damaged, incorrect specifications, or returned surplus stock."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:outline-hidden"
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setReturnPurchaseId(null);
                  }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Posting...' : 'Post Items Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK INVENTORY ITEM ADD SHORTCUT MODAL */}
      {showQuickInventoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 font-display flex items-center gap-2 text-sm sm:text-base">
                <Plus className="h-5 w-5 text-indigo-600 animate-pulse" />
                Quick-Add Material / Product
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowQuickInventoryModal(false);
                  setSelectedRowIdxForQuickAdd(null);
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full smooth-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddQuickInventory} className="space-y-4">
              <div className="space-y-1 font-sans text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Material / Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Broken Rice, Maize, Layer Vitamins"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-hidden text-slate-800 font-semibold"
                  value={quickInventoryName}
                  onChange={e => setQuickInventoryName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Category Category Name</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-hidden text-slate-850 font-medium"
                    value={quickInventoryCategory}
                    onChange={e => setQuickInventoryCategory(e.target.value)}
                  >
                    <option value="Feed Ingredient">Feed Ingredient</option>
                    <option value="Poultry Medicines">Poultry Medicines</option>
                    <option value="Chicks Flock">Chicks Flock</option>
                    <option value="Equipment & Repair">Equipment & Repair</option>
                    <option value="Others-Miscellaneous">Others</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Unit of Measurement</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kg, Bags, Litres, Units"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-hidden text-slate-800 font-semibold"
                    value={quickInventoryUnit}
                    onChange={e => setQuickInventoryUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-sans text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-hidden font-mono text-slate-800 font-semibold"
                    value={quickInventoryPrice}
                    onChange={e => setQuickInventoryPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1 font-sans">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide col-span-1">Weight per Unit (Kg) - Optional</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="1.0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:outline-hidden font-mono text-slate-800 font-semibold"
                    value={quickInventoryWeight}
                    onChange={e => setQuickInventoryWeight(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4 leading-none">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickInventoryModal(false);
                    setSelectedRowIdxForQuickAdd(null);
                  }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm font-sans ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
