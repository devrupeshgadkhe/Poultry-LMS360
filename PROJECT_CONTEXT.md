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
  - Implemented safe EADDRINUSE handling and `did-fail-load` automatic recovery for smooth startup.
