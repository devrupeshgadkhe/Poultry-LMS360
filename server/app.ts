import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, query } from './db.js';
import {
  authControllers,
  inventoryControllers,
  flockControllers,
  dailyLogsControllers,
  vaccinationControllers,
  customerControllers,
  supplierControllers,
  purchaseControllers,
  salesControllers,
  recipeControllers,
  staffControllers,
  ledgerControllers,
  sysDashboardControllers
} from './controllers.js';
import { backupControllers } from './backups.js';
import { settingsControllers, userManagementControllers } from './settingsControllers.js';
import { bulkImportControllers } from './bulkImportControllers.js';
import { migrationControllers } from './migrationControllers.js';
import { getSupabaseFarms, createSupabaseFarm, syncSupabaseToLocal, syncAllTablesBidirectional } from './supabase.js';

let dbInitPromise: Promise<void> | null = null;

export function ensureDatabaseInitialized(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        console.log('[App Init] Initializing database...');
        await initializeDatabase();
        console.log('[App Init] Database initialization complete.');
        // Synchronize Supabase Cloud operational tables with local SQLite
        await syncAllTablesBidirectional();
        // Run background biological flock aging check
        await settingsControllers.backgroundSyncAges();
      } catch (err) {
        console.error('[App Init] Database initialization warning:', err);
      }
    })();
  }
  return dbInitPromise;
}

const app = express();

// Standard middleware
app.use(express.json({ limit: '50mb' }));

// CORS headers support (safe for Vercel, web, and Electron)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-email');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy DB initialization guard for serverless environments
app.use(async (req, res, next) => {
  try {
    await ensureDatabaseInitialized();
  } catch (err) {
    console.error('Database pre-flight check error:', err);
  }
  next();
});

