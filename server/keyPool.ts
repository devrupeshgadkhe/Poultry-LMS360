import fs from 'fs';
import path from 'path';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

interface KeyEntry {
  id: string;
  key: string;
  label: string;
  failedCount: number;
  cooldownUntil: number; // timestamp in ms
}

/**
 * Returns prioritized list of paths where Gemini keys can be stored or loaded.
 * Priority 1: User AppData (%APPDATA%\Poultry LMS 360\data or ~/.poultry360/data)
 *             Guaranteed writable on Windows/Mac/Linux even when installed in read-only C:\Program Files
 * Priority 2: Current working directory (used in local development or node server)
 * Priority 3: OS Temporary directory fallback
 */
function getCandidateKeyFilePaths(): string[] {
  const paths: string[] = [];

  // 1. User Application Data (Writable on Windows Desktop / Electron without elevation)
  try {
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      paths.push(path.join(appData, 'Poultry LMS 360', 'data', 'gemini_keys.txt'));
    } else {
      paths.push(path.join(os.homedir(), '.poultry360', 'data', 'gemini_keys.txt'));
    }
  } catch {}

  // 2. Local workspace directory (Dev environment or portable runtime)
  try {
    paths.push(path.join(process.cwd(), 'data', 'gemini_keys.txt'));
  } catch {}

  // 3. Fallback OS temp directory
  try {
    paths.push(path.join(os.tmpdir(), 'poultry360_data', 'gemini_keys.txt'));
  } catch {}

  return paths;
}

class GeminiKeyPoolManager {
  private keys: KeyEntry[] = [];
  private currentIndex: number = 0;

  constructor() {
    this.initKeys();
  }

  public initKeys() {
    const rawKeys: string[] = [];

    // 1. Check primary environment variable
    const primaryKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (primaryKey && primaryKey.trim().length > 10) {
      rawKeys.push(primaryKey.trim());
    }

    // 2. Check comma-separated list
    if (process.env.GEMINI_API_KEYS) {
      process.env.GEMINI_API_KEYS.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 10)
        .forEach(k => rawKeys.push(k));
    }

    // 3. Check numbered env keys (GEMINI_API_KEY_1 .. GEMINI_API_KEY_20)
    for (let i = 1; i <= 20; i++) {
      const numberedKey = process.env[`GEMINI_API_KEY_${i}`];
      if (numberedKey && numberedKey.trim().length > 10) {
        rawKeys.push(numberedKey.trim());
      }
    }

    // 4. Check persistent storage files across candidate directories
    const fileKeys = this.readFileKeys();
    fileKeys.forEach(k => rawKeys.push(k));

    // Deduplicate keys
    const uniqueKeys = Array.from(new Set(rawKeys));
    this.keys = uniqueKeys.map((key, idx) => {
      const existing = this.keys.find(k => k.key === key);
      return {
        id: `key_${idx + 1}`,
        key,
        label: `API Key #${idx + 1}`,
        failedCount: existing ? existing.failedCount : 0,
        cooldownUntil: existing ? existing.cooldownUntil : 0
      };
    });

