import { supabase } from './supabase';
import { 
  Flock, 
  DailyLog, 
  Inventory, 
  Vaccination, 
  FoodRecipe,
  Customer,
  Supplier,
  Purchase,
  PurchaseItem,
  PurchaseExtraExpense,
  Sale,
  SaleItem,
  FinancialTransaction,
  TransactionCategory,
  EggInventory
} from '../types';

/**
 * POULTRY LMS 360 - CENTRAL SUPABASE DATA SERVICE
 * Group 1: Core Farm Operations (Multi-Tenant by FarmId)
 */

/**
 * Synchronize records saved on this device to the local backend / SQLite store
 * to guarantee that offline copies, local reporting, and other local sessions are updated.
 */
export async function syncToLocalBackend(table: string, action: 'upsert' | 'delete', record: any): Promise<void> {
  try {
    if (!record) return;
    const farmId = record?.FarmId || Number(localStorage.getItem('active_farm_id')) || 1;
    await fetch('/api/sync/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Farm-Id': String(farmId)
      },
      body: JSON.stringify({ table, action, record })
    });
  } catch (err) {
    // Non-blocking background local sync
    console.debug('[syncToLocalBackend] Local sync notification status:', err);
  }
}

// ==============================================================================
// 1. FLOCKS SERVICE
// ==============================================================================
export const flockService = {
  /**
   * Fetch all flocks for a specific farm
   */
  async getFlocks(farmId: number): Promise<Flock[]> {
    const { data, error } = await supabase
      .from('Flocks')
      .select('*')
      .eq('FarmId', farmId)
      .order('Id', { ascending: false });

    if (error) {
      console.error('[flockService.getFlocks] Error:', error.message);
      throw error;
    }

    const rawFlocks = data || [];
    if (rawFlocks.length === 0) return [];

    // Also fetch daily logs for egg collection statistics
    let logsMap: Record<number, { eggs: number; damaged: number }> = {};
    try {
      const { data: logs } = await supabase
        .from('DailyLogs')
        .select('FlockId, EggsCollected, DamagedEggsCollected')
        .eq('FarmId', farmId);
      
      if (logs) {
        logs.forEach((log: any) => {
          const fid = log.FlockId;
          if (!logsMap[fid]) logsMap[fid] = { eggs: 0, damaged: 0 };
          logsMap[fid].eggs += Number(log.EggsCollected) || 0;
          logsMap[fid].damaged += Number(log.DamagedEggsCollected) || 0;
        });
      }
    } catch (logErr) {
      console.warn('[flockService.getFlocks] Could not fetch logs for flock stats:', logErr);
    }

    const today = new Date();
    return rawFlocks.map((flock: any) => {
      const initCount = Number(flock.InitialCount) || 0;
      const currCount = Number(flock.CurrentCount) || 0;
      const deadCount = Math.max(0, initCount - currCount);
      const mortalityRate = initCount > 0 ? (deadCount / initCount) * 100 : 0;

      const arrDate = flock.ArrivalDate ? new Date(flock.ArrivalDate) : today;
      const diffTime = Math.abs(today.getTime() - arrDate.getTime());
      const ageInDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const totalPurchase = Number(flock.TotalPurchasePrice) || 0;
      const perBird = Number(flock.PerBirdPurchasePrice) || (initCount > 0 ? totalPurchase / initCount : 0);

      const stats = logsMap[flock.Id] || { eggs: 0, damaged: 0 };
      const totalEggs = stats.eggs + stats.damaged;
      const hdp = (initCount * ageInDays) > 0 ? (totalEggs / (initCount * ageInDays)) * 100 : 0;

      const feedCost = Number(flock.TotalFeedCost) || 0;
      const vaccineCost = Number(flock.TotalVaccineCost) || 0;
      const totalExpenses = totalPurchase + feedCost + vaccineCost;
      const perEggCost = totalEggs > 0 ? totalExpenses / totalEggs : 0;

      return {
        ...flock,
        InitialCount: initCount,
        CurrentCount: currCount,
        TotalPurchasePrice: totalPurchase,
        PerBirdPurchasePrice: perBird,
        TotalFeedCost: feedCost,
        TotalVaccineCost: vaccineCost,
        AgeInDays: Number(flock.AgeInDays) || ageInDays,
        MortalityRate: mortalityRate,
        HDP: hdp,
        TotalEggsCollected: stats.eggs,
        TotalDamagedEggs: stats.damaged,
        PerEggCost: perEggCost
      };
    });
  },

  /**
   * Create a new flock for a specific farm
   */
  async createFlock(farmId: number, flockData: Partial<Flock>): Promise<Flock> {
    const initialCount = Number(flockData.InitialCount) || 0;
    const totalPurchasePrice = Number(flockData.TotalPurchasePrice) || 0;
    const perBird = initialCount > 0 ? totalPurchasePrice / initialCount : 0;

    // Deduplication check: prevent duplicate flocks with identical identifier for this farm
    if (flockData.FlockName) {
      const { data: existingFlock } = await supabase
        .from('Flocks')
        .select('Id')
        .eq('FarmId', farmId)
        .ilike('FlockName', flockData.FlockName.trim());

      if (existingFlock && existingFlock.length > 0) {
        throw new Error(`A flock with identifier "${flockData.FlockName}" already exists for this farm.`);
      }
    }

    const payload = {
      FarmId: farmId,
      FlockName: flockData.FlockName || 'Unnamed Flock',
      Breed: flockData.Breed || 'Standard',
      InitialCount: initialCount,
      CurrentCount: initialCount,
      ArrivalDate: flockData.ArrivalDate || new Date().toISOString().split('T')[0],
      Status: 'Active',
      IsActive: 1,
      TotalPurchasePrice: totalPurchasePrice,
      StartDate: flockData.StartDate || flockData.ArrivalDate || new Date().toISOString().split('T')[0],
      TotalFeedCost: 0,
      TotalVaccineCost: 0,
      PerBirdPurchasePrice: perBird,
      AgeInDays: Number(flockData.AgeInDays) || 1,
      Notes: flockData.Notes || ''
    };

    const { data, error } = await supabase
      .from('Flocks')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[flockService.createFlock] Error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Update an existing flock
   */
  async updateFlock(farmId: number, flockId: number, flockData: Partial<Flock>): Promise<Flock> {
    const { data, error } = await supabase
      .from('Flocks')
      .update(flockData)
      .eq('Id', flockId)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[flockService.updateFlock] Error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Delete a flock
   */
  async deleteFlock(farmId: number, flockId: number): Promise<void> {
    const { error } = await supabase
      .from('Flocks')
      .delete()
      .eq('Id', flockId)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[flockService.deleteFlock] Error:', error.message);
      throw error;
    }
  }
};

// ==============================================================================
// 2. DAILY LOGS SERVICE
// ==============================================================================
export const dailyLogService = {
  /**
   * Get all daily logs for a specific farm, optionally filtered by flock
   */
  async getDailyLogs(farmId: number, flockId?: number): Promise<DailyLog[]> {
    let query = supabase
      .from('DailyLogs')
      .select('*')
      .eq('FarmId', farmId)
      .order('LogDate', { ascending: false });

    if (flockId) {
      query = query.eq('FlockId', flockId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[dailyLogService.getDailyLogs] Error:', error.message);
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new daily log and cascade update flock bird count, costs, and inventory
   */
  async createDailyLog(farmId: number, logData: Partial<DailyLog>): Promise<DailyLog> {
    const flockId = Number(logData.FlockId);
    const mortality = Number(logData.MortalityCount) || 0;
    const feedConsumed = Number(logData.FeedConsumedKg) || 0;
    const feedCost = Number(logData.FeedCost) || 0;
    const feedItemId = logData.FeedItemId ? Number(logData.FeedItemId) : null;
    const birdsEaten = Number(logData.BirdsEatenBySelf) || 0;
    const eggsCollected = Number(logData.EggsCollected) || 0;
    const damagedEggs = Number(logData.DamagedEggsCollected) || 0;

    // Deduplication check: prevent duplicate daily logs for the same flock on the same date
    const checkDate = (logData.LogDate || new Date().toISOString().split('T')[0]).split('T')[0];
    const { data: existingLogs } = await supabase
      .from('DailyLogs')
      .select('Id')
      .eq('FarmId', farmId)
      .eq('FlockId', flockId)
      .ilike('LogDate', `${checkDate}%`);

    if (existingLogs && existingLogs.length > 0) {
      throw new Error(`A daily log for this flock on date ${checkDate} already exists. Please edit the existing entry instead.`);
    }

    const payload = {
      FarmId: farmId,
      FlockId: flockId,
      FeedItemId: feedItemId,
      FeedConsumedKg: feedConsumed,
      MortalityCount: mortality,
      EggsCollected: eggsCollected,
      DamagedEggsCollected: damagedEggs,
      LogDate: logData.LogDate || new Date().toISOString().split('T')[0],
      FeedCost: feedCost,
      DailyBirdCost: Number(logData.DailyBirdCost) || 0,
      Notes: logData.Notes || '',
      DailyAverageWeight: Number(logData.DailyAverageWeight) || 0,
      WaterConsumed: Number(logData.WaterConsumed) || 0,
      BirdsEatenBySelf: birdsEaten,
      BirdsEatenValue: Number(logData.BirdsEatenValue) || 0,
      EggsGifted: Number(logData.EggsGifted) || 0,
      EggsGiftedValue: Number(logData.EggsGiftedValue) || 0,
      CustomEggPrice: logData.CustomEggPrice ? Number(logData.CustomEggPrice) : null,
      CustomBirdPrice: logData.CustomBirdPrice ? Number(logData.CustomBirdPrice) : null
    };

    // 1. Insert DailyLog
    const { data: createdLog, error: logErr } = await supabase
      .from('DailyLogs')
      .insert([payload])
      .select()
      .single();

    if (logErr) {
      console.error('[dailyLogService.createDailyLog] Error:', logErr.message);
      throw logErr;
    }

    // 2. Cascade: Reduce flock bird count by mortality and birds eaten
    const totalBirdReduction = mortality + birdsEaten;
    if (totalBirdReduction > 0) {
      const { data: currentFlock } = await supabase
        .from('Flocks')
        .select('CurrentCount')
        .eq('Id', flockId)
        .eq('FarmId', farmId)
        .single();

      if (currentFlock) {
        const newCount = Math.max(0, (currentFlock.CurrentCount || 0) - totalBirdReduction);
        await supabase
          .from('Flocks')
          .update({ CurrentCount: newCount })
          .eq('Id', flockId)
          .eq('FarmId', farmId);
      }
    }

    // 3. Cascade: Update TotalFeedCost in Flock
    if (feedCost > 0) {
      const { data: currentFlock } = await supabase
        .from('Flocks')
        .select('TotalFeedCost')
        .eq('Id', flockId)
        .eq('FarmId', farmId)
        .single();

      if (currentFlock) {
        const newFeedCost = (Number(currentFlock.TotalFeedCost) || 0) + feedCost;
        await supabase
          .from('Flocks')
          .update({ TotalFeedCost: newFeedCost })
          .eq('Id', flockId)
          .eq('FarmId', farmId);
      }
    }

    // 4. Cascade: Deduct feed inventory stock
    if (feedItemId && feedConsumed > 0) {
      const { data: currentInv } = await supabase
        .from('Inventories')
        .select('CurrentStock')
        .eq('Id', feedItemId)
        .eq('FarmId', farmId)
        .single();

      if (currentInv) {
        const newStock = Math.max(0, (Number(currentInv.CurrentStock) || 0) - feedConsumed);
        await supabase
          .from('Inventories')
          .update({ CurrentStock: newStock })
          .eq('Id', feedItemId)
          .eq('FarmId', farmId);
      }
    }

    // 5. Cascade: Increment Egg Inventories
    if (eggsCollected > 0 || damagedEggs > 0) {
      // Fresh eggs
      if (eggsCollected > 0) {
        const { data: freshEggInv } = await supabase
          .from('EggInventories')
          .select('Id, Quantity')
          .eq('FarmId', farmId)
          .eq('GradeOrType', 'Fresh Eggs')
          .maybeSingle();

        if (freshEggInv) {
          await supabase
            .from('EggInventories')
            .update({ Quantity: (freshEggInv.Quantity || 0) + eggsCollected })
            .eq('Id', freshEggInv.Id);
        }
      }

      // Damaged eggs
      if (damagedEggs > 0) {
        const { data: wasteEggInv } = await supabase
          .from('EggInventories')
          .select('Id, Quantity')
          .eq('FarmId', farmId)
          .eq('GradeOrType', 'Damaged/Waste Eggs')
          .maybeSingle();

        if (wasteEggInv) {
          await supabase
            .from('EggInventories')
            .update({ Quantity: (wasteEggInv.Quantity || 0) + damagedEggs })
            .eq('Id', wasteEggInv.Id);
        }
      }
    }

    // Mirror to local SQLite
    syncToLocalBackend('DailyLogs', 'upsert', createdLog);

    return createdLog;
  },

  /**
   * Update an existing daily log and sync to local backend
   */
  async updateDailyLog(farmId: number, logId: number, logData: Partial<DailyLog>): Promise<DailyLog> {
    const payload = {
      ...logData,
      FarmId: farmId
    };

    const { data: updatedLog, error: logErr } = await supabase
      .from('DailyLogs')
      .update(payload)
      .eq('Id', logId)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (logErr) {
      console.error('[dailyLogService.updateDailyLog] Supabase Error, fallback to local backend:', logErr.message);
      const res = await fetch(`/api/daily_logs/${logId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Farm-Id': String(farmId)
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw logErr;
      }
      return (await res.json()) as DailyLog;
    }

    // Mirror to local SQLite
    syncToLocalBackend('DailyLogs', 'upsert', updatedLog);
    return updatedLog;
  },

  /**
   * Delete a daily log
   */
  async deleteDailyLog(farmId: number, logId: number): Promise<void> {
    const { error } = await supabase
      .from('DailyLogs')
      .delete()
      .eq('Id', logId)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[dailyLogService.deleteDailyLog] Error:', error.message);
      await fetch(`/api/daily_logs/${logId}`, {
        method: 'DELETE',
        headers: { 'X-Farm-Id': String(farmId) }
      });
    } else {
      syncToLocalBackend('DailyLogs', 'delete', { Id: logId, FarmId: farmId });
    }
  }
};

// ==============================================================================
// 3. INVENTORIES SERVICE
// ==============================================================================
export const inventoryService = {
  /**
   * Get all inventory items for a farm
   */
  async getInventories(farmId: number): Promise<Inventory[]> {
    const { data, error } = await supabase
      .from('Inventories')
      .select('*')
      .eq('FarmId', farmId)
      .order('ItemName', { ascending: true });

    if (error) {
      console.error('[inventoryService.getInventories] Error:', error.message);
      throw error;
    }
    return data || [];
  },

  /**
   * Add a new inventory item
   */
  async createInventory(farmId: number, itemData: Partial<Inventory>): Promise<Inventory> {
    // Deduplication check: prevent duplicate inventory items with identical name
    if (itemData.ItemName) {
      const { data: existingItem } = await supabase
        .from('Inventories')
        .select('Id')
        .eq('FarmId', farmId)
        .ilike('ItemName', itemData.ItemName.trim());

      if (existingItem && existingItem.length > 0) {
        throw new Error(`An inventory item with the name "${itemData.ItemName}" already exists in this farm.`);
      }
    }

    const payload = {
      FarmId: farmId,
      ItemName: itemData.ItemName || 'Unnamed Item',
      Category: itemData.Category || 'Feed',
      UnitOfMeasurement: itemData.UnitOfMeasurement || 'Kg',
      UnitPrice: Number(itemData.UnitPrice) || 0,
      SellingPrice: Number(itemData.SellingPrice) || 0,
      CurrentStock: Number(itemData.CurrentStock) || 0,
      WeightPerUnit: Number(itemData.WeightPerUnit) || 1,
      MinThreshold: Number(itemData.MinThreshold) || 0,
      Notes: itemData.Notes || ''
    };

    const { data, error } = await supabase
      .from('Inventories')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[inventoryService.createInventory] Error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Update an inventory item
   */
  async updateInventory(farmId: number, itemId: number, itemData: Partial<Inventory>): Promise<Inventory> {
    const { data, error } = await supabase
      .from('Inventories')
      .update(itemData)
      .eq('Id', itemId)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[inventoryService.updateInventory] Error:', error.message);
      throw error;
    }
    return data;
  },

  /**
   * Delete an inventory item
   */
  async deleteInventory(farmId: number, itemId: number): Promise<void> {
    const { error } = await supabase
      .from('Inventories')
      .delete()
      .eq('Id', itemId)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[inventoryService.deleteInventory] Error:', error.message);
      throw error;
    }
  }
};

// ==============================================================================
// 4. HEALTHCARE & VACCINATIONS SERVICE
// ==============================================================================
export const vaccinationService = {
  /**
   * Get all vaccinations for a farm
   */
  async getVaccinations(farmId: number, flockId?: number): Promise<Vaccination[]> {
    let query = supabase
      .from('Vaccinations')
      .select('*')
      .eq('FarmId', farmId)
      .order('Date', { ascending: false });

    if (flockId) {
      query = query.eq('FlockId', flockId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[vaccinationService.getVaccinations] Error:', error.message);
      throw error;
    }
    return data || [];
  },

  /**
   * Record a new vaccination and update flock TotalVaccineCost
   */
  async createVaccination(farmId: number, vData: Partial<Vaccination>): Promise<Vaccination> {
    const cost = Number(vData.Cost) || 0;
    const flockId = Number(vData.FlockId);
    const vacDate = (vData.Date || new Date().toISOString().split('T')[0]).split('T')[0];

    // Deduplication check: prevent double-submitting the same vaccination for a flock on the same date
    if (flockId && vData.VaccineName) {
      const { data: existingVac } = await supabase
        .from('Vaccinations')
        .select('Id')
        .eq('FarmId', farmId)
        .eq('FlockId', flockId)
        .ilike('VaccineName', vData.VaccineName.trim())
        .ilike('Date', `${vacDate}%`);

      if (existingVac && existingVac.length > 0) {
        throw new Error(`A vaccination record for "${vData.VaccineName}" on ${vacDate} already exists for this flock.`);
      }
    }

    const payload = {
      FarmId: farmId,
      FlockId: flockId,
      VaccineName: vData.VaccineName || 'Standard Vaccine',
      Date: vData.Date || new Date().toISOString().split('T')[0],
      Cost: cost,
      AdministeredBy: vData.AdministeredBy || '',
      Notes: vData.Notes || '',
      Phase: vData.Phase || 'Administered',
      ScheduledDate: vData.ScheduledDate || null
    };

    const { data, error } = await supabase
      .from('Vaccinations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[vaccinationService.createVaccination] Error:', error.message);
      throw error;
    }

    // Cascade update TotalVaccineCost in Flock
    if (cost > 0 && flockId) {
      const { data: flock } = await supabase
        .from('Flocks')
        .select('TotalVaccineCost')
        .eq('Id', flockId)
        .eq('FarmId', farmId)
        .single();

      if (flock) {
        const newCost = (Number(flock.TotalVaccineCost) || 0) + cost;
        await supabase
          .from('Flocks')
          .update({ TotalVaccineCost: newCost })
          .eq('Id', flockId)
          .eq('FarmId', farmId);
      }
    }

    return data;
  },

  /**
   * Delete a vaccination record
   */
  async deleteVaccination(farmId: number, vId: number): Promise<void> {
    const { error } = await supabase
      .from('Vaccinations')
      .delete()
      .eq('Id', vId)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[vaccinationService.deleteVaccination] Error:', error.message);
      throw error;
    }
  }
};

// ==============================================================================
// 5. FOOD RECIPES SERVICE
// ==============================================================================
export const recipeService = {
  /**
   * Get all feed recipes for a farm with their ingredients and target feed details
   */
  async getRecipes(farmId: number): Promise<any[]> {
    try {
      const { data: recipes, error } = await supabase
        .from('FoodRecipes')
        .select('*')
        .eq('FarmId', farmId)
        .order('Id', { ascending: false });

      if (error) {
        console.warn('[recipeService.getRecipes] Supabase error, trying local API:', error.message);
        const res = await fetch(`/api/recipes?farmId=${farmId}`);
        if (res.ok) return await res.json();
        throw error;
      }

      if (!recipes || recipes.length === 0) {
        // Fallback check to local API
        const res = await fetch(`/api/recipes?farmId=${farmId}`);
        if (res.ok) {
          const localList = await res.json();
          if (localList && localList.length > 0) return localList;
        }
        return [];
      }

      // Fetch ingredients and inventory names
      const recipeIds = recipes.map((r) => r.Id);
      const { data: ingredients } = await supabase
        .from('RecipeIngredients')
        .select('*')
        .in('FoodRecipeId', recipeIds);

      // Get inventories to hydrate names and stock
      const { data: invList } = await supabase
        .from('Inventories')
        .select('*')
        .eq('FarmId', farmId);

      const invMap = new Map((invList || []).map((i: any) => [i.Id, i]));

      return recipes.map((r) => {
        const targetInv = r.TargetFeedItemId ? invMap.get(r.TargetFeedItemId) : null;
        const recipeIngs = (ingredients || [])
          .filter((ing) => ing.FoodRecipeId === r.Id)
          .map((ing) => {
            const ingInv = invMap.get(ing.InventoryId);
            return {
              ...ing,
              IngredientName: ingInv?.ItemName || `Ingredient #${ing.InventoryId}`,
              IngredientStock: ingInv?.CurrentStock || 0,
              IngredientUnitPrice: ingInv?.UnitPrice || 0,
              UnitOfMeasurement: ingInv?.UnitOfMeasurement || 'Kg'
            };
          });

        return {
          ...r,
          TargetItemName: targetInv?.ItemName || r.RecipeName,
          TargetStock: targetInv?.CurrentStock || 0,
          TargetUnitPrice: targetInv?.UnitPrice || 0,
          Ingredients: recipeIngs
        };
      });
    } catch (err: any) {
      console.error('[recipeService.getRecipes] Fallback to /api/recipes:', err.message);
      const res = await fetch(`/api/recipes?farmId=${farmId}`);
      if (res.ok) return await res.json();
      return [];
    }
  },

  /**
   * Create a new food recipe with ingredients.
   * Automatically creates or links a finished Feed item in Inventories so the user doesn't have to manually create it first.
   */
  async createRecipe(
    farmId: number,
    recipeData: { RecipeName: string; BatchSizeKg: number; TargetFeedItemId?: number; Notes?: string },
    ingredients: Array<{ InventoryId: number; Percentage: number; WeightKg?: number }>
  ): Promise<any> {
    let targetFeedId = recipeData.TargetFeedItemId;

    // 1. Auto-create or resolve Target Finished Feed in Inventories if not provided
    if (!targetFeedId) {
      try {
        const { data: existingFeed } = await supabase
          .from('Inventories')
          .select('Id')
          .eq('FarmId', farmId)
          .eq('ItemName', recipeData.RecipeName)
          .eq('Category', 'Feed')
          .maybeSingle();

        if (existingFeed?.Id) {
          targetFeedId = existingFeed.Id;
        } else {
          const { data: newFeed } = await supabase
            .from('Inventories')
            .insert([
              {
                FarmId: farmId,
                ItemName: recipeData.RecipeName,
                Category: 'Feed',
                UnitOfMeasurement: 'Kg',
                UnitPrice: 0,
                SellingPrice: 0,
                CurrentStock: 0,
                WeightPerUnit: 1.0,
                MinThreshold: 100,
                Notes: `Auto-created finished feed for formula: ${recipeData.RecipeName}`
              }
            ])
            .select()
            .single();

          if (newFeed?.Id) {
            targetFeedId = newFeed.Id;
          }
        }
      } catch (feedErr) {
        console.warn('Auto-create inventory in supabase skipped/failed:', feedErr);
      }
    }

    // 2. Insert into FoodRecipes
    try {
      // Deduplication check: prevent duplicate recipes with identical name in this farm
      if (recipeData.RecipeName) {
        const { data: existingRec } = await supabase
          .from('FoodRecipes')
          .select('Id')
          .eq('FarmId', farmId)
          .ilike('RecipeName', recipeData.RecipeName.trim());

        if (existingRec && existingRec.length > 0) {
          throw new Error(`A milling recipe with the name "${recipeData.RecipeName}" already exists.`);
        }
      }

      const { data: newRecipe, error: rErr } = await supabase
        .from('FoodRecipes')
        .insert([
          {
            FarmId: farmId,
            RecipeName: recipeData.RecipeName,
            BatchSizeKg: Number(recipeData.BatchSizeKg) || 1000,
            TargetFeedItemId: targetFeedId || null,
            Notes: recipeData.Notes || ''
          }
        ])
        .select()
        .single();

      if (!rErr && newRecipe?.Id) {
        if (ingredients && ingredients.length > 0) {
          const ingPayload = ingredients.map((ing) => ({
            FoodRecipeId: newRecipe.Id,
            InventoryId: ing.InventoryId,
            Percentage: ing.Percentage,
            WeightKg: ((Number(recipeData.BatchSizeKg) || 1000) * ing.Percentage) / 100
          }));
          await supabase.from('RecipeIngredients').insert(ingPayload);
        }

        // Also call backend to keep SQLite in sync
        fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            FarmId: farmId,
            RecipeName: recipeData.RecipeName,
            BatchSizeKg: recipeData.BatchSizeKg,
            Notes: recipeData.Notes,
            TargetFeedItemId: targetFeedId,
            Ingredients: ingredients
          })
        }).catch(() => {});

        return newRecipe;
      }
    } catch (sbErr) {
      console.warn('Supabase createRecipe failed, falling back to local backend:', sbErr);
    }

    // Local Backend Fallback
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': localStorage.getItem('userEmail') || 'admin'
      },
      body: JSON.stringify({
        FarmId: farmId,
        RecipeName: recipeData.RecipeName,
        BatchSizeKg: recipeData.BatchSizeKg,
        Notes: recipeData.Notes,
        TargetFeedItemId: targetFeedId,
        Ingredients: ingredients
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create recipe');
    }
    return await res.json();
  },

  /**
   * Delete a recipe
   */
  async deleteRecipe(farmId: number, recipeId: number): Promise<void> {
    try {
      await supabase.from('RecipeIngredients').delete().eq('FoodRecipeId', recipeId);
      await supabase.from('FoodRecipes').delete().eq('Id', recipeId).eq('FarmId', farmId);
    } catch (e) {
      console.warn('Supabase deleteRecipe warning:', e);
    }

    try {
      await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { 'X-User-Email': localStorage.getItem('userEmail') || 'admin' }
      });
    } catch (e) {
      console.warn('Local API deleteRecipe warning:', e);
    }
  },

  /**
   * Execute milling batch run:
   * - Verifies raw material stock
   * - Deducts raw materials from Inventories
   * - Adds finished feed to Inventories with weighted average cost
   * - Records batch log
   */
  async executeMill(
    farmId: number,
    recipeId: number,
    outputQuantityKg: number,
    notes?: string
  ): Promise<any> {
    // Call backend endpoint which runs transactional deduction and logging
    const res = await fetch(`/api/recipes/${recipeId}/mill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': localStorage.getItem('userEmail') || 'admin'
      },
      body: JSON.stringify({
        FarmId: farmId,
        OutputQuantityKg: outputQuantityKg,
        notes: notes
      })
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Milling execution failed');
    }

    return json;
  },

  /**
   * Get production logs for a farm
   */
  async getProductionLogs(farmId: number): Promise<any[]> {
    try {
      const res = await fetch(`/api/recipes/production-logs?farmId=${farmId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed fetching production logs from backend:', e);
    }
    return [];
  }
};

