import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { query } from './db.js';
import { decrypt } from './backups.js';
import { supabaseServer } from './supabase.js';

/**
 * Validates whether the incoming request was authored by a Developer (SuperAdmin).
 */
function isDeveloper(req: any): boolean {
  const role = req.headers['x-user-role'] || req.headers['x-role'] || req.query.role;
  return role === 'Developer';
}

/**
 * Standardized data container for legacy tables
 */
interface LegacyTableMap {
  [tableName: string]: any[];
}

/**
 * Extract tables and records from whatever format the user supplied:
 * 1. Encrypted backup JSON ({ encrypted: true, data: "..." })
 * 2. Plain backup JSON ({ tables: [ { name: "...", rows: [...] } ] } or { version, tables })
 * 3. Key-value table object ({ Flocks: [...], DailyLogs: [...] })
 * 4. Raw SQLite binary uploaded as Base64 ({ fileBase64: "..." })
 */
async function parseLegacyInput(body: any): Promise<LegacyTableMap> {
  const tablesMap: LegacyTableMap = {};

  // Case 1: Base64-encoded SQLite Database file (.db / .sqlite)
  if (body && (body.fileBase64 || body.sqliteBase64)) {
    const b64 = body.fileBase64 || body.sqliteBase64;
    const cleanB64 = b64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanB64, 'base64');

    const tempFilePath = path.join(os.tmpdir(), `legacy_migration_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);
    fs.writeFileSync(tempFilePath, buffer);

    try {
      const legacyDb = new sqlite3.Database(tempFilePath);
      
      const tables: any[] = await new Promise((resolve, reject) => {
        legacyDb.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      for (const t of tables) {
        const rows: any[] = await new Promise((resolve, reject) => {
          legacyDb.all(`SELECT * FROM \`${t.name}\``, (err, r) => {
            if (err) reject(err);
            else resolve(r || []);
          });
        });
        tablesMap[t.name] = rows;
      }

      await new Promise<void>((resolve) => {
        legacyDb.close(() => resolve());
      });
    } finally {
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }

    return tablesMap;
  }

  // Case 2: Encrypted backup JSON format
  let backupPayload = body;
  if (body && body.data && body.encrypted === true) {
    const key = process.env.BACKUP_ENCRYPTION_KEY || 'PoultryLMS360SecureDefaultBackupKey_2026';
    const decryptedStr = decrypt(body.data, key);
    backupPayload = JSON.parse(decryptedStr);
  } else if (body && body.backupJson) {
    backupPayload = body.backupJson;
  }

  // Case 3: Standard table array { tables: [ { name, rows } ] }
  if (backupPayload && Array.isArray(backupPayload.tables)) {
    for (const t of backupPayload.tables) {
      if (t && t.name && Array.isArray(t.rows)) {
        tablesMap[t.name] = t.rows;
      }
    }
    return tablesMap;
  }

  // Case 4: Key-value map of table names to row arrays
  if (backupPayload && typeof backupPayload === 'object') {
    for (const key of Object.keys(backupPayload)) {
      if (Array.isArray(backupPayload[key])) {
        tablesMap[key] = backupPayload[key];
      }
    }
    if (Object.keys(tablesMap).length > 0) {
      return tablesMap;
    }
  }

  throw new Error('Unsupported or unrecognizable backup format. Please provide a valid Poultry LMS backup JSON or SQLite .db file.');
}

/**
 * Controller suite for Developer-only Legacy to Multi-Farm Migration
 */
