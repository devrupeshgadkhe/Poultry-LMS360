import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  Edit2,
  Trash2,
  Building2,
  Search,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';

export interface UserAccount {
  Id: number;
  Username: string;
  Email: string;
  Role: 'Developer' | 'Admin' | 'Staff';
  FullName: string;
  IsActive: number;
  CreatedAt: string;
  Permissions?: string;
  FarmId?: number;
  PlainPassword?: string;
  FarmName?: string;
}

const MODULE_PERMISSIONS_MATRIX = [
  { module: 'Dashboard Metrics', view: 'dashboard.view' },
  { module: 'Layer Flocks Registry', view: 'flocks.view', create: 'flocks.create', edit: 'flocks.edit', delete: 'flocks.delete' },
  { module: 'Daily Progress Logs', view: 'dailylogs.view', create: 'dailylogs.create', edit: 'dailylogs.edit', delete: 'dailylogs.delete' },
  { module: 'Flock Vaccinations', view: 'health.view', create: 'health.create', edit: 'health.edit', delete: 'health.delete' },
  { module: 'Warehouse Stock Lists', view: 'inventory.view', create: 'inventory.create', edit: 'inventory.edit', delete: 'inventory.delete' },
  { module: 'Stakeholders Ledgering', view: 'customers.view', create: 'customers.create', edit: 'customers.edit', delete: 'customers.delete' },
  { module: 'Procurement Purchases', view: 'purchases.view', create: 'purchases.create', edit: 'purchases.edit', delete: 'purchases.delete' },
  { module: 'POS Customer Sales Desk', view: 'sales.view', create: 'sales.create', edit: 'sales.edit', delete: 'sales.delete' },
  { module: 'Double-entry Dynamic Ledger', view: 'financials.view', create: 'financials.create', edit: 'financials.edit', delete: 'financials.delete' },
  { module: 'Analytical Performance Reports', view: 'reports.view' },
  { module: 'Farm Settings & Backups', view: 'settings.view', edit: 'settings.edit' },
];

