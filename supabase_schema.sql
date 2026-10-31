-- ==============================================================================
-- POULTRY LMS 360 - MULTI-TENANT POSTGRESQL SCHEMA FOR SUPABASE
-- Complete 1:1 migration matching all existing SQLite tables, columns, defaults & constraints
-- ==============================================================================

-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- CORE MULTI-TENANT TABLE: FARMS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Farms" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmName" TEXT NOT NULL DEFAULT 'Poultry LMS 360',
  "OwnerName" TEXT NOT NULL DEFAULT 'Admin',
  "ContactPhone" TEXT DEFAULT '',
  "ContactEmail" TEXT DEFAULT '',
  "Address" TEXT DEFAULT '',
  "IsActive" INTEGER DEFAULT 1,
  "CreatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- USERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Users" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Username" TEXT UNIQUE NOT NULL,
  "Email" TEXT UNIQUE NOT NULL,
  "PasswordHash" TEXT NOT NULL,
  "Role" TEXT NOT NULL CHECK("Role" IN ('Admin', 'Staff', 'Developer')),
  "FullName" TEXT NOT NULL,
  "IsActive" INTEGER DEFAULT 1,
  "Permissions" TEXT,
  "CreatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- FARM SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "FarmSettings" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FarmName" TEXT NOT NULL DEFAULT 'Poultry LMS 360',
  "IsGoogleDriveEnabled" INTEGER DEFAULT 0,
  "GoogleDriveRefreshToken" TEXT,
  "GoogleDriveAccessToken" TEXT,
  "GoogleDriveTokenExpiry" BIGINT,
  "GoogleDriveEmail" TEXT,
  "GoogleDriveFolderId" TEXT,
  "Address" TEXT NOT NULL DEFAULT '',
  "Phone" TEXT NOT NULL DEFAULT '',
  "Email" TEXT NOT NULL DEFAULT '',
  "Website" TEXT,
  "LogoUrl" TEXT,
  "LastAgeUpdateDate" TEXT,
  "LastBackupDate" TEXT,
  "GithubBackupPat" TEXT,
  "GithubBackupRepo" TEXT,
  "GithubBackupBranch" TEXT,
  "GithubBackupPath" TEXT,
  "CreatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- FLOCKS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Flocks" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FlockName" TEXT NOT NULL,
  "Breed" TEXT NOT NULL,
  "InitialCount" INTEGER NOT NULL,
  "CurrentCount" INTEGER NOT NULL,
  "ArrivalDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'Active' CHECK("Status" IN ('Active', 'Sold', 'Inactive')),
  "EndDate" TEXT,
  "IsActive" INTEGER DEFAULT 1,
  "TotalPurchasePrice" NUMERIC(14,2) NOT NULL,
  "StartDate" TEXT NOT NULL,
  "TotalFeedCost" NUMERIC(14,2) DEFAULT 0,
  "TotalVaccineCost" NUMERIC(14,2) DEFAULT 0,
  "PerBirdPurchasePrice" NUMERIC(14,2) DEFAULT 0,
  "AgeInDays" INTEGER DEFAULT 0,
  "Notes" TEXT
);

-- ==============================================================================
-- INVENTORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Inventories" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "ItemName" TEXT NOT NULL,
  "Category" TEXT NOT NULL CHECK("Category" IN ('Feed', 'Medicine', 'Equipment', 'Sales Item', 'Raw Ingredient')),
  "UnitOfMeasurement" TEXT NOT NULL,
  "UnitPrice" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "SellingPrice" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "CurrentStock" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "WeightPerUnit" NUMERIC(14,2) NOT NULL DEFAULT 1,
  "MinThreshold" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Notes" TEXT,
  CONSTRAINT "UQ_Inventories_Farm_Item" UNIQUE ("FarmId", "ItemName")
);

