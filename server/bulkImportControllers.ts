import { Request, Response } from 'express';
import { query } from './db.js';
import { logAudit } from './controllers.js';
import { syncRecordToSupabase } from './supabase.js';

// Custom lightweight CSV parser
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

export const bulkImportControllers = {
  // POST /api/bulk-import/parse
  async parseImportData(req: Request, res: Response) {
    const { type, csvData } = req.body;
    const targetFarmId = Number(req.body.farmId || req.query.farmId || req.headers['x-farm-id']) || 1;
    try {
      if (!type || !csvData) {
        return res.status(400).json({ error: 'Import type and CSV data are required fields.' });
      }

      const rows = parseCSV(csvData);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'The uploaded file/content is empty.' });
      }

      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some(cell => cell.trim() !== ''));

      const parsedRecords: any[] = [];
      const validationSummary = {
        total: dataRows.length,
        valid: 0,
        duplicate: 0,
        invalid: 0
      };

      // To lookup inventories, flocks, suppliers, customers to pre-validate scoped to farm
      const inventories = await query.all<{ Id: number, ItemName: string, FarmId: number }>(
        'SELECT Id, ItemName, FarmId FROM Inventories WHERE FarmId = ? OR FarmId IS NULL',
        [targetFarmId]
      );
      const flocks = await query.all<{ Id: number, FlockName: string, FarmId: number }>(
        'SELECT Id, FlockName, FarmId FROM Flocks WHERE FarmId = ? OR FarmId IS NULL',
        [targetFarmId]
      );
      const allFlocks = await query.all<{ Id: number, FlockName: string, FarmId: number }>('SELECT Id, FlockName, FarmId FROM Flocks');
      const suppliers = await query.all<{ Id: number, CompanyName: string, FarmId: number }>(
        'SELECT Id, CompanyName, FarmId FROM Suppliers WHERE FarmId = ? OR FarmId IS NULL',
        [targetFarmId]
      );
      const customers = await query.all<{ Id: number, FullName: string, FarmId: number }>(
        'SELECT Id, FullName, FarmId FROM Customers WHERE FarmId = ? OR FarmId IS NULL',
        [targetFarmId]
      );
      const eggInventories = await query.all<{ Id: number, GradeOrType: string, FarmId: number }>(
        'SELECT Id, GradeOrType, FarmId FROM EggInventories WHERE FarmId = ? OR FarmId IS NULL',
        [targetFarmId]
      );

      // Existing core tables for duplicate detection scoped by FarmId
      const existingInvs = new Set(inventories.map(inv => inv.ItemName.toLowerCase().trim()));
      
      const existingPurchasesInvoices = new Set(
        (await query.all<{ InvoiceNumber: string }>('SELECT InvoiceNumber FROM Purchases WHERE (FarmId = ? OR FarmId IS NULL) AND InvoiceNumber IS NOT NULL AND InvoiceNumber != ""', [targetFarmId]))
          .map(p => p.InvoiceNumber.toLowerCase().trim())
      );

      const existingSalesInvoices = new Set(
        (await query.all<{ InvoiceNumber: string }>('SELECT InvoiceNumber FROM Sales WHERE (FarmId = ? OR FarmId IS NULL) AND InvoiceNumber IS NOT NULL AND InvoiceNumber != ""', [targetFarmId]))
          .map(s => s.InvoiceNumber.toLowerCase().trim())
      );

      const existingDailyLogs = await query.all<{ FlockId: number, LogDate: string }>('SELECT FlockId, LogDate FROM DailyLogs WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]);
      const dailyLogSet = new Set(existingDailyLogs.map(log => `${log.FlockId}_${(log.LogDate || '').split('T')[0]}`));

      for (let index = 0; index < dataRows.length; index++) {
        const rawRow = dataRows[index];
        const record: any = {};
        
        // Map list values to keys based on header row
        headers.forEach((header, colIndex) => {
          if (header) {
            record[header] = rawRow[colIndex] ? rawRow[colIndex].trim() : '';
          }
        });

        let status: 'Valid' | 'Duplicate' | 'Invalid' = 'Valid';
        const errors: string[] = [];
        const details: string[] = [];

        if (type === 'items') {
          // Fields: ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes
          const itemName = record.ItemName || '';
          const category = record.Category || '';
          const uom = record.UnitOfMeasurement || '';

          if (!itemName) {
            errors.push('Missing unique ItemName');
            status = 'Invalid';
          }
          if (!category) {
            errors.push('Missing Category');
            status = 'Invalid';
          } else {
            const allowedCats = ['Feed', 'Medicine', 'Equipment', 'Sales Item', 'Raw Ingredient'];
            if (!allowedCats.includes(category)) {
              errors.push(`Invalid Category. Choose from: ${allowedCats.join(', ')}`);
              status = 'Invalid';
            }
          }
          if (!uom) {
            errors.push('Missing UnitOfMeasurement');
            status = 'Invalid';
          }

          if (itemName && existingInvs.has(itemName.toLowerCase().trim())) {
            status = 'Duplicate';
            details.push(`Item "${itemName}" already exists. It will be skipped.`);
          } else if (status === 'Valid') {
            details.push(`New item to be registered: "${itemName}" (${category})`);
          }

        } else if (type === 'daily-logs') {
          // Fields: FlockName, LogDate, FeedName, FeedConsumedKg, MortalityCount, EggsCollected, DamagedEggsCollected, WaterConsumed, DailyAverageWeight, BirdsEatenBySelf, BirdsEatenValue, EggsGifted, EggsGiftedValue, Notes
          const flockName = record.FlockName || '';
          const logDate = record.LogDate || '';
          const feedName = record.FeedName || '';

          if (!flockName) {
            errors.push('Missing FlockName');
            status = 'Invalid';
          }
          if (!logDate) {
            errors.push('Missing LogDate (YYYY-MM-DD)');
            status = 'Invalid';
          } else if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
            errors.push('Invalid Date format. Must be YYYY-MM-DD');
            status = 'Invalid';
          }

          let matchedFlock = flocks.find(f => f.FlockName.toLowerCase().trim() === flockName.toLowerCase().trim());
          if (!matchedFlock) {
            matchedFlock = allFlocks.find(f => f.FlockName.toLowerCase().trim() === flockName.toLowerCase().trim());
          }

          if (!matchedFlock) {
            errors.push(`Flock name "${flockName}" is not registered in DB`);
            status = 'Invalid';
          } else {
            record._flockId = matchedFlock.Id;
            record._farmId = matchedFlock.FarmId || targetFarmId;
            const logKey = `${matchedFlock.Id}_${logDate}`;
            if (dailyLogSet.has(logKey)) {
              status = 'Duplicate';
              details.push(`Daily log for flock "${flockName}" on ${logDate} already exists. It will be skipped.`);
            } else {
              details.push(`Matched Flock "${flockName}" (ID: ${matchedFlock.Id})`);
            }
          }

          if (feedName) {
            const matchedFeed = inventories.find(inv => inv.ItemName.toLowerCase().trim() === feedName.toLowerCase().trim());
            if (matchedFeed) {
              record._feedItemId = matchedFeed.Id;
              details.push(`Matched Feed Item: "${feedName}" (ID: ${matchedFeed.Id})`);
            } else {
              record._feedItemId = null;
              details.push(`Feed item "${feedName}" is not registered. A default feed item "Default Feed" will be matched or auto-created.`);
            }
          } else {
            record._feedItemId = null;
          }

        } else if (type === 'purchases') {
          // Fields: InvoiceNumber, SupplierName, PurchaseDate, ItemName, ItemType, Quantity, UnitPrice, GSTPercentage, ReceivedAmount, Status, Notes
          const invoiceNo = record.InvoiceNumber || '';
          const supplierName = record.SupplierName || '';
          const purchaseDate = record.PurchaseDate || '';
          const itemName = record.ItemName || '';
          const itemType = record.ItemType || 'Inventory';

          if (!supplierName) {
            errors.push('Missing SupplierName');
            status = 'Invalid';
          }
          if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
            errors.push('Missing or invalid PurchaseDate (YYYY-MM-DD)');
            status = 'Invalid';
          }
          if (!itemName) {
            errors.push('Missing ItemName');
            status = 'Invalid';
          }
          
          const qty = parseFloat(record.Quantity || '0');
          if (isNaN(qty) || qty <= 0) {
            errors.push('Quantity must be a positive number');
            status = 'Invalid';
          }

          const price = parseFloat(record.UnitPrice || '0');
          if (isNaN(price) || price < 0) {
            errors.push('UnitPrice must be 0 or greater');
            status = 'Invalid';
          }

          if (invoiceNo && existingPurchasesInvoices.has(invoiceNo.toLowerCase().trim())) {
            status = 'Duplicate';
            details.push(`Invoice "${invoiceNo}" already exists in Purchases. It will be skipped.`);
          } else {
            const matchedSupplier = suppliers.find(s => s.CompanyName.toLowerCase().trim() === supplierName.toLowerCase().trim());
            if (matchedSupplier) {
              record._supplierId = matchedSupplier.Id;
              details.push(`Matched existing Supplier: "${supplierName}"`);
            } else {
              details.push(`Supplier name "${supplierName}" is new. A new supplier profile will be auto-generated.`);
            }

            if (itemType === 'Flock') {
              const matchedFlock = flocks.find(f => f.FlockName.toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedFlock) {
                errors.push(`Flock name "${itemName}" must be created first to purchase flock items`);
                status = 'Invalid';
              } else {
                record._flockId = matchedFlock.Id;
                details.push(`Matched active flock "${itemName}"`);
              }
            } else {
              const matchedItem = inventories.find(inv => inv.ItemName.toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedItem) {
                errors.push(`Inventory Item "${itemName}" not found. Create it or match exact spelling.`);
                status = 'Invalid';
              } else {
                record._inventoryId = matchedItem.Id;
                details.push(`Matched Item: "${itemName}" (ID: ${matchedItem.Id})`);
              }
            }
          }

        } else if (type === 'sales') {
          // Fields: InvoiceNumber, CustomerName, SaleDate, ItemName, ItemType, Quantity, UnitPrice, GSTPercentage, Discount, OtherCharges, ReceivedAmount, Status, Notes
          const invoiceNo = record.InvoiceNumber || '';
          const customerName = record.CustomerName || '';
          const saleDate = record.SaleDate || '';
          const itemName = record.ItemName || '';
          const itemType = record.ItemType || 'General Inventory';

          if (!customerName) {
            errors.push('Missing CustomerName');
            status = 'Invalid';
          }
          if (!saleDate || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
            errors.push('Missing or invalid SaleDate (YYYY-MM-DD)');
            status = 'Invalid';
          }
          if (!itemName) {
            errors.push('Missing ItemName');
            status = 'Invalid';
          }

          const qty = parseFloat(record.Quantity || '0');
          if (isNaN(qty) || qty <= 0) {
            errors.push('Quantity must be a positive number');
            status = 'Invalid';
          }

          const price = parseFloat(record.UnitPrice || '0');
          if (isNaN(price) || price < 0) {
            errors.push('UnitPrice must be 0 or greater');
            status = 'Invalid';
          }

          if (invoiceNo && existingSalesInvoices.has(invoiceNo.toLowerCase().trim())) {
            status = 'Duplicate';
            details.push(`Invoice "${invoiceNo}" already exists in Sales. It will be skipped.`);
          } else {
            const matchedCustomer = customers.find(c => c.FullName.toLowerCase().trim() === customerName.toLowerCase().trim());
            if (matchedCustomer) {
              record._customerId = matchedCustomer.Id;
              details.push(`Found existing Customer: "${customerName}"`);
            } else {
              details.push(`Customer "${customerName}" is new. A profile will be auto-generated.`);
            }

            if (itemType === 'Bird') {
              const matchedFlock = flocks.find(f => f.FlockName.toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedFlock) {
                errors.push(`Flock/Bird name "${itemName}" not found in current layer flocks.`);
                status = 'Invalid';
              } else {
                record._flockId = matchedFlock.Id;
                details.push(`Matched Flock: "${itemName}" (Birds remaining: ${matchedFlock.Id})`);
              }
            } else if (itemType === 'Egg') {
              const matchedEgg = eggInventories.find(e => e.GradeOrType.toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedEgg) {
                // fall back to default
                const defEgg = eggInventories.find(e => e.GradeOrType === 'Fresh Eggs') || eggInventories[0];
                record._eggInventoryId = defEgg ? defEgg.Id : 1;
                details.push(`Egg category assumed: "${defEgg ? defEgg.GradeOrType : 'Fresh Eggs'}"`);
              } else {
                record._eggInventoryId = matchedEgg.Id;
                details.push(`Matched Egg Category: "${matchedEgg.GradeOrType}"`);
              }
            } else {
              // General Inventory
              const matchedItem = inventories.find(inv => inv.ItemName.toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedItem) {
                errors.push(`Item "${itemName}" is not registered in Warehouse Stock`);
                status = 'Invalid';
              } else {
                record._inventoryId = matchedItem.Id;
                details.push(`Matched Item: "${itemName}" (Stock ID: ${matchedItem.Id})`);
              }
            }
          }
        }

        // Adjust totals
        if (status === 'Valid') validationSummary.valid++;
        else if (status === 'Duplicate') validationSummary.duplicate++;
        else validationSummary.invalid++;

        parsedRecords.push({
          rowNumber: index + 2, // 1-indexed plus header row offset
          status,
          errors,
          details,
          record
        });
      }

      res.json({
        type,
        validationSummary,
        records: parsedRecords
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // POST /api/bulk-import/commit
  async commitImportData(req: Request, res: Response) {
    const { type, records } = req.body;
    const targetFarmId = Number(req.body.farmId || req.query.farmId || req.headers['x-farm-id']) || 1;
    try {
      if (!type || !records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Import type and valid records array are required.' });
      }

      const validRecords = records.filter(p => p.status === 'Valid');
      if (validRecords.length === 0) {
        return res.json({ message: 'Zero valid records uploaded / parsed. No changes made.', count: 0 });
      }

      let saveCount = 0;
      let duplicateSkipCount = 0;

      if (type === 'items') {
        for (const pr of validRecords) {
          const rec = pr.record;
          const name = rec.ItemName;
          
          // Re-verify duplicates inside the transaction to avoid race conditions
          const exists = await query.get('SELECT Id FROM Inventories WHERE ItemName = ? AND (FarmId = ? OR FarmId IS NULL)', [name, targetFarmId]);
          if (exists) {
            duplicateSkipCount++;
            continue;
          }

          const cat = rec.Category;
          const uom = rec.UnitOfMeasurement;
          const unitPrice = parseFloat(rec.UnitPrice || '0');
          const sellPrice = parseFloat(rec.SellingPrice || '0');
          const stock = parseFloat(rec.CurrentStock || '0');
          const weight = parseFloat(rec.WeightPerUnit || '1');
          const threshold = parseFloat(rec.MinThreshold || '0');
          const notes = rec.Notes || '';

          const insertRes = await query.run(`
            INSERT INTO Inventories (FarmId, ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [targetFarmId, name, cat, uom, unitPrice, sellPrice, stock, weight, threshold, notes]);
          const itemId = insertRes.lastID;
          saveCount++;

          syncRecordToSupabase('Inventories', {
            Id: itemId,
            FarmId: targetFarmId,
            ItemName: name,
            Category: cat,
            UnitOfMeasurement: uom,
            UnitPrice: unitPrice,
            SellingPrice: sellPrice,
            CurrentStock: stock,
            WeightPerUnit: weight,
            MinThreshold: threshold,
            Notes: notes
          });
        }

      } else if (type === 'daily-logs') {
        for (const pr of validRecords) {
          const rec = pr.record;
          const logDate = rec.LogDate;
          const flockId = rec._flockId;

          // Re-verify duplicates
          const exists = await query.get('SELECT Id FROM DailyLogs WHERE FlockId = ? AND LogDate = ?', [flockId, logDate]);
          if (exists) {
            duplicateSkipCount++;
            continue;
          }

          // Ensure correct FarmId is derived from Flock
          const flock = await query.get<{ Id: number, FarmId: number, TotalFeedCost: number, CurrentCount: number, Status: string, PerBirdPurchasePrice: number }>('SELECT * FROM Flocks WHERE Id = ?', [flockId]);
          const rowFarmId = (flock && flock.FarmId) ? flock.FarmId : (rec._farmId || targetFarmId);

          const feedConsumed = parseFloat(rec.FeedConsumedKg || '0');
          const mortality = parseInt(rec.MortalityCount || '0');
          const eggs = parseInt(rec.EggsCollected || '0');
          const damagedEggs = parseInt(rec.DamagedEggsCollected || '0');
          const water = parseFloat(rec.WaterConsumed || '0');
          const weight = parseFloat(rec.DailyAverageWeight || '0');
          const birdsEatenBySelf = parseInt(rec.BirdsEatenBySelf || '0');
          const birdsEatenValue = parseFloat(rec.BirdsEatenValue || '0');
          const eggsGifted = parseInt(rec.EggsGifted || '0');
          const eggsGiftedValue = parseFloat(rec.EggsGiftedValue || '0');
          const notes = rec.Notes || '';

          // Look up or fallback/create feed item dynamically
          let feedItemId = rec._feedItemId || null;
          let feedUnitPrice = 30.00;
          let matchedFeedItem: any = null;

          if (feedItemId) {
            matchedFeedItem = await query.get("SELECT * FROM Inventories WHERE Id = ?", [feedItemId]);
          } else {
            const feedNameInput = rec.FeedName || '';
            if (feedNameInput) {
              matchedFeedItem = await query.get("SELECT * FROM Inventories WHERE (FarmId = ? OR FarmId IS NULL) AND ItemName = ?", [rowFarmId, feedNameInput]);
            }
            if (!matchedFeedItem) {
              matchedFeedItem = await query.get("SELECT * FROM Inventories WHERE (FarmId = ? OR FarmId IS NULL) AND Category = 'Feed' LIMIT 1", [rowFarmId]);
            }
            if (!matchedFeedItem && feedConsumed > 0) {
              // Auto create Default Feed item
              const insertFeed = await query.run(`
                INSERT INTO Inventories (FarmId, ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes)
                VALUES (?, 'Default Feed', 'Feed', 'Kg', 30.00, 0, 0, 1, 0, 'Auto-created default feed for historical tracking')
              `, [rowFarmId]);
              matchedFeedItem = { Id: insertFeed.lastID, FarmId: rowFarmId, ItemName: 'Default Feed', UnitPrice: 30.00, CurrentStock: 0 };
              syncRecordToSupabase('Inventories', {
                Id: insertFeed.lastID,
                FarmId: rowFarmId,
                ItemName: 'Default Feed',
                Category: 'Feed',
                UnitOfMeasurement: 'Kg',
                UnitPrice: 30.00,
                SellingPrice: 0,
                CurrentStock: 0,
                WeightPerUnit: 1,
                MinThreshold: 0,
                Notes: 'Auto-created default feed for historical tracking'
              });
            }
          }

          if (matchedFeedItem) {
            feedItemId = matchedFeedItem.Id;
            feedUnitPrice = matchedFeedItem.UnitPrice || 30.00;
            if (feedConsumed > 0) {
              await query.run('UPDATE Inventories SET CurrentStock = CurrentStock - ? WHERE Id = ?', [feedConsumed, feedItemId]);
              syncRecordToSupabase('Inventories', {
                Id: feedItemId,
                FarmId: rowFarmId,
                CurrentStock: (matchedFeedItem.CurrentStock || 0) - feedConsumed
              });
            }
          }

          const feedCost = feedConsumed * feedUnitPrice;
          const dailyBirdCost = (flock && flock.PerBirdPurchasePrice) ? flock.PerBirdPurchasePrice : 0;

          // Insert Daily Log with rowFarmId
          const logInsertResult = await query.run(`
            INSERT INTO DailyLogs (
              FarmId, FlockId, FeedItemId, FeedConsumedKg, MortalityCount, EggsCollected, DamagedEggsCollected, LogDate, 
              FeedCost, DailyBirdCost, Notes, DailyAverageWeight, WaterConsumed,
              BirdsEatenBySelf, BirdsEatenValue, EggsGifted, EggsGiftedValue
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            rowFarmId, flockId, feedItemId, feedConsumed, mortality, eggs, damagedEggs, logDate, 
            feedCost, dailyBirdCost, notes, weight, water,
            birdsEatenBySelf, birdsEatenValue, eggsGifted, eggsGiftedValue
          ]);

          const logId = logInsertResult.lastID;

          // Sync DailyLog to Supabase
          syncRecordToSupabase('DailyLogs', {
            Id: logId,
            FarmId: rowFarmId,
            FlockId: flockId,
            FeedItemId: feedItemId,
            FeedConsumedKg: feedConsumed,
            MortalityCount: mortality,
            EggsCollected: eggs,
            DamagedEggsCollected: damagedEggs,
            LogDate: logDate,
            FeedCost: feedCost,
            DailyBirdCost: dailyBirdCost,
            Notes: notes,
            DailyAverageWeight: weight,
            WaterConsumed: water,
            BirdsEatenBySelf: birdsEatenBySelf,
            BirdsEatenValue: birdsEatenValue,
            EggsGifted: eggsGifted,
            EggsGiftedValue: eggsGiftedValue
          });

          // Update current flock head count live & Total Feed Cost
          let updatedFeedCost = feedCost;
          let newCurrentCount = 0;
          let status = 'Active';
          if (flock) {
            updatedFeedCost = (flock.TotalFeedCost || 0) + feedCost;
            const totalBirdsRemoved = mortality + birdsEatenBySelf;
            newCurrentCount = Math.max(0, flock.CurrentCount - totalBirdsRemoved);
            status = newCurrentCount <= 0 ? 'Inactive' : flock.Status;

            await query.run('UPDATE Flocks SET TotalFeedCost = ?, CurrentCount = ?, Status = ? WHERE Id = ?', [updatedFeedCost, newCurrentCount, status, flockId]);
            syncRecordToSupabase('Flocks', {
              Id: flockId,
              FarmId: rowFarmId,
              CurrentCount: newCurrentCount,
              TotalFeedCost: updatedFeedCost,
              Status: status
            });
          }

          // Net Fresh Eggs added / removed (collected - gifted. Allow negative stock)
          const netFreshEggs = eggs - eggsGifted;
          if (netFreshEggs !== 0) {
            await query.run(`
              UPDATE EggInventories 
              SET Quantity = Quantity + ? 
              WHERE GradeOrType = 'Fresh Eggs' AND (FarmId = ? OR FarmId IS NULL)
            `, [netFreshEggs, rowFarmId]);
            const eggRow = await query.get<{ Id: number, Quantity: number }>("SELECT Id, Quantity FROM EggInventories WHERE GradeOrType = 'Fresh Eggs' AND (FarmId = ? OR FarmId IS NULL) LIMIT 1", [rowFarmId]);
            if (eggRow) {
              syncRecordToSupabase('EggInventories', {
                Id: eggRow.Id,
                FarmId: rowFarmId,
                GradeOrType: 'Fresh Eggs',
                Quantity: eggRow.Quantity
              });
            }
          }

          if (damagedEggs > 0) {
            await query.run(`
              UPDATE EggInventories 
              SET Quantity = Quantity + ? 
              WHERE GradeOrType = 'Damaged/Waste Eggs' AND (FarmId = ? OR FarmId IS NULL)
            `, [damagedEggs, rowFarmId]);
            const eggWasteRow = await query.get<{ Id: number, Quantity: number }>("SELECT Id, Quantity FROM EggInventories WHERE GradeOrType = 'Damaged/Waste Eggs' AND (FarmId = ? OR FarmId IS NULL) LIMIT 1", [rowFarmId]);
            if (eggWasteRow) {
              syncRecordToSupabase('EggInventories', {
                Id: eggWasteRow.Id,
                FarmId: rowFarmId,
                GradeOrType: 'Damaged/Waste Eggs',
                Quantity: eggWasteRow.Quantity
              });
            }
          }

          // Financial transaction for Feed Consumption
          if (feedCost > 0) {
            let catId = 9;
            const catObj = await query.get<{ Id: number }>("SELECT Id FROM TransactionCategories WHERE Name = 'Feed Consumption'");
            if (catObj) {
              catId = catObj.Id;
            } else {
              const insertCat = await query.run(`
                INSERT INTO TransactionCategories (FarmId, Name, IsIncome, Description)
                VALUES (?, 'Feed Consumption', 0, 'Feed consumed by active bird flocks')
              `, [rowFarmId]);
              catId = insertCat.lastID;
            }
            const feedName = matchedFeedItem ? matchedFeedItem.ItemName : 'Feed';
            const txRes = await query.run(`
              INSERT INTO FinancialTransactions (FarmId, Date, Amount, Type, CategoryId, Notes, FlockId)
              VALUES (?, ?, ?, 'Expense', ?, ?, ?)
            `, [rowFarmId, logDate, feedCost, catId, `[DailyLog #${logId}] Consume ${feedConsumed} Kg of ${feedName}`, flockId]);
            syncRecordToSupabase('FinancialTransactions', {
              Id: txRes.lastID,
              FarmId: rowFarmId,
              Date: logDate,
              Amount: feedCost,
              Type: 'Expense',
              CategoryId: catId,
              Notes: `[DailyLog #${logId}] Consume ${feedConsumed} Kg of ${feedName}`,
              FlockId: flockId
            });
          }

          // Financial transaction for Personal Consumption
          if (birdsEatenBySelf > 0 && birdsEatenValue > 0) {
            let catId = 10;
            const catObj = await query.get<{ Id: number }>("SELECT Id FROM TransactionCategories WHERE Name = 'Personal Consumption'");
            if (catObj) {
              catId = catObj.Id;
            } else {
              const insertCat = await query.run(`
                INSERT INTO TransactionCategories (FarmId, Name, IsIncome, Description)
                VALUES (?, 'Personal Consumption', 0, 'Internal birds eaten by self')
              `, [rowFarmId]);
              catId = insertCat.lastID;
            }
            const txRes = await query.run(`
              INSERT INTO FinancialTransactions (FarmId, Date, Amount, Type, CategoryId, Notes, FlockId)
              VALUES (?, ?, ?, 'Expense', ?, ?, ?)
            `, [rowFarmId, logDate, birdsEatenBySelf * birdsEatenValue, catId, `[DailyLog #${logId}] Birds eaten by self: ${birdsEatenBySelf} birds`, flockId]);
            syncRecordToSupabase('FinancialTransactions', {
              Id: txRes.lastID,
              FarmId: rowFarmId,
              Date: logDate,
              Amount: birdsEatenBySelf * birdsEatenValue,
              Type: 'Expense',
              CategoryId: catId,
              Notes: `[DailyLog #${logId}] Birds eaten by self: ${birdsEatenBySelf} birds`,
              FlockId: flockId
            });
          }

          // Financial transaction for Gifts & Donations
          if (eggsGifted > 0 && eggsGiftedValue > 0) {
            let catId = 11;
            const catObj = await query.get<{ Id: number }>("SELECT Id FROM TransactionCategories WHERE Name = 'Gifts & Donations'");
            if (catObj) {
              catId = catObj.Id;
            } else {
              const insertCat = await query.run(`
                INSERT INTO TransactionCategories (FarmId, Name, IsIncome, Description)
                VALUES (?, 'Gifts & Donations', 0, 'Internal and external gifted eggs/birds')
              `, [rowFarmId]);
              catId = insertCat.lastID;
            }
            const txRes = await query.run(`
              INSERT INTO FinancialTransactions (FarmId, Date, Amount, Type, CategoryId, Notes, FlockId)
              VALUES (?, ?, ?, 'Expense', ?, ?, ?)
            `, [rowFarmId, logDate, eggsGifted * eggsGiftedValue, catId, `[DailyLog #${logId}] Eggs gifted: ${eggsGifted} eggs`, flockId]);
            syncRecordToSupabase('FinancialTransactions', {
              Id: txRes.lastID,
              FarmId: rowFarmId,
              Date: logDate,
              Amount: eggsGifted * eggsGiftedValue,
              Type: 'Expense',
              CategoryId: catId,
              Notes: `[DailyLog #${logId}] Eggs gifted: ${eggsGifted} eggs`,
              FlockId: flockId
            });
          }

          saveCount++;
        }

      } else if (type === 'purchases') {
        for (const pr of validRecords) {
          const rec = pr.record;
          const invoiceNo = rec.InvoiceNumber || '';
          
          if (invoiceNo) {
            const exists = await query.get('SELECT Id FROM Purchases WHERE InvoiceNumber = ? AND (FarmId = ? OR FarmId IS NULL)', [invoiceNo, targetFarmId]);
            if (exists) {
              duplicateSkipCount++;
              continue;
            }
          }

          // Generate or lookup supplier
          let supplierId = rec._supplierId;
          if (!supplierId) {
            const supplierName = rec.SupplierName;
            const existingSupplier = await query.get<{ Id: number }>('SELECT Id FROM Suppliers WHERE (FarmId = ? OR FarmId IS NULL) AND CompanyName = ?', [targetFarmId, supplierName]);
            if (existingSupplier) {
              supplierId = existingSupplier.Id;
            } else {
              const newSup = await query.run(`
                INSERT INTO Suppliers (FarmId, CompanyName, ContactPerson, Email, Phone, OpeningCreditBalance, CurrentCreditBalance, Address)
                VALUES (?, ?, '', '', '', 0, 0, '')
              `, [targetFarmId, supplierName]);
              supplierId = newSup.lastID;
              syncRecordToSupabase('Suppliers', {
                Id: supplierId,
                FarmId: targetFarmId,
                CompanyName: supplierName,
                ContactPerson: '',
                Email: '',
                Phone: '',
                OpeningCreditBalance: 0,
                CurrentCreditBalance: 0,
                Address: ''
              });
            }
          }

          const purchaseDate = rec.PurchaseDate;
          const itemType = rec.ItemType || 'Inventory';
          const qty = parseFloat(rec.Quantity || '0');
          const price = parseFloat(rec.UnitPrice || '0');
          const gstPerc = parseFloat(rec.GSTPercentage || '0');
          
          const totalPrice = qty * price;
          const gstAmount = totalPrice * (gstPerc / 100);
          const grandTotal = totalPrice + gstAmount;

          const receivedAmt = parseFloat(rec.ReceivedAmount || '0');
          const balanceAmt = grandTotal - receivedAmt;
          const status = balanceAmt <= 0 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          const notes = rec.Notes || '';

          // 1. Insert parent purchase row
          const pResult = await query.run(`
            INSERT INTO Purchases (FarmId, SupplierId, PurchaseDate, TotalAmount, TotalGSTAmount, OtherTaxes, ReceivedAmount, BalanceAmount, InvoiceNumber, Status, Notes)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
          `, [targetFarmId, supplierId, purchaseDate, grandTotal, gstAmount, receivedAmt, balanceAmt, invoiceNo, status, notes]);
          
          const purchaseId = pResult.lastID;
          syncRecordToSupabase('Purchases', {
            Id: purchaseId,
            FarmId: targetFarmId,
            SupplierId: supplierId,
            PurchaseDate: purchaseDate,
            TotalAmount: grandTotal,
            TotalGSTAmount: gstAmount,
            OtherTaxes: 0,
            ReceivedAmount: receivedAmt,
            BalanceAmount: balanceAmt,
            InvoiceNumber: invoiceNo,
            Status: status,
            Notes: notes
          });

          // 2. Insert child item details
          let inventoryId = rec._inventoryId || null;
          const piResult = await query.run(`
            INSERT INTO PurchaseItems (PurchaseId, InventoryId, ItemType, Quantity, UnitPrice, GSTPercentage, GSTAmount, TotalPrice, WeightPerUnit, AllocatedOverhead, FinalLandedAmount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
          `, [purchaseId, inventoryId, itemType, qty, price, gstPerc, gstAmount, totalPrice, grandTotal]);

          syncRecordToSupabase('PurchaseItems', {
            Id: piResult.lastID,
            PurchaseId: purchaseId,
            InventoryId: inventoryId,
            ItemType: itemType,
            Quantity: qty,
            UnitPrice: price,
            GSTPercentage: gstPerc,
            GSTAmount: gstAmount,
            TotalPrice: totalPrice,
            WeightPerUnit: 1,
            AllocatedOverhead: 0,
            FinalLandedAmount: grandTotal
          });

          // 3. Keep stock index synced and update items unit price
          if (inventoryId) {
            const originalInv = await query.get<{ CurrentStock: number, UnitPrice: number }>('SELECT CurrentStock, UnitPrice FROM Inventories WHERE Id = ?', [inventoryId]);
            if (originalInv) {
              const oldStock = originalInv.CurrentStock || 0;
              const oldPrice = originalInv.UnitPrice || 0;
              const newStock = oldStock + qty;
              const newUnitPrice = newStock > 0 ? ((oldStock * oldPrice) + grandTotal) / newStock : oldPrice;

              await query.run(`
                UPDATE Inventories
                SET CurrentStock = CurrentStock + ?, UnitPrice = ?
                WHERE Id = ?
              `, [qty, newUnitPrice, inventoryId]);

              syncRecordToSupabase('Inventories', {
                Id: inventoryId,
                FarmId: targetFarmId,
                CurrentStock: newStock,
                UnitPrice: newUnitPrice
              });
            }
          }

          saveCount++;
        }

      } else if (type === 'sales') {
        const defaultCat = await query.get<{ Id: number }>('SELECT Id FROM TransactionCategories WHERE Name = "Egg Sales" ORDER BY Id LIMIT 1');
        const financialCatId = defaultCat?.Id || 1;

        for (const pr of validRecords) {
          const rec = pr.record;
          const invoiceNo = rec.InvoiceNumber || '';

          if (invoiceNo) {
            const exists = await query.get('SELECT Id FROM Sales WHERE InvoiceNumber = ? AND (FarmId = ? OR FarmId IS NULL)', [invoiceNo, targetFarmId]);
            if (exists) {
              duplicateSkipCount++;
              continue;
            }
          }

          // Resolve Customer profile
          let customerId = rec._customerId;
          if (!customerId) {
            const customerName = rec.CustomerName;
            const existingCustomer = await query.get<{ Id: number }>('SELECT Id FROM Customers WHERE (FarmId = ? OR FarmId IS NULL) AND FullName = ?', [targetFarmId, customerName]);
            if (existingCustomer) {
              customerId = existingCustomer.Id;
            } else {
              const newCust = await query.run(`
                INSERT INTO Customers (FarmId, FullName, Email, Phone, Company, OpeningCreditBalance, CurrentCreditBalance, Address)
                VALUES (?, ?, '', '', '', 0, 0, '')
              `, [targetFarmId, customerName]);
              customerId = newCust.lastID;
              syncRecordToSupabase('Customers', {
                Id: customerId,
                FarmId: targetFarmId,
                FullName: customerName,
                Email: '',
                Phone: '',
                Company: '',
                OpeningCreditBalance: 0,
                CurrentCreditBalance: 0,
                Address: ''
              });
            }
          }

          const saleDate = rec.SaleDate;
          const itemType = rec.ItemType || 'General Inventory';
          const qty = parseFloat(rec.Quantity || '0');
          const price = parseFloat(rec.UnitPrice || '0');
          const gstPerc = parseFloat(rec.GSTPercentage || '0');
          const discount = parseFloat(rec.Discount || '0');
          const otherCharges = parseFloat(rec.OtherCharges || '0');

          const subTotal = qty * price;
          const gstAmount = subTotal * (gstPerc / 100);
          const grandTotal = subTotal + gstAmount + otherCharges - discount;

          const receivedAmt = parseFloat(rec.ReceivedAmount || '0');
          const balanceAmt = grandTotal - receivedAmt;
          const status = balanceAmt <= 0 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          const notes = rec.Notes || '';

          // 1. Save Parent Sales record
          const sResult = await query.run(`
            INSERT INTO Sales (FarmId, CustomerId, SaleDate, SubTotal, Discount, TotalGSTAmount, OtherCharges, GrandTotal, ReceivedAmount, InvoiceNumber, Status, Notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [targetFarmId, customerId, saleDate, subTotal, discount, gstAmount, otherCharges, grandTotal, receivedAmt, invoiceNo, status, notes]);

          const saleId = sResult.lastID;
          syncRecordToSupabase('Sales', {
            Id: saleId,
            FarmId: targetFarmId,
            CustomerId: customerId,
            SaleDate: saleDate,
            SubTotal: subTotal,
            Discount: discount,
            TotalGSTAmount: gstAmount,
            OtherCharges: otherCharges,
            GrandTotal: grandTotal,
            ReceivedAmount: receivedAmt,
            InvoiceNumber: invoiceNo,
            Status: status,
            Notes: notes
          });

          // 2. Map items & Deduct Stock Cascades
          const flockId = rec._flockId || null;
          const eggInventoryId = rec._eggInventoryId || null;
          const inventoryId = rec._inventoryId || null;

          const siResult = await query.run(`
            INSERT INTO SaleItems (SaleId, ItemType, FlockId, EggInventoryId, InventoryId, Quantity, UnitPrice, GSTPercentage, GSTAmount, TotalPrice)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [saleId, itemType, flockId, eggInventoryId, inventoryId, qty, price, gstPerc, gstAmount, subTotal]);

          syncRecordToSupabase('SaleItems', {
            Id: siResult.lastID,
            SaleId: saleId,
            ItemType: itemType,
            FlockId: flockId,
            EggInventoryId: eggInventoryId,
            InventoryId: inventoryId,
            Quantity: qty,
            UnitPrice: price,
            GSTPercentage: gstPerc,
            GSTAmount: gstAmount,
            TotalPrice: subTotal
          });

          // Cascading stock deductions
          if (itemType === 'Egg' && eggInventoryId) {
            await query.run('UPDATE EggInventories SET Quantity = MAX(0, Quantity - ?) WHERE Id = ?', [qty, eggInventoryId]);
            const eggRow = await query.get<{ Quantity: number }>('SELECT Quantity FROM EggInventories WHERE Id = ?', [eggInventoryId]);
            if (eggRow) {
              syncRecordToSupabase('EggInventories', {
                Id: eggInventoryId,
                FarmId: targetFarmId,
                Quantity: eggRow.Quantity
              });
            }
          } else if (itemType === 'Bird' && flockId) {
            const flock = await query.get<{ CurrentCount: number, Status: string }>('SELECT CurrentCount, Status FROM Flocks WHERE Id = ?', [flockId]);
            if (flock) {
              const newBirdCount = Math.max(0, flock.CurrentCount - qty);
              const flockStatus = newBirdCount === 0 ? 'Sold' : flock.Status;
              await query.run('UPDATE Flocks SET CurrentCount = ?, Status = ? WHERE Id = ?', [newBirdCount, flockStatus, flockId]);
              syncRecordToSupabase('Flocks', {
                Id: flockId,
                FarmId: targetFarmId,
                CurrentCount: newBirdCount,
                Status: flockStatus
              });
            }
          } else if (inventoryId) {
            await query.run('UPDATE Inventories SET CurrentStock = MAX(0, CurrentStock - ?) WHERE Id = ?', [qty, inventoryId]);
            const invRow = await query.get<{ CurrentStock: number }>('SELECT CurrentStock FROM Inventories WHERE Id = ?', [inventoryId]);
            if (invRow) {
              syncRecordToSupabase('Inventories', {
                Id: inventoryId,
                FarmId: targetFarmId,
                CurrentStock: invRow.CurrentStock
              });
            }
          }

          // Balance account credit adjustment
          if (balanceAmt > 0) {
            await query.run('UPDATE Customers SET CurrentCreditBalance = CurrentCreditBalance + ? WHERE Id = ?', [balanceAmt, customerId]);
            const custRow = await query.get<{ CurrentCreditBalance: number }>('SELECT CurrentCreditBalance FROM Customers WHERE Id = ?', [customerId]);
            if (custRow) {
              syncRecordToSupabase('Customers', {
                Id: customerId,
                FarmId: targetFarmId,
                CurrentCreditBalance: custRow.CurrentCreditBalance
              });
            }
          }

          // Auto trigger simple transaction ledger entry for ledger parity
          const ftRes = await query.run(`
            INSERT INTO FinancialTransactions (FarmId, CategoryId, Date, Amount, Notes, Type, StaffId, SupplierId, CustomerId, Reference)
            VALUES (?, ?, ?, ?, ?, 'Income', NULL, NULL, ?, ?)
          `, [targetFarmId, financialCatId, saleDate, receivedAmt || grandTotal, `Bulk Upload Sale - Invoice: ${invoiceNo}`, customerId, invoiceNo]);

          syncRecordToSupabase('FinancialTransactions', {
            Id: ftRes.lastID,
            FarmId: targetFarmId,
            CategoryId: financialCatId,
            Date: saleDate,
            Amount: receivedAmt || grandTotal,
            Notes: `Bulk Upload Sale - Invoice: ${invoiceNo}`,
            Type: 'Income',
            CustomerId: customerId,
            Reference: invoiceNo
          });

          saveCount++;
        }
      }

      // 4. Log the entry into audit trail
      await logAudit(
        req,
        '',
        'BulkDataImport',
        `Bulk Import Executed: ${type}`,
        { type, validRowsMatchedCount: validRecords.length, savedInDatabaseCount: saveCount, duplicateSkipCount },
        'SUCCESS'
      );

      res.json({
        message: `Successfully synchronized and locked ${saveCount} records. ${duplicateSkipCount > 0 ? `${duplicateSkipCount} duplicates skipped.` : ''}`,
        count: saveCount,
        duplicatesSkipped: duplicateSkipCount
      });

    } catch (error: any) {
      await logAudit(
        req,
        '',
        'BulkDataImport',
        `Bulk Import Failed: ${type}`,
        { type },
        'FAILED',
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  }
};
