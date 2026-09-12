import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { query, dbPath } from './db.js';

/**
 * Encryption helpers for database backups.
 * Encrypts and decrypts backup JSON data using AES-256-CBC.
 */
export function encrypt(text: string, key: string): string {
  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string, key: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted backup format (missing IV separator)');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const derivedKey = crypto.createHash('sha256').update(key).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function getEncryptedBackup(backupObj: any): { encrypted: boolean; data: string } {
  const key = process.env.BACKUP_ENCRYPTION_KEY || 'PoultryLMS360SecureDefaultBackupKey_2026';
  const plainText = JSON.stringify(backupObj);
  const encryptedStr = encrypt(plainText, key);
  return {
    encrypted: true,
    data: encryptedStr
  };
}

const CLIENT_ID = "599268286154-1n602i9gvsdjkjjiv8aukrum5rp0dp0h.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

const backupsDir = path.join(path.dirname(dbPath), 'poultry360_backups');

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

interface TableBackup {
  name: string;
  schema: string;
  rows: any[];
}

interface BackupJson {
  version: string;
  timestamp: string;
  tables: TableBackup[];
}

/**
 * Creates a JSON containing all database schemas and data.
 */
export async function getBackupData(): Promise<BackupJson> {
  const tables = await query.all<{ name: string; sql: string }>(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  );
  
  const tableBackups: TableBackup[] = [];
  for (const table of tables) {
    const rows = await query.all(`SELECT * FROM \`${table.name}\``);
    tableBackups.push({
      name: table.name,
      schema: table.sql,
      rows
    });
  }
  
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    tables: tableBackups
  };
}

/**
 * Restores the entire database from a parsed backup JSON (handles encrypted or plain format).
 */
export async function restoreBackupData(backup: any): Promise<void> {
  let finalBackup = backup;
  
  if (backup && backup.encrypted === true && typeof backup.data === 'string') {
    const key = process.env.BACKUP_ENCRYPTION_KEY || 'PoultryLMS360SecureDefaultBackupKey_2026';
    try {
      const decryptedStr = decrypt(backup.data, key);
      finalBackup = JSON.parse(decryptedStr);
    } catch (err: any) {
      throw new Error(`Failed to decrypt backup payload: ${err.message}. Please verify your BACKUP_ENCRYPTION_KEY is correct.`);
    }
  }

  if (!finalBackup || !Array.isArray(finalBackup.tables)) {
    throw new Error('Invalid backup file format');
  }

  const backupToRestore: BackupJson = finalBackup;

  // 1. Turn off foreign keys constraint checking temporarily
  await query.run('PRAGMA foreign_keys = OFF');

  try {
    // 2. Drop all tables FIRST (outside massive transaction to avoid SQLite schema locked errors)
    for (const table of backupToRestore.tables) {
      await query.run(`DROP TABLE IF EXISTS \`${table.name}\``);
    }

    // 3. Recreate all table structures
    for (const table of backupToRestore.tables) {
      if (table.schema) {
        await query.run(table.schema);
      }
    }

    // 4. Populate rows inside a transaction for atomic speed & stability
    await query.run('BEGIN TRANSACTION');
    try {
      for (const table of backupToRestore.tables) {
        if (table.rows && table.rows.length > 0) {
          for (const row of table.rows) {
            const keys = Object.keys(row);
            if (keys.length === 0) continue;
            
            const columns = keys.map(k => `\`${k}\``).join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => row[k]);
            
            await query.run(
              `INSERT INTO \`${table.name}\` (${columns}) VALUES (${placeholders})`,
              values
            );
          }
        }
      }
      await query.run('COMMIT');
    } catch (insertErr) {
      try {
        await query.run('ROLLBACK');
      } catch (rbErr) {
        console.error('SQLite ROLLBACK failed:', rbErr);
      }
      throw insertErr;
    }

  } finally {
    // 5. Restore foreign keys checking
    await query.run('PRAGMA foreign_keys = ON');
  }
}

