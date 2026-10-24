-- ==============================================================================
-- POULTRY LMS 360 - COMPLETE FORM DATA RESET & IDENTITY RESTART SCRIPT
-- ==============================================================================
-- उद्देश: सर्व फॉर्म्सचा (Flocks, Daily Logs, Sales, Purchases, Staff, 
-- Customers, Suppliers, Financial Transactions, Recipes इत्यादी) डेटा पूर्णपणे डिलीट करणे
-- आणि Auto-increment ID (Identity) पुन्हा १ वरून सुरू करणे.
-- 
-- सुरक्षित राहणारा डेटा (Seeded / Configuration Tables - NO DATA LOSS):
--  1. Farms (फार्म प्रोफाइल, ID = 1)
--  2. Users (Admin, Staff, Developer युजर्स आणि त्यांचे लॉगिन पासवर्ड्स)
--  3. FarmSettings (फार्म सेटिंग्स, लोगो, गुगल ड्राईव्ह, GitHub बॅकअप कॉन्फिगरेशन)
--  4. TransactionCategories (सर्व ११ डीफॉल्ट इन्कम आणि एक्सपेंस कॅटेगरीज)
--  5. EggInventories (डीफॉल्ट अंडी प्रकार सुरक्षित राहतील, फक्त Quantity = 0 होईल)
--  6. Inventories (डीफॉल्ट ५ फीड व मेडिसिन आयटम्स सुरक्षित राहतील, CurrentStock = 0 होईल)
-- ==============================================================================

BEGIN;

-- १. सर्व फॉर्म्स व ट्रान्झॅक्शनल टेबल्सचा डेटा साफ करणे आणि Identity (Auto-increment ID) १ वर रिसेट करणे
TRUNCATE TABLE 
  "DailyLogs",
  "Vaccinations",
  "SaleReturnItems",
  "SaleReturns",
  "SaleItems",
  "Sales",
  "PurchaseReturnItems",
  "PurchaseReturns",
  "PurchaseExtraExpenses",
  "PurchaseItems",
  "Purchases",
  "RecipeIngredients",
  "FoodRecipes",
  "StaffPayrolls",
  "StaffAttendances",
  "Holidays",
  "FinancialTransactions",
  "Flocks",
  "Customers",
  "Suppliers",
  "Staff",
  "AuditLogs",
  "JavascriptErrors"
RESTART IDENTITY CASCADE;

-- जर FeedProductionLogs टेबल अस्तित्वात असेल तर तेही सुरक्षितपणे रिसेट करणे
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'FeedProductionLogs') THEN 
    EXECUTE 'TRUNCATE TABLE "FeedProductionLogs" RESTART IDENTITY CASCADE'; 
  END IF; 
END $$;

-- २. अंडी इन्व्हेंटरी (EggInventories) रिसेट करणे (साठा शून्य ० करणे)
UPDATE "EggInventories" 
SET "Quantity" = 0;

-- ३. इन्व्हेंटरी (Inventories) रिसेट करून मूळ ५ सीडेड आयटम्स ठेवणे आणि स्टॉक शून्य ० करणे
TRUNCATE TABLE "Inventories" RESTART IDENTITY CASCADE;

INSERT INTO "Inventories" (
  "Id", "FarmId", "ItemName", "Category", "UnitOfMeasurement", 
  "UnitPrice", "SellingPrice", "CurrentStock", "WeightPerUnit", "MinThreshold", "Notes"
) VALUES 
(1, 1, 'Layer Feed (Pre-Mix)', 'Feed', 'Kg', 0.45, 0.60, 0, 1.0, 500, 'All-in-one standard laying mash'),
(2, 1, 'Maize Crushed', 'Raw Ingredient', 'Kg', 0.32, 0.45, 0, 1.0, 400, 'Feed production ingredient'),
(3, 1, 'Soya Meal Concentrate', 'Raw Ingredient', 'Kg', 0.65, 0.82, 0, 1.0, 200, 'Protein booster ingredient'),
(4, 1, 'Mineral & Vitamin Premix', 'Raw Ingredient', 'Kg', 1.20, 1.60, 0, 1.0, 50, 'Vital nutrient premix formulation'),
(5, 1, 'Newcastle Vaccine (Vial)', 'Medicine', 'Bottles', 15.00, 20.00, 0, 1.0, 5, 'Highly effective immunization powder')
ON CONFLICT ("FarmId", "ItemName") DO UPDATE SET "CurrentStock" = 0;

-- Inventories चा Sequence ५ वर सेट करणे जेणेकरून पुढील नवीन आयटम Id = 6 पासून सुरू होईल
SELECT setval(pg_get_serial_sequence('"Inventories"', 'Id'), 5);

-- ४. महत्त्वाच्या सीडेड टेबल्सचे सिक्वेन्स (Sequence / Identity) व्यवस्थित असल्याची खात्री करणे
SELECT setval(pg_get_serial_sequence('"Farms"', 'Id'), COALESCE((SELECT MAX("Id") FROM "Farms"), 1));
SELECT setval(pg_get_serial_sequence('"Users"', 'Id'), COALESCE((SELECT MAX("Id") FROM "Users"), 1));
SELECT setval(pg_get_serial_sequence('"FarmSettings"', 'Id'), COALESCE((SELECT MAX("Id") FROM "FarmSettings"), 1));
SELECT setval(pg_get_serial_sequence('"TransactionCategories"', 'Id'), COALESCE((SELECT MAX("Id") FROM "TransactionCategories"), 1));
SELECT setval(pg_get_serial_sequence('"EggInventories"', 'Id'), COALESCE((SELECT MAX("Id") FROM "EggInventories"), 1));

COMMIT;