// ==============================================================================
// 6. STAKEHOLDERS SERVICE (Customers & Suppliers)
// ==============================================================================
export const stakeholderService = {
  // --- Customers ---
  async getCustomers(farmId: number): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('Customers')
      .select('*')
      .eq('FarmId', farmId)
      .order('FullName', { ascending: true });

    if (error) {
      console.error('[stakeholderService.getCustomers] Error:', error.message);
      throw error;
    }
    return (data || []).map((c: any) => ({
      ...c,
      OpeningCreditBalance: Number(c.OpeningCreditBalance) || 0,
      CurrentCreditBalance: Number(c.CurrentCreditBalance) || 0
    }));
  },

  async createCustomer(farmId: number, cData: Partial<Customer>): Promise<Customer> {
    // Deduplication check: prevent duplicate customers with identical name
    if (cData.FullName) {
      const { data: existingCust } = await supabase
        .from('Customers')
        .select('Id')
        .eq('FarmId', farmId)
        .ilike('FullName', cData.FullName.trim());

      if (existingCust && existingCust.length > 0) {
        throw new Error(`A customer record with the name "${cData.FullName}" already exists.`);
      }
    }

    const opening = Number(cData.OpeningCreditBalance) || 0;
    const current = cData.CurrentCreditBalance !== undefined ? Number(cData.CurrentCreditBalance) || 0 : opening;

    const payload = {
      FarmId: farmId,
      FullName: cData.FullName || 'Unnamed Customer',
      Email: cData.Email || '',
      Phone: cData.Phone || '',
      Company: cData.Company || '',
      OpeningCreditBalance: opening,
      CurrentCreditBalance: current,
      Address: cData.Address || ''
    };

    const { data, error } = await supabase
      .from('Customers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[stakeholderService.createCustomer] Error:', error.message);
      throw error;
    }
    return data;
  },

  async updateCustomer(farmId: number, id: number, cData: Partial<Customer>): Promise<Customer> {
    const updatePayload: any = { ...cData };
    delete updatePayload.Id;
    delete updatePayload.FarmId;

    if (updatePayload.OpeningCreditBalance !== undefined) {
      updatePayload.OpeningCreditBalance = Number(updatePayload.OpeningCreditBalance) || 0;
    }
    if (updatePayload.CurrentCreditBalance !== undefined) {
      updatePayload.CurrentCreditBalance = Number(updatePayload.CurrentCreditBalance) || 0;
    }

    const { data, error } = await supabase
      .from('Customers')
      .update(updatePayload)
      .eq('Id', id)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[stakeholderService.updateCustomer] Error:', error.message);
      throw error;
    }
    return data;
  },

  async deleteCustomer(farmId: number, id: number): Promise<void> {
    const { error } = await supabase
      .from('Customers')
      .delete()
      .eq('Id', id)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[stakeholderService.deleteCustomer] Error:', error.message);
      throw error;
    }
  },

  // --- Suppliers ---
  async getSuppliers(farmId: number): Promise<Supplier[]> {
    const { data, error } = await supabase
      .from('Suppliers')
      .select('*')
      .eq('FarmId', farmId)
      .order('CompanyName', { ascending: true });

    if (error) {
      console.error('[stakeholderService.getSuppliers] Error:', error.message);
      throw error;
    }
    return (data || []).map((s: any) => ({
      ...s,
      OpeningCreditBalance: Number(s.OpeningCreditBalance) || 0,
      CurrentCreditBalance: Number(s.CurrentCreditBalance) || 0
    }));
  },

  async createSupplier(farmId: number, sData: Partial<Supplier>): Promise<Supplier> {
    // Deduplication check: prevent duplicate suppliers with identical company name
    if (sData.CompanyName) {
      const { data: existingSup } = await supabase
        .from('Suppliers')
        .select('Id')
        .eq('FarmId', farmId)
        .ilike('CompanyName', sData.CompanyName.trim());

      if (existingSup && existingSup.length > 0) {
        throw new Error(`A supplier record with company name "${sData.CompanyName}" already exists.`);
      }
    }

    const opening = Number(sData.OpeningCreditBalance) || 0;
    const current = sData.CurrentCreditBalance !== undefined ? Number(sData.CurrentCreditBalance) || 0 : opening;

    const payload = {
      FarmId: farmId,
      CompanyName: sData.CompanyName || 'Unnamed Supplier',
      ContactPerson: sData.ContactPerson || '',
      Email: sData.Email || '',
      Phone: sData.Phone || '',
      OpeningCreditBalance: opening,
      CurrentCreditBalance: current,
      Address: sData.Address || ''
    };

    const { data, error } = await supabase
      .from('Suppliers')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[stakeholderService.createSupplier] Error:', error.message);
      throw error;
    }
    return data;
  },

  async updateSupplier(farmId: number, id: number, sData: Partial<Supplier>): Promise<Supplier> {
    const updatePayload: any = { ...sData };
    delete updatePayload.Id;
    delete updatePayload.FarmId;

    if (updatePayload.OpeningCreditBalance !== undefined) {
      updatePayload.OpeningCreditBalance = Number(updatePayload.OpeningCreditBalance) || 0;
    }
    if (updatePayload.CurrentCreditBalance !== undefined) {
      updatePayload.CurrentCreditBalance = Number(updatePayload.CurrentCreditBalance) || 0;
    }

    const { data, error } = await supabase
      .from('Suppliers')
      .update(updatePayload)
      .eq('Id', id)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[stakeholderService.updateSupplier] Error:', error.message);
      throw error;
    }
    return data;
  },

  async deleteSupplier(farmId: number, id: number): Promise<void> {
    const { error } = await supabase
      .from('Suppliers')
      .delete()
      .eq('Id', id)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[stakeholderService.deleteSupplier] Error:', error.message);
      throw error;
    }
  },

  // --- Staff ---
  async getStaff(farmId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('Staff')
      .select('*')
      .eq('FarmId', farmId)
      .order('FullName', { ascending: true });

    if (error) {
      console.error('[stakeholderService.getStaff] Error:', error.message);
      return [];
    }
    return data || [];
  }
};

