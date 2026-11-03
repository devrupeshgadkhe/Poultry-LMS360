import { Request, Response } from 'express';
import { query } from './db.js';
import { logAudit, cleanDuplicateEggInventories, reconcileEggInventoryForFarm } from './controllers.js';
import { supabaseServer, syncRecordToSupabase, reconcileAllFlocksInventory } from './supabase.js';

// Detect delimiter based on first row
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\r|\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  if (semicolonCount > commaCount && semicolonCount > tabCount) return ';';
  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  return ',';
}

// Custom lightweight CSV parser with auto-delimiter and BOM stripping
export function parseCSV(text: string): string[][] {
  if (!text) return [];
  // Strip UTF-8 BOM (\uFEFF) and zero-width characters
  const cleanText = text.replace(/^\uFEFF/, '').replace(/^[\u200B\u200C\u200D\uFEFF]/, '');
  const delimiter = detectDelimiter(cleanText);
  const lines: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
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

// Clean numbers handling commas, currencies, decimals, etc.
export function cleanInt(val: any, defaultVal = 0): number {
  if (val === undefined || val === null) return defaultVal;
  const str = String(val).replace(/,/g, '').replace(/[^0-9\-.]/g, '').trim();
  if (!str) return defaultVal;
  const num = Math.round(parseFloat(str));
  return isNaN(num) ? defaultVal : num;
}

export function cleanFloat(val: any, defaultVal = 0): number {
  if (val === undefined || val === null) return defaultVal;
  const str = String(val).replace(/,/g, '').replace(/[^0-9\-.]/g, '').trim();
  if (!str) return defaultVal;
  const num = parseFloat(str);
  return isNaN(num) ? defaultVal : num;
}

export function cleanDate(rawDate: any): string {
  if (rawDate === undefined || rawDate === null) return '';
  const str = String(rawDate)
    .replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, '')
    .trim();
  if (!str) return '';

  // Strip trailing time portion (e.g. "11-01-2025 00:00:00" or "2025-01-11T00:00:00")
  const dateOnly = str.split(/[ T]/)[0].trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // YYYY/MM/DD
  const ymd = dateOnly.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // MM/DD/YYYY or MM-DD-YYYY fallback
  const mdy = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mdy && Number(mdy[1]) <= 12 && Number(mdy[2]) > 12) {
    const yr = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${yr}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }

  // Excel serial date number (e.g. 45668)
  if (/^\d{5}$/.test(dateOnly)) {
    const num = Number(dateOnly);
    if (num >= 30000 && num <= 60000) {
      const excelEpoch = new Date(1899, 11, 30);
      const targetDate = new Date(excelEpoch.getTime() + num * 86400000);
      if (!isNaN(targetDate.getTime())) {
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return dateOnly;
}

// Normalize flock string by removing invisible unicode, standardizing dashes, collapsing spaces
export function normalizeFlockStr(s: any): string {
  if (!s) return '';
  return String(s)
    .replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, ' ')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Strip all non-alphanumeric characters for fuzzy batch/flock comparison
export function cleanAlphanumeric(s: any): string {
  if (!s) return '';
  return normalizeFlockStr(s).replace(/[^a-z0-9]/g, '');
}

export interface FlockCandidate {
  Id: number;
  FlockName: string;
  FarmId: number;
  Breed?: string;
  CurrentCount?: number;
  TotalFeedCost?: number;
  Status?: string;
  PerBirdPurchasePrice?: number;
}

/**
 * Smart Flock Matcher
 * Resiliently matches flock names across case, spaces, dashes, prefixes, IDs, and substrings.
 */
export function findSmartFlockMatch(
  rawInput: string,
  farmFlocks: FlockCandidate[],
  allFlocks: FlockCandidate[]
): { flock: FlockCandidate; matchType: string } | null {
  if (!rawInput) return null;
  const raw = String(rawInput).trim();
  const normInput = normalizeFlockStr(raw);
  const alphaInput = cleanAlphanumeric(raw);
  if (!alphaInput && !normInput) return null;

  // Search hierarchy: Check current farm first, then expand to all flocks
  const pools = [
    { list: farmFlocks || [], scope: 'farm' },
    { list: allFlocks || [], scope: 'global' }
  ];

  for (const { list, scope } of pools) {
    if (!list || list.length === 0) continue;

    // 1. Exact string match
    const exact = list.find(f => (f.FlockName || '').trim() === raw);
    if (exact) return { flock: exact, matchType: `exact (${scope})` };

    // 2. Normalized lowercase & dash match
    const normMatch = list.find(f => normalizeFlockStr(f.FlockName) === normInput);
    if (normMatch) return { flock: normMatch, matchType: `case-insensitive (${scope})` };

    // 3. Alphanumeric match (ignoring dashes, spaces, underscores, symbols)
    // E.g. "B5-Batch5" == "B5 - Batch 5" == "b5batch5" == "B5 Batch 5" == "B5_Batch5"
    if (alphaInput) {
      const alphaMatch = list.find(f => cleanAlphanumeric(f.FlockName) === alphaInput);
      if (alphaMatch) return { flock: alphaMatch, matchType: `alphanumeric (${scope})` };
    }

    // 4. Numeric ID match (e.g. "6", "#6", "Flock #6", "ID: 6")
    const idMatch = raw.match(/^#?(\d+)$/) || raw.match(/flock\s*#?\s*(\d+)/i);
    if (idMatch) {
      const targetId = Number(idMatch[1]);
      const byId = list.find(f => Number(f.Id) === targetId);
      if (byId) return { flock: byId, matchType: `id #${targetId} (${scope})` };
    }

    // 5. Common prefixes stripped ("Flock B5-Batch5", "Batch B5-Batch5", "Shed 1", "House 1")
    const strippedInput = normInput.replace(/^(flock|batch|shed|house|group)\s*[-:#]?\s*/i, '').trim();
    const strippedAlpha = cleanAlphanumeric(strippedInput);
    if (strippedAlpha) {
      const prefixMatch = list.find(f => {
        const fStripped = normalizeFlockStr(f.FlockName).replace(/^(flock|batch|shed|house|group)\s*[-:#]?\s*/i, '').trim();
        return cleanAlphanumeric(fStripped) === strippedAlpha;
      });
      if (prefixMatch) return { flock: prefixMatch, matchType: `prefix-normalized (${scope})` };
    }

    // 6. Substring / Component containment (e.g., input is "B5" or "Batch5", and flock is "B5-Batch5")
    if (alphaInput.length >= 2) {
      const containing = list.filter(f => {
        const fAlpha = cleanAlphanumeric(f.FlockName);
        if (!fAlpha) return false;
        return fAlpha.includes(alphaInput) || alphaInput.includes(fAlpha);
      });
      if (containing.length === 1) {
        return { flock: containing[0], matchType: `component-match (${scope})` };
      }
    }

    // 7. Breed fallback if unique
    const byBreed = list.filter(f => f.Breed && normalizeFlockStr(f.Breed) === normInput);
    if (byBreed.length === 1) {
      return { flock: byBreed[0], matchType: `breed-match (${scope})` };
    }
  }

  return null;
}


// Comprehensive aliases for column headers matching any Excel or user variations
export const HEADER_KEY_MAP: Record<string, string> = {
  // Eggs Collected
  eggscollected: 'EggsCollected',
  eggcollected: 'EggsCollected',
  dailycollected: 'EggsCollected',
  dailycollecteddata: 'EggsCollected',
  dailycollectedeggs: 'EggsCollected',
  collectedeggs: 'EggsCollected',
  dailyeggs: 'EggsCollected',
  dailyegg: 'EggsCollected',
  eggs: 'EggsCollected',
  collected: 'EggsCollected',
  eggcollection: 'EggsCollected',
  dailyeggcollection: 'EggsCollected',
  totaleggs: 'EggsCollected',
  eggproduction: 'EggsCollected',
  eggsproduced: 'EggsCollected',
  eggcount: 'EggsCollected',
  fresheggs: 'EggsCollected',
  laidtoday: 'EggsCollected',
  eggslaid: 'EggsCollected',
  production: 'EggsCollected',
  layerscollection: 'EggsCollected',

  // Mortality
  mortalitycount: 'MortalityCount',
  mortality: 'MortalityCount',
  mortalities: 'MortalityCount',
  deaths: 'MortalityCount',
  death: 'MortalityCount',
  deadbirds: 'MortalityCount',
  deadcount: 'MortalityCount',
  losses: 'MortalityCount',
  died: 'MortalityCount',
  mortalityqty: 'MortalityCount',
  birddeaths: 'MortalityCount',

  // Feed Consumed
  feedconsumedkg: 'FeedConsumedKg',
  feedconsumed: 'FeedConsumedKg',
  feedkg: 'FeedConsumedKg',
  feedconsumedinkg: 'FeedConsumedKg',
  feedused: 'FeedConsumedKg',
  feedquantity: 'FeedConsumedKg',
  feedqty: 'FeedConsumedKg',
  feedintake: 'FeedConsumedKg',
  feed: 'FeedConsumedKg',
  dailyfeed: 'FeedConsumedKg',

  // Damaged Eggs
  damagedeggscollected: 'DamagedEggsCollected',
  damagedeggs: 'DamagedEggsCollected',
  damaged: 'DamagedEggsCollected',
  wasteeggs: 'DamagedEggsCollected',
  brokeneggs: 'DamagedEggsCollected',
  breakage: 'DamagedEggsCollected',
  crackedeggs: 'DamagedEggsCollected',
  damage: 'DamagedEggsCollected',
  waste: 'DamagedEggsCollected',

  // Water Consumed
  waterconsumed: 'WaterConsumed',
  water: 'WaterConsumed',
  waterlitres: 'WaterConsumed',
  waterl: 'WaterConsumed',
  waterintake: 'WaterConsumed',

  // Daily Average Weight
  dailyaverageweight: 'DailyAverageWeight',
  averageweight: 'DailyAverageWeight',
  avgweight: 'DailyAverageWeight',
  birdweight: 'DailyAverageWeight',
  weight: 'DailyAverageWeight',
  bodyweight: 'DailyAverageWeight',

  // Birds Eaten
  birdseatenbyself: 'BirdsEatenBySelf',
  birdseaten: 'BirdsEatenBySelf',
  selfconsumed: 'BirdsEatenBySelf',
  homeconsumption: 'BirdsEatenBySelf',
  selfconsumption: 'BirdsEatenBySelf',
  birdeaten: 'BirdsEatenBySelf',

  // Birds Eaten Value
  birdseatenvalue: 'BirdsEatenValue',
  birdseatenamount: 'BirdsEatenValue',
  selfconsumedvalue: 'BirdsEatenValue',

  // Eggs Gifted
  eggsgifted: 'EggsGifted',
  giftedeggs: 'EggsGifted',
  gifted: 'EggsGifted',
  donatedeggs: 'EggsGifted',
  gift: 'EggsGifted',

  // Eggs Gifted Value
  eggsgiftedvalue: 'EggsGiftedValue',
  giftedvalue: 'EggsGiftedValue',

  // Flock / Batch Name / Flock Identifier
  flockname: 'FlockName',
  flock: 'FlockName',
  flockidentifier: 'FlockName',
  identifier: 'FlockName',
  batch: 'FlockName',
  batchname: 'FlockName',
  flockgroup: 'FlockName',
  group: 'FlockName',
  flockid: 'FlockName',
  flockno: 'FlockName',
  flocknumber: 'FlockName',
  flockcode: 'FlockName',
  shed: 'FlockName',
  shedname: 'FlockName',
  house: 'FlockName',
  housename: 'FlockName',

  // Date
  logdate: 'LogDate',
  date: 'LogDate',
  day: 'LogDate',
  recorddate: 'LogDate',
  entrydate: 'LogDate',

  // Feed Name
  feedname: 'FeedName',
  feeditem: 'FeedName',
  feeditemname: 'FeedName',
  feedtype: 'FeedName',
  feedbrand: 'FeedName',

  // General Notes
  notes: 'Notes',
  remarks: 'Notes',
  comments: 'Notes',
  description: 'Notes'
};

export function normalizeRecordKeys(rawRecord: any): any {
  if (!rawRecord) return {};
  const normalized: any = { ...rawRecord };
  for (const [key, val] of Object.entries(rawRecord)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalKey = HEADER_KEY_MAP[cleanKey];
    if (canonicalKey) {
      if (normalized[canonicalKey] === undefined || normalized[canonicalKey] === '') {
        normalized[canonicalKey] = typeof val === 'string' ? val.trim() : val;
      }
    }
  }
  return normalized;
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
      let inventories: any[] = [];
      let flocks: any[] = [];
      let allFlocks: any[] = [];
      let suppliers: any[] = [];
      let customers: any[] = [];
      let eggInventories: any[] = [];
      const existingInvs = new Set<string>();
      const existingPurchasesInvoices = new Set<string>();
      const existingSalesInvoices = new Set<string>();
      const dailyLogSet = new Set<string>();

      if (supabaseServer) {
        try {
          const [invRes, flkRes, supRes, custRes, eggRes, purchRes, salesRes, logsRes] = await Promise.all([
            supabaseServer.from('Inventories').select('Id, ItemName, FarmId, Category, CurrentStock, UnitPrice'),
            supabaseServer.from('Flocks').select('Id, FlockName, FarmId, Breed, CurrentCount, TotalFeedCost, Status, PerBirdPurchasePrice'),
            supabaseServer.from('Suppliers').select('Id, CompanyName, FarmId'),
            supabaseServer.from('Customers').select('Id, FullName, FarmId'),
            supabaseServer.from('EggInventories').select('Id, GradeOrType, FarmId, Quantity'),
            supabaseServer.from('Purchases').select('InvoiceNumber, FarmId'),
            supabaseServer.from('Sales').select('InvoiceNumber, FarmId'),
            supabaseServer.from('DailyLogs').select('FlockId, LogDate, FarmId')
          ]);

          allFlocks = flkRes.data || [];
          flocks = targetFarmId ? allFlocks.filter((f: any) => f.FarmId === targetFarmId || !f.FarmId) : allFlocks;
          inventories = invRes.data || [];
          suppliers = supRes.data || [];
          customers = custRes.data || [];
          eggInventories = eggRes.data || [];

          (purchRes.data || []).forEach((p: any) => {
            if (p.InvoiceNumber && (p.FarmId === targetFarmId || !p.FarmId)) {
              existingPurchasesInvoices.add(p.InvoiceNumber.toLowerCase().trim());
            }
          });

          (salesRes.data || []).forEach((s: any) => {
            if (s.InvoiceNumber && (s.FarmId === targetFarmId || !s.FarmId)) {
              existingSalesInvoices.add(s.InvoiceNumber.toLowerCase().trim());
            }
          });

          (logsRes.data || []).forEach((l: any) => {
            if (l.FlockId && l.LogDate) {
              const cleanD = cleanDate(l.LogDate);
              dailyLogSet.add(`${l.FlockId}_${cleanD}`);
            }
          });
        } catch (sbErr: any) {
          console.warn('[bulkImport parse Supabase fetch warning]', sbErr.message);
        }
      }

      // Fallback query if Supabase was empty or offline
      if (allFlocks.length === 0) {
        try {
          flocks = await query.all('SELECT Id, FlockName, FarmId, Breed FROM Flocks WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]);
          allFlocks = await query.all('SELECT Id, FlockName, FarmId, Breed FROM Flocks');
        } catch {}
      }
      if (inventories.length === 0) {
        try { inventories = await query.all('SELECT Id, ItemName, FarmId FROM Inventories WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]); } catch {}
      }
      if (suppliers.length === 0) {
        try { suppliers = await query.all('SELECT Id, CompanyName, FarmId FROM Suppliers WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]); } catch {}
      }
      if (customers.length === 0) {
        try { customers = await query.all('SELECT Id, FullName, FarmId FROM Customers WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]); } catch {}
      }
      if (eggInventories.length === 0) {
        try { eggInventories = await query.all('SELECT Id, GradeOrType, FarmId FROM EggInventories WHERE FarmId = ? OR FarmId IS NULL', [targetFarmId]); } catch {}
      }

      inventories.forEach(inv => {
        if (inv.ItemName) existingInvs.add(inv.ItemName.toLowerCase().trim());
      });


      let hasNonZeroEggs = false;
      let hasNonZeroMortality = false;

      for (let index = 0; index < dataRows.length; index++) {
        const rawRow = dataRows[index];
        const rawRecord: any = {};
        
        // Map list values to keys based on header row
        headers.forEach((header, colIndex) => {
          if (header) {
            rawRecord[header] = rawRow[colIndex] ? rawRow[colIndex].trim() : '';
          }
        });

        // Apply comprehensive alias mapping for columns like "Daily Collected", "Eggs Collected", etc.
        const record = normalizeRecordKeys(rawRecord);

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
          let logDate = cleanDate(record.LogDate || '');
          record.LogDate = logDate;
          const feedName = record.FeedName || '';

          const eggs = cleanInt(record.EggsCollected || 0);
          const mortality = cleanInt(record.MortalityCount || 0);
          const feed = cleanFloat(record.FeedConsumedKg || 0);
          const damaged = cleanInt(record.DamagedEggsCollected || 0);
          const water = cleanFloat(record.WaterConsumed || 0);
          const weight = cleanFloat(record.DailyAverageWeight || 0);
          const birdsEaten = cleanInt(record.BirdsEatenBySelf || 0);
          const birdsEatenVal = cleanFloat(record.BirdsEatenValue || 0);
          const eggsGifted = cleanInt(record.EggsGifted || 0);
          const eggsGiftedVal = cleanFloat(record.EggsGiftedValue || 0);

          record.EggsCollected = String(eggs);
          record.MortalityCount = String(mortality);
          record.FeedConsumedKg = String(feed);
          record.DamagedEggsCollected = String(damaged);
          record.WaterConsumed = String(water);
          record.DailyAverageWeight = String(weight);
          record.BirdsEatenBySelf = String(birdsEaten);
          record.BirdsEatenValue = String(birdsEatenVal);
          record.EggsGifted = String(eggsGifted);
          record.EggsGiftedValue = String(eggsGiftedVal);

          if (eggs > 0) hasNonZeroEggs = true;
          if (mortality > 0) hasNonZeroMortality = true;

          if (!flockName) {
            errors.push('Missing FlockName');
            status = 'Invalid';
          }
          if (!logDate) {
            errors.push('Missing LogDate (YYYY-MM-DD)');
            status = 'Invalid';
          } else if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
            errors.push('Invalid Date format. Must be YYYY-MM-DD or DD/MM/YYYY');
            status = 'Invalid';
          }

          const matchResult = findSmartFlockMatch(flockName, flocks, allFlocks);
          if (!matchResult) {
            const availableNames = (allFlocks || []).map(f => f.FlockName).filter(Boolean);
            const hint = availableNames.length > 0 ? ` (Available in DB: ${availableNames.join(', ')})` : '';
            errors.push(`Flock "${flockName}" is not registered in database${hint}`);
            status = 'Invalid';
          } else {
            const matchedFlock = matchResult.flock;
            record._flockId = matchedFlock.Id;
            record._farmId = matchedFlock.FarmId || targetFarmId;
            record._matchedFlockName = matchedFlock.FlockName;

            const logKey = `${matchedFlock.Id}_${logDate}`;
            if (dailyLogSet.has(logKey)) {
              status = 'Duplicate';
              details.push(`Daily log for "${matchedFlock.FlockName}" on ${logDate} already exists in DB. Skipping duplicate.`);
            } else {
              details.push(`Matched Flock: "${matchedFlock.FlockName}" (ID: #${matchedFlock.Id}) [${matchResult.matchType}]`);
            }
          }

          const cleanFeedName = (feedName || '').trim();
          if (cleanFeedName && cleanFeedName !== '0' && cleanFeedName.toLowerCase() !== 'none' && cleanFeedName !== '-') {
            const matchedFeed = inventories.find(inv => (inv.ItemName || '').toLowerCase().trim() === cleanFeedName.toLowerCase());
            if (matchedFeed) {
              record._feedItemId = matchedFeed.Id;
              details.push(`Feed: "${matchedFeed.ItemName}" (ID: #${matchedFeed.Id})`);
            } else {
              record._feedItemId = null;
              details.push(`Feed item "${cleanFeedName}" not matched; will use default farm feed`);
            }
          } else {
            record._feedItemId = null;
          }


          details.push(`🥚 Eggs Collected: ${eggs.toLocaleString()} | 💀 Mortality: ${mortality} | 🌾 Feed: ${feed} kg`);

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
              const flockMatch = findSmartFlockMatch(itemName, flocks, allFlocks);
              if (!flockMatch) {
                errors.push(`Flock name "${itemName}" must be created first to purchase flock items`);
                status = 'Invalid';
              } else {
                record._flockId = flockMatch.flock.Id;
                details.push(`Matched active flock "${flockMatch.flock.FlockName}"`);
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
              const flockMatch = findSmartFlockMatch(itemName, flocks, allFlocks);
              if (!flockMatch) {
                errors.push(`Flock/Bird name "${itemName}" not found in current layer flocks.`);
                status = 'Invalid';
              } else {
                record._flockId = flockMatch.flock.Id;
                details.push(`Matched Flock: "${flockMatch.flock.FlockName}" (ID: #${flockMatch.flock.Id})`);
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

      if (type === 'daily-logs' && !hasNonZeroEggs && hasNonZeroMortality) {
        (validationSummary as any).advisory = "Advisory: 'Eggs Collected' is parsed as 0 across all rows. If your flock has started laying eggs, please ensure your column header is named 'Eggs Collected' or 'Daily Collected'.";
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
          const name = (rec.ItemName || '').trim();
          if (!name) continue;

          if (supabaseServer) {
            try {
              const { data: exists } = await supabaseServer
                .from('Inventories')
                .select('Id')
                .eq('FarmId', targetFarmId)
                .ilike('ItemName', name)
                .maybeSingle();

              if (exists) {
                duplicateSkipCount++;
                continue;
              }

              const { data: inserted, error: insErr } = await supabaseServer.from('Inventories').insert([{
                FarmId: targetFarmId,
                ItemName: name,
                Category: rec.Category || 'Other',
                UnitOfMeasurement: rec.UnitOfMeasurement || 'Pieces',
                UnitPrice: parseFloat(rec.UnitPrice || '0'),
                SellingPrice: parseFloat(rec.SellingPrice || '0'),
                CurrentStock: parseFloat(rec.CurrentStock || '0'),
                WeightPerUnit: parseFloat(rec.WeightPerUnit || '1'),
                MinThreshold: parseFloat(rec.MinThreshold || '0'),
                Notes: rec.Notes || ''
              }]).select().single();

              if (!insErr && inserted) {
                saveCount++;
              }
            } catch (err: any) {
              console.error('[BulkImport items commit error]:', err.message);
            }
          }
        }

      } else if (type === 'daily-logs') {
        for (const pr of validRecords) {
          const rec = normalizeRecordKeys(pr.record);
          const logDate = cleanDate(rec.LogDate);
          const flockId = Number(rec._flockId);

          if (!flockId || !logDate) continue;

          // 1. Re-verify duplicates in Supabase Cloud
          if (supabaseServer) {
            try {
              const { data: exists } = await supabaseServer
                .from('DailyLogs')
                .select('Id')
                .eq('FlockId', flockId)
                .eq('LogDate', logDate)
                .maybeSingle();

              if (exists) {
                duplicateSkipCount++;
                continue;
              }
            } catch {}
          }

          // 2. Fetch fresh Flock details
          let flock: any = null;
          if (supabaseServer) {
            try {
              const { data: flk } = await supabaseServer
                .from('Flocks')
                .select('Id, FarmId, TotalFeedCost, CurrentCount, Status, PerBirdPurchasePrice')
                .eq('Id', flockId)
                .maybeSingle();
              flock = flk;
            } catch {}
          }

          const rowFarmId = (flock && flock.FarmId) ? flock.FarmId : (Number(rec._farmId) || targetFarmId);

          const feedConsumed = cleanFloat(rec.FeedConsumedKg || '0');
          const mortality = cleanInt(rec.MortalityCount || '0');
          const eggs = cleanInt(rec.EggsCollected || '0');
          const damagedEggs = cleanInt(rec.DamagedEggsCollected || '0');
          const water = cleanFloat(rec.WaterConsumed || '0');
          const weight = cleanFloat(rec.DailyAverageWeight || '0');
          const birdsEatenBySelf = cleanInt(rec.BirdsEatenBySelf || '0');
          const birdsEatenValue = cleanFloat(rec.BirdsEatenValue || '0');
          const eggsGifted = cleanInt(rec.EggsGifted || '0');
          const eggsGiftedValue = cleanFloat(rec.EggsGiftedValue || '0');
          const notes = rec.Notes || '';

          // 3. Resolve Feed Item & Pricing
          let feedItemId = rec._feedItemId ? Number(rec._feedItemId) : null;
          let feedUnitPrice = 30.00;
          let matchedFeedItem: any = null;

          if (supabaseServer) {
            try {
              if (feedItemId) {
                const { data: inv } = await supabaseServer.from('Inventories').select('*').eq('Id', feedItemId).maybeSingle();
                matchedFeedItem = inv;
              } else {
                const feedNameInput = (rec.FeedName || '').trim();
                if (feedNameInput && feedNameInput !== '0' && feedNameInput.toLowerCase() !== 'none' && feedNameInput !== '-') {
                  const { data: invs } = await supabaseServer.from('Inventories').select('*').eq('FarmId', rowFarmId).ilike('ItemName', feedNameInput);
                  if (invs && invs.length > 0) matchedFeedItem = invs[0];
                }
                if (!matchedFeedItem) {
                  const { data: invs } = await supabaseServer.from('Inventories').select('*').eq('FarmId', rowFarmId).eq('Category', 'Feed').limit(1);
                  if (invs && invs.length > 0) matchedFeedItem = invs[0];
                }
                if (!matchedFeedItem && feedConsumed > 0) {
                  const { data: insFeed } = await supabaseServer.from('Inventories').insert([{
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
                  }]).select().single();
                  matchedFeedItem = insFeed;
                }
              }

              if (matchedFeedItem) {
                feedItemId = matchedFeedItem.Id;
                feedUnitPrice = Number(matchedFeedItem.UnitPrice) || 30.00;
                if (feedConsumed > 0) {
                  const currentStock = Number(matchedFeedItem.CurrentStock) || 0;
                  await supabaseServer.from('Inventories').update({
                    CurrentStock: currentStock - feedConsumed
                  }).eq('Id', feedItemId);
                }
              }
            } catch (feedErr: any) {
              console.warn('[BulkImport feed resolution warning]:', feedErr.message);
            }
          }

          const feedCost = feedConsumed * feedUnitPrice;
          const dailyBirdCost = (flock && flock.PerBirdPurchasePrice) ? Number(flock.PerBirdPurchasePrice) : 0;

          // 4. Insert Daily Log into Supabase Cloud
          let logId = 0;
          if (supabaseServer) {
            try {
              const { data: insLog, error: insErr } = await supabaseServer.from('DailyLogs').insert([{
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
              }]).select('Id').single();

              if (insErr) {
                console.error('[BulkImport daily-logs commit error]:', insErr.message);
                continue;
              }
              logId = insLog?.Id || 0;
              saveCount++;
            } catch (insCatch: any) {
              console.error('[BulkImport daily-logs insert exception]:', insCatch.message);
              continue;
            }
          }

          // 5. Update Flock Head Count & Feed Costs in Supabase
          if (flock && supabaseServer) {
            try {
              const updatedFeedCost = (Number(flock.TotalFeedCost) || 0) + feedCost;
              const totalBirdsRemoved = mortality + birdsEatenBySelf;
              const newCurrentCount = Math.max(0, (Number(flock.CurrentCount) || 0) - totalBirdsRemoved);
              const status = newCurrentCount <= 0 ? 'Inactive' : flock.Status;

              await supabaseServer.from('Flocks').update({
                TotalFeedCost: updatedFeedCost,
                CurrentCount: newCurrentCount,
                Status: status
              }).eq('Id', flockId);
            } catch (flkErr: any) {
              console.warn('[BulkImport flock update warning]:', flkErr.message);
            }
          }

          // 6. Update Egg Inventories in Supabase
          const netFreshEggs = eggs - eggsGifted;
          if (netFreshEggs !== 0 && supabaseServer) {
            try {
              const { data: eggRows } = await supabaseServer
                .from('EggInventories')
                .select('*')
                .eq('FarmId', rowFarmId)
                .eq('GradeOrType', 'Fresh Eggs');

              if (eggRows && eggRows.length > 0) {
                await supabaseServer.from('EggInventories').update({
                  Quantity: (Number(eggRows[0].Quantity) || 0) + netFreshEggs
                }).eq('Id', eggRows[0].Id);
              } else {
                await supabaseServer.from('EggInventories').insert([{
                  FarmId: rowFarmId,
                  GradeOrType: 'Fresh Eggs',
                  Quantity: netFreshEggs,
                  UnitCost: 5.0
                }]);
              }
            } catch (eggErr: any) {
              console.warn('[BulkImport egg inventory warning]:', eggErr.message);
            }
          }

          if (damagedEggs > 0 && supabaseServer) {
            try {
              const { data: wasteRows } = await supabaseServer
                .from('EggInventories')
                .select('*')
                .eq('FarmId', rowFarmId)
                .eq('GradeOrType', 'Damaged/Waste Eggs');

              if (wasteRows && wasteRows.length > 0) {
                await supabaseServer.from('EggInventories').update({
                  Quantity: (Number(wasteRows[0].Quantity) || 0) + damagedEggs
                }).eq('Id', wasteRows[0].Id);
              } else {
                await supabaseServer.from('EggInventories').insert([{
                  FarmId: rowFarmId,
                  GradeOrType: 'Damaged/Waste Eggs',
                  Quantity: damagedEggs,
                  UnitCost: 0
                }]);
              }
            } catch (wasteErr: any) {
              console.warn('[BulkImport egg waste warning]:', wasteErr.message);
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

        // Reconcile and synchronize all egg inventories and flock head counts across SQLite and Supabase
        await cleanDuplicateEggInventories(targetFarmId);
        await reconcileEggInventoryForFarm(targetFarmId);
        await reconcileAllFlocksInventory();

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
