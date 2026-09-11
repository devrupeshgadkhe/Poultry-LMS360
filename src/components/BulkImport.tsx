import React, { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet, 
  Play, 
  Check, 
  Activity, 
  HelpCircle,
  Database,
  ArrowRight
} from 'lucide-react';
import { Language, translations } from '../translations';

const bulkImportTranslations: Record<Language, {
  title: string;
  sub: string;
  step1: string;
  step2: string;
  schemaFields: string;
  downloadBtn: string;
  uploadBtn: string;
  selectDropFile: string;
  dropEncoding: string;
  parsingText: string;
  commitBtn: string;
  validationResults: string;
  readyToSync: string;
  validRowsText: string;
}> = {
  en: {
    title: 'Bulk Ledger Data Import Node',
    sub: 'Accelerate system populating times with high-throughput CSV spreadsheet templates. Includes active duplicate checking and dependency parsing.',
    step1: '1. Download Sample Spreadsheet Template',
    step2: '2. Upload Completed CSV Spreadsheet',
    schemaFields: 'Required Schema Fields',
    downloadBtn: 'Download CSV Template',
    uploadBtn: 'Upload CSV File',
    selectDropFile: 'Select or Drop CSV File',
    dropEncoding: 'Supports plain UTF-8 encoded files up to 50MB. Click to browse.',
    parsingText: 'Working... reading rows & checking bounds',
    commitBtn: 'Commit & Save Records to Database',
    validationResults: 'File Parsing & Verification',
    readyToSync: 'File contains valid schema. Click Commit to load into database.',
    validRowsText: 'Ready to import'
  },
  hi: {
    title: 'बल्क डेटा आयात नोड',
    sub: 'उच्च मात्रा वाले सीएसवी स्प्रेडशीट प्रारूपों के साथ डेटा भरने की प्रक्रिया को गति दें।',
    step1: '1. नमूना स्प्रेडशीट टेम्पलेट डाउनलोड करें',
    step2: '2. तैयार सीएसवी स्प्रेडशीट अपलोड करें',
    schemaFields: 'आवश्यक फ़ील्ड्स सूची (Required Fields)',
    downloadBtn: 'टेम्पलेट डाउनलोड करें (Download CSV)',
    uploadBtn: 'सीएसवी फ़ाइल चुनें',
    selectDropFile: 'सीएसवी फ़ाइल चुनें या यहाँ खींचें',
    dropEncoding: 'यूटीएफ-8 एन्कोडिंग वाली सीएसवी फ़ाइलों का समर्थन करता है। ब्राउज़ करने के लिए क्लिक करें।',
    parsingText: 'संख्यात्मक और सीमा आकलन चल रहा है...',
    commitBtn: 'डेटाबेस में लेज़र प्रविष्टियाँ सहेजें',
    validationResults: 'सत्यापन और त्रुटि विश्लेषण परिणाम',
    readyToSync: 'सभी प्रविष्टियाँ सही हैं। आयात करने के लिए सहेजें बटन दबाएं।',
    validRowsText: 'आयात के लिए तैयार'
  },
  mr: {
    title: 'बल्क डेटा आयात नोड',
    sub: 'उच्च-थ्रूपुट सीएसवी स्प्रेडशीट टेम्पलेटसह सिस्टीम पॉप्युलेटिंग प्रक्रियेस गती द्या.',
    step1: '1. नमुना स्प्रेडशीट टेम्पलेट डाउनलोड करा',
    step2: '2. पूर्ण केलेली सीएसव्ही स्प्रेडशीट अपलोड करा',
    schemaFields: 'आवश्यक फील्ड सूची',
    downloadBtn: 'टेम्पलेट डाउनलोड करा (CSV)',
    uploadBtn: 'सीएसव्ही फाइल अपलोड करा',
    selectDropFile: 'फाइल निवडा किंवा येथे ड्रॅग करा',
    dropEncoding: 'यूटीएफ-8 एन्कोडिंगसह सीएसव्ही फायलींचे समर्थन करते. ब्राउझ करण्यासाठी क्लिक करा.',
    parsingText: 'हिशोब मोजणी प्रक्रिया चालू आहे...',
    commitBtn: 'डेटाबेसमध्ये नोंदी जतन करा',
    validationResults: 'तपासणी आणि सत्यापन परिणाम',
    readyToSync: 'फाइल डेटाबेसमध्ये जतन करण्यासाठी तयार आहे.',
    validRowsText: 'आयात करण्यासाठी तयार'
  },
  gu: {
    title: 'સામૂહિક ડેટા આયાત પત્રક',
    sub: 'ઝડપી સીએસવી ટેમ્પલેટ ફાઇલો દ્વારા સિસ્ટમ ડેટા એન્ટ્રી પ્રક્રિયા સક્ષમ કરો.',
    step1: '1. સેમ્પલ ટેમ્પલેટ શીટ ડાઉનલોડ કરો',
    step2: '2. મેળવેલ સીએસવી ફાઇલ અપલોડ કરો',
    schemaFields: 'આવશ્યક કોલમ હેડર્સ',
    downloadBtn: 'ટેમ્પલેટ ડાઉનલોડ (CSV)',
    uploadBtn: 'ફાઇલ સિલેક્ટ કરો (CSV)',
    selectDropFile: 'ફાઇલ સિલેક્ટ કરો અથવા અંહી મુકો',
    dropEncoding: 'યુટીએફ-૮ કોડેડ ફાઇલો સ્વીકાર્ય. બ્રાઉઝ કરવા ક્લિક કરો.',
    parsingText: 'ચકાસણી પ્રક્રિયા ચાલુ છે...',
    commitBtn: 'ડેટાબેઝમાં એન્ટ્રી સેવ કરો',
    validationResults: 'પૃથક્કરણ અને ચકાસણી સારાંશ',
    readyToSync: 'ડેટાબેઝમાં આયાત કરવા માટે તૈયાર છે.',
    validRowsText: 'આયાત માટે મંજૂર'
  },
  te: {
    title: 'డౌన్‌లోడ్ & బల్క్ డేటా ఇంపోర్టర్',
    sub: 'భారీ డేటాను త్వరగా అప్‌లోడ్ చేయడానికి ఉపయోగపడే CSV ఫార్మాట్స్ సమాచారం.',
    step1: '1. నమూనా స్ప్రెడ్‌షీట్ డౌన్‌లోడ్ చేసుకోండి',
    step2: '2. పూర్తి చేసిన CSV ఫైల్ అప్‌లోడ్ చేయండి',
    schemaFields: 'అవసరమైన కాలమ్స్ వివరాలు',
    downloadBtn: 'CSV నమూనా డౌన్‌లోడ్',
    uploadBtn: 'CSV ఫైల్ అప్‌లోడ్',
    selectDropFile: 'ఫైల్ ఎంచుకోండి లేదా ఇక్కడ డ్రాప్ చేయండి',
    dropEncoding: 'UTF-8 ఎన్‌కోడింగ్‌తో కూడిన CSV ఫైల్స్',
    parsingText: 'విశ్లేషిస్తోంది... దయచేసి వేచి ఉండండి',
    commitBtn: 'డేటాబేస్కు రికార్డులను సమర్పించు',
    validationResults: 'ఫైల్ విశ్లేషణ మరియు ధృవీకరణ',
    readyToSync: 'డేటాబేస్కు సమర్పించడానికి రికార్డులు సిద్ధంగా ఉన్నాయి.',
    validRowsText: 'ఇంపోర్ట్ చేయడానికి సిద్ధంగా ఉంది'
  },
  bn: {
    title: 'একত্রিত বাল্ক ডাটা ইম্পোর্ট নোড',
    sub: 'উচ্চ ক্ষমতার CSV স্প্রেডশীট টেমপ্লেট দিয়ে সিস্টেম ড্যাটা ইনপুট প্রসেস দ্রুত করুন।',
    step1: '1. নমুনা স্প্রেডশীট টেমপ্লেট ডাউনলোড করুন',
    step2: '2. আপনার CSV স্প্রেডশীট আপলোড করুন',
    schemaFields: 'প্রয়োজনীয় ফিল্ড কোডসমূহ',
    downloadBtn: 'CSV টেমপ্লেট ডাউনলোড',
    uploadBtn: 'CSV ফাইল সিলেক্ট করুন',
    selectDropFile: 'ফাইল সিলেক্ট করুন বা ড্রপ করুন',
    dropEncoding: 'ইউটিএফ-৮ ফরম্যাট সাপোর্টেড',
    parsingText: 'যাচাই করা হচ্ছে... একটু অপেক্ষা করুন',
    commitBtn: 'ডাটাবেজে তথ্য সংরক্ষণ করুন',
    validationResults: 'ফাইল বিশ্লেষণ ও ভেরিফিকেশন ফলাফল',
    readyToSync: 'ডাটাবেজে তথ্য ইম্পোর্ট করতে প্রস্তুত।',
    validRowsText: 'ইম্পোর্ট করার জন্য তৈরি'
  }
};