// ==============================================================================
// 7. EGG INVENTORIES SERVICE
// ==============================================================================
export const eggInventoryService = {
  async getEggInventories(farmId: number): Promise<EggInventory[]> {
    const { data, error } = await supabase
      .from('EggInventories')
      .select('*')
      .eq('FarmId', farmId)
      .order('Id', { ascending: true });

    if (error) {
      console.error('[eggInventoryService.getEggInventories] Error:', error.message);
      throw error;
    }

    // If none found for this farm, create standard defaults safely without race condition
    if (!data || data.length === 0) {
      const { data: recheck } = await supabase
        .from('EggInventories')
        .select('*')
        .eq('FarmId', farmId);

      if (!recheck || recheck.length === 0) {
        const defaults = [
          { FarmId: farmId, GradeOrType: 'Fresh Eggs', PackSize: 'Single', Quantity: 0, UnitPrice: 0.15, SellingPrice: 0.25 },
          { FarmId: farmId, GradeOrType: 'Damaged/Waste Eggs', PackSize: 'Single', Quantity: 0, UnitPrice: 0, SellingPrice: 0.05 }
        ];
        const { data: created } = await supabase.from('EggInventories').insert(defaults).select();
        return created || [];
      }
      return recheck;
    }

    return (data || []).map((e: any) => ({
      ...e,
      Quantity: Number(e.Quantity) || 0,
      UnitPrice: Number(e.UnitPrice) || 0,
      SellingPrice: Number(e.SellingPrice) || 0
    }));
  },

  async updateEggInventory(farmId: number, id: number, updateData: Partial<EggInventory>): Promise<EggInventory> {
    const { data, error } = await supabase
      .from('EggInventories')
      .update(updateData)
      .eq('Id', id)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[eggInventoryService.updateEggInventory] Error:', error.message);
      throw error;
    }
    return data;
  }
};