    if (this.keys.length > 0) {
      console.log(`[KeyPool] Initialized Gemini key pool with ${this.keys.length} API key(s).`);
    } else {
      console.log('[KeyPool] No explicit GEMINI_API_KEY configured yet; ready for developer configuration.');
    }
  }

  public getNextClient(): { client: GoogleGenAI; keyId: string; key: string } | null {
    if (this.keys.length === 0) {
      this.initKeys();
    }

    // If still no keys explicitly listed in pool, try default empty client (relies on process.env.GEMINI_API_KEY)
    if (this.keys.length === 0) {
      const activeKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (activeKey) {
        return {
          client: new GoogleGenAI({ apiKey: activeKey }),
          keyId: 'default_env',
          key: activeKey
        };
      }
      return null;
    }

    const now = Date.now();

    // Find first key whose cooldown has expired
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const candidate = this.keys[idx];

      if (candidate.cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return {
          client: new GoogleGenAI({ apiKey: candidate.key }),
          keyId: candidate.id,
          key: candidate.key
        };
      }
    }

    // All keys on cooldown: pick the one with earliest cooldown expiry
    const earliestKey = [...this.keys].sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0];
    return {
      client: new GoogleGenAI({ apiKey: earliestKey.key }),
      keyId: earliestKey.id,
      key: earliestKey.key
    };
  }

  public markKeyCooldown(keyId: string, durationMs: number = 15 * 60 * 1000) {
    const target = this.keys.find(k => k.id === keyId);
    if (target) {
      target.failedCount++;
      target.cooldownUntil = Date.now() + durationMs;
      console.warn(`[KeyPool] Key ${target.label} placed on cooldown for ${Math.round(durationMs / 1000)}s.`);
    }
  }

  public hasAvailableKey(): boolean {
    if (this.keys.length === 0) {
      return Boolean(process.env.GEMINI_API_KEY);
    }
    const now = Date.now();
    return this.keys.some(k => k.cooldownUntil <= now);
  }

  public getKeyCount(): number {
    return this.keys.length;
  }

  public getMaskedKeys(): { id: string; label: string; maskedKey: string; isEnv: boolean; failedCount: number; cooldownUntil: number }[] {
    const fileKeys = this.readFileKeys();
    return this.keys.map(k => {
      const isFileKey = fileKeys.includes(k.key);
      const isEnv = !isFileKey && (k.key === process.env.GEMINI_API_KEY || k.key === process.env.API_KEY || Boolean(process.env[`GEMINI_API_KEY_${k.id}`]));
      const len = k.key.length;
      const masked = len > 8 
        ? `${k.key.substring(0, 4)}...${k.key.substring(len - 4)}` 
        : '****';
      return {
        id: k.id,
        label: k.label,
        maskedKey: masked,
        isEnv,
        failedCount: k.failedCount,
        cooldownUntil: k.cooldownUntil
      };
    });
  }

  public readFileKeys(): string[] {
    const rawKeys: string[] = [];
    const candidatePaths = getCandidateKeyFilePaths();

    for (const filePath of candidatePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          fileContent
            .split(/[\r\n,]+/)
            .map(k => k.trim())
            .filter(k => k.length > 10 && !k.startsWith('#'))
            .forEach(k => rawKeys.push(k));
        }
      } catch (e: any) {
        console.warn(`[KeyPool] Could not read ${filePath}: ${e.message}`);
      }
    }

    return Array.from(new Set(rawKeys));
  }

  public saveFileKeys(keys: string[]) {
    const unique = Array.from(new Set(keys.map(k => k.trim()).filter(k => k.length > 10)));
    const fileContent = unique.join('\n') + (unique.length > 0 ? '\n' : '');
    const candidatePaths = getCandidateKeyFilePaths();
    let writeSuccessCount = 0;

    for (const filePath of candidatePaths) {
      try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, fileContent, 'utf8');
        writeSuccessCount++;
      } catch (err: any) {
        // Safe fallback: when running in read-only C:\Program Files, continue to writable %APPDATA%
        console.warn(`[KeyPool] Note: Could not write to ${filePath} (${err.code || err.message}). Checking next writable location...`);
      }
    }

    if (writeSuccessCount === 0) {
      console.warn('[KeyPool] Warning: Filesystem is read-only. Keys are active in runtime memory.');
    }

    this.initKeys();
  }

  public addKey(newKey: string): { success: boolean; message: string } {
    try {
      const trimmed = newKey.trim();
      if (trimmed.length < 15) {
        return { success: false, message: 'Invalid API key format. Key must be at least 15 characters.' };
      }

      const currentFileKeys = this.readFileKeys();
      const existingInPool = this.keys.map(k => k.key);
      if (currentFileKeys.includes(trimmed) || existingInPool.includes(trimmed)) {
        return { success: false, message: 'This API key is already configured in the pool.' };
      }

      currentFileKeys.push(trimmed);
      this.saveFileKeys(currentFileKeys);

      // Verify that key is present in active memory pool immediately
      if (!this.keys.some(k => k.key === trimmed)) {
        this.keys.push({
          id: `key_${this.keys.length + 1}`,
          key: trimmed,
          label: `API Key #${this.keys.length + 1}`,
          failedCount: 0,
          cooldownUntil: 0
        });
      }

      return { success: true, message: 'API key added successfully to the Gemini key pool.' };
    } catch (err: any) {
      console.error('[KeyPool] Error adding key to disk, saving to memory pool:', err);
      const trimmed = newKey.trim();
      if (!this.keys.some(k => k.key === trimmed)) {
        this.keys.push({
          id: `key_${this.keys.length + 1}`,
          key: trimmed,
          label: `API Key #${this.keys.length + 1}`,
          failedCount: 0,
          cooldownUntil: 0
        });
      }
      return { success: true, message: 'API key added to active session pool.' };
    }
  }

  public removeKeyById(id: string): { success: boolean; message: string } {
    try {
      const target = this.keys.find(k => k.id === id);
      if (!target) {
        return { success: false, message: 'Key not found in pool.' };
      }

      const currentFileKeys = this.readFileKeys();
      const updated = currentFileKeys.filter(k => k !== target.key);
      this.keys = this.keys.filter(k => k.id !== id);
      this.saveFileKeys(updated);

      return { success: true, message: 'API key removed successfully.' };
    } catch (err: any) {
      console.error('[KeyPool] Error removing key:', err);
      this.keys = this.keys.filter(k => k.id !== id);
      return { success: true, message: 'API key removed from active pool.' };
    }
  }
}

export const keyPool = new GeminiKeyPoolManager();