export async function getGitHubConfig() {
  try {
    const farm = await query.get<{ GithubBackupPat: string; GithubBackupRepo: string; GithubBackupBranch: string; GithubBackupPath: string }>(
      'SELECT GithubBackupPat, GithubBackupRepo, GithubBackupBranch, GithubBackupPath FROM FarmSettings LIMIT 1'
    );
    if (farm) {
      let pat = farm.GithubBackupPat || process.env.GITHUB_BACKUP_PAT || '';
      if (pat.startsWith('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')) {
        pat = process.env.GITHUB_BACKUP_PAT || '';
      }
      const repo = farm.GithubBackupRepo || process.env.GITHUB_BACKUP_REPO || 'devrupeshgadkhe/Poultry360-Backups';
      const branch = farm.GithubBackupBranch || process.env.GITHUB_BACKUP_BRANCH || 'main';
      const folderPath = farm.GithubBackupPath || process.env.GITHUB_BACKUP_PATH || 'backups';
      return { pat, repo, branch, folderPath };
    }
  } catch (e) {
    console.warn('[GitHub Backup] Error loading config from DB:', e);
  }
  let pat = process.env.GITHUB_BACKUP_PAT || '';
  if (pat.startsWith('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')) {
    pat = '';
  }
  return {
    pat,
    repo: process.env.GITHUB_BACKUP_REPO || 'devrupeshgadkhe/Poultry360-Backups',
    branch: process.env.GITHUB_BACKUP_BRANCH || 'main',
    folderPath: process.env.GITHUB_BACKUP_PATH || 'backups'
  };
}

/**
 * Upload backup content to a GitHub repository.
 */
