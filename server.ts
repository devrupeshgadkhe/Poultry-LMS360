import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase, dbPath } from './server/db.js';
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
} from './server/controllers.js';
import { backupControllers, startGoogleDriveAutoConnector } from './server/backups.js';
import { settingsControllers, userManagementControllers } from './server/settingsControllers.js';
import { bulkImportControllers } from './server/bulkImportControllers.js';
import { migrationControllers } from './server/migrationControllers.js';
import { getSupabaseFarms, createSupabaseFarm, syncSupabaseToLocal } from './server/supabase.js';

async function startServer() {
  // Initialize SQLite schema and seeds first
  try {
    await initializeDatabase();
    console.log('Database initialization complete.');
    // Synchronize Supabase Cloud users and farms
    await syncSupabaseToLocal();
    // Run background biological flock aging check on system start
    await settingsControllers.backgroundSyncAges();
    // Start automated headless Google Drive self-commissioning background daemon
    startGoogleDriveAutoConnector();
  } catch (err) {
    console.error('Critical database initialization failure:', err);
  }

  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing (using elevated limit for schema and database backup exports)
  app.use(express.json({ limit: '50mb' }));

  // Serve uploads folder statically so frontend can access images
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health endpoint for Electron boot validation
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Routes Definitions on Express
  // 1. Auth Endpoint Block
  app.post('/api/auth/login', authControllers.login);
  app.post('/api/auth/register', authControllers.register);

  // 2. Inventories Category Block
  app.get('/api/inventories', inventoryControllers.list);
  app.post('/api/inventories', inventoryControllers.create);
  app.put('/api/inventories/:id', inventoryControllers.update);
  app.delete('/api/inventories/:id', inventoryControllers.delete);

  // Egg Inventories
  app.get('/api/egg_inventories', async (req, res) => {
    try {
      const { query } = await import('./server/db.js');
      const eggs = await query.all('SELECT * FROM EggInventories');
      res.json(eggs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. Flocks Register Block
  app.get('/api/flocks', flockControllers.list);
  app.post('/api/flocks', flockControllers.create);
  app.put('/api/flocks/:id', flockControllers.update);
  app.delete('/api/flocks/:id', flockControllers.delete);

  // 4. Daily Logs Core Block
  app.get('/api/daily_logs', dailyLogsControllers.list);
  app.post('/api/daily_logs', dailyLogsControllers.create);
  app.put('/api/daily_logs/:id', dailyLogsControllers.update);
  app.delete('/api/daily_logs/:id', dailyLogsControllers.delete);

  // 5. Healthcare Vaccinations Block
  app.get('/api/vaccinations', vaccinationControllers.list);
  app.post('/api/vaccinations', vaccinationControllers.create);
  app.put('/api/vaccinations/:id', vaccinationControllers.update);
  app.delete('/api/vaccinations/:id', vaccinationControllers.delete);

  // 6. Stakeholders Register Block
  // Customers
  app.get('/api/customers', customerControllers.list);
  app.post('/api/customers', customerControllers.create);
  app.put('/api/customers/:id', customerControllers.update);
  app.delete('/api/customers/:id', customerControllers.delete);

  // Suppliers
  app.get('/api/suppliers', supplierControllers.list);
  app.post('/api/suppliers', supplierControllers.create);
  app.put('/api/suppliers/:id', supplierControllers.update);
  app.delete('/api/suppliers/:id', supplierControllers.delete);

  // 7. Operations Billing Block
  // Purchases (Supplier Purchase Desk)
  app.get('/api/purchases', purchaseControllers.list);
  app.get('/api/purchases/:id', purchaseControllers.getDetails);
  app.post('/api/purchases', purchaseControllers.create);
  app.put('/api/purchases/:id', purchaseControllers.update);
  app.delete('/api/purchases/:id', purchaseControllers.delete);
  app.post('/api/purchases/:id/return', purchaseControllers.returnPurchase);

  // Sales (POS Customer Sales Billing Desk)
  app.get('/api/sales', salesControllers.list);
  app.get('/api/sales/:id', salesControllers.getDetails);
  app.post('/api/sales', salesControllers.create);
  app.put('/api/sales/:id', salesControllers.update);
  app.delete('/api/sales/:id', salesControllers.delete);
  app.post('/api/sales/:id/return', salesControllers.returnSale);

  // 8. Milling Room Feed recipes Block
  app.get('/api/recipes', recipeControllers.listRecipes);
  app.get('/api/recipes/production-logs', recipeControllers.getProductionLogs);
  app.post('/api/recipes', recipeControllers.createRecipe);
  app.delete('/api/recipes/:id', recipeControllers.deleteRecipe);
  app.post('/api/recipes/:id/mill', recipeControllers.executeMill);

  // 9. HR Attendances & Payroll Block
  app.get('/api/staff', staffControllers.list);
  app.post('/api/staff', staffControllers.create);
  app.put('/api/staff/:id', staffControllers.update);
  app.delete('/api/staff/:id', staffControllers.delete);
  app.get('/api/staff/attendance', staffControllers.listAttendance);
  app.post('/api/staff/attendance', staffControllers.submitAttendance);
  app.delete('/api/staff/attendance/:id', staffControllers.deleteAttendance);

  app.get('/api/staff/holidays', staffControllers.listHolidays);
  app.post('/api/staff/holidays', staffControllers.createHoliday);
  app.delete('/api/staff/holidays/:id', staffControllers.deleteHoliday);
  
  app.get('/api/staff/payroll', staffControllers.listPayroll);
  app.post('/api/staff/payroll/calculate', staffControllers.calculatePayroll);
  app.post('/api/staff/payroll', staffControllers.savePayroll);
  app.put('/api/staff/payroll/:id', staffControllers.updatePayroll);
  app.delete('/api/staff/payroll/:id', staffControllers.deletePayroll);
  app.post('/api/staff/payroll/:id/disburse', staffControllers.disbursePayroll);

  // 10. General Financial Ledgers Setup
  app.get('/api/ledgers/categories', ledgerControllers.listCategories);
  app.post('/api/ledgers/categories', ledgerControllers.createCategory);
  app.put('/api/ledgers/categories/:id', ledgerControllers.updateCategory);
  app.delete('/api/ledgers/categories/:id', ledgerControllers.deleteCategory);
  app.get('/api/ledgers/transactions', ledgerControllers.listTransactions);
  app.post('/api/ledgers/transactions', ledgerControllers.createTransaction);
  app.put('/api/ledgers/transactions/:id', ledgerControllers.updateTransaction);
  app.delete('/api/ledgers/transactions/:id', ledgerControllers.deleteTransaction);

  // 11. Dashboard Analytics & Logs Tracker
  app.get('/api/reports/all-data', async (req, res) => {
    try {
      const { query } = await import('./server/db.js');
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

  app.get('/api/dashboard', sysDashboardControllers.getDashboardData);
  app.get('/api/audit_logs', sysDashboardControllers.getAuditLogs);
  app.post('/api/admin/sql', sysDashboardControllers.runRawSql);
  app.post('/api/errors/log', sysDashboardControllers.logJavascriptError);
  app.get('/api/errors', sysDashboardControllers.getJavascriptErrors);
  app.delete('/api/errors', sysDashboardControllers.clearJavascriptErrors);

  // 12. Backup and Restore Configuration (Secure, generic JSON schema and content formats)
  app.get('/api/backups/export', backupControllers.exportBackup);
  app.post('/api/backups/restore', backupControllers.restoreBackup);
  app.post('/api/backups/auto', backupControllers.triggerAuto);
  app.get('/api/backups/local', backupControllers.listLocal);
  app.get('/api/backups/local/:filename/download', backupControllers.downloadLocal);
  app.post('/api/backups/local/:filename/restore', backupControllers.restoreLocal);
  app.delete('/api/backups/local/:filename', backupControllers.deleteLocal);
  app.get('/api/backups/gdrive/auth-url', backupControllers.getGDriveAuthUrl);
  app.get(['/api/backups/gdrive/callback', '/api/backups/gdrive/callback/'], backupControllers.handleGDriveCallback);
  app.post('/api/backups/gdrive/sync', backupControllers.forceGDriveSync);
  app.post('/api/backups/gdrive/manual-auth', backupControllers.manualGDriveAuth);
  app.post('/api/backups/gdrive/disconnect', backupControllers.disconnectGDrive);
  app.post('/api/backups/github/configure', backupControllers.configureGitHub);
  app.get('/api/backups/status', backupControllers.getStatus);

  // Developer-Only Legacy Single-Farm to Multi-Farm Migration API
  app.post('/api/migration/analyze', migrationControllers.analyzeLegacyBackup);
  app.post('/api/migration/execute', migrationControllers.executeMigration);

  // 13. Farm Settings & Operator Access Matrix Management
  app.get('/api/settings', settingsControllers.getSettings);
  app.put('/api/settings', settingsControllers.updateSettings);
  app.post('/api/settings/logo', settingsControllers.uploadLogo);
  app.post('/api/settings/sync-ages', settingsControllers.syncFlockAges);

  app.get('/api/users', userManagementControllers.listUsers);
  app.post('/api/users', userManagementControllers.createUser);
  app.put('/api/users/:id', userManagementControllers.updateUser);
  app.delete('/api/users/:id', userManagementControllers.deleteUser);
  app.post('/api/users/reset-password', userManagementControllers.resetPassword);
  app.get('/api/audit_logs_filtered', userManagementControllers.getAuditLogsFiltered);

  // Farms multi-tenant endpoints - Powered dynamically by Supabase Cloud
  app.get('/api/farms', async (req, res) => {
    try {
      const farms = await getSupabaseFarms();
      res.json(farms);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/farms', async (req, res) => {
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

  // 14. Bulk Data Import Modules (Sales, Purchase, Items, Daily Logs)
  app.post('/api/bulk-import/parse', bulkImportControllers.parseImportData);
  app.post('/api/bulk-import/commit', bulkImportControllers.commitImportData);

  // 15. Express Global Error Catching Middleware
  app.use('/api', (err: any, req: any, res: any, next: any) => {
    console.error('Unhandled server exception caught by middleware:', err);
    
    const msg = err.message || String(err);
    const stk = err.stack || '';
    const url = req.originalUrl || req.url || '';
    const userEmail = req.headers['x-user-email'] || 'System';
    const userAgent = req.headers['user-agent'] || '';

    import('./server/db.js').then(({ query }) => {
      query.run(`
        INSERT INTO JavascriptErrors (Source, Message, Stack, Url, UserAgent, UserEmail)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['Server', msg, stk, url, userAgent, userEmail]).catch(dbErr => {
        console.error('Failed to log server exception to database:', dbErr);
      });
    }).catch(importErr => {
      console.error('Failed to import database during exception logging:', importErr);
    });

    res.status(500).json({ error: err.message || 'An unhandled server-side exception occurred.' });
  });

  // Enable Hot Reloading / Static Delivery Assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Packaged assets reside directly in the compiled dist directory where server.cjs resides.
    // If running in development, fall back to process.cwd() + '/dist'.
    const distPath = fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(process.cwd(), 'dist');
      
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Poultry LMS 360 Full-Stack Hub running on official port http://localhost:${PORT}`);
  });
}

startServer();
