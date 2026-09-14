import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart as LucideLineChart,
  TrendingUp,
  Download,
  Printer,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Activity,
  ChevronRight,
  PieChart as LucidePieChart,
  Layers,
  Package,
  List,
  FileText,
  Users,
  Briefcase,
  Workflow,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Language, translations } from '../translations';
import { useFarm } from '../context/FarmContext';
import { reportsService } from '../lib/dataService';

const reportTranslations: Record<Language, any> = {
  en: {
    title: 'Poultry Ledger Reports Center',
    sub: 'Double-entry ledger balances and real-time biometric flock performance calculations.',
    opSheets: 'Operational Sheets',
    specLedgers: 'Specialized Ledgers',
    exportCsv: 'Export CSV Spreadsheet',
    printPdf: 'Print Ledger / PDF',
    dateFrom: 'Date Range From',
    dateTo: 'Date Range To',
    flockCtx: 'Flock Group Context',
    allGroups: 'All Groups (Global average)',
    performance: 'Performance Index',
    financial: 'Financial Journal',
    profitAndLoss: 'Profit & Loss Statement',
    flockPandL: 'Flock-Specific P&L',
    currentStockVal: 'Current Stock Value',
    unifiedDaily: 'Unified Daily Ledger',
    salesSummary: 'Sales Ledger Summary',
    materialProc: 'Material Procurement',
    feedFormulation: 'Feed Formulation Log',
    eggOutput: 'Egg Output Chart',
    biometricBird: 'Biometric Bird Count',
    eggAudit: 'Egg Inventory Audit',
    stockMovement: 'Stock Movement Ledger',
    custOutstanding: 'Customer Outstanding',
    suppAP: 'Supplier Accounts AP'
  },
};

interface ReportsProps {
  currentLanguage: Language;
}

