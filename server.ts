// Ensure global WebSocket is always defined for Supabase in Node 20 / Electron environments
class SafeWebSocketStub {
  static readonly CONNECTING = 0; static readonly OPEN = 1; static readonly CLOSING = 2; static readonly CLOSED = 3;
  readonly CONNECTING = 0; readonly OPEN = 1; readonly CLOSING = 2; readonly CLOSED = 3;
  readyState = 3; url: string;
  onopen: any = null; onclose: any = null; onerror: any = null; onmessage: any = null;
  constructor(url: string) { this.url = url; }
  close() {} send() {} addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
}
let wsImpl: any = SafeWebSocketStub;
try { const wsPkg = require('ws'); wsImpl = wsPkg.default || wsPkg || SafeWebSocketStub; } catch { wsImpl = SafeWebSocketStub; }
if (typeof (globalThis as any).WebSocket === 'undefined') (globalThis as any).WebSocket = wsImpl;
if (typeof (global as any).WebSocket === 'undefined') (global as any).WebSocket = wsImpl;

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { app, ensureDatabaseInitialized } from './server/app.js';
import { startGoogleDriveAutoConnector } from './server/backups.js';

// Ensure sensible NODE_ENV default in packaged environments
if (!process.env.NODE_ENV && process.env.ELECTRON_RUN_AS_NODE) {
  process.env.NODE_ENV = 'production';
}

async function startServer() {
  // Initialize Cloud database connections and Supabase sync
  try {
    await ensureDatabaseInitialized();
    // Start automated headless Google Drive background daemon
    startGoogleDriveAutoConnector();
  } catch (err) {
    console.error('Database initialization warning:', err);
  }

  const PORT = Number(process.env.PORT) || 3000;

  // Serve uploads folder statically if available
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }

  // In development, mount Vite middleware dynamically
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite development server not active, serving static assets:', viteErr);
    }
  } else {
    // In production or Electron runtime, serve compiled SPA assets directly
    const distPath = fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(process.cwd(), 'dist');
      
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen on IPv4 localhost 127.0.0.1 to avoid Windows Firewall triggers and IPv6 conflicts
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Poultry LMS 360 Full-Stack Hub running on http://127.0.0.1:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is already in use. Assuming backend instance is active.`);
    } else {
      console.error('Server listen error:', err);
    }
  });
}

startServer();
