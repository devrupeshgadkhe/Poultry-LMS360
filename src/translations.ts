export type Language = 'en';

export interface TranslationSet {
  // Nav Tabs & General Labels (Simple Professional English)
  dashboard: string;
  layerFlocks: string;
  dailyLogs: string;
  vaccinations: string;
  millingMix: string;
  procurement: string;
  salesDesk: string;
  warehouseStock: string;
  stakeholders: string;
  staffHR: string;
  financeLedgers: string;
  sqlCli: string;
  backups: string;
  reportsLedgers: string;
  settingsAudit: string;
  bulkImport: string;

  // Header and common
  operatorHub: string;
  activeOperator: string;
  lockConsole: string;
  offlineCoop: string;
  syncData: string;
  registerFlock: string;
  confirm: string;
  cancel: string;

  // Dashboard Metrics & Titles
  dashboardTitle: string;
  dashboardSub: string;
  activeLayers: string;
  liveHensInfo: string;
  avgLayingRate: string;
  hdpTargetInfo: string;
  eggsInStock: string;
  damagedEggsInfo: string;
  receivablesPayables: string;
  rxLabel: string;
  txLabel: string;
  lowStockAlert: string;
  lowStockDesc: string;
  eggProductionvsFeed: string;
  earningsExpenseChart: string;
  perEggCostDashboard: string;
  eggProductionCostDesc: string;

  // Flocks Screen
  activeLayerFlocksTitle: string;
  flocksSub: string;
  flockName: string;
  breed: string;
  initialCount: string;
  currentCount: string;
  arrivalDate: string;
  layCycleStart: string;
  totalPurchaseVal: string;
  notes: string;
  launched: string;
  ageDays: string;
  headBalance: string;
  mortalityRate: string;
  perBirdPrice: string;
  cumulativeValue: string;
  accruedFeedCost: string;
  vaccineCost: string;
  perEggProductionCost: string;
  newFlockHeading: string;
  saveFlockBtn: string;

  // Daily Logs
  dailyLogsTitle: string;
  dailyLogsSub: string;
  addDailyLog: string;

  // Vaccinations
  vaccineTitle: string;
  vaccineSub: string;
  logVaccineBtn: string;

  // Milling Room
  millingTitle: string;
  millingSub: string;
  mixBatchBtn: string;

  // Procurement
  procurementTitle: string;
  procurementSub: string;
  newPurchaseBtn: string;

  // Sales Desk
  salesTitle: string;
  salesSub: string;
  newSaleBtn: string;

  // Warehouse Stock
  stockTitle: string;
  stockSub: string;
  newItemBtn: string;

  // Stakeholders
  stakeholderTitle: string;
  stakeholderSub: string;
  addStakeholderBtn: string;

  // Staff HR
  staffTitle: string;
  staffSub: string;
  addStaffBtn: string;

  // Finance Ledgers
  financeTitle: string;
  financeSub: string;
  addTransactionBtn: string;

  // SQL CLI Console
  sqlTitle: string;
  sqlSub: string;
  runQueryBtn: string;

  // Backups
  backupTitle: string;
  backupSub: string;
  createBackupBtn: string;
}

export const languages: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' }
];