export default function Reports({ currentLanguage }: ReportsProps) {
  const rt = reportTranslations[currentLanguage] || reportTranslations['en'];
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Report Selection
  const [activeTab, setActiveTab] = useState<string>('Performance');

  // Filters state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedFlockId, setSelectedFlockId] = useState<string>('All');
  const [selectedItemId, setSelectedItemId] = useState<string>('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('All');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [farmSettings, setFarmSettings] = useState<any>({
    FarmName: currentFarm?.FarmName || 'Poultry Farm',
    Address: currentFarm?.Address || '',
    LogoUrl: ''
  });

  // Fetch all database records
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (currentFarm) {
        setFarmSettings({
          FarmName: currentFarm.FarmName,
          Address: currentFarm.Address || '',
          LogoUrl: ''
        });
      }

      const json = await reportsService.getAllReportData(farmId);
      setData(json);

      // Pre-populate date filters based on arrival/start of operations
      if (json.dailyLogs && json.dailyLogs.length > 0) {
        const firstDate = json.dailyLogs[0].LogDate;
        const lastDate = json.dailyLogs[json.dailyLogs.length - 1].LogDate;
        setStartDate(firstDate);
        setEndDate(lastDate);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        setStartDate(todayStr);
        setEndDate(todayStr);
      }
    } catch (e: any) {
      setError(e.message || 'Verification exception during database fetch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [farmId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 text-slate-500 min-h-[50vh]">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold font-mono uppercase tracking-widest animate-pulse">Assembling Double-Entry Ledgers...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-rose-50/70 border border-rose-200 rounded-3xl text-center space-y-4 max-w-lg mx-auto my-12">
        <AlertTriangle className="h-12 w-12 text-rose-600 mx-auto" />
        <h3 className="text-lg font-bold text-rose-950 font-display">Data Sync Exception</h3>
        <p className="text-xs text-rose-800 leading-normal">{error || 'An unexpected error occurred.'}</p>
        <button onClick={fetchAllData} className="px-5 py-2.5 bg-rose-900 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl smooth-hover inline-flex items-center gap-1.5 cursor-pointer">
          <RotateCcw className="h-3.5 w-3.5" /> Re-sync Database State
        </button>
      </div>
    );
  }

  const {
    flocks = [],
    dailyLogs = [],
    vaccinations = [],
    inventories = [],
    eggInventories = [],
    customers = [],
    suppliers = [],
    purchases = [],
    purchaseItems = [],
    purchaseExtraExpenses = [],
    sales = [],
    saleItems = [],
    recipes = [],
    recipeIngredients = [],
    transactions = [],
    categories = [],
    staff = []
  } = data;

  // Helper function to filter by Date Range
  const isWithinDateRange = (dateStr: string) => {
    if (!dateStr) return false;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // Helper currency formatting
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };

  // Safe Math parsers
  const numVal = (v: any) => Number(v) || 0;

  // ==========================================
  // 1. THE 10 REPORTS CALCULATORS
  // ==========================================

  // --- REPORT 3.1: Performance Report ---
  const calculatePerformanceReport = () => {
    return flocks.map((flock: any) => {
      const logs = dailyLogs.filter((l: any) => l.FlockId === flock.Id);
      const startD = flock.StartDate || flock.ArrivalDate;
      const totalMortalities = logs.reduce((sum: number, l: any) => sum + numVal(l.MortalityCount), 0);
      const totalFreshEggs = logs.reduce((sum: number, l: any) => sum + numVal(l.EggsCollected), 0);
      const totalDamagedEggs = logs.reduce((sum: number, l: any) => sum + numVal(l.DamagedEggsCollected), 0);
      const totalEggs = totalFreshEggs + totalDamagedEggs;
      const totalFeedUsed = logs.reduce((sum: number, l: any) => sum + numVal(l.FeedConsumedKg), 0);

      // Determine active days
      const lastLogDate = logs.length > 0 ? logs[logs.length - 1].LogDate : new Date().toISOString().split('T')[0];
      const birth = new Date(startD);
      const last = new Date(lastLogDate);
      const activeDays = Math.max(1, Math.ceil((last.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));

      // Mortality Rate
      const mortalityRate = (totalMortalities / numVal(flock.InitialCount)) * 100;

      // HDP: Hen Day Production
      const hdp = (totalEggs / (numVal(flock.InitialCount) * activeDays)) * 100;

      // Calculate daily closing birds sequence to compute average daily HDEP %
      let runningBiCount = numVal(flock.InitialCount);
      const sortedFlockLogs = [...logs].sort((a: any, b: any) => a.LogDate.localeCompare(b.LogDate));
      let hdepSum = 0;
      let loggedDaysCount = 0;

      sortedFlockLogs.forEach((log: any) => {
        const dead = numVal(log.MortalityCount);
        const soldItemsOnDate = sales.filter((s: any) => s.SaleDate === log.LogDate);
        const soldBirdsCount = saleItems
          .filter((si: any) => si.ItemType === 'Bird' && si.FlockId === flock.Id && soldItemsOnDate.some(s => s.Id === si.SaleId))
          .reduce((sum: number, si: any) => sum + numVal(si.Quantity), 0);

        const closingBirds = Math.max(0, runningBiCount - dead - soldBirdsCount);
        runningBiCount = closingBirds;

        const laid = numVal(log.EggsCollected) + numVal(log.DamagedEggsCollected);
        const hdepVal = closingBirds > 0 ? (laid * 100) / closingBirds : 0;
        hdepSum += hdepVal;
        loggedDaysCount++;
      });
      const avgHdep = loggedDaysCount > 0 ? (hdepSum / loggedDaysCount) : 0;

      // FCR: Feed Conversion Ratio Layer Standard (Kg per Dozen eggs)
      const fcrStandardDozen = totalFreshEggs > 0 ? (totalFeedUsed / (totalFreshEggs / 12)) : 0;

      // Operating Expenses
      const directFeedCost = logs.reduce((sum: number, l: any) => sum + numVal(l.FeedCost), 0);
      const directVaccineCost = vaccinations.filter((v: any) => v.FlockId === flock.Id).reduce((sum: number, v: any) => sum + numVal(v.Cost), 0);
      const directTxCost = transactions.filter((t: any) => t.FlockId === flock.Id && t.Type === 'Expense').reduce((sum: number, t: any) => sum + numVal(t.Amount), 0);

      const totalDirectExpenses = numVal(flock.TotalPurchasePrice) + directFeedCost + directVaccineCost + directTxCost;
      const totalEggSalesRev = sales.reduce((sum: number, s: any) => {
        const items = saleItems.filter((si: any) => si.SaleId === s.Id && si.ItemType === 'Egg' && si.FlockId === flock.Id);
        return sum + items.reduce((acc: number, val: any) => acc + numVal(val.TotalPrice), 0);
      }, 0);

      // Non-egg income (e.g. Birds sales)
      const otherSalesRev = sales.reduce((sum: number, s: any) => {
        const items = saleItems.filter((si: any) => si.SaleId === s.Id && si.ItemType === 'Bird' && si.FlockId === flock.Id);
        return sum + items.reduce((acc: number, val: any) => acc + numVal(val.TotalPrice), 0);
      }, 0);

      const costPerEgg = totalEggs > 0 ? ((totalDirectExpenses - otherSalesRev) / totalEggs) : 0;
      const birdCostTillDate = (totalDirectExpenses - totalEggSalesRev) / Math.max(1, numVal(flock.CurrentCount));

      return {
        ...flock,
        totalMortalities,
        totalFreshEggs,
        totalDamagedEggs,
        totalEggs,
        totalFeedUsed,
        activeDays,
        mortalityRate,
        hdp,
        hdep: avgHdep,
        fcrStandardDozen,
        costPerEgg,
        birdCostTillDate,
        totalDirectExpenses,
        totalEggSalesRev
      };
    });
  };

  // --- REPORT 3.2: Financial Report ---
  const calculateFinancialReport = () => {
    // KPI Cards calculation
    const revenueTrans = transactions.filter((t: any) => t.Type === 'Income' && isWithinDateRange(t.Date));
    const expenseTrans = transactions.filter((t: any) => t.Type === 'Expense' && isWithinDateRange(t.Date));

    const totalRevenues = revenueTrans.reduce((sum: number, t: any) => sum + numVal(t.Amount), 0);
    const totalExpenses = expenseTrans.reduce((sum: number, t: any) => sum + numVal(t.Amount), 0);
    const netCashState = totalRevenues - totalExpenses;

    const accountsReceivableBalance = customers.reduce((sum: number, c: any) => sum + numVal(c.CurrentCreditBalance), 0);
    const accountsPayableBalance = suppliers.reduce((sum: number, s: any) => sum + numVal(s.CurrentCreditBalance), 0);

    // Filterable grid list
    const filteredLedger = transactions.filter((t: any) => {
      if (!isWithinDateRange(t.Date)) return false;
      if (searchQuery) {
        const descMatch = (t.Notes || '').toLowerCase().includes(searchQuery.toLowerCase());
        const refMatch = (t.Reference || '').toLowerCase().includes(searchQuery.toLowerCase());
        return descMatch || refMatch;
      }
      return true;
    }).map((t: any) => {
      const cat = categories.find((c: any) => c.Id === t.CategoryId);
      let linkedName = '';
      if (t.FlockId) linkedName = flocks.find((f: any) => f.Id === t.FlockId)?.FlockName || '';
      else if (t.CustomerId) linkedName = customers.find((c: any) => c.Id === t.CustomerId)?.FullName || '';
      else if (t.SupplierId) linkedName = suppliers.find((s: any) => s.Id === t.SupplierId)?.CompanyName || '';
      else if (t.StaffId) linkedName = staff.find((s: any) => s.Id === t.StaffId)?.FullName || '';

      return {
        ...t,
        categoryName: cat ? cat.Name : 'General',
        linkedName
      };
    });

    return {
      totalRevenues,
      totalExpenses,
      netCashState,
      accountsReceivableBalance,
      accountsPayableBalance,
      filteredLedger
    };
  };

  // --- REPORT 3.3: Profit & Loss (P&L Chart of Accounts) ---
  const calculatePLReport = () => {
    const periodTrans = transactions.filter((t: any) => isWithinDateRange(t.Date));
    
    // Group by category Name
    const incomeGroups: Record<string, number> = {};
    const expenseGroups: Record<string, number> = {};

    categories.forEach((cat: any) => {
      if (cat.IsIncome) incomeGroups[cat.Name] = 0;
      else expenseGroups[cat.Name] = 0;
    });

    periodTrans.forEach((t: any) => {
      const cat = categories.find((c: any) => c.Id === t.CategoryId);
      if (!cat) return;
      if (cat.IsIncome) {
        incomeGroups[cat.Name] = (incomeGroups[cat.Name] || 0) + numVal(t.Amount);
      } else {
        expenseGroups[cat.Name] = (expenseGroups[cat.Name] || 0) + numVal(t.Amount);
      }
    });

    const incomeList = Object.entries(incomeGroups).map(([name, sum]) => ({ name, value: sum })).filter(item => item.value > 0);
    const expenseList = Object.entries(expenseGroups).map(([name, sum]) => ({ name, value: sum })).filter(item => item.value > 0);

    const totalIncome = incomeList.reduce((sum, item) => sum + item.value, 0);
    const totalExpenses = expenseList.reduce((sum, item) => sum + item.value, 0);
    const netProfit = totalIncome - totalExpenses;

    const chartData = categories.map((cat: any) => {
      const sum = periodTrans.filter((t: any) => t.CategoryId === cat.Id).reduce((s: number, t: any) => s + numVal(t.Amount), 0);
      return {
        name: cat.Name,
        value: sum,
        type: cat.IsIncome ? 'Income' : 'Expense'
      };
    }).filter(item => item.value > 0);

    return {
      incomeList,
      expenseList,
      totalIncome,
      totalExpenses,
      netProfit,
      chartData
    };
  };

  // --- REPORT 3.4: Batch P&L (Flock Specific) ---
  const calculateBatchPL = () => {
    const flockOptions = flocks.map((flock: any) => {
      const logs = dailyLogs.filter((l: any) => l.FlockId === flock.Id);
      
      // Direct Costs
      const feedCost = logs.reduce((sum: number, l: any) => sum + numVal(l.FeedCost), 0);
      const vaccineCost = vaccinations.filter((v: any) => v.FlockId === flock.Id).reduce((sum: number, v: any) => sum + numVal(v.Cost), 0);
      const directAssignedTxs = transactions.filter((t: any) => t.FlockId === flock.Id && t.Type === 'Expense').reduce((sum: number, t: any) => sum + numVal(t.Amount), 0);

      const totalDirectCost = feedCost + vaccineCost + directAssignedTxs;

      // Prorate Overhead Pattern (Formula 2.2)
      // Indirect overhead allocated weighted by initial count on dates active
      const totalOverheadCost = transactions.filter((t: any) => {
        const cat = categories.find((c: any) => c.Id === t.CategoryId);
        return cat && !cat.IsIncome && !t.FlockId; // General non-assign Expense
      }).reduce((sum: number, t: any) => {
        const txDate = t.Date;
        // Find which flocks are active on this date
        const activeFlocksOnDate = flocks.filter((f: any) => {
          const arrD = f.StartDate || f.ArrivalDate;
          const endD = f.EndDate || '2050-01-01';
          return txDate >= arrD && txDate <= endD;
        });

        const activeFlockIds = activeFlocksOnDate.map((f: any) => f.Id);
        if (!activeFlockIds.includes(flock.Id)) return sum; // Not active

        const sumInitialCount = activeFlocksOnDate.reduce((acc: number, f: any) => acc + numVal(f.InitialCount), 0);
        if (sumInitialCount === 0) return sum;

        const allocatedAmt = numVal(t.Amount) * (numVal(flock.InitialCount) / sumInitialCount);
        return sum + allocatedAmt;
      }, 0);

      // Revenue Assigned
      const eggSales = sales.reduce((sum: number, s: any) => {
        const items = saleItems.filter((si: any) => si.SaleId === s.Id && si.ItemType === 'Egg' && si.FlockId === flock.Id);
        return sum + items.reduce((acc: number, val: any) => acc + numVal(val.TotalPrice), 0);
      }, 0);

      const birdSales = sales.reduce((sum: number, s: any) => {
        const items = saleItems.filter((si: any) => si.SaleId === s.Id && si.ItemType === 'Bird' && si.FlockId === flock.Id);
        return sum + items.reduce((acc: number, val: any) => acc + numVal(val.TotalPrice), 0);
      }, 0);

      const directAssignedIncome = transactions.filter((t: any) => t.FlockId === flock.Id && t.Type === 'Income').reduce((sum: number, t: any) => sum + numVal(t.Amount), 0);

      const totalRevenue = eggSales + birdSales + directAssignedIncome;
      const totalFlockCost = numVal(flock.TotalPurchasePrice) + totalDirectCost + totalOverheadCost;

      const batchNetProfit = totalRevenue - totalFlockCost;
      const roi = totalFlockCost > 0 ? (batchNetProfit / totalFlockCost) * 100 : 0;

      return {
        ...flock,
        feedCost,
        vaccineCost,
        directAssignedTxs,
        totalDirectCost,
        totalOverheadCost,
        totalFlockCost,
        eggSales,
        birdSales,
        directAssignedIncome,
        totalRevenue,
        batchNetProfit,
        roi
      };
    });

    return flockOptions;
  };

  // --- REPORT 3.5: Stock Summary ---
  const calculateStockSummary = () => {
    // 1. Raw Ingredients / Feed stocks
    const stockValuationOfMaterials = inventories.map((item: any) => {
      const totalVal = numVal(item.CurrentStock) * numVal(item.UnitPrice);
      const isCritical = numVal(item.CurrentStock) <= numVal(item.MinThreshold);
      return {
        ...item,
        totalVal,
        isCritical
      };
    });

    // 2. Eggs Inventories (Units & Tray count, valued by unitPrice)
    const eggInventoryValuation = eggInventories.map((egg: any) => ({
      ...egg,
      totalVal: numVal(egg.Quantity) * numVal(egg.UnitPrice)
    }));

    // 3. Live flocks counts + values
    const liveFlocks = flocks.filter((f: any) => f.Status === 'Active').map((flock: any) => {
      // Net valuation is birds remaining count * acquisition per bird price
      const singleAcquisitionCost = numVal(flock.TotalPurchasePrice) / Math.max(1, numVal(flock.InitialCount));
      const bookValue = numVal(flock.CurrentCount) * singleAcquisitionCost;
      return {
        ...flock,
        singleAcquisitionCost,
        bookValue
      };
    });

    return {
      materials: stockValuationOfMaterials,
      eggs: eggInventoryValuation,
      flocks: liveFlocks
    };
  };

  // --- REPORT 3.6: Combined Daily Ledger ---
  const calculateCombinedLedger = () => {
    if (selectedFlockId === 'All' && flocks.length === 0) return [];
    const targetFlockId = selectedFlockId === 'All' ? flocks[0]?.Id : Number(selectedFlockId);
    if (!targetFlockId) return [];

    const flock = flocks.find((f: any) => f.Id === targetFlockId);
    if (!flock) return [];

    // Continuous loop starting from Arrival date of flock
    const logs = dailyLogs.filter((l: any) => l.FlockId === targetFlockId);
    
    // Sort logs by date to run running balance algorithm
    const sortedLogs = [...logs].sort((a: any, b: any) => a.LogDate.localeCompare(b.LogDate));

    let runningBirdsCount = numVal(flock.InitialCount);
    let runningEggTrays = 0; // standard tray has 30 eggs

    const timeline = sortedLogs.map((log: any) => {
      // Mortalities
      const openingBirds = runningBirdsCount;
      const dead = numVal(log.MortalityCount);

      // Sales during this date for this flock
      const soldItemsOnDate = sales.filter((s: any) => s.SaleDate === log.LogDate);
      const soldBirdsCount = saleItems
        .filter((si: any) => si.ItemType === 'Bird' && si.FlockId === targetFlockId && soldItemsOnDate.some(s => s.Id === si.SaleId))
        .reduce((sum: number, si: any) => sum + numVal(si.Quantity), 0);

      const closingBirds = Math.max(0, openingBirds - dead - soldBirdsCount);
      runningBirdsCount = closingBirds;

      // Egg calculations
      const openingEggs = runningEggTrays * 30;
      const laid = numVal(log.EggsCollected) + numVal(log.DamagedEggsCollected);
      
      const soldEggsCount = saleItems
        .filter((si: any) => si.ItemType === 'Egg' && si.FlockId === targetFlockId && soldItemsOnDate.some(s => s.Id === si.SaleId))
        .reduce((sum: number, si: any) => sum + numVal(si.Quantity), 0);

      const closingEggs = Math.max(0, openingEggs + laid - soldEggsCount);
      runningEggTrays = closingEggs / 30;

      // HHP & HDP rates
      const hhp = numVal(flock.InitialCount) > 0 ? (laid / numVal(flock.InitialCount)) * 100 : 0;
      const hdp = openingBirds > 0 ? (laid / openingBirds) * 100 : 0;

      // HDEP % = (total Eggs laid today * 100) / closing bird stock today
      const hdep = closingBirds > 0 ? (laid * 100) / closingBirds : 0;

      // Bird Age in days & weeks on this log date
      const startD = flock.ArrivalDate || flock.StartDate;
      let ageDiff = 0;
      if (startD) {
        const birth = new Date(startD);
        const logD = new Date(log.LogDate);
        ageDiff = Math.max(0, Math.floor((logD.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
      }
      const ageWeeks = Math.floor(ageDiff / 7);
      const ageRemDays = ageDiff % 7;

      return {
        date: log.LogDate,
        openingBirds,
        dead,
        soldBirds: soldBirdsCount,
        closingBirds,
        openingEggs,
        laid,
        soldEggs: soldEggsCount,
        closingEggs,
        feedConsumed: numVal(log.FeedConsumedKg),
        hhp,
        hdp,
        hdep,
        ageDiff,
        ageWeeks,
        ageRemDays
      };
    }).filter(row => isWithinDateRange(row.date));

    return timeline;
  };

  // --- REPORT 3.7: Sales Report ---
  const calculateSalesReport = () => {
    const list = sales.filter((s: any) => {
      if (!isWithinDateRange(s.SaleDate)) return false;
      if (selectedCustomerId !== 'All' && s.CustomerId !== Number(selectedCustomerId)) return false;
      if (searchQuery) {
        const custName = customers.find((c: any) => c.Id === s.CustomerId)?.FullName || '';
        const hasText = custName.toLowerCase().includes(searchQuery.toLowerCase()) || (s.InvoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
        return hasText;
      }
      return true;
    }).map((s: any) => {
      const cust = customers.find((c: any) => c.Id === s.CustomerId);
      const items = saleItems.filter((si: any) => si.SaleId === s.Id);
      const quantityItems = items.reduce((sum: number, item: any) => sum + numVal(item.Quantity), 0);
      return {
        ...s,
        customerName: cust ? cust.FullName : 'Retail Guest',
        totalQty: quantityItems
      };
    });

    const totalSalesValue = list.reduce((sum: number, s: any) => sum + numVal(s.GrandTotal), 0);
    const totalGstValue = list.reduce((sum: number, s: any) => sum + numVal(s.TotalGSTAmount), 0);
    const totalCashCollected = list.reduce((sum: number, s: any) => sum + numVal(s.ReceivedAmount), 0);

    return {
      list,
      totalSalesValue,
      totalGstValue,
      totalCashCollected
    };
  };

  // --- REPORT 3.8: Purchase Report ---
  const calculatePurchaseReport = () => {
    const list = purchases.filter((p: any) => {
      if (!isWithinDateRange(p.PurchaseDate)) return false;
      if (selectedSupplierId !== 'All' && p.SupplierId !== Number(selectedSupplierId)) return false;
      if (searchQuery) {
        const suppName = suppliers.find((s: any) => s.Id === p.SupplierId)?.CompanyName || '';
        const hasText = suppName.toLowerCase().includes(searchQuery.toLowerCase()) || (p.InvoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
        return hasText;
      }
      return true;
    }).map((p: any) => {
      const supp = suppliers.find((s: any) => s.Id === p.SupplierId);
      const items = purchaseItems.filter((pi: any) => pi.PurchaseId === p.Id).map((item: any) => {
        let name = '';
        if (item.ItemType === 'Flock') name = 'Bird Seedings';
        else if (item.InventoryId) name = inventories.find((i: any) => i.Id === item.InventoryId)?.ItemName || 'Inventory';
        return { ...item, itemName: name };
      });
      const extraExpenses = purchaseExtraExpenses.filter((pe: any) => pe.PurchaseId === p.Id);

      return {
        ...p,
        supplierName: supp ? supp.CompanyName : 'Indirect Supply',
        items,
        extraExpenses
      };
    });

    const totalPurchasesCost = list.reduce((sum: number, p: any) => sum + numVal(p.TotalAmount), 0);
    const totalPurchasesGST = list.reduce((sum: number, p: any) => sum + numVal(p.TotalGSTAmount), 0);
    const totalPurchasesPaid = list.reduce((sum: number, p: any) => sum + numVal(p.ReceivedAmount), 0);

    return {
      list,
      totalPurchasesCost,
      totalPurchasesGST,
      totalPurchasesPaid
    };
  };

  // --- REPORT 3.9: Production Log (Feed Formulation) ---
  const calculateProductionLog = () => {
    return recipes.map((recipe: any) => {
      // Find what ingredients are assigned
      const ingredients = recipeIngredients.filter((ri: any) => ri.FoodRecipeId === recipe.Id).map((ri: any) => {
        const item = inventories.find((i: any) => i.Id === ri.InventoryId);
        return {
          ...ri,
          itemName: item ? item.ItemName : 'Unknown Raw Material',
          itemWacCost: item ? numVal(item.UnitPrice) : 0,
          ingredientCost: numVal(ri.WeightKg) * (item ? numVal(item.UnitPrice) : 0)
        };
      });

      const totalMixCost = ingredients.reduce((sum: number, ri: any) => sum + ri.ingredientCost, 0);
      const costPerKg = numVal(recipe.BatchSizeKg) > 0 ? (totalMixCost / numVal(recipe.BatchSizeKg)) : 0;

      return {
        ...recipe,
        ingredients,
        totalMixCost,
        costPerKg
      };
    }).filter((recipe: any) => {
      if (searchQuery) return recipe.RecipeName.toLowerCase().includes(searchQuery.toLowerCase());
      return true;
    });
  };

  // --- REPORT 3.10: Egg Production Report ---
  const calculateEggProductionReport = () => {
    const periodLogs = dailyLogs.filter((l: any) => {
      if (!isWithinDateRange(l.LogDate)) return false;
      if (selectedFlockId !== 'All' && l.FlockId !== Number(selectedFlockId)) return false;
      return true;
    });

    const totalFresh = periodLogs.reduce((sum: number, l: any) => sum + numVal(l.EggsCollected), 0);
    const totalDamaged = periodLogs.reduce((sum: number, l: any) => sum + numVal(l.DamagedEggsCollected), 0);
    const totalProductionLaid = totalFresh + totalDamaged;

    const breakageRatio = totalProductionLaid > 0 ? (totalDamaged / totalProductionLaid) * 100 : 0;

    // Build timeline for Recharts laying curves
    const sortedLogs = [...periodLogs].sort((a: any, b: any) => a.LogDate.localeCompare(b.LogDate));
    const curves = sortedLogs.map((l: any) => {
      const flock = flocks.find((f: any) => f.Id === l.FlockId);
      const flockName = flock ? flock.FlockName : 'Group';
      const totLaid = numVal(l.EggsCollected) + numVal(l.DamagedEggsCollected);
      
      const hensCount = flock ? numVal(flock.CurrentCount) : 1000;
      const layRatePercentage = hensCount > 0 ? (totLaid / hensCount) * 100 : 0;

      return {
        date: l.LogDate,
        flockName,
        eggsLaid: totLaid,
        damaged: numVal(l.DamagedEggsCollected),
        layRate: Math.min(100, Math.max(0, layRatePercentage)),
        targetRate: 85 // standard breed expectation reference index
      };
    });

    return {
      totalFresh,
      totalDamaged,
      totalProductionLaid,
      breakageRatio,
      curves
    };
  };

  // ==========================================
  // 5. SPECIALIZED LEDGERS ENGINE
  // ==========================================

  // --- LEDGER 4.1: Specialized Bird Ledger ---
  const getBirdLedger = () => {
    if (selectedFlockId === 'All' && flocks.length === 0) return [];
    const targetFlockId = selectedFlockId === 'All' ? flocks[0]?.Id : Number(selectedFlockId);
    if (!targetFlockId) return [];

    const flock = flocks.find((f: any) => f.Id === targetFlockId);
    if (!flock) return [];

    const logs = dailyLogs.filter((l: any) => l.FlockId === targetFlockId);
    const sortedLogs = [...logs].sort((a: any, b: any) => a.LogDate.localeCompare(b.LogDate));

    let runningBirds = numVal(flock.InitialCount);
    const ledger: any[] = [];

    sortedLogs.forEach((log: any) => {
      const opening = runningBirds;
      const died = numVal(log.MortalityCount);
      
      // Birds Sold on this date
      const soldOnD = sales.filter((s: any) => s.SaleDate === log.LogDate);
      const sold = saleItems
        .filter((si: any) => si.ItemType === 'Bird' && si.FlockId === targetFlockId && soldOnD.some(s => s.Id === si.SaleId))
        .reduce((s: number, si: any) => s + numVal(si.Quantity), 0);

      const closing = Math.max(0, opening - died - sold);
      runningBirds = closing;

      if (isWithinDateRange(log.LogDate)) {
        ledger.push({
          date: log.LogDate,
          opening,
          died,
          sold,
          closing
        });
      }
    });

    return ledger;
  };

  // --- LEDGER 4.2: Specialized Egg Ledger (Fresh or Damaged) ---
  const getEggLedger = () => {
    // Collect all egg transactions day-by-day chronologically
    const allDatesSet = new Set<string>();
    dailyLogs.forEach((l: any) => allDatesSet.add(l.LogDate));
    sales.forEach((s: any) => allDatesSet.add(s.SaleDate));

    const allDates = Array.from(allDatesSet).sort();
    let runningQty = 0; // standard single unit eggs count
    const ledger: any[] = [];

    allDates.forEach((date) => {
      const opening = runningQty;

      // Lay Collected on Date
      const collected = dailyLogs.filter((l: any) => l.LogDate === date).reduce((sum: number, l: any) => sum + numVal(l.EggsCollected), 0);

      // Sold on Date
      const salesOnDate = sales.filter((s: any) => s.SaleDate === date);
      const sold = saleItems
        .filter((si: any) => si.ItemType === 'Egg' && salesOnDate.some(s => s.Id === si.SaleId))
        .reduce((sum: number, si: any) => sum + numVal(si.Quantity), 0);

      const closing = Math.max(0, opening + collected - sold);
      runningQty = closing;

      if (isWithinDateRange(date)) {
        ledger.push({
          date,
          opening,
          collected,
          sold,
          closing
        });
      }
    });

    return ledger;
  };

  // --- LEDGER 4.3: Specialized Inventory Ledger ---
  const getInventoryLedger = () => {
    if (selectedItemId === 'All' && inventories.length === 0) return [];
    const feedId = selectedItemId === 'All' ? inventories[0]?.Id : Number(selectedItemId);
    const item = inventories.find((i: any) => i.Id === feedId);
    if (!item) return [];

    const allDatesSet = new Set<string>();
    purchases.forEach((p: any) => allDatesSet.add(p.PurchaseDate));
    dailyLogs.forEach((l: any) => allDatesSet.add(l.LogDate));
    sales.forEach((s: any) => allDatesSet.add(s.SaleDate));

    const sortedDates = Array.from(allDatesSet).sort();
    let runningStock = 0; // start with 0 and compute forward
    const ledger: any[] = [];

    sortedDates.forEach((date) => {
      const opening = runningStock;

      // Purchases Received on Date
      const ordersOnD = purchases.filter((p: any) => p.PurchaseDate === date);
      const purchased = purchaseItems
        .filter((pi: any) => pi.InventoryId === feedId && ordersOnD.some(o => o.Id === pi.PurchaseId))
        .reduce((sum: number, pi: any) => sum + numVal(pi.Quantity), 0);

      // Consumed daily in feed formulation or daily log records
      const consumed = dailyLogs.filter((l: any) => l.LogDate === date && l.FeedItemId === feedId).reduce((sum: number, l: any) => sum + numVal(l.FeedConsumedKg), 0);

      // Sold direct on Date
      const salesOnD = sales.filter((s: any) => s.SaleDate === date);
      const sold = saleItems
        .filter((si: any) => si.InventoryId === feedId && salesOnD.some(s => s.Id === si.SaleId))
        .reduce((sum: number, si: any) => sum + numVal(si.Quantity), 0);

      const closing = Math.max(0, opening + purchased - consumed - sold);
      runningStock = closing;

      if (isWithinDateRange(date)) {
        ledger.push({
          date,
          opening,
          purchased,
          consumed,
          sold,
          closing,
          uom: item.UnitOfMeasurement
        });
      }
    });

    return ledger;
  };

  // --- LEDGER 4.4: Specialized Customer Ledger (Debtor Balance) ---
  const getCustomerLedger = () => {
    if (selectedCustomerId === 'All' && customers.length === 0) return [];
    const custId = selectedCustomerId === 'All' ? customers[0]?.Id : Number(selectedCustomerId);
    const customer = customers.find((c: any) => c.Id === custId);
    if (!customer) return [];

    let runningBalance = numVal(customer.OpeningCreditBalance); // starting debtor amount
    const ledger: any[] = [];

    const custSales = sales.filter((s: any) => s.CustomerId === custId).sort((a: any, b: any) => a.SaleDate.localeCompare(b.SaleDate));

    custSales.forEach((sale: any) => {
      const opening = runningBalance;
      const salesInvoiceDebit = numVal(sale.GrandTotal);
      const paymentsCredit = numVal(sale.ReceivedAmount);
      const closing = opening + salesInvoiceDebit - paymentsCredit;
      runningBalance = closing;

      if (isWithinDateRange(sale.SaleDate)) {
        ledger.push({
          date: sale.SaleDate,
          desc: `Invoice #${sale.InvoiceNumber || sale.Id}`,
          debit: salesInvoiceDebit,
          credit: paymentsCredit,
          balance: closing
        });
      }
    });

    return ledger;
  };

  // --- LEDGER 4.5: Specialized Supplier Ledger (Creditor AP) ---
  const getSupplierLedger = () => {
    if (selectedSupplierId === 'All' && suppliers.length === 0) return [];
    const suppId = selectedSupplierId === 'All' ? suppliers[0]?.Id : Number(selectedSupplierId);
    const supplier = suppliers.find((s: any) => s.Id === suppId);
    if (!supplier) return [];

    let runningBalance = numVal(supplier.OpeningCreditBalance); // starting liability count
    const ledger: any[] = [];

    const suppPurchases = purchases.filter((p: any) => p.SupplierId === suppId).sort((a: any, b: any) => a.PurchaseDate.localeCompare(b.PurchaseDate));

    suppPurchases.forEach((purchase: any) => {
      const opening = runningBalance;
      const billCredit = numVal(purchase.TotalAmount);
      const paymentDebit = numVal(purchase.ReceivedAmount);
      const closing = opening + billCredit - paymentDebit;
      runningBalance = closing;

      if (isWithinDateRange(purchase.PurchaseDate)) {
        ledger.push({
          date: purchase.PurchaseDate,
          desc: `Purchase Bill #${purchase.InvoiceNumber || purchase.Id}`,
          debit: paymentDebit,
          credit: billCredit,
          balance: closing
        });
      }
    });

    return ledger;
  };

  // ==========================================
  // EXPORTS MODULE (CSV and window.print PDF)
  // ==========================================

  const convertToCSV = (headers: string[], rows: any[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    return encodeURI(csvContent);
  };

  const handleDownloadCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let fileName = `${activeTab}_Report.csv`;

    if (activeTab === 'Performance') {
      headers = ['Flock Name', 'Breed', 'Initial Count', 'Live Count', 'Age (Days / Weeks)', 'Mortality %', 'HDEP %', 'HDP %', 'FCR Standard', 'Egg Sales Rev'];
      rows = calculatePerformanceReport().map(f => [
        f.FlockName, f.Breed, f.InitialCount, f.CurrentCount, `${f.activeDays} days (${Math.floor(f.activeDays / 7)}w ${f.activeDays % 7}d)`, f.mortalityRate.toFixed(2), f.hdep.toFixed(2), f.hdp.toFixed(2), f.fcrStandardDozen.toFixed(2), f.totalEggSalesRev
      ]);
    } else if (activeTab === 'Financial') {
      headers = ['Date', 'Category', 'Pay Type', 'Reference', 'Description', 'Amount'];
      rows = calculateFinancialReport().filteredLedger.map(t => [
        t.Date, t.categoryName, t.PaymentMethod, t.Reference || '', t.Notes || '', t.Amount
      ]);
    } else if (activeTab === 'PL') {
      headers = ['Category Type', 'Account Name', 'Net Amount'];
      const pl = calculatePLReport();
      pl.incomeList.forEach(item => rows.push(['Revenue', item.name, item.value]));
      pl.expenseList.forEach(item => rows.push(['Expense', item.name, item.value]));
    } else if (activeTab === 'BatchPL') {
      headers = ['Flock Name', 'Direct Expenses', 'Overhead Expenses', 'Total Costs', 'Sales Revenue', 'Return On Investment (%)'];
      rows = calculateBatchPL().map(b => [
        b.FlockName, b.totalDirectCost, b.totalOverheadCost, b.totalFlockCost, b.totalRevenue, b.roi.toFixed(2)
      ]);
    } else if (activeTab === 'Stock') {
      headers = ['Product/Item Category', 'Item Name', 'Current Stock', 'Book Valuation'];
      const st = calculateStockSummary();
      st.materials.forEach(i => rows.push([i.Category, i.ItemName, i.CurrentStock, i.totalVal]));
      st.eggs.forEach(eg => rows.push(['Eggs', eg.GradeOrType, eg.Quantity, eg.totalVal]));
      st.flocks.forEach(fl => rows.push(['Livestock', fl.FlockName, fl.CurrentCount, fl.bookValue]));
    } else if (activeTab === 'Combined') {
      headers = ['Date', 'Bird Age (Weeks/Days)', 'Birds Opening', 'Deaths', 'Birds Sold', 'Birds Closing', 'Laid Today', 'Eggs Sold', 'Eggs Balance', 'HDEP %', 'HDP %'];
      rows = calculateCombinedLedger().map(r => [
        r.date, `${r.ageDiff} days (${r.ageWeeks}w ${r.ageRemDays}d)`, r.openingBirds, r.dead, r.soldBirds, r.closingBirds, r.laid, r.soldEggs, r.closingEggs, r.hdep.toFixed(2), r.hdp.toFixed(2)
      ]);
    } else if (activeTab === 'Sales') {
      headers = ['Date', 'Invoice #', 'Customer Name', 'Quantity', 'GST Amount', 'Grand Total', 'Cash Received'];
      rows = calculateSalesReport().list.map(s => [
        s.SaleDate, s.InvoiceNumber || s.Id, s.customerName, s.totalQty, s.TotalGSTAmount, s.GrandTotal, s.ReceivedAmount
      ]);
    } else if (activeTab === 'Purchases') {
      headers = ['Date', 'Invoice #', 'Supplier Name', 'GST Amount', 'Grand Total', 'Received Amount'];
      rows = calculatePurchaseReport().list.map(p => [
        p.PurchaseDate, p.InvoiceNumber || p.Id, p.supplierName, p.TotalGSTAmount, p.TotalAmount, p.ReceivedAmount
      ]);
    } else if (activeTab === 'Production') {
      headers = ['Recipe Name', 'Batch Target Size (Kg)', 'Mixed Cost Per Kg', 'Raw Ingredients Counts'];
      rows = calculateProductionLog().map(p => [
        p.RecipeName, p.BatchSizeKg, p.costPerKg.toFixed(2), p.ingredients.length
      ]);
    } else if (activeTab === 'EggProduction') {
      headers = ['Date', 'Flock Group', 'Fresh Eggs', 'Damaged Eggs', 'Laying Rate %', 'Landed breakage %'];
      rows = calculateEggProductionReport().curves.map(c => [
        c.date, c.flockName, c.eggsLaid - c.damaged, c.damaged, c.layRate.toFixed(2), (c.damaged/Math.max(1, c.eggsLaid)*100).toFixed(2)
      ]);
    } else if (activeTab === 'BirdLedger') {
      headers = ['Date', 'Opening Bird Count', 'Mortalities', 'Birds Sold', 'Closing Bird Count'];
      rows = getBirdLedger().map(r => [r.date, r.opening, r.died, r.sold, r.closing]);
    } else if (activeTab === 'EggLedger') {
      headers = ['Date', 'Opening Eggs Stock', 'Eggs Laid (+)', 'Eggs Sold (-)', 'Closing Eggs Stock'];
      rows = getEggLedger().map(r => [r.date, r.opening, r.collected, r.sold, r.closing]);
    } else if (activeTab === 'InventoryLedger') {
      headers = ['Date', 'Opening Stock', 'Purchased Received (+)', 'Egress Consumed (-)', 'Sold (-)', 'Closing Stock'];
      rows = getInventoryLedger().map(r => [r.date, r.opening, r.purchased, r.consumed, r.sold, r.closing]);
    } else if (activeTab === 'CustomerLedger') {
      headers = ['Date', 'Reference Description', 'Debit (Sales)', 'Credit (Cash Paid)', 'Running Balance'];
      rows = getCustomerLedger().map(r => [r.date, r.desc, r.debit, r.credit, r.balance]);
    } else if (activeTab === 'SupplierLedger') {
      headers = ['Date', 'Invoice Reference', 'Debit (Payments We Paid)', 'Credit (Purchases Credited)', 'Outstanding AP Balance'];
      rows = getSupplierLedger().map(r => [r.date, r.desc, r.debit, r.credit, r.balance]);
    }

    const dataUri = convertToCSV(headers, rows);
    const link = document.createElement("a");
    link.setAttribute("href", dataUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const getBtnName = (id: string, name: string) => {
    switch (id) {
      case 'Performance': return rt.performance;
      case 'Financial': return rt.financial;
      case 'PL': return rt.profitAndLoss;
      case 'BatchPL': return rt.flockPandL;
      case 'Stock': return rt.currentStockVal;
      case 'Combined': return rt.unifiedDaily;
      case 'Sales': return rt.salesSummary;
      case 'Purchases': return rt.materialProc;
      case 'Production': return rt.feedFormulation;
      case 'EggProduction': return rt.eggOutput;
      case 'BirdLedger': return rt.biometricBird;
      case 'EggLedger': return rt.eggAudit;
      case 'InventoryLedger': return rt.stockMovement;
      case 'CustomerLedger': return rt.custOutstanding;
      case 'SupplierLedger': return rt.suppAP;
      default: return name;
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-300" id="poultry-analytics-reports-module">
      
      {/* Visual Header Grid Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600 animate-pulse" />
            {rt.title}
          </h1>
          <p className="text-[11px] text-slate-500 mt-1 font-mono tracking-wide">
            {rt.sub}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchAllData}
            className="p-3 bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 rounded-2xl smooth-hover inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Refresh database records"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleDownloadCSV}
            className="px-4 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 smooth-hover text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4" /> {rt.exportCsv}
          </button>

          <button
            onClick={handleTriggerPrint}
            className="px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl smooth-hover text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-100"
          >
            <Printer className="h-4 w-4" /> {rt.printPdf}
          </button>
        </div>
      </div>

      {/* Date Filters Row */}
      <div className="bg-slate-100/60 border border-slate-200/50 p-4 rounded-3xl grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{rt.dateFrom}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{rt.dateTo}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono" />
          </div>
        </div>

        {/* Dynamic Context Filters based on active report category */}
        {['Combined', 'EggProduction', 'BirdLedger', 'Performance'].includes(activeTab) && (
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">{rt.flockCtx}</label>
            <select value={selectedFlockId} onChange={e => setSelectedFlockId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono">
              <option value="All">{rt.allGroups}</option>
              {flocks.map((f: any) => <option key={f.Id} value={f.Id}>{f.FlockName}</option>)}
            </select>
          </div>
        )}

        {['InventoryLedger'].includes(activeTab) && (
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              'Select Inventory Item'
            </label>
            <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono">
              {inventories.map((i: any) => <option key={i.Id} value={i.Id}>{i.ItemName} ({i.Category})</option>)}
            </select>
          </div>
        )}

        {['CustomerLedger', 'Sales'].includes(activeTab) && (
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              'Customer Account'
            </label>
            <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono">
              <option value="All">
                'All Registered Customers'
              </option>
              {customers.map((c: any) => <option key={c.Id} value={c.Id}>{c.FullName}</option>)}
            </select>
          </div>
        )}

        {['SupplierLedger', 'Purchases'].includes(activeTab) && (
          <div className="space-y-1 col-span-2 lg:col-span-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              'Supplier Account'
            </label>
            <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono">
              <option value="All">
                'All Wholesalers'
              </option>
              {suppliers.map((s: any) => <option key={s.Id} value={s.Id}>{s.CompanyName}</option>)}
            </select>
          </div>
        )}

        {/* Simple search bar */}
        {['Financial', 'Sales', 'Purchases', 'Production'].includes(activeTab) && (
          <div className="space-y-1 col-span-2 lg:col-span-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
              'Quick Search Invoice / Reference'
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input type="text" placeholder='Search...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Reports Side Menu drawer */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-100 rounded-3xl p-5 space-y-4 print:hidden">
          <div>
            <h3 className="text-xs font-extrabold font-mono uppercase tracking-widest text-slate-400">{rt.opSheets}</h3>
            <div className="mt-2.5 flex flex-wrap lg:flex-col gap-1 w-full">
              {[
                { id: 'Performance', name: 'Performance Index', icon: Activity },
                { id: 'Financial', name: 'Financial Journal', icon: DollarSign },
                { id: 'PL', name: 'Profit & Loss Statement', icon: LucidePieChart },
                { id: 'BatchPL', name: 'Flock-Specific P&L', icon: Layers },
                { id: 'Stock', name: 'Current Stock Value', icon: Package },
                { id: 'Combined', name: 'Unified Daily Ledger', icon: List },
                { id: 'Sales', name: 'Sales Ledger Summary', icon: FileText },
                { id: 'Purchases', name: 'Material Procurement', icon: FileText },
                { id: 'Production', name: 'Feed Formulation Log', icon: Workflow },
                { id: 'EggProduction', name: 'Egg Output Chart', icon: TrendingUp }
              ].map((btn) => {
                const Icon = btn.icon;
                const isSel = activeTab === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => { setActiveTab(btn.id); setSearchQuery(''); }}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold smooth-hover w-full justify-start text-left shrink-0 cursor-pointer ${isSel ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{getBtnName(btn.id, btn.name)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-extrabold font-mono uppercase tracking-widest text-slate-400">{rt.specLedgers}</h3>
            <div className="mt-2.5 flex flex-wrap lg:flex-col gap-1 w-full">
              {[
                { id: 'BirdLedger', name: 'Biometric Bird Count', icon: Activity },
                { id: 'EggLedger', name: 'Egg Inventory Audit', icon: Package },
                { id: 'InventoryLedger', name: 'Stock Movement Ledger', icon: Package },
                { id: 'CustomerLedger', name: 'Customer Outstanding', icon: Users },
                { id: 'SupplierLedger', name: 'Supplier Accounts AP', icon: Briefcase }
              ].map((btn) => {
                const Icon = btn.icon;
                const isSel = activeTab === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => { setActiveTab(btn.id); setSearchQuery(''); }}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold smooth-hover w-full justify-start text-left shrink-0 cursor-pointer ${isSel ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{getBtnName(btn.id, btn.name)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Layout Grid */}
        <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 min-h-[60vh] overflow-x-auto shadow-2xs">
          
          {/* print header block */}
          <div className="hidden print:block mb-8 border-b border-slate-200 pb-4 text-center">
            {farmSettings?.LogoUrl && (
              <img src={farmSettings.LogoUrl} alt="Logo" className="h-12 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-2xl font-bold font-display text-slate-950">{farmSettings?.FarmName || 'Poultry LMS'} Systems Audit</h1>
            {farmSettings?.Address && <p className="text-xs text-slate-500 font-sans">{farmSettings.Address}</p>}
            <p className="text-xs font-mono text-slate-500 mt-1">Audit Type: {getBtnName(activeTab, activeTab)} Report Protocol • Printed on: {new Date().toLocaleDateString()}</p>
            <p className="text-xs font-mono text-slate-500">Filters: Date {startDate || 'all'} to {endDate || 'all'}</p>
          </div>

          {/* MODE 1: Performance Index */}
          {activeTab === 'Performance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Avg Lay Rate (HDP)</span>
                  <span className="text-xl font-bold font-display text-indigo-600">
                    {(calculatePerformanceReport().reduce((sum, f) => sum + f.hdp, 0) / Math.max(1, flocks.length)).toFixed(1)}%
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Avg FCR (Feed dozen)</span>
                  <span className="text-xl font-bold font-display text-indigo-600">
                    {(calculatePerformanceReport().reduce((sum, f) => sum + f.fcrStandardDozen, 0) / Math.max(1, flocks.length)).toFixed(2)}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Global Loss rate</span>
                  <span className="text-xl font-bold font-display text-amber-600">
                    {(calculatePerformanceReport().reduce((sum, f) => sum + f.mortalityRate, 0) / Math.max(1, flocks.length)).toFixed(2)}%
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Total Fresh eggs</span>
                  <span className="text-xl font-bold font-display text-slate-900">
                    {calculatePerformanceReport().reduce((sum, f) => sum + f.totalFreshEggs, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <th className="py-3">Flock Name</th>
                    <th className="py-3">Breed</th>
                    <th className="py-3">Original Counts</th>
                    <th className="py-3">Remaining Count</th>
                    <th className="py-3">Age (Days/Weeks)</th>
                    <th className="py-3">Loss Rate</th>
                    <th className="py-3 text-indigo-700">HDEP %</th>
                    <th className="py-3">Lay Rate (HDP)</th>
                    <th className="py-3">FCR (dozen)</th>
                    <th className="py-3 text-right">Avg Bird Book Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculatePerformanceReport().map((row: any) => (
                    <tr key={row.Id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-slate-900">{row.FlockName}</td>
                      <td className="py-3 text-slate-500">{row.Breed}</td>
                      <td className="py-3 font-mono">{row.InitialCount}</td>
                      <td className="py-3 font-mono">{row.CurrentCount}</td>
                      <td className="py-3 font-mono">{row.activeDays} days ({Math.floor(row.activeDays / 7)}w {row.activeDays % 7}d)</td>
                      <td className="py-3 font-mono font-bold text-amber-600">{row.mortalityRate.toFixed(2)}%</td>
                      <td className="py-3 font-mono font-bold text-indigo-700">{row.hdep.toFixed(2)}%</td>
                      <td className="py-3 font-mono font-bold text-indigo-600">{row.hdp.toFixed(2)}%</td>
                      <td className="py-3 font-mono">{row.fcrStandardDozen.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">{formatMoney(row.birdCostTillDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MODE 2: Financial Journal */}
          {activeTab === 'Financial' && (() => {
            const fin = calculateFinancialReport();
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider block uppercase">Total Period Revenues</span>
                    <span className="text-base font-bold text-emerald-600">{formatMoney(fin.totalRevenues)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider block uppercase">Total Expenses Outflow</span>
                    <span className="text-base font-bold text-rose-600">{formatMoney(fin.totalExpenses)}</span>
                  </div>
                  <div className="p-4 bg-slate-100 border border-slate-200/60 rounded-2xl">
                    <span className="text-[9px] text-slate-500 font-mono font-bold tracking-wider block uppercase">Net Cash Position</span>
                    <span className={`text-base font-bold ${fin.netCashState >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {formatMoney(fin.netCashState)}
                    </span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider block uppercase">Total Outstanding Debtors</span>
                    <span className="text-base font-bold text-slate-900">{formatMoney(fin.accountsReceivableBalance)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[9px] text-slate-400 font-mono font-bold tracking-wider block uppercase">Total Accounts Payable</span>
                    <span className="text-base font-bold text-slate-900">{formatMoney(fin.accountsPayableBalance)}</span>
                  </div>
                </div>

                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                      <th className="py-3">Date</th>
                      <th className="py-3">Category Name</th>
                      <th className="py-3">Pay Type</th>
                      <th className="py-3">Linked entity</th>
                      <th className="py-3">Transaction details</th>
                      <th className="py-3 text-right">Debit (In)</th>
                      <th className="py-3 text-right">Credit (Out)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {fin.filteredLedger.map((row: any) => (
                      <tr key={row.Id} className="hover:bg-slate-50/50">
                        <td className="py-3 text-slate-500">{row.Date}</td>
                        <td className="py-3 font-semibold text-slate-900">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${row.Type === 'Income' ? 'bg-emerald-100/50 text-emerald-800' : 'bg-rose-100/50 text-rose-800'}`}>
                            {row.categoryName}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{row.PaymentMethod}</td>
                        <td className="py-3 font-sans font-semibold text-slate-800">{row.linkedName || 'General Office'}</td>
                        <td className="py-3 text-slate-500 truncate max-w-[150px]" title={row.Notes}>{row.Notes || row.Reference || '-'}</td>
                        <td className="py-3 text-right font-bold text-emerald-600">{row.Type === 'Income' ? formatMoney(row.Amount) : '-'}</td>
                        <td className="py-3 text-right font-bold text-rose-600">{row.Type === 'Expense' ? formatMoney(row.Amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* MODE 3: Profit & Loss Statement */}
          {activeTab === 'PL' && (() => {
            const pl = calculatePLReport();
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold font-mono block uppercase">Gross Revenue Streams</span>
                    <span className="text-xl font-bold font-display text-emerald-600 mt-1 block">{formatMoney(pl.totalIncome)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold font-mono block uppercase">Accrued Operational Costs</span>
                    <span className="text-xl font-bold font-display text-rose-600 mt-1 block">{formatMoney(pl.totalExpenses)}</span>
                  </div>
                  <div className="p-4 bg-slate-900 text-white rounded-2xl text-center shadow-lg shadow-indigo-100/20">
                    <span className="text-[10px] text-slate-400 font-bold font-mono block uppercase">Net Profit Margin</span>
                    <span className="text-xl font-bold font-display mt-1 block">{formatMoney(pl.netProfit)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                  {/* Revenue Account lines */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-600 border-b border-slate-100 pb-2">Category Credits (Revenue)</h4>
                    <div className="space-y-2">
                      {pl.incomeList.map((item: any) => (
                        <div key={item.name} className="flex justify-between items-center text-xs text-slate-700 bg-slate-50 p-3 rounded-xl font-mono">
                          <span className="font-sans font-semibold text-slate-900">{item.name}</span>
                          <span>{formatMoney(item.value)}</span>
                        </div>
                      ))}
                      {pl.incomeList.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">No credits recorded in range.</div>}
                    </div>
                  </div>

                  {/* Expense Account lines */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-rose-600 border-b border-slate-100 pb-2">Category Debits (Expenses)</h4>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {pl.expenseList.map((item: any) => (
                        <div key={item.name} className="flex justify-between items-center text-xs text-slate-700 bg-slate-50 p-3 rounded-xl font-mono">
                          <span className="font-sans font-semibold text-slate-900">{item.name}</span>
                          <span>{formatMoney(item.value)}</span>
                        </div>
                      ))}
                      {pl.expenseList.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">No debits recorded in range.</div>}
                    </div>
                  </div>
                </div>

                {/* Recharts Pie Chart Visual Breakdown */}
                {pl.chartData.length > 0 && (
                  <div className="h-64 pt-6 border-t border-slate-100 print:hidden">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 mb-4 text-center">Chart of Accounts Breakdown</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={pl.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

          {/* MODE 4: Flock-Specific P&L */}
          {activeTab === 'BatchPL' && (
            <div className="space-y-6">
              <p className="text-slate-500 text-[11px] font-mono mb-4 leading-normal">
                Prorates general, warehouse, and labor costs proportionally by initial bird inventory count against other cohorts alive during the cost interval.
              </p>

              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <th className="py-3">Batch cohort</th>
                    <th className="py-3 text-right">Raw Bird Cost</th>
                    <th className="py-3 text-right">Direct Expenses</th>
                    <th className="py-3 text-right">Overhead Pro-Rata</th>
                    <th className="py-3 text-right">Total Costs</th>
                    <th className="py-3 text-right">Assigned Sales</th>
                    <th className="py-3 text-right">Net Profit</th>
                    <th className="py-3 text-right">ROI (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculateBatchPL().map((row: any) => (
                    <tr key={row.Id} className="hover:bg-slate-50/50 font-mono">
                      <td className="py-3 font-semibold text-slate-900 font-sans">{row.FlockName} ({row.Status})</td>
                      <td className="py-3 text-right">{formatMoney(row.TotalPurchasePrice)}</td>
                      <td className="py-3 text-right text-slate-600">{formatMoney(row.totalDirectCost)}</td>
                      <td className="py-3 text-right text-slate-400">{formatMoney(row.totalOverheadCost)}</td>
                      <td className="py-3 text-right font-bold text-slate-900">{formatMoney(row.totalFlockCost)}</td>
                      <td className="py-3 text-right text-emerald-600 font-bold">{formatMoney(row.totalRevenue)}</td>
                      <td className={`py-3 text-right font-bold ${row.batchNetProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {formatMoney(row.batchNetProfit)}
                      </td>
                      <td className={`py-3 text-right font-bold ${row.roi >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {row.roi.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MODE 5: Current Stock Value */}
          {activeTab === 'Stock' && (() => {
            const stock = calculateStockSummary();
            return (
              <div className="space-y-8">
                {/* 1. Raw feeds */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">Material Ingredients Stock</h4>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-mono tracking-wider text-[9px]">
                        <th>Material Item</th>
                        <th>Classification</th>
                        <th>Current Weight</th>
                        <th>WAC Cost Rate</th>
                        <th className="text-right">Total Value</th>
                        <th className="text-right">Restock Warning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {stock.materials.map((row: any) => (
                        <tr key={row.Id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-semibold text-slate-900 font-sans">{row.ItemName}</td>
                          <td className="py-2.5 text-slate-500">{row.Category}</td>
                          <td className="py-2.5">{row.CurrentStock} {row.UnitOfMeasurement}</td>
                          <td className="py-2.5">{formatMoney(row.UnitPrice)}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{formatMoney(row.totalVal)}</td>
                          <td className="py-2.5 text-right font-sans">
                            {row.isCritical ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded-full">REORDER</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] rounded-full">ADEQUATE</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Eggs stocks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-600 border-b border-slate-100 pb-2">Egg Inventory Ledger</h4>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-mono tracking-wider text-[9px]">
                        <th>Grade / Quality</th>
                        <th>Packed form</th>
                        <th>Quantity (pcs)</th>
                        <th>Trays equivalent</th>
                        <th>Reference price</th>
                        <th className="text-right">Total Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {stock.eggs.map((row: any) => (
                        <tr key={row.Id}>
                          <td className="py-2.5 font-semibold text-slate-900 font-sans">{row.GradeOrType}</td>
                          <td className="py-2.5 text-slate-500">{row.PackSize}</td>
                          <td className="py-2.5 font-bold">{row.Quantity} units</td>
                          <td className="py-2.5">{(row.Quantity / 30).toFixed(1)} trays</td>
                          <td className="py-2.5">{formatMoney(row.UnitPrice)}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{formatMoney(row.totalVal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. Live poultry stocks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">Live Poultry Bio-Stocks Value</h4>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-mono tracking-wider text-[9px]">
                        <th>Flock Batch</th>
                        <th>Breed</th>
                        <th>Hens Alive</th>
                        <th>Acquisition cost rate</th>
                        <th className="text-right">Cumulative Book Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {stock.flocks.map((row: any) => (
                        <tr key={row.Id}>
                          <td className="py-2.5 font-semibold text-slate-900 font-sans">{row.FlockName}</td>
                          <td className="py-2.5 text-slate-500">{row.Breed}</td>
                          <td className="py-2.5 font-bold">{row.CurrentCount} / {row.InitialCount}</td>
                          <td className="py-2.5">{formatMoney(row.singleAcquisitionCost)}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900">{formatMoney(row.bookValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* MODE 6: Unified Daily Ledger */}
          {activeTab === 'Combined' && (
            <div className="space-y-4">
              {calculateCombinedLedger().length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Select an active flock context above to audit day-by-day sequence ledger rows.</div>
              )}
              {calculateCombinedLedger().length > 0 && (
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                      <th className="py-2">Date</th>
                      <th className="py-2">Bird Age (Days/Weeks)</th>
                      <th className="py-2">Hens Opening</th>
                      <th className="py-2">Mortality</th>
                      <th className="py-2">Hens Sold</th>
                      <th className="py-2">Hens Closing</th>
                      <th className="py-2 text-indigo-600">Eggs Laid</th>
                      <th className="py-2 text-rose-600">Eggs Sold</th>
                      <th className="py-2 text-slate-900">Eggs Stock (pcs)</th>
                      <th className="py-2">Feed Eaten</th>
                      <th className="py-2 text-indigo-700">HDEP %</th>
                      <th className="py-2">HDP Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {calculateCombinedLedger().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 text-slate-500">{row.date}</td>
                        <td className="py-2 text-slate-800 font-semibold">{row.ageDiff} days ({row.ageWeeks}w {row.ageRemDays}d)</td>
                        <td className="py-2">{row.openingBirds}</td>
                        <td className="py-2 font-bold text-amber-600">-{row.dead}</td>
                        <td className="py-2">-{row.soldBirds}</td>
                        <td className="py-2 font-semibold text-slate-850">{row.closingBirds}</td>
                        <td className="py-2 font-bold text-indigo-600">+{row.laid}</td>
                        <td className="py-2 text-rose-600">-{row.soldEggs}</td>
                        <td className="py-2 text-slate-900 font-extrabold">{row.closingEggs}</td>
                        <td className="py-2">{row.feedConsumed} Kg</td>
                        <td className="py-2 font-bold text-indigo-700">{row.hdep.toFixed(1)}%</td>
                        <td className="py-2 font-bold text-slate-900">{row.hdp.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* MODE 7: Sales Ledger Summary */}
          {activeTab === 'Sales' && (() => {
            const ledger = calculateSalesReport();
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Accumulated Invoices Value</span>
                    <span className="text-base font-bold text-slate-900 font-mono">{formatMoney(ledger.totalSalesValue)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">GST Collected Amount</span>
                    <span className="text-base font-bold text-slate-900 font-mono">{formatMoney(ledger.totalGstValue)}</span>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <span className="text-[10px] text-emerald-600 font-mono font-bold block uppercase tracking-wider">Sales Revenue Cash Received</span>
                    <span className="text-base font-bold text-emerald-800 font-mono">{formatMoney(ledger.totalCashCollected)}</span>
                  </div>
                </div>

                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                      <th className="py-3">Invoice date</th>
                      <th className="py-3">Invoice Number</th>
                      <th className="py-3">Customer Acc</th>
                      <th className="py-3">Total Qty (units)</th>
                      <th className="py-3 text-right">GST Taxes</th>
                      <th className="py-3 text-right">Grand Total</th>
                      <th className="py-3 text-right">Received Cash</th>
                      <th className="py-3 text-right">Outstanding terms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ledger.list.map((row: any) => {
                      const outstanding = numVal(row.GrandTotal) - numVal(row.ReceivedAmount);
                      return (
                        <tr key={row.Id} className="hover:bg-slate-50/50">
                          <td className="py-3 text-slate-500">{row.SaleDate}</td>
                          <td className="py-3 font-semibold text-slate-900">#{row.InvoiceNumber || row.Id}</td>
                          <td className="py-3 font-sans font-bold text-slate-800">{row.customerName}</td>
                          <td className="py-3">{row.totalQty}</td>
                          <td className="py-3 text-right">{formatMoney(row.TotalGSTAmount)}</td>
                          <td className="py-3 text-right font-bold text-slate-900">{formatMoney(row.GrandTotal)}</td>
                          <td className="py-3 text-right text-emerald-600 font-bold">{formatMoney(row.ReceivedAmount)}</td>
                          <td className={`py-3 text-right font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {outstanding > 0 ? formatMoney(outstanding) : 'SETTLED'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* MODE 8: Material Procurement */}
          {activeTab === 'Purchases' && (() => {
            const dataP = calculatePurchaseReport();
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Gross Purchases Value</span>
                    <span className="text-base font-bold text-slate-900 font-mono">{formatMoney(dataP.totalPurchasesCost)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Input Tax Credit (GST)</span>
                    <span className="text-base font-bold text-slate-900 font-mono">{formatMoney(dataP.totalPurchasesGST)}</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Procurements Payments Made</span>
                    <span className="text-base font-bold text-indigo-600 font-mono">{formatMoney(dataP.totalPurchasesPaid)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {dataP.list.map((purchase: any) => (
                    <div key={purchase.Id} className="border border-slate-100 rounded-3xl p-4 bg-slate-50/40 space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs font-mono">
                        <div>
                          <span className="font-bold text-slate-900">Invoice: #{purchase.InvoiceNumber || purchase.Id}</span>
                          <span className="text-slate-400 block text-[10px]">Supplier: <b className="font-sans text-slate-700">{purchase.supplierName}</b> • Date: {purchase.PurchaseDate}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{formatMoney(purchase.TotalAmount)}</span>
                          <span className={`block text-[10px] font-bold ${purchase.Status === 'Paid' ? 'text-emerald-600' : 'text-amber-500'}`}>{purchase.Status.toUpperCase()}</span>
                        </div>
                      </div>

                      {/* Items and landed costs breakdown */}
                      <table className="w-full text-left text-[11px] font-mono">
                        <thead>
                          <tr className="text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-100 pb-1">
                            <th>Item Name</th>
                            <th>Item Type</th>
                            <th>Qty</th>
                            <th>Unit price</th>
                            <th>Base price</th>
                            <th>Taxes</th>
                            <th>Allocated Landed Cost</th>
                            <th className="text-right">Final Landed Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchase.items.map((it: any) => (
                            <tr key={it.Id} className="text-slate-700">
                              <td className="py-1.5 font-bold font-sans text-slate-900">{it.itemName || 'Biomentric Flock'}</td>
                              <td className="py-1.5">{it.ItemType}</td>
                              <td className="py-1.5">{it.Quantity}</td>
                              <td className="py-1.5">{formatMoney(it.UnitPrice)}</td>
                              <td className="py-1.5">{formatMoney(it.Quantity * it.UnitPrice)}</td>
                              <td className="py-1.5">{formatMoney(it.GSTAmount)}</td>
                              <td className="py-1.5 text-indigo-600">+{formatMoney(it.AllocatedOverhead)}</td>
                              <td className="py-1.5 text-right font-bold text-slate-900">{formatMoney(it.FinalLandedAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* MODE 9: Feed Formulation Log */}
          {activeTab === 'Production' && (
            <div className="space-y-6">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <th className="py-3">Recipe mixed</th>
                    <th className="py-3 text-right">Standard Mix batch size</th>
                    <th className="py-3 text-right">Sum Ingredients Cost</th>
                    <th className="py-3 text-right">Calculated Milled Cost / Kg</th>
                    <th className="py-3">Ingredient percentage breakdown used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calculateProductionLog().map((row: any) => (
                    <tr key={row.Id} className="hover:bg-slate-50/50 font-mono">
                      <td className="py-3 font-semibold text-slate-900 font-sans">{row.RecipeName}</td>
                      <td className="py-3 text-right font-bold text-slate-950">{(row.BatchSizeKg ?? 0).toLocaleString()} Kg</td>
                      <td className="py-3 text-right text-indigo-600">{formatMoney(row.totalMixCost)}</td>
                      <td className="py-3 text-right font-bold text-emerald-600">{formatMoney(row.costPerKg)} / Kg</td>
                      <td className="py-3 text-slate-500 font-sans text-[10px]">
                        <ul className="list-disc pl-4 space-y-0.5">
                          {row.ingredients.map((ing: any, i: number) => (
                            <li key={i}>
                              {ing.itemName}: <b className="font-mono text-slate-700">{ing.Percentage}%</b> ({ing.WeightKg} Kg • {formatMoney(ing.ingredientCost)})
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MODE 10: Egg Output Chart */}
          {activeTab === 'EggProduction' && (() => {
            const egg = calculateEggProductionReport();
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Aggregated Fresh Eggs</span>
                    <span className="text-base font-bold text-emerald-600 font-mono">{egg.totalFresh.toLocaleString()} units</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Damaged/Broken Eggs</span>
                    <span className="text-base font-bold text-amber-600 font-mono">{egg.totalDamaged.toLocaleString()} units</span>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Breakage Rate percentage</span>
                    <span className="text-base font-bold text-rose-600 font-mono">{egg.breakageRatio.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Recharts laying curve visual */}
                {egg.curves.length > 0 && (
                  <div className="h-64 pt-6 print:hidden">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 mb-4 text-center">Active Lay Curve vs Typical Breed Standard (85%)</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={egg.curves}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} unit="%" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="damaged" name="Damaged Eggs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="layRate" name="Actual HDP Lay Rate %" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" strokeDasharray="5 5" dataKey="targetRate" name="Breed Expectation" stroke="#94a3b8" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

          {/* LEDGER 4.1: Biometric Bird Count */}
          {activeTab === 'BirdLedger' && (
            <div className="space-y-4">
              {getBirdLedger().length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Select a flock context above to view specialized physical bird inventory sequences.</div>
              )}
              {getBirdLedger().length > 0 && (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Opening Balance</th>
                      <th className="py-2.5 text-amber-600">Mortality Count (-)</th>
                      <th className="py-2.5 text-rose-600">Birds Sold (-)</th>
                      <th className="py-2.5 text-slate-900">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {getBirdLedger().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-500">{row.date}</td>
                        <td className="py-2.5 font-bold">{row.opening} birds</td>
                        <td className="py-2.5 font-bold text-amber-600">-{row.died}</td>
                        <td className="py-2.5 font-bold text-rose-600">-{row.sold}</td>
                        <td className="py-2.5 text-slate-950 font-extrabold">{row.closing} birds</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LEDGER 4.2: Egg Inventory Audit */}
          {activeTab === 'EggLedger' && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Opening Stock Balance</th>
                  <th className="py-2.5 text-indigo-600">Fresh Egg Production (+)</th>
                  <th className="py-2.5 text-rose-600">Eggs Sold Outflow (-)</th>
                  <th className="py-2.5 text-slate-900">Closing Stock Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {getEggLedger().map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 text-slate-500">{row.date}</td>
                    <td className="py-2.5">{row.opening.toLocaleString()} pcs</td>
                    <td className="py-2.5 text-indigo-600 font-bold">+{row.collected.toLocaleString()}</td>
                    <td className="py-2.5 text-rose-600 font-bold">-{row.sold.toLocaleString()}</td>
                    <td className="py-2.5 text-slate-950 font-extrabold">{row.closing.toLocaleString()} pcs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* LEDGER 4.3: Stock Movement Ledger */}
          {activeTab === 'InventoryLedger' && (
            <div className="space-y-4">
              {getInventoryLedger().length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Select a raw material item above in filters to view localized chronologies.</div>
              )}
              {getInventoryLedger().length > 0 && (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Opening balance</th>
                      <th className="py-2.5 text-emerald-600">Material Received (+)</th>
                      <th className="py-2.5 text-rose-600">Feed Consumed (-)</th>
                      <th className="py-2.5 text-rose-600">Directly Sold (-)</th>
                      <th className="py-2.5 text-slate-900">Closing balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getInventoryLedger().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-500">{row.date}</td>
                        <td className="py-2.5">{row.opening} {row.uom}</td>
                        <td className="py-2.5 text-emerald-600 font-bold">+{row.purchased}</td>
                        <td className="py-2.5 text-rose-600 font-bold">-{row.consumed}</td>
                        <td className="py-2.5 text-rose-500">-{row.sold}</td>
                        <td className="py-2.5 text-slate-950 font-extrabold">{row.closing} {row.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LEDGER 4.4: Customer Outstanding */}
          {activeTab === 'CustomerLedger' && (
            <div className="space-y-4">
              {getCustomerLedger().length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-sans">Select customer context above to query outstanding double-entry records.</div>
              )}
              {getCustomerLedger().length > 0 && (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Invoice Reference</th>
                      <th className="py-2.5 text-right text-rose-600">Debits (+) (Sales bills)</th>
                      <th className="py-2.5 text-right text-emerald-600">Credits (-) (Payments Received)</th>
                      <th className="py-2.5 text-right text-slate-900">Debtor Balance (Dues)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getCustomerLedger().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-500">{row.date}</td>
                        <td className="py-2.5 font-sans font-bold text-slate-750">{row.desc}</td>
                        <td className="py-2.5 text-right text-rose-600 font-bold">{row.debit > 0 ? formatMoney(row.debit) : '-'}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-bold">{row.credit > 0 ? formatMoney(row.credit) : '-'}</td>
                        <td className="py-2.5 text-right font-extrabold text-slate-950">{formatMoney(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LEDGER 4.5: Supplier Accounts AP */}
          {activeTab === 'SupplierLedger' && (
            <div className="space-y-4">
              {getSupplierLedger().length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-sans">Select wholesaler suppliers above to calculate liabilities.</div>
              )}
              {getSupplierLedger().length > 0 && (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Bill Invoice Reference</th>
                      <th className="py-2.5 text-right text-emerald-600">Debits (-) (Payments Paid)</th>
                      <th className="py-2.5 text-right text-rose-600">Credits (+) (Purchase Bills)</th>
                      <th className="py-2.5 text-right text-slate-900">Creditor Liability (AP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getSupplierLedger().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-500">{row.date}</td>
                        <td className="py-2.5 font-sans font-bold text-slate-750">{row.desc}</td>
                        <td className="py-2.5 text-right text-emerald-600 font-bold">{row.debit > 0 ? formatMoney(row.debit) : '-'}</td>
                        <td className="py-2.5 text-right text-rose-600 font-bold">{row.credit > 0 ? formatMoney(row.credit) : '-'}</td>
                        <td className="py-2.5 text-right font-extrabold text-slate-950">{formatMoney(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
