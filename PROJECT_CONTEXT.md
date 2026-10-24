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
- **Pure Cloud Architecture**: Verified zero local database storage. All cross-platform operations (Android APK, Windows Desktop, Web) execute directly against Supabase Cloud PostgreSQL.
- **Hard Reset UI & API Fix**: Redesigned and fixed the hard reset modal dialog and API controller to cleanly purge Supabase records.
- **Standalone Client Configuration**: Removed Vercel domain dependencies from Android/Desktop native wrappers.
