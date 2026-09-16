import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Shovel,
  Check,
  Scale,
  CircleAlert,
  AlertTriangle,
  History,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  Calculator,
  Info,
  CheckCircle2,
  Wheat
} from 'lucide-react';
import { FoodRecipe, Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { recipeService, inventoryService } from '../lib/dataService';

interface RecipeLineItem {
  IngredientId: string;
  Percentage: number;
}

// Multilingual labels for ultra-clear and farmer-friendly UX
const millingText: Record<Language, any> = {
  en: {
    tabProduce: '🥣 Produce Feed',
    tabRecipes: '📋 Feed Recipes',
    tabHistory: '📜 Production Logs',
    quickProduceTitle: 'Quick Batch Production & Stocking',
    quickProduceSub: 'Select a formula and batch size. Raw materials auto-deduct and finished feed is credited.',
    selectRecipe: 'Select Feed Recipe:',
    chooseRecipePlaceholder: '-- Choose Formula --',
    batchQtyKg: 'Total Batch Weight (Kg):',
    batchQtyBags: 'Or Batch Quantity (50-Kg Bags):',
    bagsNote: 'Calculated at 50 Kg per bag',
    liveStockTitle: 'Live Raw Stock & Costing Checklist:',
    ingredient: 'Raw Ingredient',
    formulaPct: 'Ratio (%)',
    requiredQty: 'Required Weight',
    availableStock: 'Warehouse Stock',
    stockStatus: 'Availability Status',
    sufficient: 'Sufficient Stock',
    shortage: 'Shortage',
    unitCost: 'Unit Cost',
    lineCost: 'Line Cost',
    estTotalCost: 'Total Batch Cost:',
    costPerKg: 'Estimated Cost / Kg:',
    costPerBag: 'Cost per 50-Kg Bag:',
    targetFeedNotice: 'Finished feed will be credited to warehouse under:',
    produceBtn: '🥣 Compound Batch & Credit to Stock',
    producing: 'Compounding in progress...',
    newFormulaBtn: '+ Create New Formula',
    formulaTemplates: 'Ready-to-use Formula Presets:',
    templateLayer: '🌾 Layer Mash',
    templateStarter: '🐥 Broiler Starter',
    templateFinisher: '🐔 Broiler Finisher',
    templateGrower: '🌱 Grower Mash',
    formulaName: 'Formula Name / Code:',
    formulaNamePlaceholder: 'e.g. Layer Mash - Phase 1 or Broiler Starter',
    targetFeedOptAuto: 'Auto-create finished feed in Warehouse Stock (Recommended)',
    targetFeedOptSelect: 'Or link to an existing warehouse feed item',
    targetFeedSelectPlaceholder: '-- Select Existing Feed Item --',
    notesLabel: 'Formula Notes / Nutritional Spec (Optional):',
    notesPlaceholder: 'e.g. 16% Crude Protein layer mash balanced with maize and soya DOC...',
    ingredientsSection: 'Formulation Ingredients & Percentage (%):',
    addIngredientBtn: '+ Add Ingredient',
    chooseIngredientPlaceholder: '-- Select Raw Ingredient --',
    pctLabel: 'Weight (%)',
    balanceLabel: 'Formulation Balance:',
    balanceOk: '100% Balanced',
    balanceNotOk: 'Total must sum exactly to 100%',
    saveFormulaBtn: 'Save Formula',
    cancelBtn: 'Cancel',
    historyTitle: 'Feed Milling Production History',
    historySub: 'Complete chronological history of compounded feed batches and unit costing.',
    milledDate: 'Date & Time',
    batchRecipe: 'Formula Used',
    outputProduct: 'Finished Product',
    totalProduced: 'Quantity Produced',
    totalCostLabel: 'Cost & Rate',
    statusLabel: 'Status',
    storedInStock: 'Stored in Stock',
    noRecipesYet: 'No feed formulas found for this farm.',
    createFirstRecipe: 'Click here to create your first formula',
    produceNowBtn: '🥣 Produce Now',
    autoInventoryNotice: 'Zero friction: No need to pre-create items in Warehouse. The system automatically creates finished feed in your stock.'
  },
};

export default function MillingRoom({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const mt = millingText[currentLanguage] || millingText['en'];
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  // Active Tab: 'produce' | 'recipes' | 'history'
  const [activeTab, setActiveTab] = useState<'produce' | 'recipes' | 'history'>('produce');

  // Core Data
  const [recipes, setRecipes] = useState<any[]>([]);
  const [feeds, setFeeds] = useState<Inventory[]>([]);
  const [allInventories, setAllInventories] = useState<Inventory[]>([]);
  const [productionLogs, setProductionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab 1 (Quick Batch Production) state
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [batchQuantityKg, setBatchQuantityKg] = useState<number>(1000);
  const [batchBags, setBatchBags] = useState<number>(20);
  const [producing, setProducing] = useState(false);
  const [productionSuccess, setProductionSuccess] = useState<any | null>(null);
  const [productionError, setProductionError] = useState<string | null>(null);

  // Tab 2 (Recipe Creation) state
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [targetFeedOption, setTargetFeedOption] = useState<'auto' | 'existing'>('auto');
  const [selectedTargetFeedId, setSelectedTargetFeedId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<RecipeLineItem[]>([
    { IngredientId: '', Percentage: 55 },
    { IngredientId: '', Percentage: 25 },
    { IngredientId: '', Percentage: 10 },
    { IngredientId: '', Percentage: 10 }
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  useEffect(() => {
    fetchData();
  }, [farmId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setProductionError(null);

      // 1. Recipes
      const rData = await recipeService.getRecipes(farmId);
      setRecipes(rData || []);

      if (rData && rData.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(rData[0].Id);
      }

      // 2. Inventories
      const iData = await inventoryService.getInventories(farmId);
      setAllInventories(iData || []);
      setFeeds((iData || []).filter((i: Inventory) => i.Category === 'Feed'));

      // 3. Production Logs
      const logs = await recipeService.getProductionLogs(farmId);
      setProductionLogs(logs || []);
    } catch (e: any) {
      console.error('[MillingRoom.fetchData] Error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Quantity sync between Kg and Bags (50 Kg standard bags)
  const handleKgChange = (val: number) => {
    setBatchQuantityKg(val);
    setBatchBags(Math.round((val / 50) * 10) / 10);
  };

  const handleBagsChange = (val: number) => {
    setBatchBags(val);
    setBatchQuantityKg(val * 50);
  };

  // Selected recipe object
  const activeRecipe = recipes.find((r) => r.Id === selectedRecipeId) || recipes[0] || null;

  // Calculate live ingredient requirements, stock availability, and costs for active recipe & batch quantity
  const calculateBatchLiveStock = () => {
    if (!activeRecipe) return { lines: [], hasShortage: false, totalCost: 0, costPerKg: 0, costPerBag: 0 };

    const ings = activeRecipe.Ingredients || activeRecipe.ingredients || [];
    let totalCost = 0;
    let hasShortage = false;

    const lines = ings.map((ing: any) => {
      const inv = allInventories.find((i) => i.Id === (ing.InventoryId || ing.IngredientId));
      const neededKg = (batchQuantityKg * (Number(ing.Percentage) || 0)) / 100;
      const currentStock = Number(inv?.CurrentStock) || 0;
      const unitPrice = Number(inv?.UnitPrice) || Number(inv?.AverageLandedCost) || 0;
      const lineCost = neededKg * unitPrice;
      totalCost += lineCost;

      const isShort = currentStock < neededKg;
      if (isShort) hasShortage = true;

      return {
        id: ing.Id || ing.InventoryId,
        itemName: ing.IngredientName || inv?.ItemName || `Ingredient #${ing.InventoryId}`,
        percentage: ing.Percentage,
        neededKg,
        currentStock,
        unitPrice,
        lineCost,
        isShort,
        shortageKg: isShort ? neededKg - currentStock : 0
      };
    });

    const costPerKg = batchQuantityKg > 0 ? totalCost / batchQuantityKg : 0;
    const costPerBag = costPerKg * 50;

    return {
      lines,
      hasShortage,
      totalCost,
      costPerKg,
      costPerBag
    };
  };

  const batchStockCheck = calculateBatchLiveStock();

  // Execute Quick Milling Batch
  const handleExecuteBatch = async () => {
    if (producing) return;
    if (!activeRecipe) {
      setProductionError('Please select a formula first.');
      return;
    }
    if (batchQuantityKg <= 0) {
      setProductionError('Please enter a valid batch quantity greater than 0.');
      return;
    }

    if (batchStockCheck.hasShortage) {
      const shortItems = batchStockCheck.lines
        .filter((l) => l.isShort)
        .map((l) => `${l.itemName} (${l.shortageKg.toFixed(1)} Kg shortage)`)
        .join(', ');
      setProductionError(`Insufficient Raw Material Stock: ${shortItems}. Please update inventory or record purchases first.`);
      return;
    }

    try {
      setProducing(true);
      setProductionError(null);
      setProductionSuccess(null);

      const res = await recipeService.executeMill(
        farmId,
        activeRecipe.Id,
        batchQuantityKg,
        `Produced batch: ${batchQuantityKg} Kg (${batchBags} Bags) using ${activeRecipe.RecipeName}`
      );

      setProductionSuccess({
        message: res.message || 'Batch produced successfully!',
        recipeName: activeRecipe.RecipeName,
        targetItemName: activeRecipe.TargetItemName || activeRecipe.RecipeName,
        quantityKg: batchQuantityKg,
        bags: batchBags,
        totalCost: batchStockCheck.totalCost,
        costPerKg: batchStockCheck.costPerKg
      });

      // Refresh data
      await fetchData();
    } catch (e: any) {
      console.error('[handleExecuteBatch] Error:', e.message);
      setProductionError(e.message || 'Failed to compound batch.');
    } finally {
      setProducing(false);
    }
  };

  // Preset Template loader for 1-click recipe formulation
  const loadTemplate = (type: 'layer' | 'starter' | 'finisher' | 'grower') => {
    const findInvId = (query: string) => {
      const match = allInventories.find((i) =>
        i.ItemName.toLowerCase().includes(query.toLowerCase())
      );
      return match ? String(match.Id) : '';
    };

    const maizeId = findInvId('maize') || findInvId('corn') || findInvId('मका') || '';
    const soyaId = findInvId('soya') || findInvId('doc') || findInvId('सोया') || '';
    const dorbId = findInvId('dorb') || findInvId('bran') || findInvId('कोंडा') || '';
    const mineralId = findInvId('premix') || findInvId('mineral') || findInvId('मिनरल') || '';
    const shellGritId = findInvId('grit') || findInvId('shell') || findInvId('calcium') || '';

    if (type === 'layer') {
      setRecipeName('Layer Mash - Phase 1');
      setDescription('16% Crude Protein balanced layer feed with calcium grit for high egg laying rates.');
      setItems([
        { IngredientId: maizeId, Percentage: 55 },
        { IngredientId: soyaId, Percentage: 22 },
        { IngredientId: dorbId, Percentage: 11 },
        { IngredientId: shellGritId || mineralId, Percentage: 8 },
        { IngredientId: mineralId, Percentage: 4 }
      ]);
    } else if (type === 'starter') {
      setRecipeName('Broiler Starter Feed');
      setDescription('22% High-protein broiler starter mash for rapid early chick development.');
      setItems([
        { IngredientId: maizeId, Percentage: 58 },
        { IngredientId: soyaId, Percentage: 35 },
        { IngredientId: dorbId, Percentage: 2 },
        { IngredientId: mineralId, Percentage: 5 }
      ]);
    } else if (type === 'finisher') {
      setRecipeName('Broiler Finisher Feed');
      setDescription('19% Energy-rich broiler finisher mash for optimum weight gain.');
      setItems([
        { IngredientId: maizeId, Percentage: 62 },
        { IngredientId: soyaId, Percentage: 28 },
        { IngredientId: dorbId, Percentage: 4 },
        { IngredientId: mineralId, Percentage: 6 }
      ]);
    } else if (type === 'grower') {
      setRecipeName('Grower Pullet Mash');
      setDescription('Balanced 15% protein grower formula for healthy skeletal pullet growth.');
      setItems([
        { IngredientId: maizeId, Percentage: 52 },
        { IngredientId: soyaId, Percentage: 20 },
        { IngredientId: dorbId, Percentage: 20 },
        { IngredientId: mineralId, Percentage: 8 }
      ]);
    }
  };

  // Recipe formulation row manipulation
  const handleAddItemRow = () => {
    setItems([...items, { IngredientId: '', Percentage: 10 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalPercentage = items.reduce((sum, it) => sum + (Number(it.Percentage) || 0), 0);

  // Submit Recipe Creation
  const handleSubmitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRecipe) return;
    if (totalPercentage !== 100) {
      alert(`Total ingredient percentage must equal 100%. Currently: ${totalPercentage}%`);
      return;
    }
    if (!recipeName.trim()) {
      alert('Please enter a recipe name.');
      return;
    }

    const emptyIngredients = items.some((it) => !it.IngredientId);
    if (emptyIngredients) {
      alert('Please select raw materials for all ingredient rows or remove unused rows.');
      return;
    }

    try {
      setSavingRecipe(true);
      const targetId = targetFeedOption === 'existing' && selectedTargetFeedId ? parseInt(selectedTargetFeedId) : undefined;

      const formattedIngredients = items.map((it) => ({
        InventoryId: parseInt(it.IngredientId),
        Percentage: Number(it.Percentage)
      }));

      await recipeService.createRecipe(
        farmId,
        {
          RecipeName: recipeName.trim(),
          BatchSizeKg: 1000,
          TargetFeedItemId: targetId,
          Notes: description.trim()
        },
        formattedIngredients
      );

      setShowAddForm(false);
      setRecipeName('');
      setDescription('');
      setSelectedTargetFeedId('');
      setTargetFeedOption('auto');
      await fetchData();
      setActiveTab('recipes');
    } catch (err: any) {
      console.error('[handleSubmitRecipe] Error:', err.message);
      alert(err.message || 'Failed to save recipe.');
    } finally {
      setSavingRecipe(false);
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = async (recipeId: number) => {
    if (!confirm('Are you sure you want to permanently delete this recipe?')) return;
    try {
      await recipeService.deleteRecipe(farmId, recipeId);
      await fetchData();
    } catch (e: any) {
      console.error('[handleDeleteRecipe] Error:', e.message);
      alert('Failed to delete recipe.');
    }
  };

  return (
    <div className="space-y-6" id="millinghouse-module">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
              <Shovel className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                {t.millingTitle}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                {t.millingSub}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-center">
          <button
            onClick={() => { setActiveTab('produce'); setProductionSuccess(null); setProductionError(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'produce'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-produce-btn"
          >
            <Wheat className="h-3.5 w-3.5 text-amber-600" />
            {mt.tabProduce}
          </button>
          <button
            onClick={() => { setActiveTab('recipes'); setShowAddForm(false); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recipes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-recipes-btn"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            {mt.tabRecipes} ({recipes.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-history-btn"
          >
            <History className="h-3.5 w-3.5 text-emerald-600" />
            {mt.tabHistory}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: QUICK BATCH PRODUCTION */}
          {/* ========================================================================= */}
          {activeTab === 'produce' && (
            <div className="space-y-6" id="quick-produce-tab">
              {/* Zero-friction Auto-Inventory Notice Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{mt.autoInventoryNotice}</span>
              </div>

              {recipes.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <Layers className="h-12 w-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800">{mt.noRecipesYet}</h3>
                    <p className="text-xs text-slate-500">To produce feed, select an existing formula or create a recipe below टेम्पलेट वापरा.</p>
                  </div>
                  <button
                    onClick={() => { setActiveTab('recipes'); setShowAddForm(true); }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
                  >
                    {mt.createFirstRecipe}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Formula & Batch Size Selection */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Wheat className="h-5 w-5 text-amber-600" />
                          {mt.quickProduceTitle}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{mt.quickProduceSub}</p>
                      </div>

                      {/* Select Formula */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          {mt.selectRecipe}
                        </label>
                        <select
                          value={selectedRecipeId || ''}
                          onChange={(e) => {
                            setSelectedRecipeId(Number(e.target.value));
                            setProductionSuccess(null);
                            setProductionError(null);
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          id="select-active-recipe-dropdown"
                        >
                          {recipes.map((r) => (
                            <option key={r.Id} value={r.Id}>
                              {r.RecipeName} {r.TargetItemName ? `(➡️ ${r.TargetItemName})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dual Batch Quantity Input (Kg and 50-Kg Bags) */}
                      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Calculator className="h-4 w-4 text-slate-500" />
                            Batch Production Quantity (Kg):
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{mt.bagsNote}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              {mt.batchQtyKg}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                step={10}
                                value={batchQuantityKg}
                                onChange={(e) => handleKgChange(parseFloat(e.target.value) || 0)}
                                className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900"
                                id="input-batch-kg"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-semibold">Kg</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              {mt.batchQtyBags}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0.1}
                                step={0.5}
                                value={batchBags}
                                onChange={(e) => handleBagsChange(parseFloat(e.target.value) || 0)}
                                className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-indigo-900"
                                id="input-batch-bags"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs text-indigo-400 font-semibold">Bags</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Target Feed Credit Destination Note */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-amber-700 shrink-0" />
                          {mt.targetFeedNotice}
                        </div>
                        <div className="font-bold font-mono text-sm text-amber-950 pl-5">
                          {activeRecipe?.TargetItemName || activeRecipe?.RecipeName}
                        </div>
                      </div>

                      {/* Error Banner */}
                      {productionError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{productionError}</span>
                        </div>
                      )}

                      {/* Success Banner */}
                      {productionSuccess && (
                        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            Feed production completed successfully!
                          </div>
                          <div className="text-xs text-emerald-800 space-y-1 pl-7 font-mono">
                            <div>• Produced Feed: <b>{productionSuccess.quantityKg} Kg</b> ({productionSuccess.bags} bags)</div>
                            <div>• Inventory Item Deposited: <b>{productionSuccess.targetItemName}</b></div>
                            <div>• Total Batch Cost: <b>₹{productionSuccess.totalCost.toFixed(2)}</b> (₹{productionSuccess.costPerKg.toFixed(2)}/Kg)</div>
                          </div>
                        </div>
                      )}

                      {/* Big Action Button */}
                      <button
                        onClick={handleExecuteBatch}
                        disabled={producing || batchStockCheck.hasShortage}
                        className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                          batchStockCheck.hasShortage
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                        id="execute-produce-btn"
                      >
                        {producing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            {mt.producing}
                          </>
                        ) : (
                          <>
                            <Shovel className="h-4 w-4" />
                            {mt.produceBtn}
                          </>
                        )}
                      </button>

                      {batchStockCheck.hasShortage && (
                        <p className="text-[11px] text-rose-600 text-center font-medium">
                          ⚠️ Some ingredients are short in stock. Update inventory before producing.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Live Ingredient Breakdown & Costing Card */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Scale className="h-4 w-4 text-indigo-600" />
                            {mt.liveStockTitle}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Recipe: <b className="text-slate-800">{activeRecipe?.RecipeName}</b> ({batchQuantityKg} Kg batch)
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          batchStockCheck.hasShortage ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {batchStockCheck.hasShortage ? '❌ Insufficient Stock' : '✅ All Items In Stock'}
                        </span>
                      </div>

                      {/* Ingredients Verification Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-3">{mt.ingredient}</th>
                              <th className="py-2.5 px-2 text-center">{mt.formulaPct}</th>
                              <th className="py-2.5 px-2 text-right">{mt.requiredQty}</th>
                              <th className="py-2.5 px-2 text-right">{mt.availableStock}</th>
                              <th className="py-2.5 px-2 text-center">{mt.stockStatus}</th>
                              <th className="py-2.5 px-3 text-right">{mt.lineCost}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batchStockCheck.lines.map((line) => (
                              <tr key={line.id} className={`hover:bg-slate-50/50 ${line.isShort ? 'bg-rose-50/40' : ''}`}>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {line.itemName}
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    Rate: ₹{line.unitPrice.toFixed(2)}/Kg
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700">
                                  {line.percentage}%
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                                  {line.neededKg.toFixed(1)} Kg
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                                  {line.currentStock.toFixed(1)} Kg
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  {line.isShort ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md">
                                      ❌ -{line.shortageKg.toFixed(1)} Kg
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                                      <Check className="h-3 w-3" /> {mt.sufficient}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  ₹{line.lineCost.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Live Costing Summary Card */}
                      <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{mt.estTotalCost}</span>
                          <span className="text-lg font-bold font-mono text-emerald-400">
                            ₹{batchStockCheck.totalCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">{mt.costPerKg}</span>
                            <span className="font-bold font-mono text-slate-200 text-sm">
                              ₹{batchStockCheck.costPerKg.toFixed(2)} / Kg
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">{mt.costPerBag}</span>
                            <span className="font-bold font-mono text-amber-400 text-sm">
                              ₹{batchStockCheck.costPerBag.toFixed(2)} / Bag
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: RECIPES MANAGEMENT & CREATION */}
          {/* ========================================================================= */}
          {activeTab === 'recipes' && (
            <div className="space-y-6" id="recipes-tab">
              {/* Header Bar with New Formula Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-indigo-600" />
                    Farm Feed Formulations & Recipes
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create or update feed formulas. The system will automatically link batch outputs to warehouse stock.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shrink-0"
                  id="toggle-add-recipe-form-btn"
                >
                  <Plus className="h-4 w-4" />
                  {mt.newFormulaBtn}
                </button>
              </div>

              {/* Recipe Creation Form */}
              {showAddForm && (
                <form
                  onSubmit={handleSubmitRecipe}
                  className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-6"
                  id="create-recipe-form"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      Create New Feed Recipe
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">Farm #{farmId}</span>
                  </div>

                  {/* 1-Click Quick Presets */}
                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/70 space-y-2">
                    <span className="text-xs font-bold text-amber-900 block">
                      {mt.formulaTemplates}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadTemplate('layer')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateLayer}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('starter')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateStarter}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('finisher')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateFinisher}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('grower')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateGrower}
                      </button>
                    </div>
                  </div>

                  {/* Basic Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {mt.formulaName} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={mt.formulaNamePlaceholder}
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                        id="recipe-name-input"
                      />
                    </div>

                    {/* Target Product Selection / Auto-create Toggle */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Finished Feed Inventory Item:
                      </label>
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="targetFeedOpt"
                            checked={targetFeedOption === 'auto'}
                            onChange={() => setTargetFeedOption('auto')}
                            className="text-slate-900 focus:ring-slate-900"
                          />
                          <span className="font-semibold text-emerald-800">
                            {mt.targetFeedOptAuto}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="targetFeedOpt"
                            checked={targetFeedOption === 'existing'}
                            onChange={() => setTargetFeedOption('existing')}
                            className="text-slate-900 focus:ring-slate-900"
                          />
                          <span className="text-slate-700">{mt.targetFeedOptSelect}</span>
                        </label>
                        {targetFeedOption === 'existing' && (
                          <select
                            value={selectedTargetFeedId}
                            onChange={(e) => setSelectedTargetFeedId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">{mt.targetFeedSelectPlaceholder}</option>
                            {feeds.map((f) => (
                              <option key={f.Id} value={f.Id}>
                                {f.ItemName} (In Stock: {f.CurrentStock} {f.UnitOfMeasurement})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      {mt.notesLabel}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={mt.notesPlaceholder}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  {/* Ingredients Formulation Rows */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center bg-slate-100/80 p-2.5 px-4 rounded-xl">
                      <h4 className="text-xs uppercase tracking-wide font-bold text-slate-700">
                        {mt.ingredientsSection}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" /> {mt.addIngredientBtn}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {items.map((line, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50/60 p-3 rounded-xl border border-slate-100"
                        >
                          <div className="sm:col-span-7 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">
                              {mt.ingredient} #{idx + 1}
                            </label>
                            <select
                              required
                              value={line.IngredientId}
                              onChange={(e) => {
                                const copy = [...items];
                                copy[idx].IngredientId = e.target.value;
                                setItems(copy);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                            >
                              <option value="">{mt.chooseIngredientPlaceholder}</option>
                              {allInventories.map((ing) => (
                                <option key={ing.Id} value={ing.Id}>
                                  {ing.ItemName} [In Stock: {ing.CurrentStock} {ing.UnitOfMeasurement} | Rate: ₹{ing.UnitPrice}]
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">
                              {mt.pctLabel}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                required
                                min={0.1}
                                max={100}
                                step={0.5}
                                value={line.Percentage}
                                onChange={(e) => {
                                  const copy = [...items];
                                  copy[idx].Percentage = parseFloat(e.target.value) || 0;
                                  setItems(copy);
                                }}
                                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono font-bold"
                              />
                              <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">%</span>
                            </div>
                          </div>

                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={items.length <= 1}
                              className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sum check and 100% progress bar */}
                    <div className="p-4 rounded-xl border bg-slate-900 text-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{mt.balanceLabel}</span>
                        <span className={`font-bold font-mono text-sm ${
                          totalPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {totalPercentage}% / 100% {totalPercentage === 100 ? `(${mt.balanceOk})` : `(${mt.balanceNotOk})`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            totalPercentage === 100 ? 'bg-emerald-500' : totalPercentage > 100 ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, totalPercentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                    >
                      {mt.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={savingRecipe || totalPercentage !== 100}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      id="save-recipe-submit-btn"
                    >
                      {savingRecipe ? 'Saving...' : mt.saveFormulaBtn}
                    </button>
                  </div>
                </form>
              )}

              {/* Grid of Existing Recipe Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="recipe-cards-grid">
                {recipes.map((row) => (
                  <div
                    key={row.Id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base font-display">
                            {row.RecipeName}
                          </h3>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                            Finished Stock Item: {row.TargetItemName || row.RecipeName}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteRecipe(row.Id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Formula"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {(row.Notes || row.Description) && (
                        <p className="text-xs text-slate-500 italic">
                          {row.Notes || row.Description}
                        </p>
                      )}

                      {/* Ingredients Breakdown */}
                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Ingredient Breakdown:
                        </span>
                        <div className="space-y-1">
                          {(row.Ingredients || []).map((ing: any, i: number) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-xs font-mono py-1 border-b border-slate-50 last:border-0"
                            >
                              <span className="text-slate-700">
                                {ing.IngredientName || `Item #${ing.InventoryId}`}
                              </span>
                              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                {ing.Percentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quick Produce Button directly from Card */}
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedRecipeId(row.Id);
                          setActiveTab('produce');
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                      >
                        <Wheat className="h-3.5 w-3.5 text-amber-400" />
                        {mt.produceNowBtn}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PRODUCTION LOGS & HISTORY */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-6" id="history-tab">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-emerald-600" />
                  {mt.historyTitle}
                </h2>
                <p className="text-xs text-slate-500">{mt.historySub}</p>
              </div>

              {productionLogs.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <History className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    No feed production batches recorded on this farm yet.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">{mt.milledDate}</th>
                          <th className="py-3 px-4">{mt.batchRecipe}</th>
                          <th className="py-3 px-4">{mt.outputProduct}</th>
                          <th className="py-3 px-4 text-right">{mt.totalProduced}</th>
                          <th className="py-3 px-4 text-right">{mt.totalCostLabel}</th>
                          <th className="py-3 px-4 text-center">{mt.statusLabel}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productionLogs.map((log: any) => (
                          <tr key={log.Id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {log.MilledAt ? new Date(log.MilledAt).toLocaleString('en-IN') : '-'}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {log.RecipeName}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {log.TargetItemName || log.RecipeName}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {log.QuantityKg} Kg
                              <span className="block text-[10px] text-slate-400 font-normal">
                                ({log.BagsProduced?.toFixed(1) || (log.QuantityKg / 50).toFixed(1)} Bags)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              ₹{Number(log.TotalCost || 0).toFixed(2)}
                              <span className="block text-[10px] text-slate-500 font-normal">
                                (₹{Number(log.CostPerKg || 0).toFixed(2)}/Kg)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                {mt.storedInStock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