export const migrationControllers = {
  /**
   * POST /api/migration/analyze
   * Inspects a legacy backup without making any changes to the database.
   */
  async analyzeLegacyBackup(req: any, res: any) {
    try {
      // 1. Role-based access check
      if (!isDeveloper(req)) {
        return res.status(403).json({
          error: 'Access denied: Legacy Multi-Farm Migration is restricted exclusively to Developer (SuperAdmin).'
        });
      }

      const tablesMap = await parseLegacyInput(req.body);

      // Collect summary statistics
      const tableSummary: { name: string; count: number }[] = [];
      let totalRecords = 0;

      for (const [tName, rows] of Object.entries(tablesMap)) {
        // Exclude internal SQLite tables or session tables
        if (['sqlite_sequence', 'AuditLogs', 'JavascriptErrors'].includes(tName)) continue;
        tableSummary.push({ name: tName, count: rows.length });
        totalRecords += rows.length;
      }

      // Detailed domain metrics
      const flocks = tablesMap['Flocks'] || [];
      const dailyLogs = tablesMap['DailyLogs'] || [];
      const inventories = tablesMap['Inventories'] || [];
      const customers = tablesMap['Customers'] || [];
      const suppliers = tablesMap['Suppliers'] || [];
      const purchases = tablesMap['Purchases'] || [];
      const sales = tablesMap['Sales'] || [];
      const transactions = tablesMap['FinancialTransactions'] || [];
      const vaccinations = tablesMap['Vaccinations'] || [];
      const recipes = tablesMap['FoodRecipes'] || [];

      // Calculate date span across logs and transactions
      const dates: string[] = [];
      dailyLogs.forEach((l: any) => { if (l.LogDate) dates.push(l.LogDate); });
      transactions.forEach((tx: any) => { if (tx.Date) dates.push(tx.Date); });
      sales.forEach((s: any) => { if (s.SaleDate) dates.push(s.SaleDate); });
      purchases.forEach((p: any) => { if (p.PurchaseDate) dates.push(p.PurchaseDate); });
      dates.sort();

      const earliestDate = dates[0] || 'N/A';
      const latestDate = dates[dates.length - 1] || 'N/A';

      // Integrity checks
      const integrityIssues: string[] = [];
      const flockIds = new Set(flocks.map((f: any) => f.Id));
      
      const orphanedLogs = dailyLogs.filter((l: any) => l.FlockId && !flockIds.has(l.FlockId)).length;
      if (orphanedLogs > 0) {
        integrityIssues.push(`${orphanedLogs} daily log records point to flock IDs not present in Flocks table.`);
      }

      const custIds = new Set(customers.map((c: any) => c.Id));
      const orphanedSales = sales.filter((s: any) => s.CustomerId && !custIds.has(s.CustomerId)).length;
      if (orphanedSales > 0) {
        integrityIssues.push(`${orphanedSales} sales invoices point to customer IDs not present in Customers table.`);
      }

      res.json({
        success: true,
        summary: {
          totalRecords,
          flocksCount: flocks.length,
          flockNames: flocks.map((f: any) => f.FlockName || `Flock #${f.Id}`),
          dailyLogsCount: dailyLogs.length,
          inventoriesCount: inventories.length,
          customersCount: customers.length,
          suppliersCount: suppliers.length,
          purchasesCount: purchases.length,
          salesCount: sales.length,
          financialTransactionsCount: transactions.length,
          vaccinationsCount: vaccinations.length,
          recipesCount: recipes.length,
          dateRange: { earliest: earliestDate, latest: latestDate },
          tableSummary: tableSummary.sort((a, b) => b.count - a.count),
          integrityIssues
        }
      });
    } catch (err: any) {
      console.error('[Migration Controller] Error analyzing backup:', err);
      res.status(400).json({ error: err.message || 'Failed to analyze legacy backup file.' });
    }
  },

  /**
   * POST /api/migration/execute
   * Migrates legacy records into the designated target FarmId with foreign key remapping.
   */
  async executeMigration(req: any, res: any) {
    const startTime = Date.now();
    try {
      // 1. Role-based access check
      if (!isDeveloper(req)) {
        return res.status(403).json({
          error: 'Access denied: Legacy Multi-Farm Migration is restricted exclusively to Developer (SuperAdmin).'
        });
      }

      const { targetFarmId, mode = 'merge' } = req.body;
      const farmId = parseInt(targetFarmId, 10);

      if (!farmId || isNaN(farmId)) {
        return res.status(400).json({ error: 'Valid Target FarmId is required for migration.' });
      }

      // Verify that target farm exists
      let targetFarm: any = null;
      try {
        const { data: farmData } = await supabaseServer.from('Farms').select('*').eq('Id', farmId).single();
        targetFarm = farmData;
      } catch (e) {}

      if (!targetFarm) {
        targetFarm = await query.get('SELECT * FROM Farms WHERE Id = ?', [farmId]);
      }

      if (!targetFarm) {
        return res.status(404).json({ error: `Target Farm with ID #${farmId} does not exist.` });
      }

      const tablesMap = await parseLegacyInput(req.body);

      // Mode: If 'replace_farm_data', delete old records strictly for this FarmId
      if (mode === 'replace_farm_data') {
        const tablesToClear = [
          'DailyLogs', 'Vaccinations', 'SaleReturnItems', 'SaleReturns',
          'SaleItems', 'Sales', 'PurchaseReturnItems', 'PurchaseReturns',
          'PurchaseExtraExpenses', 'PurchaseItems', 'Purchases',
          'FeedProductionLogs', 'RecipeIngredients', 'FoodRecipes',
          'FinancialTransactions', 'EggInventories', 'Inventories',
          'Flocks', 'Customers', 'Suppliers', 'TransactionCategories'
        ];

        for (const tbl of tablesToClear) {
          try {
            await query.run(`DELETE FROM ${tbl} WHERE FarmId = ?`, [farmId]);
            if (supabaseServer) {
              await supabaseServer.from(tbl).delete().eq('FarmId', farmId);
            }
          } catch (delErr: any) {
            console.warn(`[Migration] Clean table warning on ${tbl}:`, delErr.message);
          }
        }
      }

      // ID Mapping dictionaries
      const flockIdMap = new Map<number, number>();
      const invIdMap = new Map<number, number>();
      const eggInvIdMap = new Map<number, number>();
      const customerIdMap = new Map<number, number>();
      const supplierIdMap = new Map<number, number>();
      const purchaseIdMap = new Map<number, number>();
      const saleIdMap = new Map<number, number>();
      const recipeIdMap = new Map<number, number>();
      const categoryIdMap = new Map<number, number>();

      const migrationStats: Record<string, number> = {};

      // Dynamic table column introspection cache
      const tableColumnsCache = new Map<string, Set<string>>();
      const getTableColumns = async (tableName: string): Promise<Set<string>> => {
        if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName)!;
        try {
          const info = await query.all(`PRAGMA table_info(\`${tableName}\`)`);
          const set = new Set<string>(info.map((c: any) => c.name));
          tableColumnsCache.set(tableName, set);
          return set;
        } catch {
          return new Set<string>();
        }
      };

      // Helper function to insert a row into local SQLite and Supabase safely
      const insertRecord = async (tableName: string, rowData: any): Promise<number> => {
        // Strip legacy primary key Id for insertion
        const { Id, ...rawPayload } = rowData;
        const dataToInsert: any = { ...rawPayload };

        // Normalize legacy schema variations
        if (tableName === 'Flocks') {
          if (dataToInsert.TotalBirds && !dataToInsert.InitialCount) {
            dataToInsert.InitialCount = dataToInsert.TotalBirds;
          }
          if (dataToInsert.InitialCount && !dataToInsert.CurrentCount) {
            dataToInsert.CurrentCount = dataToInsert.InitialCount;
          }
          if (!dataToInsert.Breed) dataToInsert.Breed = 'Commercial Layer';
          if (!dataToInsert.ArrivalDate) {
            dataToInsert.ArrivalDate = dataToInsert.StartDate || new Date().toISOString().split('T')[0];
          }
          if (!dataToInsert.StartDate) dataToInsert.StartDate = dataToInsert.ArrivalDate;
          if (dataToInsert.TotalPurchasePrice === undefined) dataToInsert.TotalPurchasePrice = 0;
          if (!dataToInsert.Status) dataToInsert.Status = 'Active';
        } else if (tableName === 'Inventories') {
          if (!dataToInsert.Category) dataToInsert.Category = 'Feed';
          if (!dataToInsert.Unit) dataToInsert.Unit = 'Kg';
        } else if (tableName === 'DailyLogs') {
          if (!dataToInsert.LogDate) dataToInsert.LogDate = new Date().toISOString().split('T')[0];
        }

        // Filter data to only columns physically existing in the target table
        const validCols = await getTableColumns(tableName);
        const filteredData: Record<string, any> = {};
        for (const [k, v] of Object.entries(dataToInsert)) {
          if (validCols.has(k)) {
            filteredData[k] = v;
          }
        }
        filteredData.FarmId = farmId;

        // 1. Insert into local SQLite
        const keys = Object.keys(filteredData);
        const columns = keys.map(k => `\`${k}\``).join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => filteredData[k]);

        const resLocal = await query.run(
          `INSERT INTO \`${tableName}\` (${columns}) VALUES (${placeholders})`,
          values
        );
        const newId = resLocal.lastID;

        // 2. Sync to Supabase Cloud if available
        try {
          if (supabaseServer) {
            await supabaseServer.from(tableName).insert([{ ...filteredData, Id: newId }]);
          }
        } catch (sbErr: any) {
          // Log but don't halt migration if single cloud sync fails
          console.warn(`[Migration SB Sync] Table ${tableName}:`, sbErr.message);
        }

        return newId;
      };

      // 1. Migrate Flocks
      const flocks = tablesMap['Flocks'] || [];
      for (const flock of flocks) {
        const oldId = flock.Id;
        const newId = await insertRecord('Flocks', flock);
        if (oldId) flockIdMap.set(oldId, newId);
      }
      migrationStats['Flocks'] = flocks.length;

      // 2. Migrate Inventories
      const inventories = tablesMap['Inventories'] || [];
      for (const inv of inventories) {
        const oldId = inv.Id;
        const newId = await insertRecord('Inventories', inv);
        if (oldId) invIdMap.set(oldId, newId);
      }
      migrationStats['Inventories'] = inventories.length;

      // 3. Migrate EggInventories
      const eggInventories = tablesMap['EggInventories'] || [];
      for (const egg of eggInventories) {
        const oldId = egg.Id;
        const mappedEgg = { ...egg };
        if (mappedEgg.FlockId && flockIdMap.has(mappedEgg.FlockId)) {
          mappedEgg.FlockId = flockIdMap.get(mappedEgg.FlockId);
        }
        const newId = await insertRecord('EggInventories', mappedEgg);
        if (oldId) eggInvIdMap.set(oldId, newId);
      }
      migrationStats['EggInventories'] = eggInventories.length;

      // 4. Migrate Customers
      const customers = tablesMap['Customers'] || [];
      for (const cust of customers) {
        const oldId = cust.Id;
        const newId = await insertRecord('Customers', cust);
        if (oldId) customerIdMap.set(oldId, newId);
      }
      migrationStats['Customers'] = customers.length;

      // 5. Migrate Suppliers
      const suppliers = tablesMap['Suppliers'] || [];
      for (const supp of suppliers) {
        const oldId = supp.Id;
        const newId = await insertRecord('Suppliers', supp);
        if (oldId) supplierIdMap.set(oldId, newId);
      }
      migrationStats['Suppliers'] = suppliers.length;

      // 6. Migrate DailyLogs
      const dailyLogs = tablesMap['DailyLogs'] || [];
      for (const log of dailyLogs) {
        const mappedLog = { ...log };
        if (mappedLog.FlockId && flockIdMap.has(mappedLog.FlockId)) {
          mappedLog.FlockId = flockIdMap.get(mappedLog.FlockId);
        }
        if (mappedLog.FeedItemId && invIdMap.has(mappedLog.FeedItemId)) {
          mappedLog.FeedItemId = invIdMap.get(mappedLog.FeedItemId);
        }
        await insertRecord('DailyLogs', mappedLog);
      }
      migrationStats['DailyLogs'] = dailyLogs.length;

      // 7. Migrate Vaccinations
      const vaccinations = tablesMap['Vaccinations'] || [];
      for (const vac of vaccinations) {
        const mappedVac = { ...vac };
        if (mappedVac.FlockId && flockIdMap.has(mappedVac.FlockId)) {
          mappedVac.FlockId = flockIdMap.get(mappedVac.FlockId);
        }
        await insertRecord('Vaccinations', mappedVac);
      }
      migrationStats['Vaccinations'] = vaccinations.length;

      // 8. Migrate Purchases & PurchaseItems
      const purchases = tablesMap['Purchases'] || [];
      for (const pur of purchases) {
        const oldId = pur.Id;
        const mappedPur = { ...pur };
        if (mappedPur.SupplierId && supplierIdMap.has(mappedPur.SupplierId)) {
          mappedPur.SupplierId = supplierIdMap.get(mappedPur.SupplierId);
        }
        const newId = await insertRecord('Purchases', mappedPur);
        if (oldId) purchaseIdMap.set(oldId, newId);
      }
      migrationStats['Purchases'] = purchases.length;

      const purchaseItems = tablesMap['PurchaseItems'] || [];
      for (const pi of purchaseItems) {
        const mappedPi = { ...pi };
        if (mappedPi.PurchaseId && purchaseIdMap.has(mappedPi.PurchaseId)) {
          mappedPi.PurchaseId = purchaseIdMap.get(mappedPi.PurchaseId);
        }
        if (mappedPi.InventoryId && invIdMap.has(mappedPi.InventoryId)) {
          mappedPi.InventoryId = invIdMap.get(mappedPi.InventoryId);
        }
        await insertRecord('PurchaseItems', mappedPi);
      }
      migrationStats['PurchaseItems'] = purchaseItems.length;

      const purchaseExtraExpenses = tablesMap['PurchaseExtraExpenses'] || [];
      for (const pe of purchaseExtraExpenses) {
        const mappedPe = { ...pe };
        if (mappedPe.PurchaseId && purchaseIdMap.has(mappedPe.PurchaseId)) {
          mappedPe.PurchaseId = purchaseIdMap.get(mappedPe.PurchaseId);
        }
        await insertRecord('PurchaseExtraExpenses', mappedPe);
      }

      // 9. Migrate Sales & SaleItems
      const sales = tablesMap['Sales'] || [];
      for (const sale of sales) {
        const oldId = sale.Id;
        const mappedSale = { ...sale };
        if (mappedSale.CustomerId && customerIdMap.has(mappedSale.CustomerId)) {
          mappedSale.CustomerId = customerIdMap.get(mappedSale.CustomerId);
        }
        const newId = await insertRecord('Sales', mappedSale);
        if (oldId) saleIdMap.set(oldId, newId);
      }
      migrationStats['Sales'] = sales.length;

      const saleItems = tablesMap['SaleItems'] || [];
      for (const si of saleItems) {
        const mappedSi = { ...si };
        if (mappedSi.SaleId && saleIdMap.has(mappedSi.SaleId)) {
          mappedSi.SaleId = saleIdMap.get(mappedSi.SaleId);
        }
        if (mappedSi.FlockId && flockIdMap.has(mappedSi.FlockId)) {
          mappedSi.FlockId = flockIdMap.get(mappedSi.FlockId);
        }
        if (mappedSi.InventoryId && invIdMap.has(mappedSi.InventoryId)) {
          mappedSi.InventoryId = invIdMap.get(mappedSi.InventoryId);
        }
        if (mappedSi.EggInventoryId && eggInvIdMap.has(mappedSi.EggInventoryId)) {
          mappedSi.EggInventoryId = eggInvIdMap.get(mappedSi.EggInventoryId);
        }
        await insertRecord('SaleItems', mappedSi);
      }
      migrationStats['SaleItems'] = saleItems.length;

      // 10. Migrate Food Recipes & Ingredients
      const foodRecipes = tablesMap['FoodRecipes'] || [];
      for (const rec of foodRecipes) {
        const oldId = rec.Id;
        const mappedRec = { ...rec };
        if (mappedRec.TargetFeedItemId && invIdMap.has(mappedRec.TargetFeedItemId)) {
          mappedRec.TargetFeedItemId = invIdMap.get(mappedRec.TargetFeedItemId);
        }
        const newId = await insertRecord('FoodRecipes', mappedRec);
        if (oldId) recipeIdMap.set(oldId, newId);
      }
      migrationStats['FoodRecipes'] = foodRecipes.length;

      const recipeIngredients = tablesMap['RecipeIngredients'] || [];
      for (const ri of recipeIngredients) {
        const mappedRi = { ...ri };
        if (mappedRi.RecipeId && recipeIdMap.has(mappedRi.RecipeId)) {
          mappedRi.RecipeId = recipeIdMap.get(mappedRi.RecipeId);
        }
        if (mappedRi.InventoryId && invIdMap.has(mappedRi.InventoryId)) {
          mappedRi.InventoryId = invIdMap.get(mappedRi.InventoryId);
        }
        await insertRecord('RecipeIngredients', mappedRi);
      }

      const feedProductionLogs = tablesMap['FeedProductionLogs'] || [];
      for (const fpl of feedProductionLogs) {
        const mappedFpl = { ...fpl };
        if (mappedFpl.RecipeId && recipeIdMap.has(mappedFpl.RecipeId)) {
          mappedFpl.RecipeId = recipeIdMap.get(mappedFpl.RecipeId);
        }
        if (mappedFpl.TargetFeedItemId && invIdMap.has(mappedFpl.TargetFeedItemId)) {
          mappedFpl.TargetFeedItemId = invIdMap.get(mappedFpl.TargetFeedItemId);
        }
        await insertRecord('FeedProductionLogs', mappedFpl);
      }

      // 11. Migrate TransactionCategories & FinancialTransactions
      const categories = tablesMap['TransactionCategories'] || [];
      for (const cat of categories) {
        const oldId = cat.Id;
        const newId = await insertRecord('TransactionCategories', cat);
        if (oldId) categoryIdMap.set(oldId, newId);
      }

      const transactions = tablesMap['FinancialTransactions'] || [];
      for (const tx of transactions) {
        const mappedTx = { ...tx };
        if (mappedTx.CategoryId && categoryIdMap.has(mappedTx.CategoryId)) {
          mappedTx.CategoryId = categoryIdMap.get(mappedTx.CategoryId);
        }
        if (mappedTx.CustomerId && customerIdMap.has(mappedTx.CustomerId)) {
          mappedTx.CustomerId = customerIdMap.get(mappedTx.CustomerId);
        }
        if (mappedTx.SupplierId && supplierIdMap.has(mappedTx.SupplierId)) {
          mappedTx.SupplierId = supplierIdMap.get(mappedTx.SupplierId);
        }
        if (mappedTx.FlockId && flockIdMap.has(mappedTx.FlockId)) {
          mappedTx.FlockId = flockIdMap.get(mappedTx.FlockId);
        }
        await insertRecord('FinancialTransactions', mappedTx);
      }
      migrationStats['FinancialTransactions'] = transactions.length;

      // 12. Create an audit log record
      const totalMigrated = Object.values(migrationStats).reduce((a, b) => a + b, 0);
      try {
        await query.run(
          `INSERT INTO AuditLogs (Action, EntityName, Details, Timestamp) VALUES (?, ?, ?, ?)`,
          [
            'LEGACY_MIGRATION',
            'FarmTenant',
            `Developer executed Legacy Single-Farm to Multi-Farm migration into Farm #${farmId} (${targetFarm.FarmName}). Migrated ${totalMigrated} total records.`,
            new Date().toISOString()
          ]
        );
      } catch (auditErr) {}

      const durationMs = Date.now() - startTime;

      res.json({
        success: true,
        message: `Successfully migrated legacy single-farm database into Farm #${farmId} (${targetFarm.FarmName})!`,
        targetFarm: {
          id: farmId,
          name: targetFarm.FarmName,
          owner: targetFarm.OwnerName
        },
        durationMs,
        stats: migrationStats,
        totalMigrated
      });
    } catch (err: any) {
      console.error('[Migration Controller] Error executing migration:', err);
      res.status(500).json({ error: err.message || 'Legacy database migration failed.' });
    }
  }
};
