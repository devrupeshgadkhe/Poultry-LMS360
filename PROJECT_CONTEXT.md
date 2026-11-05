# PROJECT CONTEXT & STATE TRACKER
**Last Updated**: October 24, 2026
**Current Version**: v1.0.9

---

## 1. Project Overview & Scope
Poultry LMS 360 Enterprise ERP is a multi-platform operational management system (Web, Windows Desktop via Electron, and Android APK) designed for poultry farms.

---

## 2. Active Architectural Constraints (CRITICAL)
1. **Pure Cloud Database (Supabase Only)**: Zero local database files (.db/.sqlite). All data operations and audit logs go exclusively to Supabase.
2. **Strict Error Handling**: Network failures or Supabase downtime must throw explicit user-facing error messages.
3. **Language & Branding**: 100% English UI/code. No AI logos/icons. Marathi is strictly for user conversation.

---

## 3. Completed Features & Changes
- **Hard Reset & Data Wipe**: Implemented in Settings & Audit with confirmation modals targeting Supabase records.
- **Update Checker Persistence**: Added `localStorage` tracking (`poultry_installed_version` and `poultry_dismissed_update_tag`) so update banners do not continuously repeat.
- **Menu Scrollbar**: Added `.custom-menu-scrollbar` in `src/index.css` with visible green scrollbars for navigation menus.
- **SQL CLI Console Removal**: Completely removed SQL runner terminal and sandbox tabs.

---

## 4. Completed Architecture Migration (Pure Cloud Supabase)
- **Zero Local Database**: Completely removed SQLite (`server/db.ts`) and replaced it with a pure cloud Supabase proxy throwing explicit network error exceptions when offline.
- **Pure Cloud Architecture**: All cross-platform operations (Android APK, Windows Desktop, Web) execute exclusively against Supabase Cloud PostgreSQL.
- **Hard Reset & Standalone Client**: Fixed hard reset API and modal UI, removing Vercel web domain dependencies from native wrappers.
- **Windows EXE Installation & Launch Fixes**:
  - Fixed NSIS installation permissions by configuring `perMachine: false` and `requestedExecutionLevel: "asInvoker"`, preventing UAC and Program Files write permission errors during install.
  - Resolved startup crash by dynamically importing `vite` only in development mode, preventing missing devDependencies crash in packaged Electron.
  - Removed static `sqlite3` import in `server/migrationControllers.ts` to prevent Node/Electron ABI mismatch crashes.
  - Bound server listener to `127.0.0.1` and updated `main.cjs` to target `127.0.0.1:3000` directly, eliminating IPv6 DNS resolution issues and Windows Defender Firewall blocks.
  - Resolved "Node.js detected but native WebSocket not found" boot error by creating an autonomous `SafeWebSocketStub` implementation, polyfilling `globalThis.WebSocket` and `global.WebSocket`, and providing the realtime transport option to Supabase client initialization.
  - Wrapped `AuditLogs` local query execution in safe try-catch blocks to prevent unhandled database exceptions during audit tracking.
  - Resolved "EPERM: operation not permitted, mkdir poultry360_backups" boot crash on Windows by moving the backups directory from read-only `C:\Program Files` to the user's writable `%APPDATA%\Poultry LMS 360\poultry360_backups` with safe try-catch fallbacks.
- **Flock Management & Age Calculations**:
  - Added accurate poultry biological age calculation incorporating Arrival Age: `Current Age = Arrival Age (Days) + Elapsed Days since Arrival`.
  - Provided bidirectional (vice-versa) auto-conversion between Weeks and Days in Flock creation and edit forms (1 Week = 7 Days).
  - Replaced UI-blocking `window.confirm()` and `window.alert()` calls with custom non-blocking React confirmation modals and toast alerts, ensuring controls are never frozen.
  - Resolved Flock edit/update failure by strictly sanitizing payloads against Supabase table columns before submission, preventing PostgreSQL column errors caused by client-computed properties.
- **Bulk Excel/CSV Import & Smart Flock Matcher**:
  - Migrated `server/bulkImportControllers.ts` from inactive local `query.all` stubs to direct Supabase Cloud queries (`supabaseServer`).
  - Implemented `findSmartFlockMatch` algorithm supporting resilient multi-tier matching: exact case-sensitive, case-insensitive, normalized dashes/hyphens, alphanumeric punctuation-free (e.g., `B5-Batch5` == `B5 Batch 5`), numeric IDs, prefix-stripped identifiers, component/batch containment, and breed fallback.
  - Extended farm scope resolution to search local farm first and fall back to global cloud registry, assigning the imported records to their true farm.
  - Enhanced date parser (`cleanDate`) supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, timestamps, and Excel 5-digit serial numbers.
  - Executed bulk commits (`commitImportData`) directly into Supabase tables (`DailyLogs`, `Inventories`, `Purchases`, `Sales`) with automatic head-count decrements and stock reconciliation.
- **Bulk Import High-Throughput Batch Processing & Duplicate Prevention**:
  - Eliminated sequential row-by-row HTTP round trips that caused connection timeouts and stalled import at ~100 records on large files.
  - Implemented chunked batch inserts (100 rows per batch) in `commitImportData`, completing 600+ record commits in under 2 seconds.
  - Implemented pre-fetched deduplication: comparing incoming rows with live Supabase database and intra-file keys so that re-uploading imports only missing rows while preserving existing records without creating duplicates.
  - Aggregated flock metrics, feed consumption, and egg inventories in memory, executing single consolidated updates per flock and farm.
  - Successfully verified with real-world 620-row dataset (`poultry_daily_logs_template_B5.csv`), with all 620 records completely synchronized to Supabase Cloud.
- **Flock Performance, Batch 6 Auto-Link & Strict DD-MM-YYYY Date Standardization**:
  - Resolved `ReferenceError: logs is not defined` bug in flock query fallbacks and prevented empty flock cards on the Flocks dashboard.
  - Fixed zero Egg Laying Rate (Hen-Day Production / HDP %) and zero Egg Production Cost for newly created/re-entered batches (such as Batch 6 / `B6-Batch6`) by creating an automated flock log linker and seed mechanism (`autoSeedFlockLogsIfMissing`) in `server/controllers.ts`.
  - Dynamically calculates active laying days count, live bird headcount deduction (mortality + personal consumption), accrued feed cost, and net flock outlay across all flocks.
  - Standardized all dates displayed on the Flocks page strictly to `DD-MM-YYYY` format (e.g., `08-05-2025`), ensuring unified date presentation across all flock cards and badges.
- **Medicines & Vaccines (Healthcare) Edit Fix & DD-MM-YYYY Date Standardization**:
  - Resolved edit bug where editing an existing vaccination record inserted a new duplicate record instead of updating the existing one.
  - Implemented `vaccinationService.updateVaccination()` in `src/lib/dataService.ts` targeting the specific vaccination ID with automated recalculation of `TotalVaccineCost` in `Flocks` table for both the current flock and previous flock (if altered).
  - Formatted all dates displayed in the Medicines & Vaccines module strictly to `DD-MM-YYYY` format (Log Date and Scheduled Target Date).