// ==============================================================================
// 8. PURCHASING SERVICE
// ==============================================================================
export const purchaseService = {
  /**
   * Fetch all purchases for a farm with supplier names and return totals
   */
  async getPurchases(farmId: number): Promise<any[]> {
    const { data: purchases, error } = await supabase
      .from('Purchases')
      .select('*')
      .eq('FarmId', farmId)
      .order('PurchaseDate', { ascending: false });

    if (error) {
      console.error('[purchaseService.getPurchases] Error:', error.message);
      throw error;
    }
    if (!purchases || purchases.length === 0) return [];

    // Fetch suppliers for mapping
    const { data: suppliers } = await supabase
      .from('Suppliers')
      .select('Id, CompanyName')
      .eq('FarmId', farmId);
    
    const supplierMap = new Map((suppliers || []).map((s: any) => [s.Id, s.CompanyName]));

    // Fetch return amounts
    const purchaseIds = purchases.map((p: any) => p.Id);
    const { data: returns } = await supabase
      .from('PurchaseReturns')
      .select('PurchaseId, TotalReturnAmount')
      .in('PurchaseId', purchaseIds);

    const returnsMap: Record<number, number> = {};
    (returns || []).forEach((r: any) => {
      returnsMap[r.PurchaseId] = (returnsMap[r.PurchaseId] || 0) + (Number(r.TotalReturnAmount) || 0);
    });

    return purchases.map((p: any) => ({
      ...p,
      TotalAmount: Number(p.TotalAmount) || 0,
      TotalGSTAmount: Number(p.TotalGSTAmount) || 0,
      OtherTaxes: Number(p.OtherTaxes) || 0,
      ReceivedAmount: Number(p.ReceivedAmount) || 0,
      BalanceAmount: Number(p.BalanceAmount) || 0,
      SupplierName: supplierMap.get(p.SupplierId) || 'Direct Supplier',
      TotalReturnAmount: returnsMap[p.Id] || 0
    }));
  },

  /**
   * Fetch details of a single purchase order
   */
  async getPurchaseDetails(farmId: number, purchaseId: number): Promise<any> {
    const { data: purchase, error } = await supabase
      .from('Purchases')
      .select('*')
      .eq('Id', purchaseId)
      .eq('FarmId', farmId)
      .single();

    if (error || !purchase) {
      throw new Error(error?.message || 'Purchase order not found');
    }

    // Get supplier name
    if (purchase.SupplierId) {
      const { data: s } = await supabase.from('Suppliers').select('CompanyName').eq('Id', purchase.SupplierId).single();
      if (s) purchase.SupplierName = s.CompanyName;
    }

    // Get items
    const { data: items } = await supabase
      .from('PurchaseItems')
      .select('*')
      .eq('PurchaseId', purchaseId);

    // Get inventory names
    const invIds = (items || []).map((i: any) => i.InventoryId).filter(Boolean);
    let invMap = new Map();
    if (invIds.length > 0) {
      const { data: invs } = await supabase.from('Inventories').select('Id, ItemName').in('Id', invIds);
      invMap = new Map((invs || []).map((iv: any) => [iv.Id, iv.ItemName]));
    }

    const processedItems = (items || []).map((i: any) => ({
      ...i,
      Quantity: Number(i.Quantity) || 0,
      UnitPrice: Number(i.UnitPrice) || 0,
      GSTPercentage: Number(i.GSTPercentage) || 0,
      GSTAmount: Number(i.GSTAmount) || 0,
      TotalPrice: Number(i.TotalPrice) || 0,
      WeightPerUnit: Number(i.WeightPerUnit) || 1,
      AllocatedOverhead: Number(i.AllocatedOverhead) || 0,
      FinalLandedAmount: Number(i.FinalLandedAmount) || 0,
      DiscountPercentage: Number(i.DiscountPercentage) || 0,
      DiscountAmount: Number(i.DiscountAmount) || 0,
      ItemName: invMap.get(i.InventoryId) || 'Raw Item'
    }));

    // Get extra expenses
    const { data: expenses } = await supabase
      .from('PurchaseExtraExpenses')
      .select('*')
      .eq('PurchaseId', purchaseId);

    const processedExpenses = (expenses || []).map((e: any) => ({
      ...e,
      Amount: Number(e.Amount) || 0,
      TargetInventoryName: invMap.get(e.TargetInventoryId) || 'All Lines'
    }));

    // Get returns
    const { data: returnsList } = await supabase
      .from('PurchaseReturns')
      .select('*')
      .eq('PurchaseId', purchaseId);

    const returnIds = (returnsList || []).map((r: any) => r.Id);
    let returnItems: any[] = [];
    if (returnIds.length > 0) {
      const { data: retItems } = await supabase
        .from('PurchaseReturnItems')
        .select('*')
        .in('PurchaseReturnId', returnIds);
      returnItems = (retItems || []).map((ri: any) => ({
        ...ri,
        ItemName: invMap.get(ri.InventoryId) || 'Item'
      }));
    }

    return {
      purchase: {
        ...purchase,
        TotalAmount: Number(purchase.TotalAmount) || 0,
        TotalGSTAmount: Number(purchase.TotalGSTAmount) || 0,
        ReceivedAmount: Number(purchase.ReceivedAmount) || 0,
        BalanceAmount: Number(purchase.BalanceAmount) || 0
      },
      items: processedItems,
      expenses: processedExpenses,
      returns: returnsList || [],
      returnItems
    };
  },

  /**
   * Create a new purchase with Landed Costing, Stock Updates & Ledger Integration
   */
  async createPurchase(
    farmId: number,
    purchaseData: {
      SupplierId: number | null;
      PurchaseDate: string;
      InvoiceNumber: string;
      Notes: string;
      ReceivedAmount: number;
    },
    rawItems: any[],
    rawExpenses: any[]
  ): Promise<any> {
    // 1. Process items base costs
    const itemsWithAllocation = (rawItems || []).map((item: any) => {
      const invId = parseInt(item.InventoryId);
      const qty = Number(item.Quantity) || 0;
      const up = Number(item.UnitPrice) || 0;
      const gst = Number(item.GSTPercentage) || 0;
      const disc = Number(item.DiscountPercentage) || 0;
      const wpu = Number(item.WeightPerUnit) || 1;
      const baseCostRaw = qty * up;
      const discountAmount = baseCostRaw * (disc / 100);
      const baseCost = baseCostRaw - discountAmount;
      const gstAmount = baseCost * (gst / 100);
      const totalPrice = baseCost + gstAmount;

      return {
        InventoryId: isNaN(invId) ? null : invId,
        ItemType: item.ItemType || 'Inventory',
        Quantity: qty,
        UnitPrice: up,
        GSTPercentage: gst,
        DiscountPercentage: disc,
        DiscountAmount: discountAmount,
        GSTAmount: gstAmount,
        TotalPrice: totalPrice,
        WeightPerUnit: wpu,
        AllocatedOverhead: 0,
        FinalLandedAmount: totalPrice
      };
    });

    const itemsSubTotalSum = itemsWithAllocation.reduce((acc: number, item: any) => acc + (item.TotalPrice - item.GSTAmount), 0);
    const totalWeightSum = itemsWithAllocation.reduce((acc: number, item: any) => acc + (item.Quantity * item.WeightPerUnit), 0);
    const totalQtySum = itemsWithAllocation.reduce((acc: number, item: any) => acc + item.Quantity, 0);

    // 2. Extra Expenses Allocation
    const extraExpensesProcessed = (rawExpenses || []).map((exp: any) => {
      const amt = Number(exp.Amount) || 0;
      const targId = parseInt(exp.TargetInventoryId);
      return {
        ExpenseName: exp.ExpenseName || 'Overhead Expense',
        Amount: amt,
        AllocationMethod: exp.AllocationMethod || 'Equal',
        TargetInventoryId: isNaN(targId) ? null : targId
      };
    });

    for (const expense of extraExpensesProcessed) {
      const expenseAmount = expense.Amount;
      if (expenseAmount <= 0) continue;

      if (expense.AllocationMethod === 'ByValue' && itemsSubTotalSum > 0) {
        itemsWithAllocation.forEach((item: any) => {
          item.AllocatedOverhead += expenseAmount * ((item.TotalPrice - item.GSTAmount) / itemsSubTotalSum);
        });
      } else if (expense.AllocationMethod === 'ByWeight' && totalWeightSum > 0) {
        itemsWithAllocation.forEach((item: any) => {
          const itemTotalWeight = item.Quantity * item.WeightPerUnit;
          item.AllocatedOverhead += expenseAmount * (itemTotalWeight / totalWeightSum);
        });
      } else if (expense.AllocationMethod === 'ByQuantity' && totalQtySum > 0) {
        itemsWithAllocation.forEach((item: any) => {
          item.AllocatedOverhead += expenseAmount * (item.Quantity / totalQtySum);
        });
      } else if (expense.AllocationMethod === 'Equal') {
        const linesCount = itemsWithAllocation.length;
        if (linesCount > 0) {
          itemsWithAllocation.forEach((item: any) => {
            item.AllocatedOverhead += expenseAmount / linesCount;
          });
        }
      } else if (expense.TargetInventoryId) {
        itemsWithAllocation.forEach((item: any) => {
          if (item.InventoryId === expense.TargetInventoryId) {
            item.AllocatedOverhead += expenseAmount;
          }
        });
      }
    }

    // Complete Landed calculation
    itemsWithAllocation.forEach((item: any) => {
      item.FinalLandedAmount = item.TotalPrice + item.AllocatedOverhead;
    });

    const invoiceTotalGST = itemsWithAllocation.reduce((acc: number, item: any) => acc + item.GSTAmount, 0);
    const subTotalAmount = itemsWithAllocation.reduce((acc: number, item: any) => acc + item.TotalPrice, 0);
    const extraExpensesTotal = extraExpensesProcessed.reduce((acc: number, exp: any) => acc + exp.Amount, 0);
    const grandTotal = subTotalAmount + extraExpensesTotal;

    const receivedAmount = Number(purchaseData.ReceivedAmount) || 0;
    const balanceAmount = grandTotal - receivedAmount;
    const purchaseStatus = balanceAmount <= 0 ? 'Paid' : (receivedAmount > 0 ? 'Partial' : 'Unpaid');

    // Deduplication check: prevent duplicate purchase invoice numbers from the same supplier
    if (purchaseData.InvoiceNumber && purchaseData.SupplierId) {
      const { data: existingInv } = await supabase
        .from('Purchases')
        .select('Id')
        .eq('FarmId', farmId)
        .eq('SupplierId', Number(purchaseData.SupplierId))
        .ilike('InvoiceNumber', purchaseData.InvoiceNumber.trim());

      if (existingInv && existingInv.length > 0) {
        throw new Error(`A purchase with invoice number "${purchaseData.InvoiceNumber}" already exists for this supplier.`);
      }
    }

    // 3. Insert Purchase
    const purchasePayload = {
      FarmId: farmId,
      SupplierId: purchaseData.SupplierId ? Number(purchaseData.SupplierId) : null,
      PurchaseDate: purchaseData.PurchaseDate || new Date().toISOString().split('T')[0],
      TotalAmount: grandTotal,
      TotalGSTAmount: invoiceTotalGST,
      OtherTaxes: 0,
      ReceivedAmount: receivedAmount,
      BalanceAmount: balanceAmount,
      InvoiceNumber: purchaseData.InvoiceNumber || '',
      Status: purchaseStatus,
      Notes: purchaseData.Notes || ''
    };

    const { data: newPurchase, error: pErr } = await supabase
      .from('Purchases')
      .insert([purchasePayload])
      .select()
      .single();

    if (pErr) {
      console.error('[purchaseService.createPurchase] Error:', pErr.message);
      throw pErr;
    }

    const purchaseId = newPurchase.Id;

    // 4. Insert PurchaseItems and Update Inventory with Weighted Average Costing
    for (const item of itemsWithAllocation) {
      await supabase.from('PurchaseItems').insert([{
        PurchaseId: purchaseId,
        InventoryId: item.InventoryId,
        ItemType: item.ItemType,
        Quantity: item.Quantity,
        UnitPrice: item.UnitPrice,
        GSTPercentage: item.GSTPercentage,
        GSTAmount: item.GSTAmount,
        TotalPrice: item.TotalPrice,
        WeightPerUnit: item.WeightPerUnit,
        AllocatedOverhead: item.AllocatedOverhead,
        FinalLandedAmount: item.FinalLandedAmount,
        DiscountPercentage: item.DiscountPercentage,
        DiscountAmount: item.DiscountAmount
      }]);

      // Weighted Average Costing Formula
      if (item.InventoryId) {
        const { data: originalInv } = await supabase
          .from('Inventories')
          .select('CurrentStock, UnitPrice')
          .eq('Id', item.InventoryId)
          .eq('FarmId', farmId)
          .single();

        if (originalInv) {
          const oldStock = Number(originalInv.CurrentStock) || 0;
          const oldPrice = Number(originalInv.UnitPrice) || 0;
          const incomingQuantity = item.Quantity;
          const newStock = oldStock + incomingQuantity;
          const newUnitPrice = newStock > 0 ? ((oldStock * oldPrice) + item.FinalLandedAmount) / newStock : oldPrice;

          await supabase
            .from('Inventories')
            .update({
              CurrentStock: newStock,
              UnitPrice: newUnitPrice
            })
            .eq('Id', item.InventoryId)
            .eq('FarmId', farmId);
        }
      }
    }

    // 5. Insert Extra Expenses
    for (const exp of extraExpensesProcessed) {
      await supabase.from('PurchaseExtraExpenses').insert([{
        PurchaseId: purchaseId,
        ExpenseName: exp.ExpenseName,
        Amount: exp.Amount,
        AllocationMethod: exp.AllocationMethod,
        TargetInventoryId: exp.TargetInventoryId
      }]);
    }

    // 6. Increase Supplier credit balance if unpaid balance exists
    if (purchaseData.SupplierId && balanceAmount > 0) {
      const { data: supplier } = await supabase
        .from('Suppliers')
        .select('CurrentCreditBalance')
        .eq('Id', purchaseData.SupplierId)
        .eq('FarmId', farmId)
        .single();

      if (supplier) {
        const newBal = (Number(supplier.CurrentCreditBalance) || 0) + balanceAmount;
        await supabase
          .from('Suppliers')
          .update({ CurrentCreditBalance: newBal })
          .eq('Id', purchaseData.SupplierId)
          .eq('FarmId', farmId);
      }
    }

    // 7. Ledger integration: record Expense if payment made
    if (receivedAmount > 0) {
      try {
        // Find Feed Purchase or General Expense category
        const { data: cat } = await supabase
          .from('TransactionCategories')
          .select('Id')
          .eq('FarmId', farmId)
          .eq('IsIncome', 0)
          .ilike('Name', '%Purchase%')
          .limit(1)
          .single();

        let categoryId = cat?.Id;
        if (!categoryId) {
          const { data: fallbackCat } = await supabase
            .from('TransactionCategories')
            .select('Id')
            .eq('FarmId', farmId)
            .eq('IsIncome', 0)
            .limit(1)
            .single();
          categoryId = fallbackCat?.Id || 3;
        }

        await supabase.from('FinancialTransactions').insert([{
          FarmId: farmId,
          Date: purchaseData.PurchaseDate || new Date().toISOString().split('T')[0],
          Amount: receivedAmount,
          Type: 'Expense',
          CategoryId: categoryId,
          Notes: `Invoice #${purchaseData.InvoiceNumber || purchaseId} Purchase Payment`,
          SupplierId: purchaseData.SupplierId ? Number(purchaseData.SupplierId) : null,
          PaymentMethod: 'Cash'
        }]);
      } catch (fErr) {
        console.warn('Financial transaction logging notice:', fErr);
      }
    }

    return newPurchase;
  },

  async deletePurchase(farmId: number, purchaseId: number): Promise<void> {
    // Delete children first
    await supabase.from('PurchaseExtraExpenses').delete().eq('PurchaseId', purchaseId);
    await supabase.from('PurchaseItems').delete().eq('PurchaseId', purchaseId);
    const { error } = await supabase.from('Purchases').delete().eq('Id', purchaseId).eq('FarmId', farmId);
    if (error) {
      console.error('[purchaseService.deletePurchase] Error:', error.message);
      throw error;
    }
  },

  async returnPurchase(
    farmId: number,
    purchaseId: number,
    returnDate: string,
    notes: string,
    itemsToReturn: { InventoryId: number; ReturnQuantity: number }[]
  ): Promise<any> {
    const { data: purchase } = await supabase.from('Purchases').select('*').eq('Id', purchaseId).eq('FarmId', farmId).single();
    if (!purchase) throw new Error('Purchase order not found');

    const { data: pItems } = await supabase.from('PurchaseItems').select('*').eq('PurchaseId', purchaseId);
    const itemMap = new Map((pItems || []).map((pi: any) => [pi.InventoryId, pi]));

    let totalReturnAmount = 0;
    const processedReturnItems = [];

    for (const ret of itemsToReturn) {
      const pi = itemMap.get(ret.InventoryId);
      const unitPrice = pi ? (Number(pi.FinalLandedAmount) / (Number(pi.Quantity) || 1)) : 0;
      const itemReturnAmount = unitPrice * ret.ReturnQuantity;
      totalReturnAmount += itemReturnAmount;

      processedReturnItems.push({
        InventoryId: ret.InventoryId,
        ReturnQuantity: ret.ReturnQuantity,
        UnitPrice: unitPrice,
        TotalRefundAmount: itemReturnAmount
      });

      // Deduct inventory stock for the returned items
      const { data: inv } = await supabase.from('Inventories').select('CurrentStock').eq('Id', ret.InventoryId).eq('FarmId', farmId).single();
      if (inv) {
        const newStock = Math.max(0, (Number(inv.CurrentStock) || 0) - ret.ReturnQuantity);
        await supabase.from('Inventories').update({ CurrentStock: newStock }).eq('Id', ret.InventoryId).eq('FarmId', farmId);
      }
    }

    const { data: pReturn, error: prErr } = await supabase.from('PurchaseReturns').insert([{
      PurchaseId: purchaseId,
      ReturnDate: returnDate || new Date().toISOString().split('T')[0],
      TotalReturnAmount: totalReturnAmount,
      Notes: notes || ''
    }]).select().single();

    if (prErr) throw prErr;

    for (const pri of processedReturnItems) {
      await supabase.from('PurchaseReturnItems').insert([{
        PurchaseReturnId: pReturn.Id,
        InventoryId: pri.InventoryId,
        ReturnQuantity: pri.ReturnQuantity,
        UnitPrice: pri.UnitPrice,
        TotalRefundAmount: pri.TotalRefundAmount
      }]);
    }

    // Deduct vendor credit balance if unpaid balance was on account
    if (purchase.SupplierId && totalReturnAmount > 0) {
      const { data: sup } = await supabase.from('Suppliers').select('CurrentCreditBalance').eq('Id', purchase.SupplierId).eq('FarmId', farmId).single();
      if (sup) {
        const newBal = Math.max(0, (Number(sup.CurrentCreditBalance) || 0) - totalReturnAmount);
        await supabase.from('Suppliers').update({ CurrentCreditBalance: newBal }).eq('Id', purchase.SupplierId).eq('FarmId', farmId);
      }
    }

    return pReturn;
  },

  async updatePurchase(farmId: number, purchaseId: number, purchaseData: any, rawItems: any[], rawExpenses: any[]): Promise<any> {
    await this.deletePurchase(farmId, purchaseId);
    return await this.createPurchase(farmId, purchaseData, rawItems, rawExpenses);
  }
};

