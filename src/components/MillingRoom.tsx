import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Shovel,
  Check,
  Scale,
  CircleAlert,
  AlertTriangle,
  History,
  Sparkles,
  ArrowRight,
  Package,
  Layers,
  Calculator,
  Info,
  CheckCircle2,
  Wheat
} from 'lucide-react';
import { FoodRecipe, Inventory } from '../types';
import { translations, Language } from '../translations';
import { useFarm } from '../context/FarmContext';
import { recipeService, inventoryService } from '../lib/dataService';

interface RecipeLineItem {
  IngredientId: string;
  Percentage: number;
}

// Multilingual labels for ultra-clear and farmer-friendly UX
const millingText: Record<Language, {
  tabProduce: string;
  tabRecipes: string;
  tabHistory: string;
  quickProduceTitle: string;
  quickProduceSub: string;
  selectRecipe: string;
  chooseRecipePlaceholder: string;
  batchQtyKg: string;
  batchQtyBags: string;
  bagsNote: string;
  liveStockTitle: string;
  ingredient: string;
  formulaPct: string;
  requiredQty: string;
  availableStock: string;
  stockStatus: string;
  sufficient: string;
  shortage: string;
  unitCost: string;
  lineCost: string;
  estTotalCost: string;
  costPerKg: string;
  costPerBag: string;
  targetFeedNotice: string;
  produceBtn: string;
  producing: string;
  newFormulaBtn: string;
  formulaTemplates: string;
  templateLayer: string;
  templateStarter: string;
  templateFinisher: string;
  templateGrower: string;
  formulaName: string;
  formulaNamePlaceholder: string;
  targetFeedOptAuto: string;
  targetFeedOptSelect: string;
  targetFeedSelectPlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
  ingredientsSection: string;
  addIngredientBtn: string;
  chooseIngredientPlaceholder: string;
  pctLabel: string;
  balanceLabel: string;
  balanceOk: string;
  balanceNotOk: string;
  saveFormulaBtn: string;
  cancelBtn: string;
  historyTitle: string;
  historySub: string;
  milledDate: string;
  batchRecipe: string;
  outputProduct: string;
  totalProduced: string;
  totalCostLabel: string;
  statusLabel: string;
  storedInStock: string;
  noRecipesYet: string;
  createFirstRecipe: string;
  produceNowBtn: string;
  autoInventoryNotice: string;
}> = {
  mr: {
    tabProduce: '🥣 थेट खाद्य उत्पादन (Produce)',
    tabRecipes: '📋 खाद्य फॉर्म्युले (Recipes)',
    tabHistory: '📜 उत्पादन नोंदवही (Logs)',
    quickProduceTitle: 'खाद्य तयार करा व गोदामात जमा करा',
    quickProduceSub: 'फॉर्म्युला निवडा, गोणी किंवा वजन टाका; कच्चा माल आपोआप वजा होईल आणि तयार खाद्य साठ्यात जमा होईल.',
    selectRecipe: 'खाद्य फॉर्म्युला निवडा:',
    chooseRecipePlaceholder: '-- फॉर्म्युला निवडा --',
    batchQtyKg: 'एकूण उत्पादन वजन (किलो / Kg):',
    batchQtyBags: 'किंवा गोणी संख्या (५० किलो गोणी):',
    bagsNote: '१ गोणी = ५० किलो प्रमाणे स्वयंचलित गणना',
    liveStockTitle: 'कच्च्या मालाची थेट उपलब्धता व खर्च तपासणी:',
    ingredient: 'कच्चा माल',
    formulaPct: 'प्रमाण (%)',
    requiredQty: 'आवश्यक वजन',
    availableStock: 'गोदामात शिल्लक',
    stockStatus: 'उपलब्धता स्थिती',
    sufficient: 'पर्याप्त साठा उपलब्ध',
    shortage: 'कमी पडत आहे',
    unitCost: 'खरेदी दर',
    lineCost: 'एकूण खर्च',
    estTotalCost: 'एकूण बॅच खर्च:',
    costPerKg: 'प्रति किलो खर्च:',
    costPerBag: 'प्रति गोणी (५० किलो):',
    targetFeedNotice: 'हे तयार झालेले खाद्य थेट गोदामात या नावाने साठवले जाईल:',
    produceBtn: '🥣 खाद्य तयार करा व गोदामात जमा करा',
    producing: 'खाद्य तयार होत आहे...',
    newFormulaBtn: '+ नवीन फॉर्म्युला तयार करा',
    formulaTemplates: 'तयार फॉर्म्युला नमुने (१-क्लिकवर निवडा):',
    templateLayer: '🌾 लेअर खाद्य (Layer Mash)',
    templateStarter: '🐥 ब्रॉयलर स्टार्टर (Starter)',
    templateFinisher: '🐔 ब्रॉयलर फिनिशर (Finisher)',
    templateGrower: '🌱 ग्रोव्हर खाद्य (Grower)',
    formulaName: 'फॉर्म्युला नाव:',
    formulaNamePlaceholder: 'उदा. लेअर खाद्य - फेज १ / ब्रॉयलर स्टार्टर',
    targetFeedOptAuto: 'गोदाम साठ्यात याच नावाने तयार खाद्य आयटम आपोआप बनवा (शिफारस)',
    targetFeedOptSelect: 'किंवा गोदामातील अस्तित्वात असलेला आयटम जोडा',
    targetFeedSelectPlaceholder: '-- गोदामातील खाद्य आयटम निवडा --',
    notesLabel: 'टीप किंवा पोषण माहिती (पर्यायी):',
    notesPlaceholder: 'उदा. १६% प्रोटीन, मका आणि सोया डीओसी मिश्रण...',
    ingredientsSection: 'कच्च्या मालाचे घटक व टक्केवारी (%):',
    addIngredientBtn: '+ घटक जोडा',
    chooseIngredientPlaceholder: '-- कच्चा माल निवडा --',
    pctLabel: 'टक्केवारी (%)',
    balanceLabel: 'एकूण टक्केवारी प्रमाण:',
    balanceOk: '१००% पूर्ण (अचूक बॅलन्स)',
    balanceNotOk: 'एकूण प्रमाण १००% असावे',
    saveFormulaBtn: 'फॉर्म्युला सेव्ह करा',
    cancelBtn: 'रद्द करा',
    historyTitle: 'फीड मिलिंग उत्पादन इतिहास',
    historySub: 'फार्मवर तयार केलेल्या सर्व खाद्य बॅचेसचा दिनांकनिहाय तपशील व प्रति किलो खर्च.',
    milledDate: 'तारीख व वेळ',
    batchRecipe: 'वापरलेला फॉर्म्युला',
    outputProduct: 'तयार खाद्य उत्पादन',
    totalProduced: 'तयार उत्पादन',
    totalCostLabel: 'एकूण खर्च व दर',
    statusLabel: 'स्थिती',
    storedInStock: 'गोदामात जमा',
    noRecipesYet: 'अजून कोणताही खाद्य फॉर्म्युला तयार केलेला नाही.',
    createFirstRecipe: 'नवीन फॉर्म्युला तयार करण्यासाठी येथे क्लिक करा',
    produceNowBtn: '🥣 आता बनवा',
    autoInventoryNotice: 'महत्त्वाचे: तुम्हाला गोदामात (Warehouse) जाऊन स्वतंत्र आयटम बनवण्याची गरज नाही! सिस्टीम आपोआप तयार खाद्य आयटम गोदामात रजिस्टर करेल.'
  },
  en: {
    tabProduce: '🥣 Produce Feed',
    tabRecipes: '📋 Feed Recipes',
    tabHistory: '📜 Production Logs',
    quickProduceTitle: 'Quick Batch Production & Stocking',
    quickProduceSub: 'Select a formula and batch size. Raw materials auto-deduct and finished feed is credited.',
    selectRecipe: 'Select Feed Recipe:',
    chooseRecipePlaceholder: '-- Choose Formula --',
    batchQtyKg: 'Total Batch Weight (Kg):',
    batchQtyBags: 'Or Batch Quantity (50-Kg Bags):',
    bagsNote: 'Calculated at 50 Kg per bag',
    liveStockTitle: 'Live Raw Stock & Costing Checklist:',
    ingredient: 'Raw Ingredient',
    formulaPct: 'Ratio (%)',
    requiredQty: 'Required Weight',
    availableStock: 'Warehouse Stock',
    stockStatus: 'Availability Status',
    sufficient: 'Sufficient Stock',
    shortage: 'Shortage',
    unitCost: 'Unit Cost',
    lineCost: 'Line Cost',
    estTotalCost: 'Total Batch Cost:',
    costPerKg: 'Estimated Cost / Kg:',
    costPerBag: 'Cost per 50-Kg Bag:',
    targetFeedNotice: 'Finished feed will be credited to warehouse under:',
    produceBtn: '🥣 Compound Batch & Credit to Stock',
    producing: 'Compounding in progress...',
    newFormulaBtn: '+ Create New Formula',
    formulaTemplates: 'Ready-to-use Formula Presets:',
    templateLayer: '🌾 Layer Mash',
    templateStarter: '🐥 Broiler Starter',
    templateFinisher: '🐔 Broiler Finisher',
    templateGrower: '🌱 Grower Mash',
    formulaName: 'Formula Name / Code:',
    formulaNamePlaceholder: 'e.g. Layer Mash - Phase 1 or Broiler Starter',
    targetFeedOptAuto: 'Auto-create finished feed in Warehouse Stock (Recommended)',
    targetFeedOptSelect: 'Or link to an existing warehouse feed item',
    targetFeedSelectPlaceholder: '-- Select Existing Feed Item --',
    notesLabel: 'Formula Notes / Nutritional Spec (Optional):',
    notesPlaceholder: 'e.g. 16% Crude Protein layer mash balanced with maize and soya DOC...',
    ingredientsSection: 'Formulation Ingredients & Percentage (%):',
    addIngredientBtn: '+ Add Ingredient',
    chooseIngredientPlaceholder: '-- Select Raw Ingredient --',
    pctLabel: 'Weight (%)',
    balanceLabel: 'Formulation Balance:',
    balanceOk: '100% Balanced',
    balanceNotOk: 'Total must sum exactly to 100%',
    saveFormulaBtn: 'Save Formula',
    cancelBtn: 'Cancel',
    historyTitle: 'Feed Milling Production History',
    historySub: 'Complete chronological history of compounded feed batches and unit costing.',
    milledDate: 'Date & Time',
    batchRecipe: 'Formula Used',
    outputProduct: 'Finished Product',
    totalProduced: 'Quantity Produced',
    totalCostLabel: 'Cost & Rate',
    statusLabel: 'Status',
    storedInStock: 'Stored in Stock',
    noRecipesYet: 'No feed formulas found for this farm.',
    createFirstRecipe: 'Click here to create your first formula',
    produceNowBtn: '🥣 Produce Now',
    autoInventoryNotice: 'Zero friction: No need to pre-create items in Warehouse. The system automatically creates finished feed in your stock.'
  },
  hi: {
    tabProduce: '🥣 दाना उत्पादन (Produce)',
    tabRecipes: '📋 दाना फॉर्मूला (Recipes)',
    tabHistory: '📜 उत्पादन लॉग (Logs)',
    quickProduceTitle: 'मुर्गी दाना तैयार करें और स्टॉक में जमा करें',
    quickProduceSub: 'फॉर्मूला चुनें और मात्रा दर्ज करें; कच्चा माल कट जाएगा और तैयार दाना गोदाम में जुड़ जाएगा।',
    selectRecipe: 'दाना फॉर्मूला चुनें:',
    chooseRecipePlaceholder: '-- फॉर्मूला चुनें --',
    batchQtyKg: 'कुल उत्पादन वजन (किलो / Kg):',
    batchQtyBags: 'या बोरी संख्या (५० किलो बोरी):',
    bagsNote: '१ बोरी = ५० किलो के हिसाब से गणना',
    liveStockTitle: 'कच्चे माल की उपलब्धता और लागत जांच:',
    ingredient: 'कच्चा माल',
    formulaPct: 'अनुपात (%)',
    requiredQty: 'जरूरी वजन',
    availableStock: 'गोदाम में उपलब्ध',
    stockStatus: 'उपलब्धता स्थिति',
    sufficient: 'पर्याप्त स्टॉक उपलब्ध',
    shortage: 'कमी है',
    unitCost: 'लागत दर',
    lineCost: 'कुल लागत',
    estTotalCost: 'कुल बैच लागत:',
    costPerKg: 'प्रति किलो लागत:',
    costPerBag: 'प्रति बोरी (५० किलो):',
    targetFeedNotice: 'तैयार दाना गोदाम में इस नाम से स्वतः जमा होगा:',
    produceBtn: '🥣 दाना तैयार करें और स्टॉक में जोड़ें',
    producing: 'दाना तैयार हो रहा है...',
    newFormulaBtn: '+ नया फॉर्मूला बनाएं',
    formulaTemplates: 'तैयार फॉर्मूला नमूने (१-क्लिक):',
    templateLayer: '🌾 लेयर दाना (Layer Mash)',
    templateStarter: '🐥 ब्रॉयलर स्टार्टर (Starter)',
    templateFinisher: '🐔 ब्रॉयलर फिनिशर (Finisher)',
    templateGrower: '🌱 ग्रोवर दाना (Grower)',
    formulaName: 'फॉर्मूला नाम:',
    formulaNamePlaceholder: 'उदा. लेयर मैश - फेज १ / ब्रॉयलर स्टार्टर',
    targetFeedOptAuto: 'गोदाम में इसी नाम से तैयार दाना अपने-आप बनाएं (अनुशंसित)',
    targetFeedOptSelect: 'या पहले से मौजूद दाना आइटम से जोड़ें',
    targetFeedSelectPlaceholder: '-- गोदाम का दाना चुनें --',
    notesLabel: 'नोट्स / पोषण जानकारी (वैकल्पिक):',
    notesPlaceholder: 'उदा. १६% प्रोटीन मक्का और सोया डीओसी मिश्रण...',
    ingredientsSection: 'कच्चे माल के घटक और प्रतिशत (%):',
    addIngredientBtn: '+ घटक जोड़ें',
    chooseIngredientPlaceholder: '-- कच्चा माल चुनें --',
    pctLabel: 'प्रतिशत (%)',
    balanceLabel: 'कुल प्रतिशत अनुपात:',
    balanceOk: '१००% पूर्ण (संतुलित)',
    balanceNotOk: 'कुल योग १००% होना चाहिए',
    saveFormulaBtn: 'फॉर्मूला सुरक्षित करें',
    cancelBtn: 'रद्द करें',
    historyTitle: 'दाना उत्पादन इतिहास',
    historySub: 'तैयार किए गए सभी दाना बैचों का विवरण और प्रति किलो लागत।',
    milledDate: 'दिनांक और समय',
    batchRecipe: 'फॉर्मूला',
    outputProduct: 'तैयार दाना उत्पाद',
    totalProduced: 'कुल उत्पादन',
    totalCostLabel: 'कुल लागत व दर',
    statusLabel: 'स्थिति',
    storedInStock: 'स्टॉक में जमा',
    noRecipesYet: 'इस फार्म के लिए कोई फॉर्मूला उपलब्ध नहीं है।',
    createFirstRecipe: 'पहला फॉर्मूला बनाने के लिए यहाँ क्लिक करें',
    produceNowBtn: '🥣 अभी बनाएं',
    autoInventoryNotice: 'शून्य झंझट: गोदाम में पहले से आइटम बनाने की जरूरत नहीं है। सिस्टम अपने-आप आइटम बना देगा।'
  },
  gu: {
    tabProduce: '🥣 ખોરાક ઉત્પાદન (Produce)',
    tabRecipes: '📋 ખોરાક ફોર્મ્યુલા (Recipes)',
    tabHistory: '📜 ઉત્પાદન હિસાબ (Logs)',
    quickProduceTitle: 'મરઘી ખોરાક તૈયાર કરો અને સ્ટોકમાં જમા કરો',
    quickProduceSub: 'ફોર્મ્યુલા પસંદ કરો અને વજન દાખલ કરો; રો-મટીરીયલ આપોઆપ કપાશે અને તૈયાર ખોરાક સ્ટોકમાં જમા થશે.',
    selectRecipe: 'ખોરાક ફોર્મ્યુલા પસંદ કરો:',
    chooseRecipePlaceholder: '-- ફોર્મ્યુલા પસંદ કરો --',
    batchQtyKg: 'કુલ ઉત્પાદન વજન (કિલો / Kg):',
    batchQtyBags: 'અથવા ગુણી સંખ્યા (૫૦ કિલો ગુણી):',
    bagsNote: '૧ ગુણી = ૫૦ કિલો મુજબ ગણતરી',
    liveStockTitle: 'કાચો માલ ઉપલબ્ધતા અને ખર્ચ તપાસ:',
    ingredient: 'કાચો માલ',
    formulaPct: 'પ્રમાણ (%)',
    requiredQty: 'જરૂરી વજન',
    availableStock: 'ગોડાઉનમાં ઉપલબ્ધ',
    stockStatus: 'સ્થિતિ',
    sufficient: 'પૂરતો સ્ટોક ઉપલબ્ધ',
    shortage: 'ઓછો પડી રહ્યો છે',
    unitCost: 'ખરીદી ભાવ',
    lineCost: 'કુલ ખર્ચ',
    estTotalCost: 'કુલ બેચ ખર્ચ:',
    costPerKg: 'પ્રતિ કિલો ખર્ચ:',
    costPerBag: 'પ્રતિ ૫૦ કિલો ગુણી:',
    targetFeedNotice: 'તૈયાર થયેલ ખોરાક ગોડાઉનમાં આ નામે જમા થશે:',
    produceBtn: '🥣 ખોરાક મિક્સ કરો અને સ્ટોક વધારો',
    producing: 'તૈયાર થઈ રહ્યું છે...',
    newFormulaBtn: '+ નવો ફોર્મ્યુલા બનાવો',
    formulaTemplates: 'તૈયાર ફોર્મ્યુલા નમૂના:',
    templateLayer: '🌾 લેયર ખોરાક',
    templateStarter: '🐥 બ્રોયલર સ્ટાર્ટર',
    templateFinisher: '🐔 બ્રોયલર ફિનિશર',
    templateGrower: '🌱 ગ્રોવર ખોરાક',
    formulaName: 'ફોર્મ્યુલા નામ:',
    formulaNamePlaceholder: 'દા.ત. લેયર મેશ - ફેઝ ૧',
    targetFeedOptAuto: 'ગોડાઉન સ્ટોકમાં આપોઆપ આ નામથી આઈટમ બનાવો',
    targetFeedOptSelect: 'અથવા અગાઉની આઈટમ લિંક કરો',
    targetFeedSelectPlaceholder: '-- ગોડાઉન આઈટમ પસંદ કરો --',
    notesLabel: 'વિગત:',
    notesPlaceholder: 'પોષણ માહિતી...',
    ingredientsSection: 'કાચા માલના ઘટકો અને ટકાવારી (%):',
    addIngredientBtn: '+ ઘટક ઉમેરો',
    chooseIngredientPlaceholder: '-- કાચો માલ પસંદ કરો --',
    pctLabel: 'ટકા (%)',
    balanceLabel: 'કુલ ટકાવારી:',
    balanceOk: '૧૦૦% સંતુલિત',
    balanceNotOk: 'સરવાળો ૧૦૦% થવો જોઈએ',
    saveFormulaBtn: 'સેવ કરો',
    cancelBtn: 'રદ કરો',
    historyTitle: 'ઉત્પાદન ઇતિહાસ',
    historySub: 'બનાવેલ ખોરાક બેચનું વિવરણ.',
    milledDate: 'તારીખ',
    batchRecipe: 'ફોર્મ્યુલા',
    outputProduct: 'તૈયાર પ્રોડક્ટ',
    totalProduced: 'ઉત્પાદન',
    totalCostLabel: 'ખર્ચ',
    statusLabel: 'સ્થિતિ',
    storedInStock: 'સ્ટોકમાં જમા',
    noRecipesYet: 'કોઈ ફોર્મ્યુલા મળ્યો નથી.',
    createFirstRecipe: 'પ્રથમ ફોર્મ્યુલા બનાવવા અહીં ક્લિક કરો',
    produceNowBtn: '🥣 હવે બનાવો',
    autoInventoryNotice: 'સરળ પદ્ધતિ: ગોડાઉનમાં અગાઉથી આઈટમ બનાવવાની જરૂર નથી.'
  },
  te: {
    tabProduce: '🥣 మేత తయారీ (Produce)',
    tabRecipes: '📋 మేత ఫార్ములాలు (Recipes)',
    tabHistory: '📜 ఉత్పత్తి రికార్డులు (Logs)',
    quickProduceTitle: 'కోళ్ళ మేత తయారీ మరియు స్టాక్ నమోదు',
    quickProduceSub: 'ఫార్ములా ఎంచుకోండి, బ్యాచ్ సైజ్ నమోదు చేయండి; రా మెటీరియల్ తగ్గింపు మరియు తుది మేత స్టాక్‌లో కలుస్తుంది.',
    selectRecipe: 'మేత ఫార్ములా ఎంచుకోండి:',
    chooseRecipePlaceholder: '-- ఫార్ములా ఎంచుకోండి --',
    batchQtyKg: 'మొత్తం బరువు (కేజీలు / Kg):',
    batchQtyBags: 'లేదా సంచుల సంఖ్య (50 కేజీల బస్తా):',
    bagsNote: '1 బస్తా = 50 కేజీలు',
    liveStockTitle: 'రా మెటీరియల్ లభ్యత మరియు ఖర్చుల జాబితా:',
    ingredient: 'ముడి సరుకు',
    formulaPct: 'నిష్పత్తి (%)',
    requiredQty: 'కావలసిన బరువు',
    availableStock: 'గోదాములో ఉన్నది',
    stockStatus: 'లభ్యత',
    sufficient: 'సరిపడా ఉంది',
    shortage: 'తక్కువగా ఉంది',
    unitCost: 'యూనిట్ ధర',
    lineCost: 'మొత్తం ఖర్చు',
    estTotalCost: 'మొత్తం బ్యాచ్ ఖర్చు:',
    costPerKg: 'కేజీ ఖర్చు:',
    costPerBag: 'బస్తా ఖర్చు:',
    targetFeedNotice: 'తయారైన మేత నేరుగా గోదాములో ఈ పేరుతో నిల్వ చేయబడుతుంది:',
    produceBtn: '🥣 మేత తయారు చేసి గోదాములో చేర్చండి',
    producing: 'మేత తయారవుతోంది...',
    newFormulaBtn: '+ కొత్త ఫార్ములా',
    formulaTemplates: 'రెడీమేడ్ ఫార్ములాలు:',
    templateLayer: '🌾 లేయర్ మేత',
    templateStarter: '🐥 బ్రాయిలర్ స్టార్టర్',
    templateFinisher: '🐔 బ్రాయిలర్ ఫినిషర్',
    templateGrower: '🌱 గ్రోవర్ మేత',
    formulaName: 'ఫార్ములా పేరు:',
    formulaNamePlaceholder: 'ఉదా. లేయర్ మేష్ - ఫేజ్ 1',
    targetFeedOptAuto: 'గోదాము స్టాక్‌లో స్వయంచాలకంగా ఈ పేరుతో ఫీడ్ ఐటమ్‌ను సృష్టించండి',
    targetFeedOptSelect: 'లేదా ఇప్పటికే ఉన్న ఐటమ్‌ను లింక్ చేయండి',
    targetFeedSelectPlaceholder: '-- ఐటమ్ ఎంచుకోండి --',
    notesLabel: 'వివరాలు:',
    notesPlaceholder: 'పోషకాహార సమాచారం...',
    ingredientsSection: 'దినుసులు మరియు శాతం (%):',
    addIngredientBtn: '+ దినుసు జోడించండి',
    chooseIngredientPlaceholder: '-- దినుసు ఎంచుకోండి --',
    pctLabel: 'శాతం (%)',
    balanceLabel: 'మొత్తం నిష్పత్తి:',
    balanceOk: '100% సరిపోయింది',
    balanceNotOk: 'మొత్తం 100% ఉండాలి',
    saveFormulaBtn: 'సేవ్ చేయండి',
    cancelBtn: 'రద్దు చేయండి',
    historyTitle: 'ఉత్పత్తి చరిత్ర',
    historySub: 'తయారు చేసిన మేత బ్యాచ్‌ల రికార్డులు.',
    milledDate: 'తేదీ',
    batchRecipe: 'ఫార్ములా',
    outputProduct: 'తుది మేత',
    totalProduced: 'పరిమాణం',
    totalCostLabel: 'ఖర్చు',
    statusLabel: 'స్థితి',
    storedInStock: 'గోదాములో చేరింది',
    noRecipesYet: 'ఫార్ములాలు లేవు.',
    createFirstRecipe: 'మొదటి ఫార్ములా తయారు చేయండి',
    produceNowBtn: '🥣 తయారు చేయండి',
    autoInventoryNotice: 'సులభమైన విధానం: ముందే గోదాములో నమోదు చేయవలసిన పనిలేదు.'
  },
  bn: {
    tabProduce: '🥣 খাবার উৎপাদন (Produce)',
    tabRecipes: '📋 খাদ্য ফর্মুলা (Recipes)',
    tabHistory: '📜 উৎপাদন ইতিহাস (Logs)',
    quickProduceTitle: 'মুরগির সুষম খাবার তৈরি ও গুদামে সংরক্ষণ',
    quickProduceSub: 'ফর্মুলা ও পরিমাণ নির্বাচন করুন; কাঁচামাল স্বয়ংক্রিয়ভাবে কমে যাবে ও তৈরি খাবার যুক্ত হবে।',
    selectRecipe: 'খাদ্য ফর্মুলা নির্বাচন করুন:',
    chooseRecipePlaceholder: '-- ফর্মুলা নির্বাচন করুন --',
    batchQtyKg: 'মোট ওজন (কেজি / Kg):',
    batchQtyBags: 'অথবা বস্তা সংখ্যা (৫০ কেজি বস্তা):',
    bagsNote: '১ বস্তা = ৫০ কেজি হিসেবে হিসাব',
    liveStockTitle: 'কাঁচামাল প্রাপ্যতা ও খরচ পর্যালোচনা:',
    ingredient: 'কাঁচামাল',
    formulaPct: 'অনুপাত (%)',
    requiredQty: 'প্রয়োজনীয় ওজন',
    availableStock: 'গুদামে মজুত',
    stockStatus: 'অবস্থা',
    sufficient: 'পর্যাপ্ত মজুত আছে',
    shortage: 'কম আছে',
    unitCost: 'ক্রয়মূল্য',
    lineCost: 'মোট খরচ',
    estTotalCost: 'মোট ব্যাচ খরচ:',
    costPerKg: 'প্রতি কেজি খরচ:',
    costPerBag: 'প্রতি ৫০ কেজি বস্তা:',
    targetFeedNotice: 'তৈরি খাদ্য স্বয়ংক্রিয়ভাবে গুদামে এই নামে সংরক্ষিত হবে:',
    produceBtn: '🥣 খাদ্য প্রস্তুত ও মজুতে জমা করুন',
    producing: 'খাবার তৈরি হচ্ছে...',
    newFormulaBtn: '+ নতুন ফর্মুলা তৈরি করুন',
    formulaTemplates: 'রেডিমেড ফর্মুলা টেমপ্লেট:',
    templateLayer: '🌾 লেয়ার খাবার',
    templateStarter: '🐥 ব্রয়লার স্টার্টার',
    templateFinisher: '🐔 ব্রয়লার ফিনিশার',
    templateGrower: '🌱 গ্রোয়ার খাবার',
    formulaName: 'ফর্মুলা নাম:',
    formulaNamePlaceholder: 'যেমন: লেয়ার ম্যাশ - ফেজ ১',
    targetFeedOptAuto: 'গুদাম স্টকে স্বয়ংক্রিয়ভাবে এই নামে খাদ্য তৈরি করুন',
    targetFeedOptSelect: 'অথবা বিদ্যমান খাদ্য আইটেম সংযুক্ত করুন',
    targetFeedSelectPlaceholder: '-- খাদ্য আইটেম বাছুন --',
    notesLabel: 'বিবরণ:',
    notesPlaceholder: 'পুষ্টি সংক্রান্ত তথ্য...',
    ingredientsSection: 'উপাদান ও শতকরা হার (%):',
    addIngredientBtn: '+ উপাদান যোগ করুন',
    chooseIngredientPlaceholder: '-- উপাদান নির্বাচন করুন --',
    pctLabel: 'শতকরা (%)',
    balanceLabel: 'অনুপাত ব্যালেন্স:',
    balanceOk: '১০০% সঠিক',
    balanceNotOk: 'যোগফল ১০০% হতে হবে',
    saveFormulaBtn: 'ফর্মুলা সেভ করুন',
    cancelBtn: 'বাতিল করুন',
    historyTitle: 'খাদ্য উৎপাদন হিসেব',
    historySub: 'খামারে তৈরি করা খাবারের ব্যাচ বিবরণী।',
    milledDate: 'তারিখ',
    batchRecipe: 'ফর্মুলা',
    outputProduct: 'তৈরি খাদ্য',
    totalProduced: 'পরিমাণ',
    totalCostLabel: 'খরচ',
    statusLabel: 'অবস্থা',
    storedInStock: 'গুদামে জমা',
    noRecipesYet: 'কোনো ফর্মুলা নেই।',
    createFirstRecipe: 'প্রথম ফর্মুলা তৈরি করুন',
    produceNowBtn: '🥣 প্রস্তুত করুন',
    autoInventoryNotice: 'সহজ পদ্ধতি: গুদামে আগে থেকে আইটেম তৈরি করার প্রয়োজন নেই।'
  }
};

