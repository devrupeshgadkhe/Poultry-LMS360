# SYSTEM ARCHITECTURE SPECIFICATION
**Application**: Poultry LMS 360 Enterprise ERP
**Architecture Pattern**: Pure Cloud-Centric Client-Server Architecture (Zero Local Storage)

---

## 1. Core Architectural Mandate
- **NO LOCAL DATABASES**: The application must **never** create, read, write, or rely on local database files (such as SQLite `.db`, `.sqlite`, or local file storage for transactional records).
- **SINGLE SOURCE OF TRUTH**: All persistent storage, querying, mutations, audit logging, and state synchronization must happen **exclusively on the Cloud Supabase Database** (PostgreSQL).
- **OFFLINE / ERROR HANDLING**: If the internet connection is lost, Supabase is unreachable, or the backend server is down, the application must immediately catch the network or database exception and present a clear, user-friendly error message (e.g., "Cloud connection error: Unable to reach Supabase database. Please check your internet connection."). No silent fallbacks to local SQLite.

---

## 2. Component Layers
1. **Frontend (React / Vite SPA / Desktop / Android)**:
   - Communicates with the backend API (`/api/*`) or directly via Supabase JS client.
   - Handles network state and displays toast/modal alerts on connection failures.
2. **Backend API Server (Node.js / Express)**:
   - Acts as the secure intermediary.
   - Executes all CRUD operations, audit logging, and business logic directly against Supabase (`supabaseServer`).
   - Removes all local SQLite initialization, query helpers (`server/db.ts`), and local `.db` file creation.
3. **Cloud Database (Supabase PostgreSQL)**:
   - Houses all tables: `Farms`, `Flocks`, `DailyLogs`, `Vaccinations`, `Inventories`, `Customers`, `Suppliers`, `Purchases`, `Sales`, `FoodRecipes`, `FinancialTransactions`, `Staff`, `AuditLogs`, `JavascriptErrors`, etc.
   - Enforces Row Level Security (RLS) and real-time synchronization across all platforms (Web, Windows Desktop, Android APK).