interface BulkImportProps {
  currentLanguage: Language;
}

type ImportType = 'sales' | 'purchases' | 'items' | 'daily-logs';

interface ParseRecord {
  rowNumber: number;
  status: 'Valid' | 'Duplicate' | 'Invalid';
  errors: string[];
  details: string[];
  record: any;
}

interface ValidationSummary {
  total: number;
  valid: number;
  duplicate: number;
  invalid: number;
}

interface ParseResponse {
  type: ImportType;
  validationSummary: ValidationSummary;
  records: ParseRecord[];
}

export default function BulkImport({ currentLanguage }: BulkImportProps) {
  const bt = bulkImportTranslations[currentLanguage] || bulkImportTranslations['en'];
  const t = translations[currentLanguage];
  const [selectedType, setSelectedType] = useState<ImportType>('items');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isCommiting, setIsCommiting] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample templates as stringified CSV structures
  const templates: Record<ImportType, { filename: string; content: string; description: string; headers: string[] }> = {
    items: {
      filename: 'poultry_items_template.csv',
      content: 'ItemName,Category,UnitOfMeasurement,UnitPrice,SellingPrice,CurrentStock,WeightPerUnit,MinThreshold,Notes\nStarter Feed,Feed,Kg,1.25,0,500,1,100,In-house broiler feed starter\nAntibiotic Zinc,Medicine,Bottle,45.00,0,15,1,2,Critical vaccine supply\nPlastic Feeder,Equipment,Pieces,12.50,0,80,1,10,Brooder feeder accessories\nWhite Eggs Large,Sales Item,Tray-30,0,6.50,150,1,20,Pre-packaged graded fresh trays',
      description: 'Import new inventories, medicines, equipment, and finished sales product lines. Valid categories are: Feed, Medicine, Equipment, Sales Item, Raw Ingredient.',
      headers: ['ItemName', 'Category', 'UnitOfMeasurement', 'UnitPrice', 'SellingPrice', 'CurrentStock', 'WeightPerUnit', 'MinThreshold', 'Notes']
    },
    'daily-logs': {
      filename: 'poultry_daily_logs_template.csv',
      content: 'FlockName,LogDate,FeedName,FeedConsumedKg,MortalityCount,EggsCollected,DamagedEggsCollected,WaterConsumed,DailyAverageWeight,BirdsEatenBySelf,BirdsEatenValue,EggsGifted,EggsGiftedValue,Notes\nFlock A,2026-06-15,Starter Feed,120.5,2,480,5,310.2,1.85,1,150,2,5,Regular laying collection log\nFlock B,2026-06-15,Starter Feed,95.0,0,320,2,240.0,1.72,0,0,0,0,Heat stress observed briefly',
      description: 'Upload consolidated daily production parameters including feed consumed (and Feed item name), layer egg count, damaged logs, mortality indices, water intake, birds eaten by self, and gifted eggs.',
      headers: ['FlockName', 'LogDate', 'FeedName', 'FeedConsumedKg', 'MortalityCount', 'EggsCollected', 'DamagedEggsCollected', 'WaterConsumed', 'DailyAverageWeight', 'BirdsEatenBySelf', 'BirdsEatenValue', 'EggsGifted', 'EggsGiftedValue', 'Notes']
    },
    purchases: {
      filename: 'poultry_procurement_purchases_template.csv',
      content: 'InvoiceNumber,SupplierName,PurchaseDate,ItemName,ItemType,Quantity,UnitPrice,GSTPercentage,ReceivedAmount,Status,Notes\nPR-9921,Broiler Hatcheries Ltd,2026-06-15,Starter Feed,Inventory,200,1.15,5,241.50,Paid,Procured fresh feed supply\nPR-9922,Broiler Hatcheries Ltd,2026-06-14,Starter Feed,Inventory,100,1.15,5,0,Unpaid,Feed on credit balance',
      description: 'Record external procurement purchase receipts. Matches or creates Supplier profiles automatically. Maps purchased item logs into warehouse inventory indices.',
      headers: ['InvoiceNumber', 'SupplierName', 'PurchaseDate', 'ItemName', 'ItemType', 'Quantity', 'UnitPrice', 'GSTPercentage', 'ReceivedAmount', 'Status', 'Notes']
    },
    sales: {
      filename: 'poultry_egg_bird_sales_template.csv',
      content: 'InvoiceNumber,CustomerName,SaleDate,ItemName,ItemType,Quantity,UnitPrice,GSTPercentage,Discount,OtherCharges,ReceivedAmount,Status,Notes\nSL-2023,Capital Wholesalers,2026-06-15,Fresh Eggs,Egg,50,0.25,0,0,5.00,17.50,Paid,Direct graded egg trays\nSL-2024,Capital Wholesalers,2026-06-14,Fresh Eggs,Egg,100,0.25,0,5.00,0,20.00,Paid,B2B retail delivery',
      description: 'Log point-of-sale customer receipts. Matches or creates Customer credit logs automatically. Subtracts layer counts or warehouse egg stock levels instantly.',
      headers: ['InvoiceNumber', 'CustomerName', 'SaleDate', 'ItemName', 'ItemType', 'Quantity', 'UnitPrice', 'GSTPercentage', 'Discount', 'OtherCharges', 'ReceivedAmount', 'Status', 'Notes']
    }
  };

  const currentTemplate = templates[selectedType];

  const handleDownloadTemplate = () => {
    const blob = new Blob([currentTemplate.content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', currentTemplate.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFileContent = (content: string, name: string) => {
    setCsvText(content);
    setFileName(name);
    setSuccessMessage('');
    setErrorMessage('');
    setParseResult(null);
    handleParse(content);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processFileContent(event.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processFileContent(event.target.result as string, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleParse = async (rawCsv: string) => {
    setIsParsing(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bulk-import/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'x-user-email': localStorage.getItem('userEmail') || 'operator@farm.com'
        },
        body: JSON.stringify({
          type: selectedType,
          csvData: rawCsv
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to parse CSV spreadsheet entries.');
      }

      setParseResult(body);
    } catch (err: any) {
      setErrorMessage(err.message || 'Server encountered an issue parsing the data.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!parseResult) return;
    
    setIsCommiting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/bulk-import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'x-user-email': localStorage.getItem('userEmail') || 'operator@farm.com'
        },
        body: JSON.stringify({
          type: selectedType,
          records: parseResult.records
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Failed to sync data elements to core database.');
      }

      setSuccessMessage(body.message);
      setParseResult(null);
      setFileName('');
      setCsvText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed saving spreadsheet data. Check database constraints.');
    } finally {
      setIsCommiting(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6" id="bulk-import-module-panel">
      {/* Upper header summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5" id="bulk-import-meta">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2.5">
            <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            {bt.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {bt.sub}
          </p>
        </div>
        
        {/* Template Selector Pill Group */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl" id="import-type-selector">
          {(['items', 'daily-logs', 'purchases', 'sales'] as ImportType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type);
                setParseResult(null);
                setFileName('');
                setCsvText('');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all duration-150 ${
                selectedType === type
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {type.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="bulk-import-grids">
        
        {/* Left column: Controls & template instructions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-indigo-500" />
              {bt.step1}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              {currentTemplate.description}
            </p>

            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] text-slate-400 font-black uppercase block tracking-wider">{bt.schemaFields}</span>
              <div className="flex flex-wrap gap-1">
                {currentTemplate.headers.map((h, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono font-medium text-slate-600">
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-mono text-xs font-bold rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <Download className="h-4 w-4" />
              {bt.downloadBtn}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-500" />
              {bt.step2}
            </h2>

            {/* Drag & Drop Canvas */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/40 scale-[0.98]' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3">
                <FileSpreadsheet className="h-6 w-6 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-slate-800 block">
                {fileName ? fileName : bt.selectDropFile}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {bt.dropEncoding}
              </span>
            </div>

            {fileName && (
              <div className="flex items-center justify-between text-xs bg-slate-50 rounded-xl p-2.5 border border-slate-150">
                <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">{fileName}</span>
                <button 
                  onClick={() => {
                    setFileName('');
                    setCsvText('');
                    setParseResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  {currentLanguage === 'hi' ? 'हटाएं' : currentLanguage === 'mr' ? 'काढा' : currentLanguage === 'gu' ? 'દૂર કરો' : currentLanguage === 'te' ? 'తొలగించు' : currentLanguage === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Action preview panels or server reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Feedback alerts */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex gap-3 text-xs shadow-sm animate-fade-in">
              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              <div>
                <span className="font-bold block">Parsing Failure Encountered</span>
                <p className="mt-1 leading-relaxed opacity-90 font-mono text-[11px]">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-5 flex gap-3 text-xs shadow-sm animate-fade-in">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
              <div>
                <span className="font-bold text-sm block">Import Succeeded & Synced</span>
                <p className="mt-1 leading-relaxed text-emerald-700">{successMessage}</p>
                <div className="mt-3 flex gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black uppercase">Database Synced</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black uppercase">Audit Entry Logged</span>
                </div>
              </div>
            </div>
          )}

          {/* Core Parsing Result Preview Layout */}
          {isParsing && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
              <div className="relative flex items-center justify-center mb-2">
                <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-indigo-400 opacity-20"></div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full relative">
                  <Database className="h-6 w-6 animate-spin" />
                </div>
              </div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">{bt.parsingText}</h3>
            </div>
          )}

          {!isParsing && !parseResult && !successMessage && !errorMessage && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center text-slate-400 space-y-3">
              <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-2" />
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">{bt.validationResults}</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                Choose a ledger type above, download the template structure, fill in your records, and upload it to run deduplication and integrity check.
              </p>
            </div>
          )}

          {parseResult && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-fade-in" id="parsed-records-view">
              
              {/* Header metrics bar */}
              <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-300 font-semibold">{bt.validationResults}</span>
                  <h3 className="text-sm font-bold truncate">Reviewing {parseResult.records.length} records</h3>
                </div>

                <div className="flex gap-4 font-mono text-[10px]">
                  <div className="text-center">
                    <span className="text-emerald-400 font-bold block text-sm">{parseResult.validationSummary.valid}</span>
                    <span className="text-slate-400 text-[8px] uppercase">Valid / New</span>
                  </div>
                  <div className="text-center">
                    <span className="text-yellow-400 font-bold block text-sm">{parseResult.validationSummary.duplicate}</span>
                    <span className="text-slate-400 text-[8px] uppercase">Skip Duplicates</span>
                  </div>
                  <div className="text-center">
                    <span className="text-red-400 font-bold block text-sm">{parseResult.validationSummary.invalid}</span>
                    <span className="text-slate-400 text-[8px] uppercase">Parsing Failures</span>
                  </div>
                </div>
              </div>

              {/* Warnings and issues checklist first */}
              {parseResult.validationSummary.invalid > 0 && (
                <div className="bg-amber-50 border-y border-amber-200 p-4 flex gap-2.5 text-xs text-amber-800">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Parsing issues found ({parseResult.validationSummary.invalid} rows)</span>
                    <p className="mt-1 leading-relaxed opacity-95">
                      Rows with validation issues cannot be locked and synced. Please fix the columns in your file and re-upload. Remaining valid rows can still be imported.
                    </p>
                  </div>
                </div>
              )}

              {/* Spreadsheet records visualizer */}
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-mono tracking-wider uppercase font-extrabold">
                      <th className="py-2.5 px-4 text-center">Row</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Parsing details / Errors</th>
                      <th className="py-2.5 px-4">Raw Data Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {parseResult.records.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-center font-mono text-[10px] text-slate-500">{row.rowNumber}</td>
                        <td className="py-2.5 px-4 text-center">
                          {row.status === 'Valid' && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded text-[9px] font-bold tracking-wide uppercase">
                              Valid
                            </span>
                          )}
                          {row.status === 'Duplicate' && (
                            <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-800 border border-yellow-150 rounded text-[9px] font-bold tracking-wide uppercase">
                              Duplicate
                            </span>
                          )}
                          {row.status === 'Invalid' && (
                            <span className="px-1.5 py-0.5 bg-red-50 text-red-800 border border-red-150 rounded text-[9px] font-bold tracking-wide uppercase">
                              Fail
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 align-top max-w-[240px]">
                          {row.errors.length > 0 && (
                            <div className="text-red-600 space-y-0.5 font-semibold leading-tight mb-1">
                              {row.errors.map((e, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <span className="h-1 w-1 bg-red-600 rounded-full shrink-0"></span>
                                  {e}
                                </div>
                              ))}
                            </div>
                          )}
                          {row.details.length > 0 && (
                            <div className="text-slate-500 text-[10px] leading-tight font-mono whitespace-pre-wrap">
                              {row.details.map((d, idx) => (
                                <div key={idx}>{d}</div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="max-w-[300px] truncate font-mono text-[10px] text-slate-400">
                            {JSON.stringify(row.record)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Execution Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {bt.readyToSync}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setFileName('');
                      setCsvText('');
                    }}
                    className="px-3 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold rounded-lg"
                  >
                    {t?.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={handleCommit}
                    disabled={parseResult.validationSummary.valid === 0 || isCommiting}
                    className={`flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg font-mono tracking-wide ${
                      (parseResult.validationSummary.valid === 0 || isCommiting) && 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {isCommiting ? (
                      <>{currentLanguage === 'hi' ? 'सहेज रहा है...' : currentLanguage === 'mr' ? 'जतन करत आहे...' : currentLanguage === 'gu' ? 'સેવ થાય છે...' : currentLanguage === 'te' ? 'భద్రపరుస్తోంది...' : currentLanguage === 'bn' ? 'সংরक्षण করা হচ্ছে...' : 'Syncing...'}</>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        {bt.commitBtn}
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