export const translations: Record<Language, TranslationSet> = {
  en: {
    dashboard: 'Dashboard',
    layerFlocks: 'Bird Groups / Flocks',
    dailyLogs: 'Daily Records',
    vaccinations: 'Medicines & Vaccines',
    millingMix: 'Feed Milling & Mix',
    procurement: 'Suppliers & Purchases',
    salesDesk: 'Egg & Bird Sales',
    warehouseStock: 'Warehouse Stock',
    stakeholders: 'Customers & Suppliers',
    staffHR: 'Staff & Payroll',
    financeLedgers: 'Accounts & Expenses',
    sqlCli: 'SQL Console',
    backups: 'Backup and Restore',
    reportsLedgers: 'Reports & Ledgers',
    settingsAudit: 'Farm Settings & Operator Access',
    bulkImport: 'Bulk Data Import',

    operatorHub: 'Poultry Farm Hub',
    activeOperator: 'Active User',
    lockConsole: 'Log Out',
    offlineCoop: 'Offline Local Database',
    syncData: 'Refresh Data',
    registerFlock: 'Add New Flock',
    confirm: 'Confirm',
    cancel: 'Cancel',

    dashboardTitle: 'Poultry Management Dashboard',
    dashboardSub: 'Check bird layouts, egg production counts, and daily accounts cash ledger overview here.',
    activeLayers: 'Total Layer Birds',
    liveHensInfo: 'Hens currently in active status',
    avgLayingRate: 'Egg Laying Rate (HDP)',
    hdpTargetInfo: 'Average percentage target is above 80%',
    eggsInStock: 'Eggs in Warehouse',
    damagedEggsInfo: 'damaged/broken egg count',
    receivablesPayables: 'Outstanding Balances',
    rxLabel: 'To Receive (Debtors)',
    txLabel: 'To Pay (Suppliers)',
    lowStockAlert: 'Low Stock Alarm!',
    lowStockDesc: 'The following inventory items are running low. Please restock soon:',
    eggProductionvsFeed: 'Egg Production vs Feed Consumption Trends',
    earningsExpenseChart: 'Income vs Expense Cashflow Chart',
    perEggCostDashboard: 'Avg. Egg Production Cost',
    eggProductionCostDesc: 'Average cost to produce one egg (Birds + Feed + Medicine / Laid Eggs)',

    activeLayerFlocksTitle: 'Birds & Flocks Inventory',
    flocksSub: 'Register, track counts, check health status, and finalize bird batches.',
    flockName: 'Flock Identifier / Name',
    breed: 'Breed Breed Type',
    initialCount: 'Starting Bird Count',
    currentCount: 'Current Bird Count',
    arrivalDate: 'Arrival Date',
    layCycleStart: 'Egg Laying Start Date',
    totalPurchaseVal: 'Total Bird Group Purchase Value',
    notes: 'Important Notes',
    launched: 'Started On',
    ageDays: 'Age',
    headBalance: 'Birds Balance Count',
    mortalityRate: 'Loss rate (Mortality)',
    perBirdPrice: 'Single Bird Buying Price',
    cumulativeValue: 'Total Bird Group Cost',
    accruedFeedCost: 'Total Feed Expense Used',
    vaccineCost: 'Medicine & Vaccination Cost',
    perEggProductionCost: 'Egg Production Cost',
    newFlockHeading: 'Register New Bird Group',
    saveFlockBtn: 'Confirm & Save Flock',

    // Daily Logs
    dailyLogsTitle: 'Daily Farm Records',
    dailyLogsSub: 'Register egg production, feed eaten, and any bird mortality.',
    addDailyLog: 'Add Daily Record',

    // Vaccinations
    vaccineTitle: 'Medicines & Vaccines Record',
    vaccineSub: 'Keep track of flock vaccine doses and medication expenses.',
    logVaccineBtn: 'Log New Injection/Medicine',

    // Milling Room
    millingTitle: 'Feed Milling & Mix Room',
    millingSub: 'Formulate custom feed proportions, mix batches, and use raw materials.',
    mixBatchBtn: 'Mix Feed Batch',

    // Procurement
    procurementTitle: 'Suppliers Procurement & Purchases',
    procurementSub: 'Log incoming feed, medicine shipments, and bills.',
    newPurchaseBtn: 'Record Raw Purchase / Bills',

    // Sales Desk
    salesTitle: 'Egg & Bird Sales Desk',
    salesSub: 'Sell fresh eggs and cull layers, manage invoices and customer dues.',
    newSaleBtn: 'Log Sales Invoice',

    // Warehouse Stock
    stockTitle: 'Warehouse Feed & Material Stocks',
    stockSub: 'Current stock of feedbags, medicine vials, and raw materials.',
    newItemBtn: 'Add Stock Item',

    // Stakeholders
    stakeholderTitle: 'Customers & Suppliers Registry',
    stakeholderSub: 'Manage distributor coordinates, supplier details, and ledger credits.',
    addStakeholderBtn: 'Add Customer/Supplier',

    // Staff HR
    staffTitle: 'Staff Register & Payroll',
    staffSub: 'Track farm workers, daily duties, presence, and wage bills.',
    addStaffBtn: 'Register New Worker',

    // Finance Ledgers
    financeTitle: 'Accounts Income & Expenses Ledger',
    financeSub: 'Comprehensive record of all incoming cash, expense vouchers, and bills.',
    addTransactionBtn: 'Add Cash Transaction',

    // SQL CLI Console
    sqlTitle: 'SQL CLI Query Console',
    sqlSub: 'Direct developer access to query the underlying database tables.',
    runQueryBtn: 'Execute SQL Query',

    // Backups
    backupTitle: 'Database Backups Manager',
    backupSub: 'Generate full database snapshots and restore seed points.',
    createBackupBtn: 'Create New Backup'
  }
};

export function getTabTranslation(name: string, t: TranslationSet): string {
  switch (name) {
    case 'Dashboard': return t.dashboard;
    case 'Layer Flocks': return t.layerFlocks;
    case 'Daily Logs': return t.dailyLogs;
    case 'Vaccinations': return t.vaccinations;
    case 'Milling & Mix': return t.millingMix;
    case 'Procurement': return t.procurement;
    case 'Sales Desk': return t.salesDesk;
    case 'Warehouse Stock': return t.warehouseStock;
    case 'Stakeholders': return t.stakeholders;
    case 'Finance Ledgers': return t.financeLedgers;
    case 'SQL CLI Console': return t.sqlCli;
    case 'Super Admin Console': return 'Super Admin Console';
    case 'Legacy Migrator': return 'Legacy Migrator';
    case 'User Access': return 'User Access';
    case 'Backups': return t.backups;
    case 'Reports & Ledgers': return t.reportsLedgers;
    case 'Farm Settings & Access': return t.settingsAudit;
    case 'Bulk Data Import': return t.bulkImport;
    default: return name;
  }
}
