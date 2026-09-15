import { Request, Response } from 'express';
import { query } from './db.js';
import { logAudit } from './controllers.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { 
  supabaseServer,
  getSupabaseUsers, 
  createSupabaseUser, 
  updateSupabaseUser, 
  resetSupabasePassword, 
  deleteSupabaseUser 
} from './supabase.js';

function getFarmIdFromRequest(req: Request): number {
  const requester = getRequester(req);
  if (requester && requester.Role && requester.Role !== 'Developer' && requester.FarmId) {
    return Number(requester.FarmId);
  }
  const headerId = req.headers['x-farm-id'];
  if (headerId && !isNaN(Number(headerId))) return Number(headerId);
  if (req.query.farmId && !isNaN(Number(req.query.farmId))) return Number(req.query.farmId);
  if (req.body && req.body.FarmId && !isNaN(Number(req.body.FarmId))) return Number(req.body.FarmId);
  if (req.body && req.body.farmId && !isNaN(Number(req.body.farmId))) return Number(req.body.farmId);
  return 1;
}

export const settingsControllers = {
  // GET /api/settings
  async getSettings(req: Request, res: Response) {
    try {
      const farmId = getFarmIdFromRequest(req);

      // 1. Fetch from Supabase Cloud first for real-time synchronization
      try {
        const { data: sbSetting, error } = await supabaseServer
          .from('FarmSettings')
          .select('*')
          .eq('FarmId', farmId)
          .maybeSingle();

        if (!error && sbSetting) {
          // Sync/mirror to local SQLite
          const localRow = await query.get('SELECT Id FROM FarmSettings WHERE FarmId = ?', [farmId]);
          if (localRow) {
            await query.run(`
              UPDATE FarmSettings
              SET FarmName = ?, Address = ?, Phone = ?, Email = ?, Website = ?,
                  LogoUrl = COALESCE(?, LogoUrl), IsGoogleDriveEnabled = ?
              WHERE FarmId = ?
            `, [
              sbSetting.FarmName || '', sbSetting.Address || '', sbSetting.Phone || '',
              sbSetting.Email || '', sbSetting.Website || '', sbSetting.LogoUrl,
              sbSetting.IsGoogleDriveEnabled ? 1 : 0, farmId
            ]);
          } else {
            await query.run(`
              INSERT INTO FarmSettings (FarmId, FarmName, Address, Phone, Email, Website, LogoUrl, IsGoogleDriveEnabled)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              farmId, sbSetting.FarmName || '', sbSetting.Address || '', sbSetting.Phone || '',
              sbSetting.Email || '', sbSetting.Website || '', sbSetting.LogoUrl || null,
              sbSetting.IsGoogleDriveEnabled ? 1 : 0
            ]);
          }
          return res.json(sbSetting);
        }
      } catch (sbErr: any) {
        console.warn('[settingsControllers.getSettings] Supabase fetch warning:', sbErr.message);
      }

      // 2. Fetch from local SQLite
      let settings = await query.get('SELECT * FROM FarmSettings WHERE FarmId = ?', [farmId]);
      if (!settings) {
        // Fallback seed from Farms table
        const farmInfo = await query.get('SELECT * FROM Farms WHERE Id = ?', [farmId]);
        const initialName = farmInfo?.FarmName || `Farm #${farmId}`;
        const initialAddress = farmInfo?.Address || '';
        const initialPhone = farmInfo?.ContactPhone || '';
        const initialEmail = farmInfo?.ContactEmail || '';

        const ins = await query.run(`
          INSERT INTO FarmSettings (FarmId, FarmName, Address, Phone, Email, Website, IsGoogleDriveEnabled)
          VALUES (?, ?, ?, ?, ?, '', 0)
        `, [farmId, initialName, initialAddress, initialPhone, initialEmail]);

        settings = await query.get('SELECT * FROM FarmSettings WHERE Id = ?', [ins.lastID]);

        // Push to Supabase Cloud
        try {
          await supabaseServer.from('FarmSettings').insert([{
            FarmId: farmId,
            FarmName: initialName,
            Address: initialAddress,
            Phone: initialPhone,
            Email: initialEmail,
            Website: '',
            IsGoogleDriveEnabled: 0
          }]);
        } catch (pushErr: any) {
          console.warn('[settingsControllers] Failed to push new farm settings to Supabase:', pushErr.message);
        }
      }
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // PUT /api/settings
  async updateSettings(req: Request, res: Response) {
    const farmId = getFarmIdFromRequest(req);
    const { FarmName, Address, Phone, Email, Website, IsGoogleDriveEnabled } = req.body;
    try {
      // 1. Update in local SQLite
      const existing = await query.get('SELECT Id FROM FarmSettings WHERE FarmId = ?', [farmId]);
      if (existing) {
        await query.run(`
          UPDATE FarmSettings
          SET FarmName = ?, Address = ?, Phone = ?, Email = ?, Website = ?, IsGoogleDriveEnabled = ?
          WHERE FarmId = ?
        `, [
          FarmName || 'Poultry Farm',
          Address || '',
          Phone || '',
          Email || '',
          Website || '',
          IsGoogleDriveEnabled ? 1 : 0,
          farmId
        ]);
      } else {
        await query.run(`
          INSERT INTO FarmSettings (FarmId, FarmName, Address, Phone, Email, Website, IsGoogleDriveEnabled)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          farmId,
          FarmName || 'Poultry Farm',
          Address || '',
          Phone || '',
          Email || '',
          Website || '',
          IsGoogleDriveEnabled ? 1 : 0
        ]);
      }

      // Also keep local Farms table synchronized
      await query.run(`
        UPDATE Farms
        SET FarmName = ?, Address = ?, ContactPhone = ?, ContactEmail = ?
        WHERE Id = ?
      `, [
        FarmName || 'Poultry Farm',
        Address || '',
        Phone || '',
        Email || '',
        farmId
      ]);

      const updated = await query.get('SELECT * FROM FarmSettings WHERE FarmId = ?', [farmId]);

      // 2. Direct write to Supabase Cloud for multi-device synchronization
      try {
        const { data: sbExisting } = await supabaseServer
          .from('FarmSettings')
          .select('Id')
          .eq('FarmId', farmId)
          .maybeSingle();

        if (sbExisting) {
          await supabaseServer
            .from('FarmSettings')
            .update({
              FarmName: FarmName || 'Poultry Farm',
              Address: Address || '',
              Phone: Phone || '',
              Email: Email || '',
              Website: Website || '',
              IsGoogleDriveEnabled: IsGoogleDriveEnabled ? 1 : 0
            })
            .eq('FarmId', farmId);
        } else {
          await supabaseServer
            .from('FarmSettings')
            .insert([{
              FarmId: farmId,
              FarmName: FarmName || 'Poultry Farm',
              Address: Address || '',
              Phone: Phone || '',
              Email: Email || '',
              Website: Website || '',
              IsGoogleDriveEnabled: IsGoogleDriveEnabled ? 1 : 0
            }]);
        }

        // Also update Supabase Farms table
        await supabaseServer
          .from('Farms')
          .update({
            FarmName: FarmName || 'Poultry Farm',
            Address: Address || '',
            ContactPhone: Phone || '',
            ContactEmail: Email || ''
          })
          .eq('Id', farmId);

      } catch (sbErr: any) {
        console.warn('[updateSettings] Supabase Cloud update warning:', sbErr.message);
      }

      await logAudit(req, '', 'Settings', 'Update Settings', { farmId, ...req.body }, 'SUCCESS');
      res.json({ message: 'Settings saved successfully', settings: updated });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Update Settings', { farmId, ...req.body }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/settings/logo
  async uploadLogo(req: Request, res: Response) {
    try {
      const farmId = getFarmIdFromRequest(req);
      const { imageBase64, mimeType, dataUrl: incomingDataUrl } = req.body;
      if (!imageBase64 && !incomingDataUrl) {
        return res.status(400).json({ error: 'No image data received.' });
      }

      // Construct standard dataUrl format for cross-device compatibility
      let dataUrl = incomingDataUrl;
      let rawBase64 = imageBase64 || '';
      if (rawBase64.startsWith('data:')) {
        dataUrl = rawBase64;
        rawBase64 = rawBase64.split(',')[1] || '';
      } else if (!dataUrl && rawBase64) {
        dataUrl = `data:${mimeType || 'image/png'};base64,${rawBase64}`;
      } else if (dataUrl && !rawBase64) {
        rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      }

      // Check size (max 5MB)
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image file size exceeds the 5MB limits.' });
      }

      // 1. Direct Save to Supabase Cloud FarmSettings table
      try {
        const { data: sbExisting } = await supabaseServer
          .from('FarmSettings')
          .select('Id')
          .eq('FarmId', farmId)
          .maybeSingle();

        if (sbExisting) {
          const { error: sbUpdateErr } = await supabaseServer
            .from('FarmSettings')
            .update({ LogoUrl: dataUrl })
            .eq('FarmId', farmId);
          if (sbUpdateErr) console.error('[uploadLogo] Supabase error:', sbUpdateErr.message);
        } else {
          await supabaseServer
            .from('FarmSettings')
            .insert([{ FarmId: farmId, LogoUrl: dataUrl, FarmName: `Farm #${farmId}` }]);
        }
      } catch (sbErr: any) {
        console.warn('[uploadLogo] Supabase Cloud logo update warning:', sbErr.message);
      }

      // 2. Save in local SQLite database
      const localExisting = await query.get('SELECT Id FROM FarmSettings WHERE FarmId = ?', [farmId]);
      if (localExisting) {
        await query.run('UPDATE FarmSettings SET LogoUrl = ? WHERE FarmId = ?', [dataUrl, farmId]);
      } else {
        await query.run('INSERT INTO FarmSettings (FarmId, LogoUrl, FarmName) VALUES (?, ?, ?)', [farmId, dataUrl, `Farm #${farmId}`]);
      }

      // 3. Physical file backup on disk for local serving
      try {
        let ext = '.png';
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
        else if (mimeType === 'image/svg+xml') ext = '.svg';
        const dirPath = path.join(process.cwd(), 'uploads', 'farm');
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        const fileName = `farm_${farmId}_logo${ext}`;
        fs.writeFileSync(path.join(dirPath, fileName), buffer);
      } catch (diskErr: any) {
        console.warn('[uploadLogo] Local disk cache write warning:', diskErr.message);
      }

      await logAudit(req, '', 'Settings', 'Upload Farm Logo', { farmId, url: 'Supabase Cloud Data URI' }, 'SUCCESS');
      res.json({ message: 'Logo successfully saved in Supabase and updated.', logoUrl: dataUrl });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Upload Farm Logo', {}, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/settings/sync-ages
  async syncFlockAges(req: Request, res: Response) {
    try {
      const farmId = getFarmIdFromRequest(req);
      const now = new Date();
      const activeFlocks = await query.all("SELECT * FROM Flocks WHERE Status = 'Active' AND FarmId = ?", [farmId]);
      
      for (const flock of activeFlocks) {
        const start = new Date(flock.StartDate);
        const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        await query.run('UPDATE Flocks SET AgeInDays = ? WHERE Id = ? AND FarmId = ?', [Math.max(0, days), flock.Id, farmId]);
      }

      await query.run('UPDATE FarmSettings SET LastAgeUpdateDate = ? WHERE FarmId = ?', [now.toISOString(), farmId]);
      try {
        await supabaseServer.from('FarmSettings').update({ LastAgeUpdateDate: now.toISOString() }).eq('FarmId', farmId);
      } catch {}

      await logAudit(req, '', 'Settings', 'Flock Biological Aging Sync', { farmId }, 'SUCCESS');
      res.json({ message: 'All active layer flock age indices synchronized successfully.' });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Flock Biological Aging Sync', {}, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // Background trigger checks
  async backgroundSyncAges() {
    try {
      const allFarms = await query.all('SELECT Id FROM Farms');
      for (const farm of (allFarms || [{ Id: 1 }])) {
        const farmId = farm.Id;
        const settings = await query.get('SELECT * FROM FarmSettings WHERE FarmId = ?', [farmId]);
        if (!settings) continue;

        const lastUpdate = settings.LastAgeUpdateDate;
        const now = new Date();
        let performSync = false;

        if (!lastUpdate) {
          performSync = true;
        } else {
          const diffMs = now.getTime() - new Date(lastUpdate).getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs >= 24) {
            performSync = true;
          }
        }

        if (performSync) {
          const activeFlocks = await query.all("SELECT * FROM Flocks WHERE Status = 'Active' AND FarmId = ?", [farmId]);
          for (const flock of activeFlocks) {
            const start = new Date(flock.StartDate);
            const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            await query.run('UPDATE Flocks SET AgeInDays = ? WHERE Id = ? AND FarmId = ?', [Math.max(0, days), flock.Id, farmId]);
          }
          await query.run('UPDATE FarmSettings SET LastAgeUpdateDate = ? WHERE FarmId = ?', [now.toISOString(), farmId]);
          try {
            await supabaseServer.from('FarmSettings').update({ LastAgeUpdateDate: now.toISOString() }).eq('FarmId', farmId);
          } catch {}
          console.log(`[JOBS] Background layer biological flock records updated for Farm #${farmId}.`);
        }
      }
    } catch (e: any) {
      console.error('[JOBS] Biological aging job exception:', e.message);
    }
  }
};

function getRequester(req: Request): { Role?: string; FarmId?: number; Id?: number; Username?: string } | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const b64 = authHeader.substring(7);
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);
      if (payload && payload.Role) {
        return payload;
      }
    } catch {}
  }
  const role = req.headers['x-user-role'] as string;
  const farmId = req.headers['x-farm-id'] ? Number(req.headers['x-farm-id']) : undefined;
  if (role) {
    return { Role: role, FarmId: farmId };
  }
  return null;
}

export const userManagementControllers = {
  // GET /api/users
  async listUsers(req: Request, res: Response) {
    try {
      const requester = getRequester(req);
      let users = await getSupabaseUsers();

      if (requester && requester.Role !== 'Developer') {
        const farmId = Number(requester.FarmId) || 1;
        // Farm Admin / Staff can only see users of their own farm, and never developer accounts
        users = (users || []).filter((u: any) =>
          u.Role !== 'Developer' && Number(u.FarmId || 1) === farmId
        );
      }

      res.json(users || []);
    } catch (e: any) {
      console.error('Error in listUsers:', e);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/users
  async createUser(req: Request, res: Response) {
    const { username, email, password, role, fullName, permissions, Permissions, farmId } = req.body;
    const requester = getRequester(req);

    // Multi-tenant check:
    // If requester is not Developer, they can only create 'Staff' (operators) for their own farm!
    let targetRole = role || 'Staff';
    let targetFarmId = Number(farmId) || 1;

    if (requester && requester.Role !== 'Developer') {
      targetRole = 'Staff'; // Farm Admin can only create Staff/Operators
      targetFarmId = Number(requester.FarmId) || 1; // Locked to their farm
    }

    const targetPerms = permissions !== undefined ? permissions : (Permissions !== undefined ? Permissions : '');
    try {
      if (!username || !email || !password || !fullName) {
        return res.status(400).json({ error: 'Username, Email, password, and FullName are required fields.' });
      }

      const created = await createSupabaseUser({
        username,
        email,
        password,
        role: targetRole,
        fullName,
        farmId: targetFarmId,
        permissions: targetPerms
      });

      await logAudit(req, '', 'UserManagement', 'Create Operator Account', { Username: username, Role: targetRole, FarmId: targetFarmId }, 'SUCCESS');
      res.status(201).json({ message: 'Operator account created successfully in Supabase', userId: created?.Id });
    } catch (e: any) {
      await logAudit(req, '', 'UserManagement', 'Create Operator Account', { Username: username }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // PUT /api/users/:id
  async updateUser(req: Request, res: Response) {
    const { id } = req.params;
    const { Email, Role, FullName, IsActive, Permissions, permissions, password, FarmId } = req.body;
    const targetPerms = permissions !== undefined ? permissions : Permissions;
    const requester = getRequester(req);

    try {
      let targetRole = Role;
      let targetFarmId = FarmId ? Number(FarmId) : undefined;

      if (requester && requester.Role !== 'Developer') {
        const allUsers = await getSupabaseUsers();
        const existing = (allUsers || []).find((u: any) => u.Id === Number(id));
        if (existing) {
          if (existing.Role === 'Developer') {
            return res.status(403).json({ error: 'Unauthorized: Cannot modify Developer account.' });
          }
          if (existing.Role === 'Admin' && Number(existing.Id) !== Number(requester.Id)) {
            return res.status(403).json({ error: 'Unauthorized: Cannot modify another Administrator account.' });
          }
          if (Number(existing.FarmId || 1) !== Number(requester.FarmId || 1)) {
            return res.status(403).json({ error: 'Unauthorized: You can only manage users within your own farm.' });
          }
          targetRole = existing.Role; // preserve Role
        } else {
          targetRole = 'Staff';
        }
        targetFarmId = Number(requester.FarmId) || 1;
      }

      await updateSupabaseUser(Number(id), {
        email: Email,
        role: targetRole,
        fullName: FullName,
        isActive: IsActive,
        permissions: targetPerms,
        password,
        farmId: targetFarmId
      });

      await logAudit(req, '', 'UserManagement', 'Update Operator Privileges', { id, Role: targetRole, Permissions }, 'SUCCESS');
      res.json({ message: 'User updated successfully in Supabase' });
    } catch (e: any) {
      await logAudit(req, '', 'UserManagement', 'Update Operator Privileges', { id }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/users/reset-password
  async resetPassword(req: Request, res: Response) {
    const { userId, newPassword } = req.body;
    const requester = getRequester(req);
    try {
      if (!userId || !newPassword) {
        return res.status(400).json({ error: 'userId and newPassword are required' });
      }

      if (requester && requester.Role !== 'Developer') {
        const allUsers = await getSupabaseUsers();
        const existing = (allUsers || []).find((u: any) => u.Id === Number(userId));
        if (existing) {
          if (existing.Role === 'Developer') {
            return res.status(403).json({ error: 'Unauthorized: Cannot reset Developer password.' });
          }
          if (existing.Role === 'Admin' && Number(existing.Id) !== Number(requester.Id)) {
            return res.status(403).json({ error: 'Unauthorized: Cannot reset another Administrator password.' });
          }
          if (Number(existing.FarmId || 1) !== Number(requester.FarmId || 1)) {
            return res.status(403).json({ error: 'Unauthorized: You can only reset passwords for users in your own farm.' });
          }
        }
      }

      await resetSupabasePassword(Number(userId), newPassword);
      await logAudit(req, '', 'UserManagement', 'Reset Password', { userId }, 'SUCCESS');
      res.json({ message: 'Password reset successfully in Supabase' });
    } catch (e: any) {
      await logAudit(req, '', 'UserManagement', 'Reset Password', { userId }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // DELETE /api/users/:id
  async deleteUser(req: Request, res: Response) {
    const { id } = req.params;
    const requester = getRequester(req);
    try {
      const numId = Number(id);
      if (numId === 1 || numId === 2) {
        return res.status(403).json({ error: 'Default administrative root operator accounts cannot be deleted.' });
      }

      if (requester && requester.Role !== 'Developer') {
        const allUsers = await getSupabaseUsers();
        const existing = (allUsers || []).find((u: any) => u.Id === numId);
        if (existing) {
          if (existing.Role === 'Developer' || existing.Role === 'Admin') {
            return res.status(403).json({ error: 'Farm Administrators cannot delete Admin or Developer accounts.' });
          }
          if (Number(existing.FarmId || 1) !== Number(requester.FarmId || 1)) {
            return res.status(403).json({ error: 'You can only delete operators from your own farm.' });
          }
        }
      }

      await deleteSupabaseUser(numId);
      await logAudit(req, '', 'UserManagement', 'De-register Operator', { id }, 'SUCCESS');
      res.json({ message: 'Operator account removed successfully from Supabase.' });
    } catch (e: any) {
      await logAudit(req, '', 'UserManagement', 'De-register Operator', { id }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/audit_logs_filtered
  async getAuditLogsFiltered(req: Request, res: Response) {
    try {
      const { search, module, status, limit } = req.query;
      let sql = 'SELECT * FROM AuditLogs';
      const params: any[] = [];
      const conditions: string[] = [];

      if (search) {
        conditions.push('(UserEmail LIKE ? OR Action LIKE ? OR Parameters LIKE ? OR ExceptionMessage LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (module) {
        conditions.push('Module = ?');
        params.push(module);
      }
      if (status) {
        conditions.push('Status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY Timestamp DESC';

      const parsedLimit = limit ? parseInt(limit as string) : 100;
      sql += ' LIMIT ?';
      params.push(parsedLimit);

      const logs = await query.all(sql, params);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
