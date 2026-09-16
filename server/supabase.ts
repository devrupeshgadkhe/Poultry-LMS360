import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { query } from './db.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vrujjlytlbjezesupoxq.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_y7TO_O4yXG54m-czqOkvNQ_KlqyVaBN';

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetch all farms from Supabase
 */
export async function getSupabaseFarms() {
  const { data, error } = await supabaseServer
    .from('Farms')
    .select('*')
    .order('Id', { ascending: true });

  if (error) {
    console.error('[Supabase] Error fetching farms:', error.message);
    // Fall back to local SQLite if Supabase fails
    return await query.all('SELECT * FROM Farms ORDER BY Id ASC');
  }
  return data || [];
}

/**
 * Fetch all users from Supabase and join farm info
 */
export async function getSupabaseUsers() {
  const { data: users, error: userErr } = await supabaseServer
    .from('Users')
    .select('*')
    .order('Id', { ascending: true });

  if (userErr || !users) {
    console.error('[Supabase] Error fetching users:', userErr?.message);
    // Fall back to local SQLite if Supabase fails
    return await query.all(`
      SELECT u.Id, u.Username, u.Email, u.Role, u.FullName, u.IsActive, u.CreatedAt, u.Permissions, u.FarmId, u.PlainPassword, f.FarmName
      FROM Users u
      LEFT JOIN Farms f ON u.FarmId = f.Id
      ORDER BY u.Id ASC
    `);
  }

  // Fetch farms to join FarmName
  const farms = await getSupabaseFarms();
  const farmMap = new Map<number, string>();
  farms.forEach((f: any) => {
    farmMap.set(f.Id, f.FarmName);
  });

  // Get local plain passwords if stored locally
  const localUsers = await query.all('SELECT Username, PlainPassword FROM Users WHERE PlainPassword IS NOT NULL');
  const plainMap = new Map<string, string>();
  localUsers.forEach((lu: any) => {
    plainMap.set(lu.Username.toLowerCase(), lu.PlainPassword);
  });

  // Standard passwords for default root accounts
  if (!plainMap.has('admin')) plainMap.set('admin', 'admin123');
  if (!plainMap.has('developer')) plainMap.set('developer', 'dev123');
  if (!plainMap.has('staff')) plainMap.set('staff', 'staff123');

  return users.map((u: any) => ({
    Id: u.Id,
    Username: u.Username,
    Email: u.Email,
    Role: u.Role,
    FullName: u.FullName,
    IsActive: u.IsActive,
    CreatedAt: u.CreatedAt,
    Permissions: u.Permissions,
    FarmId: u.FarmId || 1,
    FarmName: farmMap.get(u.FarmId) || `Farm #${u.FarmId || 1}`,
    PlainPassword: plainMap.get(u.Username.toLowerCase()) || ''
  }));
}

/**
 * Create a new user directly in Supabase and sync to local SQLite
 */
