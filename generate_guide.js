import PDFDocument from 'pdfkit';
import fs from 'fs';

function generateDeveloperGuide() {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: false // Use sequential rendering for maximum platform compatibility
  });

  const writeStream = fs.createWriteStream('developer_guide.pdf');
  doc.pipe(writeStream);

  // Corporate palette (Forest Deep Green & Professional Charcoal/Slate Scheme)
  const colors = {
    primary: '#032e1d',    // Beautiful Deep Pine Green
    secondary: '#0a5c36',  // Forest Green Accent
    darkText: '#1e293b',   // Charcoal body text
    lightText: '#64748b',  // Muted grey text
    accentBg: '#f0fdfa',   // Soft teal bg
    border: '#cbd5e1',     // Slate border lines
    codeBg: '#1e293b',     // Premium Obsidian dark code background
    codeText: '#38bdf8'    // Electric blue code highlighting
  };

  const totalPages = 6;

  // --- COMMON DECORATIVE WORKSHOPS ---
  const applyHeaderFooter = (pageNum) => {
    // Draws Forest Green left edge margin bar
    doc.save();
    doc.rect(0, 0, 15, 842).fill(colors.primary);
    doc.restore();

    // Top Header Line
    doc.lineWidth(0.5).strokeColor('#cbd5e1').moveTo(50, 42).lineTo(545, 42).stroke();
    doc.fillColor(colors.lightText).font('Helvetica-Oblique').fontSize(7.5)
       .text('POULTRY LMS 360   |   ENTERPRISE DEPLOYMENT & DEV BLUEPRINT', 55, 30);
       
    // Bottom Footer Line
    doc.lineWidth(0.5).strokeColor('#cbd5e1').moveTo(50, 795).lineTo(545, 795).stroke();
    doc.fillColor(colors.lightText).font('Helvetica-Bold').fontSize(7.5)
       .text(`CONFIDENTIAL TECHNICAL MANUAL   |   PAGE ${pageNum} OF ${totalPages}`, 55, 802, { width: 490, align: 'right' });
    doc.font('Helvetica-Bold').text('ACID SECURE TRANSACTION SCHEMA   |   DUAL-DEPLOYMENT TARGET', 55, 802, { width: 490, align: 'left' });
  };

  const writeSectionHeader = (title, subtitle) => {
    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(14).text(title, 55, doc.y);
    if (subtitle) {
      doc.fillColor(colors.lightText).font('Helvetica-Oblique').fontSize(8.5).text(subtitle);
    }
    doc.moveDown(0.3);
    const y = doc.y;
    doc.lineWidth(1.2).strokeColor(colors.secondary).moveTo(55, y).lineTo(545, y).stroke();
    doc.moveDown(0.5);
  };

  const writeParagraph = (text) => {
    doc.fillColor(colors.darkText).font('Helvetica').fontSize(9).text(text, 55, doc.y, {
      align: 'justify',
      lineGap: 2.5
    });
    doc.moveDown(0.4);
  };

  const writeCodeBox = (lines, title = 'CODE IMPLEMENTATION BOUNDS') => {
    const boxY = doc.y;
    const height = lines.length * 11 + 16;
    
    // Draw box background
    doc.save();
    doc.rect(55, boxY, 490, height).fill(colors.codeBg);
    doc.restore();
    
    // Draw left green vertical bar
    doc.lineWidth(2.5).strokeColor(colors.secondary).moveTo(55, boxY).lineTo(55, boxY + height).stroke();
    
    // Draw text inside
    doc.fillColor('#34d399').font('Helvetica-Bold').fontSize(8).text(`[ ${title} ]`, 65, boxY + 5);
    doc.fillColor('#e2e8f0').font('Courier').fontSize(7.5);
    lines.forEach((line, index) => {
      doc.text(line, 65, boxY + 16 + (index * 11));
    });
    
    doc.y = boxY + height + 8;
  };

  const writeTable = (headers, rows, widths) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(colors.primary);
    const startY = doc.y;
    let currentY = startY;

    // Header Text Columns
    let currentX = 55;
    headers.forEach((h, i) => {
      doc.text(h, currentX + 3, currentY + 3, { width: widths[i], align: 'left' });
      currentX += widths[i];
    });

    // Divider line
    doc.lineWidth(1).strokeColor(colors.primary).moveTo(55, currentY + 14).lineTo(545, currentY + 14).stroke();
    currentY += 14;

    // Rows loops
    doc.font('Helvetica').fontSize(7.5).fillColor(colors.darkText);
    rows.forEach((row) => {
      currentX = 55;
      row.forEach((cell, i) => {
        doc.text(String(cell), currentX + 3, currentY + 3, { width: widths[i], align: 'left' });
        currentX += widths[i];
      });
      doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(55, currentY + 14).lineTo(545, currentY + 14).stroke();
      currentY += 14;
    });

    doc.y = currentY + 6;
  };


  // ==========================================
  // PAGE 1: TITLE & EXECUTIVE ARCHITECTURE SPECS
  // ==========================================
  applyHeaderFooter(1);

  doc.y = 75;
  // Dynamic App Logo Header Badge
  doc.rect(55, doc.y, 45, 45).fill(colors.primary);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('L', 65, doc.y + 10);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('360', 78, doc.y + 22);

  doc.y = 75;
  doc.x = 115;
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(24).text('POULTRY LMS 360', { characterSpacing: 0.5 });
  doc.fillColor(colors.secondary).font('Helvetica-Bold').fontSize(10).text('PROJECT ARCHITECTURE & FULL-STACK DEVELOPER MANUAL', { characterSpacing: 0.3 });
  
  doc.x = 55;
  doc.y = 135;
  doc.lineWidth(2).strokeColor(colors.secondary).moveTo(55, 128).lineTo(545, 128).stroke();

  doc.moveDown(0.6);
  writeSectionHeader('1. DOCUMENT ABSTRACT & EXEC-LEVEL SPECS', 'Core parameters and structural guidelines');
  
  writeParagraph(
    'This technical reference manual serves as the comprehensive architectural blueprint for the Poultry Lifecycle Management & Biosecurity System (Poultry LMS 360). Designed and engineered with extreme operational rigor, the application maintains dual compatibility targets: running containerized in standard modern cloud run environments (served on Port 3000), and operating as an encrypted local executable via Electron on target edge farm devices where network resources are constrained or completely offline.'
  );

  writeParagraph(
    'To guarantee biological and accounting accuracy, the software leverages transactional constraints at the database level, microsecond-accurate physical audit trailing, and dynamic translation matrices to render vernacular systems instantly.'
  );

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10.5).text('CORE LAYER REQUISITES');
  doc.moveDown(0.25);

  const techHeaders = ['LAYER / LAYER TYPE', 'TECHNOLOGY BOUND', 'SPEC VERSION', 'ARCHITECTURAL MOTIVE'];
  const techRows = [
    ['Frontend Client View', 'React Standard SPAs', '19.0.1 Hooks Engine', 'Rapid, non-blocking component state changes'],
    ['User Interface System', 'Tailwind CSS Engine', 'v4.0.0 CSS Module', 'Zero runtime CSS calculation overhead'],
    ['Biometric Charts Core', 'Recharts Vector Engine', '#3.8.1 SVG Model', 'Dynamic live rendering of performance metrics'],
    ['Server Endpoint Router', 'Express HTTP Server', 'v4.21.2 Package', 'Streamlined REST APIs and static packaging'],
    ['Local Persistence Core', 'SQLite Relational', 'v3.45 native binder', 'ACID compliant file database with zero-config'],
    ['Language Pipeline', 'LMS Dynamic Matrix', 'English + 5 Vernacular', 'Dynamic vernacular UI translations inside state'],
    ['Desktop Edge Packaging', 'Electron Sandbox', 'v30.1.0 Node Booter', 'Encapsulated local executables for offline farm use']
  ];
  writeTable(techHeaders, techRows, [110, 110, 100, 175]);

  doc.moveDown(0.6);
  doc.fillColor(colors.lightText).font('Helvetica-Oblique').fontSize(8).text('Confidential Document   *   Prepared for Developer Integration Workshops', { align: 'center' });


  // ==========================================
  // PAGE 2: INTER-CONNECTION ARCHITECTURE (THE CONNECTION DETAILS)
  // ==========================================
  doc.addPage();
  applyHeaderFooter(2);
  doc.y = 65;

  writeSectionHeader('2. FRONTEND AND BACKEND SYSTEM INTER-CONNECTIONS', 'Technical interface data mapping and communication pipelines');

  writeParagraph(
    'The application employs a decoupled but highly structured client-server architecture. The backend Node/Express server runs standard API routing vectors, exposing strict JSON endpoints, while the React frontend initiates standard non-blocking HTTP requests. Standard state handlers ingest clean serialized data objects, translating them into layout-friendly representations.'
  );

  writeParagraph(
    'Let\'s examine exact implementations representing how client actions translate to server database executions and sync securely.'
  );

  // Exact code block demonstrating Front-end fetch connection
  writeCodeBox([
    '// 1. FRONT-END: REQUISITION HOOK TO PULL ACTIVE FLOCKS REGISTRIES',
    '// File Path: /src/components/Flocks.tsx && /src/App.tsx',
    'export async function fetchFlocksRegistry() {',
    '  try {',
    '    const response = await fetch(\'/api/flocks\', {',
    '      method: \'GET\',',
    '      headers: {',
    '        \'Content-Type\': \'application/json\',',
    '        \'Accept\': \'application/json\',',
    '        \'Authorization\': `Bearer ${localStorage.getItem(\'operator_token\') || \'\'}`',
    '      }',
    '    });',
    '    if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);',
    '    const data = await response.json(); // Array of biological flock objects',
    '    return data;',
    '  } catch (err) {',
    '    console.error(\'API Integration Disconnection Error Details:\', err);',
    '    throw err;',
    '  }',
    '}'
  ], 'FRONT-END CONNECTIVITY MODULE');

  // Exact code block demonstrating Backend SQLite execution
  writeCodeBox([
    '// 2. BACK-END EXPRESS CONTROLLER RESOLVING SQL RECORDS TRANSACTIONALLY',
    '// File Path: /server/controllers.js',
    'export const flockControllers = {',
    '  list: async (req, res) => {',
    '    try {',
    '      const { query } = await import(\'./db.js\');',
    '      // Fetch the flock record along with dynamic feed and mortality counts dynamically compiled',
    '      const sql = `',
    '        SELECT f.*, ',
    '               (SELECT SUM(dead_qty) FROM daily_logs WHERE flock_id = f.id) as accumulated_mortality,',
    '               (SELECT SUM(eggs_collected) FROM daily_logs WHERE flock_id = f.id) as accumulated_eggs',
    '        FROM Flocks f ',
    '        WHERE f.status = \'Active\'',
    '        ORDER BY f.acquisition_date DESC',
    '      `;',
    '      const activeFlocks = await query.all(sql);',
    '      res.status(200).json(activeFlocks);',
    '    } catch (error) {',
    '      console.error(\'SQLite Fetch Failure:\', error);',
    '      res.status(500).json({ error: \'Database processing exception\', details: error.message });',
    '    }',
    '  }',
    '};'
  ], 'BACK-END ENDPOINT ROUTER MODULE');


  // ==========================================
  // PAGE 3: PERSISTENT DATABASE SHEMANTICS & SCHEMAS
  // ==========================================
  doc.addPage();
  applyHeaderFooter(3);
  doc.y = 65;

  writeSectionHeader('3. SQLITE PERSISTENT LOG database SCHEMA & SCHEMATICS', 'ACID transaction design, foreign keys, and referential constraints');

  writeParagraph(
    'Relational database design maps historical events without risk of corruption. To satisfy Electron single-user requirements, transactional isolation guarantees data safety. Relationships are backed by foreign keys, cascading deletions automatically to eliminate orphaned entries.'
  );

  writeCodeBox([
    '-- SQL REPRESENTATIVE DEFINITIONS FOR POULTRY LMS CORE TABLES',
    'CREATE TABLE Flocks (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  name TEXT NOT NULL, breed TEXT NOT NULL, acquisition_date TEXT,',
    '  initial_qty INTEGER NOT NULL, current_qty INTEGER NOT NULL,',
    '  acquisition_cost REAL, age_weeks REAL DEFAULT 0.0, status TEXT DEFAULT \'Active\'',
    ');',
    'CREATE TABLE DailyLogs (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  flock_id INTEGER NOT NULL, log_date TEXT NOT NULL,',
    '  dead_qty INTEGER DEFAULT 0, feed_consumed_kg REAL DEFAULT 0.0,',
    '  water_consumed_liters REAL DEFAULT 0.0, eggs_collected INTEGER DEFAULT 0,',
    '  FOREIGN KEY(flock_id) REFERENCES Flocks(id) ON DELETE CASCADE',
    ');',
    'CREATE TABLE Transactions (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  stakeholder_id INTEGER, type TEXT CHECK(type IN (\'Revenue\', \'Expense\')),',
    '  category TEXT NOT NULL, amount REAL NOT NULL, transaction_date TEXT NOT NULL,',
    '  payment_method TEXT, description TEXT, invoice_number TEXT UNIQUE',
    ');'
  ], 'SQLITE CONSTRAINTS MATRIX');

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10.5).text('TABLE STRUCTURAL RELATIONSHIPS');
  doc.moveDown(0.2);

  const dbHeaders = ['TABLE REFS', 'KEYS TYPES MATCH', 'FOREIGN CONSTRAINTS', 'MISSION STATEMENTS'];
  const dbRows = [
    ['flocks', 'id (INTEGER INT-PK)', 'None', 'Maintains biometric bird records, counts, and status'],
    ['daily_logs', 'id | flock_id', 'flock_id -> Flocks(id)', 'Aggregated feed indexes, biological losses, egg rates'],
    ['vaccinations', 'id | flock_id', 'flock_id -> Flocks(id)', 'Schedule dates, serum names, batch references'],
    ['inventories', 'id (INTEGER)', 'None', 'Tracks active feed stockpiles and medical inventory values'],
    ['stakeholders', 'id (INTEGER)', 'None', 'Corporate logs of customers and premium vendors'],
    ['transactions', 'id', 'stakeholder_id', 'Dual-entry financial accounts books balancing'],
    ['security_audit', 'id (INTEGER)', 'None', 'Unyielding log of actions, timestamps, and usernames']
  ];
  writeTable(dbHeaders, dbRows, [80, 110, 110, 195]);


  // ==========================================
  // PAGE 4: SCIENTIFIC FORMULAS & VERNACULAR COMPILER
  // ==========================================
  doc.addPage();
  applyHeaderFooter(4);
  doc.y = 65;

  writeSectionHeader('4. BIOMETRIC SCIENTIFIC ENGINES & MULTIX TRANSLATION', 'Mathematical performance multipliers and state-bound local translation maps');

  writeParagraph(
    'A central requirement of the local poultry agricultural manager is calculating the historical performance indexes. These indexes serve as active warning flags across dashboards and prevent losses through visual indicators.'
  );

  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('Feed Conversion Ratio (FCR) Logic Code');
  doc.moveDown(0.25);

  writeCodeBox([
    '// CALCULATION MATRIX: FEED CONVERSION RATIO',
    '// Formula: (Total Feed Weight Consumed in kg) / (Biological Weight Gain in kg)',
    'export function calculateFlockFCR(feedLogs, flocksRecord) {',
    '  const totalFeed = feedLogs.reduce((sum, log) => sum + Number(log.feed_consumed_kg || 0), 0);',
    '  const currentBiomassKg = (Number(flocksRecord.current_qty) * Number(flocksRecord.avg_weight_g || 0)) / 1000;',
    '  const initialBiomassKg = (Number(flocksRecord.initial_qty) * Number(flocksRecord.initial_weight_g || 150)) / 1000;',
    '  const weightGain = currentBiomassKg - initialBiomassKg;',
    '  ',
    '  if (weightGain <= 0) return 0.0; // Avoid division-by-zero on negative performance',
    '  return (totalFeed / weightGain).toFixed(2);',
    '}'
  ], 'BIOMARK PERFORMANCE EQUATION LOGIC');

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('Low-Overhead Localization Engine Layout');
  doc.moveDown(0.25);

  writeCodeBox([
    '// STATE DICTIONARY CONFIGURATION WITH ZERO-DEP LOCAL COMPATIBILITY',
    '// File: /src/translations.ts',
    'export type Language = \'en\' | \'hi\' | \'mr\' | \'gu\' | \'te\' | \'bn\';',
    'export const translations: Record<Language, TranslationSet> = {',
    '  en: { dashboard: "Dashboard Overview", update: "Apply Update", save: "Save changes" },',
    '  hi: { dashboard: "डैशबोर्ड अवलोकन", update: "सत्यापित करें", save: "सुरक्षित करें" },',
    '  mr: { dashboard: "डॅशबोर्ड सारांश", update: "अद्यतन करा", save: "नोंद जतन करा" },',
    '  gu: { dashboard: "ડેશબોર્ડ સામાન્ય વિગત", update: "સુધારો પ્રક્રિયા", save: "સેવ કરો" },',
    '  te: { dashboard: "డ్యాష్‌బోర్డ్ అవలోకనం", update: "నవీకరించు", save: "భద్రపరచు" },',
    '  bn: { dashboard: "ড্যাশবোর্ড পর্যবেক্ষণ", update: "হালনাগাদ", save: "সংরক্ষণ করুন" }',
    '};',
    '// IN-VIEW USAGE:',
    'const t = translations[currentLanguage];',
    'return <button>{t.save}</button>;'
  ], 'MULTILINGUAL LOCAL STATE RESOLVERS');


  // ==========================================
  // PAGE 5: REPOSITORY STRUCTURES & COMMANDS LIST
  // ==========================================
  doc.addPage();
  applyHeaderFooter(5);
  doc.y = 65;

  writeSectionHeader('5. MODULE WORKSPACE STRUCTURE & REPOSITORY SCHEMANTICS', 'Complete component directory trees and deployment routines');

  writeParagraph(
    'The project structure segregates database services, back-end servers, and atomic UI screens inside self-contained modules, allowing any developer to immediately inspect routes, styles, and state contexts.'
  );

  // Core visual directory map
  writeCodeBox([
    ' poultry-lms-360/',
    ' ├── package.json              <-- NPM build script pipeline & packages locking',
    ' ├── server.ts                 <-- SQLite3 Express bootloader engine (Port 3000)',
    ' ├── launch.cjs                <-- Electron secure sandboxed window generator',
    ' ├── server/                   <-- Relational DB Controller interfaces & migrations',
    ' │   ├── db.js                 <-- SQLite query adapter and structural seeds definition',
    ' │   ├── controllers.js        <-- Analytical biometric calculations endpoints',
    ' │   └── backups.js            <-- JSON local physical schemas dump modules',
    ' └── src/                      <-- High Performance UI Layer (React Single Page App)',
    '     ├── main.tsx              <-- Vite Entry hydration launcher',
    '     ├── App.tsx               <-- Auth checking, frame layout and side-menus console',
    '     ├── translations.ts       <-- Dynamic local translate dictionaries (6 regions)',
    '     └── components/           <-- Reactive isolated screen dashboards',
    '         ├── Dashboard.tsx     <-- Vital graphs, mortality warnings cards',
    '         ├── Flocks.tsx        <-- Flock purchase forms & conversion lists',
    '         ├── DailyLogs.tsx     <-- Operator input boards for eggs & feed',
    '         ├── Vaccinations.tsx  <-- Scheduling due alerts (blinking critical notifications)',
    '         └── BulkImport.tsx    <-- Active anti-falsification deduplication CSV uploader'
  ], 'POULTRY LMS 360 COMPONENT LOGICAL PATHS');

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('DEVELOPMENT PIPELINE EXECUTIONS MATRIX');
  doc.moveDown(0.25);

  const commandHeaders = ['DEVELOPER PIPELINE ACTION', 'SHELL TERMINAL DEPLOY', 'BUILD STATE TARGET'];
  const commandRows = [
    ['Hot Module Reloading Dev', 'npm run dev', 'Boots Express and Hydrates React View on Port 3000'],
    ['Production Compiling', 'npm run build', 'Generates standard bundled JS/CSS assets inside /dist'],
    ['System TypeScript Linter', 'npm run lint', 'Runs tsc type compiler checklist validation'],
    ['Standalone Live Release', 'npm run start', 'Node spawns optimized bundled back-end CJS servers'],
    ['Edge Window Executable', 'npm run electron:dev', 'Launches Local Electron Window wrapper sandbox']
  ];
  writeTable(commandHeaders, commandRows, [160, 160, 175]);

  doc.moveDown(0.8);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).textAlign = 'center';
  doc.text('--- SECTION CONCLUDED ---', { align: 'center' });


  // ==========================================
  // PAGE 6: ELECTRON SECURITY & ANTIVIRUS PROTOCOLS
  // ==========================================
  doc.addPage();
  applyHeaderFooter(6);
  doc.y = 65;

  writeSectionHeader('6. LOCAL EXECUTABLE COMPILATION & ANTIVIRUS CERTIFICATION', 'Aesthetic enterprise packaging, EV code signing, and SmartScreen trust metrics');

  writeParagraph(
    'A central threat to professional software deployment is the triggering of Antivirus heuristic scanners or Microsoft SmartScreen "Unknown Publisher" dialogs on client systems. This decreases brand reputation and halts client trust. To bypass these security mechanism warnings cleanly, standard certification pipelines must be applied during high-production assemblies.'
  );

  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('1. Extended Validation (EV) Code-Signing Certification Protocols');
  writeParagraph(
    'Standard signatures still cause brief initial trust flags. High-scale corporate distributions require an Extended Validation (EV) Code-Signing Certificate (configured via hardware HSM token or secure third-party vaults like DigiCert KeyTalk or Azure Key Vault). Signing with an EV Certificate establishes immediate Microsoft SmartScreen reputation, completely bypassing any "Windows protected your PC" blocks on client launch.'
  );

  writeCodeBox([
    '# REPRESENTATIVE ELECTRON-BUILDER CONFIGURATION WITH AUTOMATED CODESIGN',
    '# File Path: /electron-builder.yml',
    'win:',
    '  target:',
    '    - target: nsis',
    '      arch: [x64, ia32]',
    '  certificateSubjectName: "Poultry Systems International LLC"',
    '  publisherName: "Poultry Systems International LLC"',
    '  signingHashAlgorithms: [sha256]',
    '  rfc3161TimeStampServer: "http://timestamp.digicert.com"',
    'nsis:',
    '  oneClick: true',
    '  perMachine: false',
    '  allowElevation: true',
    '  createDesktopShortcut: true',
    '  installerIcon: "assets/icons/win/icon.ico"'
  ], 'ELECTRON-BUILDER PRODUCTION WINDOWS SIGNING SCHEMA');

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('2. macOS Gatekeeper & Automated Developer Notarization');
  writeParagraph(
    'Desktop releases target dual environments. To load on macOS with zero prompts, binaries must participate in Apple Notarization. The code signing is bound utilizing certificates issued directly through an Apple Developer ID account, and the compiled installer is securely submitted via Apple’s notarytool command during the production CI run.'
  );

  writeCodeBox([
    '# MAC NOTARIZATION CONFIGURATION SCRIPT SETTINGS',
    'mac:',
    '  target: dmg',
    '  category: public.app-category.business',
    '  hardenedRuntime: true                   # Required tool requirement for Notarization',
    '  gatekeeperAssess: false',
    '  entitlements: build/entitlements.mac.plist',
    '  entitlementsInherit: build/entitlements.mac.plist',
    'afterSign: "scripts/notarize.js"          # Automated notarization booter runtime hook'
  ], 'ELECTRON-BUILDER APPLE DM NOTARIZATION SPECIFICATION');

  doc.moveDown(0.3);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text('3. Safeguarding Code against False-Positive Scanners (V8 Bytecode Runtime)');
  writeParagraph(
    'Antiviruses frequently flag packed JavaScript files compiled inside installer wrappers as malicious due to heuristic analysis looking for packed executables. To guarantee safety and prevent code tampering, this project is designed with the compilation tool "Bytenode". Bytenode compiles plain Node.js and controller files into V8 bytecode files (.jsc), masking cleartext logic code from scanners.'
  );

  doc.moveDown(0.4);
  doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).textAlign = 'center';
  doc.text('--- END OF DEV ARCHITECTURE MANUAL ---', { align: 'center' });

  doc.end();
  console.log('PDF Developer Guide rendered successfully as developer_guide.pdf');
}

generateDeveloperGuide();
