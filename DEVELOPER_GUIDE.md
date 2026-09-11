# Poultry LMS 360: Full-Stack Developer Study Guide & Technical Blueprint
### Prepared for .NET Developers transitioning to the React + Node.js (Express) + TypeScript + SQLite Stack

Welcome! If you come from a background of **C#, ASP.NET Core MVC / Web API, Entity Framework Core (EF Core), or Blazor**, this document is your fast-track masterclass. 

The technologies powering **Poultry LMS 360** share strong conceptual matches with the Microsoft .NET enterprise ecosystem. This guide maps those concepts directly, helping you understand, maintain, and solely extend this application with confidence.

---

## Table of Contents
1. [The .NET to TypeScript & Node.js Mental Model Translation Map](#1-the-net-to-typescript--nodejs-mental-model-translation-map)
2. [High-Level Project Architecture & Bootloader Flow](#2-high-level-project-architecture--bootloader-flow)
3. [The Backend Deep Dive: Node.js, Express, & SQLite](#3-the-backend-deep-dive-nodejs-express--sqlite)
4. [The Frontend Deep Dive: React 19, Hooks, & State Management](#4-the-frontend-deep-dive-react-19-hooks--state-management)
5. [Step-by-Step Developer Labs (Practical Tutorials)](#5-step-by-step-developer-labs-practical-tutorials)
6. [C# vs. TypeScript Syntax Cheat Sheet](#6-c-vs-typescript-syntax-cheat-sheet)

---

## 1. The .NET to TypeScript & Node.js Mental Model Translation Map

To master this project quickly, you do not need to throw away your .NET experience. Instead, translate your knowledge using this conceptual mapping:

| ASP.NET Core / C# Concept | React / TypeScript / Node.js Equivalent | Description |
| :--- | :--- | :--- |
| **`Program.cs` & Kestrel** | `server.ts` & Express.js | The HTTP server entry point that binds to a port (Port 3000 here), registers middlewares, and maps API endpoints. |
| **`ControllerBase` / `[ApiController]`** | `/server/controllers.ts` | Functions accepting `Request` and `Response` arguments, extracting route params/body parameters, executing database queries, and returning JSON. |
| **ADO.NET / Dapper / EF Core** | `sqlite3` + Promise query wrapper (`/server/db.ts`) | Raw parameterized SQL queries wrapped in JavaScript Promises (`Promise<T>`) to execute asynchronously without blocking the Node single-threaded event loop. |
| **Razor Views / Blazor Components** | React Functional Components (`.tsx`) | UI blocks composed of HTML-like syntax (JSX) mixed with JavaScript logic, tracking state and re-rendering when variables change. |
| **`Task<T>` and `async/await`** | `Promise<T>` and `async/await` | The identical syntax and mechanics for managing non-blocking asynchronous operations. |
| **NuGet Packages (`csproj`)** | NPM Packages (`package.json`) | Package registry management for managing external project dependencies and executable scripts. |
| **C# Namespaces (`using`)** | ES Modules (`import` / `export`) | Modular code sharing. TypeScript uses file-path-based relative importing rather than solution-wide assembly naming. |

---

## 2. High-Level Project Architecture & Bootloader Flow

Poultry LMS 360 is structured to support **two runtime targets**:
1. **Cloud Container Mode**: Served on Cloud Run (mapped via Port 3000) using Express.
2. **Local Desktop App Mode**: Rendered inside an **Electron** sandbox frame on a local physical computer, targeting offline farm deployments.

### Logical Directory Structure
```text
 poultry-lms-360/
 ├── package.json              <-- Equivalent to your .csproj (defines scripts, dependencies, targets)
 ├── tsconfig.json             <-- TypeScript compiler rules (analogous to MSBuild compiler options)
 ├── server.ts                 <-- ASP.NET Program.cs. Starts Express server, connects DB, and registers API endpoints.
 ├── launch.cjs / main.cjs     <-- Electron Desktop wrapper booter scripts.
 ├── server/                   <-- Backend Server Layer
 │   ├── db.ts                 <-- SQLite3 database connection, tables schema definition, integrity & self-healing hooks.
 │   ├── controllers.ts        <-- Primary API Controllers handling Sales, Purchases, Flocks, Logs, and HR Payroll.
 │   ├── settingsControllers.ts <-- Database maintenance, language switching, and corporate settings controllers.
 │   └── backups.ts            <-- Database physical backup scheduler.
 └── src/                      <-- Frontend UI Layer (React Single Page Application)
     ├── main.tsx              <-- Frontend entry point (hydrates the React DOM inside index.html)
     ├── App.tsx               <-- Root Layout (checks authentication, serves the Side Navigation pane, renders views)
     ├── index.css             <-- Tailwind CSS v4 global styling sheet.
     └── components/           <-- Reactive Modular Screens
         ├── Dashboard.tsx     <-- Visual analytics (Mortality alerts, Hatchery charts, cash-flow reports)
         ├── Flocks.tsx        <-- Flock registration, mortality counters, bird performance tracking
         ├── DailyLogs.tsx     <-- Biological registers (daily egg collection logs, feed consumption inputs)
         ├── SalesDesk.tsx     <-- Sales Desk with dynamic stock reductions, credit invoices, and returns
         └── Purchasing.tsx    <-- Supplier purchases log, extra expense landing calculations, and order management
```

### Build & Compilation Pipeline
The workspace uses two compilation tools:
- **Vite** compiles and packages the client UI code (`/src`) into static optimized assets under `/dist` (HTML, CSS, JS).
- **Esbuild** bundles and compiles the server TypeScript (`server.ts` & `/server`) into a single CommonJS executable file at `dist/server.cjs` for lightning-fast container cold starts or Electron execution.

---

## 3. The Backend Deep Dive: Node.js, Express, & SQLite

Node.js executes JavaScript on the server. Because JavaScript is **single-threaded**, any blocking I/O (like querying a database or reading a file) would freeze the entire server. To prevent this, all database and disk operations are written **asynchronously** using `async/await` and `Promises`.

### 3.1 Database Connection & Utility Wrapper (`/server/db.ts`)
The `sqlite3` library natively uses callbacks. To align with modern clean C# patterns, the project wraps these callbacks inside a standard Promise structure:

```typescript
// /server/db.ts
import sqlite3 from 'sqlite3';

// Wrap native callbacks in Promises - equivalent to wrapping standard ADO.NET or Dapper calls
export const query = {
  // Executes INSERT, UPDATE, DELETE queries
  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes }); // "this" contains auto-incremented primary keys
      });
    });
  },

  // Fetches a SINGLE row - equivalent to EF Core's .FirstOrDefaultAsync()
  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row as T | undefined);
      });
    });
  },

  // Fetches MULTIPLE rows - equivalent to EF Core's .ToListAsync()
  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows as T[]);
      });
    });
  },

  // Runs operations in a sequential SQLite serialization frame - crucial for ACID transactions
  async serializeTransaction<T>(work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        work().then(resolve).catch(reject);
      });
    });
  }
};
```

### 3.2 SQL Transactions with SQLite
SQLite does not support concurrent write transactions natively like SQL Server or PostgreSQL. To guarantee ACID transactions when multi-step stock deductions happen, use `query.serializeTransaction` and handle rollback patterns manually inside a database try-catch block:

```typescript
// Sample Transaction pattern in /server/controllers.ts
await query.serializeTransaction(async () => {
  // Begin Manual Transaction
  await query.run('BEGIN TRANSACTION;');
  try {
    // 1. Fetch current stock
    const item = await query.get('SELECT CurrentStock FROM Inventories WHERE Id = ?', [inventoryId]);
    if (item.CurrentStock < quantity) {
      throw new Error('Insufficient stock!');
    }
    
    // 2. Update stock
    await query.run('UPDATE Inventories SET CurrentStock = CurrentStock - ? WHERE Id = ?', [quantity, inventoryId]);
    
    // 3. Commit Transaction
    await query.run('COMMIT;');
  } catch (error) {
    // 4. Rollback if any step fails
    await query.run('ROLLBACK;');
    throw error;
  }
});
```

### 3.3 Endpoint Route Mapping (`server.ts`)
In ASP.NET, routing is configured via attributes (e.g., `[Route("api/[controller]")]`). In Express.js, routing is explicitly mapped in the main server config file:

```typescript
// server.ts
import express from 'express';
import { salesControllers } from './server/controllers.js';

const app = express();
app.use(express.json()); // Middleware - equivalent to app.UseRouting() and mapping JSON options

// Explicit Route Mapping
app.get('/api/sales', salesControllers.list);
app.get('/api/sales/:id', salesControllers.getDetails);
app.post('/api/sales', salesControllers.create);
app.delete('/api/sales/:id', salesControllers.delete); // Deletes Sales bills, adjusting stock and balances.
```

---

## 4. The Frontend Deep Dive: React 19, Hooks, & State Management

In React, the UI is a **direct representation of your state**. You do not directly manipulate DOM elements (e.g., you don't do `document.getElementById('total').innerText = x`). Instead, you update variables in memory (the State), and React automatically re-draws (re-renders) the components that depend on those variables.

### 4.1 React State Hook (`useState`)
`useState` tells React to keep track of a variable across renders.

```tsx
import React, { useState } from 'react';

export function Counter() {
  // Syntax: const [stateValue, stateSetter] = useState(initialValue);
  const [count, setCount] = useState<number>(0);

  return (
    <div className="p-4 border rounded-xl">
      <p>Current Count: {count}</p>
      <button 
        onClick={() => setCount(count + 1)} // Updates variable and schedules UI re-render
        className="px-3 py-1 bg-blue-600 text-white rounded-lg"
      >
        Increment
      </button>
    </div>
  );
}
```

### 4.2 React Side-Effect Hook (`useEffect`)
`useEffect` lets you synchronize your component with external systems, such as fetching data from your backend API when the component first appears on the screen (mounts).

```tsx
import React, { useState, useEffect } from 'react';

export function FlocksList() {
  const [flocks, setFlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // useEffect accepts: 1) A function containing the side-effect, 2) A dependency array
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/flocks');
        const data = await response.json();
        setFlocks(data);
      } catch (err) {
        console.error('Failed to load flocks', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []); // Empty dependency array [] means: Run this function EXACTLY ONCE when the component mounts on the screen.

  if (loading) return <div>Loading biological registers...</div>;

  return (
    <ul>
      {flocks.map(f => (
        <li key={f.Id}>{f.Name} (Count: {f.CurrentCount})</li>
      ))}
    </ul>
  );
}
```

> ⚠️ **CRITICAL RULES FOR `useEffect` TO PREVENT INFINITE RE-RENDERS:**
> - Never update state variables directly inside a `useEffect` unless they are safely guarded.
> - Never include dynamic arrays or objects directly in the dependency array (second argument) as JavaScript does reference comparison, causing infinite loops. Always use primitives (strings, numbers, booleans) or an empty array `[]` for initial load triggers.

### 4.3 Styling with Tailwind CSS v4
Tailwind CSS provides low-overhead styling directly in your markup using utility classes. It does away with separate CSS files and is configured directly in Vite.

- In ASP.NET MVC / Bootstrap, you write: `<div class="card p-3 shadow-sm mb-4">`
- In React/Tailwind, you write: `<div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 hover:shadow-md transition-shadow">`

**Common Tailwind utility mapping:**
- Padding/Margin: `p-4` (padding 1rem/16px), `mx-auto` (horizontal margin auto/centering), `mb-6` (margin-bottom 1.5rem/24px)
- Colors: `bg-slate-50` (background slate tint), `text-emerald-700` (emerald font color)
- Layouts: `flex items-center justify-between` (Flexbox container), `grid grid-cols-1 md:grid-cols-3 gap-6` (CSS Grid layouts with responsive breakpoints)

---

## 5. Step-by-Step Developer Labs (Practical Tutorials)

To make you a master of this code, let's walk through three common operational developer tasks.

### 🧪 Lab A: Adding a New Database Column (SQLite Schema Update)
Suppose we want to add a `Notes` text column to the `Flocks` table.

#### Step 1: Open `/server/db.ts` and view the database initialization logic
Inside `initializeDatabase()`, find the table creation script for `Flocks`. Update it to include the new column:
```sql
CREATE TABLE IF NOT EXISTS Flocks (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name TEXT NOT NULL,
  Breed TEXT NOT NULL,
  -- ... other columns ...
  Notes TEXT
);
```

#### Step 2: Write an Alter table patch script to execute during app migrations
To migrate existing databases seamlessly without losing user records, execute an `ALTER TABLE` schema query under a catch-block in `initializeDatabase()`:
```typescript
try {
  await query.run('ALTER TABLE Flocks ADD COLUMN Notes TEXT;');
  console.log('Migrated: Added Notes column to Flocks table.');
} catch (e) {
  // If the column already exists, SQLite will throw an error. We catch and ignore it safely.
}
```

---

### 🧪 Lab B: Creating a New Express Controller Endpoint
Now, let's expose an API endpoint on the server to update a Flock's notes.

#### Step 1: Add a new handler function in `/server/controllers.ts`
Find `flockControllers` (or the corresponding controller block) and add the update handler:
```typescript
export const flockControllers = {
  // ... existing methods ...
  
  async updateNotes(req: Request, res: Response) {
    const { id } = req.params;
    const { notes } = req.body;
    try {
      await query.run('UPDATE Flocks SET Notes = ? WHERE Id = ?', [notes, id]);
      res.json({ success: true, message: 'Notes updated successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};
```

#### Step 2: Register the endpoint in `/server.ts`
Map the HTTP PATCH/PUT request to your controller:
```typescript
// server.ts
app.put('/api/flocks/:id/notes', flockControllers.updateNotes);
```

---

### 🧪 Lab C: Creating & Wiring the React Component Interface
Let's add an interactive notes text input inside the `Flocks` React component and bind it to our new backend API.

#### Step 1: Create a handler function in your React component file (`/src/components/Flocks.tsx`)
```tsx
const handleUpdateNotes = async (flockId: number, currentNotes: string) => {
  try {
    const res = await fetch(`/api/flocks/${flockId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: currentNotes })
    });
    
    if (res.ok) {
      alert('Notes updated successfully!');
      // Refresh local UI states (fetches fresh flocks list)
      fetchFlocks();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update notes.');
    }
  } catch (err: any) {
    alert(err.message || 'An error occurred.');
  }
};
```

#### Step 2: Render the markup element inside the JSX
```tsx
return (
  <div className="mt-4 flex gap-2">
    <input 
      type="text" 
      placeholder="Add flock notes..." 
      defaultValue={flock.Notes || ''}
      onBlur={(e) => handleUpdateNotes(flock.Id, e.target.value)} // Triggers when input field loses focus
      className="border rounded-lg px-3 py-1 text-sm flex-1 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
    />
  </div>
);
```

---

## 6. C# vs. TypeScript Syntax Cheat Sheet

This syntax dictionary maps language utilities between C# (System namespace / LINQ) and TypeScript / modern ES6 JavaScript arrays:

### Variables & Nullability
```csharp
// C#
string name = "Flock Alpha";
int? count = null;
var total = 250.50;
```
```typescript
// TypeScript
let name: string = "Flock Alpha";
let count: number | null = null;
const total: number = 250.50; // Use const by default for variables that won't change
```

### Async / Await Engine
```csharp
// C# Async Task
public async Task<List<Flock>> GetFlocksAsync() {
    try {
        var list = await _dbContext.Flocks.ToListAsync();
        return list;
    } catch(Exception ex) {
        Console.WriteLine(ex.Message);
        throw;
    }
}
```
```typescript
// TypeScript Promise
async function getFlocksAsync(): Promise<Flock[]> {
    try {
        const list = await query.all('SELECT * FROM Flocks');
        return list;
    } catch(err: any) {
        console.error(err.message);
        throw err;
    }
}
```

### Data Pipelines (LINQ vs. JavaScript Arrays)
```csharp
// C# LINQ - Filter & Map
var activeFlocks = flocks
    .Where(f => f.Status == "Active")
    .Select(f => new { f.Id, f.Name })
    .ToList();

// C# LINQ - Sum / Reduce
double totalExpense = transactions
    .Where(t => t.Type == "Expense")
    .Sum(t => t.Amount);
```
```typescript
// TypeScript Array - Filter & Map
const activeFlocks = flocks
    .filter(f => f.Status === 'Active')
    .map(f => ({ id: f.Id, name: f.Name }));

// TypeScript Array - Sum / Reduce
const totalExpense = transactions
    .filter(t => t.Type === 'Expense')
    .reduce((sum, t) => sum + Number(t.Amount || 0), 0);
```

### Object Destructuring (Extremely common in React)
```csharp
// C# (Manual assignment)
var customer = GetCustomer();
string name = customer.Name;
string email = customer.Email;
```
```typescript
// TypeScript Destructuring
const { Name, Email } = getCustomer(); // Extracts properties directly into local variables
```

---

## Final Compilation & Running Guidelines

Whenever you make any changes to the codebase, run these scripts to verify compile safety and refresh the running container sandbox:

1. **Verify Type-Safety (Linter)**:
   ```bash
   npm run lint
   ```
   *This is equivalent to compiling your solution in Visual Studio to catch compile errors.*

2. **Build the Application Assets**:
   ```bash
   npm run build
   ```
   *This builds both the React static assets and compiles the backend TypeScript server to `dist/server.cjs` via esbuild.*

3. **Deploy or Refresh Local Dev Server**:
   Once the build completes successfully, restart the service to execute with fresh changes.

With this guide, you hold all the conceptual keys to master this project. Step into the codebase, refer back to these mappings, and confidently own the development of **Poultry LMS 360**!