-- ==============================================================================
-- DAILY LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "DailyLogs" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FlockId" BIGINT NOT NULL REFERENCES "Flocks"("Id") ON DELETE CASCADE,
  "FeedItemId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "FeedConsumedKg" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "MortalityCount" INTEGER NOT NULL DEFAULT 0,
  "EggsCollected" INTEGER NOT NULL DEFAULT 0,
  "DamagedEggsCollected" INTEGER NOT NULL DEFAULT 0,
  "LogDate" TEXT NOT NULL,
  "FeedCost" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "DailyBirdCost" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Notes" TEXT,
  "DailyAverageWeight" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "WaterConsumed" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "BirdsEatenBySelf" INTEGER DEFAULT 0,
  "BirdsEatenValue" NUMERIC(14,2) DEFAULT 0,
  "EggsGifted" INTEGER DEFAULT 0,
  "EggsGiftedValue" NUMERIC(14,2) DEFAULT 0,
  "CustomEggPrice" NUMERIC(14,2),
  "CustomBirdPrice" NUMERIC(14,2)
);

-- ==============================================================================
-- VACCINATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Vaccinations" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FlockId" BIGINT NOT NULL REFERENCES "Flocks"("Id") ON DELETE CASCADE,
  "VaccineName" TEXT NOT NULL,
  "Date" TEXT NOT NULL,
  "Cost" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "AdministeredBy" TEXT,
  "Notes" TEXT,
  "Phase" TEXT NOT NULL DEFAULT 'Administered',
  "ScheduledDate" TEXT
);

-- ==============================================================================
-- EGG INVENTORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "EggInventories" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "GradeOrType" TEXT NOT NULL DEFAULT 'Fresh Eggs',
  "PackSize" TEXT NOT NULL DEFAULT 'Single' CHECK("PackSize" IN ('Single', 'Dozen', 'Tray-30')),
  "Quantity" INTEGER NOT NULL DEFAULT 0,
  "UnitPrice" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "SellingPrice" NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ==============================================================================
-- CUSTOMERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Customers" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FullName" TEXT NOT NULL,
  "Email" TEXT,
  "Phone" TEXT,
  "Company" TEXT,
  "OpeningCreditBalance" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "CurrentCreditBalance" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Address" TEXT
);

-- ==============================================================================
-- SUPPLIERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Suppliers" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "CompanyName" TEXT NOT NULL,
  "ContactPerson" TEXT,
  "Email" TEXT,
  "Phone" TEXT,
  "OpeningCreditBalance" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "CurrentCreditBalance" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Address" TEXT
);

-- ==============================================================================
-- PURCHASES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Purchases" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "SupplierId" BIGINT REFERENCES "Suppliers"("Id") ON DELETE SET NULL,
  "PurchaseDate" TEXT NOT NULL,
  "TotalAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "TotalGSTAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "OtherTaxes" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "ReceivedAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "BalanceAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "InvoiceNumber" TEXT,
  "Status" TEXT NOT NULL CHECK("Status" IN ('Paid', 'Partial', 'Unpaid')),
  "Notes" TEXT
);

-- ==============================================================================
-- PURCHASE ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "PurchaseItems" (
  "Id" BIGSERIAL PRIMARY KEY,
  "PurchaseId" BIGINT NOT NULL REFERENCES "Purchases"("Id") ON DELETE CASCADE,
  "InventoryId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "ItemType" TEXT NOT NULL CHECK("ItemType" IN ('Flock', 'Inventory', 'Feed Ingredient')),
  "Quantity" NUMERIC(14,2) NOT NULL,
  "UnitPrice" NUMERIC(14,2) NOT NULL,
  "DiscountPercentage" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "DiscountAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "GSTPercentage" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "GSTAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "TotalPrice" NUMERIC(14,2) NOT NULL,
  "WeightPerUnit" NUMERIC(14,2) NOT NULL DEFAULT 1,
  "AllocatedOverhead" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "FinalLandedAmount" NUMERIC(14,2) NOT NULL
);

-- ==============================================================================
-- PURCHASE EXTRA EXPENSES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "PurchaseExtraExpenses" (
  "Id" BIGSERIAL PRIMARY KEY,
  "PurchaseId" BIGINT NOT NULL REFERENCES "Purchases"("Id") ON DELETE CASCADE,
  "ExpenseName" TEXT NOT NULL,
  "Amount" NUMERIC(14,2) NOT NULL,
  "AllocationMethod" TEXT NOT NULL CHECK("AllocationMethod" IN ('ByValue', 'ByWeight', 'ByQuantity', 'Equal')),
  "TargetInventoryId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL
);

-- ==============================================================================
-- PURCHASE RETURNS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "PurchaseReturns" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "PurchaseId" BIGINT NOT NULL REFERENCES "Purchases"("Id") ON DELETE CASCADE,
  "ReturnDate" TEXT NOT NULL,
  "TotalReturnAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Notes" TEXT
);

