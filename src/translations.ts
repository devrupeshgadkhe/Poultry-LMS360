export type Language = 'en' | 'hi' | 'mr' | 'gu' | 'te' | 'bn';

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
  { code: 'en', name: 'English (Simple)' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'bn', name: 'বাংলা (Bengali)' }
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
  },
  hi: {
    dashboard: 'डैशबोर्ड (मुख्य पृष्ठ)',
    layerFlocks: 'मुर्गियों के झुंड (Flocks)',
    dailyLogs: 'रोजाना के रिकॉर्ड',
    vaccinations: 'टीकाकरण और दवाएं',
    millingMix: 'चारा पिसाई और मिक्स',
    procurement: 'सप्लायर और खरीद',
    salesDesk: 'अंडे और मुर्गी बिक्री',
    warehouseStock: 'गोदाम स्टॉक (इन्वेंट्री)',
    stakeholders: 'ग्राहक और व्यापारी',
    staffHR: 'कर्मचारी और वेतन',
    financeLedgers: 'बहीखाता और खर्च',
    sqlCli: 'एसक्यूएल कंसोल',
    backups: 'बैकअप और रिस्टोर',
    reportsLedgers: 'रिपोर्ट्स और लेजर',
    settingsAudit: 'फार्म सेटिंग्स और ऑपरेटर पहुंच',
    bulkImport: 'थोक डेटा आयात',

    operatorHub: 'पोल्ट्री फार्म हब',
    activeOperator: 'सक्रिय ऑपरेटर',
    lockConsole: 'लॉग आउट',
    offlineCoop: 'ऑफ़लाइन लोकल सुरक्षित डेटाबेस',
    syncData: 'डेटा रिफ्रेश करें',
    registerFlock: 'नया झुंड दर्ज करें',
    confirm: 'पुष्टि करें',
    cancel: 'रद्द करें',

    dashboardTitle: 'पोल्ट्री फार्म प्रबंधन डैशबोर्ड',
    dashboardSub: 'मुर्गियों की स्थिति, अंडे के उत्पादन की दर, और दैनिक बहीखाते का विवरण देखें।',
    activeLayers: 'कुल सक्रिय मुर्गियां',
    liveHensInfo: 'फार्म में वर्तमान जीवित मुर्गियां',
    avgLayingRate: 'अंडा देने की औसत दर (HDP %)',
    hdpTargetInfo: 'सामान्य लक्ष्य 80% से ऊपर होना चाहिए',
    eggsInStock: 'स्टॉक में सुरक्षित अंडे',
    damagedEggsInfo: 'टूटे हुए अंडे एकत्र हुए',
    receivablesPayables: 'बाकी लेन-देन',
    rxLabel: 'ग्राहकों से लेना (Receivables)',
    txLabel: 'सप्लायर को देना (Payables)',
    lowStockAlert: 'स्टॉक कम होने की चेतावनी!',
    lowStockDesc: 'निम्नलिखित सामग्री गोदाम में कम है। कृपया जल्द आर्डर करें:',
    eggProductionvsFeed: 'अंडा उत्पादन बनाम चारा खपत रुझान',
    earningsExpenseChart: 'आय बनाम खर्च चार्ट विवरण',
    perEggCostDashboard: 'प्रति अंडा उत्पादन लागत',
    eggProductionCostDesc: 'एक अंडे के उत्पादन की औसत लागत (मुर्गी + चारा + दवा / अंडा उत्पादन)',

    activeLayerFlocksTitle: 'सक्रिय लेयर मुर्गियों के झुंड',
    flocksSub: 'मुर्गियों के नए समूहों को जोड़ें, उनके स्वास्थ्य और मृत्यु दर पर नजर रखें।',
    flockName: 'झुंड का नाम / पहचान संख्या',
    breed: 'नस्ल का प्रकार',
    initialCount: 'शुरुआती मुर्गियों की संख्या',
    currentCount: 'वर्तमान मुर्गियों की संख्या',
    arrivalDate: 'आगमन (फार्म में आने की) तिथि',
    layCycleStart: 'अंडे उत्पादन शुरू होने की तिथि',
    totalPurchaseVal: 'मुर्गियां खरीदने की कुल लागत',
    notes: 'विशेष टिप्पणी / नोट',
    launched: 'आगमन तिथि',
    ageDays: 'उम्र (दिन)',
    headBalance: 'सुरक्षित मुर्गियों की संख्या',
    mortalityRate: 'मुर्गियों के नुकसान की दर (Mortality %)',
    perBirdPrice: 'प्रति मुर्गी खरीद कीमत',
    cumulativeValue: 'मुर्गियों की कुल खरीद कीमत बकाया',
    accruedFeedCost: 'कुल चारा खपत का खर्च',
    vaccineCost: 'दवा व टीकाकरण का कुल खर्च',
    perEggProductionCost: 'प्रति अंडा उत्पादन लागत',
    newFlockHeading: 'नया मुर्गी समूह दर्ज करें',
    saveFlockBtn: 'मुर्गी झुंड की पुष्टि व सेव करें',

    // Daily Logs
    dailyLogsTitle: 'दैनिक फार्म रिकॉर्ड सूची',
    dailyLogsSub: 'अंडा उत्पादन संख्या, चारा खपत और मृत पशुओं का लेखा-जोखा रखें।',
    addDailyLog: 'रोज का रिकॉर्ड जोड़ें',

    // Vaccinations
    vaccineTitle: 'टीकाकरण और दवाएं रजिस्टर',
    vaccineSub: 'मुर्गियों के टीके, दवाइयों और उनके संबंधित खर्च की सूची।',
    logVaccineBtn: 'नया टीका/दवा दर्ज करें',

    // Milling Room
    millingTitle: 'चारा पिसाई और मिक्स विभाग',
    millingSub: 'मुर्गियों के लिए पोषण चारा मिश्रण और नए बैच की तैयारी करें।',
    mixBatchBtn: 'नया फीड मिक्स बनाएं',

    // Procurement
    procurementTitle: 'सामग्री खरीद और बिल रसीदें',
    procurementSub: 'बाहर से आने वाले चारे, दवाई और सप्लायर के बिलों का ब्यौरा दर्ज करें।',
    newPurchaseBtn: 'नयी खरीदारी दर्ज करें',

    // Sales Desk
    salesTitle: 'अंडा और मुर्गी बिक्री काउंटर',
    salesSub: 'अंडे एवं अनुपयोगी मुर्गियों की बिक्री और ग्राहकों से बकाया लेन-देन संभालें।',
    newSaleBtn: 'नया बिक्री बिल बनाएं',

    // Warehouse Stock
    stockTitle: 'गोदाम स्टॉक और इन्वेंट्री',
    stockSub: 'चारे, दवाइयों और कच्चे माल के स्टॉक की लाइव स्थिति देखें।',
    newItemBtn: 'नई सामग्री जोड़ें',

    // Stakeholders
    stakeholderTitle: 'ग्राहक और व्यापारी रजिस्टर',
    stakeholderSub: 'सभी खरीदारों और चारे के सप्लायरों के पते और उनके खाते का ब्यौरा।',
    addStakeholderBtn: 'नया व्यापारी/ग्राहक जोड़ें',

    // Staff HR
    staffTitle: 'कर्मचारी और हाजिरी रजिस्टर',
    staffSub: 'फार्म पर काम करने वाले मजदूर, उनके काम और वेतन का विवरण रखें।',
    addStaffBtn: 'नया कर्मचारी जोड़ें',

    // Finance Ledgers
    financeTitle: 'बहीखाता और जमा-खर्च विवरण',
    financeSub: 'फार्म में होने वाले सभी भुगतानों और आमदनी का ब्यौरा।',
    addTransactionBtn: 'नया लेन-देन जोड़ें',

    // SQL CLI Console
    sqlTitle: 'एसक्यूएल क्वेरी कंसोल',
    sqlSub: 'फाइलों और डेटाबेस में बदलाव करने के लिए प्रश्न चलाएं।',
    runQueryBtn: 'एसक्यूएल चलाएं',

    // Backups
    backupTitle: 'डेटा बैकअप मैनेजर',
    backupSub: 'डेटाबेस को सुरक्षित रखने के लिए पुरानी सुरक्षित प्रतियां बनाएं या लोड करें।',
    createBackupBtn: 'नया सुरक्षित बैकअप लें'
  },
  mr: {
    dashboard: 'डॅशबोर्ड',
    layerFlocks: 'कोंबड्यांचे गट (Flocks)',
    dailyLogs: 'रोजची नोंदवही',
    vaccinations: 'लसीकरण आणि औषधे',
    millingMix: 'चारा दळणे आणि मिक्स',
    procurement: 'खरेदी आणि सप्लायर',
    salesDesk: 'अंडी आणि कोंबडी विक्री',
    warehouseStock: 'गोदाम स्टॉक (इन्वेंट्री)',
    stakeholders: 'ग्राहक आणि व्यापारी',
    staffHR: 'कर्मचारी आणि पगार',
    financeLedgers: 'जमा-खर्च बहीखाते',
    sqlCli: 'एसक्यूएल कन्सोल',
    backups: 'बॅकअप आणि रिस्टोर',
    reportsLedgers: 'रिपोर्ट आणि लेजर',
    settingsAudit: 'फार्म सेटिंग्ज आणि ऑपरेटर प्रवेश',
    bulkImport: 'बल्क डेटा आयात',

    operatorHub: 'पोल्ट्री फार्म व्यवस्थापन हब',
    activeOperator: 'सक्रिय ऑपरेटर',
    lockConsole: 'लॉग आउट',
    offlineCoop: 'ऑफलाईन सुरक्षित डेटाबेस',
    syncData: 'माहिती रिफ्रेश करा',
    registerFlock: 'नवीन गट नोंदवा',
    confirm: 'निश्चित करा',
    cancel: 'रद्द करा',

    dashboardTitle: 'पोल्ट्री फार्म मुख्य व्यवस्थापन डॅशबोर्ड',
    dashboardSub: 'कोंबड्यांची संख्या, दररोजची अंडी गोळा करण्याचे प्रमाण आणि गल्ल्याचा हिशोब येथे पहा.',
    activeLayers: 'एकूण सक्रिय कोंबड्या',
    liveHensInfo: 'फार्ममधील सध्याच्या कोंबड्या',
    avgLayingRate: 'सरासरी अंडी देण्याचा दर (HDP %)',
    hdpTargetInfo: 'सरासरी उत्पादन उद्दिष्ट ८०% पेक्षा जास्त',
    eggsInStock: 'स्टॉकमध्ये एकूण अंडी',
    damagedEggsInfo: 'खराब/फुटलेली अंडी नोंदवली',
    receivablesPayables: 'बाकी हिशोब',
    rxLabel: 'ग्राहकांकडून येणे बाकी',
    txLabel: 'व्यापाऱ्यांना देणे बाकी',
    lowStockAlert: 'गोदाम स्टॉक कमी आला आहे!',
    lowStockDesc: 'खालील वस्तूंचा साठा खूप कमी आहे, कृपया नवीन खरेदी करा:',
    eggProductionvsFeed: 'अंडी उत्पादन विरुद्ध चारा वापर आलेख',
    earningsExpenseChart: 'एकूण उत्पन्न विरुद्ध खर्च चार्ट',
    perEggCostDashboard: 'एक अंड्याची उत्पादन किंमत',
    eggProductionCostDesc: 'एक अंडे तयार होण्यासाठी लागलेला सरासरी खर्च (कोंबडी + चारा + औषध / एकूण अंडी)',

    activeLayerFlocksTitle: 'सक्रिय कोंबड्यांचे गट व माहिती',
    flocksSub: 'नवीन कोंबड्यांच्या बॅचेस जोडा, वजन आणि मरतुकीचे प्रमाण पहा.',
    flockName: 'कोंबड्यांच्या गटाचे नाव / आयडी',
    breed: 'जात / पैदास प्रकार',
    initialCount: 'सुरुवातीची कोंबड्यांची संख्या',
    currentCount: 'सध्याची कोंबड्यांची संख्या',
    arrivalDate: 'फार्ममध्ये आल्याची तारीख',
    layCycleStart: 'अंडी देण्यास सुरुवात तारीख',
    totalPurchaseVal: 'कोंबडी खरेदीचा एकूण खर्च',
    notes: 'विशेष नोट्स',
    launched: 'आगमन तारीख',
    ageDays: 'वय (दिवस)',
    headBalance: 'शिल्लक कोंबड्या संख्या',
    mortalityRate: 'एकूण मरतुक प्रमाण (Mortality %)',
    perBirdPrice: 'प्रति कोंबडी खरेदी दर',
    cumulativeValue: 'कोंबड्या खरेदीची एकूण किंमत',
    accruedFeedCost: 'एकूण चारा खाद्याचा खर्च',
    vaccineCost: 'एकूण औषध आणि लस खर्च',
    perEggProductionCost: 'प्रति अंडे उत्पादन खर्च',
    newFlockHeading: 'नवीन कोंबड्यांचा गट जोडा',
    saveFlockBtn: 'नवीन कोंबड्यांची नोंद जतन करा',

    // Daily Logs
    dailyLogsTitle: 'दैनिक फार्म नोंदी बही',
    dailyLogsSub: 'अंडी गोळा करणे, कोंबड्यांचे खाद्य आणि मर्तुक नोंदी रोज भरा.',
    addDailyLog: 'रोजची नोंद जोडा',

    // Vaccinations
    vaccineTitle: 'औषधोपचार आणि लसीकरण नोंदी',
    vaccineSub: 'कोंबड्यांना दिलेल्या लसी, औषधे आणि त्यावर झालेल्या खर्चाची माहिती.',
    logVaccineBtn: 'नवीन लस/औषध नोंदवा',

    // Milling Room
    millingTitle: 'खाद्य दळणवळण व मिश्रण विभाग',
    millingSub: 'कोंबड्यांसाठी घरगुती पौष्टिक चारा मिश्रण तयार करा आणि साठा तपासा.',
    mixBatchBtn: 'नवीन खाद्य मिश्रण बनवा',

    // Procurement
    procurementTitle: 'सामग्री खरेदी आणि बिल नोंदवही',
    procurementSub: 'बाहेरून येणारे खाद्य, औषधे आणि व्यापाऱ्यांकडून घेतलेल्या मालाची बिले भरा.',
    newPurchaseBtn: 'नवीन खरेदी नोंदवा',

    // Sales Desk
    salesTitle: 'अंडी आणि कोंबड्या विक्री विभाग',
    salesSub: 'अंडी आणि कोंबड्यांचे घाऊक विक्री बिल आणि ग्राहकांकडील बाकी हिशोब.',
    newSaleBtn: 'नवीन विक्री बिल बनवा',

    // Warehouse Stock
    stockTitle: 'गोदाम साठा आणि साहित्य',
    stockSub: 'खाद्याची पोती, औषधांच्या कुप्या आणि कच्च्या साहित्याचा एकूण शिल्लक साठा.',
    newItemBtn: 'नवीन साहित्य जोडा',

    // Stakeholders
    stakeholderTitle: 'ग्राहक आणि व्यापारी नोंदणी',
    stakeholderSub: 'फार्मचे खरेदीदार व्यापारी, अंडी विक्रेते आणि खाद्याचे सप्लायर यांची माहिती.',
    addStakeholderBtn: 'नवीन व्यापारी/ग्राहक जोडा',

    // Staff HR
    staffTitle: 'कर्मचारी आणि पगार नोंदवही',
    staffSub: 'फार्मचे कामगार, त्यांची रोजची हजेरी आणि मजुरी पगार हिशोब.',
    addStaffBtn: 'नवीन कामगार नोंदवा',

    // Finance Ledgers
    financeTitle: 'जमा-खर्च आणि बहीखाते नोंदी',
    financeSub: 'फार्मची एकूण रोख जमा, बँक खात्याचे व्यवहार आणि खर्चाची पावती रजिस्टर.',
    addTransactionBtn: 'नवीन जमा-खर्च नोंदवा',

    // SQL CLI Console
    sqlTitle: 'एसक्यूएल कन्सोल नोंदणी',
    sqlSub: 'सुरक्षित राहून डेटाबेस टेबल्स मधून थेट डेटा तपासण्याची जागा.',
    runQueryBtn: 'कमांड रन करा',

    // Backups
    backupTitle: 'डेटाबेस बॅकअप व्यवस्थापक',
    backupSub: 'सुरक्षेसाठी डेटाबेसची सुरक्षित फाइल कॉपी बनवा किंवा जुनी कॉपी पूर्ववत करा.',
    createBackupBtn: 'नवीन बॅकअप घ्या'
  },
  gu: {
    dashboard: 'ડૅશબોર્ડ',
    layerFlocks: 'મરઘીઓના જૂથ (Flocks)',
    dailyLogs: 'દૈનિક માહિતી પત્રક',
    vaccinations: 'રસીકરણ અને દવાઓ',
    millingMix: 'ખોરાક મિલિંગ અને મિક્સ',
    procurement: 'ખરીદી અને સપ્લાયર',
    salesDesk: 'ઈંડા અને મરઘી વેચાણ',
    warehouseStock: 'ગોડાઉન સ્ટોક',
    stakeholders: 'ગ્રાહકો અને વેપારીઓ',
    staffHR: 'સ્ટાફ અને હાજરી',
    financeLedgers: 'ખાતાવહી અને હિસાબ',
    sqlCli: 'એસક્યુએલ કન્સોલ',
    backups: 'બેકઅપ અને રીસ્ટોર',
    reportsLedgers: 'રિપોર્ટ અને ખાતાઓ',
    settingsAudit: 'ફાર્મ સેટિંગ્સ અને ઓપરેટર accessક્સેસ',
    bulkImport: 'બલ્ક ડેટા આયાત',

    operatorHub: 'મરઘા ઉછેર કેન્દ્ર હબ',
    activeOperator: 'સક્રિય ઓપરેટર',
    lockConsole: 'લોગ આઉટ',
    offlineCoop: 'ઓફલાઈન લોકલ સુરક્ષિત ડેટાબેઝ',
    syncData: 'માહિતી અપડેટ કરો',
    registerFlock: 'નવું જૂથ ઉમેરો',
    confirm: 'ખાતરી કરો',
    cancel: 'રદ કરો',

    dashboardTitle: 'મરઘા ફાર્મ મેનેજમેન્ટ ડૅશબોર્ડ',
    dashboardSub: 'મરઘીઓની સ્થિતિ, ઈંડા ઉત્પાદનનો દર અને દૈનિક નાણાકીય હિસાબ અહીં જુઓ.',
    activeLayers: 'કુલ સક્રિય મરઘીઓ',
    liveHensInfo: 'ફાર્મમાં હાલમાં જીવંત મરઘીઓ',
    avgLayingRate: 'ઈંડા આપવાનો સરેરાશ દર (HDP %)',
    hdpTargetInfo: 'સામાન્ય રીતે લક્ષ્ય ૮૦% થી વધુ હોવું જરૂરી છે',
    eggsInStock: 'સ્ટોકમાં સુરક્ષિત ઈંડા',
    damagedEggsInfo: 'નુકશાન પામેલા ઈંડાની સંખ્યા',
    receivablesPayables: 'બાકી નાણાં',
    rxLabel: 'ગ્રાહકો પાસેથી લેણું',
    txLabel: 'વેપારીઓને દેવું',
    lowStockAlert: 'સ્ટોક ઓછો થવાની ચેતવણી!',
    lowStockDesc: 'નીચેની વસ્તુઓ ગોડાઉનમાં ઓછી છે. કૃપા કરીને ઓર્ડર કરો:',
    eggProductionvsFeed: 'ઈંડા ઉત્પાદન વિરુદ્ધ ખોરાક વપરાશ ટ્રેન્ડ',
    earningsExpenseChart: 'આવક વિરૂદ્ધ ખર્ચ ચાર્ટ વિગત',
    perEggCostDashboard: 'એક ઈંડાનો ઉત્પાદન ખર્ચ',
    eggProductionCostDesc: 'એક ઈંડા પાછળ થતો સરેરાશ ખર્ચ (ખરીદી કિંમત + ફાર્મ ખોરાક + રસી / પ્રાપ્ત ઈંડા)',

    activeLayerFlocksTitle: 'ફાર્મ ફ્લોક્સ (મરઘી ના જૂથો)',
    flocksSub: 'નવા મરઘીના જૂથ ઉમેરો, તેમના સ્વાસ્થ્ય અને મૃત્યુદર પર નજર રાખો.',
    flockName: 'જૂથનું નામ / આઈડી',
    breed: 'નસ્લનો પ્રકાર',
    initialCount: 'મરઘીઓની શરૂઆતની સંખ્યા',
    currentCount: 'હાલની મરઘીઓની સંખ્યા',
    arrivalDate: 'ફાર્મમાં આવ્યાની તારીખ',
    layCycleStart: 'ઈંડા આપવાનું શરૂ થયાની તારીખ',
    totalPurchaseVal: 'મરઘીઓ ખરીદવાનો કુલ ખર્ચ',
    notes: 'ખાસ નોંધ',
    launched: 'શરૂ કરવાની તારીખ',
    ageDays: 'ઉંમર (દિવસ)',
    headBalance: 'બાકી રહેલી મરઘીઓની સંખ્યા',
    mortalityRate: 'મૃત્યુ દર (Mortality %)',
    perBirdPrice: 'પ્રતિ મરઘી ખરીદ કિંમત',
    cumulativeValue: 'મરઘીઓ ખરીદવાની કુલ કિંમત',
    accruedFeedCost: 'કુલ ફાર્મ ખોરાક ખર્ચ',
    vaccineCost: 'દવા અને રસીકરણ પાછળ ખર્ચ',
    perEggProductionCost: 'પ્રતિ ઈંડા ઉત્પાદન ખર્ચ',
    newFlockHeading: 'નવો ફ્લોક (મરઘી જૂથ) ઉમેરો',
    saveFlockBtn: 'મરઘી જૂથ સેવ કરો',

    // Daily Logs
    dailyLogsTitle: 'દૈનિક ફાર્મ રેકોર્ડ પત્રક',
    dailyLogsSub: 'રોજિંદા ઈંડા, ખાધેલો મરઘી ખોરાક અને મૃત મરઘીઓની વિગત નોંધી રાખો.',
    addDailyLog: 'દૈનિક રેકોર્ડ ઉમેરો',

    // Vaccinations
    vaccineTitle: 'રસીકરણ અને દવાઓ રજીસ્ટર',
    vaccineSub: 'બીમારીઓ સામે રક્ષણ આપતી રસીઓ અને તે પાછળ થયેલા ખર્ચની વિગત.',
    logVaccineBtn: 'નવી રસી/દવા રજીસ્ટર કરો',

    // Milling Room
    millingTitle: 'મરઘી ખોરણ મિશ્રણ રૂમ',
    millingSub: 'ઘરેલું પોષક ખોરાક મિશ્રિત કરવા અને રો-મટીરીયલ તપાસવાની સુવિધા.',
    mixBatchBtn: 'નવો ખોરાક મિક્સ બનાવો',

    // Procurement
    procurementTitle: 'સપ્લાયર ખરીદી અને બીલોનો હિસાબ',
    procurementSub: 'નવો મરઘી ખોરાક, રસીની ખરીદી અને વેપારીના બિલની નોંધણી.',
    newPurchaseBtn: 'નવી ખરીદી રજીસ્ટર કરો',

    // Sales Desk
    salesTitle: 'ઈંડા અને મરઘી વેચાણ કાઉન્ટર',
    salesSub: 'તાજા ઈંડા તથા જૂની મરઘીઓનું વેચાણ અને ગ્રાહકોની બાકી લેણી રકમ.',
    newSaleBtn: 'નવું વેચાણ બિલ બનાવો',

    // Warehouse Stock
    stockTitle: 'ગોડાઉન સ્ટોક અને મટીરીયલ',
    stockSub: 'ખોરાકની ગુણીઓ, દવાની બોટલો અને કાચા માલનો સાચો હિસાબ.',
    newItemBtn: 'નવી આઈટમ ઉમેરો',

    // Stakeholders
    stakeholderTitle: 'વેપારીઓ અને ગ્રાહકોની ડિરેક્ટરી',
    stakeholderSub: 'ગ્રાહકો, દલાલો અને સપ્લાયરોના એડ્રેસ તથા તેમની શાખ ખાતાવહી.',
    addStakeholderBtn: 'નવો ગ્રાહક/વેપારી ઉમેરો',

    // Staff HR
    staffTitle: 'કર્મચારીઓ અને હાજરી રજીસ્ટર',
    staffSub: 'ફાર્મના મજૂરો, તેમની હાજરી અને દૈનિક પગાર ચુકવણી દર્શાવે છે.',
    addStaffBtn: 'નવો મજૂર ઉમેરો',

    // Finance Ledgers
    financeTitle: 'ખાતાવહી અને નફો-નુકસાન હિસાબ',
    financeSub: 'ફાર્મમાં થતી બધી રોકડ આવક, ખર્ચના વાઉચર અને અસલ ખાતાવહી.',
    addTransactionBtn: 'નવો હિસાબ ઉમેરો',

    // SQL CLI Console
    sqlTitle: 'એસક્યુએલ કન્સોલ ઈન્ટરફેસ',
    sqlSub: 'ડેટાબેઝના ટેબલો સીધા ચેક કરવા માટે એસક્યુએલ રન કરો.',
    runQueryBtn: 'ક્વેરી રન કરો',

    // Backups
    backupTitle: 'ડેટાબેઝ બેકઅપ સંચાલન',
    backupSub: 'ડેટาબેઝ ફાઇલોને ભવિષ્ય માટે સુરક્ષિત સ્ટેપમાં ડાઉનલોડ કરો.',
    createBackupBtn: 'નવો બેકઅપ લો'
  },
  te: {
    dashboard: 'డ్యాష్‌బోర్డ్',
    layerFlocks: 'కోళ్ళ సమూహాలు (Flocks)',
    dailyLogs: 'రోజువారీ రికార్డులు',
    vaccinations: 'టీకాలు మరియు మందులు',
    millingMix: 'మేత తయారీ మరియు మిక్స్',
    procurement: 'కొనుగోళ్లు మరియు సప్లయర్',
    salesDesk: 'గుడ్లు మరియు కోళ్ళ అమ్మకాలు',
    warehouseStock: 'గోదాము నిల్వలు (స్టాక్)',
    stakeholders: 'కస్టమర్లు మరియు సప్లయర్లు',
    staffHR: 'సిబ్బంది జీతాలు & హాజరు',
    financeLedgers: 'ఖాతాలు & ఖర్చు వివరాలు',
    sqlCli: 'SQL కన్సోల్',
    backups: 'బ్యాకప్ మరియు రీస్టోర్',
    reportsLedgers: 'నివేదికలు & లెడ్జర్లు',
    settingsAudit: 'ఫార్మ్ సెట్టింగులు & ఆపరేటర్ యాక్సెస్',
    bulkImport: 'బల్క్ డేటా దిగుమతి',

    operatorHub: 'కోళ్ల ఫారమ్ హబ్',
    activeOperator: 'ప్రస్తుత ఆపరేటర్',
    lockConsole: 'లాగ్ అవుట్',
    offlineCoop: 'ఆఫ్‌లైన్ లోకల్ డేటాబేస్',
    syncData: 'డేటా రీఫ్రెష్',
    registerFlock: 'కొత్త సమూహాన్ని చేర్చు',
    confirm: 'నిర్ధారించు',
    cancel: 'రద్దు చేయి',

    dashboardTitle: 'కోళ్ల ఫారమ్ నిర్వహణ డ్యాష్‌బోర్డ్',
    dashboardSub: 'కోళ్ల స్థితి, గుడ్ల ఉత్పత్తి రేటు మరియు రోజువారీ ఖర్చుల బడ్జెట్ చూడండి.',
    activeLayers: 'మొత్తం కోళ్ళు',
    liveHensInfo: 'ఫారమ్‌లో ఉన్న సజీవ కోళ్ళు',
    avgLayingRate: 'గుడ్లు పెట్టే సగటు రేటు (HDP %)',
    hdpTargetInfo: 'సగటు లక్ష్యం 80% పైన ఉండాలి',
    eggsInStock: 'గోదాములో ఉన్న గుడ్లు',
    damagedEggsInfo: 'పాడైన గుడ్లు సంఖ్య',
    receivablesPayables: 'బాకీలు',
    rxLabel: 'కస్టమర్ల నుండి రావలసినవి',
    txLabel: 'సప్లయర్లకు చెల్లించవలసినవి',
    lowStockAlert: 'స్టాక్ తక్కువగా ఉంది!',
    lowStockDesc: 'కింది వస్తువులు స్టాక్‌లో తక్కువగా ఉన్నాయి. దయచేసి ఆర్డర్ చేయండి:',
    eggProductionvsFeed: 'మేత వినియోగం vs గుడ్ల ఉత్పత్తి గ్రాఫ్',
    earningsExpenseChart: 'నెలవారీ ఆదాయం మరియు ఖర్చుల ఆకృతి',
    perEggCostDashboard: 'ఒక గుడ్డు ఉత్పత్తి ఖర్చు',
    eggProductionCostDesc: 'ఒక గుడ్డు ఉత్పత్తి చేయడానికి అయిన సగటు ఖర్చు (కోడి కొనుగోలు + మేత + మందులు / ఉత్పత్తి అయిన గుడ్లు)',

    activeLayerFlocksTitle: 'కోళ్ళ బ్యాచ్ వివరాలు',
    flocksSub: 'కొత్త కోళ్ళ బ్యాచ్‌లను నమోదు చేయండి, వాటి ఆరోగ్యం మరియు నష్టాలను ట్రాక్ చేయండి.',
    flockName: 'బ్యాచ్ పేరు / ఐడి',
    breed: 'కోడి రకము',
    initialCount: 'ప్రారంభ కోళ్ళ సంఖ్య',
    currentCount: 'ప్రస్తుత కోళ్ళ సంఖ్య',
    arrivalDate: 'ఫారమ్‌కు వచ్చిన తేదీ',
    layCycleStart: 'గుడ్లు పెట్టడం ప్రారంభించిన తేదీ',
    totalPurchaseVal: 'కోళ్ళను కొనుగోలు చేసిన మొత్తం ధర',
    notes: 'ముఖ్యమైన గమనికలు',
    launched: 'ప్రారంభించిన తేదీ',
    ageDays: 'వయస్సు (రోజులు)',
    headBalance: 'మిగిలి ఉన్న కోళ్ళ సంఖ్య',
    mortalityRate: 'మరణాల శాతం (Mortality %)',
    perBirdPrice: 'ఒక్కో కోడి ధర',
    cumulativeValue: 'కోళ్ళ బ్యాచ్ మొత్తం కొనుగోలు ధర',
    accruedFeedCost: 'మొత్తం మేత ఖర్చు',
    vaccineCost: 'మొత్తం వైద్యం మరియు టీకాల ఖర్చు',
    perEggProductionCost: 'గుడ్డు ఉత్పత్తి ధర',
    newFlockHeading: 'కొత్త కోళ్ళ సమూహాన్ని నమోదు చేయి',
    saveFlockBtn: 'సమూహాన్ని సేవ్ చేయి',

    // Daily Logs
    dailyLogsTitle: 'రోజువారీ ఫారమ్ డైరీ',
    dailyLogsSub: 'గుడ్ల సేకరణ, తిన్న మేత మరియు కోళ్ళ మరణాలను రికార్డ్ చేయండి.',
    addDailyLog: 'రోజువారీ రికార్డ్ చేర్చు',

    // Vaccinations
    vaccineTitle: 'మందులు మరియు టీకాల వివరాలు',
    vaccineSub: 'కోళ్లకు వేసిన నివారణ టీకాలు, మందులు మరియు ఖర్చులను నమోదు చేయండి.',
    logVaccineBtn: 'కొత్త మెడిసిన్ రికార్డ్',

    // Milling Room
    millingTitle: 'మేత తయారీ మరియు పంపిణీ',
    millingSub: 'ఈ రోజు కోళ్లకు ఎంత నిష్పత్తిలో పోషకాహార మేత మిక్స్ చేయాలో ఇక్కడ రాయండి.',
    mixBatchBtn: 'మేత బ్యాచ్ మిస్',

    // Procurement
    procurementTitle: 'సుగ్రీవ కొనుగోళ్లు & బిల్లు రికార్డు',
    procurementSub: 'బయటి నుండి తెచ్చిన మేత లోడ్లు, వ్యాక్సినేషన్ సీసాలు మరియు సప్లయర్ బిల్లులు.',
    newPurchaseBtn: 'కొత్త కొనుగోలు నమోదు',

    // Sales Desk
    salesTitle: 'గుడ్లు & కోళ్ళు అమ్మకాల డెస్క్',
    salesSub: 'తాజా గుడ్లు, కోళ్ళ అమ్మకాల బిల్లులు మరియు బాకీ వివరాల ట్రాకింగ్.',
    newSaleBtn: 'కొత్త అమ్మకం బిల్',

    // Warehouse Stock
    stockTitle: 'గోదాము నిల్వలు (స్టాక్ బ్యాలెన్స్)',
    stockSub: 'స్టాక్‌లో ఉన్న మేత బస్తాలు, వ్యాక్సిన్ సీసాల లైవ్ వివరాలు.',
    newItemBtn: 'కొత్త స్టాక్ ఐటమ్',

    // Stakeholders
    stakeholderTitle: 'వ్యాపారులు మరియు డీలర్ల డైరెక్టరీ',
    stakeholderSub: 'మీ గుడ్లు కొనే హోల్‌సేల్ డీలర్లు మరియు మేత అమ్మే సప్లయర్ల వివరాలు.',
    addStakeholderBtn: 'కొత్త వ్యాపారిని చేర్చు',

    // Staff HR
    staffTitle: 'సిబ్బంది జీతాలు మరియు హాజరు పట్టిక',
    staffSub: 'మీ ఫారమ్‌లో పనిచేసే కూలీలు, జీతాలు మరియు రోజువారీ పనులు.',
    addStaffBtn: 'కొత్త కూలీని నమోదు చేయి',

    // Finance Ledgers
    financeTitle: 'ఆదాయ వ్యాసరంగాలు మరియు ఖర్చుల ఖాతా',
    financeSub: 'ఫారమ్ ఆదాయ వ్యయాలు మరియు మొత్తం రోజువారీ చిల్లర ఖర్చులు.',
    addTransactionBtn: 'కొత్త జమ-ఖర్చు నమోదు',

    // SQL CLI Console
    sqlTitle: 'రహస్య ఎస్క్యుఎల్ కన్సోల్',
    sqlSub: 'మీ అనువర్తన డ్రాఫ్ట్ టేబుళ్ళను నేరుగా చేధించడానికి ఎస్క్యుఎల్ రాయండి.',
    runQueryBtn: 'ఎస్క్యుఎల్ రన్ చేయి',

    // Backups
    backupTitle: 'డేటాబేస్ బ్యాకప్ సమాచార రక్షణ',
    backupSub: 'మీ సమాచారం సురక్షితంగా ఉంచడానికి కొత్త బ్యాకప్ కాపీని దాచుకోండి.',
    createBackupBtn: 'కొత్త బ్యాకప్ చేయి'
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড',
    layerFlocks: 'মুরগির ঝাঁক (Flocks)',
    dailyLogs: 'দৈনিক রেকর্ড বই',
    vaccinations: 'টিকা এবং ওষুধ',
    millingMix: 'খাবার ভাঙানো ও মিশ্রণ',
    procurement: 'ক্রয় ও বিক্রেতা বিভাগ',
    salesDesk: 'ডিম ও মুরগি বিক্রয়',
    warehouseStock: 'গুদামজাত পণ্য (স্টক)',
    stakeholders: 'ক্রেতা ও বিক্রেতা',
    staffHR: 'কর্মী ও হাজিরা বিবরণ',
    financeLedgers: 'হিসাব খাতা ও খরচ',
    sqlCli: 'SQL কনসোল',
    backups: 'ব্যাকআপ এবং রিস্টোর',
    reportsLedgers: 'রিপোর্ট এবং লেজার',
    settingsAudit: 'খামার সেটিংস এবং অপারেটর অ্যাক্সেস',
    bulkImport: 'বাল্ক ডেটা আমদানি',

    operatorHub: 'পোল্ট্রি ফার্ম হাব',
    activeOperator: 'সক্রিয় ব্যবহারকারী',
    lockConsole: 'লগ আউট',
    offlineCoop: 'অফলাইন সুরক্ষিত ডেটাবেস',
    syncData: 'তথ্য রিফ্রেশ করুন',
    registerFlock: 'নতুন ঝাঁক যোগ করুন',
    confirm: 'নিশ্চিত করুন',
    cancel: 'বাতিল করুন',

    dashboardTitle: 'পোল্ট্রি খামার পরিচালনা ড্যাশবোর্ড',
    dashboardSub: 'মুরগির অবস্থা, ডিম পাড়ার হার এবং খামারের দৈনিক লাভ-ক্ষতির খতিয়ান দেখুন।',
    activeLayers: 'মোট সক্রিয় মুরগি',
    liveHensInfo: 'খামারে বর্তমানে জীবিত মুরগির সংখ্যা',
    avgLayingRate: 'ডিম পাড়ার গড় হার (HDP %)',
    hdpTargetInfo: 'সাধারণত লক্ষ্য ৮০% এর ওপরে হওয়া আবশ্যক',
    eggsInStock: 'গুদামে থাকা ডিম',
    damagedEggsInfo: 'ভেঙে যাওয়া/নষ্ট হওয়া ডিম',
    receivablesPayables: 'বাকি পাওনা/দেনা',
    rxLabel: 'ক্রেতাদের কাছ থেকে পাওনা',
    txLabel: 'বিক্রেতাদের কাছে দেনা',
    lowStockAlert: 'স্টক কমে যাওয়ার সতর্কবার্তা!',
    lowStockDesc: 'নিচের আইটেমগুলির স্টক একদম ফুরিয়ে এসেছে। দ্রুত অর্ডার করুন:',
    eggProductionvsFeed: 'ডিম উৎপাদন বনাম খাদ্য ব্যবহার চার্ট',
    earningsExpenseChart: 'আয় বনাম ব্যয় বিবরণী গ্রাফ',
    perEggCostDashboard: 'একটি ডিম উৎপাদনে খরচ',
    eggProductionCostDesc: 'একটি ডিম উৎপাদনে গড় খরচ (মুরগি ক্রয় + খাদ্য + ওষুধ / আজ পর্যন্ত মোট ডিম)',

    activeLayerFlocksTitle: 'মুরগির সক্রিয় ঝাঁকসমূহ',
    flocksSub: 'নতুন মুরগির ব্যাচ যোগ করুন, তাদের স্বাস্থ্য ও ডিম পাড়ার হিসাব রাখুন।',
    flockName: 'ঝাঁকের নাম বা আইডি',
    breed: 'জাতের প্রকার',
    initialCount: 'শুরুতে মুরগির সংখ্যা',
    currentCount: 'বর্তমানে মুরগির সংখ্যা',
    arrivalDate: 'আগমনের তারিখ',
    layCycleStart: 'ডিম পাড়া শুরুর তারিখ',
    totalPurchaseVal: 'মুরগি ক্রয়ের মোট মূল্য',
    notes: 'গুরুত্বপূর্ণ নোট',
    launched: 'আমদানির তারিখ',
    ageDays: 'বয়স (দিন)',
    headBalance: 'অবশিষ্ট মুরগির সংখ্যা',
    mortalityRate: 'মুরগির মৃত্যুর হার (Mortality %)',
    perBirdPrice: 'মুরগি প্রতি ক্রয় মূল্য',
    cumulativeValue: 'ঝাঁকের মোট ক্রয় মূল্য',
    accruedFeedCost: 'মোট খাদ্যের খরচ',
    vaccineCost: 'মোট ওষুধ ও টিকার খরচ',
    perEggProductionCost: 'ডিম প্রতি উৎপাদন খরচ',
    newFlockHeading: 'নতুন মুরগি ব্যাচ যোগ করুন',
    saveFlockBtn: 'মুরগি ঝাঁকের তথ্য সংরক্ষণ করুন',

    // Daily Logs
    dailyLogsTitle: 'দৈনিক খামারের খতিয়ান ও রেকর্ড',
    dailyLogsSub: 'ডিমের দৈনিক কালেকশন, মুরগির প্রধান খাদ্যগ্রহণ এবং খামারের বার্ড মরটালিটি রেকর্ড রাখুন।',
    addDailyLog: 'নতুন দৈনিক এন্ট্রি',

    // Vaccinations
    vaccineTitle: 'টিকাদান ও খামার ওষুধ ঘর',
    vaccineSub: 'টিকার ডোজ, জীবানু প্রতিরোধক উপাদান ও চিকিৎসাজনিত খরচের হিসাব রাখুন।',
    logVaccineBtn: 'নতুন টিকা/ওষুধ এন্ট্রি করুন',

    // Milling Room
    millingTitle: 'খাদ্য ভাঙানো ও মিক্সিং বিভাগ',
    millingSub: 'বিভিন্ন পুষ্টিকর উপাদানের অনুপাত ঠিক করুন ও মুরগির স্বাস্থ্যসম্মত সুষম খাবার তৈরি করুন।',
    mixBatchBtn: 'নতুন ফুড মিক্স প্রস্তুত করুন',

    // Procurement
    procurementTitle: 'পণ্য ক্রয় ও বিক্রেতার বিল সংক্রান্ত হিসাব',
    procurementSub: 'বাইরে থেকে আনা ফিด ড্রাম, ওষুধ এবং খামারের সামগ্রী ক্রয়ের হিসাব সংরক্ষণ করুন।',
    newPurchaseBtn: 'নতুন ক্রয় বিবরণী',

    // Sales Desk
    salesTitle: 'ডিম ও মুরগি বিক্রয় কেন্দ্র',
    salesSub: 'ডিম ও স্ক্র্যাপ মুরগি বিক্রয় করুন, গ্রাহকের চালানের হিসাব রাখুন এবং বকেয়া টাকা আদায় করুন।',
    newSaleBtn: 'নতুন বিক্রয় চালান তৈরি করুন',

    // Warehouse Stock
    stockTitle: 'গুদামজাত খাদ্য ও মেডিসিন স্টক',
    stockSub: 'গুদামে থাকা খাদ্যের বস্তা, ওষুধের ড্রাম ও প্রধান উপকরণের লাইভ তথ্য।',
    newItemBtn: 'গুদামে পণ্য যোগ করুন',

    // Stakeholders
    stakeholderTitle: 'গ্রাহক ও সপ্লায়ার ডিরেক্টরি',
    stakeholderSub: 'ডিমের পাইকারি বিক্রেতা এবং পোল্ট্রি ফিড সরবরাহকারীদের নামের তালিকা ও বকেয়া হিসাব।',
    addStakeholderBtn: 'নতুন ক্রেতা/বিক্রেতা যোগ করুন',

    // Staff HR
    staffTitle: 'কর্মী রেজিস্টার ও হাজিরা বেতন বই',
    staffSub: 'খামারের কর্মচারী, তাদের ছুটির হিসাব, বেতন এবং দৈনিক কাজের বিবরণী।',
    addStaffBtn: 'নতুন খামার কর্মী নিয়োগ করুন',

    // Finance Ledgers
    financeTitle: 'জমা-খরচ ও দৈনিক খরচের হিসাব বই',
    financeSub: 'খামারের সমস্ত দৈনিক নগদ লেনদেন, বিলের রসিদ এবং মূল ব্যালেন্স শীট।',
    addTransactionBtn: 'নতুন লেনদেন লিখুন',

    // SQL CLI Console
    sqlTitle: 'এসকিউএল কোয়েরি কনসোল',
    sqlSub: 'ডেটাবেস টেবিলগুলি থেকে সরাসরি ডেটা দেখতে কোয়েরি চালান।',
    runQueryBtn: 'কোয়েরি রান করুন',

    // Backups
    backupTitle: 'ডেটাবেস ব্যাকআপ কন্ট্রোলার',
    backupSub: 'তথ্য নিরাপদে রাখতে ব্যাকআপ ফাইল ডাউনলোড করুন এবং প্রয়োজনে রিস্টোর করুন।',
    createBackupBtn: 'নতুন ব্যাকআপ ফাইল নিন'
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
