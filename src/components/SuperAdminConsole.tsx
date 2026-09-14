import React, { useState, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import { checkSupabaseConnection, supabase } from '../lib/supabase';
import { Building2, Plus, CheckCircle2, AlertCircle, RefreshCw, Users, Shield, ArrowRight, Eye, Phone, Mail, MapPin, Database } from 'lucide-react';
import LegacyMigrator from './LegacyMigrator';

interface FarmStats {
  farmId: number;
  flockCount: number;
  totalBirds: number;
  dailyLogsCount: number;
}

export const SuperAdminConsole: React.FC = () => {
  const { farms, currentFarm, switchFarm, refreshFarms, createFarm, isLoadingFarms } = useFarm();
  
  const [connectionStatus, setConnectionStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: false,
    success: false,
    message: ''
  });
  const [isCheckingConn, setIsCheckingConn] = useState(false);
  const [adminView, setAdminView] = useState<'farms' | 'migrator'>('farms');

  // New Farm Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [newFarm, setNewFarm] = useState({
    farmName: '',
    ownerName: '',
    contactPhone: '',
    contactEmail: '',
    address: '',
    adminUsername: '',
    adminEmail: '',
    adminPassword: ''
  });

  // Cross-farm summary metrics
  const [farmStatsMap, setFarmStatsMap] = useState<Record<number, FarmStats>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Test Supabase Connection
  const handleCheckConnection = async () => {
    setIsCheckingConn(true);
    const res = await checkSupabaseConnection();
    setConnectionStatus({ checked: true, success: res.success, message: res.message });
    setIsCheckingConn(false);
  };

  useEffect(() => {
    handleCheckConnection();
    loadCrossFarmStats();
  }, [farms]);

  const loadCrossFarmStats = async () => {
    if (!farms || farms.length === 0) return;
    try {
      setIsLoadingStats(true);
      const statsObj: Record<number, FarmStats> = {};

      for (const f of farms) {
        // Fetch flock count and total birds for this farm
        const { data: flocks } = await supabase
          .from('Flocks')
          .select('CurrentCount')
          .eq('FarmId', f.Id);

        // Fetch logs count
        const { count: logsCount } = await supabase
          .from('DailyLogs')
          .select('*', { count: 'exact', head: true })
          .eq('FarmId', f.Id);

        const totalBirds = (flocks || []).reduce((acc: number, fl: any) => acc + (Number(fl.CurrentCount) || 0), 0);
        statsObj[f.Id] = {
          farmId: f.Id,
          flockCount: flocks?.length || 0,
          totalBirds,
          dailyLogsCount: logsCount || 0
        };
      }
      setFarmStatsMap(statsObj);
    } catch (err) {
      console.error('Error loading cross farm stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarm.farmName.trim() || !newFarm.ownerName.trim()) {
      setFormMsg({ type: 'error', text: 'Farm name and Owner name are required.' });
      return;
    }
    if (!newFarm.adminUsername.trim() || !newFarm.adminPassword.trim()) {
      setFormMsg({ type: 'error', text: 'Admin username and password are required for initial access.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFormMsg(null);
      const res = await createFarm(newFarm);

      if (res.success) {
        setFormMsg({ type: 'success', text: res.message });
        setNewFarm({
          farmName: '',
          ownerName: '',
          contactPhone: '',
          contactEmail: '',
          address: '',
          adminUsername: '',
          adminEmail: '',
          adminPassword: ''
        });
        setTimeout(() => {
          setShowAddModal(false);
          setFormMsg(null);
        }, 1800);
      } else {
        setFormMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message || 'Failed to create farm' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="super-admin-console" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-medium border border-amber-500/30 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Master Developer Console
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-medium border border-emerald-500/30">
              Multi-Tenant Cloud
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Poultry LMS 360 - Central Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage all tenant farms, monitor cloud database health, onboard new clients, and switch views seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckConnection}
            disabled={isCheckingConn}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium border border-slate-700 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingConn ? 'animate-spin' : ''}`} />
            {isCheckingConn ? 'Checking...' : 'Check Cloud Status'}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium shadow-md transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Farm
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAdminView('farms')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            adminView === 'farms'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Tenant Farms & Cloud Health
        </button>
        <button
          onClick={() => setAdminView('migrator')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            adminView === 'migrator'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          Legacy Data Migrator
        </button>
      </div>

      {adminView === 'migrator' ? (
        <LegacyMigrator userRole="Developer" />
      ) : (
        <>
      {/* Cloud Connectivity Status Alert */}
      {connectionStatus.checked && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            connectionStatus.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {connectionStatus.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="text-sm">
            <span className="font-semibold">
              {connectionStatus.success ? 'Cloud Database: Connected & Active' : 'Cloud Database Connection Warning'}
            </span>
            <p className="mt-0.5 text-xs opacity-90">{connectionStatus.message?.replace(/Supabase/gi, 'Cloud Database')}</p>
            <p className="mt-1 text-[11px] font-mono text-slate-500">
              Database Sync: Active | Registered Farms: {farms.length}
            </p>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Farms</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{farms.length}</span>
            <span className="text-xs text-emerald-600 font-medium">Active Tenants</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Workspace</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-slate-800 truncate block">
              {currentFarm?.FarmName || 'None Selected'}
            </span>
            <span className="text-xs text-slate-500">ID #{currentFarm?.Id} (Currently viewed)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Global Flocks</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">
              {Object.values(farmStatsMap).reduce((acc, s) => acc + s.flockCount, 0)}
            </span>
            <span className="text-xs text-slate-500">across all farms</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Birds Monitored</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">
              {Object.values(farmStatsMap).reduce((acc, s) => acc + s.totalBirds, 0).toLocaleString()}
            </span>
            <span className="text-xs text-purple-600 font-medium">Headcount</span>
          </div>
        </div>
      </div>

      {/* Farm Directory & Switcher Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Registered Tenant Farms</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click &quot;Switch View&quot; on any farm to preview its specific dashboard, batches, and records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Active View:</span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
              {currentFarm?.FarmName} (ID: #{currentFarm?.Id})
            </span>
          </div>
        </div>

        {isLoadingFarms ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
            Loading cloud tenant directory...
          </div>
        ) : farms.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No farms registered yet. Click &quot;Add New Farm&quot; to provision the first client.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Farm ID</th>
                  <th className="py-3.5 px-4">Farm Name & Location</th>
                  <th className="py-3.5 px-4">Owner & Contact</th>
                  <th className="py-3.5 px-4 text-center">Flocks</th>
                  <th className="py-3.5 px-4 text-center">Live Birds</th>
                  <th className="py-3.5 px-4 text-center">Logs Recorded</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {farms.map((farm) => {
                  const isCurrent = currentFarm?.Id === farm.Id;
                  const stats = farmStatsMap[farm.Id] || { flockCount: 0, totalBirds: 0, dailyLogsCount: 0 };

                  return (
                    <tr
                      key={farm.Id}
                      className={`hover:bg-slate-50/80 transition ${
                        isCurrent ? 'bg-emerald-50/40 font-medium' : ''
                      }`}
                    >
                      <td className="py-4 px-4 font-mono text-xs text-slate-500">#{farm.Id}</td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {farm.FarmName}
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              Current Active
                            </span>
                          )}
                        </div>
                        {farm.Address && (
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {farm.Address}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">{farm.OwnerName}</div>
                        <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-0.5">
                          {farm.ContactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {farm.ContactPhone}
                            </span>
                          )}
                          {farm.ContactEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {farm.ContactEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-slate-700">
                        {isLoadingStats ? '...' : stats.flockCount}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-slate-800">
                        {isLoadingStats ? '...' : stats.totalBirds.toLocaleString()}
                      </td>

                      <td className="py-4 px-4 text-center text-xs text-slate-600 font-mono">
                        {isLoadingStats ? '...' : stats.dailyLogsCount}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        {isCurrent ? (
                          <span className="text-xs text-emerald-600 font-bold px-3 py-1.5 rounded-lg bg-emerald-100/60 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Viewing Now
                          </span>
                        ) : (
                          <button
                            onClick={() => switchFarm(farm.Id)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1 border border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Switch View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Add New Farm Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Register New Poultry Farm</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Provisions isolated multi-tenant records and generates owner admin credentials.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    formMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {formMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Farm / Business Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sai Poultry Farms"
                    value={newFarm.farmName}
                    onChange={(e) => setNewFarm({ ...newFarm, farmName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Owner Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patil"
                    value={newFarm.ownerName}
                    onChange={(e) => setNewFarm({ ...newFarm, ownerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={newFarm.contactPhone}
                    onChange={(e) => setNewFarm({ ...newFarm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="owner@poultryfarm.com"
                    value={newFarm.contactEmail}
                    onChange={(e) => setNewFarm({ ...newFarm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Farm Location / Address</label>
                <input
                  type="text"
                  placeholder="e.g. Gat No 124, Sangamner, Ahmednagar"
                  value={newFarm.address}
                  onChange={(e) => setNewFarm({ ...newFarm, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  New Farm Admin Credentials
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Admin Username</label>
                    <input
                      type="text"
                      required
                      placeholder="patil_admin"
                      value={newFarm.adminUsername}
                      onChange={(e) => setNewFarm({ ...newFarm, adminUsername: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@farm.com"
                      value={newFarm.adminEmail}
                      onChange={(e) => setNewFarm({ ...newFarm, adminEmail: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newFarm.adminPassword}
                      onChange={(e) => setNewFarm({ ...newFarm, adminPassword: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isSubmitting ? 'Registering Farm...' : 'Save & Provision Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