-- ==============================================================================
-- PURCHASE RETURN ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "PurchaseReturnItems" (
  "Id" BIGSERIAL PRIMARY KEY,
  "PurchaseReturnId" BIGINT NOT NULL REFERENCES "PurchaseReturns"("Id") ON DELETE CASCADE,
  "PurchaseItemId" BIGINT REFERENCES "PurchaseItems"("Id") ON DELETE SET NULL,
  "InventoryId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "Quantity" NUMERIC(14,2) NOT NULL,
  "RefundAmount" NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ==============================================================================
-- SALES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Sales" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "CustomerId" BIGINT NOT NULL REFERENCES "Customers"("Id") ON DELETE RESTRICT,
  "SaleDate" TEXT NOT NULL,
  "SubTotal" NUMERIC(14,2) NOT NULL,
  "Discount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "TotalGSTAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "OtherCharges" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "GrandTotal" NUMERIC(14,2) NOT NULL,
  "ReceivedAmount" NUMERIC(14,2) NOT NULL,
  "InvoiceNumber" TEXT,
  "Status" TEXT NOT NULL CHECK("Status" IN ('Paid', 'Partial', 'Unpaid')),
  "Notes" TEXT
);

-- ==============================================================================
-- SALE ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "SaleItems" (
  "Id" BIGSERIAL PRIMARY KEY,
  "SaleId" BIGINT NOT NULL REFERENCES "Sales"("Id") ON DELETE CASCADE,
  "ItemType" TEXT NOT NULL CHECK("ItemType" IN ('Bird', 'Egg', 'General Inventory')),
  "FlockId" BIGINT REFERENCES "Flocks"("Id") ON DELETE SET NULL,
  "EggInventoryId" BIGINT REFERENCES "EggInventories"("Id") ON DELETE SET NULL,
  "InventoryId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "Quantity" NUMERIC(14,2) NOT NULL,
  "UnitPrice" NUMERIC(14,2) NOT NULL,
  "GSTPercentage" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "GSTAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "TotalPrice" NUMERIC(14,2) NOT NULL
);

-- ==============================================================================
-- SALE RETURNS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "SaleReturns" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "SaleId" BIGINT NOT NULL REFERENCES "Sales"("Id") ON DELETE CASCADE,
  "ReturnDate" TEXT NOT NULL,
  "TotalReturnAmount" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Notes" TEXT
);

-- ==============================================================================
-- SALE RETURN ITEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "SaleReturnItems" (
  "Id" BIGSERIAL PRIMARY KEY,
  "SaleReturnId" BIGINT NOT NULL REFERENCES "SaleReturns"("Id") ON DELETE CASCADE,
  "SaleItemId" BIGINT REFERENCES "SaleItems"("Id") ON DELETE SET NULL,
  "ItemType" TEXT NOT NULL CHECK("ItemType" IN ('Bird', 'Egg', 'General Inventory')),
  "FlockId" BIGINT REFERENCES "Flocks"("Id") ON DELETE SET NULL,
  "EggInventoryId" BIGINT REFERENCES "EggInventories"("Id") ON DELETE SET NULL,
  "InventoryId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "Quantity" NUMERIC(14,2) NOT NULL,
  "RefundAmount" NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- ==============================================================================
-- TRANSACTION CATEGORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "TransactionCategories" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Name" TEXT NOT NULL,
  "IsIncome" INTEGER NOT NULL DEFAULT 0,
  "Description" TEXT,
  CONSTRAINT "UQ_TransactionCategories_Farm_Name" UNIQUE ("FarmId", "Name")
);

-- ==============================================================================
-- STAFF TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Staff" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "FullName" TEXT NOT NULL,
  "Role" TEXT NOT NULL,
  "Email" TEXT,
  "Phone" TEXT,
  "HireDate" TEXT NOT NULL,
  "MonthlySalary" NUMERIC(14,2) DEFAULT 0,
  "DailyWages" NUMERIC(14,2) DEFAULT 0,
  "FixedBonus" NUMERIC(14,2) DEFAULT 0,
  "FixedDeduction" NUMERIC(14,2) DEFAULT 0,
  "IsActive" INTEGER DEFAULT 1
);

