import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Shield,
  Activity,
  Cloud,
  Layers,
  History,
  Plus,
  Edit,
  Trash2,
  Database,
  Settings,
  Check,
  Search,
  AlertTriangle,
  Key,
  RefreshCw,
  FileText,
  Lock,
  User,
  Info,
  Calendar,
  X,
  Smartphone,
  Globe,
  Mail,
  Phone
} from 'lucide-react';
import { Language, translations } from '../translations';

interface FarmSettings {
  Id: number;
  FarmName: string;
  Address: string;
  Phone: string;
  Email: string;
  Website: string;
  LogoUrl: string;
  LastAgeUpdateDate: string;
  IsGoogleDriveEnabled: number;
  GoogleDriveEmail: string;
  LastBackupDate: string;
}

interface UserOperator {
  Id: number;
  Username: string;
  Email: string;
  Role: string;
  FullName: string;
  IsActive: number;
  Permissions: string;
}

interface AuditLog {
  Id: number;
  Timestamp: string;
  UserEmail: string;
  Module: string;
  Action: string;
  Parameters: string;
  Status: string;
  ExceptionMessage: string;
  StackTrace: string;
  IpAddress: string;
  HttpMethod: string;
  Url: string;
}

const MODULE_PERMISSIONS_MATRIX = [
  { module: 'Dashboard Metrics', view: 'dashboard.view' },
  { module: 'Layer Flocks Registry', view: 'flocks.view', create: 'flocks.create', edit: 'flocks.edit', delete: 'flocks.delete' },
  { module: 'Daily Progress Logs', view: 'dailylogs.view', create: 'dailylogs.create', edit: 'dailylogs.edit', delete: 'dailylogs.delete' },
  { module: 'Flock Vaccinations', view: 'health.view', create: 'health.create', edit: 'health.edit', delete: 'health.delete' },
  { module: 'Warehouse stock lists', view: 'inventory.view', create: 'inventory.create', edit: 'inventory.edit', delete: 'inventory.delete' },
  { module: 'Stakeholders ledgering', view: 'customers.view', create: 'customers.create', edit: 'customers.edit', delete: 'customers.delete' },
  { module: 'Procurement Purchases', view: 'purchases.view', create: 'purchases.create', edit: 'purchases.edit', delete: 'purchases.delete' },
  { module: 'POS Customer Sales Desk', view: 'sales.view', create: 'sales.create', edit: 'sales.edit', delete: 'sales.delete' },
  { module: 'Double-entry dynamic ledger', view: 'financials.view', create: 'financials.create', edit: 'financials.edit', delete: 'financials.delete' },
  { module: 'Analytical Performance Reports', view: 'reports.view' },
  { module: 'Global Farm configuration parameters', view: 'settings.view', edit: 'settings.edit' },
];