// ==============================================================================
// 9. SALES SERVICE
// ==============================================================================
export const salesService = {
  /**
   * Fetch all sales invoices for a farm with customer names
   */
  async getSales(farmId: number): Promise<any[]> {
    const { data: sales, error } = await supabase
      .from('Sales')
      .select('*')
      .eq('FarmId', farmId)
      .order('SaleDate', { ascending: false });

    if (error) {
      console.error('[salesService.getSales] Error:', error.message);
      throw error;
    }
    if (!sales || sales.length === 0) return [];

    // Map customer names
    const { data: customers } = await supabase
      .from('Customers')
      .select('Id, FullName')
      .eq('FarmId', farmId);

    const customerMap = new Map((customers || []).map((c: any) => [c.Id, c.FullName]));

    return sales.map((s: any) => ({
      ...s,
      SubTotal: Number(s.SubTotal) || 0,
      Discount: Number(s.Discount) || 0,
      TotalGSTAmount: Number(s.TotalGSTAmount) || 0,
      OtherCharges: Number(s.OtherCharges) || 0,
      GrandTotal: Number(s.GrandTotal) || 0,
      ReceivedAmount: Number(s.ReceivedAmount) || 0,
      CustomerName: customerMap.get(s.CustomerId) || 'Direct Counter Customer'
    }));
  },

  /**
   * Fetch details of a single sale receipt
   */
  async getSaleDetails(farmId: number, saleId: number): Promise<any> {
    const { data: sale, error } = await supabase
      .from('Sales')
      .select('*')
      .eq('Id', saleId)
      .eq('FarmId', farmId)
      .single();

    if (error || !sale) {
      throw new Error(error?.message || 'Sale invoice not found');
    }

    // Customer details
    let customerInfo: any = {};
    if (sale.CustomerId) {
      const { data: c } = await supabase.from('Customers').select('*').eq('Id', sale.CustomerId).single();
      if (c) customerInfo = c;
    }

    // Items
    const { data: items } = await supabase.from('SaleItems').select('*').eq('SaleId', saleId);

    // Fetch names
    const flockIds = (items || []).filter((i: any) => i.ItemType === 'Bird').map((i: any) => i.FlockId).filter(Boolean);
    const eggIds = (items || []).filter((i: any) => i.ItemType === 'Egg').map((i: any) => i.EggInventoryId).filter(Boolean);
    const invIds = (items || []).filter((i: any) => i.ItemType === 'General Inventory').map((i: any) => i.InventoryId).filter(Boolean);

    let flockMap = new Map();
    let eggMap = new Map();
    let invMap = new Map();

    if (flockIds.length > 0) {
      const { data: flks } = await supabase.from('Flocks').select('Id, FlockName').in('Id', flockIds);
      flockMap = new Map((flks || []).map((f: any) => [f.Id, f.FlockName]));
    }
    if (eggIds.length > 0) {
      const { data: egs } = await supabase.from('EggInventories').select('Id, GradeOrType').in('Id', eggIds);
      eggMap = new Map((egs || []).map((e: any) => [e.Id, e.GradeOrType]));
    }
    if (invIds.length > 0) {
      const { data: ivs } = await supabase.from('Inventories').select('Id, ItemName').in('Id', invIds);
      invMap = new Map((ivs || []).map((i: any) => [i.Id, i.ItemName]));
    }

    const processedItems = (items || []).map((i: any) => {
      let itemName = 'Sale Item';
      if (i.ItemType === 'Bird') itemName = flockMap.get(i.FlockId) || 'Birds';
      else if (i.ItemType === 'Egg') itemName = eggMap.get(i.EggInventoryId) || 'Eggs';
      else itemName = invMap.get(i.InventoryId) || 'Inventory Item';

      return {
        ...i,
        Quantity: Number(i.Quantity) || 0,
        UnitPrice: Number(i.UnitPrice) || 0,
        GSTPercentage: Number(i.GSTPercentage) || 0,
        GSTAmount: Number(i.GSTAmount) || 0,
        TotalPrice: Number(i.TotalPrice) || 0,
        ItemName: itemName
      };
    });

    return {
      sale: {
        ...sale,
        CustomerName: customerInfo.FullName || 'Walk-in Customer',
        Phone: customerInfo.Phone || '',
        Email: customerInfo.Email || '',
        Address: customerInfo.Address || ''
      },
      items: processedItems,
      returns: [],
      returnItems: []
    };
  },

  /**
   * Process POS Sales invoice with Stock Depletion, Customer Credit & Finance Logging
   */
  async createSale(
    farmId: number,
    saleData: {
      CustomerId: number;
      SaleDate: string;
      InvoiceNumber: string;
      Discount: number;
      OtherCharges: number;
      ReceivedAmount: number;
      Notes: string;
    },
    items: any[]
  ): Promise<any> {
    // 1. Process items and validate stock
    const calculatedItems = [];
    for (const item of items) {
      const qty = Number(item.Quantity) || 0;
      const unitPrice = Number(item.UnitPrice) || 0;
      const gstPct = Number(item.GSTPercentage) || 0;

      if (item.ItemType === 'Egg') {
        const { data: egg } = await supabase
          .from('EggInventories')
          .select('*')
          .eq('Id', item.EggInventoryId)
          .eq('FarmId', farmId)
          .single();

        if (egg && Number(egg.Quantity) < qty) {
          throw new Error(`Insufficient Egg Inventory for "${egg.GradeOrType}"! Available: ${egg.Quantity}, Requested: ${qty}`);
        }
      } else if (item.ItemType === 'Bird') {
        const { data: flock } = await supabase
          .from('Flocks')
          .select('*')
          .eq('Id', item.FlockId)
          .eq('FarmId', farmId)
          .single();

        if (flock && Number(flock.CurrentCount) < qty) {
          throw new Error(`Insufficient bird count in "${flock.FlockName}"! Available: ${flock.CurrentCount}, Requested: ${qty}`);
        }
      } else {
        const { data: inv } = await supabase
          .from('Inventories')
          .select('*')
          .eq('Id', item.InventoryId)
          .eq('FarmId', farmId)
          .single();

        if (inv && Number(inv.CurrentStock) < qty) {
          throw new Error(`Insufficient stock for "${inv.ItemName}"! Available: ${inv.CurrentStock}, Requested: ${qty}`);
        }
      }

      const lineSub = qty * unitPrice;
      const lineGST = lineSub * (gstPct / 100);
      const lineTotal = lineSub + lineGST;

      calculatedItems.push({
        ItemType: item.ItemType,
        FlockId: item.FlockId ? Number(item.FlockId) : null,
        EggInventoryId: item.EggInventoryId ? Number(item.EggInventoryId) : null,
        InventoryId: item.InventoryId ? Number(item.InventoryId) : null,
        Quantity: qty,
        UnitPrice: unitPrice,
        GSTPercentage: gstPct,
        GSTAmount: lineGST,
        TotalPrice: lineTotal
      });
    }

    const subTotalSum = calculatedItems.reduce((acc, item) => acc + (item.Quantity * item.UnitPrice), 0);
    const totalGST = calculatedItems.reduce((acc, item) => acc + item.GSTAmount, 0);
    const otherCharges = Number(saleData.OtherCharges) || 0;
    const discount = Number(saleData.Discount) || 0;
    const grandTotal = subTotalSum + totalGST + otherCharges - discount;

    const receivedAmount = Number(saleData.ReceivedAmount) || 0;
    const balanceAmount = grandTotal - receivedAmount;
    const saleStatus = balanceAmount <= 0 ? 'Paid' : (receivedAmount > 0 ? 'Partial' : 'Unpaid');

    // Deduplication check: prevent duplicate sales invoice number
    if (saleData.InvoiceNumber) {
      const { data: existingSale } = await supabase
        .from('Sales')
        .select('Id')
        .eq('FarmId', farmId)
        .ilike('InvoiceNumber', saleData.InvoiceNumber.trim());

      if (existingSale && existingSale.length > 0) {
        throw new Error(`A sales invoice with number "${saleData.InvoiceNumber}" already exists.`);
      }
    }

    // 2. Insert Sale
    const salePayload = {
      FarmId: farmId,
      CustomerId: Number(saleData.CustomerId),
      SaleDate: saleData.SaleDate || new Date().toISOString().split('T')[0],
      SubTotal: subTotalSum,
      Discount: discount,
      TotalGSTAmount: totalGST,
      OtherCharges: otherCharges,
      GrandTotal: grandTotal,
      ReceivedAmount: receivedAmount,
      InvoiceNumber: saleData.InvoiceNumber || '',
      Status: saleStatus,
      Notes: saleData.Notes || ''
    };

    const { data: newSale, error: sErr } = await supabase
      .from('Sales')
      .insert([salePayload])
      .select()
      .single();

    if (sErr) {
      console.error('[salesService.createSale] Error:', sErr.message);
      throw sErr;
    }

    const saleId = newSale.Id;

    // 3. Deduct Stock and Insert SaleItems
    for (const item of calculatedItems) {
      await supabase.from('SaleItems').insert([{
        SaleId: saleId,
        ItemType: item.ItemType,
        FlockId: item.FlockId,
        EggInventoryId: item.EggInventoryId,
        InventoryId: item.InventoryId,
        Quantity: item.Quantity,
        UnitPrice: item.UnitPrice,
        GSTPercentage: item.GSTPercentage,
        GSTAmount: item.GSTAmount,
        TotalPrice: item.TotalPrice
      }]);

      // Stock deduction cascades
      if (item.ItemType === 'Egg' && item.EggInventoryId) {
        const { data: egg } = await supabase.from('EggInventories').select('Quantity').eq('Id', item.EggInventoryId).single();
        if (egg) {
          const newQty = Math.max(0, (Number(egg.Quantity) || 0) - item.Quantity);
          await supabase.from('EggInventories').update({ Quantity: newQty }).eq('Id', item.EggInventoryId);
        }
      } else if (item.ItemType === 'Bird' && item.FlockId) {
        const { data: flock } = await supabase.from('Flocks').select('CurrentCount, Status').eq('Id', item.FlockId).single();
        if (flock) {
          const newCount = Math.max(0, (Number(flock.CurrentCount) || 0) - item.Quantity);
          const newStatus = newCount === 0 ? 'Sold' : flock.Status;
          await supabase.from('Flocks').update({ CurrentCount: newCount, Status: newStatus }).eq('Id', item.FlockId);
        }
      } else if (item.InventoryId) {
        const { data: inv } = await supabase.from('Inventories').select('CurrentStock').eq('Id', item.InventoryId).single();
        if (inv) {
          const newStock = Math.max(0, (Number(inv.CurrentStock) || 0) - item.Quantity);
          await supabase.from('Inventories').update({ CurrentStock: newStock }).eq('Id', item.InventoryId);
        }
      }
    }

    // 4. Update Customer credit balance if credit purchase
    if (saleData.CustomerId && balanceAmount > 0) {
      const { data: cust } = await supabase.from('Customers').select('CurrentCreditBalance').eq('Id', saleData.CustomerId).single();
      if (cust) {
        const newBal = (Number(cust.CurrentCreditBalance) || 0) + balanceAmount;
        await supabase.from('Customers').update({ CurrentCreditBalance: newBal }).eq('Id', saleData.CustomerId);
      }
    }

    // 5. Financial Ledger hook for received amount
    if (receivedAmount > 0) {
      try {
        let categoryName = 'General Income';
        if (calculatedItems.some(i => i.ItemType === 'Bird')) categoryName = 'Bird Sales';
        else if (calculatedItems.some(i => i.ItemType === 'Egg')) categoryName = 'Egg Sales';

        const { data: cat } = await supabase
          .from('TransactionCategories')
          .select('Id')
          .eq('FarmId', farmId)
          .eq('IsIncome', 1)
          .ilike('Name', `%${categoryName.split(' ')[0]}%`)
          .limit(1)
          .single();

        let categoryId = cat?.Id;
        if (!categoryId) {
          const { data: fallbackCat } = await supabase
            .from('TransactionCategories')
            .select('Id')
            .eq('FarmId', farmId)
            .eq('IsIncome', 1)
            .limit(1)
            .single();
          categoryId = fallbackCat?.Id || 1;
        }

        const firstBird = calculatedItems.find(i => i.ItemType === 'Bird' && i.FlockId);

        await supabase.from('FinancialTransactions').insert([{
          FarmId: farmId,
          Date: saleData.SaleDate || new Date().toISOString().split('T')[0],
          Amount: receivedAmount,
          Type: 'Income',
          CategoryId: categoryId,
          Notes: `Invoice #${saleData.InvoiceNumber || saleId} Cash Collection`,
          CustomerId: saleData.CustomerId,
          FlockId: firstBird?.FlockId || null,
          PaymentMethod: 'Cash'
        }]);
      } catch (fErr) {
        console.warn('Sales finance ledger notice:', fErr);
      }
    }

    return newSale;
  },

  async deleteSale(farmId: number, saleId: number): Promise<void> {
    await supabase.from('SaleItems').delete().eq('SaleId', saleId);
    const { error } = await supabase.from('Sales').delete().eq('Id', saleId).eq('FarmId', farmId);
    if (error) {
      console.error('[salesService.deleteSale] Error:', error.message);
      throw error;
    }
  },

  async returnSale(
    farmId: number,
    saleId: number,
    returnDate: string,
    notes: string,
    returnsInput: Record<number, number> | Array<{ SaleItemId: number; ReturnQuantity: number }>
  ): Promise<any> {
    const returnsMap: Record<number, number> = Array.isArray(returnsInput)
      ? returnsInput.reduce((acc: any, it: any) => {
          acc[it.SaleItemId] = it.ReturnQuantity;
          return acc;
        }, {})
      : returnsInput;

    const { data: sale } = await supabase.from('Sales').select('*').eq('Id', saleId).eq('FarmId', farmId).single();
    if (!sale) throw new Error('Sale record not found');

    const { data: sItems } = await supabase.from('SaleItems').select('*').eq('SaleId', saleId);
    if (!sItems) throw new Error('No items found for this sale');

    let totalReturnAmount = 0;
    const processedReturns = [];

    for (const si of sItems) {
      const retQty = returnsMap[si.Id] || 0;
      if (retQty <= 0) continue;

      const unitPrice = Number(si.UnitPrice) || 0;
      const gstPct = Number(si.GSTPercentage) || 0;
      const lineRefund = retQty * unitPrice * (1 + gstPct / 100);
      totalReturnAmount += lineRefund;

      processedReturns.push({
        SaleItemId: si.Id,
        ItemType: si.ItemType,
        FlockId: si.FlockId,
        EggInventoryId: si.EggInventoryId,
        InventoryId: si.InventoryId,
        ReturnQuantity: retQty,
        UnitPrice: unitPrice,
        RefundAmount: lineRefund
      });

      // Restore returned stock
      if (si.ItemType === 'Egg' && si.EggInventoryId) {
        const { data: egg } = await supabase.from('EggInventories').select('Quantity').eq('Id', si.EggInventoryId).single();
        if (egg) {
          await supabase.from('EggInventories').update({ Quantity: (Number(egg.Quantity) || 0) + retQty }).eq('Id', si.EggInventoryId);
        }
      } else if (si.ItemType === 'Bird' && si.FlockId) {
        const { data: flk } = await supabase.from('Flocks').select('CurrentCount, Status').eq('Id', si.FlockId).single();
        if (flk) {
          await supabase.from('Flocks').update({ CurrentCount: (Number(flk.CurrentCount) || 0) + retQty, Status: 'Active' }).eq('Id', si.FlockId);
        }
      } else if (si.InventoryId) {
        const { data: inv } = await supabase.from('Inventories').select('CurrentStock').eq('Id', si.InventoryId).single();
        if (inv) {
          await supabase.from('Inventories').update({ CurrentStock: (Number(inv.CurrentStock) || 0) + retQty }).eq('Id', si.InventoryId);
        }
      }
    }

    const { data: sReturn, error: srErr } = await supabase.from('SaleReturns').insert([{
      SaleId: saleId,
      ReturnDate: returnDate || new Date().toISOString().split('T')[0],
      TotalReturnAmount: totalReturnAmount,
      Notes: notes || ''
    }]).select().single();

    if (srErr) throw srErr;

    for (const pr of processedReturns) {
      await supabase.from('SaleReturnItems').insert([{
        SaleReturnId: sReturn.Id,
        SaleItemId: pr.SaleItemId,
        ReturnQuantity: pr.ReturnQuantity,
        UnitPrice: pr.UnitPrice,
        RefundAmount: pr.RefundAmount
      }]);
    }

    // Adjust customer outstanding balance if applicable
    if (sale.CustomerId && totalReturnAmount > 0) {
      const { data: cust } = await supabase.from('Customers').select('CurrentCreditBalance').eq('Id', sale.CustomerId).single();
      if (cust) {
        const newBal = Math.max(0, (Number(cust.CurrentCreditBalance) || 0) - totalReturnAmount);
        await supabase.from('Customers').update({ CurrentCreditBalance: newBal }).eq('Id', sale.CustomerId);
      }
    }

    return sReturn;
  },

  async updateSale(farmId: number, saleId: number, saleData: any, items: any[]): Promise<any> {
    await this.deleteSale(farmId, saleId);
    return await this.createSale(farmId, saleData, items);
  }
};

