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
