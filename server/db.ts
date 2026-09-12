import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';

export const dbPath = (() => {
  // If running inside Electron main process
  if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
    try {
      const { app } = require('electron');
      if (app) {
        return path.join(app.getPath('userData'), 'poultry360.db');
      }
    } catch (e) {
      console.warn('Failed to resolve Electron app userData path, falling back. Error:', e);
    }
  }

  // If running in Vercel Serverless environment, only /tmp is writable
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDb = path.resolve('/tmp', 'poultry360.db');
    const bundledDb = path.resolve(process.cwd(), 'poultry360.db');
    if (!fs.existsSync(tmpDb) && fs.existsSync(bundledDb)) {
      try {
        fs.copyFileSync(bundledDb, tmpDb);
        console.log('[Vercel DB] Bundled database initialized in /tmp/poultry360.db');
      } catch (err: any) {
        console.warn('[Vercel DB] Could not copy bundled DB to /tmp:', err.message);
      }
    }
    return tmpDb;
  }

  // Outside Electron, if running in a cloud/development container or production build,
  // store the database in the workspace directory (current working directory) so that
  // SQLite data (including settings, links, and transaction logs) persists across builds & container restarts.
  if (process.env.GOOGLE_RUNTIME || process.env.NODE_ENV === 'production') {
    return path.resolve(process.cwd(), 'poultry360.db');
  }

  // Otherwise, use user home directory fallback
  const homeDir = os.homedir() || (process.env && (process.env.USERPROFILE || process.env.HOME)) || process.cwd();
  return path.resolve(homeDir, 'poultry360.db');
})();

// Migrate database file from ephemeral home directory if it exists and hasn't been copied yet
(() => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  const sourceHome = os.homedir() || '/root';
  const sourceDbPath = path.resolve(sourceHome, 'poultry360.db');
  const targetDbPath = dbPath;
  if (targetDbPath !== sourceDbPath && fs.existsSync(sourceDbPath) && !fs.existsSync(targetDbPath)) {
    try {
      fs.copyFileSync(sourceDbPath, targetDbPath);
      console.log(`[Database Migration] Migrated ephemeral database from ${sourceDbPath} to persistent path ${targetDbPath}`);
    } catch (copyErr: any) {
      console.warn('[Database Migration] Ephemeral database migration warning:', copyErr.message);
    }
  }
})();

let db: sqlite3.Database;

export function connectDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database', err);
    } else {
      console.log('Connected to SQLite database at', dbPath);
      db.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('Failed to enable foreign keys:', err);
        } else {
          console.log('Foreign key support enabled.');
        }
      });
    }
  });
}

connectDatabase();

// Helper utilities to wrap callbacks in Promises
export const query = {
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row as T | undefined);
      });
    });
  },

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows as T[]);
      });
    });
  },

  async serializeTransaction<T>(work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        work().then(resolve).catch(reject);
      });
    });
  }
};