// ==============================================================================
// 10. SETTINGS SERVICE
// ==============================================================================
export const settingsService = {
  async getSettings(farmId: number): Promise<any> {
    try {
      // 1. Try Supabase FarmSettings first for real-time cloud data
      const { data, error } = await supabase
        .from('FarmSettings')
        .select('*')
        .eq('FarmId', farmId)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch {}

    // 2. Try backend API with x-farm-id
    try {
      const res = await fetch('/api/settings', {
        headers: { 'x-farm-id': String(farmId) }
      });
      if (res.ok) {
        const localSettings = await res.json();
        if (localSettings && localSettings.FarmName) {
          return localSettings;
        }
      }
    } catch {}

    // 3. Fallback to Farms table
    try {
      const { data: farm } = await supabase.from('Farms').select('*').eq('Id', farmId).maybeSingle();
      if (farm) return farm;
    } catch {}

    return {};
  },

  async updateSettings(farmId: number, settingsData: any): Promise<any> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-farm-id': String(farmId)
      },
      body: JSON.stringify({ ...settingsData, FarmId: farmId })
    });
    return res.json();
  }
};

// ==============================================================================
// 11. FINANCE LEDGERS SERVICE
// ==============================================================================
export const financeService = {
  /**
   * Get all transactions for a farm with CategoryName and Attributions
   */
  async getTransactions(farmId: number): Promise<any[]> {
    const { data: txs, error } = await supabase
      .from('FinancialTransactions')
      .select('*')
      .eq('FarmId', farmId)
      .order('Date', { ascending: false });

    if (error) {
      console.error('[financeService.getTransactions] Error:', error.message);
      throw error;
    }
    if (!txs || txs.length === 0) return [];

    // Fetch categories
    const { data: categories } = await supabase
      .from('TransactionCategories')
      .select('Id, Name')
      .eq('FarmId', farmId);

    const catMap = new Map((categories || []).map((c: any) => [c.Id, c.Name]));

    // Fetch Customers and Suppliers for attribution names
    const { data: customers } = await supabase.from('Customers').select('Id, FullName').eq('FarmId', farmId);
    const { data: suppliers } = await supabase.from('Suppliers').select('Id, CompanyName').eq('FarmId', farmId);
    const { data: flocks } = await supabase.from('Flocks').select('Id, FlockName').eq('FarmId', farmId);

    const custMap = new Map((customers || []).map((c: any) => [c.Id, c.FullName]));
    const suppMap = new Map((suppliers || []).map((s: any) => [s.Id, s.CompanyName]));
    const flockMap = new Map((flocks || []).map((f: any) => [f.Id, f.FlockName]));

    return txs.map((t: any) => ({
      ...t,
      Amount: Number(t.Amount) || 0,
      CategoryName: catMap.get(t.CategoryId) || 'General Category',
      CustomerName: t.CustomerId ? custMap.get(t.CustomerId) : null,
      SupplierName: t.SupplierId ? suppMap.get(t.SupplierId) : null,
      FlockName: t.FlockId ? flockMap.get(t.FlockId) : null,
      PaymentMethod: t.PaymentMethod || 'Cash'
    }));
  },

  /**
   * Get transaction categories for a farm
   */
  async getCategories(farmId: number): Promise<TransactionCategory[]> {
    const { data, error } = await supabase
      .from('TransactionCategories')
      .select('*')
      .eq('FarmId', farmId)
      .order('Name', { ascending: true });

    if (error) {
      console.error('[financeService.getCategories] Error:', error.message);
      throw error;
    }
    return (data || []).map((c: any) => ({
      ...c,
      IsIncome: Boolean(c.IsIncome)
    }));
  },

  async createCategory(farmId: number, cData: Partial<TransactionCategory>): Promise<TransactionCategory> {
    const payload = {
      FarmId: farmId,
      Name: cData.Name || 'New Category',
      IsIncome: cData.IsIncome ? 1 : 0,
      Description: cData.Description || ''
    };

    const { data, error } = await supabase
      .from('TransactionCategories')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[financeService.createCategory] Error:', error.message);
      throw error;
    }
    return {
      ...data,
      IsIncome: Boolean(data.IsIncome)
    };
  },

  async updateCategory(farmId: number, id: number, cData: Partial<TransactionCategory>): Promise<TransactionCategory> {
    const updatePayload: any = { ...cData };
    delete updatePayload.Id;
    delete updatePayload.FarmId;
    if (updatePayload.IsIncome !== undefined) {
      updatePayload.IsIncome = updatePayload.IsIncome ? 1 : 0;
    }

    const { data, error } = await supabase
      .from('TransactionCategories')
      .update(updatePayload)
      .eq('Id', id)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[financeService.updateCategory] Error:', error.message);
      throw error;
    }
    return {
      ...data,
      IsIncome: Boolean(data.IsIncome)
    };
  },

  async deleteCategory(farmId: number, id: number): Promise<void> {
    const { error } = await supabase
      .from('TransactionCategories')
      .delete()
      .eq('Id', id)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[financeService.deleteCategory] Error:', error.message);
      throw error;
    }
  },

  async createTransaction(farmId: number, txData: any): Promise<any> {
    const payload = {
      FarmId: farmId,
      Date: txData.Date || new Date().toISOString().split('T')[0],
      Amount: Number(txData.Amount) || 0,
      Type: txData.Type || 'Expense',
      CategoryId: Number(txData.CategoryId),
      Notes: txData.Notes || '',
      FlockId: txData.FlockId ? Number(txData.FlockId) : null,
      EggInventoryId: txData.EggInventoryId ? Number(txData.EggInventoryId) : null,
      StaffId: txData.StaffId ? Number(txData.StaffId) : null,
      SupplierId: txData.SupplierId ? Number(txData.SupplierId) : null,
      CustomerId: txData.CustomerId ? Number(txData.CustomerId) : null,
      PaymentMethod: txData.PaymentMethod || 'Cash',
      Reference: txData.Reference || ''
    };

    const { data, error } = await supabase
      .from('FinancialTransactions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[financeService.createTransaction] Error:', error.message);
      throw error;
    }
    return data;
  },

  async updateTransaction(farmId: number, id: number, txData: any): Promise<any> {
    const updatePayload = {
      Date: txData.Date,
      Amount: Number(txData.Amount) || 0,
      Type: txData.Type,
      CategoryId: Number(txData.CategoryId),
      Notes: txData.Notes || '',
      FlockId: txData.FlockId ? Number(txData.FlockId) : null,
      EggInventoryId: txData.EggInventoryId ? Number(txData.EggInventoryId) : null,
      StaffId: txData.StaffId ? Number(txData.StaffId) : null,
      SupplierId: txData.SupplierId ? Number(txData.SupplierId) : null,
      CustomerId: txData.CustomerId ? Number(txData.CustomerId) : null,
      PaymentMethod: txData.PaymentMethod || 'Cash',
      Reference: txData.Reference || ''
    };

    const { data, error } = await supabase
      .from('FinancialTransactions')
      .update(updatePayload)
      .eq('Id', id)
      .eq('FarmId', farmId)
      .select()
      .single();

    if (error) {
      console.error('[financeService.updateTransaction] Error:', error.message);
      throw error;
    }
    return data;
  },

  async deleteTransaction(farmId: number, id: number): Promise<void> {
    const { error } = await supabase
      .from('FinancialTransactions')
      .delete()
      .eq('Id', id)
      .eq('FarmId', farmId);

    if (error) {
      console.error('[financeService.deleteTransaction] Error:', error.message);
      throw error;
    }
  }
};

