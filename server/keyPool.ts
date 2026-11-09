import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

interface KeyEntry {
  id: string;
  key: string;
  label: string;
  failedCount: number;
  cooldownUntil: number; // timestamp in ms
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

    // 4. Check local text file if exists (e.g. data/gemini_keys.txt)
    const keyFilePath = path.join(process.cwd(), 'data', 'gemini_keys.txt');
    if (fs.existsSync(keyFilePath)) {
      try {
        const fileContent = fs.readFileSync(keyFilePath, 'utf8');
        fileContent.split(/[\r\n,]+/)
          .map(k => k.trim())
          .filter(k => k.length > 10 && !k.startsWith('#'))
          .forEach(k => rawKeys.push(k));
      } catch (e) {
        console.warn('[KeyPool] Could not read gemini_keys.txt:', e);
      }
    }

    // Deduplicate keys
    const uniqueKeys = Array.from(new Set(rawKeys));
    this.keys = uniqueKeys.map((key, idx) => ({
      id: `key_${idx + 1}`,
      key,
      label: `API Key #${idx + 1}`,
      failedCount: 0,
      cooldownUntil: 0
    }));

    if (this.keys.length > 0) {
      console.log(`[KeyPool] Initialized Gemini key pool with ${this.keys.length} API key(s).`);
    } else {
      console.log('[KeyPool] No explicit GEMINI_API_KEY found; will attempt environment default when invoked.');
    }
  }

  public getNextClient(): { client: GoogleGenAI; keyId: string; key: string } | null {
    if (this.keys.length === 0) {
      this.initKeys();
    }

    // If still no keys explicitly listed in pool, try default empty client (relies on process.env.GEMINI_API_KEY or process.env.API_KEY)
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
}

export const keyPool = new GeminiKeyPoolManager();