export async function uploadToGitHub(filename: string, contentStr: string): Promise<any> {
  const gitConfig = await getGitHubConfig();
  const pat = gitConfig.pat;
  const repo = gitConfig.repo;
  
  if (!pat || !repo) {
    console.log('[GitHub Backup] Skipping GitHub upload: GITHUB_BACKUP_PAT or GITHUB_BACKUP_REPO not configured.');
    return null;
  }

  const cleanPat = pat.trim();
  const cleanRepo = repo.trim();
  const branch = (gitConfig.branch || 'main').trim();
  const folderPath = (gitConfig.folderPath || '').trim().replace(/\/$/, '');
  
  const repoPath = folderPath ? `${folderPath}/${filename}` : filename;
  const url = `https://api.github.com/repos/${cleanRepo}/contents/${repoPath}`;
  
  const base64Content = Buffer.from(contentStr, 'utf8').toString('base64');
  
  console.log(`[GitHub Backup] Syncing encrypted backup ${filename} to GitHub repo: ${cleanRepo} (${branch})...`);
  
  // Helper to fetch the current SHA of the file if it exists (uses cache-busting)
  const fetchCurrentSha = async (): Promise<string | undefined> => {
    try {
      const getUrl = branch 
        ? `${url}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}` 
        : `${url}?_t=${Date.now()}`;
      const getRes = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Authorization': `token ${cleanPat}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Poultry-LMS-360-Backup-Service',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (getRes.status === 200) {
        const getJson = await getRes.json() as any;
        if (getJson && getJson.sha) {
          return getJson.sha;
        }
      }
    } catch (getErr: any) {
      console.warn(`[GitHub Backup] Failed to fetch current file SHA: ${getErr.message}`);
    }
    return undefined;
  };

  let sha = await fetchCurrentSha();
  if (sha) {
    console.log(`[GitHub Backup] Found existing file on GitHub. Retrieved SHA: ${sha}`);
  }

  try {
    let response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${cleanPat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Poultry-LMS-360-Backup-Service'
      },
      body: JSON.stringify({
        message: `Automated Poultry LMS 360 Backup: ${filename}`,
        content: base64Content,
        branch: branch,
        ...(sha ? { sha } : {})
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      // Case 0: 401 Unauthorized - Bad credentials or expired Personal Access Token
      if (response.status === 401) {
        console.warn('[GitHub Backup] GitHub API credentials unauthorized or token expired. Clearing invalid token from settings.');
        try {
          await query.run('UPDATE FarmSettings SET GithubBackupPat = NULL WHERE GithubBackupPat = ?', [cleanPat]);
        } catch {}
        return null;
      }
      // Case 1: If repository is empty, specifying 'branch' fails with 409 "reference already exists".
      // We retry without specifying 'branch' to let GitHub initialize the default branch.
      if (response.status === 409 && errText.includes('reference already exists')) {
        console.log(`[GitHub Backup] Reference conflict detected (likely empty repo). Retrying without branch parameter...`);
        response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${cleanPat}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Poultry-LMS-360-Backup-Service'
          },
          body: JSON.stringify({
            message: `Automated Poultry LMS 360 Backup: ${filename}`,
            content: base64Content,
            ...(sha ? { sha } : {})
          })
        });

        if (!response.ok) {
          const retryErrText = await response.text();
          throw new Error(`GitHub API upload failed on retry (empty repo): ${response.statusText} - ${retryErrText}`);
        }
      }
      // Case 2: SHA mismatch conflict (e.g. "is at ... but expected ...").
      // We fetch/parse the fresh SHA and retry the PUT.
      else if (response.status === 409) {
        console.log(`[GitHub Backup] SHA collision state detected (409). Resolving fresh SHA...`);
        let freshSha: string | undefined;

        // Try to parse the true current SHA from the response message first (highly robust, circumvents CDN caching)
        const match = errText.match(/is at ([0-9a-f]{40})\b/i);
        if (match && match[1]) {
          freshSha = match[1];
          console.log(`[GitHub Backup] Retrieved current file SHA from GitHub message: ${freshSha}`);
        }

        // Fallback to fetching via GET if parsing failed
        if (!freshSha) {
          freshSha = await fetchCurrentSha();
        }

        if (freshSha) {
          console.log(`[GitHub Backup] Resolved SHA: ${freshSha}. Retrying PUT...`);
          response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${cleanPat}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'Poultry-LMS-360-Backup-Service'
            },
            body: JSON.stringify({
              message: `Automated Poultry LMS 360 Backup: ${filename}`,
              content: base64Content,
              branch: branch,
              sha: freshSha
            })
          });

          if (!response.ok) {
            const retryErrText = await response.text();
            throw new Error(`GitHub API upload failed on retry with resolved SHA: ${response.statusText} - ${retryErrText}`);
          }
        } else {
          throw new Error(`GitHub API upload failed with conflict and could not resolve a matching SHA: ${response.statusText} - ${errText}`);
        }
      } else {
        throw new Error(`GitHub API upload failed: ${response.statusText} - ${errText}`);
      }
    }

    const result = await response.json();
    console.log(`[GitHub Backup] Successfully uploaded backup to GitHub! Commit SHA: ${result.commit?.sha || 'unknown'}`);
    return result;
  } catch (err: any) {
    console.warn(`[GitHub Backup] Notice during GitHub upload: ${err.message}`);
    return null;
  }
}

/**
 * Helper to get current farm name from settings.
 */
async function getFarmName(): Promise<string> {
  try {
    const settings = await query.get<any>('SELECT FarmName FROM FarmSettings LIMIT 1');
    return settings?.FarmName || 'Poultry_LMS_360';
  } catch (err) {
    return 'Poultry_LMS_360';
  }
}

/**
 * Clean farm name to be safe for a filename.
 */