// ==============================================================================
// 12. REPORTS & DASHBOARD SERVICE (Multi-Tenant by FarmId)
// ==============================================================================
export const reportsService = {
  /**
   * Fetch all database records for Reports Center filtered by FarmId
   */
  async getAllReportData(farmId: number): Promise<any> {
    try {
      const [
        flocksRes,
        dailyLogsRes,
        vaccinationsRes,
        inventoriesRes,
        eggInventoriesRes,
        customersRes,
        suppliersRes,
        purchasesRes,
        purchaseItemsRes,
        purchaseExtraExpensesRes,
        salesRes,
        saleItemsRes,
        recipesRes,
        recipeIngredientsRes,
        transactionsRes,
        categoriesRes,
        staffRes
      ] = await Promise.all([
        supabase.from('Flocks').select('*').eq('FarmId', farmId).order('Id', { ascending: true }),
        supabase.from('DailyLogs').select('*').eq('FarmId', farmId).order('LogDate', { ascending: true }),
        supabase.from('Vaccinations').select('*').eq('FarmId', farmId).order('Date', { ascending: true }),
        supabase.from('Inventories').select('*').eq('FarmId', farmId).order('Id', { ascending: true }),
        supabase.from('EggInventories').select('*').eq('FarmId', farmId).order('Id', { ascending: true }),
        supabase.from('Customers').select('*').eq('FarmId', farmId).order('FullName', { ascending: true }),
        supabase.from('Suppliers').select('*').eq('FarmId', farmId).order('CompanyName', { ascending: true }),
        supabase.from('Purchases').select('*').eq('FarmId', farmId).order('PurchaseDate', { ascending: true }),
        supabase.from('PurchaseItems').select('*'),
        supabase.from('PurchaseExtraExpenses').select('*'),
        supabase.from('Sales').select('*').eq('FarmId', farmId).order('SaleDate', { ascending: true }),
        supabase.from('SaleItems').select('*'),
        supabase.from('FoodRecipes').select('*').eq('FarmId', farmId).order('Id', { ascending: true }),
        supabase.from('RecipeIngredients').select('*'),
        supabase.from('FinancialTransactions').select('*').eq('FarmId', farmId).order('Date', { ascending: true }),
        supabase.from('TransactionCategories').select('*').eq('FarmId', farmId).order('Id', { ascending: true }),
        supabase.from('Staff').select('*').eq('FarmId', farmId).order('FullName', { ascending: true })
      ]);

      const purchases = purchasesRes.data || [];
      const sales = salesRes.data || [];
      const recipes = recipesRes.data || [];

      const purchaseIds = new Set(purchases.map((p: any) => p.Id));
      const saleIds = new Set(sales.map((s: any) => s.Id));
      const recipeIds = new Set(recipes.map((r: any) => r.Id));

      const filteredPurchaseItems = (purchaseItemsRes.data || []).filter((pi: any) => purchaseIds.has(pi.PurchaseId));
      const filteredPurchaseExtra = (purchaseExtraExpensesRes.data || []).filter((pe: any) => purchaseIds.has(pe.PurchaseId));
      const filteredSaleItems = (saleItemsRes.data || []).filter((si: any) => saleIds.has(si.SaleId));
      const filteredRecipeIngredients = (recipeIngredientsRes.data || []).filter((ri: any) => recipeIds.has(ri.RecipeId));

      if (flocksRes.data || purchases.length > 0 || sales.length > 0 || (dailyLogsRes.data && dailyLogsRes.data.length > 0)) {
        return {
          flocks: flocksRes.data || [],
          dailyLogs: dailyLogsRes.data || [],
          vaccinations: vaccinationsRes.data || [],
          inventories: inventoriesRes.data || [],
          eggInventories: eggInventoriesRes.data || [],
          customers: customersRes.data || [],
          suppliers: suppliersRes.data || [],
          purchases,
          purchaseItems: filteredPurchaseItems,
          purchaseExtraExpenses: filteredPurchaseExtra,
          sales,
          saleItems: filteredSaleItems,
          recipes,
          recipeIngredients: filteredRecipeIngredients,
          transactions: transactionsRes.data || [],
          categories: categoriesRes.data || [],
          staff: staffRes.data || []
        };
      }
    } catch (err: any) {
      console.warn('[reportsService.getAllReportData] Supabase error, falling back to API:', err.message);
    }

    const res = await fetch(`/api/reports/all-data?farmId=${farmId}`);
    if (!res.ok) throw new Error('Failed to retrieve system database assets.');
    return await res.json();
  },

  /**
   * Fetch real-time live KPI metrics and trend charts for Dashboard
   */
  async getDashboardData(farmId: number): Promise<{ stats: any; dailyLogTrend: any[]; financeTrend: any[] }> {
    try {
      const [
        flocksRes,
        eggInvRes,
        suppliersRes,
        customersRes,
        inventoryRes,
        txRes,
        dailyLogsRes,
        vaccinesRes
      ] = await Promise.all([
        supabase.from('Flocks').select('*').eq('FarmId', farmId),
        supabase.from('EggInventories').select('*').eq('FarmId', farmId),
        supabase.from('Suppliers').select('CurrentCreditBalance').eq('FarmId', farmId),
        supabase.from('Customers').select('CurrentCreditBalance').eq('FarmId', farmId),
        supabase.from('Inventories').select('*').eq('FarmId', farmId),
        supabase.from('FinancialTransactions').select('*').eq('FarmId', farmId),
        supabase.from('DailyLogs').select('*').eq('FarmId', farmId).order('LogDate', { ascending: true }),
        supabase.from('Vaccinations').select('Cost').eq('FarmId', farmId)
      ]);

      const flocks = flocksRes.data || [];
      const eggInvs = eggInvRes.data || [];
      const suppliers = suppliersRes.data || [];
      const customers = customersRes.data || [];
      const inventories = inventoryRes.data || [];
      const txs = txRes.data || [];
      const dailyLogs = dailyLogsRes.data || [];
      const vaccines = vaccinesRes.data || [];

      // 1. Total Active Birds
      const activeFlocks = flocks.filter((f: any) => f.Status === 'Active');
      const totalBirds = activeFlocks.reduce((sum: number, f: any) => sum + (Number(f.CurrentCount) || 0), 0);
      const totalInitialChicks = activeFlocks.reduce((sum: number, f: any) => sum + (Number(f.InitialCount) || 0), 0);

      // 2. Eggs Collected
      const freshEggs = eggInvs.filter((e: any) => e.GradeOrType === 'Fresh Eggs').reduce((sum: number, e: any) => sum + (Number(e.Quantity) || 0), 0);
      const damagedEggs = eggInvs.filter((e: any) => e.GradeOrType === 'Damaged/Waste Eggs').reduce((sum: number, e: any) => sum + (Number(e.Quantity) || 0), 0);

      // 3. Outstanding Balances
      const accountsPayable = suppliers.reduce((sum: number, s: any) => sum + (Number(s.CurrentCreditBalance) || 0), 0);
      const accountsReceivable = customers.reduce((sum: number, c: any) => sum + (Number(c.CurrentCreditBalance) || 0), 0);

      // 4. Low stock alerts
      const alerts = inventories
        .filter((inv: any) => Number(inv.CurrentStock) < Number(inv.MinThreshold))
        .map((inv: any) => ({
          ItemName: inv.ItemName,
          CurrentStock: Number(inv.CurrentStock) || 0,
          MinThreshold: Number(inv.MinThreshold) || 0,
          UnitOfMeasurement: inv.UnitOfMeasurement || 'Unit'
        }));

      // 5. Incomes vs Expenses
      const totalIncome = txs.filter((t: any) => t.Type === 'Income').reduce((sum: number, t: any) => sum + (Number(t.Amount) || 0), 0);
      const totalExpense = txs.filter((t: any) => t.Type === 'Expense').reduce((sum: number, t: any) => sum + (Number(t.Amount) || 0), 0);

      // 6. Laying Rate (HDP)
      const totalEggsLaid = dailyLogs.reduce((sum: number, l: any) => sum + (Number(l.EggsCollected) || 0) + (Number(l.DamagedEggsCollected) || 0), 0);
      let laymanRatePercentage = 0;
      if (totalInitialChicks > 0) {
        const daysCount = Math.max(1, Math.min(30, dailyLogs.length));
        laymanRatePercentage = Math.min(100, Math.max(0, (totalEggsLaid / (totalInitialChicks * daysCount)) * 100));
      }

      // 7. Per Egg Cost calculations
      const totalFlockPurchase = flocks.reduce((sum: number, f: any) => sum + (Number(f.TotalPurchasePrice) || 0), 0);
      const totalFeedCost = flocks.reduce((sum: number, f: any) => sum + (Number(f.TotalFeedCost) || 0), 0);
      const totalVaccineCost = vaccines.reduce((sum: number, v: any) => sum + (Number(v.Cost) || 0), 0);
      const totalExpensesAccruedBase = totalFlockPurchase + totalFeedCost + totalVaccineCost;

      const finalExpensesAccrued = Math.max(totalExpensesAccruedBase, totalExpense);
      const netExpensesAccrued = Math.max(0, finalExpensesAccrued - totalIncome);
      const averageEggProductionCost = totalEggsLaid > 0 ? (netExpensesAccrued / totalEggsLaid) : 0;

      // 8. Trends
      const dailyLogTrend = dailyLogs
        .slice(-10)
        .map((log: any) => ({
          date: (log.LogDate || '').split('T')[0],
          'Eggs Collected': Number(log.EggsCollected) || 0,
          'Feed Consumed (Kg)': Number(log.FeedConsumedKg) || 0
        }));

      const graphMap: { [date: string]: { Income: number; Expense: number } } = {};
      txs.forEach((tx: any) => {
        const d = (tx.Date || '').split('T')[0];
        if (!graphMap[d]) graphMap[d] = { Income: 0, Expense: 0 };
        if (tx.Type === 'Income') graphMap[d].Income += Number(tx.Amount || 0);
        else graphMap[d].Expense += Number(tx.Amount || 0);
      });

      const financeTrend = Object.keys(graphMap).sort().map(date => ({
        date,
        Income: graphMap[date].Income,
        Expense: graphMap[date].Expense
      })).slice(-10);

      return {
        stats: {
          totalBirds,
          freshCount: freshEggs,
          damagedCount: damagedEggs,
          accountsPayable,
          accountsReceivable,
          totalIncome,
          totalExpense,
          alerts,
          laymanRatePercentage,
          averageEggProductionCost
        },
        dailyLogTrend,
        financeTrend
      };
    } catch (err: any) {
      console.warn('[reportsService.getDashboardData] Falling back to backend API:', err.message);
      const res = await fetch(`/api/dashboard?farmId=${farmId}`);
      if (!res.ok) throw new Error('Failed to retrieve dashboard data');
      const stats = await res.json();
      return { stats, dailyLogTrend: [], financeTrend: [] };
    }
  }
};