export const UserAccessManager: React.FC = () => {
  const { farms, currentFarm, refreshFarms } = useFarm();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [farmFilter, setFarmFilter] = useState<string>('all');

  // Active user role
  const myRole = localStorage.getItem('userRole') || 'Worker';

  // Password visibility map (userId -> boolean)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [modalForm, setModalForm] = useState({
    Username: '',
    FullName: '',
    Email: '',
    Role: (localStorage.getItem('userRole') === 'Developer' ? 'Admin' : 'Staff') as 'Developer' | 'Admin' | 'Staff',
    FarmId: 1,
    Password: '',
    IsActive: true,
    Permissions: 'dailylogs.view,dailylogs.create'
  });

  // Quick Password Reset Modal
  const [resetModalUser, setResetModalUser] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Notification banners
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load user records');
      }
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Error fetching users' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const togglePasswordVisibility = (userId: number) => {
    setShowPasswordMap(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCopyCredentials = (user: UserAccount) => {
    const pass = user.PlainPassword || '[Encrypted SHA-256 - Use Reset Key to set]';
    const text = `Username: ${user.Username}\nPassword: ${pass}\nRole: ${user.Role}\nFarm: ${user.FarmName || ('Farm #' + (user.FarmId || 1))}`;
    navigator.clipboard.writeText(text);
    setCopiedId(user.Id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setModalForm({
      Username: '',
      FullName: '',
      Email: '',
      Role: (myRole === 'Developer' ? 'Admin' : 'Staff') as any,
      FarmId: currentFarm?.Id || 1,
      Password: '',
      IsActive: true,
      Permissions: 'dailylogs.view,dailylogs.create'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    if (myRole !== 'Developer' && (user.Role === 'Developer' || user.Role === 'Admin')) {
      setAlertMsg({ type: 'error', text: 'Security Restriction: Farm Administrators cannot modify Admin or Developer accounts.' });
      return;
    }
    setEditingUser(user);
    setModalForm({
      Username: user.Username,
      FullName: user.FullName,
      Email: user.Email,
      Role: user.Role,
      FarmId: user.FarmId || 1,
      Password: user.PlainPassword || '',
      IsActive: Boolean(user.IsActive),
      Permissions: user.Permissions || (user.Role === 'Admin' || user.Role === 'Developer' ? 'All' : '')
    });
    setIsModalOpen(true);
  };

  const togglePermission = (claim: string) => {
    const current = (modalForm.Permissions || '')
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);
    const target = claim.toLowerCase();
    let updated: string[];
    if (current.includes(target)) {
      updated = current.filter(p => p !== target);
    } else {
      updated = [...current, target];
    }
    setModalForm(prev => ({ ...prev, Permissions: updated.join(',') }));
  };

  const hasModalPermission = (claim: string) => {
    if (modalForm.Permissions === 'All') return true;
    const current = (modalForm.Permissions || '')
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);
    return current.includes(claim.toLowerCase());
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);

    const targetRole = myRole === 'Developer' ? modalForm.Role : 'Staff';
    const targetFarmId = myRole === 'Developer' ? Number(modalForm.FarmId) : (currentFarm?.Id || 1);
    const permissionsVal = (targetRole === 'Admin' || targetRole === 'Developer') ? 'All' : modalForm.Permissions;

    try {
      if (editingUser) {
        // Update user
        const res = await fetch(`/api/users/${editingUser.Id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            'X-User-Role': myRole
          },
          body: JSON.stringify({
            Email: modalForm.Email,
            Role: targetRole,
            FullName: modalForm.FullName,
            IsActive: modalForm.IsActive,
            password: modalForm.Password,
            FarmId: targetFarmId,
            Permissions: permissionsVal,
            permissions: permissionsVal
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update user');
        }

        setAlertMsg({ type: 'success', text: `User "${modalForm.Username}" updated successfully.` });
      } else {
        // Create user
        if (!modalForm.Password) {
          throw new Error('Password is required for new accounts');
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            'X-User-Role': myRole
          },
          body: JSON.stringify({
            username: modalForm.Username,
            email: modalForm.Email,
            password: modalForm.Password,
            role: targetRole,
            fullName: modalForm.FullName,
            farmId: targetFarmId,
            permissions: permissionsVal,
            Permissions: permissionsVal
          })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create user');
        }

        setAlertMsg({ type: 'success', text: `New user "${modalForm.Username}" created successfully.` });
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  const handleSaveQuickReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword.trim()) return;

    if (myRole !== 'Developer' && (resetModalUser.Role === 'Developer' || resetModalUser.Role === 'Admin')) {
      setResetError('Security Restriction: Farm Administrators cannot reset password for Admin or Developer accounts.');
      return;
    }

    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'X-User-Role': myRole
        },
        body: JSON.stringify({
          userId: resetModalUser.Id,
          newPassword: newPassword.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess(`Password for ${resetModalUser.Username} has been reset successfully.`);
      setTimeout(() => {
        setResetModalUser(null);
        setNewPassword('');
        setResetSuccess(null);
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setResetError(err.message || 'Error resetting password');
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.Username === 'developer' || user.Username === 'admin') {
      alert('Default root operator accounts cannot be removed.');
      return;
    }

    if (myRole !== 'Developer' && (user.Role === 'Developer' || user.Role === 'Admin')) {
      setAlertMsg({ type: 'error', text: 'Security Restriction: Farm Administrators cannot delete Admin or Developer accounts.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${user.Username}"? This action cannot be undone.`)) {
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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      setAlertMsg({ type: 'success', text: `User "${user.Username}" removed successfully.` });
      fetchUsers();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Filtered users list
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.Username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.Email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFarm =
      farmFilter === 'all' ||
      String(u.FarmId || 1) === farmFilter;

    return matchesSearch && matchesFarm;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans" id="user-access-manager">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Key className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              User Access & Passwords
            </h1>
            <span className="text-[10px] bg-amber-50 text-amber-700 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-200">
              Developer SuperAdmin
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Supabase Cloud Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized operator credentials management powered dynamically by Supabase Cloud. Inspect farm accounts, reveal security keys, and reset passwords.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { fetchUsers(); refreshFarms(); }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="Refresh Users and Farms from Supabase"
            id="btn-refresh-supabase-users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
            id="btn-add-operator"
          >
            <UserPlus className="w-4 h-4" />
            Add New Operator
          </button>
        </div>
      </div>

      {/* Notifications */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alertMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{alertMsg.text}</span>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Accounts</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{users.length}</span>
            <span className="text-xs text-slate-500">Registered</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Operators</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {users.filter(u => Boolean(u.IsActive)).length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Ready</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Farms</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{farms.length || 1}</span>
            <span className="text-xs text-slate-500">Multi-Unit</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SuperAdmin Privilege</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-indigo-700">Developer Role</span>
            <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Full Control</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search username, name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 shrink-0">Filter by Farm:</span>
          <select
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Farms</option>
            {farms.map(f => (
              <option key={f.Id} value={String(f.Id)}>
                #{f.Id} - {f.FarmName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Operator User Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Loading user accounts and credential matrix...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No matching operator accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Operator Name</th>
                  <th className="py-3.5 px-4">Username & Email</th>
                  <th className="py-3.5 px-4">Assigned Farm</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Access Password</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const isVisible = Boolean(showPasswordMap[user.Id]);
                  const farmMatch = farms.find(f => f.Id === (user.FarmId || 1));
                  const farmDisplayName = user.FarmName || farmMatch?.FarmName || `Farm #${user.FarmId || 1}`;

                  return (
                    <tr key={user.Id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">{user.FullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID #{user.Id}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-mono font-semibold text-indigo-600">{user.Username}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {user.Email}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-700 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{farmDisplayName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Unit ID: #{user.FarmId || 1}</div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            user.Role === 'Developer'
                              ? 'bg-purple-100 text-purple-800'
                              : user.Role === 'Admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {user.Role === 'Developer' ? '👑 Developer (SuperAdmin)' : user.Role}
                        </span>
                        {user.Role === 'Staff' && (
                          <div className="mt-1 text-[10px] text-slate-500 font-mono truncate max-w-[160px]" title={user.Permissions || 'No permissions assigned'}>
                            {user.Permissions === 'All' ? '⚡ All Access' : (user.Permissions ? `${user.Permissions.split(',').filter(Boolean).length} Perms` : '🔒 No Access')}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <div className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 min-w-[100px] text-slate-800">
                            {isVisible ? (user.PlainPassword || 'Encrypted (SHA-256)') : '••••••••'}
                          </div>

                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.Id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition"
                            title={isVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(user)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition"
                            title="Copy operator credentials"
                          >
                            {copiedId === user.Id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            user.IsActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {user.IsActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {(() => {
                            const isPrivileged = user.Role === 'Developer' || user.Role === 'Admin';
                            const canManage = myRole === 'Developer' || (!isPrivileged && myRole === 'Admin');

                            if (!canManage) {
                              return (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded italic">
                                  Protected
                                </span>
                              );
                            }

                            return (
                              <>
                                <button
                                  onClick={() => {
                                    setResetModalUser(user);
                                    setNewPassword('');
                                    setResetError(null);
                                    setResetSuccess(null);
                                  }}
                                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg transition font-medium border border-slate-200 cursor-pointer"
                                  title="Reset password for this operator"
                                >
                                  <RotateCcw className="w-3 h-3 inline mr-1" />
                                  Reset Key
                                </button>

                                <button
                                  onClick={() => handleOpenEditModal(user)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title="Edit details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {user.Username !== 'developer' && user.Username !== 'admin' && (
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                    title="Delete account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {editingUser ? `Edit Account: ${editingUser.Username}` : 'Provision New Operator Account'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure farm assignment, system roles, and authentication passwords.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Operator Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patil"
                    value={modalForm.FullName}
                    onChange={(e) => setModalForm({ ...modalForm, FullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    placeholder="e.g. ramesh_admin"
                    value={modalForm.Username}
                    onChange={(e) => setModalForm({ ...modalForm, Username: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="operator@farm.com"
                    value={modalForm.Email}
                    onChange={(e) => setModalForm({ ...modalForm, Email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System Role <span className="text-rose-500">*</span>
                  </label>
                  {myRole === 'Developer' ? (
                    <select
                      value={modalForm.Role}
                      onChange={(e) => setModalForm({ ...modalForm, Role: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="Admin">Farm Administrator</option>
                      <option value="Staff">Operations Staff (Operator)</option>
                      <option value="Developer">Developer (SuperAdmin)</option>
                    </select>
                  ) : (
                    <div>
                      <div className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center justify-between">
                        <span>Staff (Farm Operator)</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-sans font-bold">Standard Operator</span>
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium mt-1">
                        Notice: Farm Admins are restricted to creating and maintaining Operator (Staff) accounts only.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Farm Unit <span className="text-rose-500">*</span>
                </label>
                <select
                  value={modalForm.FarmId}
                  onChange={(e) => setModalForm({ ...modalForm, FarmId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {farms.map(f => (
                    <option key={f.Id} value={f.Id}>
                      #{f.Id} - {f.FarmName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Access Password / Key {editingUser ? '(Leave empty to keep current password)' : <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  required={!editingUser}
                  placeholder={editingUser ? 'Enter new password if replacing' : 'Set login password'}
                  value={modalForm.Password}
                  onChange={(e) => setModalForm({ ...modalForm, Password: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="account-active-checkbox"
                  checked={modalForm.IsActive}
                  onChange={(e) => setModalForm({ ...modalForm, IsActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="account-active-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Account is Active and authorized to login
                </label>
              </div>

              {/* Granular permissions picker for Staff/Operator */}
              {modalForm.Role === 'Staff' && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        Operator Module Permissions <span className="text-indigo-600 font-normal">(Granular Access)</span>
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Select which operational modules and actions this operator can see and perform.
                      </p>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setModalForm(prev => ({ ...prev, Permissions: 'dailylogs.view,dailylogs.create' }))}
                        className="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                      >
                        Daily Logs Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalForm(prev => ({ ...prev, Permissions: 'dailylogs.view,dailylogs.create,flocks.view' }))}
                        className="px-2 py-1 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                      >
                        Logs & Flocks
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalForm(prev => ({ ...prev, Permissions: 'All' }))}
                        className="px-2 py-1 text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition cursor-pointer"
                      >
                        All Modules
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalForm(prev => ({ ...prev, Permissions: '' }))}
                        className="px-2 py-1 text-[10px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-56 overflow-y-auto space-y-2.5 font-sans">
                    {MODULE_PERMISSIONS_MATRIX.map((m) => {
                      const isViewChecked = hasModalPermission(m.view);
                      return (
                        <div key={m.module} className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/60 last:border-b-0 last:pb-0 gap-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`perm-${m.view}`}
                              checked={isViewChecked}
                              onChange={() => togglePermission(m.view)}
                              className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                            />
                            <label htmlFor={`perm-${m.view}`} className="text-xs font-semibold text-slate-800 cursor-pointer">
                              {m.module}
                            </label>
                          </div>

                          <div className="flex items-center gap-2.5 pl-5 sm:pl-0">
                            {m.create && (
                              <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={hasModalPermission(m.create)}
                                  onChange={() => togglePermission(m.create)}
                                  className="w-3 h-3 text-emerald-600 rounded cursor-pointer"
                                />
                                Add
                              </label>
                            )}
                            {m.edit && (
                              <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={hasModalPermission(m.edit)}
                                  onChange={() => togglePermission(m.edit)}
                                  className="w-3 h-3 text-blue-600 rounded cursor-pointer"
                                />
                                Edit
                              </label>
                            )}
                            {m.delete && (
                              <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={hasModalPermission(m.delete)}
                                  onChange={() => togglePermission(m.delete)}
                                  className="w-3 h-3 text-rose-600 rounded cursor-pointer"
                                />
                                Revert
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md shadow-indigo-600/20"
                >
                  {editingUser ? 'Update Account' : 'Create Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Password Reset */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Reset Password</h3>
                <p className="text-[11px] text-slate-400">
                  Target: <span className="font-mono text-indigo-300 font-bold">{resetModalUser.Username}</span>
                </p>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickReset} className="p-5 space-y-4">
              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
                  {resetSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter new password (e.g. Admin@2026)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md shadow-indigo-600/20"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