export async function createSupabaseUser(userData: {
  username: string;
  email: string;
  password: string;
  role: string;
  fullName: string;
  farmId: number;
  permissions?: string;
}) {
  const hash = crypto.createHash('sha256').update(userData.password).digest('hex');

  const targetPerms = userData.permissions !== undefined 
    ? userData.permissions 
    : (userData.role === 'Admin' || userData.role === 'Developer' ? 'All' : '');

  // Deduplication check: prevent duplicate user accounts with identical username in the same farm
  const { data: existingUser } = await supabaseServer
    .from('Users')
    .select('Id')
    .ilike('Username', userData.username.trim())
    .eq('FarmId', userData.farmId);

  if (existingUser && existingUser.length > 0) {
    throw new Error(`An account with username "${userData.username}" already exists in this farm.`);
  }

  const { data, error } = await supabaseServer
    .from('Users')
    .insert([{
      Username: userData.username,
      Email: userData.email,
      PasswordHash: hash,
      Role: userData.role,
      FullName: userData.fullName,
      FarmId: userData.farmId,
      IsActive: 1,
      Permissions: targetPerms
    }])
    .select();

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  const created = data && data[0] ? data[0] : null;

  // Sync into local SQLite for offline access & plain password inspection
  try {
    await query.run(`
      INSERT OR REPLACE INTO Users (Id, Username, Email, PasswordHash, PlainPassword, Role, FullName, IsActive, Permissions, FarmId)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      created ? created.Id : null,
      userData.username,
      userData.email,
      hash,
      userData.password,
      userData.role,
      userData.fullName,
      targetPerms,
      userData.farmId
    ]);
  } catch (err: any) {
    console.warn('[Sync to SQLite] Warning:', err.message);
  }

  return created;
}

/**
 * Update an existing user in Supabase
 */
export async function updateSupabaseUser(id: number, updateData: {
  email?: string;
  role?: string;
  fullName?: string;
  isActive?: boolean | number;
  password?: string;
  farmId?: number;
  permissions?: string;
}) {
  const patch: Record<string, any> = {};
  if (updateData.email) patch.Email = updateData.email;
  if (updateData.role) patch.Role = updateData.role;
  if (updateData.fullName) patch.FullName = updateData.fullName;
  if (updateData.isActive !== undefined) patch.IsActive = updateData.isActive ? 1 : 0;
  if (updateData.farmId !== undefined) patch.FarmId = updateData.farmId;
  if (updateData.permissions !== undefined) patch.Permissions = updateData.permissions;

  let newHash: string | undefined;
  if (updateData.password && updateData.password.trim() !== '') {
    newHash = crypto.createHash('sha256').update(updateData.password).digest('hex');
    patch.PasswordHash = newHash;
  }

  const { data, error } = await supabaseServer
    .from('Users')
    .update(patch)
    .eq('Id', id)
    .select();

  if (error) {
    throw new Error(`Supabase update error: ${error.message}`);
  }

  // Sync to local SQLite
  try {
    if (newHash && updateData.password) {
      await query.run('UPDATE Users SET PasswordHash = ?, PlainPassword = ? WHERE Id = ?', [newHash, updateData.password, id]);
    }
    if (patch.Email) await query.run('UPDATE Users SET Email = ? WHERE Id = ?', [patch.Email, id]);
    if (patch.Role) await query.run('UPDATE Users SET Role = ? WHERE Id = ?', [patch.Role, id]);
    if (patch.FullName) await query.run('UPDATE Users SET FullName = ? WHERE Id = ?', [patch.FullName, id]);
    if (patch.IsActive !== undefined) await query.run('UPDATE Users SET IsActive = ? WHERE Id = ?', [patch.IsActive, id]);
    if (patch.FarmId !== undefined) await query.run('UPDATE Users SET FarmId = ? WHERE Id = ?', [patch.FarmId, id]);
    if (patch.Permissions !== undefined) await query.run('UPDATE Users SET Permissions = ? WHERE Id = ?', [patch.Permissions, id]);
  } catch (err: any) {
    console.warn('[Sync to SQLite] Warning on update:', err.message);
  }

  return data;
}

/**
 * Reset password in Supabase and sync local plain password
 */
export async function resetSupabasePassword(userId: number, newPass: string) {
  const hash = crypto.createHash('sha256').update(newPass).digest('hex');

  const { error } = await supabaseServer
    .from('Users')
    .update({ PasswordHash: hash })
    .eq('Id', userId);

  if (error) {
    throw new Error(`Supabase error resetting password: ${error.message}`);
  }

  // Update in SQLite
  try {
    await query.run('UPDATE Users SET PasswordHash = ?, PlainPassword = ? WHERE Id = ?', [hash, newPass, userId]);
  } catch (err: any) {
    console.warn('[Sync to SQLite] Warning on password reset:', err.message);
  }

  return true;
}

/**
 * Delete a user from Supabase and SQLite
 */
export async function deleteSupabaseUser(userId: number) {
  const { error } = await supabaseServer
    .from('Users')
    .delete()
    .eq('Id', userId);

  if (error) {
    throw new Error(`Supabase error deleting user: ${error.message}`);
  }

  try {
    await query.run('DELETE FROM Users WHERE Id = ?', [userId]);
  } catch (err: any) {
    console.warn('[Sync to SQLite] Warning on user delete:', err.message);
  }

  return true;
}

/**
 * Create a new farm in Supabase and provision initial admin user in Supabase
 */
export async function createSupabaseFarm(farmData: {
  FarmName: string;
  OwnerName?: string;
  ContactPhone?: string;
  ContactEmail?: string;
  Address?: string;
  adminUsername: string;
  adminEmail?: string;
  adminPassword: string;
}) {
  const trimmedName = (farmData.FarmName || '').trim();

  // Deduplication check: prevent creating multiple farms with the same name
  const { data: existingFarms } = await supabaseServer
    .from('Farms')
    .select('*')
    .ilike('FarmName', trimmedName);

  if (existingFarms && existingFarms.length > 0) {
    const existing = existingFarms[0];
    console.log(`[Supabase] Farm "${trimmedName}" already exists (ID #${existing.Id}). Returning existing record to prevent duplicates.`);
    return existing;
  }

  const { data: newFarm, error: farmErr } = await supabaseServer
    .from('Farms')
    .insert([{
      FarmName: trimmedName,
      OwnerName: farmData.OwnerName || '',
      ContactPhone: farmData.ContactPhone || '',
      ContactEmail: farmData.ContactEmail || '',
      Address: farmData.Address || '',
      IsActive: 1
    }])
    .select();

  if (farmErr) {
    throw new Error(`Supabase error creating farm: ${farmErr.message}`);
  }

  const createdFarm = newFarm && newFarm[0] ? newFarm[0] : null;
  const newFarmId = createdFarm?.Id;

  // Create initial FarmSettings for this new farm
  if (newFarmId) {
    try {
      await supabaseServer
        .from('FarmSettings')
        .upsert([{
          FarmId: newFarmId,
          FarmName: trimmedName,
          Address: farmData.Address || '',
          Phone: farmData.ContactPhone || '',
          Email: farmData.ContactEmail || '',
          IsGoogleDriveEnabled: 0
        }], { onConflict: 'FarmId' });
    } catch (settingsErr: any) {
      console.warn('[Supabase] Warning initializing FarmSettings:', settingsErr.message);
    }
  }

  // Create admin user in Supabase Users table
  if (farmData.adminUsername && newFarmId) {
    await createSupabaseUser({
      username: farmData.adminUsername,
      email: farmData.adminEmail || `${farmData.adminUsername}@farm.com`,
      password: farmData.adminPassword,
      role: 'Admin',
      fullName: farmData.OwnerName || `${farmData.FarmName} Admin`,
      farmId: newFarmId,
      permissions: 'All'
    });
  }

  // Also sync farm into SQLite
  try {
    await query.run(`
      INSERT OR REPLACE INTO Farms (Id, FarmName, OwnerName, ContactPhone, ContactEmail, Address, IsActive)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [
      createdFarm?.Id,
      trimmedName,
      farmData.OwnerName || '',
      farmData.ContactPhone || '',
      farmData.ContactEmail || '',
      farmData.Address || ''
    ]);
  } catch (err: any) {
    console.warn('[Sync to SQLite] Warning on farm create:', err.message);
  }

  return createdFarm;
}

/**
 * Sync single record to Supabase Cloud
 */
export async function syncRecordToSupabase(tableName: string, record: any): Promise<void> {
  if (!supabaseServer || !record) return;
  try {
    const cleanRecord = { ...record };
    // Upsert by Id if Id is present and > 0, otherwise insert
    if (cleanRecord.Id) {
      const { error } = await supabaseServer.from(tableName).upsert([cleanRecord], { onConflict: 'Id' });
      if (error) {
        console.warn(`[Supabase Push] Warning upserting to ${tableName}:`, error.message);
      }
    } else {
      const { error } = await supabaseServer.from(tableName).insert([cleanRecord]);
      if (error) {
        console.warn(`[Supabase Push] Warning inserting to ${tableName}:`, error.message);
      }
    }
  } catch (err: any) {
    console.warn(`[Supabase Push] Failed for ${tableName}:`, err.message);
  }
}

/**
 * Delete record from Supabase Cloud
 */
export async function deleteRecordFromSupabase(tableName: string, id: number, farmId?: number): Promise<void> {
  if (!supabaseServer || !id) return;
  try {
    let q = supabaseServer.from(tableName).delete().eq('Id', id);
    if (farmId) {
      q = q.eq('FarmId', farmId);
    }
    const { error } = await q;
    if (error) {
      console.warn(`[Supabase Delete] Warning on ${tableName} #${id}:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[Supabase Delete] Failed on ${tableName} #${id}:`, err.message);
  }
}

const OPERATIONAL_TABLES = [
  'Flocks',
  'DailyLogs',
  'Inventories',
  'EggInventories',
  'Vaccinations',
  'Customers',
  'Suppliers',
  'Purchases',
  'PurchaseItems',
  'Sales',
  'SaleItems',
  'FoodRecipes',
  'FinancialTransactions',
  'TransactionCategories',
  'Staff'
];

/**
 * Safe synchronization from Supabase Cloud (Single Source of Truth) to local SQLite cache.
 * Cloud data is pulled to keep local SQLite in sync, while preserving Supabase production data intact.
 */
export async function syncAllTablesBidirectional(): Promise<Record<string, { pulled: number; pushed: number }>> {
  const stats: Record<string, { pulled: number; pushed: number }> = {};
  if (!supabaseServer) return stats;

  try {
    // 1. Sync Farms, FarmSettings, & Users first from Supabase Cloud (SSOT)
    await syncSupabaseToLocal();

    // 2. Sync all operational tables from Supabase -> SQLite
    for (const table of OPERATIONAL_TABLES) {
      stats[table] = { pulled: 0, pushed: 0 };
      try {
        // Check if local table exists and get columns
        const colsInfo = await query.all(`PRAGMA table_info(\`${table}\`)`);
        if (!colsInfo || colsInfo.length === 0) continue;
        const localColNames = new Set(colsInfo.map((c: any) => c.name));

        // Pull from Supabase -> SQLite
        const { data: sbRows, error: sbErr } = await supabaseServer.from(table).select('*');
        if (!sbErr && sbRows && sbRows.length > 0) {
          for (const row of sbRows) {
            const filteredRow: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              if (localColNames.has(k)) {
                filteredRow[k] = v;
              }
            }
            const keys = Object.keys(filteredRow);
            if (keys.length > 0) {
              const columns = keys.map(k => `\`${k}\``).join(', ');
              const placeholders = keys.map(() => '?').join(', ');
              const values = keys.map(k => filteredRow[k]);
              await query.run(
                `INSERT OR REPLACE INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
                values
              );
              stats[table].pulled++;
            }
          }
        }
        // Note: Supabase Cloud is the Single Source of Truth (SSOT).
        // We do NOT blindly push local SQLite tables to Supabase on server boot,
        // which prevents development/preview restarts from ever overwriting or corrupting production data.
      } catch (tblErr: any) {
        console.warn(`[Cloud Sync] Warning on table ${table}:`, tblErr.message);
      }
    }
  } catch (err: any) {
    console.error('[Cloud Sync] Critical error:', err.message);
  }

  return stats;
}

/**
 * Sync Supabase data into local SQLite on startup
 */
export async function syncSupabaseToLocal() {
  try {
    console.log('[Supabase Sync] Starting synchronization from Supabase Cloud...');
    // 1. Sync Farms
    const { data: farms } = await supabaseServer.from('Farms').select('*');
    if (farms && farms.length > 0) {
      for (const f of farms) {
        await query.run(`
          INSERT OR REPLACE INTO Farms (Id, FarmName, OwnerName, ContactPhone, ContactEmail, Address, IsActive, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [f.Id, f.FarmName, f.OwnerName || '', f.ContactPhone || '', f.ContactEmail || '', f.Address || '', f.IsActive || 1, f.CreatedAt || new Date().toISOString()]);
      }
      console.log(`[Supabase Sync] Successfully synchronized ${farms.length} farms from Supabase.`);
    }

    // 2. Sync FarmSettings
    const { data: farmSettingsList } = await supabaseServer.from('FarmSettings').select('*');
    if (farmSettingsList && farmSettingsList.length > 0) {
      for (const fs of farmSettingsList) {
        const fId = fs.FarmId || fs.Id || 1;
        const localFs = await query.get('SELECT Id FROM FarmSettings WHERE FarmId = ?', [fId]);
        if (localFs) {
          await query.run(`
            UPDATE FarmSettings
            SET FarmName = ?, Address = ?, Phone = ?, Email = ?, Website = ?,
                LogoUrl = COALESCE(?, LogoUrl), IsGoogleDriveEnabled = ?
            WHERE FarmId = ?
          `, [
            fs.FarmName || '', fs.Address || '', fs.Phone || '', fs.Email || '', fs.Website || '',
            fs.LogoUrl, fs.IsGoogleDriveEnabled || 0,
            fId
          ]);
        } else {
          await query.run(`
            INSERT INTO FarmSettings (FarmId, FarmName, Address, Phone, Email, Website, LogoUrl, IsGoogleDriveEnabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            fId, fs.FarmName || '', fs.Address || '', fs.Phone || '', fs.Email || '', fs.Website || '',
            fs.LogoUrl || null, fs.IsGoogleDriveEnabled || 0
          ]);
        }
      }
      console.log(`[Supabase Sync] Successfully synchronized ${farmSettingsList.length} farm settings from Supabase.`);
    }

    // 3. Sync Users
    const { data: users } = await supabaseServer.from('Users').select('*');
    if (users && users.length > 0) {
      for (const u of users) {
        const existing = await query.get('SELECT PlainPassword FROM Users WHERE Id = ? OR LOWER(Username) = LOWER(?)', [u.Id, u.Username]);
        let plain = existing?.PlainPassword;
        if (!plain) {
          if (u.Username.toLowerCase() === 'admin') plain = 'admin123';
          else if (u.Username.toLowerCase() === 'developer') plain = 'dev123';
          else if (u.Username.toLowerCase() === 'staff') plain = 'staff123';
        }

        await query.run(`
          INSERT OR REPLACE INTO Users (Id, Username, Email, PasswordHash, PlainPassword, Role, FullName, IsActive, Permissions, FarmId, CreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          u.Id,
          u.Username,
          u.Email,
          u.PasswordHash,
          plain,
          u.Role,
          u.FullName,
          u.IsActive,
          u.Permissions,
          u.FarmId || 1,
          u.CreatedAt || new Date().toISOString()
        ]);
      }
      console.log(`[Supabase Sync] Successfully synchronized ${users.length} users from Supabase.`);
    }
  } catch (err: any) {
    console.error('[Supabase Sync] Failed to sync:', err.message);
  }
}