// Serve uploads folder statically if present
const uploadsPath = path.join(process.cwd(), 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// Create dedicated API Router
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 1. Auth Endpoint Block
apiRouter.post('/auth/login', authControllers.login);
apiRouter.post('/auth/register', authControllers.register);

// 2. Inventories Category Block
apiRouter.get('/inventories', inventoryControllers.list);
apiRouter.post('/inventories', inventoryControllers.create);
apiRouter.put('/inventories/:id', inventoryControllers.update);
apiRouter.delete('/inventories/:id', inventoryControllers.delete);

// Egg Inventories
apiRouter.get('/egg_inventories', async (req, res) => {
  try {
    const eggs = await query.all('SELECT * FROM EggInventories');
    res.json(eggs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Flocks Register Block
apiRouter.get('/flocks', flockControllers.list);
apiRouter.post('/flocks', flockControllers.create);
apiRouter.put('/flocks/:id', flockControllers.update);
apiRouter.delete('/flocks/:id', flockControllers.delete);

// 4. Daily Logs Core Block
apiRouter.get('/daily_logs', dailyLogsControllers.list);
apiRouter.post('/daily_logs', dailyLogsControllers.create);
apiRouter.put('/daily_logs/:id', dailyLogsControllers.update);
apiRouter.delete('/daily_logs/:id', dailyLogsControllers.delete);

// 5. Healthcare Vaccinations Block
apiRouter.get('/vaccinations', vaccinationControllers.list);
apiRouter.post('/vaccinations', vaccinationControllers.create);
apiRouter.put('/vaccinations/:id', vaccinationControllers.update);
apiRouter.delete('/vaccinations/:id', vaccinationControllers.delete);

// 6. Stakeholders Register Block
// Customers
apiRouter.get('/customers', customerControllers.list);
apiRouter.post('/customers', customerControllers.create);
apiRouter.put('/customers/:id', customerControllers.update);
apiRouter.delete('/customers/:id', customerControllers.delete);

// Suppliers
apiRouter.get('/suppliers', supplierControllers.list);
apiRouter.post('/suppliers', supplierControllers.create);
apiRouter.put('/suppliers/:id', supplierControllers.update);
apiRouter.delete('/suppliers/:id', supplierControllers.delete);

// 7. Operations Billing Block
// Purchases (Supplier Purchase Desk)
apiRouter.get('/purchases', purchaseControllers.list);
apiRouter.get('/purchases/:id', purchaseControllers.getDetails);
apiRouter.post('/purchases', purchaseControllers.create);
apiRouter.put('/purchases/:id', purchaseControllers.update);
apiRouter.delete('/purchases/:id', purchaseControllers.delete);
apiRouter.post('/purchases/:id/return', purchaseControllers.returnPurchase);

// Sales (POS Customer Sales Billing Desk)
apiRouter.get('/sales', salesControllers.list);
apiRouter.get('/sales/:id', salesControllers.getDetails);
apiRouter.post('/sales', salesControllers.create);
apiRouter.put('/sales/:id', salesControllers.update);
apiRouter.delete('/sales/:id', salesControllers.delete);
apiRouter.post('/sales/:id/return', salesControllers.returnSale);

// 8. Milling Room Feed recipes Block
apiRouter.get('/recipes', recipeControllers.listRecipes);
apiRouter.get('/recipes/production-logs', recipeControllers.getProductionLogs);
apiRouter.post('/recipes', recipeControllers.createRecipe);
apiRouter.delete('/recipes/:id', recipeControllers.deleteRecipe);
apiRouter.post('/recipes/:id/mill', recipeControllers.executeMill);

// 9. HR Attendances & Payroll Block
apiRouter.get('/staff', staffControllers.list);
apiRouter.post('/staff', staffControllers.create);
apiRouter.put('/staff/:id', staffControllers.update);
apiRouter.delete('/staff/:id', staffControllers.delete);
apiRouter.get('/staff/attendance', staffControllers.listAttendance);
apiRouter.post('/staff/attendance', staffControllers.submitAttendance);
apiRouter.delete('/staff/attendance/:id', staffControllers.deleteAttendance);

apiRouter.get('/staff/holidays', staffControllers.listHolidays);
apiRouter.post('/staff/holidays', staffControllers.createHoliday);
apiRouter.delete('/staff/holidays/:id', staffControllers.deleteHoliday);

apiRouter.get('/staff/payroll', staffControllers.listPayroll);
apiRouter.post('/staff/payroll/calculate', staffControllers.calculatePayroll);
apiRouter.post('/staff/payroll', staffControllers.savePayroll);
apiRouter.put('/staff/payroll/:id', staffControllers.updatePayroll);
apiRouter.delete('/staff/payroll/:id', staffControllers.deletePayroll);
apiRouter.post('/staff/payroll/:id/disburse', staffControllers.disbursePayroll);

// 10. General Financial Ledgers Setup
apiRouter.get('/ledgers/categories', ledgerControllers.listCategories);
apiRouter.post('/ledgers/categories', ledgerControllers.createCategory);
apiRouter.put('/ledgers/categories/:id', ledgerControllers.updateCategory);
apiRouter.delete('/ledgers/categories/:id', ledgerControllers.deleteCategory);
apiRouter.get('/ledgers/transactions', ledgerControllers.listTransactions);
apiRouter.post('/ledgers/transactions', ledgerControllers.createTransaction);
apiRouter.put('/ledgers/transactions/:id', ledgerControllers.updateTransaction);
apiRouter.delete('/ledgers/transactions/:id', ledgerControllers.deleteTransaction);

// 11. Dashboard Analytics & Logs Tracker
apiRouter.get('/reports/all-data', async (req, res) => {
  try {
    const flocks = await query.all('SELECT * FROM Flocks');
    const dailyLogs = await query.all('SELECT * FROM DailyLogs ORDER BY LogDate ASC');
    const vaccinations = await query.all('SELECT * FROM Vaccinations ORDER BY Date ASC');
    const inventories = await query.all('SELECT * FROM Inventories');
    const eggInventories = await query.all('SELECT * FROM EggInventories');
    const customers = await query.all('SELECT * FROM Customers');
    const suppliers = await query.all('SELECT * FROM Suppliers');
    const purchases = await query.all('SELECT * FROM Purchases ORDER BY PurchaseDate ASC');
    const purchaseItems = await query.all('SELECT * FROM PurchaseItems');
    const purchaseExtraExpenses = await query.all('SELECT * FROM PurchaseExtraExpenses');
    const sales = await query.all('SELECT * FROM Sales ORDER BY SaleDate ASC');
    const saleItems = await query.all('SELECT * FROM SaleItems');
    const recipes = await query.all('SELECT * FROM FoodRecipes');
    const recipeIngredients = await query.all('SELECT * FROM RecipeIngredients');
    const transactions = await query.all('SELECT * FROM FinancialTransactions ORDER BY Date ASC');
    const categories = await query.all('SELECT * FROM TransactionCategories');
    const staff = await query.all('SELECT * FROM Staff');

    res.json({
      flocks,
      dailyLogs,
      vaccinations,
      inventories,
      eggInventories,
      customers,
      suppliers,
      purchases,
      purchaseItems,
      purchaseExtraExpenses,
      sales,
      saleItems,
      recipes,
      recipeIngredients,
      transactions,
      categories,
      staff
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.get('/dashboard', sysDashboardControllers.getDashboardData);
apiRouter.get('/audit_logs', sysDashboardControllers.getAuditLogs);
apiRouter.post('/admin/sql', sysDashboardControllers.runRawSql);
apiRouter.post('/errors/log', sysDashboardControllers.logJavascriptError);
apiRouter.get('/errors', sysDashboardControllers.getJavascriptErrors);
apiRouter.delete('/errors', sysDashboardControllers.clearJavascriptErrors);

// 12. Backup and Restore Configuration
apiRouter.get('/backups/export', backupControllers.exportBackup);
apiRouter.post('/backups/restore', backupControllers.restoreBackup);
apiRouter.post('/backups/auto', backupControllers.triggerAuto);
apiRouter.get('/backups/local', backupControllers.listLocal);
apiRouter.get('/backups/local/:filename/download', backupControllers.downloadLocal);
apiRouter.post('/backups/local/:filename/restore', backupControllers.restoreLocal);
apiRouter.delete('/backups/local/:filename', backupControllers.deleteLocal);
apiRouter.get('/backups/gdrive/auth-url', backupControllers.getGDriveAuthUrl);
apiRouter.get(['/backups/gdrive/callback', '/backups/gdrive/callback/'], backupControllers.handleGDriveCallback);
apiRouter.post('/backups/gdrive/sync', backupControllers.forceGDriveSync);
apiRouter.post('/backups/gdrive/manual-auth', backupControllers.manualGDriveAuth);
apiRouter.post('/backups/gdrive/disconnect', backupControllers.disconnectGDrive);
apiRouter.post('/backups/github/configure', backupControllers.configureGitHub);
apiRouter.get('/backups/status', backupControllers.getStatus);

// Developer Migration API
apiRouter.post('/migration/analyze', migrationControllers.analyzeLegacyBackup);
apiRouter.post('/migration/execute', migrationControllers.executeMigration);

// Bi-Directional Multi-Device Cloud & Local Synchronization
apiRouter.post('/sync/record', async (req, res) => {
  try {
    const { table, action } = req.body;
    const data = req.body.data || req.body.record;
    if (!table || !data) return res.status(400).json({ error: 'table and data required' });
    
    // Check if table exists in local DB
    const colsInfo = await query.all(`PRAGMA table_info(\`${table}\`)`);
    if (!colsInfo || colsInfo.length === 0) {
      return res.status(400).json({ error: `Table ${table} not found` });
    }
    const validCols = new Set(colsInfo.map((c: any) => c.name));

    if (action === 'delete') {
      if (data.Id) {
        if (validCols.has('FarmId') && data.FarmId) {
          await query.run(`DELETE FROM \`${table}\` WHERE Id = ? AND FarmId = ?`, [data.Id, data.FarmId]);
        } else {
          await query.run(`DELETE FROM \`${table}\` WHERE Id = ?`, [data.Id]);
        }
      }
      return res.json({ success: true });
    }

    // Upsert into local SQLite
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (validCols.has(k)) {
        filtered[k] = v;
      }
    }

    // Special handling for FarmSettings to match on FarmId
    if (table === 'FarmSettings' && filtered.FarmId) {
      const existing = await query.get('SELECT Id FROM FarmSettings WHERE FarmId = ?', [filtered.FarmId]);
      if (existing) {
        filtered.Id = existing.Id;
      }
    }

    const keys = Object.keys(filtered);
    if (keys.length > 0) {
      const columns = keys.map(k => `\`${k}\``).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map(k => filtered[k]);
      await query.run(`INSERT OR REPLACE INTO \`${table}\` (${columns}) VALUES (${placeholders})`, values);
    }
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Sync Record API] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sync/all', async (req, res) => {
  try {
    const result = await syncAllTablesBidirectional();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Farm Settings & Users
apiRouter.get('/settings', settingsControllers.getSettings);
apiRouter.put('/settings', settingsControllers.updateSettings);
apiRouter.post('/settings/logo', settingsControllers.uploadLogo);
apiRouter.post('/settings/sync-ages', settingsControllers.syncFlockAges);

apiRouter.get('/users', userManagementControllers.listUsers);
apiRouter.post('/users', userManagementControllers.createUser);
apiRouter.put('/users/:id', userManagementControllers.updateUser);
apiRouter.delete('/users/:id', userManagementControllers.deleteUser);
apiRouter.post('/users/reset-password', userManagementControllers.resetPassword);
apiRouter.get('/audit_logs_filtered', userManagementControllers.getAuditLogsFiltered);

// Farms multi-tenant endpoints - Powered dynamically by Supabase Cloud
apiRouter.get('/farms', async (req, res) => {
  try {
    const farms = await getSupabaseFarms();
    res.json(farms);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

apiRouter.post('/farms', async (req, res) => {
  try {
    const { FarmName, Location, ManagerName, ContactPhone, ContactEmail, adminUsername, adminEmail, adminPassword } = req.body;
    if (!FarmName) {
      return res.status(400).json({ error: 'FarmName is required' });
    }
    const createdFarm = await createSupabaseFarm({
      FarmName,
      OwnerName: ManagerName || 'Farm Administrator',
      ContactPhone: ContactPhone || '',
      ContactEmail: ContactEmail || adminEmail || '',
      Address: Location || '',
      adminUsername: adminUsername || 'admin',
      adminEmail: adminEmail || `${adminUsername || 'admin'}@farm.com`,
      adminPassword: adminPassword || 'admin123'
    });

    res.status(201).json({ message: 'Farm registered successfully in Supabase', farm: createdFarm });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 14. Bulk Data Import Modules
apiRouter.post('/bulk-import/parse', bulkImportControllers.parseImportData);
apiRouter.post('/bulk-import/commit', bulkImportControllers.commitImportData);

// Mount router on BOTH /api and root (/) for seamless Vercel and Express path matching
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 15. Express Global Error Catching Middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled server exception caught by middleware:', err);
  
  const msg = err.message || String(err);
  const stk = err.stack || '';
  const url = req.originalUrl || req.url || '';
  const userEmail = req.headers['x-user-email'] || 'System';
  const userAgent = req.headers['user-agent'] || '';

  query.run(`
    INSERT INTO JavascriptErrors (Source, Message, Stack, Url, UserAgent, UserEmail)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['Server', msg, stk, url, userAgent, userEmail]).catch(dbErr => {
    console.error('Failed to log server exception to database:', dbErr);
  });

  res.status(500).json({ error: err.message || 'An unhandled server-side exception occurred.' });
});

export { app, apiRouter };