function cleanFarmNameForFilename(farmName: string): string {
  return farmName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Perform an automatic/local backup (encrypted JSON).
 */
export async function triggerAutoBackup(): Promise<{ filename: string; size: number }> {
  const farmName = await getFarmName();
  const cleanFarm = cleanFarmNameForFilename(farmName);
  const backup = await getBackupData();
  const encryptedBackup = getEncryptedBackup(backup);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${cleanFarm}_${timestamp}.json`;
  const filepath = path.join(backupsDir, filename);
  
  const content = JSON.stringify(encryptedBackup, null, 2);
  fs.writeFileSync(filepath, content, 'utf8');

  // Keep max 10 backups, clean older ones
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => {
        const p = path.join(backupsDir, f);
        return { name: f, path: p, time: fs.statSync(p).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      const toDelete = files.slice(10);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
      }
    }
  } catch (err) {
    console.error('Error pruning local backups:', err);
  }

  // Upload to GitHub if configured
  try {
    const gitConfig = await getGitHubConfig();
    if (gitConfig.pat && gitConfig.repo) {
      await uploadToGitHub(filename, content);
    }
  } catch (gitErr: any) {
    console.warn('[GitHub Backup] Auto backup could not be uploaded to GitHub:', gitErr.message);
  }

  const stat = fs.statSync(filepath);
  return { filename, size: stat.size };
}

/**
 * Refresh Google Access Token using Refresh Token.
 */
async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh Google token: ${errText}`);
  }

  const data = await response.json();
  
  // Save access token and updated expiry
  const expiry = Date.now() + (data.expires_in * 1000);
  await query.run(
    'UPDATE FarmSettings SET GoogleDriveAccessToken = ?, GoogleDriveTokenExpiry = ? WHERE Id = 1',
    [data.access_token, expiry]
  );

  return data.access_token;
}

/**
 * Upload content to Google Drive.
 */
export async function uploadToGoogleDrive(accessToken: string, filename: string, contentStr: string): Promise<any> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const contentType = 'application/json';
  const metadata = {
    name: filename,
    mimeType: contentType,
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${contentType}\r\n\r\n` +
    contentStr +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(Buffer.byteLength(multipartRequestBody)),
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API failed: ${response.statusText} - ${errText}`);
  }

  return await response.json();
}

/**
 * Helper to refresh first, then upload to Google Drive.
 */
async function uploadToGoogleDriveFromRefreshToken(refreshToken: string, filename: string, contentStr: string): Promise<any> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  return await uploadToGoogleDrive(accessToken, filename, contentStr);
}

/**
 * Backup controllers for mounting onto routes.
 */
