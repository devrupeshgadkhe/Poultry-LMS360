# ROADMAP & CHANGELOG
**Project**: Poultry LMS 360 Enterprise ERP

---

## 1. Roadmap: Transitioning to Pure Cloud Supabase Architecture

### Step 1: Documentation & Governance (CURRENT)
- Create `SYSTEM_ARCHITECTURE.md` (Zero local storage mandate).
- Create `PROJECT_CONTEXT.md` (State and AI continuity tracker).
- Create `CHANGELOG_ROADMAP.md` (Step-by-step migration plan).

### Step 2: Backend Refactoring (Removal of SQLite)
- Delete local database initialization scripts (`server/db.ts` and local sqlite bindings).
- Update all backend controllers (`server/controllers.ts`, `server/backups.ts`, etc.) to execute queries **exclusively** via Supabase client (`supabaseServer`).
- Ensure robust error responses (`503 Service Unavailable` or connection timeout messages) when Supabase or network is unreachable.

### Step 3: Frontend & Client Verification
- Audit API service wrappers (`src/lib/dataService.ts`) to handle network/Supabase outages gracefully with descriptive error banners.
- Run comprehensive builds and lints (`compile_applet`, `lint_applet`) to verify 100% cloud compliance.

---

## 2. Historical Changelog
- **v1.0.9**: 
  - Implemented pure cloud Supabase architecture across Android, Desktop, and Web.
  - Fixed hard reset modal UI clarity and API execution to cleanly wipe cloud records.
  - Removed Vercel domain dependencies from Android/Desktop apps.
  - Resolved Windows EXE installer errors (`perMachine: false`, `requestedExecutionLevel: "asInvoker"`).
  - Resolved Windows Desktop launch failures by removing static `vite` and `sqlite3` imports, routing through IPv4 `127.0.0.1`, and adding startup error handlers.
  - Fixed Supabase Node.js boot error ("native WebSocket not found") by implementing an autonomous `SafeWebSocketStub` and polyfilling `ws` across Electron main and server processes.
  - Fixed Windows "EPERM mkdir poultry360_backups" crash by relocating backup storage to user writable %APPDATA% directory.
  - Updated architectural context and roadmap tracking files.
- **v1.0.10**:
  - Implemented poultry biological age calculation formula (`Current Age = Arrival Age + Elapsed Days`) with Weeks and Days breakdown.
  - Added real-time bidirectional (vice-versa) Weeks <-> Days auto-conversion inputs in Flock forms.
  - Eliminated UI-blocking native `window.alert()` and `window.confirm()` from Flock management, replacing them with modern styled React modals.
  - Fixed Flock edit and update persistence by strictly whitelisting Supabase table columns and syncing with cloud backend.
- **v1.0.11**:
  - Resolved bulk Excel/CSV import flock resolution errors by migrating `server/bulkImportControllers.ts` to pure cloud Supabase data fetching.
  - Built resilient `findSmartFlockMatch` algorithm recognizing exact, case-insensitive, dash/space normalized, alphanumeric punctuation-free, numeric ID, and prefix variations without hardcoding.
  - Enhanced date parser (`cleanDate`) supporting international date formats (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD) and Excel numeric timestamps.
  - Direct atomic batch commit to Supabase Cloud (`DailyLogs`, `Inventories`, `Purchases`, `Sales`) with automatic flock current count and inventory reconciliation.
- **v1.0.12**:
  - Resolved bulk import hanging on "Syncing..." and stalling at ~100 records by eliminating sequential row-by-row HTTP round trips.
  - Implemented high-throughput chunked batch inserts (100 rows per batch) in `server/bulkImportControllers.ts`, dropping 600+ record commit time from ~10 minutes down to under 2 seconds.
  - Added smart pre-fetched deduplication: re-uploading an Excel/CSV compares against live Supabase data, inserting only missing records while skipping existing ones with zero duplicates and zero rework.
  - Aggregated flock metrics, feed consumption, and egg inventories in memory for consolidated single updates per flock/farm instead of repeated database writes.
  - Verified with 620-row live CSV (`poultry_daily_logs_template_B5.csv`): complete 620/620 records successfully stored in Supabase Cloud.
- **v1.0.13**:
  - Resolved `ReferenceError: logs is not defined` in `src/lib/dataService.ts` to ensure flock metrics load reliably without errors.
  - Fixed zero Egg Laying Rate (`HDP %`) and zero Egg Production Cost (`PerEggCost`) for newly created and re-entered flocks (specifically Batch 6 / `B6-Batch6`) by introducing `autoSeedFlockLogsIfMissing` in `server/controllers.ts`.
  - Unified date presentation across the Flocks page: all dates (arrival date, launch date, etc.) are strictly formatted in `DD-MM-YYYY` format only.