-- ==============================================================================
-- FINANCIAL TRANSACTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "FinancialTransactions" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Date" TEXT NOT NULL,
  "Amount" NUMERIC(14,2) NOT NULL,
  "Type" TEXT NOT NULL CHECK("Type" IN ('Income', 'Expense')),
  "CategoryId" BIGINT NOT NULL REFERENCES "TransactionCategories"("Id") ON DELETE RESTRICT,
  "Notes" TEXT,
  "FlockId" BIGINT REFERENCES "Flocks"("Id") ON DELETE SET NULL,
  "EggInventoryId" BIGINT REFERENCES "EggInventories"("Id") ON DELETE SET NULL,
  "StaffId" BIGINT REFERENCES "Staff"("Id") ON DELETE SET NULL,
  "SupplierId" BIGINT REFERENCES "Suppliers"("Id") ON DELETE SET NULL,
  "CustomerId" BIGINT REFERENCES "Customers"("Id") ON DELETE SET NULL,
  "PaymentMethod" TEXT DEFAULT 'Cash',
  "Reference" TEXT
);

-- ==============================================================================
-- FOOD RECIPES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "FoodRecipes" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "RecipeName" TEXT NOT NULL,
  "BatchSizeKg" NUMERIC(14,2) NOT NULL DEFAULT 1000,
  "TargetFeedItemId" BIGINT REFERENCES "Inventories"("Id") ON DELETE SET NULL,
  "Notes" TEXT,
  "CreatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UQ_FoodRecipes_Farm_Name" UNIQUE ("FarmId", "RecipeName")
);

-- ==============================================================================
-- RECIPE INGREDIENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "RecipeIngredients" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FoodRecipeId" BIGINT NOT NULL REFERENCES "FoodRecipes"("Id") ON DELETE CASCADE,
  "InventoryId" BIGINT NOT NULL REFERENCES "Inventories"("Id") ON DELETE RESTRICT,
  "Percentage" NUMERIC(14,2) NOT NULL,
  "WeightKg" NUMERIC(14,2) NOT NULL
);

-- ==============================================================================
-- STAFF ATTENDANCES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "StaffAttendances" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "StaffId" BIGINT NOT NULL REFERENCES "Staff"("Id") ON DELETE CASCADE,
  "Date" TEXT NOT NULL,
  "Status" TEXT NOT NULL CHECK("Status" IN ('Present', 'Absent', 'Leave', 'Late', 'HalfDay')),
  "CheckInTime" TEXT,
  "CheckOutTime" TEXT,
  "OvertimeHours" NUMERIC(14,2) DEFAULT 0,
  "Notes" TEXT
);

-- ==============================================================================
-- STAFF PAYROLLS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "StaffPayrolls" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "StaffId" BIGINT NOT NULL REFERENCES "Staff"("Id") ON DELETE CASCADE,
  "Month" INTEGER NOT NULL,
  "Year" INTEGER NOT NULL,
  "BaseSalary" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "OvertimePay" NUMERIC(14,2) DEFAULT 0,
  "Bonus" NUMERIC(14,2) DEFAULT 0,
  "Deductions" NUMERIC(14,2) DEFAULT 0,
  "NetPayable" NUMERIC(14,2) NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL CHECK("Status" IN ('Paid', 'Unpaid', 'Pending')),
  "PayDate" TEXT,
  "TransactionId" BIGINT REFERENCES "FinancialTransactions"("Id") ON DELETE SET NULL
);

-- ==============================================================================
-- HOLIDAYS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "Holidays" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Date" TEXT NOT NULL,
  "Name" TEXT NOT NULL,
  "Type" TEXT NOT NULL CHECK("Type" IN ('Public', 'Individual')),
  "StaffId" BIGINT REFERENCES "Staff"("Id") ON DELETE CASCADE
);

-- ==============================================================================
-- AUDIT LOGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "AuditLogs" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "UserEmail" TEXT,
  "Module" TEXT,
  "Action" TEXT,
  "Parameters" TEXT,
  "Status" TEXT,
  "ExceptionMessage" TEXT,
  "StackTrace" TEXT,
  "IpAddress" TEXT,
  "HttpMethod" TEXT,
  "Url" TEXT
);