export const backupControllers = {
  // Get redirect URI
  getRedirectUri(req: any): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '') + '/api/backups/gdrive/callback';
  },

  // GET /api/backups/export
  async exportBackup(req: any, res: any) {
    try {
      const farmName = await getFarmName();
      const cleanFarm = cleanFarmNameForFilename(farmName);
      const data = await getBackupData();
      const encryptedData = getEncryptedBackup(data);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=backup_${cleanFarm}.json`);
      res.send(JSON.stringify(encryptedData, null, 2));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/restore
  async restoreBackup(req: any, res: any) {
    try {
      const backup = req.body;
      await restoreBackupData(backup);
      res.json({ message: 'System database restored successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/auto
  async triggerAuto(req: any, res: any) {
    try {
      const result = await triggerAutoBackup();
      res.json({ message: 'Auto backup executed successfully.', ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/backups/local
  async listLocal(req: any, res: any) {
    try {
      if (!fs.existsSync(backupsDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const p = path.join(backupsDir, f);
          const stat = fs.statSync(p);
          return {
            filename: f,
            size: stat.size,
            createdAt: stat.mtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      res.json(files);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/backups/local/:filename/download
  async downloadLocal(req: any, res: any) {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filepath = path.join(backupsDir, safeFilename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup snapshot file not found.' });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${safeFilename}`);
      fs.createReadStream(filepath).pipe(res);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/local/:filename/restore
  async restoreLocal(req: any, res: any) {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filepath = path.join(backupsDir, safeFilename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup snapshot file not found.' });
      }

      const raw = fs.readFileSync(filepath, 'utf8');
      const backup = JSON.parse(raw);
      await restoreBackupData(backup);
      res.json({ message: 'System database restored successfully from local snapshot.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // DELETE /api/backups/local/:filename
  async deleteLocal(req: any, res: any) {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filepath = path.join(backupsDir, safeFilename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      res.json({ message: 'Local backup file deleted.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/backups/gdrive/auth-url
  async getGDriveAuthUrl(req: any, res: any) {
    try {
      const redirectUri = backupControllers.getRedirectUri(req);
      const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline',
        prompt: 'consent'
      }).toString();
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/backups/gdrive/callback
  async handleGDriveCallback(req: any, res: any) {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    try {
      const redirectUri = backupControllers.getRedirectUri(req);
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google token exchange failed: ${errText}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;
      const refreshToken = data.refresh_token; // will only be returned during consent prompt
      const expiry = Date.now() + (data.expires_in * 1000);

      // Retrieve connected email
      let email = 'Google Client Connection';
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          email = userInfo.email || email;
        }
      } catch (err) {
        console.error('Error fetching google user info:', err);
      }

      // Consistently update/inject settings row 1 details
      const settings = await query.get('SELECT * FROM FarmSettings ORDER BY Id LIMIT 1');
      if (settings) {
        await query.run(
          `UPDATE FarmSettings 
           SET IsGoogleDriveEnabled = 1, 
               GoogleDriveAccessToken = ?, 
               GoogleDriveRefreshToken = COALESCE(?, GoogleDriveRefreshToken), 
               GoogleDriveTokenExpiry = ?, 
               GoogleDriveEmail = ?
           WHERE Id = ?`,
          [accessToken, refreshToken || null, expiry, email, settings.Id]
        );
      } else {
        await query.run(
          `INSERT INTO FarmSettings (FarmName, IsGoogleDriveEnabled, GoogleDriveAccessToken, GoogleDriveRefreshToken, GoogleDriveTokenExpiry, GoogleDriveEmail)
           VALUES ('Poultry LMS 360', 1, ?, ?, ?, ?)`,
          [accessToken, refreshToken || null, expiry, email]
        );
      }

      // Send postMessage and safely close popup window
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 100px; background: #0f172a; color: #fff;">
            <div style="background: #1e293b; padding: 40px; border-radius: 20px; display: inline-block; border: 1px solid #334155;">
              <h1 style="color: #6366f1; margin-bottom: 10px;">Cloud System Authorized</h1>
              <p style="color: #94a3b8; font-size: 14px;">Secure Google Storage authentication was completed successfully!</p>
              <br/>
              <p style="color: #475569; font-size: 11px;">This window should close automatically...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (e: any) {
      console.error(e);
      res.status(500).send(`Authentication error: ${e.message}`);
    }
  },

  // POST /api/backups/gdrive/sync
  async forceGDriveSync(req: any, res: any) {
    try {
      const gitConfig = await getGitHubConfig();
      const pat = gitConfig.pat;
      const repo = gitConfig.repo;
      if (!pat || !repo) {
        return res.status(400).json({ error: 'Automated Cloud Sync is not configured. Please link your GitHub Repository in the settings below.' });
      }

      const farmName = await getFarmName();
      const cleanFarm = cleanFarmNameForFilename(farmName);
      const backup = await getBackupData();
      const encryptedBackup = getEncryptedBackup(backup);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `manual_backup_${cleanFarm}_${timestamp}.json`;
      const content = JSON.stringify(encryptedBackup, null, 2);

      const uploadResult = await uploadToGitHub(filename, content);
      if (!uploadResult) {
        return res.status(400).json({ error: 'GitHub upload could not complete. Please check that your Personal Access Token is valid and has repository permissions.' });
      }
      res.json({ message: 'Database backup synchronized to secure cloud repository successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/gdrive/disconnect
  async disconnectGDrive(req: any, res: any) {
    try {
      await query.run(`
        UPDATE FarmSettings
        SET GithubBackupPat = NULL, GithubBackupRepo = NULL, GithubBackupBranch = NULL, GithubBackupPath = NULL
      `);
      res.json({ message: 'Cloud storage successfully unlinked and disconnected.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/backups/status
  async getStatus(req: any, res: any) {
    try {
      const gitConfig = await getGitHubConfig();
      const isGitHubConfigured = !!(gitConfig.pat && gitConfig.repo);
      res.json({
        isLinked: isGitHubConfigured,
        isEnabled: isGitHubConfigured,
        email: isGitHubConfigured ? `GitHub Repository: ${gitConfig.repo}` : "Unconfigured",
        repo: gitConfig.repo || '',
        branch: gitConfig.branch || 'main',
        folderPath: gitConfig.folderPath || 'backups'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/github/configure
  async configureGitHub(req: any, res: any) {
    try {
      const { pat, repo, branch, folderPath } = req.body;
      if (!pat || !pat.trim()) {
        return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
      }
      if (!repo || !repo.trim()) {
        return res.status(400).json({ error: 'GitHub Repository is required.' });
      }

      await query.run(`
        UPDATE FarmSettings
        SET GithubBackupPat = ?, GithubBackupRepo = ?, GithubBackupBranch = ?, GithubBackupPath = ?
      `, [pat.trim(), repo.trim(), (branch || 'main').trim(), (folderPath || 'backups').trim()]);

      res.json({ message: 'GitHub Backup configuration saved successfully.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/backups/gdrive/manual-auth
  async manualGDriveAuth(req: any, res: any) {
    try {
      const { codeOrToken } = req.body;
      if (!codeOrToken || !codeOrToken.trim()) {
        return res.status(400).json({ error: 'Please enter a valid Google Refresh Token or Authorization Code.' });
      }

      const cleanCode = codeOrToken.trim();
      const redirectUri = backupControllers.getRedirectUri(req);
      let accessToken = '';
      let refreshToken = '';
      let expiry = 0;

      // 1. Try treating it as an Authorization Code
      try {
        const exchangeResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            code: cleanCode,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (exchangeResponse.ok) {
          const data = await exchangeResponse.json();
          accessToken = data.access_token;
          refreshToken = data.refresh_token || cleanCode;
          expiry = Date.now() + (data.expires_in * 1000);
        } else {
          // Trigger fallback to direct Refresh Token check
          throw new Error('Fallback to direct Refresh Token check');
        }
      } catch (err) {
        // 2. Try treating it as a Refresh Token directly
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: cleanCode,
            grant_type: 'refresh_token'
          })
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          accessToken = data.access_token;
          refreshToken = cleanCode;
          expiry = Date.now() + (data.expires_in * 1000);
        } else {
          const errText = await refreshResponse.text();
          throw new Error(`Google API declined connection criteria. Please ensure the token is correct: ${errText}`);
        }
      }

      // 3. Fetch Authorized Google Email
      let email = 'Google Service Sync Account';
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          email = userInfo.email || email;
        }
      } catch (err) {
        console.warn('Could not parse Google user email credentials:', err);
      }

      // 4. Update the settings storage
      const settings = await query.get('SELECT * FROM FarmSettings ORDER BY Id LIMIT 1');
      if (settings) {
        await query.run(
          `UPDATE FarmSettings 
           SET IsGoogleDriveEnabled = 1, 
               GoogleDriveAccessToken = ?, 
               GoogleDriveRefreshToken = ?, 
               GoogleDriveTokenExpiry = ?, 
               GoogleDriveEmail = ?
           WHERE Id = ?`,
          [accessToken, refreshToken, expiry, email, settings.Id]
        );
      } else {
        await query.run(
          `INSERT INTO FarmSettings (FarmName, IsGoogleDriveEnabled, GoogleDriveAccessToken, GoogleDriveRefreshToken, GoogleDriveTokenExpiry, GoogleDriveEmail)
           VALUES ('Poultry LMS 360', 1, ?, ?, ?, ?)`,
          [accessToken, refreshToken, expiry, email]
        );
      }

      res.json({ success: true, message: 'Google Cloud Drive connection verified and active!', email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};

let autoConnectorTimer: NodeJS.Timeout | null = null;
let isCurrentlyAutoConnecting = false;

export function startGoogleDriveAutoConnector() {
  if (autoConnectorTimer) {
    clearInterval(autoConnectorTimer);
  }

  // Run immediately on boot
  runAutoConnectionCheck();

  // Run periodically every 15 seconds to check if internet starts working
  autoConnectorTimer = setInterval(() => {
    runAutoConnectionCheck();
  }, 15000);
}

async function runAutoConnectionCheck() {
  if (isCurrentlyAutoConnecting) return;

  const envToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!envToken || !envToken.trim()) {
    return; // No pre-configured token, skip headless setup
  }

  isCurrentlyAutoConnecting = true;
  try {
    const settings = await query.get('SELECT * FROM FarmSettings ORDER BY Id LIMIT 1');
    const cleanToken = envToken.trim();

    // Determine if we are already connected to the SAME refresh token and Google Drive is enabled
    const isAlreadyFullyConnected = settings &&
      settings.GoogleDriveRefreshToken === cleanToken &&
      settings.IsGoogleDriveEnabled === 1;

    if (!isAlreadyFullyConnected) {
      console.log('[GDrive Auto-Connect] Attempting headless Google Drive self-commissioning...');
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: cleanToken,
          grant_type: 'refresh_token'
        })
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const accessToken = data.access_token;
        const expiry = Date.now() + (data.expires_in * 1000);

        let email = process.env.GOOGLE_DRIVE_EMAIL || 'Automated Sync Account';
        try {
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            email = userInfo.email || email;
          }
        } catch (uErr: any) {
          console.warn('[GDrive Auto-Connect] Could not fetch Google user info details:', uErr.message);
        }

        if (settings) {
          await query.run(
            `UPDATE FarmSettings 
             SET IsGoogleDriveEnabled = 1, 
                 GoogleDriveAccessToken = ?, 
                 GoogleDriveRefreshToken = ?, 
                 GoogleDriveTokenExpiry = ?, 
                 GoogleDriveEmail = ?
             WHERE Id = ?`,
            [accessToken, cleanToken, expiry, email, settings.Id]
          );
        } else {
          await query.run(
            `INSERT INTO FarmSettings (FarmName, IsGoogleDriveEnabled, GoogleDriveAccessToken, GoogleDriveRefreshToken, GoogleDriveTokenExpiry, GoogleDriveEmail)
             VALUES ('Poultry LMS 360', 1, ?, ?, ?, ?)`,
            [accessToken, cleanToken, expiry, email]
          );
        }
        console.log(`[GDrive Auto-Connect] Headless Google Drive connected successfully for: ${email}`);

        // Trigger initial automatic backup to Google Drive
        try {
          console.log('[GDrive Auto-Connect] Triggering initial automated backup stream to Google Drive...');
          await triggerAutoBackup();
        } catch (backupErr: any) {
          console.warn('[GDrive Auto-Connect] Initial automated backup failed:', backupErr.message);
        }
      } else {
        const errText = await refreshResponse.text();
        console.warn('[GDrive Auto-Connect] Google Drive headless refresh token rejected (system may be offline):', errText);
      }
    }
  } catch (err: any) {
    console.error('[GDrive Auto-Connect] Error in background connector loop:', err.message);
  } finally {
    isCurrentlyAutoConnecting = false;
  }
}
