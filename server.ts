import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { app, ensureDatabaseInitialized } from './server/app.js';
import { startGoogleDriveAutoConnector } from './server/backups.js';

async function startServer() {
  // Initialize SQLite schema, Supabase sync and seeds
  try {
    await ensureDatabaseInitialized();
    // Start automated headless Google Drive self-commissioning background daemon
    startGoogleDriveAutoConnector();
  } catch (err) {
    console.error('Critical database initialization failure:', err);
  }

  const PORT = 3000;

  // Serve uploads folder statically so frontend can access images
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
  }

  // Enable Hot Reloading / Static Delivery Assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Packaged assets reside directly in the compiled dist directory where server.cjs resides.
    // If running in development, fall back to process.cwd() + '/dist'.
    const distPath = fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(process.cwd(), 'dist');
      
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Poultry LMS 360 Full-Stack Hub running on official port http://localhost:${PORT}`);
  });
}

startServer();
