import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  ShieldCheck,
  Printer,
  ShoppingCart,
  User,
  Percent,
  DollarSign,
  UserPlus,
  Edit,
  RotateCcw,
  Receipt,
  Eye,
  CheckCircle,
  Truck,
  Wrench,
  HelpCircle,
  Info,
  Calendar,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Customer, Flock, EggInventory, Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { salesService, stakeholderService, flockService, eggInventoryService, inventoryService, settingsService } from '../lib/dataService';

interface CartItem {
  Id?: number;
  ItemType: 'Bird' | 'Egg' | 'General Inventory';
  FlockId: string;
  EggInventoryId: string;
  InventoryId: string;
  Quantity: number;
  UnitPrice: number;
  GSTPercentage: number;
  isTrayMode?: boolean;
  trayCount?: number;
  eggsPerTray?: number;
  pricePerTray?: number;
  trayCountStr?: string;
  pricePerTrayStr?: string;
}

interface OverheadCharge {
  ChargeType: 'Transport' | 'Labour' | 'Packaging' | 'Other';
  Amount: number;
}

export default function SalesDesk({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [allFlocks, setAllFlocks] = useState<any[]>([]);
  const [eggs, setEggs] = useState<EggInventory[]>([]);
  const [invItems, setInvItems] = useState<Inventory[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBillingForm, setShowBillingForm] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Partial' | 'Credit'>('Paid');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [originalSaleItems, setOriginalSaleItems] = useState<any[]>([]);

  // Overheads list
  const [overheads, setOverheads] = useState<OverheadCharge[]>([]);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([
    { ItemType: 'Egg', FlockId: '', EggInventoryId: '', InventoryId: '', Quantity: 300, UnitPrice: 5.0, GSTPercentage: 5, isTrayMode: true, trayCount: 10, eggsPerTray: 30, pricePerTray: 150 }
  ]);

  // Invoice display & printable overlay
  const [activeInvoice, setActiveInvoice] = useState<any | null>(null);

  // Quick Customer Form Modal
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustCompany, setQuickCustCompany] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustEmail, setQuickCustEmail] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');

  // Sales Return Modal State
  const [returnTargetSale, setReturnTargetSale] = useState<any | null>(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({}); // maps SaleItem.Id -> returnqty
  const [farmSettings, setFarmSettings] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [farmId]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    if (showBillingForm || showQuickCustomer) {
      const timer = setTimeout(() => {
        const activeForm = document.querySelector('form');
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
  }, [showBillingForm, showQuickCustomer]);

  // Listeners for High-Speed POS Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showBillingForm) return;

      // F4: Add line item
      if (e.key === 'F4') {
        e.preventDefault();
        handleAddItem();
      }
      // F6: Quick Add Customer
      if (e.key === 'F6') {
        e.preventDefault();
        setShowQuickCustomer(true);
      }
      // ESC: Close customer modal / Return modal
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuickCustomer(false);
        setReturnTargetSale(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBillingForm, cart]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [settingsData, custData, flockData, eggData, invData, salesData] = await Promise.all([
        settingsService.getSettings(farmId).catch(() => currentFarm || {}),
        stakeholderService.getCustomers(farmId).catch(() => []),
        flockService.getFlocks(farmId).catch(() => []),
        eggInventoryService.getEggInventories(farmId).catch(() => []),
        inventoryService.getInventories(farmId).catch(() => []),
        salesService.getSales(farmId).catch(() => [])
      ]);

      setFarmSettings(settingsData);
      setCustomers(Array.isArray(custData) ? custData : []);
      const validFlocks = Array.isArray(flockData) ? flockData : [];
      setAllFlocks(validFlocks);
      setFlocks(validFlocks.filter((f: Flock) => f.Status === 'Active'));
      setEggs(Array.isArray(eggData) ? eggData : []);
      const validInvs = Array.isArray(invData) ? invData : [];
      setInvItems(validInvs.filter((v: Inventory) => v.Category !== 'Raw Ingredient'));
      setSales(Array.isArray(salesData) ? salesData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateInvoiceNo = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    setInvoiceNumber(`SL-${dateCode}-${rand}`);
  };

  const handleNewSaleInit = () => {
    setEditingSaleId(null);
    setOriginalSaleItems([]);
    setCustomerId('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    autoGenerateInvoiceNo();
    setReceivedAmount(0);
    setPaymentStatus('Paid');
    setDiscount(0);
    setNotes('');
    setOverheads([]);
    setCart([
      { ItemType: 'Egg', FlockId: '', EggInventoryId: '', InventoryId: '', Quantity: 300, UnitPrice: 5.0, GSTPercentage: 5, isTrayMode: true, trayCount: 10, eggsPerTray: 30, pricePerTray: 150 }
    ]);
    setShowBillingForm(true);
    setActiveInvoice(null);
  };

  const handleAddItem = () => {
    setCart([
      ...cart,
      { ItemType: 'Egg', FlockId: '', EggInventoryId: '', InventoryId: '', Quantity: 100, UnitPrice: 5.0, GSTPercentage: 5, isTrayMode: false }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleAddOverhead = () => {
    setOverheads([...overheads, { ChargeType: 'Transport', Amount: 0 }]);
  };

  const handleRemoveOverhead = (idx: number) => {
    setOverheads(overheads.filter((_, i) => i !== idx));
  };

  const handleItemTypeChange = (idx: number, type: 'Bird' | 'Egg' | 'General Inventory') => {
    const copy = [...cart];
    copy[idx].ItemType = type;
    copy[idx].FlockId = '';
    copy[idx].EggInventoryId = '';
    copy[idx].InventoryId = '';
    copy[idx].isTrayMode = false;

    if (type === 'Egg' && eggs.length > 0) {
      copy[idx].EggInventoryId = String(eggs[0].Id);
      copy[idx].UnitPrice = eggs[0].SellingPrice || 5.0;
      copy[idx].isTrayMode = true;
      copy[idx].eggsPerTray = 30;
      copy[idx].trayCount = 10;
      copy[idx].pricePerTray = (copy[idx].UnitPrice) * 30;
      copy[idx].Quantity = 300;
    } else if (type === 'General Inventory' && invItems.length > 0) {
      copy[idx].InventoryId = String(invItems[0].Id);
      copy[idx].UnitPrice = invItems[0].SellingPrice || 10.0;
    } else if (type === 'Bird' && flocks.length > 0) {
      copy[idx].FlockId = String(flocks[0].Id);
      copy[idx].UnitPrice = flocks[0].CurrentCount > 0 ? 150.0 : 150.0; // birds usually culls
    }
    setCart(copy);
  };

  const handleEntitySelectionChange = (idx: number, valueId: string) => {
    const copy = [...cart];
    const type = copy[idx].ItemType;
    if (type === 'Egg') {
      copy[idx].EggInventoryId = valueId;
      const target = eggs.find(e => String(e.Id) === String(valueId));
      if (target) {
        copy[idx].UnitPrice = target.SellingPrice || 5.0;
        if (copy[idx].isTrayMode) {
          copy[idx].pricePerTray = (target.SellingPrice || 5.0) * (copy[idx].eggsPerTray || 30);
        }
      }
    } else if (type === 'General Inventory') {
      copy[idx].InventoryId = valueId;
      const target = invItems.find(i => String(i.Id) === String(valueId));
      if (target) copy[idx].UnitPrice = target.SellingPrice || 10.0;
    } else if (type === 'Bird') {
      copy[idx].FlockId = valueId;
    }
    setCart(copy);
  };

  // Tray conversions Math helpers
  const handleTrayModeToggle = (idx: number, checked: boolean) => {
    const copy = [...cart];
    copy[idx].isTrayMode = checked;
    if (checked) {
      copy[idx].eggsPerTray = copy[idx].eggsPerTray || 30;
      copy[idx].trayCount = Math.ceil(copy[idx].Quantity / (copy[idx].eggsPerTray || 30)) || 10;
      copy[idx].pricePerTray = Number(((copy[idx].UnitPrice || 0) * (copy[idx].eggsPerTray || 30)).toFixed(2));
      copy[idx].Quantity = (copy[idx].trayCount || 0) * (copy[idx].eggsPerTray || 30);
    }
    setCart(copy);
  };

  const handleTrayCountChange = (idx: number, trays: number) => {
    const copy = [...cart];
    copy[idx].trayCount = trays;
    const traySize = copy[idx].eggsPerTray || 30;
    copy[idx].Quantity = Math.round(trays * traySize);
    copy[idx].pricePerTray = Number(((copy[idx].UnitPrice || 0) * traySize).toFixed(2));
    setCart(copy);
  };

  const handlePricePerTrayChange = (idx: number, val: number) => {
    const copy = [...cart];
    copy[idx].pricePerTray = val;
    const traySize = copy[idx].eggsPerTray || 30;
    copy[idx].UnitPrice = Number((val / traySize).toFixed(5));
    setCart(copy);
  };

  // Math summaries
  const overheadsTotal = overheads.reduce((acc, row) => acc + (row.Amount || 0), 0);
  const cartSubTotal = cart.reduce((acc, row) => acc + (row.Quantity * row.UnitPrice), 0);
  const gstSum = cart.reduce((acc, row) => acc + (row.Quantity * row.UnitPrice * ((row.GSTPercentage || 0) / 100)), 0);
  const grandTotal = cartSubTotal + gstSum + overheadsTotal - discount;

  // Global suggestion for egg production costs across all batches
  const totalAllExpenses = allFlocks.reduce((acc, f) => acc + (f.TotalPurchasePrice || 0) + (f.TotalFeedCost || 0) + (f.TotalVaccineCost || 0), 0);
  const totalAllEggs = allFlocks.reduce((acc, f) => acc + (f.TotalEggsCollected || 0) + (f.TotalDamagedEggs || 0), 0);
  const globalCostPerEgg = totalAllEggs > 0 ? (totalAllExpenses / totalAllEggs) : 0;

  // Sync PaymentStatus with cash received
  useEffect(() => {
    if (paymentStatus === 'Paid') {
      setReceivedAmount(parseFloat(grandTotal.toFixed(2)));
    } else if (paymentStatus === 'Credit') {
      setReceivedAmount(0);
    }
  }, [paymentStatus, grandTotal]);

  const handleQuickCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;

    try {
      const newCust = await stakeholderService.createCustomer(farmId, {
        FullName: quickCustName,
        Company: quickCustCompany,
        Phone: quickCustPhone,
        Email: quickCustEmail,
        Address: quickCustAddress,
        OpeningCreditBalance: 0
      });

      // Refresh customer list
      const refreshedCusts = await stakeholderService.getCustomers(farmId);
      setCustomers(refreshedCusts);

      // Preselect newly created customer
      if (newCust) {
        setCustomerId(String(newCust.Id));
      }
      setShowQuickCustomer(false);

      // Reset quick cust inputs
      setQuickCustName('');
      setQuickCustCompany('');
      setQuickCustPhone('');
      setQuickCustEmail('');
      setQuickCustAddress('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to add customer');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return alert('Please select a customer.');
    if (cart.length === 0) return alert('Select at least one billing item.');

    // 🛡️ FRONTEND STOCK/INVENTORY QUANTITY VALIDATION
    for (const item of cart) {
      const askQty = parseFloat(String(item.Quantity)) || 0;
      if (askQty <= 0) {
        return alert('Please enter a valid quantity greater than zero.');
      }

      // If we are editing, we can add back the quantity of the original matching item
      let originalQty = 0;
      if (editingSaleId) {
        const matchingOriginal = originalSaleItems.find(orig => {
          if (orig.ItemType !== item.ItemType) return false;
          if (item.ItemType === 'Egg') {
            return String(orig.EggInventoryId) === String(item.EggInventoryId);
          } else if (item.ItemType === 'Bird') {
            return String(orig.FlockId) === String(item.FlockId);
          } else {
            return String(orig.InventoryId) === String(item.InventoryId);
          }
        });
        if (matchingOriginal) {
          originalQty = parseFloat(String(matchingOriginal.Quantity)) || 0;
        }
      }

      if (item.ItemType === 'Egg') {
        const eggRecord = eggs.find(eg => String(eg.Id) === String(item.EggInventoryId));
        if (!eggRecord) {
          return alert('Please select a valid egg segment.');
        }
        const currentStock = eggRecord.Quantity || 0;
        const totalPermitted = currentStock + originalQty;
        if (askQty > totalPermitted) {
          return alert(
            `Insufficient Egg Inventory for "${eggRecord.GradeOrType}"!\n` +
            `Available: ${totalPermitted} Eggs (Current: ${currentStock} + Saved in edited invoice: ${originalQty})\n` +
            `Requested: ${askQty} Eggs\n\n` +
            `Please adjust the requested quantity first!`
          );
        }
      } else if (item.ItemType === 'Bird') {
        const flockRecord = allFlocks.find(f => String(f.Id) === String(item.FlockId));
        if (!flockRecord) {
          return alert('Please select a valid cull house.');
        }
        const currentStock = flockRecord.CurrentCount || 0;
        const totalPermitted = currentStock + originalQty;
        if (askQty > totalPermitted) {
          return alert(
            `Insufficient birds in "${flockRecord.FlockName}"!\n` +
            `Available: ${totalPermitted} Birds (Current: ${currentStock} + Saved in edited invoice: ${originalQty})\n` +
            `Requested: ${askQty} Birds\n\n` +
            `Please adjust the requested quantity first!`
          );
        }
      } else if (item.ItemType === 'General Inventory') {
        const invRecord = invItems.find(p => String(p.Id) === String(item.InventoryId));
        if (!invRecord) {
          return alert('Please select a valid inventory store item.');
        }
        const currentStock = invRecord.CurrentStock || 0;
        const totalPermitted = currentStock + originalQty;
        if (askQty > totalPermitted) {
          return alert(
            `Insufficient stock for general store item "${invRecord.ItemName}"!\n` +
            `Available: ${totalPermitted} ${invRecord.UnitOfMeasurement} (Current: ${currentStock} + Saved in edited invoice: ${originalQty})\n` +
            `Requested: ${askQty} ${invRecord.UnitOfMeasurement}\n\n` +
            `Please adjust the requested quantity first!`
          );
        }
      }
    }

    // Append extra overhead categories detail into the invoice Notes
    let finalNotes = notes;
    if (overheads.length > 0) {
      const overheadSummary = overheads.map(o => `${o.ChargeType}: ₹${o.Amount.toFixed(2)}`).join(', ');
      finalNotes = notes ? `${notes} (Aux Charges - ${overheadSummary})` : `Aux Charges: ${overheadSummary}`;
    }

    const payload = {
      CustomerId: parseInt(customerId),
      SaleDate: saleDate,
      InvoiceNumber: invoiceNumber || `SL-${Date.now().toString().slice(-6)}`,
      Discount: discount,
      OtherCharges: overheadsTotal,
      ReceivedAmount: receivedAmount,
      Notes: finalNotes,
      Items: cart.map(c => ({
        ItemType: c.ItemType,
        FlockId: c.FlockId ? parseInt(c.FlockId) : null,
        EggInventoryId: c.EggInventoryId ? parseInt(c.EggInventoryId) : null,
        InventoryId: c.InventoryId ? parseInt(c.InventoryId) : null,
        Quantity: c.Quantity,
        UnitPrice: parseFloat(String(c.UnitPrice)),
        GSTPercentage: parseFloat(String(c.GSTPercentage || 0))
      }))
    };

    try {
      const salePayload = {
        CustomerId: parseInt(customerId),
        SaleDate: saleDate,
        InvoiceNumber: invoiceNumber,
        Discount: discount,
        OtherCharges: overheadsTotal,
        ReceivedAmount: receivedAmount,
        Notes: finalNotes
      };

      const saleItems = cart.map(c => ({
        ItemType: c.ItemType,
        FlockId: c.FlockId ? parseInt(c.FlockId) : null,
        EggInventoryId: c.EggInventoryId ? parseInt(c.EggInventoryId) : null,
        InventoryId: c.InventoryId ? parseInt(c.InventoryId) : null,
        Quantity: c.Quantity,
        UnitPrice: parseFloat(String(c.UnitPrice)),
        GSTPercentage: parseFloat(String(c.GSTPercentage || 0))
      }));

      if (editingSaleId) {
        await salesService.updateSale(farmId, editingSaleId, salePayload, saleItems);
      } else {
        await salesService.createSale(farmId, salePayload, saleItems);
      }

      setShowBillingForm(false);
      setCart([{ ItemType: 'Egg', FlockId: '', EggInventoryId: '', InventoryId: '', Quantity: 300, UnitPrice: 5.0, GSTPercentage: 5, isTrayMode: true, trayCount: 10, eggsPerTray: 30, pricePerTray: 150 }]);
      setDiscount(0);
      setReceivedAmount(0);
      setOverheads([]);
      setEditingSaleId(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to process checkout');
    }
  };

  const handleEditSale = async (id: number) => {
    try {
      setLoading(true);
      const data = await salesService.getSaleDetails(farmId, id);

      setEditingSaleId(id);
      setOriginalSaleItems(data.items || []);
      setCustomerId(String(data.sale.CustomerId));
      setSaleDate((data.sale.SaleDate || '').split('T')[0]);
      setInvoiceNumber(data.sale.InvoiceNumber || '');
      setDiscount(data.sale.Discount || 0);
      setReceivedAmount(data.sale.ReceivedAmount || 0);
      setNotes(data.sale.Notes || '');

      // Parse other charges/overheads
      const fee = data.sale.OtherCharges || 0;
      if (fee > 0) {
        setOverheads([{ ChargeType: 'Transport', Amount: fee }]);
      } else {
        setOverheads([]);
      }

      // Map items
      const loadedCart: CartItem[] = data.items.map((it: any) => {
        const isEgg = it.ItemType === 'Egg';
        return {
          Id: it.Id,
          ItemType: it.ItemType,
          FlockId: it.FlockId ? String(it.FlockId) : '',
          EggInventoryId: it.EggInventoryId ? String(it.EggInventoryId) : '',
          InventoryId: it.InventoryId ? String(it.InventoryId) : '',
          Quantity: it.Quantity,
          UnitPrice: it.UnitPrice,
          GSTPercentage: it.GSTPercentage || 0,
          isTrayMode: isEgg,
          trayCount: isEgg ? Math.round(it.Quantity / 30) : undefined,
          eggsPerTray: isEgg ? 30 : undefined,
          pricePerTray: isEgg ? it.UnitPrice * 30 : undefined
        };
      });

      setCart(loadedCart);

      // Determine payment status state
      const bal = data.sale.GrandTotal - data.sale.ReceivedAmount;
      if (bal <= 0) setPaymentStatus('Paid');
      else if (data.sale.ReceivedAmount > 0) setPaymentStatus('Partial');
      else setPaymentStatus('Credit');

      setShowBillingForm(true);
      setActiveInvoice(null);
    } catch (e) {
      console.error(e);
      alert('Failed to load sale details for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSale = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this sales bill? This will reverse stock deductions and adjust customer credit balances and financial transactions.')) {
      return;
    }
    try {
      setLoading(true);
      await salesService.deleteSale(farmId, id);
      await fetchData();
      alert('Sales bill deleted successfully.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error occurred while deleting sales bill.');
    } finally {
      setLoading(false);
    }
  };

  // Sales Return Triggering
  const handleOpenReturnModal = async (saleObj: any) => {
    try {
      const data = await salesService.getSaleDetails(farmId, saleObj.Id);
      setReturnTargetSale(data);
      setReturnDate(new Date().toISOString().split('T')[0]);
      setReturnNotes('');

      // Set return quantities initially to 0
      const initialCounts: Record<number, number> = {};
      data.items.forEach((it: any) => {
        initialCounts[it.Id] = 0;
      });
      setReturnQuantities(initialCounts);
    } catch (err) {
      console.error(err);
      alert('Could not fetch return limits from database.');
    }
  };

  const handleProcessSalesReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetSale) return;

    // Build items payload
    const itemsPayload = Object.keys(returnQuantities)
      .map(key => {
        const saleItemId = parseInt(key);
        const qty = returnQuantities[saleItemId];
        return { SaleItemId: saleItemId, ReturnQuantity: qty };
      })
      .filter(item => item.ReturnQuantity > 0);

    if (itemsPayload.length === 0) {
      alert('Please enter a return quantity of at least 1 item.');
      return;
    }

    try {
      await salesService.returnSale(
        farmId,
        returnTargetSale.sale.Id,
        returnDate,
        returnNotes,
        itemsPayload
      );

      alert('POS Sales return verified, stock adjusted and running credit reduced.');
      setReturnTargetSale(null);
      fetchData();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Network failure processing sales return.');
    }
  };

  const printInvoiceDetails = async (id: number) => {
    try {
      const data = await salesService.getSaleDetails(farmId, id);
      setActiveInvoice(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error(e);
      alert('This application is running inside a secure nested iframe. If the print screen does not open, please click the "Open in New Tab" icon in the top right corner of the preview area and click Print!');
    }
  };

  return (
    <div className="space-y-6" id="salesdesk-module">
      {/* Header and statistics panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-600 shrink-0" />
            {t.salesTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">{t.salesSub}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showBillingForm ? (
            <button
              onClick={handleNewSaleInit}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold smooth-hover shadow-lg shadow-slate-900/10 shrink-0"
              id="new-invoice-init-btn"
            >
              <Plus className="h-4.5 w-4.5 shrink-0" />
              {t.newSaleBtn}
            </button>
          ) : (
            <button
              onClick={() => setShowBillingForm(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold smooth-hover"
            >
              Back to Records
            </button>
          )}
        </div>
      </div>

      {showBillingForm && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="pos-billing-layout">
          {/* Main Billing Form Panel */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md space-y-6"
            id="add-sale-form"
          >
            <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
              <div>
                <h4 className="font-bold text-sm tracking-wide">
                  {editingSaleId ? `Correction Invoice #${editingSaleId}` : 'POS Cashier Billing Terminal'}
                </h4>
                <p className="text-[10px] text-slate-400">Offline-first Layer Procurement and Distribution</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 font-bold font-mono">Invoice Number</span>
                <p className="text-xs font-bold text-indigo-300 font-mono">{invoiceNumber}</p>
              </div>
            </div>

            {globalCostPerEgg > 0 && (
              <div className="bg-gradient-to-r from-emerald-600 to-indigo-700 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <span className="text-xl">🥚</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-emerald-200 block font-bold font-mono tracking-wider">Multi-Batch Global Egg Cost Recommendation</span>
                    <span className="text-xs font-semibold">Cumulative Cost of Production: <b className="text-emerald-300 font-extrabold font-mono text-sm">₹{globalCostPerEgg.toFixed(2)} / Egg</b></span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-emerald-100 hidden sm:block leading-tight">
                  <p>Aggregated from all flocks</p>
                  <p className="font-mono">({Math.round(totalAllEggs)} eggs collected)</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Debtor Customer</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomer(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    title="Quick Add Customer [F6]"
                  >
                    <UserPlus className="h-3 w-3" />
                    + F6 Add
                  </button>
                </div>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                >
                  <option value="">-- Choose Debtor Profile --</option>
                  {customers.map(c => (
                    <option key={c.Id} value={c.Id}>
                      {c.FullName} (Outstanding Balance: ₹{c.CurrentCreditBalance})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing Date</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                    value={saleDate}
                    onChange={e => setSaleDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Change Invoice Ref #</label>
                <input
                  type="text"
                  placeholder="SL-XXXX-XXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 font-mono uppercase"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Cart Table with high-efficiency inputs */}
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-100 p-2.5 px-4 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4 text-slate-500" />
                  Product Cart Mappings
                </h4>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 smooth-hover shadow-sm"
                  title="Add New Row [F4]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row [F4]
                </button>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const subItemTotal = item.Quantity * item.UnitPrice;
                  const itemGst = subItemTotal * ((item.GSTPercentage || 0) / 100);
                  const totalLineCost = subItemTotal + itemGst;

                  return (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3 relative transition-all"
                    >
                      {/* Close row Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="absolute right-3 top-3 p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 smooth-hover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        {/* 1. Item Type */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Class Type</label>
                          <select
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white font-semibold text-slate-600"
                            value={item.ItemType}
                            onChange={e => handleItemTypeChange(idx, e.target.value as any)}
                          >
                            <option value="Egg">🥚 Egg Crates/Trays</option>
                            <option value="Bird">🐔 Spent Hen (Bird)</option>
                            <option value="General Inventory">📦 Store Inventory</option>
                          </select>
                        </div>

                        {/* 2. Item Stock Reference */}
                        <div className="md:col-span-5 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Actual Stock Silo</label>

                          {item.ItemType === 'Egg' && (
                            <select
                              required
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                              value={item.EggInventoryId}
                              onChange={e => handleEntitySelectionChange(idx, e.target.value)}
                            >
                              <option value="">-- Choose Egg Segment --</option>
                              {eggs.map(eg => (
                                <option key={eg.Id} value={eg.Id}>
                                  {eg.GradeOrType} [Avail: {eg.Quantity} Eggs]
                                </option>
                              ))}
                            </select>
                          )}

                          {item.ItemType === 'Bird' && (
                            <select
                              required
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                              value={item.FlockId}
                              onChange={e => handleEntitySelectionChange(idx, e.target.value)}
                            >
                              <option value="">-- Choose Cull House --</option>
                              {(editingSaleId ? allFlocks : flocks).map(f => (
                                <option key={f.Id} value={f.Id}>
                                  {f.FlockName} [Avail: {f.CurrentCount} Birds]{f.Status !== 'Active' ? ` (${f.Status})` : ''}
                                </option>
                              ))}
                            </select>
                          )}

                          {item.ItemType === 'General Inventory' && (
                            <select
                              required
                              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                              value={item.InventoryId}
                              onChange={e => handleEntitySelectionChange(idx, e.target.value)}
                            >
                              <option value="">-- Choose General Store --</option>
                              {invItems.map(p => (
                                <option key={p.Id} value={p.Id}>
                                  {p.ItemName} [Avail: {p.CurrentStock} {p.UnitOfMeasurement}]
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* 3. GST selection */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">GST Slab (%)</label>
                          <select
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-mono"
                            value={item.GSTPercentage}
                            onChange={e => {
                              const copy = [...cart];
                              copy[idx].GSTPercentage = parseFloat(e.target.value) || 0;
                              setCart(copy);
                            }}
                          >
                            <option value="0">0% Excluded</option>
                            <option value="5">GST 5%</option>
                            <option value="12">GST 12%</option>
                            <option value="18">GST 18%</option>
                            <option value="28">GST 28%</option>
                          </select>
                        </div>
                      </div>

                      {/* Conversions tray vs units row */}
                      <div className="pt-2 border-t border-slate-200/50 flex flex-col space-y-2">
                        {item.ItemType === 'Egg' && (
                          <div className="flex items-center gap-3 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 max-w-fit">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                className="rounded text-indigo-600 focus:ring-indigo-400"
                                checked={!!item.isTrayMode}
                                onChange={e => handleTrayModeToggle(idx, e.target.checked)}
                              />
                              Tray Mode (30 Eggs/Tray)
                            </label>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 items-center">
                          {item.isTrayMode && item.ItemType === 'Egg' ? (
                            // TRAY INPUTS WITH DUAL SYNC VIEW
                            <div className="flex gap-3 flex-1 flex-wrap font-mono">
                              <div className="w-28 space-y-1">
                                <label className="text-[9px] font-bold text-indigo-500 uppercase">Trays Count</label>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                                  value={item.trayCountStr !== undefined ? item.trayCountStr : (item.trayCount || 0)}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const trays = parseFloat(valStr) || 0;
                                    const copy = [...cart];
                                    copy[idx].trayCount = trays;
                                    copy[idx].trayCountStr = valStr;
                                    const traySize = copy[idx].eggsPerTray || 30;
                                    copy[idx].Quantity = Math.round(trays * traySize);
                                    copy[idx].pricePerTray = Number(((copy[idx].UnitPrice || 0) * traySize).toFixed(2));
                                    copy[idx].pricePerTrayStr = undefined;
                                    setCart(copy);
                                  }}
                                />
                              </div>
                              <div className="w-28 space-y-1">
                                <label className="text-[9px] font-bold text-slate-550 uppercase">Billing Eggs</label>
                                <input
                                  type="number"
                                  className="w-full px-2.5 py-1 border border-slate-205 rounded-lg text-xs bg-slate-50 font-bold"
                                  value={item.Quantity}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const eggsVal = valStr === '' ? '' : (parseInt(valStr) || 0);
                                    const copy = [...cart];
                                    copy[idx].Quantity = eggsVal as any;
                                    const traySize = copy[idx].eggsPerTray || 30;
                                    const numericEggs = valStr === '' ? 0 : (parseInt(valStr) || 0);
                                    copy[idx].trayCount = Number((numericEggs / traySize).toFixed(2));
                                    copy[idx].trayCountStr = undefined;
                                    copy[idx].pricePerTray = Number(((copy[idx].UnitPrice || 0) * traySize).toFixed(2));
                                    copy[idx].pricePerTrayStr = undefined;
                                    setCart(copy);
                                  }}
                                />
                              </div>
                              <div className="w-32 space-y-1">
                                <label className="text-[9px] font-bold text-indigo-500 uppercase">₹ Price Per Tray</label>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                                  value={item.pricePerTrayStr !== undefined ? item.pricePerTrayStr : (item.pricePerTray || 0)}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const pricePerTray = valStr === '' ? '' : (parseFloat(valStr) || 0);
                                    const copy = [...cart];
                                    copy[idx].pricePerTray = pricePerTray as any;
                                    copy[idx].pricePerTrayStr = valStr;
                                    const traySize = copy[idx].eggsPerTray || 30;
                                    const numericPrice = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                                    copy[idx].UnitPrice = Number((numericPrice / traySize).toFixed(5));
                                    setCart(copy);
                                  }}
                                />
                              </div>
                              <div className="w-28 space-y-1">
                                <label className="text-[9px] font-bold text-slate-550 uppercase">Per Egg (₹)</label>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold"
                                  value={item.UnitPrice}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const pricePerEgg = valStr === '' ? '' : (parseFloat(valStr) || 0);
                                    const copy = [...cart];
                                    copy[idx].UnitPrice = pricePerEgg as any;
                                    const traySize = copy[idx].eggsPerTray || 30;
                                    const numericPrice = valStr === '' ? 0 : (parseFloat(valStr) || 0);
                                    copy[idx].pricePerTray = Number((numericPrice * traySize).toFixed(2));
                                    setCart(copy);
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            // Standard units inputs
                            <div className="flex gap-3 flex-1 flex-wrap font-mono">
                              <div className="w-36 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Billing Quantity</label>
                                <input
                                  type="number"
                                  className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                                  value={item.Quantity}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const copy = [...cart];
                                    copy[idx].Quantity = valStr === '' ? '' : (parseFloat(valStr) || 0) as any;
                                    setCart(copy);
                                  }}
                                />
                              </div>
                              <div className="w-36 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">UnitPrice (₹)</label>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-bold"
                                  value={item.UnitPrice}
                                  onChange={e => {
                                    const valStr = e.target.value;
                                    const copy = [...cart];
                                    copy[idx].UnitPrice = valStr === '' ? '' : (parseFloat(valStr) || 0) as any;
                                    setCart(copy);
                                  }}
                                />
                              </div>
                              {item.ItemType === 'Egg' && (
                                <div className="flex flex-col justify-end text-[10px] text-slate-400 pb-1 italic">
                                  <span>Equivalent Trays: <b>{Number((item.Quantity / 30).toFixed(2))} Trays</b></span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-right ml-auto font-mono text-xs pr-4">
                            <span className="text-[10px] text-slate-400 block font-sans">Line Net Total</span>
                            <span className="font-extrabold text-slate-800">₹{totalLineCost.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Bird cost sugester inside the row if selected flock matches */}
                        {item.ItemType === 'Bird' && item.FlockId && (() => {
                          const selectedFlock = flocks.find(f => String(f.Id) === String(item.FlockId));
                          if (!selectedFlock) return null;
                          const initCount = selectedFlock.InitialCount || 1;
                          const pPrice = (selectedFlock.TotalPurchasePrice || 0) / initCount;
                          const feedCostPer = (selectedFlock.TotalFeedCost || 0) / initCount;
                          const vaccCostPer = (selectedFlock.TotalVaccineCost || 0) / initCount;
                          const totalCostPerBird = pPrice + feedCostPer + vaccCostPer;
                          return (
                            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs space-y-1 mt-2 font-mono">
                              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                                <Info className="h-4 w-4 text-amber-600 shrink-0" />
                                Deployed Cost per Bird for this Flock: ₹{totalCostPerBird.toFixed(2)}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[11px] text-amber-800 border-t border-amber-100 pt-1.5">
                                <div>• Purchase: <span className="font-bold">₹{pPrice.toFixed(2)}</span></div>
                                <div>• Feed Exp: <span className="font-bold">₹{feedCostPer.toFixed(2)}</span></div>
                                <div>• Vaccine Exp: <span className="font-bold">₹{vaccCostPer.toFixed(2)}</span></div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auxiliary/Other Charges and Overheads (Transport, labor, packaging) */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  Additional Overheads & Direct Charges
                </span>
                <button
                  type="button"
                  onClick={handleAddOverhead}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" /> Add Charge
                </button>
              </div>

              {overheads.map((ov, oIdx) => (
                <div key={oIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-50/40 p-2.5 border border-slate-100 rounded-lg">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Charge Type</label>
                    <select
                      className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-700"
                      value={ov.ChargeType}
                      onChange={e => {
                        const copy = [...overheads];
                        copy[oIdx].ChargeType = e.target.value as any;
                        setOverheads(copy);
                      }}
                    >
                      <option value="Transport">Transport (Overland Logistic)</option>
                      <option value="Labour">Labour Charge</option>
                      <option value="Packaging">Tray Packaging / Boxing</option>
                      <option value="Other">Other Ancillary Fee</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Charge Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white font-mono"
                      value={ov.Amount || ''}
                      onChange={e => {
                        const valStr = e.target.value;
                        const copy = [...overheads];
                        copy[oIdx].Amount = valStr === '' ? '' : (parseFloat(valStr) || 0) as any;
                        setOverheads(copy);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOverhead(oIdx)}
                    className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium max-w-fit flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Billing notes / Logistics Vehicle License
              </label>
              <textarea
                placeholder="e.g., Deliver in carrier license plate KA-03-Y88. Quality checked by manager."
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </form>

          {/* Right Panel: POS Pricing Checkout Hub */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6 font-mono relative">
              <div className="absolute right-4 top-4 opacity-10">
                <ShoppingCart className="h-28 w-28 text-white" />
              </div>

              <div className="border-b border-slate-800 pb-4">
                <h3 className="font-sans font-bold text-base text-white">Summary Box</h3>
                <p className="text-[11px] text-slate-400">Instant GST and Balance calculations</p>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Cart Items Count:</span>
                  <span className="font-bold text-white">{cart.length} Lines</span>
                </div>
                <div className="flex justify-between">
                  <span>Sub-Total:</span>
                  <span className="font-bold text-white">₹{cartSubTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sales Tax (GST Sum):</span>
                  <span className="font-bold text-white">+₹{gstSum.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-indigo-300">
                  <span>Aux Direct Charges:</span>
                  <span>+₹{overheadsTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 gap-2 text-indigo-300">
                  <span>Apply Cash Discount:</span>
                  <input
                    type="number"
                    className="w-24 bg-slate-800 text-white border border-slate-700 px-2 py-1 text-xs rounded-lg font-bold"
                    value={discount || ''}
                    onChange={e => {
                      const valStr = e.target.value;
                      setDiscount(valStr === '' ? '' : (parseFloat(valStr) || 0) as any);
                    }}
                  />
                </div>

                <div className="border-t border-slate-800 pt-4 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans block">
                      TOTAL GRAND BILL
                    </span>
                    <span className="text-2xl font-black text-emerald-400 tracking-tight font-sans">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic">INCL taxes</span>
                </div>
              </div>

              {/* Status Paid/Partial/Credit Selectors */}
              <div className="border-t border-slate-800 pt-5 space-y-4 font-sans">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block">
                    Payment Status Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(['Paid', 'Partial', 'Credit'] as const).map(pS => (
                      <button
                        key={pS}
                        type="button"
                        onClick={() => setPaymentStatus(pS)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                          paymentStatus === pS
                            ? 'bg-emerald-500 text-slate-950 shadow-md transform scale-102'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {pS === 'Paid' ? 'Full Paid' : pS === 'Credit' ? 'Full Credit' : 'Partial'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Paid field */}
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>CASH COLLECTED / PAID AMOUNT (₹)</span>
                    {paymentStatus === 'Partial' && <span className="text-indigo-400 font-bold">Edit allowed</span>}
                  </div>
                  <input
                    type="number"
                    required
                    readOnly={paymentStatus !== 'Partial'}
                    className={`w-full px-3 py-2 border text-sm rounded-lg ${
                      paymentStatus === 'Partial'
                        ? 'bg-white text-slate-900 border-indigo-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                    value={receivedAmount}
                    onChange={e => {
                      const valStr = e.target.value;
                      setReceivedAmount(valStr === '' ? '' : (parseFloat(valStr) || 0) as any);
                    }}
                  />
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs flex justify-between items-center font-mono text-slate-300">
                  <span>Left Outstanding / Credit:</span>
                  <span className={`font-bold ${grandTotal - receivedAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ₹{Math.max(0, grandTotal - receivedAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* POST form submit buttons */}
              <div className="pt-2 font-sans grid grid-cols-1 gap-2">
                <button
                  type="submit"
                  form="add-sale-form"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-lg shadow-indigo-600/20 active:translate-y-0.5 tracking-wider uppercase transition-all"
                >
                  {editingSaleId ? '💾 Confirm Invoice Update' : '⚡ Confirm & Print Invoice'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBillingForm(false)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Discard / Go Back
                </button>
              </div>
            </div>

            {/* Quick help section */}
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" /> Keyboard Shortcut HUD:
              </p>
              <ul className="space-y-0.5 list-disc pl-4 text-slate-600">
                <li><span className="font-bold text-slate-800">[F4]</span> instantly appends a product billing row</li>
                <li><span className="font-bold text-slate-800">[F6]</span> overlays the Quick Add Customer modal</li>
                <li><span className="font-bold text-slate-800">[TAB/Enter]</span> jumps through inputs for high-speed use</li>
                <li><span className="font-bold text-slate-800">[ESC]</span> closes active dialog overlays</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Addition Overlay Modal */}
      {showQuickCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleQuickCustomerSubmit}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wide">
                <User className="h-5 w-5 text-indigo-600" />
                Quick Customer Enrollment
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickCustomer(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-600">Customer Full Name (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Traders"
                  className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  value={quickCustName}
                  onChange={e => setQuickCustName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600">Company Name / Farm Entity</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Eggs Pvt Ltd"
                  className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  value={quickCustCompany}
                  onChange={e => setQuickCustCompany(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Phone Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9988X X"
                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                    value={quickCustPhone}
                    onChange={e => setQuickCustPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. name@domain.com"
                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                    value={quickCustEmail}
                    onChange={e => setQuickCustEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-600">Logistics Address</label>
                <input
                  type="text"
                  placeholder="e.g., Gate No 3, APMC Yard"
                  className="w-full px-3 py-2 border rounded-lg text-slate-800"
                  value={quickCustAddress}
                  onChange={e => setQuickCustAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowQuickCustomer(false)}
                className="px-4 py-2 border rounded-lg text-slate-600"
              >
                Discard [ESC]
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold"
              >
                Enroll Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SALES RETURN DIALOG MODAL */}
      {returnTargetSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleProcessSalesReturn}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-red-700 flex items-center gap-1.5 text-sm uppercase tracking-wider">
                <RotateCcw className="h-5 w-5" />
                Process POS Sales Return / Stock Restoration
              </h3>
              <button
                type="button"
                onClick={() => setReturnTargetSale(null)}
                className="text-slate-400 hover:text-slate-600 font-bold font-sans text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-red-50 text-red-900 rounded-xl border border-red-100 mb-2 flex items-start gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Returning Invoice #{returnTargetSale.sale.InvoiceNumber || returnTargetSale.sale.Id}</p>
                  <p className="text-[11px] text-red-700">
                    Restoring items directly increases physical count in your silo. Balance outstanding is decremented under real ledger audit rules.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Return Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-500">Comments / Reason for Return</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Customer rejected damaged yolks"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* original items available to return */}
              <div className="border border-slate-100 rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-[9px] font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Item Descr</th>
                      <th className="px-4 py-2">Bought Qty</th>
                      <th className="px-4 py-2">Rate (₹)</th>
                      <th className="px-4 py-2 text-right">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnTargetSale.items.map((line: any) => (
                      <tr key={line.Id}>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-800">{line.ItemName}</p>
                          <p className="text-[9px] text-slate-400 font-mono uppercase">{line.ItemType}</p>
                        </td>
                        <td className="px-4 py-2.5 font-bold font-mono text-slate-600">
                          {line.Quantity}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">
                          ₹{(line.UnitPrice).toFixed(2)} {line.GSTPercentage ? `(+${line.GSTPercentage}% GST)` : ''}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={line.Quantity}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-center font-mono font-bold border border-red-200 focus:border-red-400 bg-red-50/20 text-red-900 rounded"
                            value={returnQuantities[line.Id] || ''}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 0;
                              setReturnQuantities({
                                ...returnQuantities,
                                [line.Id]: Math.min(line.Quantity, Math.max(0, v))
                              });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setReturnTargetSale(null)}
                className="px-4 py-2 border rounded-lg text-slate-600"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" /> Process Return
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active High-Spec A4 Invoice Printable Display Card */}
      {activeInvoice && (
        <div id="active-invoice-modal" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white p-8 rounded-3xl border border-indigo-200/70 shadow-2xl space-y-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto ring-8 ring-slate-100"
            id="printable-bill-layout"
          >
          {/* Print Letterhead Details */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2">
                {farmSettings?.LogoUrl ? (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200">
                    <img src={farmSettings.LogoUrl} alt="Logo" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
                    <ShieldCheck className="h-6 w-6 font-bold" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black font-display text-slate-950 tracking-tight">
                    {farmSettings?.FarmName || 'POULTRY LMS 360'}
                  </h2>
                  <p className="text-[10px] text-indigo-600 uppercase font-bold tracking-widest font-mono">
                    Direct distribution & Layers Hub
                  </p>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-2 space-y-0.5 font-sans leading-relaxed">
                <p>{farmSettings?.Address || 'Industrial Estate Zone IV, Unit 12A, Pune Highway'}</p>
                {farmSettings?.Phone && <p>Phone: <b>{farmSettings.Phone}</b></p>}
                {farmSettings?.Email && <p>Email: <b>{farmSettings.Email}</b></p>}
                {farmSettings?.Website && <p>Website: <b>{farmSettings.Website}</b></p>}
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="p-1 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold uppercase tracking-widest rounded-full text-[9px] font-mono inline-block">
                TAX BILL INVOICE
              </span>
              <p className="text-sm font-bold text-slate-800 font-mono">
                Bill #: SL-{(activeInvoice.sale.InvoiceNumber || activeInvoice.sale.Id)}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Dispatch Date: {String(activeInvoice.sale.SaleDate || '').split('T')[0]}
              </p>
              <span
                className={`inline-block px-3 py-0.5 rounded-full text-[9px] uppercase font-bold mt-1 ${
                  activeInvoice.sale.Status === 'Paid'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                Invoice Status: {activeInvoice.sale.Status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-5">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block mb-1">
                Billed Purchaser
              </span>
              <p className="font-extrabold text-slate-800 text-sm">{activeInvoice.sale.CustomerName}</p>
              {activeInvoice.sale.Company && <p className="text-slate-600 font-semibold">{activeInvoice.sale.Company}</p>}
              {activeInvoice.sale.Address && <p className="text-slate-500 mt-1">{activeInvoice.sale.Address}</p>}
            </div>
            <div className="space-y-1 text-slate-600 text-right md:-mt-1">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block mb-1">
                Stakeholder Ledger
              </span>
              {activeInvoice.sale.Phone && (
                <p>
                  Purchaser Contact: <b>{activeInvoice.sale.Phone || '-'}</b>
                </p>
              )}
              {activeInvoice.sale.Email && (
                <p>
                  Purchaser Email: <b>{activeInvoice.sale.Email || '-'}</b>
                </p>
              )}
              <p className="text-indigo-600 font-bold text-[11px] font-mono">
                Payment Received: ₹{activeInvoice.sale.ReceivedAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs bg-white">
              <thead className="bg-slate-900 text-slate-100 text-[10px] uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Line Mapped Product</th>
                  <th className="px-4 py-3">SKU Category</th>
                  <th className="px-4 py-3 text-right">Units billed</th>
                  <th className="px-4 py-3 text-right">Unit Rate</th>
                  <th className="px-3 py-3 text-right">GST %</th>
                  <th className="px-4 py-3 text-right">Line Net Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activeInvoice.items.map((line: any) => {
                  const lineSub = line.Quantity * line.UnitPrice;
                  const individualLineId = line.Id;

                  return (
                    <tr key={individualLineId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold font-sans text-slate-800">
                        {line.ItemName}
                      </td>
                      <td className="px-4 py-3 italic text-slate-400 text-[11px]">
                        {line.ItemType}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {(line.Quantity || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        ₹{(line.UnitPrice).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-600 font-semibold">
                        {line.GSTPercentage || 0}%
                      </td>
                      <td className="px-4 py-3 text-right text-slate-850 font-bold">
                        ₹{(line.TotalPrice).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Render Returns if tracked on this sale */}
          {activeInvoice.returns && activeInvoice.returns.length > 0 && (
            <div className="p-4 bg-red-50/60 rounded-xl border border-red-200/80 space-y-2">
              <p className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1 font-sans">
                <RotateCcw className="h-4 w-4" /> Returns History Record
              </p>
              <div className="text-xs text-slate-600 font-mono space-y-1">
                {activeInvoice.returns.map((ret: any) => (
                  <div key={ret.Id} className="flex justify-between items-center bg-white p-2 rounded border border-red-100">
                    <div>
                      <span>Date: {ret.ReturnDate.split('T')[0]} - Reason: <b>{ret.Notes}</b></span>
                    </div>
                    <span className="font-bold text-red-700">-₹{ret.TotalReturnAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculations Summary Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2 border-t border-slate-200">
            {/* Notes Section & Signatures */}
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500">
                <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wide">
                  Invoice Terms & Notes
                </span>
                <p className="leading-relaxed">
                  {activeInvoice.sale.Notes || 'Direct cash distributor trade. Standard quality parameters certified.'}
                </p>
                <div className="border-t border-slate-200/60 pt-2 mt-2 leading-relaxed italic text-[10px] text-slate-400">
                  Calculated under Section 3 running ledger laws. Subject to Pune jurisdiction.
                </div>
              </div>

              {/* Printable Signatures */}
              <div className="hidden print:grid grid-cols-2 gap-4 pt-12 text-[10px] uppercase font-mono tracking-widest text-slate-400 text-center">
                <div className="border-t border-slate-200 pt-2">
                  Recipient Signature
                </div>
                <div className="border-t border-slate-200 pt-2">
                  Authorized Signoff
                </div>
              </div>
            </div>

            {/* Calculations breakdown list */}
            <div className="w-full text-xs font-mono space-y-2 text-slate-600 ml-auto md:max-w-xs">
              <div className="flex justify-between">
                <span>Items Net Cost:</span>
                <span className="font-extrabold text-slate-800">
                  ₹{activeInvoice.sale.SubTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>CGST / SGST Compilation:</span>
                <span>+₹{activeInvoice.sale.TotalGSTAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-700 text-[11px]">
                <span>Logistics & Overheads:</span>
                <span>+₹{(activeInvoice.sale.OtherCharges || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 text-[11px]">
                <span>Discounts Applied:</span>
                <span>-₹{activeInvoice.sale.Discount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-base border-t border-slate-200 pt-2 text-slate-900 font-extrabold font-display">
                <span>Grand Invoice Net:</span>
                <span className="text-slate-950 font-black">
                  ₹{activeInvoice.sale.GrandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-600 font-bold border-b border-indigo-100 pb-1">
                <span>Cash Paid Outright:</span>
                <span>-₹{activeInvoice.sale.ReceivedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold text-xs pt-1">
                <span>Balance outstanding:</span>
                <span>
                  ₹{Math.max(0, activeInvoice.sale.GrandTotal - activeInvoice.sale.ReceivedAmount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Column */}
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 print:hidden flex-wrap gap-3">
            <div className="text-[10.5px] text-slate-500 leading-normal flex-1 max-w-sm">
              <span className="font-bold text-slate-700 block">⚙️ Clean Print Parameters:</span>
              <span>Select <b>A4 Portrait</b>, set <b>Margins to None</b> (or Default), and toggle <b>Background Graphics ON</b> for professional output. If running in an iframe preview, open in a new tab first!</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg smooth-hover shadow-md font-sans"
              >
                <Printer className="h-4 w-4" /> Print Tax Bill (Ctrl+P)
              </button>
              <button
                onClick={() => handleEditSale(activeInvoice.sale.Id)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg smooth-hover font-sans"
              >
                <Edit className="h-4 w-4" /> Edit POS Invoice
              </button>
              <button
                onClick={() => setActiveInvoice(null)}
                className="px-4 py-2 bg-slate-200 text-slate-800 hover:bg-slate-300 text-xs font-bold rounded-lg smooth-hover font-sans"
              >
                Close Print View
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Main Historical Table Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden" id="sales-history-grid">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display">
                Dispatch Sales Records
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Historical list of customer billing POS records</p>
            </div>
            <div className="text-xs text-indigo-600 font-mono font-bold bg-indigo-50/80 p-1.5 px-3 rounded-lg border border-indigo-100">
              Total sales: <b>{sales.length} invoices</b>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer Entity</th>
                  <th className="px-5 py-3">Invoice Number</th>
                  <th className="px-5 py-3 text-right">Paid Amount</th>
                  <th className="px-5 py-3 text-right">Grand Net Bill</th>
                  <th className="px-5 py-3 text-right">Due Outstanding</th>
                  <th className="px-5 py-3 text-center">Actions / Corrections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s, index) => {
                  const billId = s.Id;
                  const rowId = `sale-row-${billId}`;
                  const outstandingAmt = s.GrandTotal - s.ReceivedAmount;

                  return (
                    <tr key={billId} className="hover:bg-slate-50/50 smooth-hover" id={rowId}>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700">
                        {(s.SaleDate || '').split('T')[0]}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{s.CustomerName}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-indigo-700">
                        {s.InvoiceNumber || `SL-INV-${s.Id}`}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-emerald-600">
                        ₹{(s.ReceivedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-905">
                        ₹{(s.GrandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold">
                        {outstandingAmt > 0.05 ? (
                          <span className="text-rose-600 bg-rose-50 border border-rose-100 rounded p-1 px-2.5 text-[11px]">
                            ₹{outstandingAmt.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-1 px-2.5 text-[11px]">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => printInvoiceDetails(s.Id)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-850 rounded-lg text-xs font-bold smooth-hover flex items-center gap-0.5"
                            title="Print Tax Receipt"
                          >
                            <Eye className="h-3 w-3" /> View A4
                          </button>
                          <button
                            onClick={() => handleEditSale(s.Id)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold smooth-hover flex items-center gap-0.5"
                            title="Edit Invoice"
                          >
                            <Edit className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleOpenReturnModal(s)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold smooth-hover flex items-center gap-0.5"
                            title="Sales Return Stock"
                          >
                            <RotateCcw className="h-3 w-3" /> Return
                          </button>
                          <button
                            onClick={() => handleDeleteSale(s.Id)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold smooth-hover flex items-center gap-0.5"
                            title="Delete Sales Bill"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
