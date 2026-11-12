import type { Request, Response } from 'express';
import { app, ensureDatabaseInitialized } from '../server/app.js';

export default async function handler(req: Request, res: Response) {
  try {
    await ensureDatabaseInitialized();
  } catch (err: any) {
    console.error('[Vercel API] Initialization warning:', err);
  }
  return app(req, res);
}