-- ==============================================================================
-- JAVASCRIPT ERRORS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS "JavascriptErrors" (
  "Id" BIGSERIAL PRIMARY KEY,
  "FarmId" BIGINT REFERENCES "Farms"("Id") ON DELETE CASCADE,
  "Timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "Source" TEXT NOT NULL,
  "Message" TEXT,
  "Stack" TEXT,
  "Url" TEXT,
  "UserAgent" TEXT,
  "UserEmail" TEXT
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS "IDX_Users_FarmId" ON "Users"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_Flocks_FarmId" ON "Flocks"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_DailyLogs_FarmId" ON "DailyLogs"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_DailyLogs_FlockId" ON "DailyLogs"("FlockId");
CREATE INDEX IF NOT EXISTS "IDX_DailyLogs_LogDate" ON "DailyLogs"("LogDate");
CREATE INDEX IF NOT EXISTS "IDX_Inventories_FarmId" ON "Inventories"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_Sales_FarmId" ON "Sales"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_Purchases_FarmId" ON "Purchases"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_Financial_FarmId" ON "FinancialTransactions"("FarmId");
CREATE INDEX IF NOT EXISTS "IDX_StaffAttendances_FarmId" ON "StaffAttendances"("FarmId");

-- ==============================================================================
-- SEED DATA (INITIAL FARM & DEFAULT RECORDS)
-- ==============================================================================
INSERT INTO "Farms" ("Id", "FarmName", "OwnerName", "ContactPhone", "ContactEmail")
VALUES (1, 'Poultry LMS 360 (Default)', 'Farm Administrator', '+91-9876543210', 'admin@poultrylms.com')
ON CONFLICT ("Id") DO NOTHING;

-- Seed Default Farm Settings
INSERT INTO "FarmSettings" (
  "Id", "FarmId", "FarmName", "IsGoogleDriveEnabled", "GithubBackupPat", "GithubBackupRepo", "GithubBackupBranch", "GithubBackupPath"
) VALUES (
  1, 1, 'Poultry LMS 360', 0, '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', 'devrupeshgadkhe/Poultry360-Backups', 'main', 'backups'
) ON CONFLICT ("Id") DO NOTHING;

-- Seed Default Users (Password hashes are SHA256 of admin123, dev123, staff123)
INSERT INTO "Users" ("Username", "Email", "PasswordHash", "Role", "FullName", "IsActive", "Permissions", "FarmId")
VALUES 
(
  'admin', 'admin@poultrylms.com', 
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 
  'Admin', 'Farm Administrator', 1, 
  'dashboard.view,flocks.view,flocks.create,flocks.edit,flocks.delete,dailylogs.view,dailylogs.create,dailylogs.edit,dailylogs.delete,health.view,health.create,health.edit,health.delete,sales.view,sales.create,sales.edit,sales.delete,purchases.view,purchases.create,purchases.edit,purchases.delete,inventory.create,inventory.edit,inventory.delete,inventory.view,customers.view,customers.create,customers.edit,customers.delete,suppliers.view,suppliers.create,suppliers.edit,suppliers.delete,staff.view,staff.create,staff.edit,staff.delete,attendance.view,attendance.edit,payroll.view,payroll.create,payroll.edit,financials.view,financials.create,financials.edit,financials.delete,bulkimport.view,reports.view,settings.view,settings.edit,admin',
  1
),
(
  'developer', 'dev@poultrylms.com', 
  '788b1f5e6a978f8b868bc289b4f932e6a147ef5c986c72e2cfcfffeaa82d43a6', 
  'Developer', 'Lead System Developer', 1, 
  'dashboard.view,flocks.view,flocks.create,flocks.edit,flocks.delete,dailylogs.view,dailylogs.create,dailylogs.edit,dailylogs.delete,health.view,health.create,health.edit,health.delete,sales.view,sales.create,sales.edit,sales.delete,purchases.view,purchases.create,purchases.edit,purchases.delete,inventory.create,inventory.edit,inventory.delete,inventory.view,customers.view,customers.create,customers.edit,customers.delete,suppliers.view,suppliers.create,suppliers.edit,suppliers.delete,staff.view,staff.create,staff.edit,staff.delete,attendance.view,attendance.edit,payroll.view,payroll.create,payroll.edit,financials.view,financials.create,financials.edit,financials.delete,bulkimport.view,reports.view,settings.view,settings.edit,admin',
  1
),
(
  'staff', 'staff@poultrylms.com', 
  '1206f6580f48f328be4da5f2038ea8f3ea7f12e84ec710b10620aaaebe85e96f', 
  'Staff', 'Operations Supervisor', 1, 
  'dashboard.view,flocks.view,dailylogs.view,dailylogs.create,health.view,sales.view,sales.create,inventory.view,customers.view,suppliers.view,attendance.view,reports.view',
  1
)
ON CONFLICT ("Username") DO NOTHING;

-- Seed Default Transaction Categories
INSERT INTO "TransactionCategories" ("FarmId", "Name", "IsIncome", "Description") VALUES
(1, 'Egg Sales', 1, 'Revenue from direct egg distribution'),
(1, 'Bird Sales', 1, 'Revenue from flock and spent hen sales'),
(1, 'Feed Purchase', 0, 'Outflow for chick/layer feed buying'),
(1, 'Medicine & Vaccines', 0, 'Healthcare vaccinations and chemicals'),
(1, 'Salary Payment', 0, 'Disbursements to farm staff'),
(1, 'Equipment Purchase', 0, 'Capital expenditures on farming devices'),
(1, 'Utilities & General Overheads', 0, 'Water, power, logistics expenses'),
(1, 'General Income', 1, 'Miscellaneous income streams'),
(1, 'Feed Consumption', 0, 'Internal feed consumption expenses'),
(1, 'Personal Consumption', 0, 'Internal birds eaten by self'),
(1, 'Gifts & Donations', 0, 'Internal and external gifted eggs/birds')
ON CONFLICT ("FarmId", "Name") DO NOTHING;

-- Seed Default Egg Inventories
INSERT INTO "EggInventories" ("FarmId", "GradeOrType", "PackSize", "Quantity", "UnitPrice", "SellingPrice") VALUES
(1, 'Fresh Eggs', 'Single', 0, 0.15, 0.25),
(1, 'Damaged/Waste Eggs', 'Single', 0, 0.0, 0.05);

-- Seed Default Inventories Raw Materials
INSERT INTO "Inventories" ("FarmId", "ItemName", "Category", "UnitOfMeasurement", "UnitPrice", "SellingPrice", "CurrentStock", "WeightPerUnit", "MinThreshold", "Notes") VALUES
(1, 'Layer Feed (Pre-Mix)', 'Feed', 'Kg', 0.45, 0.60, 5000, 1.0, 500, 'All-in-one standard laying mash'),
(1, 'Maize Crushed', 'Raw Ingredient', 'Kg', 0.32, 0.45, 3000, 1.0, 400, 'Feed production ingredient'),
(1, 'Soya Meal Concentrate', 'Raw Ingredient', 'Kg', 0.65, 0.82, 1500, 1.0, 200, 'Protein booster ingredient'),
(1, 'Mineral & Vitamin Premix', 'Raw Ingredient', 'Kg', 1.20, 1.60, 250, 1.0, 50, 'Vital nutrient premix formulation'),
(1, 'Newcastle Vaccine (Vial)', 'Medicine', 'Bottles', 15.00, 20.00, 20, 1.0, 5, 'Highly effective immunization powder')
ON CONFLICT ("FarmId", "ItemName") DO NOTHING;

-- Reset Sequences to prevent ID collision
SELECT setval(pg_get_serial_sequence('"Farms"', 'Id'), COALESCE((SELECT MAX("Id") FROM "Farms"), 1));
SELECT setval(pg_get_serial_sequence('"Users"', 'Id'), COALESCE((SELECT MAX("Id") FROM "Users"), 1));
SELECT setval(pg_get_serial_sequence('"FarmSettings"', 'Id'), COALESCE((SELECT MAX("Id") FROM "FarmSettings"), 1));
SELECT setval(pg_get_serial_sequence('"TransactionCategories"', 'Id'), COALESCE((SELECT MAX("Id") FROM "TransactionCategories"), 1));
SELECT setval(pg_get_serial_sequence('"EggInventories"', 'Id'), COALESCE((SELECT MAX("Id") FROM "EggInventories"), 1));
SELECT setval(pg_get_serial_sequence('"Inventories"', 'Id'), COALESCE((SELECT MAX("Id") FROM "Inventories"), 1));