export default function SettingsAudit({ currentLanguage = 'en' }: { currentLanguage?: Language }) {
  const t = translations[currentLanguage];

  // Active user roles (checking self Role inside localStorage or cookies)
  const myRole = localStorage.getItem('userRole') || 'Worker';

  // Farm settings states
  const [farmSettings, setFarmSettings] = useState<FarmSettings>({
    Id: 1,
    FarmName: 'Poultry LMS 360',
    Address: '',
    Phone: '',
    Email: '',
    Website: '',
    LogoUrl: '',
    LastAgeUpdateDate: '',
    IsGoogleDriveEnabled: 0,
    GoogleDriveEmail: '',
    LastBackupDate: ''
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // User management states
  const [users, setUsers] = useState<UserOperator[]>([]);
  const [editingUser, setEditingUser] = useState<UserOperator | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userPassword, setUserPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [userForm, setUserForm] = useState({
    Username: '',
    Email: '',
    Role: 'Staff',
    FullName: '',
    IsActive: true,
    Permissions: [] as string[]
  });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = useState<string | null>(null);

  // Audit Logs states
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedException, setSelectedException] = useState<AuditLog | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    search: '',
    module: '',
    status: '',
    limit: '50'
  });
  const [auditLoading, setAuditLoading] = useState(false);

  // Biological updates state
  const [syncingAges, setSyncingAges] = useState(false);

  // Standard loads
  const loadData = async () => {
    try {
      // 1. Fetch settings
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data) {
          setFarmSettings(data);
          setLogoPreview(data.LogoUrl || null);
        }
      }

      // 2. Fetch users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
      }

      // 3. Fetch logs
      fetchAuditLogs();
    } catch (e) {
      console.error('Failed to load settings module dependencies:', e);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const queryParams = new URLSearchParams(auditFilters).toString();
      const logsRes = await fetch(`/api/audit_logs_filtered?${queryParams}`);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Could not load filtered system audits:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);
    setSettingsLoading(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(farmSettings)
      });
      const resData = await res.json();
      if (res.ok) {
        setSettingsSuccess('Dynamic corporate credentials saved successfully');
        setFarmSettings(resData.settings);
      } else {
        setSettingsError(resData.error || 'Server rejected changes');
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Network interface exception');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Selected image size exceeds 5MB maximum limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = reader.result as string;
      const base64Content = resultStr.split(',')[1];
      try {
        setSettingsLoading(true);
        const res = await fetch('/api/settings/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Content,
            mimeType: file.type
          })
        });
        const data = await res.json();
        if (res.ok) {
          setLogoPreview(data.logoUrl);
          setFarmSettings(prev => ({ ...prev, LogoUrl: data.logoUrl }));
          setSettingsSuccess('Corporate business logo processed and overwritten on storage.');
        } else {
          setSettingsError(data.error || 'Logo processing failed');
        }
      } catch (err: any) {
        setSettingsError(err.message || 'Failed connecting to upload processing stream');
      } finally {
        setSettingsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerAgeSync = async () => {
    setSyncingAges(true);
    try {
      const res = await fetch('/api/settings/sync-ages', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'System flock ages updated successfully.');
        // Refresh local settings to see latest timestamp
        loadData();
      } else {
        alert(data.error || 'Flock age synchronization rejected by server.');
      }
    } catch (e: any) {
      alert('Biological sync failed: ' + e.message);
    } finally {
      setSyncingAges(false);
    }
  };

  // Open User Dialog for Creation/Editing
  const openUserForm = (user: UserOperator | null = null) => {
    setUserFormError(null);
    setUserFormSuccess(null);
    setUserPassword('');

    if (user) {
      if (myRole !== 'Developer' && (user.Role === 'Developer' || user.Role === 'Admin')) {
        alert('Security Restriction: Farm Administrators cannot modify Admin or Developer accounts. Only Developer SuperAdmin has this authorization.');
        return;
      }
      setIsNewUser(false);
      setEditingUser(user);
      const permArray = user.Permissions ? user.Permissions.split(',') : [];
      setUserForm({
        Username: user.Username,
        Email: user.Email,
        Role: user.Role,
        FullName: user.FullName,
        IsActive: user.IsActive === 1,
        Permissions: permArray
      });
    } else {
      setIsNewUser(true);
      setEditingUser(null);
      setUserForm({
        Username: '',
        Email: '',
        Role: 'Staff',
        FullName: '',
        IsActive: true,
        Permissions: []
      });
    }
    setUserModalOpen(true);
  };

  const handlePermissionToggle = (perm: string) => {
    setUserForm(prev => {
      const exists = prev.Permissions.includes(perm);
      const updated = exists
        ? prev.Permissions.filter(p => p !== perm)
        : [...prev.Permissions, perm];
      return { ...prev, Permissions: updated };
    });
  };

  const handleSelectAllPermissions = () => {
    const list: string[] = [];
    MODULE_PERMISSIONS_MATRIX.forEach(row => {
      if (row.view) list.push(row.view);
      if (row.create) list.push(row.create);
      if (row.edit) list.push(row.edit);
      if (row.delete) list.push(row.delete);
    });
    // Add implicit root admin claim ONLY for Developer
    if (myRole === 'Developer') {
      list.push('admin');
    }
    setUserForm(prev => ({ ...prev, Permissions: list }));
  };

  const handleClearAllPermissions = () => {
    setUserForm(prev => ({ ...prev, Permissions: [] }));
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    // Validate email
    if (!userForm.Email.includes('@')) {
      setUserFormError('Please enter a valid operator email address');
      return;
    }

    if (isNewUser && !userPassword.trim()) {
      setUserFormError('Password mandatory on newly formulated operators');
      return;
    }

    // Role security enforcement: Farm Admins can ONLY create or maintain Staff/Operator accounts
    const targetRole = myRole === 'Developer' ? userForm.Role : 'Staff';
    let cleanPerms = userForm.Permissions;
    if (myRole !== 'Developer') {
      cleanPerms = cleanPerms.filter(p => p !== 'admin');
    }

    const permString = cleanPerms.join(',');
    const payload = {
      username: userForm.Username,
      email: userForm.Email,
      fullName: userForm.FullName,
      role: targetRole,
      IsActive: userForm.IsActive ? 1 : 0,
      Permissions: permString,
      permissions: permString,
      Email: userForm.Email,
      FullName: userForm.FullName,
      Role: targetRole,
      password: userPassword
    };

    try {
      const url = isNewUser ? '/api/users' : `/api/users/${editingUser?.Id}`;
      const method = isNewUser ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'X-User-Role': myRole
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setUserFormSuccess(isNewUser ? 'Operator security credential generated successfully' : 'Operator credentials and Access Claim rules compiled successfully.');
        setTimeout(() => {
          setUserModalOpen(false);
          loadData();
        }, 1200);
      } else {
        setUserFormError(data.error || 'Server rejected Operator command');
      }
    } catch (err: any) {
      setUserFormError(err.message || 'Connection timeout');
    }
  };

  const handleDeleteUser = async (user: UserOperator) => {
    if (user.Username === 'admin' || user.Username === 'developer') {
      alert('Default system administrative profiles are locked and cannot be deleted.');
      return;
    }
    if (myRole !== 'Developer' && (user.Role === 'Developer' || user.Role === 'Admin')) {
      alert('Security Restriction: Farm Administrators cannot delete Admin or Developer accounts. Only Developer SuperAdmin has this authorization.');
      return;
    }
    if (!confirm(`Are you absolutely sure you want to completely de-register operator "${user.FullName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.Id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'X-User-Role': myRole
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Operator de-registered successfully.');
        loadData();
      } else {
        alert(data.error || 'Failed deleting user profile');
      }
    } catch (e: any) {
      alert('Delete operation error: ' + e.message);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="settings-audit-module">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black font-display text-slate-800 tracking-tight">{t.settingsAudit}</h2>
          <p className="text-xs text-slate-500">Administered parameters, corporate branding presets, operator access matrices, and physical system audit trails</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 smooth-hover"
            title="Refresh statistics and indexes"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleTriggerAgeSync}
            disabled={syncingAges}
            className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold tracking-wide flex items-center gap-2 smooth-hover`}
            id="trigger-age-sync-btn"
          >
            <Activity className="h-4 w-4" />
            {syncingAges ? 'Syncing...' : (currentLanguage === 'hi' ? 'जैविक रिकॉर्ड उम्र बढ़ना बलपूर्वक करें' : currentLanguage === 'mr' ? 'जैविक रेकॉर्ड वृद्धत्व सक्ती करा' : currentLanguage === 'gu' ? 'જૈવિક રેકોર્ડ વૃદ્ધત્વ દબાણ કરો' : currentLanguage === 'te' ? 'బయోలాజికల్ రికార్డ్స్ వృద్ధాప్యం బలవంతం చేయండి' : currentLanguage === 'bn' ? 'জৈবিক রেকর্ড বয়স বাড়ানো জোরপূর্বক করুন' : 'Force biological records aging')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Corporate Configuration */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 smooth-shadow space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800">Corporate Identity Configuration</h3>
                <p className="text-xs text-slate-400">Dynamic template elements used globally to generate bill / invoice page headers</p>
              </div>
            </div>

            {settingsError && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-mono">
                <b>Operation Rejected:</b> {settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-xs font-mono">
                <b>Success:</b> {settingsSuccess}
              </div>
            )}

            <form onSubmit={handleSettingsSubmit} className="space-y-6">
              
              {/* Logo Streamer row */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 border border-slate-150/80 rounded-2xl">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden relative">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Building className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 text-white text-[10px] font-sans font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300 cursor-pointer"
                  >
                    Replace Image
                  </button>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Farm Brand Logo</h4>
                  <p className="text-slate-400 text-[11px] max-w-xs">Upload corporate identity marks. Maximum file size of 5 megabytes. JPEG, PNG, or SVG formats preferred.</p>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-500 font-mono font-bold"
                  >
                    Select Logo File &hellip;
                  </button>
                </div>
              </div>

              {/* Form entries */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Poultry Farm Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 focus:border-indigo-600 text-slate-800 text-sm focus:outline-hidden smooth-hover font-medium font-sans"
                    value={farmSettings.FarmName}
                    onChange={(e) => setFarmSettings({ ...farmSettings, FarmName: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Website URL</label>
                  <input
                    type="url"
                    placeholder="https://www.example.com"
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 focus:border-indigo-600 text-slate-800 text-sm focus:outline-hidden smooth-hover font-mono"
                    value={farmSettings.Website || ''}
                    onChange={(e) => setFarmSettings({ ...farmSettings, Website: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Support Email Address</label>
                  <input
                    type="email"
                    placeholder="info@yourfarm.com"
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 focus:border-indigo-600 text-slate-800 text-sm focus:outline-hidden smooth-hover font-mono"
                    value={farmSettings.Email || ''}
                    onChange={(e) => setFarmSettings({ ...farmSettings, Email: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Representative phone</label>
                  <input
                    type="text"
                    placeholder="+91 &hellip;"
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 focus:border-indigo-600 text-slate-800 text-sm focus:outline-hidden smooth-hover font-mono"
                    value={farmSettings.Phone || ''}
                    onChange={(e) => setFarmSettings({ ...farmSettings, Phone: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Physical Headquarter Address Coordinate</label>
                  <input
                    type="text"
                    placeholder="Street, District, Region, Country Pin Code"
                    className="w-full px-0 py-1 bg-transparent border-b border-slate-200 focus:border-indigo-600 text-slate-800 text-sm focus:outline-hidden smooth-hover font-medium"
                    value={farmSettings.Address || ''}
                    onChange={(e) => setFarmSettings({ ...farmSettings, Address: e.target.value })}
                  />
                </div>

              </div>

              {/* Action */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={settingsLoading || myRole === 'Worker'}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-black uppercase tracking-wider smooth-hover shadow-lg cursor-pointer"
                >
                  {settingsLoading ? 'Saving updates &hellip;' : 'Save Corporate Layout'}
                </button>
              </div>

            </form>
          </div>

        </div>

        {/* Right Side: Bento Grid Sidebar and Shortcuts */}
        <div className="space-y-8">
          
          <div className="bg-slate-900 border border-slate-850 text-slate-200 rounded-3xl p-6 smooth-shadow space-y-6 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 relative">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Cloud className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Live Core Sync Status</h3>
                <p className="text-[11px] text-slate-500">Dynamic system automated backup registers</p>
              </div>
            </div>

            <div className="space-y-4 relative font-mono text-[11px]">
              
              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                <span className="text-slate-550">Integration Status:</span>
                {farmSettings.IsGoogleDriveEnabled === 1 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    OAuth Token Active
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    Idle Local-Only Mode
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-2xl">
                <span className="text-slate-550">Last Biological Age Indexing:</span>
                <span className="text-indigo-300 font-bold">
                  {farmSettings.LastAgeUpdateDate 
                    ? new Date(farmSettings.LastAgeUpdateDate).toLocaleDateString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                    : 'Unrecorded'}
                </span>
              </div>

              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-2xl leading-relaxed text-slate-400">
                <Info className="h-3.5 w-3.5 text-indigo-400 inline-block mr-1.5 -mt-0.5" />
                Flock ages synchronized in real time daily. For manual audits, execute the manual trigger button atop this panel dashboard.
              </div>

            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 smooth-shadow space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Systems Shortcuts Matrix</h4>
            
            <div className="grid grid-cols-1 gap-2.5">
              
              <div className="p-3.5 bg-indigo-50/50 hover:bg-indigo-50 border border-slate-150 rounded-xl flex items-center justify-between smooth-hover group cursor-pointer" onClick={() => window.location.hash = '#backups'}>
                <div className="flex items-center gap-3">
                  <Database className="h-4.5 w-4.5 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Database Backup Hub</span>
                    <span className="text-[10px] text-slate-500 block">Physical files restoration</span>
                  </div>
                </div>
                <span className="text-[10px] text-indigo-600 font-bold font-mono group-hover:translate-x-1.5 transition-transform">LINK &rarr;</span>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Operator User Accounts Management Panel */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 smooth-shadow space-y-6" id="operator-user-accounts-block">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-display">Operator User Accounts</h3>
              <p className="text-xs text-slate-400">Claims-Based authorization with live access control & revocations</p>
            </div>
          </div>

          <button
            onClick={() => openUserForm(null)}
            disabled={myRole === 'Worker'}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold tracking-wide flex items-center gap-2 smooth-hover cursor-pointer"
            id="register-operator-btn"
          >
            <Plus className="h-4 w-4" />
            Provision Operator Account
          </button>
        </div>

        {/* Existing users table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-150">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">operator details</th>
                <th className="p-4">username</th>
                <th className="p-4">system role</th>
                <th className="p-4">claims permissions</th>
                <th className="p-4">status</th>
                <th className="p-4 text-right">operation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {users.map((user) => (
                <tr key={user.Id} className="hover:bg-slate-50/50 smooth-hover">
                  <td className="p-4">
                    <div className="font-bold text-slate-850">{user.FullName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{user.Email}</div>
                  </td>
                  <td className="p-4 font-mono font-semibold text-indigo-600">{user.Username}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-extrabold rounded-full font-mono ${
                      user.Role === 'Developer'
                        ? 'bg-rose-50 border border-rose-100 text-rose-600'
                        : user.Role === 'Admin'
                        ? 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                        : 'bg-slate-50 border border-slate-150 text-slate-600'
                    }`}>
                      {user.Role}
                    </span>
                  </td>
                  <td className="p-4 max-w-sm truncate">
                    {user.Permissions ? (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" title={user.Permissions}>
                        {user.Permissions.split(',').length} Action Claims Assigned
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No assigned permissions</span>
                    )}
                  </td>
                  <td className="p-4">
                    {user.IsActive === 1 ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="text-rose-500 font-bold flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                        Revoked / Locked
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {(() => {
                      const isPrivileged = user.Role === 'Developer' || user.Role === 'Admin';
                      const canEdit = myRole === 'Developer' || (!isPrivileged && myRole === 'Admin');
                      const canDelete = (myRole === 'Developer' || myRole === 'Admin') && !isPrivileged && user.Username !== 'admin' && user.Username !== 'developer';

                      return (
                        <>
                          <button
                            onClick={() => openUserForm(user)}
                            disabled={!canEdit}
                            className={`p-1.5 inline-block ${canEdit ? 'text-slate-400 hover:text-indigo-600 smooth-hover cursor-pointer' : 'text-slate-300 opacity-40 cursor-not-allowed'}`}
                            title={canEdit ? "Edit Operator profile" : "Protected: Only Developer SuperAdmin can edit Admin/Developer profiles"}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={!canDelete}
                            className={`p-1.5 inline-block ${canDelete ? 'text-slate-400 hover:text-rose-600 smooth-hover cursor-pointer' : 'text-slate-300 opacity-40 cursor-not-allowed'}`}
                            title={canDelete ? "De-register operator account" : "Protected: Cannot de-register Admin/Developer accounts"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operator Audit Activity Logger Filter Block */}
      {myRole === 'Developer' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 smooth-shadow space-y-6" id="physical-system-audit-trails-block">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <History className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-display">System Audit Logs Trail</h3>
              <p className="text-xs text-slate-400">Immutable chronological timeline logs tracking all active operator CRUD actions</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-150/85 rounded-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, action, params..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-mono focus:outline-hidden"
              value={auditFilters.search}
              onChange={(e) => setAuditFilters({ ...auditFilters, search: e.target.value })}
            />
          </div>

          <div>
            <select
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs focus:outline-hidden font-mono"
              value={auditFilters.module}
              onChange={(e) => setAuditFilters({ ...auditFilters, module: e.target.value })}
            >
              <option value="">-- Check Module --</option>
              <option value="Auth">Auth & Login</option>
              <option value="Settings">Settings</option>
              <option value="UserManagement">UserManagement</option>
              <option value="Flocks">Flocks</option>
              <option value="DailyLogs">DailyLogs</option>
              <option value="Health">Health / Vaccines</option>
              <option value="Finance">Finance / Ledger</option>
              <option value="Developer">SQL CLI / Dev</option>
            </select>
          </div>

          <div>
            <select
              className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs focus:outline-hidden font-mono"
              value={auditFilters.status}
              onChange={(e) => setAuditFilters({ ...auditFilters, status: e.target.value })}
            >
              <option value="">-- Check Status --</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              className="px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs focus:outline-hidden font-mono"
              value={auditFilters.limit}
              onChange={(e) => setAuditFilters({ ...auditFilters, limit: e.target.value })}
            >
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
              <option value="300">300 rows</option>
            </select>

            <button
              onClick={fetchAuditLogs}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 font-mono text-white text-xs font-semibold rounded-xl smooth-hover"
            >
              QUERY TRACE
            </button>
          </div>
        </div>

        {/* Immutable logs listing */}
        {auditLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs font-mono">Stream querying logs registry, please wait &hellip;</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-150">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Timestamp (UTC/Local)</th>
                  <th className="p-4">Operator</th>
                  <th className="p-4">Module</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">HTTP Link</th>
                  <th className="p-4">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.Id} className="hover:bg-slate-50/40 smooth-hover">
                    <td className="p-4 whitespace-nowrap text-slate-400">
                      {new Date(log.Timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 font-bold text-slate-700">{log.UserEmail}</td>
                    <td className="p-4 font-bold text-indigo-600">{log.Module}</td>
                    <td className="p-4">
                      <span>{log.Action}</span>
                      {log.Parameters && log.Parameters !== '{}' && (
                        <div className="text-[10px] text-slate-450 mt-1 max-w-xs truncate" title={log.Parameters}>
                          Payload: {log.Parameters}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-slate-450">
                      <span className="font-extrabold uppercase text-[10px] text-indigo-500 mr-1.5">{log.HttpMethod}</span>
                      {log.Url}
                    </td>
                    <td className="p-4">
                      {log.Status === 'SUCCESS' ? (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold rounded-lg uppercase">SUCCESS</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] bg-rose-50 text-rose-700 border border-rose-100 font-bold rounded-lg uppercase">FAILED</span>
                          <button
                            onClick={() => setSelectedException(log)}
                            className="text-[10px] text-rose-600 hover:underline font-bold"
                          >
                            Trace Code &rarr;
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* USER MODAL DIALOG WITH GRANULAR PERMISSIONS CLAIMS CHECKLIST */}
      {userModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="operator-user-modal">
          <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden smooth-shadow border border-slate-200 block max-h-[85vh] flex flex-col">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-black text-slate-800 font-display">
                  {isNewUser ? 'Provision Operator security account' : `Manage Operator Access Control: ${userForm.FullName}`}
                </h4>
                <p className="text-xs text-slate-450">Determine custom operational rules and assign system access claims</p>
              </div>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {userFormError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span><b>Access Matrix Denied:</b> {userFormError}</span>
                </div>
              )}
              {userFormSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-xs font-mono flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-650 shrink-0" />
                  <span>{userFormSuccess}</span>
                </div>
              )}

              {/* Identity details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Full Registered Operator Name</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Rupesh Gadkhe"
                    className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-medium focus:outline-hidden"
                    value={userForm.FullName}
                    onChange={(e) => setUserForm({ ...userForm, FullName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Secure Username</label>
                  <input
                    type="text"
                    required
                    readOnly={!isNewUser}
                    placeholder="username"
                    className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs disabled:bg-slate-50 font-mono focus:outline-hidden read-only:bg-slate-50 read-only:cursor-not-allowed"
                    value={userForm.Username}
                    onChange={(e) => setUserForm({ ...userForm, Username: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">Official Email Endpoint</label>
                  <input
                    type="email"
                    required
                    placeholder="email@poultrylms.com"
                    className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-mono focus:outline-hidden"
                    value={userForm.Email}
                    onChange={(e) => setUserForm({ ...userForm, Email: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">System authorization group</label>
                  {myRole === 'Developer' ? (
                    <select
                      className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-mono focus:outline-hidden"
                      value={userForm.Role}
                      onChange={(e) => setUserForm({ ...userForm, Role: e.target.value })}
                    >
                      <option value="Developer">Developer (SuperAdmin bypass)</option>
                      <option value="Admin">Admin (Farm Administrator)</option>
                      <option value="Staff">Staff (Operations supervisor / Operator)</option>
                    </select>
                  ) : (
                    <div>
                      <div className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-700 rounded-xl text-xs font-mono font-bold flex items-center justify-between">
                        <span>Staff (Farm Operator)</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-sans font-bold">Standard Operator</span>
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium mt-1">
                        Notice: Farm Admins are restricted to creating and maintaining Operator (Staff) accounts only.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-450">
                    Pin/Password Key {!isNewUser && '(Leave blank to retain active password)'}
                  </label>
                  <input
                    type="password"
                    placeholder={isNewUser ? 'Set system entering password' : 'Enter new password if replacing'}
                    required={isNewUser}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-mono focus:outline-hidden"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 py-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="user-is-active"
                    checked={userForm.IsActive}
                    onChange={(e) => setUserForm({ ...userForm, IsActive: e.target.checked })}
                    className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="user-is-active" className="text-xs text-slate-650 font-bold block cursor-pointer">
                    Grant Entrance Clearance (IsActive = 1)
                  </label>
                </div>

              </div>

              {/* Claims Access Matrix Checklist */}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-800">Claims authorization matrix</h5>
                    <p className="text-[10px] text-slate-400">Explicitly check modules and features allowed on this operator session</p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setUserForm(prev => ({ ...prev, Permissions: ['dailylogs.view', 'dailylogs.create'] }))}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                    >
                      DAILY LOGS ONLY
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllPermissions}
                      className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                    >
                      CHOOSE ALL
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllPermissions}
                      className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                    >
                      REVOKE ALL
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3 font-mono text-[10px]">
                  
                  {MODULE_PERMISSIONS_MATRIX.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-b border-slate-200 last:border-0 items-center">
                      <span className="font-sans font-bold text-slate-700 block truncate">{row.module}</span>
                      
                      <div className="sm:col-span-2 flex flex-wrap gap-4 select-none">
                        {row.view && (
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={userForm.Permissions.includes(row.view)}
                              onChange={() => handlePermissionToggle(row.view)}
                              className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>View</span>
                          </label>
                        )}
                        {row.create && (
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={userForm.Permissions.includes(row.create)}
                              onChange={() => handlePermissionToggle(row.create)}
                              className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>Create</span>
                          </label>
                        )}
                        {row.edit && (
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={userForm.Permissions.includes(row.edit)}
                              onChange={() => handlePermissionToggle(row.edit)}
                              className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>Edit</span>
                          </label>
                        )}
                        {row.delete && (
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors">
                            <input
                              type="checkbox"
                              checked={userForm.Permissions.includes(row.delete)}
                              onChange={() => handlePermissionToggle(row.delete)}
                              className="rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 h-3.5 w-3.5"
                            />
                            <span>Delete</span>
                          </label>
                        )}
                      </div>
                    </div>
                  ))}

                  {myRole === 'Developer' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      <input
                        type="checkbox"
                        id="perm-full-admin"
                        checked={userForm.Permissions.includes('admin')}
                        onChange={() => handlePermissionToggle('admin')}
                        className="rounded text-rose-600 border-slate-300 focus:ring-rose-500 h-3.5 w-3.5"
                      />
                      <label htmlFor="perm-full-admin" className="font-sans font-bold text-slate-800 cursor-pointer block">
                        Assign Root System Access (admin) - Bypasses all restrictions
                      </label>
                    </div>
                  )}

                </div>
              </div>

              {/* Submit footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-mono font-bold transition-all"
                >
                  DISCARD CHANCES
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  SAVE ACCESS SCHEMA
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EXCEPTION EXPLANATOR ERROR TRACE MODAL */}
      {selectedException && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="exception-modal">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden smooth-shadow max-h-[85vh] flex flex-col font-mono text-xs text-slate-300">
            
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-1 px-2.5 bg-rose-950/60 border border-rose-900 text-rose-450 uppercase font-bold text-[10px] rounded-lg">
                  unhandled system crash
                </span>
                <span className="text-slate-450">ID: #{selectedException.Id}</span>
              </div>
              <button
                onClick={() => setSelectedException(null)}
                className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Action Reference coordinates:</div>
                <div><b>Controller:</b> {selectedException.Module} &rarr; <b>Action Method:</b> {selectedException.Action}</div>
                <div><b>URL Endpoint Path:</b> <span className="text-indigo-400">{selectedException.HttpMethod} {selectedException.Url}</span></div>
                <div><b>IP Address Client:</b> {selectedException.IpAddress}</div>
                <div><b>Payload parameters:</b> <span className="text-rose-300">{selectedException.Parameters}</span></div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Exception Message:</div>
                <div className="p-3 bg-rose-950/30 border border-rose-900 text-rose-350 rounded-xl leading-relaxed whitespace-pre-wrap">
                  {selectedException.ExceptionMessage || 'No exception message recorded.'}
                </div>
              </div>

              {selectedException.StackTrace && (
                <div className="space-y-1">
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Debugging Call Stack Trace:</div>
                  <pre className="p-4 bg-slate-950 border border-slate-850 text-[10px] text-slate-450 rounded-xl overflow-x-auto whitespace-pre leading-normal max-h-64">
                    {selectedException.StackTrace}
                  </pre>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-slate-850 bg-slate-950/40 text-right shrink-0">
              <button
                onClick={() => setSelectedException(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold smooth-hover"
              >
                DISMISS LOGGER DETAIL
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