export default function MillingRoom({ currentLanguage = 'mr' }: { currentLanguage?: Language }) {
  const mt = millingText[currentLanguage] || millingText['en'];
  const t = translations[currentLanguage];
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.Id || 1;

  // Active Tab: 'produce' | 'recipes' | 'history'
  const [activeTab, setActiveTab] = useState<'produce' | 'recipes' | 'history'>('produce');

  // Core Data
  const [recipes, setRecipes] = useState<any[]>([]);
  const [feeds, setFeeds] = useState<Inventory[]>([]);
  const [allInventories, setAllInventories] = useState<Inventory[]>([]);
  const [productionLogs, setProductionLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab 1 (Quick Batch Production) state
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [batchQuantityKg, setBatchQuantityKg] = useState<number>(1000);
  const [batchBags, setBatchBags] = useState<number>(20);
  const [producing, setProducing] = useState(false);
  const [productionSuccess, setProductionSuccess] = useState<any | null>(null);
  const [productionError, setProductionError] = useState<string | null>(null);

  // Tab 2 (Recipe Creation) state
  const [showAddForm, setShowAddForm] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [targetFeedOption, setTargetFeedOption] = useState<'auto' | 'existing'>('auto');
  const [selectedTargetFeedId, setSelectedTargetFeedId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<RecipeLineItem[]>([
    { IngredientId: '', Percentage: 55 },
    { IngredientId: '', Percentage: 25 },
    { IngredientId: '', Percentage: 10 },
    { IngredientId: '', Percentage: 10 }
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  useEffect(() => {
    fetchData();
  }, [farmId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setProductionError(null);

      // 1. Recipes
      const rData = await recipeService.getRecipes(farmId);
      setRecipes(rData || []);

      if (rData && rData.length > 0 && !selectedRecipeId) {
        setSelectedRecipeId(rData[0].Id);
      }

      // 2. Inventories
      const iData = await inventoryService.getInventories(farmId);
      setAllInventories(iData || []);
      setFeeds((iData || []).filter((i: Inventory) => i.Category === 'Feed'));

      // 3. Production Logs
      const logs = await recipeService.getProductionLogs(farmId);
      setProductionLogs(logs || []);
    } catch (e: any) {
      console.error('[MillingRoom.fetchData] Error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Quantity sync between Kg and Bags (50 Kg standard bags)
  const handleKgChange = (val: number) => {
    setBatchQuantityKg(val);
    setBatchBags(Math.round((val / 50) * 10) / 10);
  };

  const handleBagsChange = (val: number) => {
    setBatchBags(val);
    setBatchQuantityKg(val * 50);
  };

  // Selected recipe object
  const activeRecipe = recipes.find((r) => r.Id === selectedRecipeId) || recipes[0] || null;

  // Calculate live ingredient requirements, stock availability, and costs for active recipe & batch quantity
  const calculateBatchLiveStock = () => {
    if (!activeRecipe) return { lines: [], hasShortage: false, totalCost: 0, costPerKg: 0, costPerBag: 0 };

    const ings = activeRecipe.Ingredients || activeRecipe.ingredients || [];
    let totalCost = 0;
    let hasShortage = false;

    const lines = ings.map((ing: any) => {
      const inv = allInventories.find((i) => i.Id === (ing.InventoryId || ing.IngredientId));
      const neededKg = (batchQuantityKg * (Number(ing.Percentage) || 0)) / 100;
      const currentStock = Number(inv?.CurrentStock) || 0;
      const unitPrice = Number(inv?.UnitPrice) || Number(inv?.AverageLandedCost) || 0;
      const lineCost = neededKg * unitPrice;
      totalCost += lineCost;

      const isShort = currentStock < neededKg;
      if (isShort) hasShortage = true;

      return {
        id: ing.Id || ing.InventoryId,
        itemName: ing.IngredientName || inv?.ItemName || `Ingredient #${ing.InventoryId}`,
        percentage: ing.Percentage,
        neededKg,
        currentStock,
        unitPrice,
        lineCost,
        isShort,
        shortageKg: isShort ? neededKg - currentStock : 0
      };
    });

    const costPerKg = batchQuantityKg > 0 ? totalCost / batchQuantityKg : 0;
    const costPerBag = costPerKg * 50;

    return {
      lines,
      hasShortage,
      totalCost,
      costPerKg,
      costPerBag
    };
  };

  const batchStockCheck = calculateBatchLiveStock();

  // Execute Quick Milling Batch
  const handleExecuteBatch = async () => {
    if (!activeRecipe) {
      setProductionError('Please select a formula first.');
      return;
    }
    if (batchQuantityKg <= 0) {
      setProductionError('Please enter a valid batch quantity greater than 0.');
      return;
    }

    if (batchStockCheck.hasShortage) {
      const shortItems = batchStockCheck.lines
        .filter((l) => l.isShort)
        .map((l) => `${l.itemName} (${l.shortageKg.toFixed(1)} Kg shortage)`)
        .join(', ');
      setProductionError(`कच्चा माल अपुरा आहे (Insufficient Stock): ${shortItems}. कृपया आधी खरेदी किंवा स्टॉक अपडेट करा.`);
      return;
    }

    try {
      setProducing(true);
      setProductionError(null);
      setProductionSuccess(null);

      const res = await recipeService.executeMill(
        farmId,
        activeRecipe.Id,
        batchQuantityKg,
        `Produced batch: ${batchQuantityKg} Kg (${batchBags} Bags) using ${activeRecipe.RecipeName}`
      );

      setProductionSuccess({
        message: res.message || 'Batch produced successfully!',
        recipeName: activeRecipe.RecipeName,
        targetItemName: activeRecipe.TargetItemName || activeRecipe.RecipeName,
        quantityKg: batchQuantityKg,
        bags: batchBags,
        totalCost: batchStockCheck.totalCost,
        costPerKg: batchStockCheck.costPerKg
      });

      // Refresh data
      await fetchData();
    } catch (e: any) {
      console.error('[handleExecuteBatch] Error:', e.message);
      setProductionError(e.message || 'Failed to compound batch.');
    } finally {
      setProducing(false);
    }
  };

  // Preset Template loader for 1-click recipe formulation
  const loadTemplate = (type: 'layer' | 'starter' | 'finisher' | 'grower') => {
    const findInvId = (query: string) => {
      const match = allInventories.find((i) =>
        i.ItemName.toLowerCase().includes(query.toLowerCase())
      );
      return match ? String(match.Id) : '';
    };

    const maizeId = findInvId('maize') || findInvId('corn') || findInvId('मका') || '';
    const soyaId = findInvId('soya') || findInvId('doc') || findInvId('सोया') || '';
    const dorbId = findInvId('dorb') || findInvId('bran') || findInvId('कोंडा') || '';
    const mineralId = findInvId('premix') || findInvId('mineral') || findInvId('मिनरल') || '';
    const shellGritId = findInvId('grit') || findInvId('shell') || findInvId('calcium') || '';

    if (type === 'layer') {
      setRecipeName('Layer Mash - Phase 1');
      setDescription('16% Crude Protein balanced layer feed with calcium grit for high egg laying rates.');
      setItems([
        { IngredientId: maizeId, Percentage: 55 },
        { IngredientId: soyaId, Percentage: 22 },
        { IngredientId: dorbId, Percentage: 11 },
        { IngredientId: shellGritId || mineralId, Percentage: 8 },
        { IngredientId: mineralId, Percentage: 4 }
      ]);
    } else if (type === 'starter') {
      setRecipeName('Broiler Starter Feed');
      setDescription('22% High-protein broiler starter mash for rapid early chick development.');
      setItems([
        { IngredientId: maizeId, Percentage: 58 },
        { IngredientId: soyaId, Percentage: 35 },
        { IngredientId: dorbId, Percentage: 2 },
        { IngredientId: mineralId, Percentage: 5 }
      ]);
    } else if (type === 'finisher') {
      setRecipeName('Broiler Finisher Feed');
      setDescription('19% Energy-rich broiler finisher mash for optimum weight gain.');
      setItems([
        { IngredientId: maizeId, Percentage: 62 },
        { IngredientId: soyaId, Percentage: 28 },
        { IngredientId: dorbId, Percentage: 4 },
        { IngredientId: mineralId, Percentage: 6 }
      ]);
    } else if (type === 'grower') {
      setRecipeName('Grower Pullet Mash');
      setDescription('Balanced 15% protein grower formula for healthy skeletal pullet growth.');
      setItems([
        { IngredientId: maizeId, Percentage: 52 },
        { IngredientId: soyaId, Percentage: 20 },
        { IngredientId: dorbId, Percentage: 20 },
        { IngredientId: mineralId, Percentage: 8 }
      ]);
    }
  };

  // Recipe formulation row manipulation
  const handleAddItemRow = () => {
    setItems([...items, { IngredientId: '', Percentage: 10 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalPercentage = items.reduce((sum, it) => sum + (Number(it.Percentage) || 0), 0);

  // Submit Recipe Creation
  const handleSubmitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPercentage !== 100) {
      alert(`घटकांची एकूण टक्केवारी बरोबर १००% असावी. सध्या: ${totalPercentage}%`);
      return;
    }
    if (!recipeName.trim()) {
      alert('कृपया फॉर्म्युला नाव टाका.');
      return;
    }

    const emptyIngredients = items.some((it) => !it.IngredientId);
    if (emptyIngredients) {
      alert('कृपया सर्व ओळींमध्ये कच्चा माल निवडा किंवा नको असलेली ओळ काढून टाका.');
      return;
    }

    try {
      setSavingRecipe(true);
      const targetId = targetFeedOption === 'existing' && selectedTargetFeedId ? parseInt(selectedTargetFeedId) : undefined;

      const formattedIngredients = items.map((it) => ({
        InventoryId: parseInt(it.IngredientId),
        Percentage: Number(it.Percentage)
      }));

      await recipeService.createRecipe(
        farmId,
        {
          RecipeName: recipeName.trim(),
          BatchSizeKg: 1000,
          TargetFeedItemId: targetId,
          Notes: description.trim()
        },
        formattedIngredients
      );

      setShowAddForm(false);
      setRecipeName('');
      setDescription('');
      setSelectedTargetFeedId('');
      setTargetFeedOption('auto');
      await fetchData();
      setActiveTab('recipes');
    } catch (err: any) {
      console.error('[handleSubmitRecipe] Error:', err.message);
      alert(err.message || 'Failed to save recipe.');
    } finally {
      setSavingRecipe(false);
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = async (recipeId: number) => {
    if (!confirm('हा फॉर्म्युला कायमचा हटवायचा आहे का?')) return;
    try {
      await recipeService.deleteRecipe(farmId, recipeId);
      await fetchData();
    } catch (e: any) {
      console.error('[handleDeleteRecipe] Error:', e.message);
      alert('Failed to delete recipe.');
    }
  };

  return (
    <div className="space-y-6" id="millinghouse-module">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
              <Shovel className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                {t.millingTitle}
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                {t.millingSub}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-center">
          <button
            onClick={() => { setActiveTab('produce'); setProductionSuccess(null); setProductionError(null); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'produce'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-produce-btn"
          >
            <Wheat className="h-3.5 w-3.5 text-amber-600" />
            {mt.tabProduce}
          </button>
          <button
            onClick={() => { setActiveTab('recipes'); setShowAddForm(false); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'recipes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-recipes-btn"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            {mt.tabRecipes} ({recipes.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="tab-history-btn"
          >
            <History className="h-3.5 w-3.5 text-emerald-600" />
            {mt.tabHistory}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: QUICK BATCH PRODUCTION (थेट खाद्य उत्पादन) */}
          {/* ========================================================================= */}
          {activeTab === 'produce' && (
            <div className="space-y-6" id="quick-produce-tab">
              {/* Zero-friction Auto-Inventory Notice Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{mt.autoInventoryNotice}</span>
              </div>

              {recipes.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <Layers className="h-12 w-12 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-800">{mt.noRecipesYet}</h3>
                    <p className="text-xs text-slate-500">खाद्य बनवण्यासाठी आधी एखादा फॉर्म्युला तयार करा किंवा रेडीमेड टेम्पलेट वापरा.</p>
                  </div>
                  <button
                    onClick={() => { setActiveTab('recipes'); setShowAddForm(true); }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
                  >
                    {mt.createFirstRecipe}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Formula & Batch Size Selection */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Wheat className="h-5 w-5 text-amber-600" />
                          {mt.quickProduceTitle}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">{mt.quickProduceSub}</p>
                      </div>

                      {/* Select Formula */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 block">
                          {mt.selectRecipe}
                        </label>
                        <select
                          value={selectedRecipeId || ''}
                          onChange={(e) => {
                            setSelectedRecipeId(Number(e.target.value));
                            setProductionSuccess(null);
                            setProductionError(null);
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                          id="select-active-recipe-dropdown"
                        >
                          {recipes.map((r) => (
                            <option key={r.Id} value={r.Id}>
                              {r.RecipeName} {r.TargetItemName ? `(➡️ ${r.TargetItemName})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dual Batch Quantity Input (Kg and 50-Kg Bags) */}
                      <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Calculator className="h-4 w-4 text-slate-500" />
                            उत्पादन प्रमाण (Batch Size):
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{mt.bagsNote}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              {mt.batchQtyKg}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={1}
                                step={10}
                                value={batchQuantityKg}
                                onChange={(e) => handleKgChange(parseFloat(e.target.value) || 0)}
                                className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-900"
                                id="input-batch-kg"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 font-semibold">Kg</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                              {mt.batchQtyBags}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={0.1}
                                step={0.5}
                                value={batchBags}
                                onChange={(e) => handleBagsChange(parseFloat(e.target.value) || 0)}
                                className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-indigo-900"
                                id="input-batch-bags"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs text-indigo-400 font-semibold">Bags</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Target Feed Credit Destination Note */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-amber-700 shrink-0" />
                          {mt.targetFeedNotice}
                        </div>
                        <div className="font-bold font-mono text-sm text-amber-950 pl-5">
                          {activeRecipe?.TargetItemName || activeRecipe?.RecipeName}
                        </div>
                      </div>

                      {/* Error Banner */}
                      {productionError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{productionError}</span>
                        </div>
                      )}

                      {/* Success Banner */}
                      {productionSuccess && (
                        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            खाद्य उत्पादन यशस्वीरित्या पूर्ण झाले!
                          </div>
                          <div className="text-xs text-emerald-800 space-y-1 pl-7 font-mono">
                            <div>• उत्पादित खाद्य: <b>{productionSuccess.quantityKg} Kg</b> ({productionSuccess.bags} गोण्या)</div>
                            <div>• जमा केलेला आयटम: <b>{productionSuccess.targetItemName}</b></div>
                            <div>• एकूण बॅच खर्च: <b>₹{productionSuccess.totalCost.toFixed(2)}</b> (₹{productionSuccess.costPerKg.toFixed(2)}/Kg)</div>
                          </div>
                        </div>
                      )}

                      {/* Big Action Button */}
                      <button
                        onClick={handleExecuteBatch}
                        disabled={producing || batchStockCheck.hasShortage}
                        className={`w-full py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                          batchStockCheck.hasShortage
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                        id="execute-produce-btn"
                      >
                        {producing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            {mt.producing}
                          </>
                        ) : (
                          <>
                            <Shovel className="h-4 w-4" />
                            {mt.produceBtn}
                          </>
                        )}
                      </button>

                      {batchStockCheck.hasShortage && (
                        <p className="text-[11px] text-rose-600 text-center font-medium">
                          ⚠️ काही घटकांचा साठा कमी असल्यामुळे आधी स्टॉक अपडेट करा.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Live Ingredient Breakdown & Costing Card */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Scale className="h-4 w-4 text-indigo-600" />
                            {mt.liveStockTitle}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            फॉर्म्युला: <b className="text-slate-800">{activeRecipe?.RecipeName}</b> ({batchQuantityKg} Kg बॅच)
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          batchStockCheck.hasShortage ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {batchStockCheck.hasShortage ? '❌ कच्चा माल अपुरा' : '✅ सर्व घटक उपलब्ध'}
                        </span>
                      </div>

                      {/* Ingredients Verification Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <th className="py-2.5 px-3">{mt.ingredient}</th>
                              <th className="py-2.5 px-2 text-center">{mt.formulaPct}</th>
                              <th className="py-2.5 px-2 text-right">{mt.requiredQty}</th>
                              <th className="py-2.5 px-2 text-right">{mt.availableStock}</th>
                              <th className="py-2.5 px-2 text-center">{mt.stockStatus}</th>
                              <th className="py-2.5 px-3 text-right">{mt.lineCost}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batchStockCheck.lines.map((line) => (
                              <tr key={line.id} className={`hover:bg-slate-50/50 ${line.isShort ? 'bg-rose-50/40' : ''}`}>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {line.itemName}
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    दर: ₹{line.unitPrice.toFixed(2)}/Kg
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700">
                                  {line.percentage}%
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                                  {line.neededKg.toFixed(1)} Kg
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                                  {line.currentStock.toFixed(1)} Kg
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  {line.isShort ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md">
                                      ❌ -{line.shortageKg.toFixed(1)} Kg
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                                      <Check className="h-3 w-3" /> {mt.sufficient}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  ₹{line.lineCost.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Live Costing Summary Card */}
                      <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{mt.estTotalCost}</span>
                          <span className="text-lg font-bold font-mono text-emerald-400">
                            ₹{batchStockCheck.totalCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">{mt.costPerKg}</span>
                            <span className="font-bold font-mono text-slate-200 text-sm">
                              ₹{batchStockCheck.costPerKg.toFixed(2)} / Kg
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">{mt.costPerBag}</span>
                            <span className="font-bold font-mono text-amber-400 text-sm">
                              ₹{batchStockCheck.costPerBag.toFixed(2)} / Bag
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: RECIPES MANAGEMENT & CREATION (खाद्य फॉर्म्युले) */}
          {/* ========================================================================= */}
          {activeTab === 'recipes' && (
            <div className="space-y-6" id="recipes-tab">
              {/* Header Bar with New Formula Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-indigo-600" />
                    फार्मवरील खाद्य फॉर्म्युले (Formulations)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    खाद्य तयार करण्यासाठी फॉर्म्युला जोडा किंवा बदला. सिस्टीम आपोआप गोदामात तयार खाद्य तयार करेल.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shrink-0"
                  id="toggle-add-recipe-form-btn"
                >
                  <Plus className="h-4 w-4" />
                  {mt.newFormulaBtn}
                </button>
              </div>

              {/* Recipe Creation Form */}
              {showAddForm && (
                <form
                  onSubmit={handleSubmitRecipe}
                  className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-6"
                  id="create-recipe-form"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      नवीन खाद्य फॉर्म्युला तयार करा
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">फार्म #{farmId}</span>
                  </div>

                  {/* 1-Click Quick Presets */}
                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/70 space-y-2">
                    <span className="text-xs font-bold text-amber-900 block">
                      {mt.formulaTemplates}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadTemplate('layer')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateLayer}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('starter')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateStarter}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('finisher')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateFinisher}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadTemplate('grower')}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold transition-all"
                      >
                        {mt.templateGrower}
                      </button>
                    </div>
                  </div>

                  {/* Basic Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {mt.formulaName} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={mt.formulaNamePlaceholder}
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                        id="recipe-name-input"
                      />
                    </div>

                    {/* Target Product Selection / Auto-create Toggle */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        गोदाम स्टॉक लिंकेज (Inventory Output):
                      </label>
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="targetFeedOpt"
                            checked={targetFeedOption === 'auto'}
                            onChange={() => setTargetFeedOption('auto')}
                            className="text-slate-900 focus:ring-slate-900"
                          />
                          <span className="font-semibold text-emerald-800">
                            {mt.targetFeedOptAuto}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="targetFeedOpt"
                            checked={targetFeedOption === 'existing'}
                            onChange={() => setTargetFeedOption('existing')}
                            className="text-slate-900 focus:ring-slate-900"
                          />
                          <span className="text-slate-700">{mt.targetFeedOptSelect}</span>
                        </label>
                        {targetFeedOption === 'existing' && (
                          <select
                            value={selectedTargetFeedId}
                            onChange={(e) => setSelectedTargetFeedId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="">{mt.targetFeedSelectPlaceholder}</option>
                            {feeds.map((f) => (
                              <option key={f.Id} value={f.Id}>
                                {f.ItemName} (शिल्लक: {f.CurrentStock} {f.UnitOfMeasurement})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      {mt.notesLabel}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={mt.notesPlaceholder}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  {/* Ingredients Formulation Rows */}
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center bg-slate-100/80 p-2.5 px-4 rounded-xl">
                      <h4 className="text-xs uppercase tracking-wide font-bold text-slate-700">
                        {mt.ingredientsSection}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" /> {mt.addIngredientBtn}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {items.map((line, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50/60 p-3 rounded-xl border border-slate-100"
                        >
                          <div className="sm:col-span-7 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">
                              {mt.ingredient} #{idx + 1}
                            </label>
                            <select
                              required
                              value={line.IngredientId}
                              onChange={(e) => {
                                const copy = [...items];
                                copy[idx].IngredientId = e.target.value;
                                setItems(copy);
                              }}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                            >
                              <option value="">{mt.chooseIngredientPlaceholder}</option>
                              {allInventories.map((ing) => (
                                <option key={ing.Id} value={ing.Id}>
                                  {ing.ItemName} [शिल्लक: {ing.CurrentStock} {ing.UnitOfMeasurement} | दर: ₹{ing.UnitPrice}]
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500">
                              {mt.pctLabel}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                required
                                min={0.1}
                                max={100}
                                step={0.5}
                                value={line.Percentage}
                                onChange={(e) => {
                                  const copy = [...items];
                                  copy[idx].Percentage = parseFloat(e.target.value) || 0;
                                  setItems(copy);
                                }}
                                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-xs bg-white font-mono font-bold"
                              />
                              <span className="absolute right-2.5 top-2 text-xs text-slate-400 font-semibold">%</span>
                            </div>
                          </div>

                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={items.length <= 1}
                              className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sum check and 100% progress bar */}
                    <div className="p-4 rounded-xl border bg-slate-900 text-slate-100 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">{mt.balanceLabel}</span>
                        <span className={`font-bold font-mono text-sm ${
                          totalPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {totalPercentage}% / 100% {totalPercentage === 100 ? `(${mt.balanceOk})` : `(${mt.balanceNotOk})`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            totalPercentage === 100 ? 'bg-emerald-500' : totalPercentage > 100 ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, totalPercentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                    >
                      {mt.cancelBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={savingRecipe || totalPercentage !== 100}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      id="save-recipe-submit-btn"
                    >
                      {savingRecipe ? 'सेव्ह करत आहे...' : mt.saveFormulaBtn}
                    </button>
                  </div>
                </form>
              )}

              {/* Grid of Existing Recipe Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="recipe-cards-grid">
                {recipes.map((row) => (
                  <div
                    key={row.Id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base font-display">
                            {row.RecipeName}
                          </h3>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                            गोदाम आयटम: {row.TargetItemName || row.RecipeName}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteRecipe(row.Id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Formula"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {(row.Notes || row.Description) && (
                        <p className="text-xs text-slate-500 italic">
                          {row.Notes || row.Description}
                        </p>
                      )}

                      {/* Ingredients Breakdown */}
                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          घटक प्रमाण (Ingredients):
                        </span>
                        <div className="space-y-1">
                          {(row.Ingredients || []).map((ing: any, i: number) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-xs font-mono py-1 border-b border-slate-50 last:border-0"
                            >
                              <span className="text-slate-700">
                                {ing.IngredientName || `Item #${ing.InventoryId}`}
                              </span>
                              <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                {ing.Percentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Quick Produce Button directly from Card */}
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedRecipeId(row.Id);
                          setActiveTab('produce');
                        }}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
                      >
                        <Wheat className="h-3.5 w-3.5 text-amber-400" />
                        {mt.produceNowBtn}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: PRODUCTION LOGS & HISTORY (उत्पादन नोंदवही) */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-6" id="history-tab">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-emerald-600" />
                  {mt.historyTitle}
                </h2>
                <p className="text-xs text-slate-500">{mt.historySub}</p>
              </div>

              {productionLogs.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <History className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">
                    या फार्मवर अजून कोणतेही उत्पादन नोंदवलेले नाही.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">{mt.milledDate}</th>
                          <th className="py-3 px-4">{mt.batchRecipe}</th>
                          <th className="py-3 px-4">{mt.outputProduct}</th>
                          <th className="py-3 px-4 text-right">{mt.totalProduced}</th>
                          <th className="py-3 px-4 text-right">{mt.totalCostLabel}</th>
                          <th className="py-3 px-4 text-center">{mt.statusLabel}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productionLogs.map((log: any) => (
                          <tr key={log.Id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {log.MilledAt ? new Date(log.MilledAt).toLocaleString('en-IN') : '-'}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {log.RecipeName}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {log.TargetItemName || log.RecipeName}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {log.QuantityKg} Kg
                              <span className="block text-[10px] text-slate-400 font-normal">
                                ({log.BagsProduced?.toFixed(1) || (log.QuantityKg / 50).toFixed(1)} Bags)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                              ₹{Number(log.TotalCost || 0).toFixed(2)}
                              <span className="block text-[10px] text-slate-500 font-normal">
                                (₹{Number(log.CostPerKg || 0).toFixed(2)}/Kg)
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                {mt.storedInStock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
