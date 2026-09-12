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

export const userManagementControllers = {
  // GET /api/users
  async listUsers(req: Request, res: Response) {
    try {
      const users = await getSupabaseUsers();
      res.json(users || []);
    } catch (e: any) {
      console.error('Error in listUsers:', e);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/users
  async createUser(req: Request, res: Response) {
    const { username, email, password, role, fullName, permissions, Permissions, farmId } = req.body;
    const targetPerms = permissions !== undefined ? permissions : (Permissions !== undefined ? Permissions : '');
    try {
      if (!username || !email || !password || !role || !fullName) {
        return res.status(400).json({ error: 'Username, Email, password, Role, and FullName are required fields.' });
      }

      const created = await createSupabaseUser({
        username,
        email,
        password,
        role,
        fullName,
        farmId: Number(farmId) || 1,
        permissions: targetPerms
      });

      await logAudit(req, '', 'UserManagement', 'Create Operator Account', { Username: username, Role: role }, 'SUCCESS');
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
    try {
      await updateSupabaseUser(Number(id), {
        email: Email,
        role: Role,
        fullName: FullName,
        isActive: IsActive,
        permissions: targetPerms,
        password,
        farmId: FarmId ? Number(FarmId) : undefined
      });

      await logAudit(req, '', 'UserManagement', 'Update Operator Privileges', { id, Role, Permissions }, 'SUCCESS');
      res.json({ message: 'User updated successfully in Supabase' });
    } catch (e: any) {
      await logAudit(req, '', 'UserManagement', 'Update Operator Privileges', { id }, 'FAILED', e.message);
      res.status(500).json({ error: e.message });
    }
  },

  // POST /api/users/reset-password
  async resetPassword(req: Request, res: Response) {
    const { userId, newPassword } = req.body;
    try {
      if (!userId || !newPassword) {
        return res.status(400).json({ error: 'userId and newPassword are required' });
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
    try {
      const numId = Number(id);
      if (numId === 1 || numId === 2) {
        return res.status(403).json({ error: 'Default administrative root operator accounts cannot be deleted.' });
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