// Initialize schema and seed data
export async function initializeDatabase() {
  console.log('Validating database integrity check...');
  try {
    // Run quick integrity check query
    await query.get('PRAGMA integrity_check');
    console.log('Database integrity check passed successfully.');
  } catch (err: any) {
    if (err.message && (err.message.includes('SQLITE_CORRUPT') || err.message.includes('malformed'))) {
      console.error('CRITICAL DATABASE CORRUPTION DETECTED! Starting self-healing sequence...', err.message);
      
      // Close the current corrupted database connection to release files
      await new Promise<void>((resolve) => {
        db.close((closeErr) => {
          if (closeErr) console.error('Error closing corrupted db:', closeErr);
          resolve();
        });
      });

      // Safe backup on disk so we never lose anything
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${dbPath}.corrupt_backup_${timestamp}`;
      try {
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, backupPath);
          console.log(`[Database Self-Heal] Backed up malformed database to: ${backupPath}`);
          fs.unlinkSync(dbPath);
          console.log(`[Database Self-Heal] Deleted malformed database to trigger recreation.`);
        }
      } catch (backupErr: any) {
        console.error('Failed to rename corrupt database:', backupErr);
      }

      // Reconnect to fresh SQLite instance
      connectDatabase();
    } else {
      throw err;
    }
  }

  console.log('Initializing database schema...');

  // Farms multi-tenant table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Farms (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FarmName TEXT NOT NULL,
      OwnerName TEXT,
      ContactPhone TEXT,
      ContactEmail TEXT,
      Address TEXT,
      Location TEXT,
      Capacity INTEGER DEFAULT 10000,
      ManagerName TEXT,
      IsActive INTEGER DEFAULT 1,
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Users (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Username TEXT UNIQUE NOT NULL,
      Email TEXT UNIQUE NOT NULL,
      PasswordHash TEXT NOT NULL,
      Role TEXT NOT NULL CHECK(Role IN ('Admin', 'Staff', 'Developer')),
      FullName TEXT NOT NULL,
      IsActive INTEGER DEFAULT 1,
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // FarmSettings table
  await query.run(`
    CREATE TABLE IF NOT EXISTS FarmSettings (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FarmName TEXT NOT NULL DEFAULT 'Poultry LMS 360',
      IsGoogleDriveEnabled INTEGER DEFAULT 0,
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Flocks table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Flocks (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FlockName TEXT NOT NULL,
      Breed TEXT NOT NULL,
      InitialCount INTEGER NOT NULL,
      CurrentCount INTEGER NOT NULL,
      ArrivalDate TEXT NOT NULL,
      Status TEXT NOT NULL DEFAULT 'Active' CHECK(Status IN ('Active', 'Sold', 'Inactive')),
      EndDate TEXT,
      IsActive INTEGER DEFAULT 1,
      TotalPurchasePrice REAL NOT NULL,
      StartDate TEXT NOT NULL,
      TotalFeedCost REAL DEFAULT 0,
      TotalVaccineCost REAL DEFAULT 0,
      PerBirdPurchasePrice REAL DEFAULT 0,
      AgeInDays INTEGER DEFAULT 0,
      Notes TEXT
    )
  `);

  // Inventories table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Inventories (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      ItemName TEXT UNIQUE NOT NULL,
      Category TEXT NOT NULL CHECK(Category IN ('Feed', 'Medicine', 'Equipment', 'Sales Item', 'Raw Ingredient')),
      UnitOfMeasurement TEXT NOT NULL,
      UnitPrice REAL NOT NULL DEFAULT 0,
      SellingPrice REAL NOT NULL DEFAULT 0,
      CurrentStock REAL NOT NULL DEFAULT 0,
      WeightPerUnit REAL NOT NULL DEFAULT 1,
      MinThreshold REAL NOT NULL DEFAULT 0,
      Notes TEXT
    )
  `);

  // DailyLogs table
  await query.run(`
    CREATE TABLE IF NOT EXISTS DailyLogs (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FlockId INTEGER NOT NULL,
      FeedItemId INTEGER,
      FeedConsumedKg REAL NOT NULL DEFAULT 0,
      MortalityCount INTEGER NOT NULL DEFAULT 0,
      EggsCollected INTEGER NOT NULL DEFAULT 0,
      DamagedEggsCollected INTEGER NOT NULL DEFAULT 0,
      LogDate TEXT NOT NULL,
      FeedCost REAL NOT NULL DEFAULT 0,
      DailyBirdCost REAL NOT NULL DEFAULT 0,
      Notes TEXT,
      DailyAverageWeight REAL NOT NULL DEFAULT 0,
      WaterConsumed REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (FlockId) REFERENCES Flocks(Id) ON DELETE CASCADE,
      FOREIGN KEY (FeedItemId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // Try adding columns to migrate existing database files smoothly
  try {
    await query.run(`ALTER TABLE DailyLogs ADD COLUMN DailyAverageWeight REAL NOT NULL DEFAULT 0`);
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await query.run(`ALTER TABLE DailyLogs ADD COLUMN WaterConsumed REAL NOT NULL DEFAULT 0`);
  } catch (err) {
    // Column already exists, ignore
  }

  // Vaccinations table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Vaccinations (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FlockId INTEGER NOT NULL,
      VaccineName TEXT NOT NULL,
      Date TEXT NOT NULL,
      Cost REAL NOT NULL DEFAULT 0,
      AdministeredBy TEXT,
      Notes TEXT,
      Phase TEXT NOT NULL DEFAULT 'Administered',
      ScheduledDate TEXT,
      FOREIGN KEY (FlockId) REFERENCES Flocks(Id) ON DELETE CASCADE
    )
  `);

  // Try adding columns to migrate existing database files smoothly
  try {
    await query.run(`ALTER TABLE Vaccinations ADD COLUMN Phase TEXT NOT NULL DEFAULT 'Administered'`);
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await query.run(`ALTER TABLE Vaccinations ADD COLUMN ScheduledDate TEXT`);
  } catch (err) {
    // Column already exists, ignore
  }

  // EggInventories table
  await query.run(`
    CREATE TABLE IF NOT EXISTS EggInventories (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      GradeOrType TEXT NOT NULL DEFAULT 'Fresh Eggs',
      PackSize TEXT NOT NULL DEFAULT 'Single' CHECK(PackSize IN ('Single', 'Dozen', 'Tray-30')),
      Quantity INTEGER NOT NULL DEFAULT 0,
      UnitPrice REAL NOT NULL DEFAULT 0,
      SellingPrice REAL NOT NULL DEFAULT 0
    )
  `);

  // Customers table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Customers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FullName TEXT NOT NULL,
      Email TEXT,
      Phone TEXT,
      Company TEXT,
      OpeningCreditBalance REAL NOT NULL DEFAULT 0,
      CurrentCreditBalance REAL NOT NULL DEFAULT 0,
      Address TEXT
    )
  `);

  // Suppliers table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Suppliers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      CompanyName TEXT NOT NULL,
      ContactPerson TEXT,
      Email TEXT,
      Phone TEXT,
      OpeningCreditBalance REAL NOT NULL DEFAULT 0,
      CurrentCreditBalance REAL NOT NULL DEFAULT 0,
      Address TEXT
    )
  `);

  // Purchases table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Purchases (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SupplierId INTEGER,
      PurchaseDate TEXT NOT NULL,
      TotalAmount REAL NOT NULL DEFAULT 0,
      TotalGSTAmount REAL NOT NULL DEFAULT 0,
      OtherTaxes REAL NOT NULL DEFAULT 0,
      ReceivedAmount REAL NOT NULL DEFAULT 0,
      BalanceAmount REAL NOT NULL DEFAULT 0,
      InvoiceNumber TEXT,
      Status TEXT NOT NULL CHECK(Status IN ('Paid', 'Partial', 'Unpaid')),
      Notes TEXT,
      FOREIGN KEY (SupplierId) REFERENCES Suppliers(Id) ON DELETE SET NULL
    )
  `);

  // PurchaseItems table
  await query.run(`
    CREATE TABLE IF NOT EXISTS PurchaseItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseId INTEGER NOT NULL,
      InventoryId INTEGER,
      ItemType TEXT NOT NULL CHECK(ItemType IN ('Flock', 'Inventory', 'Feed Ingredient')),
      Quantity REAL NOT NULL,
      UnitPrice REAL NOT NULL,
      GSTPercentage REAL NOT NULL DEFAULT 0,
      GSTAmount REAL NOT NULL DEFAULT 0,
      TotalPrice REAL NOT NULL,
      WeightPerUnit REAL NOT NULL DEFAULT 1,
      AllocatedOverhead REAL NOT NULL DEFAULT 0,
      FinalLandedAmount REAL NOT NULL,
      FOREIGN KEY (PurchaseId) REFERENCES Purchases(Id) ON DELETE CASCADE,
      FOREIGN KEY (InventoryId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // PurchaseExtraExpenses table
  await query.run(`
    CREATE TABLE IF NOT EXISTS PurchaseExtraExpenses (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseId INTEGER NOT NULL,
      ExpenseName TEXT NOT NULL,
      Amount REAL NOT NULL,
      AllocationMethod TEXT NOT NULL CHECK(AllocationMethod IN ('ByValue', 'ByWeight', 'ByQuantity', 'Equal')),
      TargetInventoryId INTEGER,
      FOREIGN KEY (PurchaseId) REFERENCES Purchases(Id) ON DELETE CASCADE,
      FOREIGN KEY (TargetInventoryId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // PurchaseReturns table
  await query.run(`
    CREATE TABLE IF NOT EXISTS PurchaseReturns (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseId INTEGER NOT NULL,
      ReturnDate TEXT NOT NULL,
      TotalReturnAmount REAL NOT NULL DEFAULT 0,
      Notes TEXT,
      FOREIGN KEY (PurchaseId) REFERENCES Purchases(Id) ON DELETE CASCADE
    )
  `);

  // PurchaseReturnItems table
  await query.run(`
    CREATE TABLE IF NOT EXISTS PurchaseReturnItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PurchaseReturnId INTEGER NOT NULL,
      PurchaseItemId INTEGER NOT NULL,
      InventoryId INTEGER,
      Quantity REAL NOT NULL,
      RefundAmount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (PurchaseReturnId) REFERENCES PurchaseReturns(Id) ON DELETE CASCADE,
      FOREIGN KEY (PurchaseItemId) REFERENCES PurchaseItems(Id) ON DELETE SET NULL,
      FOREIGN KEY (InventoryId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // Sales table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Sales (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      CustomerId INTEGER NOT NULL,
      SaleDate TEXT NOT NULL,
      SubTotal REAL NOT NULL,
      Discount REAL NOT NULL DEFAULT 0,
      TotalGSTAmount REAL NOT NULL DEFAULT 0,
      OtherCharges REAL NOT NULL DEFAULT 0,
      GrandTotal REAL NOT NULL,
      ReceivedAmount REAL NOT NULL,
      InvoiceNumber TEXT,
      Status TEXT NOT NULL CHECK(Status IN ('Paid', 'Partial', 'Unpaid')),
      Notes TEXT,
      FOREIGN KEY (CustomerId) REFERENCES Customers(Id) ON DELETE RESTRICT
    )
  `);

  // SaleItems table
  await query.run(`
    CREATE TABLE IF NOT EXISTS SaleItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SaleId INTEGER NOT NULL,
      ItemType TEXT NOT NULL CHECK(ItemType IN ('Bird', 'Egg', 'General Inventory')),
      FlockId INTEGER,
      EggInventoryId INTEGER,
      InventoryId INTEGER,
      Quantity REAL NOT NULL,
      UnitPrice REAL NOT NULL,
      GSTPercentage REAL NOT NULL DEFAULT 0,
      GSTAmount REAL NOT NULL DEFAULT 0,
      TotalPrice REAL NOT NULL,
      FOREIGN KEY (SaleId) REFERENCES Sales(Id) ON DELETE CASCADE,
      FOREIGN KEY (FlockId) REFERENCES Flocks(Id) ON DELETE SET NULL,
      FOREIGN KEY (EggInventoryId) REFERENCES EggInventories(Id) ON DELETE SET NULL,
      FOREIGN KEY (InventoryId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // SaleReturns table
  await query.run(`
    CREATE TABLE IF NOT EXISTS SaleReturns (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SaleId INTEGER NOT NULL,
      ReturnDate TEXT NOT NULL,
      TotalReturnAmount REAL NOT NULL DEFAULT 0,
      Notes TEXT,
      FOREIGN KEY (SaleId) REFERENCES Sales(Id) ON DELETE CASCADE
    )
  `);

  // SaleReturnItems table
  await query.run(`
    CREATE TABLE IF NOT EXISTS SaleReturnItems (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SaleReturnId INTEGER NOT NULL,
      SaleItemId INTEGER,
      ItemType TEXT NOT NULL CHECK(ItemType IN ('Bird', 'Egg', 'General Inventory')),
      FlockId INTEGER,
      EggInventoryId INTEGER,
      InventoryId INTEGER,
      Quantity REAL NOT NULL,
      RefundAmount REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (SaleReturnId) REFERENCES SaleReturns(Id) ON DELETE CASCADE,
      FOREIGN KEY (SaleItemId) REFERENCES SaleItems(Id) ON DELETE SET NULL,
      FOREIGN KEY (FlockId) REFERENCES Flocks(Id) ON DELETE SET NULL,
      FOREIGN KEY (EggInventoryId) REFERENCES EggInventories(Id) ON DELETE SET NULL,
      FOREIGN KEY (InventoryId) REFERENCES Inventories(Id) ON DELETE SET NULL
    )
  `);

  // TransactionCategories table
  await query.run(`
    CREATE TABLE IF NOT EXISTS TransactionCategories (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT UNIQUE NOT NULL,
      IsIncome INTEGER NOT NULL DEFAULT 0,
      Description TEXT
    )
  `);

  // Staff table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Staff (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FullName TEXT NOT NULL,
      Role TEXT NOT NULL,
      Email TEXT,
      Phone TEXT,
      HireDate TEXT NOT NULL,
      MonthlySalary REAL DEFAULT 0,
      DailyWages REAL DEFAULT 0,
      FixedBonus REAL DEFAULT 0,
      FixedDeduction REAL DEFAULT 0,
      IsActive INTEGER DEFAULT 1
    )
  `);

  // FinancialTransactions table
  await query.run(`
    CREATE TABLE IF NOT EXISTS FinancialTransactions (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Date TEXT NOT NULL,
      Amount REAL NOT NULL,
      Type TEXT NOT NULL CHECK(Type IN ('Income', 'Expense')),
      CategoryId INTEGER NOT NULL,
      Notes TEXT,
      FlockId INTEGER,
      EggInventoryId INTEGER,
      StaffId INTEGER,
      SupplierId INTEGER,
      CustomerId INTEGER,
      PaymentMethod TEXT DEFAULT 'Cash',
      Reference TEXT,
      FOREIGN KEY (CategoryId) REFERENCES TransactionCategories(Id) ON DELETE RESTRICT,
      FOREIGN KEY (FlockId) REFERENCES Flocks(Id) ON DELETE SET NULL,
      FOREIGN KEY (EggInventoryId) REFERENCES EggInventories(Id) ON DELETE SET NULL,
      FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE SET NULL,
      FOREIGN KEY (SupplierId) REFERENCES Suppliers(Id) ON DELETE SET NULL,
      FOREIGN KEY (CustomerId) REFERENCES Customers(Id) ON DELETE SET NULL
    )
  `);

  // FoodRecipes table
  await query.run(`
    CREATE TABLE IF NOT EXISTS FoodRecipes (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      RecipeName TEXT UNIQUE NOT NULL,
      BatchSizeKg REAL NOT NULL DEFAULT 1000,
      Notes TEXT,
      CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await query.run(`ALTER TABLE FoodRecipes ADD COLUMN TargetFeedItemId INTEGER`);
  } catch (err) {
    // Column already exists, ignore
  }

  try {
    await query.run(`ALTER TABLE FoodRecipes ADD COLUMN FarmId INTEGER DEFAULT 1`);
  } catch (err) {
    // Column already exists, ignore
  }

  // RecipeIngredients table
  await query.run(`
    CREATE TABLE IF NOT EXISTS RecipeIngredients (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FoodRecipeId INTEGER NOT NULL,
      InventoryId INTEGER NOT NULL,
      Percentage REAL NOT NULL,
      WeightKg REAL NOT NULL,
      FOREIGN KEY (FoodRecipeId) REFERENCES FoodRecipes(Id) ON DELETE CASCADE,
      FOREIGN KEY (InventoryId) REFERENCES Inventories(Id) ON DELETE RESTRICT
    )
  `);

  // FeedProductionLogs table to track historical feed batches milled
  await query.run(`
    CREATE TABLE IF NOT EXISTS FeedProductionLogs (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      FarmId INTEGER NOT NULL DEFAULT 1,
      RecipeId INTEGER,
      RecipeName TEXT NOT NULL,
      TargetFeedItemId INTEGER,
      TargetItemName TEXT,
      QuantityKg REAL NOT NULL,
      BagsProduced REAL,
      TotalCost REAL NOT NULL DEFAULT 0,
      CostPerKg REAL NOT NULL DEFAULT 0,
      MilledAt TEXT DEFAULT CURRENT_TIMESTAMP,
      Notes TEXT
    )
  `);

  // StaffAttendances table
  await query.run(`
    CREATE TABLE IF NOT EXISTS StaffAttendances (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      StaffId INTEGER NOT NULL,
      Date TEXT NOT NULL,
      Status TEXT NOT NULL CHECK(Status IN ('Present', 'Absent', 'Leave', 'Late', 'HalfDay')),
      CheckInTime TEXT,
      CheckOutTime TEXT,
      OvertimeHours REAL DEFAULT 0,
      Notes TEXT,
      FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE
    )
  `);

  // StaffPayrolls table
  await query.run(`
    CREATE TABLE IF NOT EXISTS StaffPayrolls (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      StaffId INTEGER NOT NULL,
      Month INTEGER NOT NULL,
      Year INTEGER NOT NULL,
      BaseSalary REAL NOT NULL DEFAULT 0,
      OvertimePay REAL DEFAULT 0,
      Bonus REAL DEFAULT 0,
      Deductions REAL DEFAULT 0,
      NetPayable REAL NOT NULL DEFAULT 0,
      Status TEXT NOT NULL CHECK(Status IN ('Paid', 'Unpaid', 'Pending')),
      PayDate TEXT,
      TransactionId INTEGER,
      FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE,
      FOREIGN KEY (TransactionId) REFERENCES FinancialTransactions(Id) ON DELETE SET NULL
    )
  `);

  // AuditLogs table
  await query.run(`
    CREATE TABLE IF NOT EXISTS AuditLogs (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      UserEmail TEXT,
      Module TEXT,
      Action TEXT,
      Parameters TEXT,
      Status TEXT,
      ExceptionMessage TEXT,
      StackTrace TEXT,
      IpAddress TEXT,
      HttpMethod TEXT,
      Url TEXT
    )
  `);

  // JavascriptErrors table (Specifically for runtime exceptions / unhandled failures)
  await query.run(`
    CREATE TABLE IF NOT EXISTS JavascriptErrors (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      Source TEXT NOT NULL,
      Message TEXT,
      Stack TEXT,
      Url TEXT,
      UserAgent TEXT,
      UserEmail TEXT
    )
  `);

  // Holidays table
  await query.run(`
    CREATE TABLE IF NOT EXISTS Holidays (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Date TEXT NOT NULL,
      Name TEXT NOT NULL,
      Type TEXT NOT NULL CHECK(Type IN ('Public', 'Individual')),
      StaffId INTEGER,
      FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE
    )
  `);

  // Migrate columns smoothly for self consumption and gifting
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN BirdsEatenBySelf INTEGER DEFAULT 0`); } catch (err) {}
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN BirdsEatenValue REAL DEFAULT 0`); } catch (err) {}
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN EggsGifted INTEGER DEFAULT 0`); } catch (err) {}
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN EggsGiftedValue REAL DEFAULT 0`); } catch (err) {}
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN CustomEggPrice REAL`); } catch (err) {}
  try { await query.run(`ALTER TABLE DailyLogs ADD COLUMN CustomBirdPrice REAL`); } catch (err) {}

  // Migrate financial transaction columns
  try {
    const columns = await query.all("PRAGMA table_info(FinancialTransactions)");
    const columnNames = columns.map((col: any) => col.name);
    console.log("Verified FinancialTransactions columns:", columnNames);
    if (!columnNames.includes('PaymentMethod')) {
      console.log("Adding missing column 'PaymentMethod' to FinancialTransactions");
      await query.run(`ALTER TABLE FinancialTransactions ADD COLUMN PaymentMethod TEXT DEFAULT 'Cash'`);
    }
    if (!columnNames.includes('Reference')) {
      console.log("Adding missing column 'Reference' to FinancialTransactions");
      await query.run(`ALTER TABLE FinancialTransactions ADD COLUMN Reference TEXT`);
    }
  } catch (err: any) {
    console.error("Failed to verify or migrate FinancialTransactions columns:", err.message);
  }

  // Migrate FarmSettings columns for Google Drive backup configs & corporate assets
  try {
    const fsColumns = await query.all("PRAGMA table_info(FarmSettings)");
    const fsColumnNames = fsColumns.map((col: any) => col.name);
    if (!fsColumnNames.includes('GoogleDriveRefreshToken')) {
      console.log("Adding missing column 'GoogleDriveRefreshToken' to FarmSettings");
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GoogleDriveRefreshToken TEXT`);
    }
    if (!fsColumnNames.includes('GoogleDriveAccessToken')) {
      console.log("Adding missing column 'GoogleDriveAccessToken' to FarmSettings");
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GoogleDriveAccessToken TEXT`);
    }
    if (!fsColumnNames.includes('GoogleDriveTokenExpiry')) {
      console.log("Adding missing column 'GoogleDriveTokenExpiry' to FarmSettings");
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GoogleDriveTokenExpiry INTEGER`);
    }
    if (!fsColumnNames.includes('GoogleDriveEmail')) {
      console.log("Adding missing column 'GoogleDriveEmail' to FarmSettings");
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GoogleDriveEmail TEXT`);
    }
    if (!fsColumnNames.includes('Address')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN Address TEXT NOT NULL DEFAULT ''`);
    }
    if (!fsColumnNames.includes('Phone')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN Phone TEXT NOT NULL DEFAULT ''`);
    }
    if (!fsColumnNames.includes('Email')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN Email TEXT NOT NULL DEFAULT ''`);
    }
    if (!fsColumnNames.includes('Website')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN Website TEXT NULL`);
    }
    if (!fsColumnNames.includes('LogoUrl')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN LogoUrl TEXT NULL`);
    }
    if (!fsColumnNames.includes('LastAgeUpdateDate')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN LastAgeUpdateDate TEXT NULL`);
    }
    if (!fsColumnNames.includes('GoogleDriveFolderId')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GoogleDriveFolderId TEXT NULL`);
    }
    if (!fsColumnNames.includes('LastBackupDate')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN LastBackupDate TEXT NULL`);
    }
    if (!fsColumnNames.includes('GithubBackupPat')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GithubBackupPat TEXT NULL`);
    }
    if (!fsColumnNames.includes('GithubBackupRepo')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GithubBackupRepo TEXT NULL`);
    }
    if (!fsColumnNames.includes('GithubBackupBranch')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GithubBackupBranch TEXT NULL`);
    }
    if (!fsColumnNames.includes('GithubBackupPath')) {
      await query.run(`ALTER TABLE FarmSettings ADD COLUMN GithubBackupPath TEXT NULL`);
    }
  } catch (err: any) {
    console.error("Failed to migrate FarmSettings columns:", err.message);
  }

  // Migrate Users table to support dynamic comma separated claims, FarmId, and PlainPassword
  try {
    const userColumns = await query.all("PRAGMA table_info(Users)");
    const userColNames = userColumns.map((c: any) => c.name);
    if (!userColNames.includes('Permissions')) {
      await query.run(`ALTER TABLE Users ADD COLUMN Permissions TEXT NULL`);
    }
    if (!userColNames.includes('FarmId')) {
      await query.run(`ALTER TABLE Users ADD COLUMN FarmId INTEGER DEFAULT 1`);
    }
    if (!userColNames.includes('PlainPassword')) {
      await query.run(`ALTER TABLE Users ADD COLUMN PlainPassword TEXT NULL`);
    }
    await query.run(`UPDATE Users SET PlainPassword = 'admin123', FarmId = 1 WHERE Username = 'admin' AND (PlainPassword IS NULL OR PlainPassword = '')`);
    await query.run(`UPDATE Users SET PlainPassword = 'dev123', FarmId = 1 WHERE Username = 'developer' AND (PlainPassword IS NULL OR PlainPassword = '')`);
    await query.run(`UPDATE Users SET PlainPassword = 'staff123', FarmId = 1 WHERE Username = 'staff' AND (PlainPassword IS NULL OR PlainPassword = '')`);
  } catch (err: any) {
    console.error("Failed to migrate Users columns:", err.message);
  }

  // Ensure all application tables have FarmId for multi-tenant isolation
  const tablesNeedingFarmId = [
    'Flocks', 'Inventories', 'DailyLogs', 'Vaccinations', 'EggInventories',
    'Customers', 'Suppliers', 'Purchases', 'PurchaseItems', 'PurchaseExtraExpenses',
    'PurchaseReturns', 'PurchaseReturnItems', 'Sales', 'SaleItems', 'SaleReturns',
    'SaleReturnItems', 'TransactionCategories', 'Staff', 'FinancialTransactions',
    'FoodRecipes', 'FeedProductionLogs'
  ];
  for (const tbl of tablesNeedingFarmId) {
    try {
      const cols = await query.all(`PRAGMA table_info(${tbl})`);
      const cNames = cols.map((c: any) => c.name);
      if (!cNames.includes('FarmId')) {
        await query.run(`ALTER TABLE ${tbl} ADD COLUMN FarmId INTEGER DEFAULT 1`);
        console.log(`[DB Migration] Added FarmId column to local table ${tbl}`);
      }
    } catch (colErr: any) {
      // Table might not exist or already migrated
    }
  }

  // Apply default seeding
  await seedDatabase();
}

