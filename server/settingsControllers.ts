import { Request, Response } from 'express';
import { query } from './db.js';
import { logAudit } from './controllers.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { 
  getSupabaseUsers, 
  createSupabaseUser, 
  updateSupabaseUser, 
  resetSupabasePassword, 
  deleteSupabaseUser 
} from './supabase.js';

export const settingsControllers = {
  // GET /api/settings
  async getSettings(req: Request, res: Response) {
    try {
      let settings = await query.get('SELECT * FROM FarmSettings WHERE Id = 1');
      if (!settings) {
        // Fallback seed
        await query.run('INSERT INTO FarmSettings (FarmName, IsGoogleDriveEnabled) VALUES (?, ?)', ['Poultry LMS 360', 0]);
        settings = await query.get('SELECT * FROM FarmSettings WHERE Id = 1');
      }
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  // PUT /api/settings
  async updateSettings(req: Request, res: Response) {
    const { FarmName, Address, Phone, Email, Website, IsGoogleDriveEnabled } = req.body;
    try {
      // Direct update of Id = 1
      await query.run(`
        UPDATE FarmSettings
        SET FarmName = ?, Address = ?, Phone = ?, Email = ?, Website = ?, IsGoogleDriveEnabled = ?
        WHERE Id = 1
      `, [
        FarmName || 'Poultry LMS 360',
        Address || '',
        Phone || '',
        Email || '',
        Website || '',
        IsGoogleDriveEnabled ? 1 : 0
      ]);

      const updated = await query.get('SELECT * FROM FarmSettings WHERE Id = 1');
      await logAudit(req, '', 'Settings', 'Update Settings', req.body, 'SUCCESS');
      res.json({ message: 'Settings saved successfully', settings: updated });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Update Settings', req.body, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/settings/logo
  async uploadLogo(req: Request, res: Response) {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'No image data received.' });
      }

      // Check size (max 5MB)
      const buffer = Buffer.from(imageBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image file size exceeds the 5MB limits.' });
      }

      // Determine extension
      let ext = '.png';
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        ext = '.jpg';
      } else if (mimeType === 'image/svg+xml') {
        ext = '.svg';
      }

      // Resolve directory path
      const dirPath = path.join(process.cwd(), 'uploads', 'farm');
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Physical File Overwrite to preserve disk space
      const fileName = `farm_logo${ext}`;
      const fullPath = path.join(dirPath, fileName);
      
      fs.writeFileSync(fullPath, buffer);

      const dbUrl = `/uploads/farm/${fileName}`;
      await query.run('UPDATE FarmSettings SET LogoUrl = ? WHERE Id = 1', [dbUrl]);

      await logAudit(req, '', 'Settings', 'Upload Farm Logo', { url: dbUrl }, 'SUCCESS');
      res.json({ message: 'Logo successfully processed and updated.', logoUrl: dbUrl });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Upload Farm Logo', {}, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/settings/sync-ages
  async syncFlockAges(req: Request, res: Response) {
    try {
      const now = new Date();
      const activeFlocks = await query.all("SELECT * FROM Flocks WHERE Status = 'Active'");
      
      for (const flock of activeFlocks) {
        const start = new Date(flock.StartDate);
        const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        await query.run('UPDATE Flocks SET AgeInDays = ? WHERE Id = ?', [Math.max(0, days), flock.Id]);
      }

      await query.run('UPDATE FarmSettings SET LastAgeUpdateDate = ? WHERE Id = 1', [now.toISOString()]);
      await logAudit(req, '', 'Settings', 'Flock Biological Aging Sync', {}, 'SUCCESS');
      res.json({ message: 'All active layer flock age indices synchronized successfully.' });
    } catch (e: any) {
      await logAudit(req, '', 'Settings', 'Flock Biological Aging Sync', {}, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // Background trigger checks
  async backgroundSyncAges() {
    try {
      const settings = await query.get('SELECT * FROM FarmSettings WHERE Id = 1');
      if (!settings) return;

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
        const activeFlocks = await query.all("SELECT * FROM Flocks WHERE Status = 'Active'");
        for (const flock of activeFlocks) {
          const start = new Date(flock.StartDate);
          const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          await query.run('UPDATE Flocks SET AgeInDays = ? WHERE Id = ?', [Math.max(0, days), flock.Id]);
        }
        await query.run('UPDATE FarmSettings SET LastAgeUpdateDate = ? WHERE Id = 1', [now.toISOString()]);
        console.log('[JOBS] Background layer biological flock records updated.');
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
