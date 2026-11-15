import { Request, Response } from 'express';
import { query } from './db.js';
import { logAudit, cleanDuplicateEggInventories, reconcileEggInventoryForFarm } from './controllers.js';
import { supabaseServer, syncRecordToSupabase, reconcileAllFlocksInventory } from './supabase.js';
import * as XLSX from 'xlsx';
import { GoogleGenAI, Type } from '@google/genai';
import { keyPool } from './keyPool.js';

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

const MONTH_NAME_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

function expandTwoDigitYear(yy: string): string {
  const num = parseInt(yy, 10);
  if (isNaN(num)) return yy;
  return num >= 80 ? `19${yy.padStart(2, '0')}` : `20${yy.padStart(2, '0')}`;
}

function isValidYmdParts(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

export function cleanDate(rawDate: any): string {
  if (rawDate === undefined || rawDate === null) return '';

  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(rawDate)
    .replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, ' ')
    .trim();
  if (!str) return '';

  // Excel serial date number (integer or decimal like 46113 or 46113.45)
  if (/^\d{5}(?:\.\d+)?$/.test(str)) {
    const num = Math.floor(Number(str));
    if (num >= 25000 && num <= 65000) {
      const targetDate = new Date(Date.UTC(1899, 11, 30) + num * 86400000);
      if (!isNaN(targetDate.getTime())) {
        const y = targetDate.getUTCFullYear();
        const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  // Strip trailing time portion & English ordinal suffixes (e.g. "01-04-2026 00:00:00", "2026-04-01T14:30:00Z", "1st Apr 2026")
  const dateOnly = str
    .replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:\s*(?:AM|PM))?(?:Z|[+-]\d{2}:?\d{2})?$/i, '')
    .split('T')[0]
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .trim();

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymd = dateOnly.match(/^(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})$/);
  if (ymd) {
    const yr = Number(ymd[1]), mo = Number(ymd[2]), dy = Number(ymd[3]);
    if (isValidYmdParts(yr, mo, dy)) {
      return `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, DD-MM-YY, DD.MM.YY (with smart MM/DD fallback if middle token > 12)
  const dmy = dateOnly.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2}|\d{4})$/);
  if (dmy) {
    const p1 = Number(dmy[1]);
    const p2 = Number(dmy[2]);
    const yrStr = dmy[3].length === 2 ? expandTwoDigitYear(dmy[3]) : dmy[3];
    const yr = Number(yrStr);
    if (p2 > 12 && p1 <= 12 && isValidYmdParts(yr, p1, p2)) {
      return `${yrStr}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
    if (isValidYmdParts(yr, p2, p1)) {
      return `${yrStr}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
  }

  // Named months: DD-MMM-YYYY, DD MMM YYYY, DD/MMM/YY
  const dMonY = dateOnly.match(/^(\d{1,2})[\s\/\-.]+([A-Za-z]{3,9})[\s\/\-.,]+(\d{2}|\d{4})$/);
  if (dMonY) {
    const dy = Number(dMonY[1]);
    const moStr = MONTH_NAME_MAP[dMonY[2].toLowerCase()];
    const yrStr = dMonY[3].length === 2 ? expandTwoDigitYear(dMonY[3]) : dMonY[3];
    if (moStr && isValidYmdParts(Number(yrStr), Number(moStr), dy)) {
      return `${yrStr}-${moStr}-${String(dy).padStart(2, '0')}`;
    }
  }

  // Named months: MMM DD, YYYY or MMM-DD-YY
  const monDY = dateOnly.match(/^([A-Za-z]{3,9})[\s\/\-.]+(\d{1,2})[\s\/\-.,]+(\d{2}|\d{4})$/);
  if (monDY) {
    const moStr = MONTH_NAME_MAP[monDY[1].toLowerCase()];
    const dy = Number(monDY[2]);
    const yrStr = monDY[3].length === 2 ? expandTwoDigitYear(monDY[3]) : monDY[3];
    if (moStr && isValidYmdParts(Number(yrStr), Number(moStr), dy)) {
      return `${yrStr}-${moStr}-${String(dy).padStart(2, '0')}`;
    }
  }

  // Named months: YYYY-MMM-DD
  const yMonD = dateOnly.match(/^(\d{4})[\s\/\-.]+([A-Za-z]{3,9})[\s\/\-.]+(\d{1,2})$/);
  if (yMonD) {
    const yr = Number(yMonD[1]);
    const moStr = MONTH_NAME_MAP[yMonD[2].toLowerCase()];
    const dy = Number(yMonD[3]);
    if (moStr && isValidYmdParts(yr, Number(moStr), dy)) {
      return `${yMonD[1]}-${moStr}-${String(dy).padStart(2, '0')}`;
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

const SALES_HEADER_MAP: Record<string, string> = {
  invoicenumber: 'InvoiceNumber',
  invoiceno: 'InvoiceNumber',
  invno: 'InvoiceNumber',
  billnumber: 'InvoiceNumber',
  billno: 'InvoiceNumber',
  voucherno: 'InvoiceNumber',
  vouchernumber: 'InvoiceNumber',
  receiptno: 'InvoiceNumber',
  refno: 'InvoiceNumber',
  customername: 'CustomerName',
  customer: 'CustomerName',
  partyname: 'CustomerName',
  party: 'CustomerName',
  buyer: 'CustomerName',
  buyername: 'CustomerName',
  clientname: 'CustomerName',
  ledgername: 'CustomerName',
  saledate: 'SaleDate',
  date: 'SaleDate',
  billdate: 'SaleDate',
  invoicedate: 'SaleDate',
  txndate: 'SaleDate',
  voucherdate: 'SaleDate',
  transactiondate: 'SaleDate',
  itemname: 'ItemName',
  item: 'ItemName',
  productname: 'ItemName',
  product: 'ItemName',
  particulars: 'ItemName',
  itemtype: 'ItemType',
  type: 'ItemType',
  quantity: 'Quantity',
  qty: 'Quantity',
  nos: 'Quantity',
  pcs: 'Quantity',
  units: 'Quantity',
  unitprice: 'UnitPrice',
  rate: 'UnitPrice',
  price: 'UnitPrice',
  sellingprice: 'UnitPrice',
  gstpercentage: 'GSTPercentage',
  gst: 'GSTPercentage',
  gstpercent: 'GSTPercentage',
  taxrate: 'GSTPercentage',
  taxpercent: 'GSTPercentage',
  discount: 'Discount',
  disc: 'Discount',
  othercharges: 'OtherCharges',
  charges: 'OtherCharges',
  freight: 'OtherCharges',
  receivedamount: 'ReceivedAmount',
  received: 'ReceivedAmount',
  paidamount: 'ReceivedAmount',
  paid: 'ReceivedAmount',
  totalamount: 'TotalAmount',
  amount: 'TotalAmount',
  netamount: 'TotalAmount',
  grandtotal: 'TotalAmount',
  lineamount: 'TotalAmount',
  status: 'Status',
  paymentstatus: 'Status'
};

const PURCHASES_HEADER_MAP: Record<string, string> = {
  invoicenumber: 'InvoiceNumber',
  invoiceno: 'InvoiceNumber',
  invno: 'InvoiceNumber',
  billnumber: 'InvoiceNumber',
  billno: 'InvoiceNumber',
  voucherno: 'InvoiceNumber',
  suppliername: 'SupplierName',
  supplier: 'SupplierName',
  vendorname: 'SupplierName',
  vendor: 'SupplierName',
  partyname: 'SupplierName',
  party: 'SupplierName',
  purchasedate: 'PurchaseDate',
  date: 'PurchaseDate',
  billdate: 'PurchaseDate',
  invoicedate: 'PurchaseDate',
  txndate: 'PurchaseDate',
  voucherdate: 'PurchaseDate',
  itemname: 'ItemName',
  item: 'ItemName',
  productname: 'ItemName',
  product: 'ItemName',
  particulars: 'ItemName',
  itemtype: 'ItemType',
  type: 'ItemType',
  quantity: 'Quantity',
  qty: 'Quantity',
  unitprice: 'UnitPrice',
  rate: 'UnitPrice',
  price: 'UnitPrice',
  gstpercentage: 'GSTPercentage',
  gst: 'GSTPercentage',
  receivedamount: 'ReceivedAmount',
  paidamount: 'ReceivedAmount',
  paid: 'ReceivedAmount',
  totalamount: 'TotalAmount',
  amount: 'TotalAmount',
  netamount: 'TotalAmount',
  grandtotal: 'TotalAmount',
  status: 'Status'
};

const ITEMS_HEADER_MAP: Record<string, string> = {
  itemname: 'ItemName',
  item: 'ItemName',
  productname: 'ItemName',
  name: 'ItemName',
  category: 'Category',
  unitofmeasurement: 'UnitOfMeasurement',
  uom: 'UnitOfMeasurement',
  unit: 'UnitOfMeasurement',
  unitprice: 'UnitPrice',
  purchaseprice: 'UnitPrice',
  costprice: 'UnitPrice',
  sellingprice: 'SellingPrice',
  saleprice: 'SellingPrice',
  currentstock: 'CurrentStock',
  stock: 'CurrentStock',
  openingstock: 'CurrentStock',
  qty: 'CurrentStock',
  weightperunit: 'WeightPerUnit',
  minthreshold: 'MinThreshold'
};

export function normalizeRecordKeys(rawRecord: any, importType?: string): any {
  if (!rawRecord) return {};
  const normalized: any = { ...rawRecord };
  const typeMap =
    importType === 'sales' ? SALES_HEADER_MAP :
    importType === 'purchases' ? PURCHASES_HEADER_MAP :
    importType === 'items' ? ITEMS_HEADER_MAP :
    null;

  for (const [key, val] of Object.entries(rawRecord)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalKey = (typeMap && typeMap[cleanKey]) || HEADER_KEY_MAP[cleanKey];
    if (canonicalKey) {
      if (normalized[canonicalKey] === undefined || normalized[canonicalKey] === '') {
        normalized[canonicalKey] = typeof val === 'string' ? val.trim() : val;
      }
    }
  }

  // Fallback cross-alias for generic Date column when context is sales/purchases
  if (importType === 'sales' && !normalized.SaleDate && (normalized.LogDate || normalized.Date)) {
    normalized.SaleDate = normalized.LogDate || normalized.Date;
  }
  if (importType === 'purchases' && !normalized.PurchaseDate && (normalized.LogDate || normalized.Date)) {
    normalized.PurchaseDate = normalized.LogDate || normalized.Date;
  }

  return normalized;
}

export function isEggItemName(itemName: string, itemType?: string): boolean {
  const normType = (itemType || '').toLowerCase().trim();
  if (normType === 'egg' || normType === 'eggs') return true;
  if (normType === 'bird' || normType === 'birds' || normType === 'flock') return false;

  const norm = (itemName || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;

  // Exclude equipment/feed/packaging items that merely contain "egg" (e.g. "Egg Carton", "Egg Feeder", "Egg Mash Feed")
  if (/\b(mash|feed|feeder|carton|box|crate|tray machine|washer|incubator|cleaner|medicine|vaccine)\b/i.test(norm)) {
    return false;
  }

  return (
    norm === 'egg' ||
    norm === 'eggs' ||
    /\b(fresh|collected|table|white|brown|layer|culled|damaged|broken|cracked|waste|jumbo|small|medium|large|pullet)\s+eggs?\b/i.test(norm) ||
    /\beggs?\b/i.test(norm)
  );
}

export const ALLOWED_ITEM_CATEGORIES = ['Feed', 'Medicine', 'Equipment', 'Sales Item', 'Raw Ingredient'] as const;

export function inferItemCategory(
  itemName: string,
  rawCategory?: string,
  unitPrice?: number,
  sellingPrice?: number,
  notes?: string
): { category: string; inferred: boolean } {
  const cleanedRaw = (rawCategory || '').trim();
  const exactMatch = ALLOWED_ITEM_CATEGORIES.find(c => c.toLowerCase() === cleanedRaw.toLowerCase());
  if (exactMatch) {
    return { category: exactMatch, inferred: false };
  }

  const combined = `${cleanedRaw} ${itemName || ''} ${notes || ''}`.toLowerCase();

  if (/\b(medicine|med|vaccine|vaccination|vitamin|antibiotic|probiotic|tonic|syrup|tablet|capsule|powder|electrolyte|dewormer|disinfectant|sanitizer|drug|supplement|toxin\s*binder|liver)\b/i.test(combined)) {
    return { category: 'Medicine', inferred: true };
  }
  if (/\b(equipment|feeder|drinker|nipple|cage|crate|heater|brooder|bulb|fan|curtain|weighing|scale|washer|sprayer|incubator|nesting|machine|tool|tray\s*washer)\b/i.test(combined)) {
    return { category: 'Equipment', inferred: true };
  }
  if (/\b(raw\s*ingredient|maize|corn|soya|soybean|doc|wheat\s*bran|rice\s*bran|dorB|mustard\s*cake|groundnut|limestone|lsp|grit|shell\s*grit|salt|dcp|mcp|choline|lysine|methionine|premix|oil|molasses|bajra|jowar)\b/i.test(combined)) {
    return { category: 'Raw Ingredient', inferred: true };
  }
  if (/\b(feed|mash|crumble|pellet|prestarter|pre-starter|starter|grower|finisher|layer\s*feed|broiler\s*feed|concentrate|ration)\b/i.test(combined)) {
    return { category: 'Feed', inferred: true };
  }
  if (/\b(egg|eggs|bird|birds|hen|hens|broiler|layer|cull|pullet|chick|chicken|meat|manure|litter|sales?\s*item|finished|product|goods|retail)\b/i.test(combined)) {
    return { category: 'Sales Item', inferred: true };
  }

  // Price-based heuristic fallback
  if ((sellingPrice || 0) > 0 && !(unitPrice || 0)) {
    return { category: 'Sales Item', inferred: true };
  }
  if ((unitPrice || 0) > 0 && !(sellingPrice || 0)) {
    return { category: 'Feed', inferred: true };
  }
  return { category: 'Sales Item', inferred: true };
}

export function inferUnitOfMeasurement(
  itemName: string,
  rawUom?: string,
  category?: string,
  notes?: string
): { uom: string; inferred: boolean } {
  const trimmed = (rawUom || '').trim();
  if (trimmed) {
    return { uom: trimmed, inferred: false };
  }

  const combined = `${itemName || ''} ${notes || ''}`.toLowerCase();
  if (/\b(tray|trays|30\s*pcs|30pcs)\b/i.test(combined)) return { uom: 'Tray-30', inferred: true };
  if (/\b(dozen|doz|12\s*pcs)\b/i.test(combined)) return { uom: 'Dozen', inferred: true };
  if (/\b(bottle|btl|syrup|liquid|ltr|litre|liter|ml|vaccine|drops?)\b/i.test(combined)) return { uom: 'Bottle', inferred: true };
  if (/\b(bag|bags|sack|50\s*kg|25\s*kg)\b/i.test(combined)) return { uom: 'Bag', inferred: true };
  if (category === 'Feed' || category === 'Raw Ingredient' || /\b(kg|kilogram|gram|gm|quintal|ton|mt|feed|mash|maize|corn|soya|grit)\b/i.test(combined)) {
    return { uom: 'Kg', inferred: true };
  }
  return { uom: 'Pieces', inferred: true };
}

export type BulkImportType = 'sales' | 'purchases' | 'items' | 'daily-logs';

export function detectWorkbookLedgerType(
  fileName: string,
  sheetsContent: Array<{ name: string; rows: any[][] }>,
  requestedType: BulkImportType
): { detectedType: BulkImportType; confidence: number; reason: string } {
  const sampleText = [
    fileName || '',
    ...sheetsContent.map(s => `${s.name} ${s.rows.slice(0, 20).flat().join(' ')}`)
  ]
    .join(' ')
    .toLowerCase();

  const scores: Record<BulkImportType, number> = {
    sales: 0,
    purchases: 0,
    'daily-logs': 0,
    items: 0
  };

  // Filename signals
  if (/\b(sale|sales|invoice|billing|receipt|dispatch)\b/i.test(fileName || '')) scores.sales += 6;
  if (/\b(purchase|purchases|procurement|vendor|supplier|grn|inward)\b/i.test(fileName || '')) scores.purchases += 6;
  if (/\b(daily|log|logs|production|mortality|flock\s*report|egg\s*collection)\b/i.test(fileName || '')) scores['daily-logs'] += 6;
  if (/\b(item\s*master|inventory\s*list|catalog|stock\s*list|products?)\b/i.test(fileName || '')) scores.items += 6;

  // Sheet names & header/body vocabulary signals
  const headerTokens = sheetsContent
    .flatMap(s => [s.name, ...s.rows.slice(0, 12).flat()])
    .map(v => String(v || '').toLowerCase());

  for (const tok of headerTokens) {
    if (/\b(sale\s*date|customer|party\s*name|buyer|client|bill\s*to|sold\s*to|received\s*amount|sale\s*report|invoice\s*no|inv\s*no|bill\s*no|voucher\s*no|particulars|credit\s*sale|cash\s*sale|receipt\s*no)\b/i.test(tok)) {
      scores.sales += 3;
    }
    if (/\b(sale|sales|sold|retail\s*sale)\b/i.test(tok)) {
      scores.sales += 2;
    }
    if (/\b(purchase\s*date|supplier|vendor|grn|po\s*no|purchased\s*from|bill\s*from|procurement|landing)\b/i.test(tok)) {
      scores.purchases += 3;
    }
    if (/\b(flock|shed|house|batch|mortality|eggs\s*collected|damaged\s*eggs|feed\s*consumed|water\s*consumed|daily\s*log|avg\s*weight)\b/i.test(tok)) {
      scores['daily-logs'] += 3;
    }
    if (/\b(unit\s*of\s*measurement|uom|min\s*threshold|weight\s*per\s*unit|opening\s*stock|current\s*stock|reorder|category)\b/i.test(tok)) {
      scores.items += 3;
    }
  }

  // Date presence strongly suggests transactional/daily-log rather than static Item Master
  const hasDatePattern = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/.test(sampleText);
  if (hasDatePattern) {
    scores.sales += 1;
    scores.purchases += 1;
    scores['daily-logs'] += 1;
  }

  const ranked = (Object.entries(scores) as Array<[BulkImportType, number]>).sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = ranked[0];
  const [, secondScore] = ranked[1];

  if (bestScore >= 4 && bestScore > secondScore && bestType !== requestedType) {
    return {
      detectedType: bestType,
      confidence: bestScore,
      reason: `Detected ${bestType.toUpperCase()} workbook structure from sheet headers/filename (score ${bestScore} vs ${requestedType} ${scores[requestedType]}).`
    };
  }

  return {
    detectedType: requestedType,
    confidence: scores[requestedType],
    reason: `Using selected ledger type ${requestedType.toUpperCase()}.`
  };
}

function csvEscapeCell(val: any): string {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function recordsToCsv(headers: string[], records: Record<string, any>[]): string {
  const lines: string[] = [headers.map(csvEscapeCell).join(',')];
  for (const rec of records) {
    lines.push(headers.map(h => csvEscapeCell(rec[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

// Extended lookup helper for raw Excel header normalization
function resolveRawHeaderToCanonical(rawHeader: string, targetType: BulkImportType): string | null {
  const cleanKey = (rawHeader || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanKey) return null;

  const extraAccountingMap: Record<string, Record<string, string>> = {
    sales: {
      vchno: 'InvoiceNumber',
      voucherno: 'InvoiceNumber',
      vouchernumber: 'InvoiceNumber',
      docno: 'InvoiceNumber',
      refno: 'InvoiceNumber',
      challanno: 'InvoiceNumber',
      vchdate: 'SaleDate',
      trandate: 'SaleDate',
      billdate: 'SaleDate',
      invoicedate: 'SaleDate',
      party: 'CustomerName',
      partyname: 'CustomerName',
      ledger: 'CustomerName',
      ledgername: 'CustomerName',
      account: 'CustomerName',
      accountname: 'CustomerName',
      nameofitem: 'ItemName',
      itemdescription: 'ItemName',
      description: 'ItemName',
      particular: 'ItemName',
      particulars: 'ItemName',
      totalqty: 'Quantity',
      nos: 'Quantity',
      trays: 'Quantity',
      totalamount: 'TotalAmount',
      grossamount: 'TotalAmount',
      netamount: 'TotalAmount',
      taxablevalue: 'TotalAmount',
      amount: 'TotalAmount',
      value: 'TotalAmount',
      total: 'TotalAmount',
      cgst: 'GSTPercentage',
      sgst: 'GSTPercentage',
      igst: 'GSTPercentage'
    },
    purchases: {
      vchno: 'InvoiceNumber',
      voucherno: 'InvoiceNumber',
      docno: 'InvoiceNumber',
      vchdate: 'PurchaseDate',
      trandate: 'PurchaseDate',
      billdate: 'PurchaseDate',
      invoicedate: 'PurchaseDate',
      party: 'SupplierName',
      partyname: 'SupplierName',
      ledger: 'SupplierName',
      ledgername: 'SupplierName',
      nameofitem: 'ItemName',
      description: 'ItemName',
      particular: 'ItemName',
      particulars: 'ItemName',
      totalqty: 'Quantity',
      totalamount: 'TotalAmount',
      grossamount: 'TotalAmount',
      netamount: 'TotalAmount',
      amount: 'TotalAmount',
      value: 'TotalAmount',
      total: 'TotalAmount'
    },
    items: {
      name: 'ItemName',
      nameofitem: 'ItemName',
      itemdescription: 'ItemName',
      particulars: 'ItemName',
      unit: 'UnitOfMeasurement',
      uom: 'UnitOfMeasurement',
      qty: 'CurrentStock',
      quantity: 'CurrentStock',
      rate: 'UnitPrice',
      price: 'SellingPrice'
    },
    'daily-logs': {
      shed: 'FlockName',
      batch: 'FlockName',
      house: 'FlockName',
      mortality: 'MortalityCount',
      eggs: 'EggsCollected',
      feed: 'FeedConsumedKg'
    }
  };

  const primaryMap =
    targetType === 'sales' ? SALES_HEADER_MAP :
    targetType === 'purchases' ? PURCHASES_HEADER_MAP :
    targetType === 'items' ? ITEMS_HEADER_MAP :
    HEADER_KEY_MAP;

  return (
    primaryMap[cleanKey] ||
    extraAccountingMap[targetType]?.[cleanKey] ||
    HEADER_KEY_MAP[cleanKey] ||
    null
  );
}

function isSummaryOrSeparatorRow(row: string[]): boolean {
  const nonEmpty = row.map(c => (c || '').trim()).filter(Boolean);
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.every(c => /^[-=_*.\s]+$/.test(c))) return true;
  const firstTwo = nonEmpty.slice(0, 2).join(' ').toLowerCase();
  if (/^(total|grand\s*total|sub[\s-]*total|net\s*total|overall\s*total|summary|page\s*\d+|opening\s*bal|closing\s*bal|brought\s*forward|carried\s*forward)\b/i.test(firstTwo)) {
    return true;
  }
  return false;
}

interface SheetMappingSpec {
  sheetName: string;
  role: 'primary' | 'header' | 'items' | 'ignore';
  headerRowIndex: number;
  joinKeyColumn?: string;
  columnMap: Array<{ rawHeader: string; schemaField: string }>;
  defaults?: Array<{ field: string; value: string }>;
}

function detectDeterministicSheetMapping(
  sheetsContent: Array<{ name: string; rows: string[][] }>,
  targetType: BulkImportType
): SheetMappingSpec[] {
  const specs: SheetMappingSpec[] = [];

  for (const sheet of sheetsContent) {
    let bestRowIdx = 0;
    let bestScore = -1;
    let bestMap: Array<{ rawHeader: string; schemaField: string }> = [];

    const scanLimit = Math.min(sheet.rows.length, 30);
    for (let r = 0; r < scanLimit; r++) {
      const row = sheet.rows[r];
      const mappedCols: Array<{ rawHeader: string; schemaField: string }> = [];
      const seenFields = new Set<string>();
      let textCells = 0;

      row.forEach((cell, colIdx) => {
        const hdr = (cell || '').trim();
        if (!hdr) return;
        if (!/^\d+(?:[.,]\d+)?$/.test(hdr)) textCells++;
        const canonical = resolveRawHeaderToCanonical(hdr, targetType);
        if (canonical && (!seenFields.has(canonical) || canonical === 'GSTPercentage')) {
          seenFields.add(canonical);
          mappedCols.push({ rawHeader: hdr, schemaField: canonical });
        } else {
          mappedCols.push({ rawHeader: hdr || `Col_${colIdx}`, schemaField: 'Ignore' });
        }
      });

      const score = seenFields.size * 10 + (textCells >= 3 ? 2 : 0);
      if (score > bestScore && seenFields.size >= 2) {
        bestScore = score;
        bestRowIdx = r;
        bestMap = mappedCols;
      }
    }

    if (bestScore >= 20) {
      const defaults: Array<{ field: string; value: string }> = [];
      const titleText = sheet.rows.slice(0, bestRowIdx).flat().join(' ');
      if (targetType === 'sales' && !bestMap.some(m => m.schemaField === 'ItemName')) {
        if (/\beggs?\b/i.test(titleText)) {
          defaults.push({ field: 'ItemName', value: 'Eggs' });
        }
      }
      specs.push({
        sheetName: sheet.name,
        role: 'primary',
        headerRowIndex: bestRowIdx,
        columnMap: bestMap,
        defaults
      });
    }
  }

  if (specs.length >= 2) {
    const headerSheet = specs.find(s =>
      s.columnMap.some(m => m.schemaField === 'InvoiceNumber') &&
      s.columnMap.some(m => m.schemaField === 'CustomerName' || m.schemaField === 'SupplierName' || m.schemaField === 'SaleDate' || m.schemaField === 'PurchaseDate') &&
      !s.columnMap.some(m => m.schemaField === 'Quantity')
    );
    const itemsSheet = specs.find(s =>
      s !== headerSheet &&
      s.columnMap.some(m => m.schemaField === 'InvoiceNumber') &&
      s.columnMap.some(m => m.schemaField === 'Quantity' || m.schemaField === 'ItemName')
    );
    if (headerSheet && itemsSheet) {
      const joinColH = headerSheet.columnMap.find(m => m.schemaField === 'InvoiceNumber')?.rawHeader;
      const joinColI = itemsSheet.columnMap.find(m => m.schemaField === 'InvoiceNumber')?.rawHeader;
      if (joinColH && joinColI) {
        headerSheet.role = 'header';
        headerSheet.joinKeyColumn = joinColH;
        itemsSheet.role = 'items';
        itemsSheet.joinKeyColumn = joinColI;
      }
    }
  }

  return specs;
}

function applySheetMappingsToRecords(
  sheetsContent: Array<{ name: string; rows: string[][] }>,
  specs: SheetMappingSpec[],
  targetType: BulkImportType,
  targetHeaders: string[]
): Record<string, any>[] {
  const sheetByName = new Map<string, string[][]>(
    sheetsContent.map(s => [s.name.toLowerCase().trim(), s.rows])
  );

  const extractMappedRowsForSpec = (spec: SheetMappingSpec): Array<Record<string, any>> => {
    const rows = sheetByName.get((spec.sheetName || '').toLowerCase().trim()) || [];
    if (rows.length === 0) return [];

    // Verify headerRowIndex against nearby rows (+/- 2) in case AI index was slightly shifted
    const specHeadersNorm = new Set(
      (spec.columnMap || [])
        .map(m => (m.rawHeader || '').toLowerCase().replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    );
    let headerRowIdx = Math.max(0, Math.min(spec.headerRowIndex || 0, rows.length - 1));
    if (specHeadersNorm.size > 0) {
      let bestMatchIdx = headerRowIdx;
      let bestMatchCount = -1;
      const startProbe = Math.max(0, headerRowIdx - 2);
      const endProbe = Math.min(rows.length - 1, headerRowIdx + 2);
      for (let p = startProbe; p <= endProbe; p++) {
        const count = (rows[p] || []).filter(c =>
          specHeadersNorm.has((c || '').toLowerCase().replace(/\s+/g, ' ').trim())
        ).length;
        if (count > bestMatchCount) {
          bestMatchCount = count;
          bestMatchIdx = p;
        }
      }
      if (bestMatchCount > 0) headerRowIdx = bestMatchIdx;
    }

    const headerCells = rows[headerRowIdx] || [];
    const colToField: Array<{ idx: number; field: string; rawHeader: string }> = [];
    const assignedFields = new Set<string>();

    headerCells.forEach((cell, idx) => {
      const raw = (cell || '').trim();
      const rawNorm = raw.toLowerCase().replace(/\s+/g, ' ').trim();
      const fromSpec = (spec.columnMap || []).find(
        m => m.rawHeader && m.rawHeader.toLowerCase().replace(/\s+/g, ' ').trim() === rawNorm
      );
      let schemaField =
        fromSpec && fromSpec.schemaField
          ? fromSpec.schemaField
          : resolveRawHeaderToCanonical(raw, targetType);

      if (schemaField === 'Ignore') return;
      if (schemaField && (!assignedFields.has(schemaField) || schemaField === 'GSTPercentage')) {
        assignedFields.add(schemaField);
        colToField.push({ idx, field: schemaField, rawHeader: raw });
      }
    });

    if (colToField.length === 0 && Array.isArray(spec.columnMap)) {
      spec.columnMap.forEach((m, idx) => {
        if (m.schemaField && m.schemaField !== 'Ignore') {
          colToField.push({ idx, field: m.schemaField, rawHeader: m.rawHeader });
        }
      });
    }

    const out: Array<Record<string, any>> = [];
    let lastGroupInvoice = '';
    let lastGroupDate = '';
    let lastGroupParty = '';
    let lastGroupFlock = '';

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || isSummaryOrSeparatorRow(row)) continue;

      const matchesHeaderCount = colToField.filter(
        c => (row[c.idx] || '').trim().toLowerCase() === c.rawHeader.toLowerCase()
      ).length;
      if (matchesHeaderCount >= Math.max(2, colToField.length - 1)) continue;

      const rec: Record<string, any> = {};
      for (const h of targetHeaders) rec[h] = '';
      if (Array.isArray(spec.defaults)) {
        for (const d of spec.defaults) {
          if (d.field && d.value && !rec[d.field]) rec[d.field] = d.value;
        }
      }

      for (const { idx, field } of colToField) {
        const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
        if (val !== '') {
          if (!rec[field]) {
            rec[field] = val;
          } else if (field === 'GSTPercentage') {
            rec[field] = String(cleanFloat(rec[field]) + cleanFloat(val));
          }
        }
      }

      const hasUsefulData =
        Boolean(rec.ItemName) ||
        Boolean(rec.Quantity) ||
        Boolean(rec.UnitPrice) ||
        Boolean(rec.TotalAmount) ||
        Boolean(rec.EggsCollected) ||
        Boolean(rec.FeedConsumedKg) ||
        Boolean(rec.MortalityCount) ||
        Boolean(rec.CustomerName) ||
        Boolean(rec.SupplierName) ||
        Boolean(rec.InvoiceNumber);

      if (!hasUsefulData) continue;

      if (targetType === 'sales') {
        if (rec.SaleDate) lastGroupDate = rec.SaleDate;
        else if (lastGroupDate && (rec.ItemName || rec.Quantity || rec.TotalAmount)) rec.SaleDate = lastGroupDate;

        if (rec.InvoiceNumber) lastGroupInvoice = rec.InvoiceNumber;
        else if (lastGroupInvoice && (rec.ItemName || rec.Quantity)) rec.InvoiceNumber = lastGroupInvoice;

        if (rec.CustomerName) lastGroupParty = rec.CustomerName;
        else if (lastGroupParty && (rec.ItemName || rec.Quantity)) rec.CustomerName = lastGroupParty;
      } else if (targetType === 'purchases') {
        if (rec.PurchaseDate) lastGroupDate = rec.PurchaseDate;
        else if (lastGroupDate && (rec.ItemName || rec.Quantity || rec.TotalAmount)) rec.PurchaseDate = lastGroupDate;

        if (rec.InvoiceNumber) lastGroupInvoice = rec.InvoiceNumber;
        else if (lastGroupInvoice && (rec.ItemName || rec.Quantity)) rec.InvoiceNumber = lastGroupInvoice;

        if (rec.SupplierName) lastGroupParty = rec.SupplierName;
        else if (lastGroupParty && (rec.ItemName || rec.Quantity)) rec.SupplierName = lastGroupParty;
      } else if (targetType === 'daily-logs') {
        if (rec.LogDate) lastGroupDate = rec.LogDate;
        else if (lastGroupDate) rec.LogDate = lastGroupDate;

        if (rec.FlockName) lastGroupFlock = rec.FlockName;
        else if (lastGroupFlock) rec.FlockName = lastGroupFlock;
      }

      out.push(rec);
    }

    return out;
  };

  const headerSpec = specs.find(s => s.role === 'header');
  const itemsSpec = specs.find(s => s.role === 'items');
  if (headerSpec && itemsSpec) {
    const headerRows = extractMappedRowsForSpec(headerSpec);
    const itemRows = extractMappedRowsForSpec(itemsSpec);
    const headerByInv = new Map<string, Record<string, any>>();
    for (const hr of headerRows) {
      const key = String(hr.InvoiceNumber || '').toLowerCase().trim();
      if (key) headerByInv.set(key, hr);
    }
    if (itemRows.length > 0 && headerByInv.size > 0) {
      return itemRows.map(ir => {
        const key = String(ir.InvoiceNumber || '').toLowerCase().trim();
        const hdr = headerByInv.get(key) || {};
        const merged: Record<string, any> = {};
        for (const h of targetHeaders) {
          merged[h] = ir[h] || hdr[h] || '';
        }
        if (ir.TotalAmount && !merged.TotalAmount) merged.TotalAmount = ir.TotalAmount;
        else if (hdr.TotalAmount && !merged.TotalAmount) merged.TotalAmount = hdr.TotalAmount;
        return merged;
      });
    }
  }

  const allRows: Record<string, any>[] = [];
  for (const spec of specs) {
    if (spec.role === 'ignore') continue;
    allRows.push(...extractMappedRowsForSpec(spec));
  }
  return allRows;
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
            supabaseServer.from('Inventories').select('Id, ItemName, FarmId, Category, CurrentStock, UnitPrice').limit(100000),
            supabaseServer.from('Flocks').select('Id, FlockName, FarmId, Breed, CurrentCount, TotalFeedCost, Status, PerBirdPurchasePrice').limit(10000),
            supabaseServer.from('Suppliers').select('Id, CompanyName, FarmId').limit(10000),
            supabaseServer.from('Customers').select('Id, FullName, FarmId').limit(10000),
            supabaseServer.from('EggInventories').select('Id, GradeOrType, FarmId, Quantity').limit(10000),
            supabaseServer.from('Purchases').select('InvoiceNumber, FarmId').limit(100000),
            supabaseServer.from('Sales').select('InvoiceNumber, FarmId').limit(100000),
            supabaseServer.from('DailyLogs').select('FlockId, LogDate, FarmId').limit(100000)
          ]);

          allFlocks = flkRes.data || [];
          flocks = targetFarmId ? allFlocks.filter((f: any) => Number(f.FarmId) === targetFarmId || !f.FarmId) : allFlocks;
          const allInvs = invRes.data || [];
          inventories = targetFarmId ? allInvs.filter((i: any) => Number(i.FarmId) === targetFarmId || !i.FarmId) : allInvs;
          const allSups = supRes.data || [];
          suppliers = targetFarmId ? allSups.filter((s: any) => Number(s.FarmId) === targetFarmId || !s.FarmId) : allSups;
          const allCusts = custRes.data || [];
          customers = targetFarmId ? allCusts.filter((c: any) => Number(c.FarmId) === targetFarmId || !c.FarmId) : allCusts;
          const allEggs = eggRes.data || [];
          eggInventories = targetFarmId ? allEggs.filter((e: any) => Number(e.FarmId) === targetFarmId || !e.FarmId) : allEggs;

          (purchRes.data || []).forEach((p: any) => {
            if (p.InvoiceNumber && (Number(p.FarmId) === targetFarmId || !p.FarmId)) {
              existingPurchasesInvoices.add(p.InvoiceNumber.toLowerCase().trim());
            }
          });

          (salesRes.data || []).forEach((s: any) => {
            if (s.InvoiceNumber && (Number(s.FarmId) === targetFarmId || !s.FarmId)) {
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
      const seenItemNamesInFile = new Set<string>();
      let lastSeenSaleDate = '';
      let lastSeenPurchaseDate = '';
      let lastSeenLogDate = '';

      for (let index = 0; index < dataRows.length; index++) {
        const rawRow = dataRows[index];
        const rawRecord: any = {};
        
        // Map list values to keys based on header row
        headers.forEach((header, colIndex) => {
          if (header) {
            rawRecord[header] = rawRow[colIndex] ? rawRow[colIndex].trim() : '';
          }
        });

        // Apply context-aware alias mapping for columns across all import types
        const record = normalizeRecordKeys(rawRecord, type);

        let status: 'Valid' | 'Duplicate' | 'Invalid' = 'Valid';
        const errors: string[] = [];
        const details: string[] = [];

        if (type === 'items') {
          // Fields: ItemName, Category, UnitOfMeasurement, UnitPrice, SellingPrice, CurrentStock, WeightPerUnit, MinThreshold, Notes
          const itemName = (record.ItemName || '').trim();
          record.ItemName = itemName;

          const unitPrice = cleanFloat(record.UnitPrice || 0);
          const sellingPrice = cleanFloat(record.SellingPrice || 0);
          const currentStock = cleanFloat(record.CurrentStock || 0);
          const weightPerUnit = cleanFloat(record.WeightPerUnit || 1) || 1;
          const minThreshold = cleanFloat(record.MinThreshold || 0);

          record.UnitPrice = String(unitPrice);
          record.SellingPrice = String(sellingPrice);
          record.CurrentStock = String(currentStock);
          record.WeightPerUnit = String(weightPerUnit);
          record.MinThreshold = String(minThreshold);
          record.Notes = (record.Notes || '').trim();

          const catResult = inferItemCategory(itemName, record.Category, unitPrice, sellingPrice, record.Notes);
          const category = catResult.category;
          record.Category = category;

          const uomResult = inferUnitOfMeasurement(itemName, record.UnitOfMeasurement, category, record.Notes);
          const uom = uomResult.uom;
          record.UnitOfMeasurement = uom;

          if (!itemName) {
            errors.push('Missing unique ItemName');
            status = 'Invalid';
          }

          if (catResult.inferred && itemName) {
            details.push(`Auto-inferred Category: "${category}"`);
          }
          if (uomResult.inferred && itemName) {
            details.push(`Auto-inferred Unit: "${uom}"`);
          }

          const itemKey = itemName.toLowerCase().trim();
          if (itemKey && (existingInvs.has(itemKey) || seenItemNamesInFile.has(itemKey))) {
            status = 'Duplicate';
            details.push(
              existingInvs.has(itemKey)
                ? `Item "${itemName}" already exists in DB. It will be skipped.`
                : `Item "${itemName}" appears earlier in this file. Duplicate row skipped.`
            );
          } else if (status === 'Valid' && itemName) {
            seenItemNamesInFile.add(itemKey);
            details.push(`New item to be registered: "${itemName}" (${category} • ${uom})`);
          }

        } else if (type === 'daily-logs') {
          // Fields: FlockName, LogDate, FeedName, FeedConsumedKg, MortalityCount, EggsCollected, DamagedEggsCollected, WaterConsumed, DailyAverageWeight, BirdsEatenBySelf, BirdsEatenValue, EggsGifted, EggsGiftedValue, Notes
          let flockName = (record.FlockName || '').trim();
          let logDate = cleanDate(record.LogDate || '');
          if (!logDate && lastSeenLogDate) {
            logDate = lastSeenLogDate;
            details.push(`Inherited LogDate ${logDate} from previous row.`);
          } else if (logDate && /^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
            lastSeenLogDate = logDate;
          }
          record.LogDate = logDate;
          const feedName = record.FeedName || '';

          if (!flockName && flocks.length === 1) {
            flockName = flocks[0].FlockName;
            record.FlockName = flockName;
            details.push(`Auto-assigned to active flock: "${flockName}"`);
          }

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
              dailyLogSet.add(logKey);
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
          const invoiceNo = (record.InvoiceNumber || '').trim();
          let supplierName = (record.SupplierName || '').trim();
          if (!supplierName) {
            supplierName = 'General Supplier';
            record.SupplierName = supplierName;
            details.push('Missing SupplierName defaulted to "General Supplier".');
          }

          let purchaseDate = cleanDate(record.PurchaseDate || '');
          if (!purchaseDate && lastSeenPurchaseDate) {
            purchaseDate = lastSeenPurchaseDate;
            details.push(`Inherited PurchaseDate ${purchaseDate} from previous row.`);
          } else if (purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
            lastSeenPurchaseDate = purchaseDate;
          }
          record.PurchaseDate = purchaseDate;

          const itemName = (record.ItemName || '').trim();
          const itemType = (record.ItemType || 'Inventory').trim();

          let qty = cleanFloat(record.Quantity || 0);
          let price = cleanFloat(record.UnitPrice || 0);
          const rawTotalAmt = cleanFloat(record.TotalAmount || 0);
          if (qty <= 0 && (price > 0 || rawTotalAmt > 0) && itemName) {
            qty = 1;
            details.push('Missing Quantity defaulted to 1.');
          }
          if (price === 0 && rawTotalAmt > 0 && qty > 0) {
            price = Number((rawTotalAmt / qty).toFixed(4));
            details.push(`Computed UnitPrice (${price}) from TotalAmount / Quantity.`);
          }

          const gstPerc = cleanFloat(record.GSTPercentage || 0);
          let receivedAmt = cleanFloat(record.ReceivedAmount || 0);
          const explicitStatus = (record.Status || '').trim().toLowerCase();
          const estTotal = (qty * price) * (1 + gstPerc / 100);
          if (receivedAmt === 0 && estTotal > 0 && explicitStatus !== 'unpaid' && explicitStatus !== 'credit') {
            if (explicitStatus === 'paid' || (!explicitStatus && record.ReceivedAmount === undefined)) {
              receivedAmt = Number(estTotal.toFixed(2));
            }
          }
          if (!record.Status) {
            record.Status = receivedAmt >= estTotal - 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          }

          record.Quantity = String(qty);
          record.UnitPrice = String(price);
          record.GSTPercentage = String(gstPerc);
          record.ReceivedAmount = String(receivedAmt);

          if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
            errors.push('Missing or invalid PurchaseDate (YYYY-MM-DD)');
            status = 'Invalid';
          }
          if (!itemName) {
            errors.push('Missing ItemName');
            status = 'Invalid';
          }
          if (isNaN(qty) || qty <= 0) {
            errors.push('Quantity must be a positive number');
            status = 'Invalid';
          }
          if (isNaN(price) || price < 0) {
            errors.push('UnitPrice must be 0 or greater');
            status = 'Invalid';
          }

          if (invoiceNo && existingPurchasesInvoices.has(invoiceNo.toLowerCase().trim())) {
            status = 'Duplicate';
            details.push(`Invoice "${invoiceNo}" already exists in Purchases. It will be skipped.`);
          } else {
            const matchedSupplier = suppliers.find(s => (s.CompanyName || '').toLowerCase().trim() === supplierName.toLowerCase().trim());
            if (matchedSupplier) {
              record._supplierId = matchedSupplier.Id;
              details.push(`Matched existing Supplier: "${supplierName}"`);
            } else {
              details.push(`Supplier name "${supplierName}" is new. A new supplier profile will be auto-generated.`);
            }

            if (itemType.toLowerCase() === 'flock') {
              record.ItemType = 'Flock';
              const flockMatch = findSmartFlockMatch(itemName, flocks, allFlocks);
              if (!flockMatch) {
                errors.push(`Flock name "${itemName}" must be created first to purchase flock items`);
                status = 'Invalid';
              } else {
                record._flockId = flockMatch.flock.Id;
                details.push(`Matched active flock "${flockMatch.flock.FlockName}"`);
              }
            } else {
              record.ItemType = 'Inventory';
              const matchedItem = inventories.find(inv => (inv.ItemName || '').toLowerCase().trim() === itemName.toLowerCase().trim());
              if (!matchedItem) {
                const inferredCat = inferItemCategory(itemName, '', price, 0, record.Notes);
                const inferredUom = inferUnitOfMeasurement(itemName, '', inferredCat.category, record.Notes);
                record._autoCreateCategory = inferredCat.category;
                record._autoCreateUom = inferredUom.uom;
                details.push(`New warehouse item "${itemName}" (${inferredCat.category}, ${inferredUom.uom}) will be auto-registered on commit.`);
              } else {
                record._inventoryId = matchedItem.Id;
                details.push(`Matched Item: "${itemName}" (ID: ${matchedItem.Id})`);
              }
            }
          }

        } else if (type === 'sales') {
          // Fields: InvoiceNumber, CustomerName, SaleDate, ItemName, ItemType, Quantity, UnitPrice, GSTPercentage, Discount, OtherCharges, ReceivedAmount, Status, Notes
          const invoiceNo = (record.InvoiceNumber || '').trim();
          let customerName = (record.CustomerName || '').trim();
          if (!customerName) {
            customerName = 'Walk-in Customer';
            record.CustomerName = customerName;
            details.push('Missing CustomerName defaulted to "Walk-in Customer".');
          }

          let saleDate = cleanDate(record.SaleDate || '');
          if (!saleDate && lastSeenSaleDate) {
            saleDate = lastSeenSaleDate;
            details.push(`Inherited SaleDate ${saleDate} from previous row.`);
          } else if (saleDate && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
            lastSeenSaleDate = saleDate;
          }
          record.SaleDate = saleDate;

          let itemName = (record.ItemName || '').trim();
          let qty = cleanFloat(record.Quantity || 0);
          let price = cleanFloat(record.UnitPrice || 0);
          const rawTotalAmt = cleanFloat(record.TotalAmount || 0);

          if (!itemName && (qty > 0 || rawTotalAmt > 0 || price > 0)) {
            itemName = 'Fresh Eggs';
            record.ItemName = itemName;
            details.push('Missing ItemName defaulted to "Fresh Eggs".');
          }

          // Resolve exact warehouse match before inferring Egg vs General Inventory
          const exactWarehouseMatch = inventories.find(
            inv => (inv.ItemName || '').toLowerCase().trim() === itemName.toLowerCase()
          );

          const rawTypeLower = (record.ItemType || '').toLowerCase().trim();
          let resolvedItemType: 'Egg' | 'Bird' | 'General Inventory' = 'General Inventory';
          if (rawTypeLower === 'egg' || rawTypeLower === 'eggs') {
            resolvedItemType = 'Egg';
          } else if (rawTypeLower === 'bird' || rawTypeLower === 'birds' || rawTypeLower === 'flock') {
            resolvedItemType = 'Bird';
          } else if (
            isEggItemName(itemName, record.ItemType) &&
            (!exactWarehouseMatch || /^(eggs?|fresh\s*eggs?|collected\s*eggs?)$/i.test(itemName))
          ) {
            // Item "Eggs" or egg varieties should automatically map to collected eggs in EggInventories
            resolvedItemType = 'Egg';
          } else if (
            !exactWarehouseMatch &&
            !/\b(feed|mash|crumble|pellet|starter|grower|finisher|concentrate|premix|ration|medicine|vaccine|feeder|drinker|tray)\b/i.test(itemName) &&
            /\b(bird|birds|hen|hens|broiler|layer|cull|culls|flock)\b/i.test(itemName)
          ) {
            resolvedItemType = 'Bird';
          }
          record.ItemType = resolvedItemType;

          if (qty <= 0 && (price > 0 || rawTotalAmt > 0) && itemName) {
            qty = 1;
            details.push('Missing Quantity defaulted to 1.');
          }
          if (price === 0 && rawTotalAmt > 0 && qty > 0) {
            price = Number((rawTotalAmt / qty).toFixed(4));
            details.push(`Computed UnitPrice (${price}) from TotalAmount / Quantity.`);
          } else if (price === 0 && exactWarehouseMatch && Number(exactWarehouseMatch.UnitPrice) > 0) {
            price = Number(exactWarehouseMatch.UnitPrice);
            details.push(`Auto-filled UnitPrice (${price}) from item catalog.`);
          }

          const gstPerc = cleanFloat(record.GSTPercentage || 0);
          const discount = cleanFloat(record.Discount || 0);
          const otherCharges = cleanFloat(record.OtherCharges || 0);
          let receivedAmt = cleanFloat(record.ReceivedAmount || 0);
          const estGrandTotal = Math.max(0, (qty * price) * (1 + gstPerc / 100) + otherCharges - discount);
          const explicitStatus = (record.Status || '').trim().toLowerCase();

          if (receivedAmt === 0 && estGrandTotal > 0 && explicitStatus !== 'unpaid' && explicitStatus !== 'credit' && explicitStatus !== 'due') {
            if (explicitStatus === 'paid' || explicitStatus === 'cash' || (!explicitStatus && (record.ReceivedAmount === undefined || record.ReceivedAmount === ''))) {
              receivedAmt = Number(estGrandTotal.toFixed(2));
            }
          }
          if (!record.Status) {
            record.Status = receivedAmt >= estGrandTotal - 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          }

          record.Quantity = String(qty);
          record.UnitPrice = String(price);
          record.GSTPercentage = String(gstPerc);
          record.Discount = String(discount);
          record.OtherCharges = String(otherCharges);
          record.ReceivedAmount = String(receivedAmt);

          if (!saleDate || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
            errors.push('Missing or invalid SaleDate (YYYY-MM-DD)');
            status = 'Invalid';
          }
          if (!itemName) {
            errors.push('Missing ItemName');
            status = 'Invalid';
          }
          if (isNaN(qty) || qty <= 0) {
            errors.push('Quantity must be a positive number');
            status = 'Invalid';
          }
          if (isNaN(price) || price < 0) {
            errors.push('UnitPrice must be 0 or greater');
            status = 'Invalid';
          }

          if (invoiceNo && existingSalesInvoices.has(invoiceNo.toLowerCase().trim())) {
            status = 'Duplicate';
            details.push(`Invoice "${invoiceNo}" already exists in Sales. It will be skipped.`);
          } else {
            const matchedCustomer = customers.find(c => (c.FullName || '').toLowerCase().trim() === customerName.toLowerCase().trim());
            if (matchedCustomer) {
              record._customerId = matchedCustomer.Id;
              details.push(`Found existing Customer: "${customerName}"`);
            } else {
              details.push(`Customer "${customerName}" is new. A profile will be auto-generated.`);
            }

            if (resolvedItemType === 'Bird') {
              const flockMatch = findSmartFlockMatch(itemName, flocks, allFlocks);
              if (!flockMatch) {
                errors.push(`Flock/Bird name "${itemName}" not found in current layer flocks.`);
                status = 'Invalid';
              } else {
                record._flockId = flockMatch.flock.Id;
                details.push(`Matched Flock: "${flockMatch.flock.FlockName}" (ID: #${flockMatch.flock.Id})`);
              }
            } else if (resolvedItemType === 'Egg') {
              const isDamaged = /\b(damaged|waste|broken|cracked)\b/i.test(itemName);
              const matchedEgg = eggInventories.find(
                e => (e.GradeOrType || '').toLowerCase().trim() === itemName.toLowerCase().trim()
              );
              const preferredEgg =
                matchedEgg ||
                (isDamaged
                  ? eggInventories.find(e => /damaged|waste/i.test(e.GradeOrType || ''))
                  : eggInventories.find(e => (e.GradeOrType || '').toLowerCase().trim() === 'fresh eggs')) ||
                eggInventories[0];

              if (preferredEgg) {
                record._eggInventoryId = preferredEgg.Id;
                record._eggGradeOrType = preferredEgg.GradeOrType;
                details.push(`Matched Collected Eggs Inventory: "${preferredEgg.GradeOrType}" (Available: ${Number(preferredEgg.Quantity || 0).toLocaleString()})`);
              } else {
                record._eggInventoryId = null;
                record._eggGradeOrType = isDamaged ? 'Damaged/Waste Eggs' : 'Fresh Eggs';
                details.push(`Collected Eggs Inventory "${record._eggGradeOrType}" will be linked on commit.`);
              }
            } else {
              // General Inventory
              if (!exactWarehouseMatch) {
                const inferredCat = inferItemCategory(itemName, '', 0, price, record.Notes);
                const inferredUom = inferUnitOfMeasurement(itemName, '', inferredCat.category, record.Notes);
                record._autoCreateCategory = inferredCat.category;
                record._autoCreateUom = inferredUom.uom;
                details.push(`New warehouse item "${itemName}" (${inferredCat.category}, ${inferredUom.uom}) will be auto-registered on commit.`);
              } else {
                record._inventoryId = exactWarehouseMatch.Id;
                details.push(`Matched Item: "${itemName}" (Stock ID: ${exactWarehouseMatch.Id})`);
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
        // Collect all distinct flock IDs present in the valid records
        const flockIds = Array.from(new Set(
          validRecords.map(r => Number(r.record?._flockId)).filter(id => Boolean(id) && !isNaN(id))
        ));

        // 1. Pre-fetch existing log keys from Supabase in ONE query to ensure instant deduplication
        const existingLogKeys = new Set<string>();
        if (supabaseServer && flockIds.length > 0) {
          try {
            const { data: existingLogs } = await supabaseServer
              .from('DailyLogs')
              .select('FlockId, LogDate')
              .in('FlockId', flockIds)
              .limit(100000);

            (existingLogs || []).forEach((l: any) => {
              if (l.FlockId && l.LogDate) {
                existingLogKeys.add(`${l.FlockId}_${cleanDate(l.LogDate)}`);
              }
            });
          } catch (e: any) {
            console.warn('[BulkImport pre-fetch existing logs warning]:', e.message);
          }
        }

        // 2. Pre-fetch flocks in ONE query
        let flocksData: any[] = [];
        if (supabaseServer && flockIds.length > 0) {
          try {
            const { data: flks } = await supabaseServer
              .from('Flocks')
              .select('Id, FarmId, TotalFeedCost, CurrentCount, Status, PerBirdPurchasePrice')
              .in('Id', flockIds);
            flocksData = flks || [];
          } catch (e: any) {
            console.warn('[BulkImport pre-fetch flocks warning]:', e.message);
          }
        }
        const flockMap = new Map<number, any>(flocksData.map(f => [f.Id, f]));

        // 3. Pre-fetch inventories in ONE query
        let invsData: any[] = [];
        if (supabaseServer) {
          try {
            const { data: invs } = await supabaseServer
              .from('Inventories')
              .select('Id, FarmId, ItemName, Category, CurrentStock, UnitPrice')
              .limit(50000);
            invsData = invs || [];
          } catch {}
        }
        const invMapById = new Map<number, any>(invsData.map(i => [i.Id, i]));

        // Structures for batching and aggregation
        const newLogsPayload: any[] = [];
        const flockAggregates: Record<number, { feedCost: number; birdsRemoved: number }> = {};
        const eggAggregates: Record<number, { fresh: number; damaged: number }> = {};
        const feedStockDeductions: Record<number, number> = {};

        for (const pr of validRecords) {
          const rec = normalizeRecordKeys(pr.record);
          const logDate = cleanDate(rec.LogDate);
          const flockId = Number(rec._flockId);

          if (!flockId || !logDate) continue;

          // Deduplication check: if row already exists in DB or was already seen in this file, skip cleanly
          const logKey = `${flockId}_${logDate}`;
          if (existingLogKeys.has(logKey)) {
            duplicateSkipCount++;
            continue;
          }
          existingLogKeys.add(logKey); // Prevent duplicate insertions within the same uploaded file

          const flock = flockMap.get(flockId);
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

          // Resolve feed item
          let feedItemId = rec._feedItemId ? Number(rec._feedItemId) : null;
          let feedUnitPrice = 30.00;
          if (feedItemId && invMapById.has(feedItemId)) {
            feedUnitPrice = Number(invMapById.get(feedItemId).UnitPrice) || 30.00;
          } else {
            const feedNameInput = (rec.FeedName || '').trim();
            if (feedNameInput && feedNameInput !== '0' && feedNameInput.toLowerCase() !== 'none' && feedNameInput !== '-') {
              const matched = invsData.find(i => i.FarmId === rowFarmId && (i.ItemName || '').toLowerCase().trim() === feedNameInput.toLowerCase());
              if (matched) {
                feedItemId = matched.Id;
                feedUnitPrice = Number(matched.UnitPrice) || 30.00;
              }
            }
            if (!feedItemId) {
              const defFeed = invsData.find(i => i.FarmId === rowFarmId && i.Category === 'Feed');
              if (defFeed) {
                feedItemId = defFeed.Id;
                feedUnitPrice = Number(defFeed.UnitPrice) || 30.00;
              }
            }
          }

          if (feedConsumed > 0 && feedItemId) {
            feedStockDeductions[feedItemId] = (feedStockDeductions[feedItemId] || 0) + feedConsumed;
          }

          const feedCost = feedConsumed * feedUnitPrice;
          const dailyBirdCost = (flock && flock.PerBirdPurchasePrice) ? Number(flock.PerBirdPurchasePrice) : 0;

          // Track flock aggregates in memory
          if (!flockAggregates[flockId]) {
            flockAggregates[flockId] = { feedCost: 0, birdsRemoved: 0 };
          }
          flockAggregates[flockId].feedCost += feedCost;
          flockAggregates[flockId].birdsRemoved += (mortality + birdsEatenBySelf);

          // Track egg aggregates in memory
          if (!eggAggregates[rowFarmId]) {
            eggAggregates[rowFarmId] = { fresh: 0, damaged: 0 };
          }
          eggAggregates[rowFarmId].fresh += (eggs - eggsGifted);
          eggAggregates[rowFarmId].damaged += damagedEggs;

          newLogsPayload.push({
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
        }

        // 4. High-Throughput Batch Insert in chunks of 100 rows
        if (supabaseServer && newLogsPayload.length > 0) {
          const CHUNK_SIZE = 100;
          for (let i = 0; i < newLogsPayload.length; i += CHUNK_SIZE) {
            const chunk = newLogsPayload.slice(i, i + CHUNK_SIZE);
            try {
              const { error: insErr } = await supabaseServer.from('DailyLogs').insert(chunk);
              if (insErr) {
                console.error('[BulkImport batch chunk error]:', insErr.message);
                // Fallback to inserting individual rows of this chunk
                for (const row of chunk) {
                  const { error: sErr } = await supabaseServer.from('DailyLogs').insert([row]);
                  if (!sErr) saveCount++;
                }
              } else {
                saveCount += chunk.length;
              }
            } catch (chunkEx: any) {
              console.error('[BulkImport chunk exception]:', chunkEx.message);
            }
          }
        }

        // 5. Update Flocks in Supabase (single consolidated update per flock)
        if (supabaseServer) {
          for (const [fIdStr, agg] of Object.entries(flockAggregates)) {
            const fId = Number(fIdStr);
            const flock = flockMap.get(fId);
            if (flock) {
              try {
                const updatedFeedCost = (Number(flock.TotalFeedCost) || 0) + agg.feedCost;
                const newCurrentCount = Math.max(0, (Number(flock.CurrentCount) || 0) - agg.birdsRemoved);
                const status = newCurrentCount <= 0 ? 'Inactive' : flock.Status;

                await supabaseServer.from('Flocks').update({
                  TotalFeedCost: updatedFeedCost,
                  CurrentCount: newCurrentCount,
                  Status: status
                }).eq('Id', fId);
              } catch (flkErr: any) {
                console.warn('[BulkImport flock update warning]:', flkErr.message);
              }
            }
          }
        }

        // 6. Update Egg Inventories in Supabase (single consolidated update per farm)
        if (supabaseServer) {
          for (const [fIdStr, eggAgg] of Object.entries(eggAggregates)) {
            const farmIdNum = Number(fIdStr);
            if (eggAgg.fresh !== 0) {
              try {
                const { data: eggRows } = await supabaseServer
                  .from('EggInventories')
                  .select('*')
                  .eq('FarmId', farmIdNum)
                  .eq('GradeOrType', 'Fresh Eggs');

                if (eggRows && eggRows.length > 0) {
                  await supabaseServer.from('EggInventories').update({
                    Quantity: (Number(eggRows[0].Quantity) || 0) + eggAgg.fresh
                  }).eq('Id', eggRows[0].Id);
                } else {
                  await supabaseServer.from('EggInventories').insert([{
                    FarmId: farmIdNum,
                    GradeOrType: 'Fresh Eggs',
                    Quantity: eggAgg.fresh,
                    UnitCost: 5.0
                  }]);
                }
              } catch {}
            }
            if (eggAgg.damaged > 0) {
              try {
                const { data: wasteRows } = await supabaseServer
                  .from('EggInventories')
                  .select('*')
                  .eq('FarmId', farmIdNum)
                  .eq('GradeOrType', 'Damaged/Waste Eggs');

                if (wasteRows && wasteRows.length > 0) {
                  await supabaseServer.from('EggInventories').update({
                    Quantity: (Number(wasteRows[0].Quantity) || 0) + eggAgg.damaged
                  }).eq('Id', wasteRows[0].Id);
                } else {
                  await supabaseServer.from('EggInventories').insert([{
                    FarmId: farmIdNum,
                    GradeOrType: 'Damaged/Waste Eggs',
                    Quantity: eggAgg.damaged,
                    UnitCost: 0
                  }]);
                }
              } catch {}
            }
          }
        }

        // 7. Update Feed Inventory Stock (single consolidated update per feed item)
        if (supabaseServer) {
          for (const [itemIdStr, consumed] of Object.entries(feedStockDeductions)) {
            const itemIdNum = Number(itemIdStr);
            const inv = invMapById.get(itemIdNum);
            if (inv && consumed > 0) {
              try {
                const curStock = Number(inv.CurrentStock) || 0;
                await supabaseServer.from('Inventories').update({
                  CurrentStock: curStock - consumed
                }).eq('Id', itemIdNum);
              } catch {}
            }
          }
        }

        // Reconcile and synchronize all egg inventories and flock head counts
        try {
          await cleanDuplicateEggInventories(targetFarmId);
          await reconcileEggInventoryForFarm(targetFarmId);
          await reconcileAllFlocksInventory();
        } catch {}


      } else if (type === 'purchases') {
        if (!supabaseServer) {
          throw new Error('Cloud database connection unavailable for purchases bulk import.');
        }

        const { data: existingPurch } = await supabaseServer
          .from('Purchases')
          .select('InvoiceNumber')
          .eq('FarmId', targetFarmId)
          .limit(100000);
        const existingPurchSet = new Set<string>(
          (existingPurch || []).map((p: any) => (p.InvoiceNumber || '').toLowerCase().trim()).filter(Boolean)
        );

        const { data: existingSups } = await supabaseServer
          .from('Suppliers')
          .select('Id, CompanyName')
          .eq('FarmId', targetFarmId)
          .limit(10000);
        const supplierCache = new Map<string, number>();
        (existingSups || []).forEach((s: any) => {
          if (s.CompanyName) supplierCache.set(s.CompanyName.toLowerCase().trim(), Number(s.Id));
        });

        const { data: existingFarmInvs } = await supabaseServer
          .from('Inventories')
          .select('Id, ItemName')
          .eq('FarmId', targetFarmId)
          .limit(50000);
        const invByNameCache = new Map<string, number>();
        (existingFarmInvs || []).forEach((inv: any) => {
          if (inv.ItemName) invByNameCache.set(inv.ItemName.toLowerCase().trim(), Number(inv.Id));
        });

        // Group lines sharing a non-empty InvoiceNumber into one parent Purchase + multiple PurchaseItems
        const groupedBatches: Array<{ invoiceNo: string; lines: any[] }> = [];
        const invoiceGroupMap = new Map<string, { invoiceNo: string; lines: any[] }>();
        for (const pr of validRecords) {
          const rec = normalizeRecordKeys(pr.record, 'purchases');
          const invNo = (rec.InvoiceNumber || '').trim();
          const key = invNo ? invNo.toLowerCase() : '';
          if (key && existingPurchSet.has(key)) {
            duplicateSkipCount++;
            continue;
          }
          if (key) {
            if (!invoiceGroupMap.has(key)) {
              const g = { invoiceNo: invNo, lines: [] as any[] };
              invoiceGroupMap.set(key, g);
              groupedBatches.push(g);
            }
            invoiceGroupMap.get(key)!.lines.push(rec);
          } else {
            groupedBatches.push({ invoiceNo: '', lines: [rec] });
          }
        }

        for (const batch of groupedBatches) {
          const first = batch.lines[0];
          const supplierName = (first.SupplierName || '').trim() || 'General Supplier';
          const supKey = supplierName.toLowerCase();
          let supplierId = first._supplierId ? Number(first._supplierId) : supplierCache.get(supKey);

          if (!supplierId && supplierName) {
            const { data: newSup, error: supErr } = await supabaseServer
              .from('Suppliers')
              .insert([{
                FarmId: targetFarmId,
                CompanyName: supplierName,
                ContactPerson: '',
                Email: '',
                Phone: '',
                OpeningCreditBalance: 0,
                CurrentCreditBalance: 0,
                Address: ''
              }])
              .select('Id')
              .single();
            if (!supErr && newSup) {
              supplierId = Number(newSup.Id);
              supplierCache.set(supKey, supplierId);
            }
          }

          const purchaseDate = cleanDate(first.PurchaseDate);
          if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) continue;

          let batchSubTotal = 0;
          let batchGst = 0;
          const preparedLines: any[] = [];
          for (const rec of batch.lines) {
            const qty = cleanFloat(rec.Quantity || 0);
            const price = cleanFloat(rec.UnitPrice || 0);
            const gstPerc = cleanFloat(rec.GSTPercentage || 0);
            const lineTotal = qty * price;
            const lineGst = lineTotal * (gstPerc / 100);
            batchSubTotal += lineTotal;
            batchGst += lineGst;

            const itemType = rec.ItemType === 'Flock' ? 'Flock' : 'Inventory';
            const itemName = (rec.ItemName || '').trim();
            let inventoryId: number | null = rec._inventoryId ? Number(rec._inventoryId) : null;
            if (itemType === 'Inventory' && !inventoryId && itemName) {
              inventoryId = invByNameCache.get(itemName.toLowerCase()) || null;
              if (!inventoryId) {
                const infCat = rec._autoCreateCategory || inferItemCategory(itemName, '', price, 0, rec.Notes).category;
                const infUom = rec._autoCreateUom || inferUnitOfMeasurement(itemName, '', infCat, rec.Notes).uom;
                const { data: createdInv } = await supabaseServer
                  .from('Inventories')
                  .insert([{
                    FarmId: targetFarmId,
                    ItemName: itemName,
                    Category: infCat,
                    UnitOfMeasurement: infUom,
                    UnitPrice: price,
                    SellingPrice: 0,
                    CurrentStock: 0,
                    WeightPerUnit: 1,
                    MinThreshold: 0,
                    Notes: 'Auto-created during Bulk Purchase Import'
                  }])
                  .select('Id')
                  .maybeSingle();
                if (createdInv?.Id) {
                  inventoryId = Number(createdInv.Id);
                  invByNameCache.set(itemName.toLowerCase(), inventoryId);
                }
              }
            }

            preparedLines.push({
              inventoryId,
              itemType,
              qty,
              price,
              gstPerc,
              lineGst,
              lineTotal,
              finalLanded: lineTotal + lineGst
            });
          }

          const grandTotal = batchSubTotal + batchGst;
          const explicitStatus = (first.Status || '').trim().toLowerCase();
          let receivedAmt = cleanFloat(first.ReceivedAmount || 0);
          if (receivedAmt === 0 && explicitStatus === 'paid') {
            receivedAmt = grandTotal;
          }
          const balanceAmt = Math.max(0, grandTotal - receivedAmt);
          const status: 'Paid' | 'Partial' | 'Unpaid' =
            balanceAmt <= 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          const notes = (first.Notes || '').trim();

          const { data: insertedPurch, error: pErr } = await supabaseServer
            .from('Purchases')
            .insert([{
              FarmId: targetFarmId,
              SupplierId: supplierId || null,
              PurchaseDate: purchaseDate,
              TotalAmount: grandTotal,
              TotalGSTAmount: batchGst,
              OtherTaxes: 0,
              ReceivedAmount: receivedAmt,
              BalanceAmount: balanceAmt,
              InvoiceNumber: batch.invoiceNo,
              Status: status,
              Notes: notes
            }])
            .select('Id')
            .single();

          if (pErr || !insertedPurch) {
            throw new Error(pErr?.message || 'Failed inserting Purchase record into database.');
          }

          const purchaseId = Number(insertedPurch.Id);
          for (const line of preparedLines) {
            await supabaseServer.from('PurchaseItems').insert([{
              PurchaseId: purchaseId,
              InventoryId: line.inventoryId,
              ItemType: line.itemType,
              Quantity: line.qty,
              UnitPrice: line.price,
              GSTPercentage: line.gstPerc,
              GSTAmount: line.lineGst,
              TotalPrice: line.lineTotal,
              WeightPerUnit: 1,
              AllocatedOverhead: 0,
              FinalLandedAmount: line.finalLanded
            }]);

            if (line.inventoryId) {
              const { data: origInv } = await supabaseServer
                .from('Inventories')
                .select('CurrentStock, UnitPrice')
                .eq('Id', line.inventoryId)
                .maybeSingle();
              if (origInv) {
                const oldStock = Number(origInv.CurrentStock) || 0;
                const oldPrice = Number(origInv.UnitPrice) || 0;
                const newStock = oldStock + line.qty;
                const newUnitPrice = newStock > 0 ? ((oldStock * oldPrice) + line.finalLanded) / newStock : oldPrice;
                await supabaseServer
                  .from('Inventories')
                  .update({ CurrentStock: newStock, UnitPrice: newUnitPrice })
                  .eq('Id', line.inventoryId);
              }
            }
          }

          saveCount += batch.lines.length;
        }

      } else if (type === 'sales') {
        if (!supabaseServer) {
          throw new Error('Cloud database connection unavailable for sales bulk import.');
        }

        const { data: existingSales } = await supabaseServer
          .from('Sales')
          .select('InvoiceNumber')
          .eq('FarmId', targetFarmId)
          .limit(100000);
        const existingSalesSet = new Set<string>(
          (existingSales || []).map((s: any) => (s.InvoiceNumber || '').toLowerCase().trim()).filter(Boolean)
        );

        const { data: existingCusts } = await supabaseServer
          .from('Customers')
          .select('Id, FullName, CurrentCreditBalance')
          .eq('FarmId', targetFarmId)
          .limit(10000);
        const customerCache = new Map<string, { id: number; credit: number }>();
        (existingCusts || []).forEach((c: any) => {
          if (c.FullName) {
            customerCache.set(c.FullName.toLowerCase().trim(), {
              id: Number(c.Id),
              credit: Number(c.CurrentCreditBalance) || 0
            });
          }
        });

        const { data: farmEggs } = await supabaseServer
          .from('EggInventories')
          .select('Id, GradeOrType, Quantity')
          .eq('FarmId', targetFarmId)
          .limit(100);
        const eggInventoryMap = new Map<number, { id: number; grade: string; qty: number }>();
        const eggByGrade = new Map<string, number>();
        (farmEggs || []).forEach((e: any) => {
          const eid = Number(e.Id);
          eggInventoryMap.set(eid, { id: eid, grade: e.GradeOrType || 'Fresh Eggs', qty: Number(e.Quantity) || 0 });
          if (e.GradeOrType) eggByGrade.set(e.GradeOrType.toLowerCase().trim(), eid);
        });

        // Resolve or create TransactionCategories for FinancialTransactions
        const { data: existingCats } = await supabaseServer
          .from('TransactionCategories')
          .select('Id, Name')
          .or(`FarmId.eq.${targetFarmId},FarmId.is.null`)
          .limit(200);
        const catMap = new Map<string, number>();
        (existingCats || []).forEach((c: any) => {
          if (c.Name) catMap.set(c.Name.toLowerCase().trim(), Number(c.Id));
        });

        const ensureCategoryId = async (catName: string): Promise<number | null> => {
          const existingId = catMap.get(catName.toLowerCase());
          if (existingId) return existingId;
          const { data: createdCat } = await supabaseServer
            .from('TransactionCategories')
            .insert([{ FarmId: targetFarmId, Name: catName, IsIncome: 1, Description: `${catName} income` }])
            .select('Id')
            .maybeSingle();
          if (createdCat?.Id) {
            catMap.set(catName.toLowerCase(), Number(createdCat.Id));
            return Number(createdCat.Id);
          }
          const firstAny = catMap.values().next().value;
          return firstAny || null;
        };

        const { data: existingSaleFarmInvs } = await supabaseServer
          .from('Inventories')
          .select('Id, ItemName')
          .eq('FarmId', targetFarmId)
          .limit(50000);
        const saleInvByNameCache = new Map<string, number>();
        (existingSaleFarmInvs || []).forEach((inv: any) => {
          if (inv.ItemName) saleInvByNameCache.set(inv.ItemName.toLowerCase().trim(), Number(inv.Id));
        });

        // Group lines sharing a non-empty InvoiceNumber into one parent Sales invoice + multiple SaleItems
        const groupedSales: Array<{ invoiceNo: string; lines: any[] }> = [];
        const invoiceGroupMap = new Map<string, { invoiceNo: string; lines: any[] }>();
        for (const pr of validRecords) {
          const rec = normalizeRecordKeys(pr.record, 'sales');
          const invNo = (rec.InvoiceNumber || '').trim();
          const key = invNo ? invNo.toLowerCase() : '';
          if (key && existingSalesSet.has(key)) {
            duplicateSkipCount++;
            continue;
          }
          if (key) {
            if (!invoiceGroupMap.has(key)) {
              const g = { invoiceNo: invNo, lines: [] as any[] };
              invoiceGroupMap.set(key, g);
              groupedSales.push(g);
            }
            invoiceGroupMap.get(key)!.lines.push(rec);
          } else {
            groupedSales.push({ invoiceNo: '', lines: [rec] });
          }
        }

        for (const batch of groupedSales) {
          const first = batch.lines[0];
          const customerName = (first.CustomerName || '').trim() || 'Walk-in Customer';
          const custKey = customerName.toLowerCase();
          let custEntry = customerCache.get(custKey);

          if (!custEntry && first._customerId) {
            custEntry = { id: Number(first._customerId), credit: 0 };
          }
          if (!custEntry && customerName) {
            const { data: newCust, error: custErr } = await supabaseServer
              .from('Customers')
              .insert([{
                FarmId: targetFarmId,
                FullName: customerName,
                Email: '',
                Phone: '',
                Company: '',
                OpeningCreditBalance: 0,
                CurrentCreditBalance: 0,
                Address: ''
              }])
              .select('Id')
              .single();
            if (custErr || !newCust) {
              throw new Error(custErr?.message || `Failed creating customer "${customerName}"`);
            }
            custEntry = { id: Number(newCust.Id), credit: 0 };
            customerCache.set(custKey, custEntry);
          }
          if (!custEntry) continue;

          const saleDate = cleanDate(first.SaleDate);
          if (!saleDate || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) continue;

          let subTotal = 0;
          let totalGst = 0;
          const discount = cleanFloat(first.Discount || 0);
          const otherCharges = cleanFloat(first.OtherCharges || 0);

          const preparedItems: any[] = [];
          for (const rec of batch.lines) {
            const itemName = (rec.ItemName || '').trim();
            const itemType: 'Bird' | 'Egg' | 'General Inventory' =
              rec.ItemType === 'Bird' ? 'Bird' :
              (rec.ItemType === 'Egg' || isEggItemName(itemName, rec.ItemType)) ? 'Egg' :
              'General Inventory';

            const qty = cleanFloat(rec.Quantity || 0);
            const price = cleanFloat(rec.UnitPrice || 0);
            const gstPerc = cleanFloat(rec.GSTPercentage || 0);
            const lineSub = qty * price;
            const lineGst = lineSub * (gstPerc / 100);
            subTotal += lineSub;
            totalGst += lineGst;

            let eggInventoryId: number | null = rec._eggInventoryId ? Number(rec._eggInventoryId) : null;
            if (itemType === 'Egg' && !eggInventoryId) {
              const targetGrade = /\b(damaged|waste|broken|cracked)\b/i.test(itemName)
                ? 'Damaged/Waste Eggs'
                : (rec._eggGradeOrType || 'Fresh Eggs');
              let foundId = eggByGrade.get(targetGrade.toLowerCase()) || eggByGrade.get('fresh eggs');
              if (!foundId) {
                const { data: createdEgg } = await supabaseServer
                  .from('EggInventories')
                  .insert([{
                    FarmId: targetFarmId,
                    GradeOrType: targetGrade,
                    PackSize: 'Single',
                    Quantity: 0,
                    UnitPrice: price,
                    SellingPrice: price
                  }])
                  .select('Id')
                  .maybeSingle();
                if (createdEgg?.Id) {
                  foundId = Number(createdEgg.Id);
                  eggInventoryMap.set(foundId, { id: foundId, grade: targetGrade, qty: 0 });
                  eggByGrade.set(targetGrade.toLowerCase(), foundId);
                }
              }
              eggInventoryId = foundId || null;
            }

            let inventoryId: number | null = rec._inventoryId ? Number(rec._inventoryId) : null;
            if (itemType === 'General Inventory' && !inventoryId && itemName) {
              inventoryId = saleInvByNameCache.get(itemName.toLowerCase()) || null;
              if (!inventoryId) {
                const infCat = rec._autoCreateCategory || inferItemCategory(itemName, '', 0, price, rec.Notes).category;
                const infUom = rec._autoCreateUom || inferUnitOfMeasurement(itemName, '', infCat, rec.Notes).uom;
                const { data: createdInv } = await supabaseServer
                  .from('Inventories')
                  .insert([{
                    FarmId: targetFarmId,
                    ItemName: itemName,
                    Category: infCat,
                    UnitOfMeasurement: infUom,
                    UnitPrice: 0,
                    SellingPrice: price,
                    CurrentStock: 0,
                    WeightPerUnit: 1,
                    MinThreshold: 0,
                    Notes: 'Auto-created during Bulk Sales Import'
                  }])
                  .select('Id')
                  .maybeSingle();
                if (createdInv?.Id) {
                  inventoryId = Number(createdInv.Id);
                  saleInvByNameCache.set(itemName.toLowerCase(), inventoryId);
                }
              }
            }

            preparedItems.push({
              itemType,
              flockId: rec._flockId ? Number(rec._flockId) : null,
              eggInventoryId,
              inventoryId,
              qty,
              price,
              gstPerc,
              lineGst,
              lineSub
            });
          }

          const grandTotal = Math.max(0, subTotal + totalGst + otherCharges - discount);
          const explicitStatus = (first.Status || '').trim().toLowerCase();
          // Sum line ReceivedAmount if present per line, else use header ReceivedAmount
          let receivedAmt = batch.lines.reduce((acc, l) => acc + cleanFloat(l.ReceivedAmount || 0), 0);
          if (receivedAmt === 0 && (explicitStatus === 'paid' || (!explicitStatus && first.ReceivedAmount === undefined))) {
            receivedAmt = explicitStatus === 'unpaid' ? 0 : grandTotal;
          }
          const balanceAmt = Math.max(0, grandTotal - receivedAmt);
          const status: 'Paid' | 'Partial' | 'Unpaid' =
            balanceAmt <= 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          const notes = (first.Notes || '').trim();

          // 1. Insert parent Sales record in Supabase
          const { data: insertedSale, error: sErr } = await supabaseServer
            .from('Sales')
            .insert([{
              FarmId: targetFarmId,
              CustomerId: custEntry.id,
              SaleDate: saleDate,
              SubTotal: subTotal,
              Discount: discount,
              TotalGSTAmount: totalGst,
              OtherCharges: otherCharges,
              GrandTotal: grandTotal,
              ReceivedAmount: receivedAmt,
              InvoiceNumber: batch.invoiceNo,
              Status: status,
              Notes: notes
            }])
            .select('Id')
            .single();

          if (sErr || !insertedSale) {
            throw new Error(sErr?.message || 'Failed saving Sale record to database.');
          }
          const saleId = Number(insertedSale.Id);

          // 2. Insert child SaleItems & deduct stock
          for (const item of preparedItems) {
            await supabaseServer.from('SaleItems').insert([{
              SaleId: saleId,
              ItemType: item.itemType,
              FlockId: item.flockId,
              EggInventoryId: item.eggInventoryId,
              InventoryId: item.inventoryId,
              Quantity: item.qty,
              UnitPrice: item.price,
              GSTPercentage: item.gstPerc,
              GSTAmount: item.lineGst,
              TotalPrice: item.lineSub + item.lineGst
            }]);

            if (item.itemType === 'Egg' && item.eggInventoryId) {
              const cachedEgg = eggInventoryMap.get(item.eggInventoryId);
              if (cachedEgg) {
                cachedEgg.qty = Math.max(0, cachedEgg.qty - item.qty);
                await supabaseServer
                  .from('EggInventories')
                  .update({ Quantity: Math.round(cachedEgg.qty) })
                  .eq('Id', item.eggInventoryId);
              }
            } else if (item.itemType === 'Bird' && item.flockId) {
              const { data: flk } = await supabaseServer
                .from('Flocks')
                .select('CurrentCount, Status')
                .eq('Id', item.flockId)
                .maybeSingle();
              if (flk) {
                const newBirdCount = Math.max(0, (Number(flk.CurrentCount) || 0) - item.qty);
                const flockStatus = newBirdCount === 0 ? 'Sold' : flk.Status;
                await supabaseServer
                  .from('Flocks')
                  .update({ CurrentCount: Math.round(newBirdCount), Status: flockStatus })
                  .eq('Id', item.flockId);
              }
            } else if (item.inventoryId) {
              const { data: invRow } = await supabaseServer
                .from('Inventories')
                .select('CurrentStock')
                .eq('Id', item.inventoryId)
                .maybeSingle();
              if (invRow) {
                const newStock = Math.max(0, (Number(invRow.CurrentStock) || 0) - item.qty);
                await supabaseServer
                  .from('Inventories')
                  .update({ CurrentStock: newStock })
                  .eq('Id', item.inventoryId);
              }
            }
          }

          // 3. Update customer credit balance if unpaid balance remains
          if (balanceAmt > 0.01) {
            custEntry.credit += balanceAmt;
            await supabaseServer
              .from('Customers')
              .update({ CurrentCreditBalance: custEntry.credit })
              .eq('Id', custEntry.id);
          }

          // 4. Financial Transaction ledger parity
          const catName = preparedItems.some(i => i.itemType === 'Bird') ? 'Bird Sales' : 'Egg Sales';
          const financialCatId = await ensureCategoryId(catName);
          if (financialCatId && (receivedAmt > 0 || grandTotal > 0)) {
            await supabaseServer.from('FinancialTransactions').insert([{
              FarmId: targetFarmId,
              CategoryId: financialCatId,
              Date: saleDate,
              Amount: receivedAmt || grandTotal,
              Notes: `Bulk Upload Sale - Invoice: ${batch.invoiceNo || saleId}`,
              Type: 'Income',
              CustomerId: custEntry.id,
              Reference: batch.invoiceNo || String(saleId)
            }]);
          }

          saveCount += batch.lines.length;
        }

        // Reconcile egg inventories and flock counts after sales commit
        try {
          await cleanDuplicateEggInventories(targetFarmId);
          await reconcileEggInventoryForFarm(targetFarmId);
          await reconcileAllFlocksInventory();
        } catch {}
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
  },

  // POST /api/bulk-import/ai-excel-parse
  async parseAiExcelImport(req: Request, res: Response) {
    const { fileBase64, type, fileName, autoDetectType } = req.body || {};
    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing required fileBase64 for AI Excel processing.' });
    }

    try {
      const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: true, cellText: true });

      const requestedType = (type || 'sales') as BulkImportType;
      const SCHEMA_HEADERS: Record<string, string[]> = {
        sales: ['InvoiceNumber', 'CustomerName', 'SaleDate', 'ItemName', 'ItemType', 'Quantity', 'UnitPrice', 'GSTPercentage', 'Discount', 'OtherCharges', 'ReceivedAmount', 'Status', 'Notes'],
        purchases: ['InvoiceNumber', 'SupplierName', 'PurchaseDate', 'ItemName', 'ItemType', 'Quantity', 'UnitPrice', 'GSTPercentage', 'ReceivedAmount', 'Status', 'Notes'],
        items: ['ItemName', 'Category', 'UnitOfMeasurement', 'UnitPrice', 'SellingPrice', 'CurrentStock', 'WeightPerUnit', 'MinThreshold', 'Notes'],
        'daily-logs': ['FlockName', 'LogDate', 'FeedName', 'FeedConsumedKg', 'MortalityCount', 'EggsCollected', 'DamagedEggsCollected', 'WaterConsumed', 'DailyAverageWeight', 'BirdsEatenBySelf', 'BirdsEatenValue', 'EggsGifted', 'EggsGiftedValue', 'Notes']
      };

      const sheetsContent: Array<{ name: string; rows: string[][] }> = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
        const cleanedRows = rawRows
          .map(row => {
            const arr = Array.isArray(row) ? row.map(c => (c === undefined || c === null ? '' : String(c).trim())) : [];
            while (arr.length > 0 && arr[arr.length - 1] === '') arr.pop();
            return arr;
          })
          .filter(row => row.some(cell => cell !== ''));
        if (cleanedRows.length > 0) {
          sheetsContent.push({ name: sheetName, rows: cleanedRows });
        }
      }

      if (sheetsContent.length === 0) {
        return res.status(400).json({ error: 'The uploaded workbook contains no readable rows.' });
      }

      const detection = autoDetectType === false
        ? { detectedType: requestedType, confidence: 0, reason: '' }
        : detectWorkbookLedgerType(String(fileName || ''), sheetsContent, requestedType);
      const targetType = detection.detectedType;
      const autoDetected = targetType !== requestedType;
      const targetHeaders = SCHEMA_HEADERS[targetType] || SCHEMA_HEADERS.sales;

      await keyPool.ensureSynced();
      const clientInfo = keyPool.getNextClient();

      const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-flash-latest'];
      const mappingFieldsEnum = Array.from(new Set([...targetHeaders, 'TotalAmount', 'Ignore']));

      const mappingResponseSchema = {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: 'Short explanation of worksheets and column mappings detected.' },
          mappings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sheetName: { type: Type.STRING },
                role: { type: Type.STRING, description: 'One of: primary, header, items, ignore' },
                headerRowIndex: { type: Type.INTEGER, description: '0-based index of the table header row in the sampled rows.' },
                joinKeyColumn: { type: Type.STRING, description: 'Join header name if linking header and items tabs.' },
                columnMap: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      rawHeader: { type: Type.STRING },
                      schemaField: { type: Type.STRING }
                    },
                    required: ['rawHeader', 'schemaField']
                  }
                },
                defaults: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      field: { type: Type.STRING },
                      value: { type: Type.STRING }
                    },
                    required: ['field', 'value']
                  }
                }
              },
              required: ['sheetName', 'role', 'headerRowIndex', 'columnMap']
            }
          }
        },
        required: ['summary', 'mappings']
      };

      const buildSampleMappingPrompt = () => {
        const sampledSheets = sheetsContent.map(s => {
          const headRows = s.rows.slice(0, 18);
          const extraSamples = s.rows.length > 40 ? s.rows.slice(Math.floor(s.rows.length / 2), Math.floor(s.rows.length / 2) + 3) : [];
          return `--- Sheet "${s.name}" (${s.rows.length} total rows) ---\nFirst rows:\n${JSON.stringify(headRows)}${extraSamples.length ? `\nMid-sheet sample rows:\n${JSON.stringify(extraSamples)}` : ''}`;
        }).join('\n\n');

        return `Analyze this Excel workbook${fileName ? ` ("${fileName}")` : ''} and return ONLY a compact column mapping specification for the "${targetType}" schema.
Allowed schemaField values: ${mappingFieldsEnum.join(', ')}

Workbook Samples:
${sampledSheets}

Rules:
1. Identify the 0-based "headerRowIndex" of the real table header row in each relevant sheet (skip title/banner rows).
2. Map each rawHeader to its matching schemaField (map line totals / net amounts / gross values to "TotalAmount" when separate from UnitPrice; map unneeded columns like S.No. to "Ignore").
3. For multi-tab invoices split across a header sheet and a line-items sheet, mark them role="header" and role="items" with the join column header in joinKeyColumn; otherwise use role="primary".
4. Add "defaults" ONLY if a required value (like ItemName) appears in report banner titles rather than columns.`;
      };

      const callGeminiSchemaRunner = async (promptText: string, schemaObj: any, perAttemptMs: number, totalBudgetMs = 8500) => {
        if (!clientInfo) throw new Error('Gemini API key not configured.');
        const deadline = Date.now() + totalBudgetMs;
        let lastErr: any = null;
        const maxKeyAttempts = Math.max(1, keyPool.getKeyCount());
        const triedKeys = new Set<string>();

        for (let k = 0; k < maxKeyAttempts; k++) {
          if (Date.now() >= deadline - 800) break;
          const activeClientInfo = k === 0 ? clientInfo : keyPool.getNextClient();
          if (!activeClientInfo || triedKeys.has(activeClientInfo.keyId)) continue;
          triedKeys.add(activeClientInfo.keyId);

          for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
            const remaining = deadline - Date.now();
            if (remaining <= 800) break;
            const effectiveTimeout = Math.min(perAttemptMs, remaining);
            const model = CANDIDATE_MODELS[i];
            try {
              const genPromise = activeClientInfo.client.models.generateContent({
                model,
                contents: promptText,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: schemaObj
                }
              });
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout: Model ${model} exceeded ${Math.round(effectiveTimeout / 1000)} seconds`)), effectiveTimeout)
              );
              const response: any = await Promise.race([genPromise, timeoutPromise]);
              const parsed = JSON.parse(response.text?.trim() || '{}');
              if (parsed && typeof parsed === 'object') {
                return parsed;
              }
            } catch (err: any) {
              lastErr = err;
              const status = err.status || err.code || (err.error && err.error.code);
              const msg = (err.message || '').toLowerCase();
              if (status === 429 || msg.includes('quota') || msg.includes('resource_exhausted')) {
                keyPool.markKeyCooldown(activeClientInfo.keyId, 15 * 60 * 1000);
                break;
              }
              if (status === 400 || status === 401 || status === 403 || msg.includes('api key')) {
                keyPool.markKeyCooldown(activeClientInfo.keyId, 15 * 60 * 1000);
                break;
              }
            }
          }
        }
        throw lastErr || new Error('Gemini mapping request failed.');
      };

      let allJsonRecords: Record<string, any>[] = [];
      let combinedSummary = '';
      let aiFailureNote = '';

      // Tier 1: Ultra-fast sample-only Gemini schema mapping (~1-3s regardless of row count, hard-capped at 8.5s total)
      if (clientInfo) {
        try {
          const mappingRes = await callGeminiSchemaRunner(buildSampleMappingPrompt(), mappingResponseSchema, 5500, 8500);
          if (mappingRes && Array.isArray(mappingRes.mappings) && mappingRes.mappings.length > 0) {
            const mappedRows = applySheetMappingsToRecords(sheetsContent, mappingRes.mappings, targetType, targetHeaders);
            if (mappedRows.length > 0) {
              allJsonRecords = mappedRows;
              combinedSummary = mappingRes.summary || `AI mapped ${mappingRes.mappings.length} worksheet(s) and extracted ${mappedRows.length} rows.`;
            }
          }
        } catch (aiErr: any) {
          aiFailureNote = aiErr?.message || 'AI schema mapping timed out';
        }
      }

      // Tier 2: Zero-failure deterministic schema mapping fallback (covers key absent / 429 / timeout / weird column aliases)
      if (allJsonRecords.length === 0) {
        const detSpecs = detectDeterministicSheetMapping(sheetsContent, targetType);
        if (detSpecs.length > 0) {
          const detRows = applySheetMappingsToRecords(sheetsContent, detSpecs, targetType, targetHeaders);
          if (detRows.length > 0) {
            allJsonRecords = detRows;
            combinedSummary = `Fast schema engine mapped ${detSpecs.length} worksheet(s) into ${detRows.length} ${targetType} records.`;
          }
        }
      }

      // Tier 3: Compact direct-record Gemini extraction ONLY for small non-tabular sheets (<= 60 rows) when Tier 1 + 2 found nothing
      const totalRowCount = sheetsContent.reduce((sum, s) => sum + s.rows.length, 0);
      if (allJsonRecords.length === 0 && clientInfo && totalRowCount <= 60) {
        const recordProperties: Record<string, any> = {};
        for (const h of targetHeaders) recordProperties[h] = { type: Type.STRING };
        const directSchema = {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            records: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: recordProperties } }
          },
          required: ['summary', 'records']
        };
        const formattedSheets = sheetsContent
          .map(s => `--- Sheet "${s.name}" (${s.rows.length} rows) ---\n${JSON.stringify(s.rows)}`)
          .join('\n\n');
        const directPrompt = `Extract structured "${targetType}" records (${targetHeaders.join(', ')}) from this spreadsheet:\n${formattedSheets}\nConvert dates to YYYY-MM-DD (DD-MM-YYYY assumed if ambiguous). Skip totals/headers.`;
        const directRes = await callGeminiSchemaRunner(directPrompt, directSchema, 12000);
        if (directRes && Array.isArray(directRes.records)) {
          allJsonRecords = directRes.records;
          combinedSummary = directRes.summary || `Extracted ${allJsonRecords.length} records directly.`;
        }
      }

      if (allJsonRecords.length === 0) {
        throw new Error(aiFailureNote
          ? `Could not map tabular columns automatically (${aiFailureNote}).`
          : 'No importable data rows were found in the uploaded spreadsheet.');
      }

      // Deterministic server-side post-normalization & missing-value discovery on every transformed JSON record
      let carrySaleDate = '';
      let carryPurchaseDate = '';
      let carryLogDate = '';

      const cleanedJsonRecords = allJsonRecords.map((rawRec) => {
        const rec: Record<string, any> = {};
        for (const h of targetHeaders) {
          rec[h] = rawRec?.[h] !== undefined && rawRec?.[h] !== null ? String(rawRec[h]).trim() : '';
        }
        const rawTotalAmt = cleanFloat(rawRec?.TotalAmount || 0);

        if (targetType === 'sales') {
          rec.SaleDate = cleanDate(rec.SaleDate) || carrySaleDate;
          if (rec.SaleDate) carrySaleDate = rec.SaleDate;
          if (!rec.CustomerName) rec.CustomerName = 'Walk-in Customer';

          let qty = cleanFloat(rec.Quantity || 0);
          let unitP = cleanFloat(rec.UnitPrice || 0);
          if (!rec.ItemName && (qty > 0 || rawTotalAmt > 0 || unitP > 0)) {
            rec.ItemName = 'Fresh Eggs';
          }

          if (isEggItemName(rec.ItemName, rec.ItemType)) {
            rec.ItemType = 'Egg';
          } else if (!rec.ItemType) {
            const isSupply = /\b(feed|mash|crumble|pellet|starter|grower|finisher|concentrate|premix|ration|medicine|vaccine|feeder|drinker|tray)\b/i.test(rec.ItemName || '');
            rec.ItemType = !isSupply && /\b(bird|birds|hen|hens|broiler|layer|cull|culls|flock)\b/i.test(rec.ItemName || '')
              ? 'Bird'
              : 'General Inventory';
          }

          if (qty <= 0 && rawTotalAmt > 0 && unitP > 0) {
            qty = Number((rawTotalAmt / unitP).toFixed(4));
          } else if (qty <= 0 && (unitP > 0 || rawTotalAmt > 0) && rec.ItemName) {
            qty = 1;
          }
          if (unitP === 0 && rawTotalAmt > 0 && qty > 0) {
            unitP = Number((rawTotalAmt / qty).toFixed(4));
          }

          const gstPerc = cleanFloat(rec.GSTPercentage || 0);
          const discount = cleanFloat(rec.Discount || 0);
          const otherCharges = cleanFloat(rec.OtherCharges || 0);
          let receivedAmt = cleanFloat(rec.ReceivedAmount || 0);
          const estGrand = Math.max(0, (qty * unitP) * (1 + gstPerc / 100) + otherCharges - discount);
          const explicitStatus = (rec.Status || '').toLowerCase();

          if (receivedAmt === 0 && estGrand > 0 && explicitStatus !== 'unpaid' && explicitStatus !== 'credit' && explicitStatus !== 'due') {
            if (explicitStatus === 'paid' || explicitStatus === 'cash' || (!explicitStatus && rec.ReceivedAmount === '')) {
              receivedAmt = Number(estGrand.toFixed(2));
            }
          }
          if (!rec.Status) {
            rec.Status = receivedAmt >= estGrand - 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          }

          rec.Quantity = String(qty);
          rec.UnitPrice = String(unitP);
          rec.GSTPercentage = String(gstPerc);
          rec.Discount = String(discount);
          rec.OtherCharges = String(otherCharges);
          rec.ReceivedAmount = String(receivedAmt);
        } else if (targetType === 'purchases') {
          rec.PurchaseDate = cleanDate(rec.PurchaseDate) || carryPurchaseDate;
          if (rec.PurchaseDate) carryPurchaseDate = rec.PurchaseDate;
          if (!rec.SupplierName) rec.SupplierName = 'General Supplier';
          if (!rec.ItemType) {
            const isSupply = /\b(feed|mash|crumble|pellet|starter|grower|finisher|concentrate|premix|ration|medicine|vaccine|feeder|drinker|tray)\b/i.test(rec.ItemName || '');
            rec.ItemType = !isSupply && /\b(flock|chick|bird|hen|pullet|broiler|layer)\b/i.test(rec.ItemName || '') ? 'Flock' : 'Inventory';
          }

          let qty = cleanFloat(rec.Quantity || 0);
          let unitP = cleanFloat(rec.UnitPrice || 0);
          if (qty <= 0 && rawTotalAmt > 0 && unitP > 0) {
            qty = Number((rawTotalAmt / unitP).toFixed(4));
          } else if (qty <= 0 && (unitP > 0 || rawTotalAmt > 0) && rec.ItemName) {
            qty = 1;
          }
          if (unitP === 0 && rawTotalAmt > 0 && qty > 0) {
            unitP = Number((rawTotalAmt / qty).toFixed(4));
          }

          const gstPerc = cleanFloat(rec.GSTPercentage || 0);
          let receivedAmt = cleanFloat(rec.ReceivedAmount || 0);
          const estTotal = (qty * unitP) * (1 + gstPerc / 100);
          const explicitStatus = (rec.Status || '').toLowerCase();
          if (receivedAmt === 0 && estTotal > 0 && explicitStatus !== 'unpaid' && explicitStatus !== 'credit') {
            if (explicitStatus === 'paid' || (!explicitStatus && rec.ReceivedAmount === '')) {
              receivedAmt = Number(estTotal.toFixed(2));
            }
          }
          if (!rec.Status) {
            rec.Status = receivedAmt >= estTotal - 0.01 ? 'Paid' : (receivedAmt > 0 ? 'Partial' : 'Unpaid');
          }

          rec.Quantity = String(qty);
          rec.UnitPrice = String(unitP);
          rec.GSTPercentage = String(gstPerc);
          rec.ReceivedAmount = String(receivedAmt);
        } else if (targetType === 'daily-logs') {
          rec.LogDate = cleanDate(rec.LogDate) || carryLogDate;
          if (rec.LogDate) carryLogDate = rec.LogDate;
          rec.EggsCollected = String(cleanInt(rec.EggsCollected || 0));
          rec.MortalityCount = String(cleanInt(rec.MortalityCount || 0));
          rec.DamagedEggsCollected = String(cleanInt(rec.DamagedEggsCollected || 0));
          rec.FeedConsumedKg = String(cleanFloat(rec.FeedConsumedKg || 0));
          rec.WaterConsumed = String(cleanFloat(rec.WaterConsumed || 0));
          rec.DailyAverageWeight = String(cleanFloat(rec.DailyAverageWeight || 0));
          rec.BirdsEatenBySelf = String(cleanInt(rec.BirdsEatenBySelf || 0));
          rec.BirdsEatenValue = String(cleanFloat(rec.BirdsEatenValue || 0));
          rec.EggsGifted = String(cleanInt(rec.EggsGifted || 0));
          rec.EggsGiftedValue = String(cleanFloat(rec.EggsGiftedValue || 0));
        } else if (targetType === 'items') {
          const unitP = cleanFloat(rec.UnitPrice || 0);
          const sellP = cleanFloat(rec.SellingPrice || 0);
          const catInf = inferItemCategory(rec.ItemName, rec.Category, unitP, sellP, rec.Notes);
          rec.Category = catInf.category;
          const uomInf = inferUnitOfMeasurement(rec.ItemName, rec.UnitOfMeasurement, rec.Category, rec.Notes);
          rec.UnitOfMeasurement = uomInf.uom;
          rec.UnitPrice = String(unitP);
          rec.SellingPrice = String(sellP);
          rec.CurrentStock = String(cleanFloat(rec.CurrentStock || 0));
          rec.WeightPerUnit = String(cleanFloat(rec.WeightPerUnit || 1) || 1);
          rec.MinThreshold = String(cleanFloat(rec.MinThreshold || 0));
        }

        return rec;
      });

      const csvContent = recordsToCsv(targetHeaders, cleanedJsonRecords);
      const summaryPrefix = autoDetected
        ? `Auto-detected ledger type: ${targetType.toUpperCase()}. `
        : '';

      return res.json({
        success: true,
        type: targetType,
        autoDetected,
        jsonRecords: cleanedJsonRecords,
        csvContent,
        headers: targetHeaders,
        summary: `${summaryPrefix}${combinedSummary || `Transformed ${cleanedJsonRecords.length} rows across ${workbook.SheetNames.length} tab(s).`}`,
        sheetsProcessed: workbook.SheetNames
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to process Excel file.' });
    }
  }
};