async function seedDatabase() {
  // Sync real farms and users directly from Supabase Cloud on initialization
  try {
    const { syncSupabaseToLocal } = await import('./supabase.js');
    await syncSupabaseToLocal();
  } catch (err: any) {
    console.warn('[DB Init] Supabase initial sync skipped:', err.message);
  }

  // 2. Seed user fallback if empty
  const adminExists = await query.get('SELECT * FROM Users WHERE Username = ?', ['admin']);
  if (!adminExists) {
    const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
    const allPerms = 'dashboard.view,flocks.view,flocks.create,flocks.edit,flocks.delete,dailylogs.view,dailylogs.create,dailylogs.edit,dailylogs.delete,health.view,health.create,health.edit,health.delete,sales.view,sales.create,sales.edit,sales.delete,purchases.view,purchases.create,purchases.edit,purchases.delete,inventory.create,inventory.edit,inventory.delete,inventory.view,customers.view,customers.create,customers.edit,customers.delete,suppliers.view,suppliers.create,suppliers.edit,suppliers.delete,staff.view,staff.create,staff.edit,staff.delete,attendance.view,attendance.edit,payroll.view,payroll.create,payroll.edit,financials.view,financials.create,financials.edit,financials.delete,bulkimport.view,reports.view,settings.view,settings.edit,admin';
    
    await query.run(
      'INSERT INTO Users (Username, Email, PasswordHash, Role, FullName, IsActive, Permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['admin', 'admin@poultrylms.com', passwordHash, 'Admin', 'Farm Administrator', 1, allPerms]
    );
    const devHash = crypto.createHash('sha256').update('dev123').digest('hex');
    await query.run(
      'INSERT INTO Users (Username, Email, PasswordHash, Role, FullName, IsActive, Permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['developer', 'dev@poultrylms.com', devHash, 'Developer', 'Lead System Developer', 1, allPerms]
    );
    const staffHash = crypto.createHash('sha256').update('staff123').digest('hex');
    const staffPerms = 'dashboard.view,flocks.view,dailylogs.view,dailylogs.create,health.view,sales.view,sales.create,inventory.view,customers.view,suppliers.view,attendance.view,reports.view';
    await query.run(
      'INSERT INTO Users (Username, Email, PasswordHash, Role, FullName, IsActive, Permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['staff', 'staff@poultrylms.com', staffHash, 'Staff', 'Operations Supervisor', 1, staffPerms]
    );
    console.log('Default users seeded successfully with permissions.');
  } else {
    // Populate permissions for pre-existing default accounts
    const allPerms = 'dashboard.view,flocks.view,flocks.create,flocks.edit,flocks.delete,dailylogs.view,dailylogs.create,dailylogs.edit,dailylogs.delete,health.view,health.create,health.edit,health.delete,sales.view,sales.create,sales.edit,sales.delete,purchases.view,purchases.create,purchases.edit,purchases.delete,inventory.create,inventory.edit,inventory.delete,inventory.view,customers.view,customers.create,customers.edit,customers.delete,suppliers.view,suppliers.create,suppliers.edit,suppliers.delete,staff.view,staff.create,staff.edit,staff.delete,attendance.view,attendance.edit,payroll.view,payroll.create,payroll.edit,financials.view,financials.create,financials.edit,financials.delete,bulkimport.view,reports.view,settings.view,settings.edit,admin';
    await query.run(`
      UPDATE Users SET Permissions = ?
      WHERE Username IN ('admin', 'developer') AND (Permissions IS NULL OR Permissions = '')
    `, [allPerms]);
    const staffPerms = 'dashboard.view,flocks.view,dailylogs.view,dailylogs.create,health.view,sales.view,sales.create,inventory.view,customers.view,suppliers.view,attendance.view,reports.view';
    await query.run(`
      UPDATE Users SET Permissions = ?
      WHERE Username = 'staff' AND (Permissions IS NULL OR Permissions = '')
    `, [staffPerms]);
  }

  // 2. Seed default farm settings
  const settingsCount = await query.get('SELECT COUNT(*) as count FROM FarmSettings');
  if (settingsCount && settingsCount.count === 0) {
    await query.run('INSERT INTO FarmSettings (FarmName, IsGoogleDriveEnabled) VALUES (?, ?)', ['Poultry LMS 360', 0]);
    console.log('Default farm settings seeded.');
  }

  // 3. Seed transaction categories
  const categoryCount = await query.get('SELECT COUNT(*) as count FROM TransactionCategories');
  if (categoryCount && categoryCount.count === 0) {
    const defaultCategories = [
      { Name: 'Egg Sales', IsIncome: 1, Description: 'Revenue from direct egg distribution' },
      { Name: 'Bird Sales', IsIncome: 1, Description: 'Revenue from flock and spent hen sales' },
      { Name: 'Feed Purchase', IsIncome: 0, Description: 'Outflow for chick/layer feed buying' },
      { Name: 'Medicine & Vaccines', IsIncome: 0, Description: 'Healthcare vaccinations and chemicals' },
      { Name: 'Salary Payment', IsIncome: 0, Description: 'Disbursements to farm staff' },
      { Name: 'Equipment Purchase', IsIncome: 0, Description: 'Capital expenditures on farming devices' },
      { Name: 'Utilities & General Overheads', IsIncome: 0, Description: 'Water, power, logistics expenses' },
      { Name: 'General Income', IsIncome: 1, Description: 'Miscellaneous income streams' },
      { Name: 'Feed Consumption', IsIncome: 0, Description: 'Internal feed consumption expenses' },
      { Name: 'Personal Consumption', IsIncome: 0, Description: 'Internal birds eaten by self' },
      { Name: 'Gifts & Donations', IsIncome: 0, Description: 'Internal and external gifted eggs/birds' }
    ];

    for (const cat of defaultCategories) {
      await query.run('INSERT INTO TransactionCategories (Name, IsIncome, Description) VALUES (?, ?, ?)', [
        cat.Name,
        cat.IsIncome,
        cat.Description
      ]);
    }
    console.log('Default transaction categories seeded.');
  }

  // 4. Seed egg inventories
  const eggInventoryCount = await query.get('SELECT COUNT(*) as count FROM EggInventories');
  if (eggInventoryCount && eggInventoryCount.count === 0) {
    await query.run(
      'INSERT INTO EggInventories (GradeOrType, PackSize, Quantity, UnitPrice, SellingPrice) VALUES (?, ?, ?, ?, ?)',
      ['Fresh Eggs', 'Single', 0, 0.15, 0.25]
    );
    await query.run(
      'INSERT INTO EggInventories (GradeOrType, PackSize, Quantity, UnitPrice, SellingPrice) VALUES (?, ?, ?, ?, ?)',
      ['Damaged/Waste Eggs', 'Single', 0, 0.0, 0.05]
    );
    console.log('Default egg inventories seeded.');
  }

  // 5. Seed inventories raw materials
  const inventoryCount = await query.get('SELECT COUNT(*) as count FROM Inventories');
  if (inventoryCount && inventoryCount.count === 0) {
    // Some feeds and raw ingredients
    await query.run(
      'INSERT INTO Inventories (ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Layer Feed (Pre-Mix)', 'Feed', 'Kg', 0.45, 0.60, 5000, 1.0, 500, 'All-in-one standard laying mash']
    );
    await query.run(
      'INSERT INTO Inventories (ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Maize Crushed', 'Raw Ingredient', 'Kg', 0.32, 0.45, 3000, 1.0, 400, 'Feed production ingredient']
    );
    await query.run(
      'INSERT INTO Inventories (ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Soya Meal Concentrate', 'Raw Ingredient', 'Kg', 0.65, 0.82, 1500, 1.0, 200, 'Protein booster ingredient']
    );
    await query.run(
      'INSERT INTO Inventories (ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Mineral & Vitamin Premix', 'Raw Ingredient', 'Kg', 1.20, 1.60, 250, 1.0, 50, 'Vital nutrient premix formulation']
    );
    await query.run(
      'INSERT INTO Inventories (ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Newcastle Vaccine (Vial)', 'Medicine', 'Bottles', 15.00, 20.00, 20, 1.0, 5, 'Highly effective immunization powder']
    );
    console.log('Default inventories seeded.');
  }

  // 6. Seed sample staff
  const staffCount = await query.get('SELECT COUNT(*) as count FROM Staff');
  if (staffCount && staffCount.count === 0) {
    await query.run(
      'INSERT INTO Staff (FullName, Role, Email, Phone, HireDate, MonthlySalary, DailyWages, FixedBonus, FixedDeduction, IsActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['John Smith', 'Manager', 'john@poultrylms.com', '+1-555-0199', '2026-01-15', 3500.00, 0, 100, 0, 1]
    );
    await query.run(
      'INSERT INTO Staff (FullName, Role, Email, Phone, HireDate, MonthlySalary, DailyWages, FixedBonus, FixedDeduction, IsActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['Carlos Gomez', 'Worker', 'carlos@poultrylms.com', '+1-555-1234', '2026-03-10', 0, 45.0, 0, 0, 1]
    );
    console.log('Default staff members seeded.');
  }

  // 7. Auto-synchronize egg inventories stock dynamically to ensure absolute 100% database integrity
  try {
    const totalFreshCollectedRes = await query.get("SELECT IFNULL(SUM(EggsCollected), 0) as total FROM DailyLogs");
    const freshInventoryRow = await query.get("SELECT Id FROM EggInventories WHERE GradeOrType = 'Fresh Eggs'");
    if (freshInventoryRow) {
      const freshInvId = freshInventoryRow.Id;
      const totalFreshSoldRes = await query.get("SELECT IFNULL(SUM(Quantity), 0) as total FROM SaleItems WHERE ItemType = 'Egg' AND EggInventoryId = ?", [freshInvId]);
      const totalFreshReturnedRes = await query.get("SELECT IFNULL(SUM(Quantity), 0) as total FROM SaleReturnItems WHERE ItemType = 'Egg' AND EggInventoryId = ?", [freshInvId]);
      const actualFreshQty = Math.max(0, totalFreshCollectedRes.total - totalFreshSoldRes.total + totalFreshReturnedRes.total);
      
      await query.run("UPDATE EggInventories SET Quantity = ? WHERE Id = ?", [actualFreshQty, freshInvId]);
      console.log(`Auto-synchronized Fresh Eggs Inventory Stock to actual balance of ${actualFreshQty} eggs.`);
    }

    const totalDamagedCollectedRes = await query.get("SELECT IFNULL(SUM(DamagedEggsCollected), 0) as total FROM DailyLogs");
    const damagedInventoryRow = await query.get("SELECT Id FROM EggInventories WHERE GradeOrType = 'Damaged/Waste Eggs'");
    if (damagedInventoryRow) {
      const damagedInvId = damagedInventoryRow.Id;
      const totalDamagedSoldRes = await query.get("SELECT IFNULL(SUM(Quantity), 0) as total FROM SaleItems WHERE ItemType = 'Egg' AND EggInventoryId = ?", [damagedInvId]);
      const totalDamagedReturnedRes = await query.get("SELECT IFNULL(SUM(Quantity), 0) as total FROM SaleReturnItems WHERE ItemType = 'Egg' AND EggInventoryId = ?", [damagedInvId]);
      const actualDamagedQty = Math.max(0, totalDamagedCollectedRes.total - totalDamagedSoldRes.total + totalDamagedReturnedRes.total);

      await query.run("UPDATE EggInventories SET Quantity = ? WHERE Id = ?", [actualDamagedQty, damagedInvId]);
      console.log(`Auto-synchronized Damaged Eggs Inventory Stock to actual balance of ${actualDamagedQty} eggs.`);
    }
  } catch (syncErr) {
    console.error("Failed to run EggInventories auto-synchronization on start:", syncErr);
  }

  // 8. Add item-wise discount columns to PurchaseItems if they don't exist
  try {
    await query.run(`ALTER TABLE PurchaseItems ADD COLUMN DiscountPercentage REAL NOT NULL DEFAULT 0`);
    console.log("Column DiscountPercentage added to PurchaseItems.");
  } catch (err: any) {
    // Already exists
  }
  try {
    await query.run(`ALTER TABLE PurchaseItems ADD COLUMN DiscountAmount REAL NOT NULL DEFAULT 0`);
    console.log("Column DiscountAmount added to PurchaseItems.");
  } catch (err: any) {
    // Already exists
  }

  // 9. Seed default GitHub Backup credentials from user request if empty
  try {
    const currentGit = await query.get<{ GithubBackupPat: string; GithubBackupRepo: string }>('SELECT GithubBackupPat, GithubBackupRepo FROM FarmSettings LIMIT 1');
    if (currentGit) {
      if (!currentGit.GithubBackupPat || !currentGit.GithubBackupRepo) {
        await query.run(`
          UPDATE FarmSettings
          SET GithubBackupPat = ?, GithubBackupRepo = ?, GithubBackupBranch = ?, GithubBackupPath = ?
          WHERE Id = 1
        `, [
          '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',
          'devrupeshgadkhe/Poultry360-Backups',
          'main',
          'backups'
        ]);
        console.log('Pre-configured GitHub Backup credentials successfully seeded into FarmSettings.');
      }
    }
  } catch (err: any) {
    console.error("Failed to seed default GitHub credentials:", err.message);
  }
}
