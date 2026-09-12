import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Activity,
  CalendarCheck,
  Contact2,
  FileSpreadsheet,
  Settings,
  Shield,
  ShieldAlert,
  Cloud,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Database,
  Lock,
  Workflow,
  AlertTriangle,
  Flame,
  Clock,
  Menu,
  X,
  BarChart3,
  Key,
  User,
  LogIn,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Layers
} from 'lucide-react';
import farmHeroImage from './assets/images/poultry_farm_hero_1789227033408.jpg';

import Dashboard from './components/Dashboard';
import Flocks from './components/Flocks';
import DailyLogs from './components/DailyLogs';
import Vaccinations from './components/Vaccinations';
import Inventories from './components/Inventories';
import Stakeholders from './components/Stakeholders';
import Purchasing from './components/Purchasing';
import SalesDesk from './components/SalesDesk';
import MillingRoom from './components/MillingRoom';
import FinanceLedger from './components/FinanceLedger';
import DeveloperTools from './components/DeveloperTools';
import Backups from './components/Backups';
import Reports from './components/Reports';
import SettingsAudit from './components/SettingsAudit';
import BulkImport from './components/BulkImport';
import LegacyMigrator from './components/LegacyMigrator';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import { UserAccessManager } from './components/UserAccessManager';
import { useFarm } from './context/FarmContext';
import { translations, Language, getTabTranslation, languages } from './translations';

type Tab =
  | 'Dashboard'
  | 'Layer Flocks'
  | 'Daily Logs'
  | 'Vaccinations'
  | 'Warehouse Stock'
  | 'Stakeholders'
  | 'Procurement'
  | 'Sales Desk'
  | 'Milling & Mix'
  | 'Finance Ledgers'
  | 'SQL CLI Console'
  | 'Super Admin Console'
  | 'Legacy Migrator'
  | 'User Access'
  | 'Backups'
  | 'Reports & Ledgers'
  | 'Farm Settings & Access'
  | 'Bulk Data Import';

export default function App() {
  const { currentFarm, farms, switchFarm } = useFarm();
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('poultry_lang');
    if (saved === 'mr') {
      localStorage.setItem('poultry_lang', 'en');
      return 'en';
    }
    return (saved as Language) || 'en';
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('userName'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('userRole'));
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [userPermissions, setUserPermissions] = useState<string>(() => {
    const saved = localStorage.getItem('userPermissions');
    if (saved !== null) return saved;
    const tok = localStorage.getItem('token');
    if (tok) {
      try {
        const payload = JSON.parse(atob(tok));
        if (payload.Permissions) {
          localStorage.setItem('userPermissions', payload.Permissions);
          return payload.Permissions;
        }
      } catch (e) {}
    }
    return '';
  });

  // Auth Inputs
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Layout navigation states
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [vaccineAlertsCount, setVaccineAlertsCount] = useState<number>(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    localStorage.getItem('poultry_sidebar_collapsed') === 'true'
  );

  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }[]>([]);

  useEffect(() => {
    const handleGlobalAlert = (message: string) => {
      let type: 'success' | 'error' | 'warning' | 'info' = 'info';
      const msgLower = String(message).toLowerCase();
      if (
        msgLower.includes('success') || 
        msgLower.includes('saved') || 
        msgLower.includes('updated') || 
        msgLower.includes('completed') || 
        msgLower.includes('registered') || 
        msgLower.includes('posted') || 
        msgLower.includes('added') ||
        msgLower.includes('verified')
      ) {
        type = 'success';
      } else if (
        msgLower.includes('fail') || 
        msgLower.includes('error') || 
        msgLower.includes('cannot') || 
        msgLower.includes('invalid') || 
        msgLower.includes('must') || 
        msgLower.includes('required') ||
        msgLower.includes('could not') ||
        msgLower.includes('please')
      ) {
        type = 'error';
      }

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto-remove after 6 seconds for extra readability
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    };

    window.alert = handleGlobalAlert;
    (window as any).showToast = handleGlobalAlert;
  }, []);

  useEffect(() => {
    localStorage.setItem('poultry_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const checkVaccineAlerts = async () => {
    try {
      const res = await fetch('/api/vaccinations');
      if (res.ok) {
        const data = await res.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alerts = data.filter((v: any) => {
          if (v.Phase !== 'Scheduled' || !v.ScheduledDate) return false;
          const schedDate = new Date(v.ScheduledDate);
          schedDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((schedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 2;
        });
        setVaccineAlertsCount(alerts.length);
      }
    } catch (e: any) {
      console.warn('Deferred fetching vaccinations for alerts on startup:', e.message || e);
    }
  };

  useEffect(() => {
    // Clock indicator updates
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Trigger automated safety backup on application startup
    fetch('/api/backups/auto', { method: 'POST' }).catch(err => {
      console.warn('System startup backup deferred:', err.message);
    });

    // Trigger automated safety backup on browser close / navigation end
    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/backups/auto');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (token) {
      checkVaccineAlerts();
      const intv = setInterval(checkVaccineAlerts, 15000);
      return () => clearInterval(intv);
    }
  }, [token, activeTab]);

  // Programmatic focus and input unlock effect for desktop/Windows container compatibility
  useEffect(() => {
    const healAllInputs = () => {
      // Find all visible forms or form-like containers on the screen
      const forms = document.querySelectorAll('form, [id*="form"], [class*="modal"], .bg-white.rounded-2xl, .bg-white.rounded-3xl');
      
      forms.forEach((form) => {
        const controls = form.querySelectorAll('input, select, textarea');
        
        // Self-heal attributes for all controls inside active forms
        controls.forEach((el) => {
          const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          
          // Check if this input is visible
          const isVisible = input.offsetWidth > 0 && input.offsetHeight > 0;
          if (!isVisible) return;

          // Determine if this control is explicitly designed to be readOnly or disabled
          const isCalculatedValue = input.value && (
            input.value.startsWith('Bill ID:') || 
            input.value.startsWith('TX-') ||
            input.className.includes('cursor-not-allowed') ||
            input.className.includes('bg-slate-100') ||
            input.className.includes('bg-slate-50') ||
            input.hasAttribute('data-keep-readonly') ||
            input.hasAttribute('data-keep-disabled')
          );
          
          const isSystemProtected = input.disabled && (
            input.id === 'system-config' || 
            input.closest('[disabled]') ||
            input.className.includes('bg-slate-20/50') ||
            input.hasAttribute('data-keep-disabled')
          );

          // If the control is supposed to be editable but is locked, unlock it
          if (!isCalculatedValue && !isSystemProtected) {
            if (input.hasAttribute('readonly')) {
              input.removeAttribute('readonly');
              if ('readOnly' in input) {
                (input as any).readOnly = false;
              }
            }
            if (input.hasAttribute('disabled')) {
              input.removeAttribute('disabled');
              input.disabled = false;
            }
            if (input.style.pointerEvents === 'none') {
              input.style.pointerEvents = 'auto';
            }
            if (input.style.userSelect === 'none') {
              input.style.userSelect = 'text';
            }
          }
        });

        // Run smart auto-focus on the first control if the form has not been initialized yet
        if (!form.hasAttribute('data-focused-initial')) {
          let hasFocused = false;
          controls.forEach((el) => {
            if (hasFocused) return;
            const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            
            const isVisible = input.offsetWidth > 0 && input.offsetHeight > 0;
            if (!isVisible) return;

            const isCalculatedValue = input.value && (
              input.value.startsWith('Bill ID:') || 
              input.value.startsWith('TX-') ||
              input.className.includes('cursor-not-allowed') ||
              input.className.includes('bg-slate-100') ||
              input.className.includes('bg-slate-50') ||
              input.hasAttribute('data-keep-readonly') ||
              input.hasAttribute('data-keep-disabled')
            );
            
            const isSystemProtected = input.disabled && (
              input.id === 'system-config' || 
              input.closest('[disabled]') ||
              input.className.includes('bg-slate-20/50') ||
              input.hasAttribute('data-keep-disabled')
            );

            if (!isCalculatedValue && !isSystemProtected) {
              input.removeAttribute('readonly');
              input.removeAttribute('disabled');
              input.focus();
              if (typeof (input as any).select === 'function') {
                (input as any).select();
              }
              hasFocused = true;
              form.setAttribute('data-focused-initial', 'true');
            }
          });
        }
      });
    };

    // Trigger on active tab change after a small timeout for render settling
    const timer = setTimeout(healAllInputs, 150);

    // Trigger on document clicks or focus to resolve webview focus locks
    const handleClick = () => {
      setTimeout(healAllInputs, 50);
    };

    // Regular interval to catch dynamically mounted dialogs/modals
    const interval = setInterval(healAllInputs, 800);

    window.addEventListener('click', handleClick);
    window.addEventListener('focus', handleClick);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('focus', handleClick);
    };
  }, [activeTab]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Incorrect username or password. Please try again.');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userName', data.user.Username);
        localStorage.setItem('userRole', data.user.Role);
        localStorage.setItem('userEmail', data.user.Email);
        const perms = data.user.Permissions || (data.user.Role === 'Admin' || data.user.Role === 'Developer' ? 'All' : '');
        localStorage.setItem('userPermissions', perms);

        setToken(data.token);
        setUsername(data.user.Username);
        setUserRole(data.user.Role);
        setUserEmail(data.user.Email);
        setUserPermissions(perms);

        // If the user does not have permission to view Dashboard, auto-navigate to their first permitted tab
        const role = data.user.Role;
        const pLower = perms.toLowerCase();
        if (role !== 'Developer' && role !== 'Admin' && !pLower.includes('dashboard.view') && pLower !== 'all') {
          if (pLower.includes('dailylogs.view')) {
            setActiveTab('Daily Logs');
          } else if (pLower.includes('flocks.view')) {
            setActiveTab('Layer Flocks');
          } else if (pLower.includes('sales.view')) {
            setActiveTab('Sales Desk');
          } else if (pLower.includes('inventory.view')) {
            setActiveTab('Warehouse Stock');
          } else if (pLower.includes('health.view')) {
            setActiveTab('Vaccinations');
          } else if (pLower.includes('purchases.view')) {
            setActiveTab('Procurement');
          } else if (pLower.includes('financials.view')) {
            setActiveTab('Finance Ledgers');
          } else if (pLower.includes('reports.view')) {
            setActiveTab('Reports & Ledgers');
          }
        }

        // Record a safety backup right after login succeeds
        fetch('/api/backups/auto', { method: 'POST' }).catch(err => {
          console.warn('Post-login auto backup deferred:', err.message);
        });
      }
    } catch (err: any) {
      setLoginError(err.message || 'Unable to connect to server. Please check your network connection.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    // Record a safety backup before sessions terminate
    fetch('/api/backups/auto', { method: 'POST' }).finally(() => {
      localStorage.clear();
      setToken(null);
      setUsername(null);
      setUserRole(null);
      setUserEmail(null);
      setUserPermissions('');
    });
  };

  // If unauthorized, render bright, modern split login screen
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50/40 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-emerald-500 selection:text-white" id="erp-login-screen">
        <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl shadow-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Column: Login Form */}
          <div className="lg:col-span-6 xl:col-span-5 p-8 sm:p-10 lg:p-12 flex flex-col justify-between bg-white">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">Poultry LMS 360</h1>
                  <p className="text-xs text-slate-500 font-medium">Layer Farm Management System</p>
                </div>
              </div>

              {/* Title Section */}
              <div className="mt-8 mb-6">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Enter your credentials below to access your farm dashboard and operational records.
                </p>
              </div>

              {/* Form Body */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Login Error</span>
                      <span>{loginError}</span>
                    </div>
                  </div>
                )}

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Username or Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Enter username or email"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all font-medium"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter password"
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 transition-all font-medium"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-5"
                  id="submit-login-btn"
                >
                  {authLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Login</span>
                      <LogIn className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer note */}
            <div className="pt-6 mt-6 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Encrypted Session</span>
              <span>All Farm Records Protected</span>
            </div>
          </div>

          {/* Right Column: Poultry Farm Image & System Highlights */}
          <div className="lg:col-span-6 xl:col-span-7 relative min-h-[460px] lg:min-h-full flex flex-col justify-between p-8 sm:p-10 lg:p-12 overflow-hidden bg-slate-900">
            {/* Background Image */}
            <img
              src={farmHeroImage}
              alt="Poultry Layer Farm"
              className="absolute inset-0 w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            
            {/* Gradient Overlay for high legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-900/40" />

            {/* Top Pill */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold border border-white/25 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Layer Farm Operations
              </span>
              <span className="text-xs text-white/90 font-medium tracking-wide">Poultry LMS 360</span>
            </div>

            {/* Bottom Highlights Container */}
            <div className="relative z-10 mt-12 space-y-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                  Smart Management for Layer Poultry Farms
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed max-w-lg">
                  Designed specifically for commercial egg producers to simplify daily flock records, feed milling, inventory, and accounting.
                </p>
              </div>

              {/* 4 Feature Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <div className="bg-slate-900/65 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Daily Production</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Track daily eggs collected, damaged eggs, feed bags used, and bird mortality.
                  </p>
                </div>

                <div className="bg-slate-900/65 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Flock Performance</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Real-time laying percentage curves, flock age in weeks, and production efficiency.
                  </p>
                </div>

                <div className="bg-slate-900/65 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                      <Workflow className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Feed & Milling</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Raw ingredient formulas, batch milling batches, and stock deduction.
                  </p>
                </div>

                <div className="bg-slate-900/65 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                      <BarChart3 className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Sales & Ledgers</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Customer egg billing, feed purchases, cash vouchers, and profitability reports.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Copyright Notice */}
        <div className="mt-6 text-center text-xs text-slate-500 font-medium tracking-wide">
          <p>© {new Date().getFullYear()} Pradipayan Software Solutions. All rights reserved.</p>
        </div>
      </div>
    );
  }

  // Check if current user has a specific granular claim
  const hasPermission = (claim?: string): boolean => {
    if (!userRole) return false;
    if (userRole === 'Developer') return true;
    if (userRole === 'Admin') return true;
    
    const perms = (userPermissions || '').trim().toLowerCase();
    if (perms === 'all' || perms.includes('admin')) return true;
    if (!claim) return true;
    
    const list = perms.split(',').map(p => p.trim());
    return list.includes(claim.toLowerCase());
  };

  // Check if current user can access a specific navigation tab
  const canAccessTab = (tabName: Tab): boolean => {
    if (!userRole) return false;
    if (userRole === 'Developer') return true;
    
    // Developer-exclusive tools
    if (tabName === 'Super Admin Console' || tabName === 'Legacy Migrator' || tabName === 'SQL CLI Console') {
      return false;
    }
    
    // Farm Admin or Developer tools
    if (tabName === 'User Access') {
      return userRole === 'Admin' || hasPermission('admin');
    }
    if (tabName === 'Farm Settings & Access') {
      return userRole === 'Admin' || hasPermission('settings.view') || hasPermission('admin');
    }
    if (tabName === 'Backups') {
      return userRole === 'Admin' || hasPermission('settings.view') || hasPermission('admin');
    }
    if (tabName === 'Bulk Data Import') {
      return userRole === 'Admin' || hasPermission('bulkimport.view') || hasPermission('admin');
    }

    if (userRole === 'Admin') return true;

    // Granular operational modules for Staff / Operator
    switch (tabName) {
      case 'Dashboard':
        return hasPermission('dashboard.view');
      case 'Layer Flocks':
        return hasPermission('flocks.view');
      case 'Daily Logs':
        return hasPermission('dailylogs.view');
      case 'Vaccinations':
        return hasPermission('health.view');
      case 'Warehouse Stock':
        return hasPermission('inventory.view');
      case 'Milling & Mix':
        return hasPermission('inventory.view');
      case 'Stakeholders':
        return hasPermission('customers.view') || hasPermission('suppliers.view');
      case 'Procurement':
        return hasPermission('purchases.view');
      case 'Sales Desk':
        return hasPermission('sales.view');
      case 'Finance Ledgers':
        return hasPermission('financials.view');
      case 'Reports & Ledgers':
        return hasPermission('reports.view');
      default:
        return false;
    }
  };

  // Define navigations mapping
  const menuItems: { name: Tab; icon: any; roles?: string[]; permission?: string }[] = [
    { name: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
    { name: 'Layer Flocks', icon: Activity, permission: 'flocks.view' },
    { name: 'Daily Logs', icon: FileSpreadsheet, permission: 'dailylogs.view' },
    { name: 'Vaccinations', icon: CalendarCheck, permission: 'health.view' },
    { name: 'Milling & Mix', icon: Workflow, permission: 'inventory.view' },
    { name: 'Procurement', icon: Settings, permission: 'purchases.view' },
    { name: 'Sales Desk', icon: Settings, permission: 'sales.view' },
    { name: 'Warehouse Stock', icon: Settings, permission: 'inventory.view' },
    { name: 'Stakeholders', icon: Contact2, permission: 'customers.view' },
    { name: 'Finance Ledgers', icon: Settings, permission: 'financials.view' },
    { name: 'Reports & Ledgers', icon: BarChart3, permission: 'reports.view' },
    { name: 'Bulk Data Import', icon: FileSpreadsheet, roles: ['Developer', 'Admin'], permission: 'bulkimport.view' },
    { name: 'Super Admin Console', icon: Shield, roles: ['Developer'] },
    { name: 'Legacy Migrator', icon: Database, roles: ['Developer'] },
    { name: 'User Access', icon: Key, roles: ['Developer', 'Admin'] },
    { name: 'SQL CLI Console', icon: Database, roles: ['Developer'] },
    { name: 'Backups', icon: Cloud, roles: ['Developer', 'Admin'], permission: 'settings.view' },
    { name: 'Farm Settings & Access', icon: Settings, roles: ['Developer', 'Admin'], permission: 'settings.view' },
  ];

  // Auto-switch to the first permitted tab if the current activeTab is not permitted
  useEffect(() => {
    if (token && userRole) {
      if (!canAccessTab(activeTab)) {
        const firstPermitted = menuItems.find((item) => {
          if (item.roles && !item.roles.includes(userRole || '')) return false;
          return canAccessTab(item.name);
        });
        if (firstPermitted) {
          setActiveTab(firstPermitted.name);
        }
      }
    }
  }, [token, userRole, userPermissions, activeTab]);

  const renderActiveComponent = () => {
    if (!canAccessTab(activeTab)) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-sm space-y-4 font-sans" id="restricted-access-banner">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800">Module Access Restricted</h2>
            <p className="text-xs text-slate-500 max-w-sm">
              Your operator account does not have authorization to view "{activeTab}". Please contact your Farm Administrator to adjust access permissions.
            </p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'Dashboard':
        return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
      case 'Layer Flocks':
        return <Flocks currentLanguage={currentLanguage} />;
      case 'Daily Logs':
        return <DailyLogs currentLanguage={currentLanguage} />;
      case 'Vaccinations':
        return <Vaccinations currentLanguage={currentLanguage} />;
      case 'Warehouse Stock':
        return <Inventories currentLanguage={currentLanguage} />;
      case 'Stakeholders':
        return <Stakeholders currentLanguage={currentLanguage} />;
      case 'Procurement':
        return <Purchasing currentLanguage={currentLanguage} />;
      case 'Sales Desk':
        return <SalesDesk currentLanguage={currentLanguage} />;
      case 'Milling & Mix':
        return <MillingRoom currentLanguage={currentLanguage} />;
      case 'Finance Ledgers':
        return <FinanceLedger currentLanguage={currentLanguage} />;
      case 'Reports & Ledgers':
        return <Reports currentLanguage={currentLanguage} />;
      case 'SQL CLI Console':
        if (userRole !== 'Developer') {
          return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
        }
        return <DeveloperTools currentLanguage={currentLanguage} />;
      case 'Backups':
        return <Backups currentLanguage={currentLanguage} />;
      case 'Farm Settings & Access':
        return <SettingsAudit currentLanguage={currentLanguage} />;
      case 'Bulk Data Import':
        return <BulkImport currentLanguage={currentLanguage} />;
      case 'Super Admin Console':
        if (userRole !== 'Developer') {
          return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
        }
        return <SuperAdminConsole />;
      case 'Legacy Migrator':
        if (userRole !== 'Developer') {
          return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
        }
        return <LegacyMigrator userRole={userRole} />;
      case 'User Access':
        if (userRole !== 'Developer' && userRole !== 'Admin') {
          return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
        }
        return <UserAccessManager />;
      default:
        return <Dashboard currentLanguage={currentLanguage} setCurrentLanguage={(lang: Language) => { setCurrentLanguage(lang); localStorage.setItem('poultry_lang', lang); }} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-700 selection:bg-indigo-500 selection:text-white" id="agricultural-erp-spa">
      
      {/* Dynamic desktop / mobile sidebar panel drawer */}
      <aside className={`w-full ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'} bg-[#032e1d] text-slate-300 flex flex-col border-r border-[#0d452f] shrink-0 select-none z-10 font-sans md:h-screen md:max-h-screen md:sticky md:top-0 transition-all duration-300`} id="erp-sidebar-console">
        <div className={`${sidebarCollapsed ? 'p-3.5' : 'p-5'} border-b border-[#0d452f] flex items-center justify-between shrink-0 transition-all duration-300`}>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Flame className="h-5 w-5 animate-pulse" />
            </span>
            {!sidebarCollapsed && (
              <div className="animate-fade-in">
                <span className="text-sm font-bold font-display text-white tracking-tight block">Poultry LMS 360</span>
                <span className="text-[10px] text-indigo-400 font-mono font-semibold uppercase tracking-wider">Operational Hub</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Desktop toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex p-1 rounded bg-[#0a3f29] hover:bg-indigo-600 text-white border border-[#0d5337] smooth-hover cursor-pointer"
              title={sidebarCollapsed ? 'Expand Menu Bar' : 'Shrink Menu Bar'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-[#0a3f29] text-white border border-[#0d5337] block md:hidden smooth-hover"
            >
              {mobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Navigator Drawer Menu links */}
        <nav className={`flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[60vh] md:max-h-none border-b border-[#0d452f]/50 md:border-b-0 ${mobileMenuOpen ? 'block animate-fade-in' : 'hidden md:block'}`} id="sidebar-navigator-block">
          {menuItems.map((item) => {
            if (item.roles && !item.roles.includes(userRole || '')) {
              return null;
            }
            if (!canAccessTab(item.name)) {
              return null;
            }
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            const t = translations[currentLanguage];

            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group relative ${
                  sidebarCollapsed ? 'justify-center px-0 py-3' : 'px-3.5 py-2.5 gap-3'
                } ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-emerald-300/80 hover:text-white hover:bg-[#07452d]/60'
                }`}
                id={`sidebar-tab-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
                title={sidebarCollapsed ? getTabTranslation(item.name, t) : undefined}
              >
                <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-400 group-hover:text-white'}`} />
                {!sidebarCollapsed && <span className="truncate">{getTabTranslation(item.name, t)}</span>}
                {item.name === 'Vaccinations' && vaccineAlertsCount > 0 && (
                  <span className={`absolute ${sidebarCollapsed ? 'top-1 right-2' : 'top-2 right-2'} flex h-2 w-2`}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
                {!sidebarCollapsed && (
                  <ChevronRight className={`h-3 w-3 ml-auto transition-transform shrink-0 ${isActive ? 'opacity-100 rotate-90' : 'opacity-0 group-hover:opacity-100'}`} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Current logged operator signature badge */}
        <div className={`p-4 border-t border-[#0d452f]/60 bg-[#021d12]/40 font-mono text-[11px] space-y-2 mt-auto shrink-0 ${sidebarCollapsed ? 'flex flex-col items-center justify-center p-3' : ''} ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-emerald-400/80 uppercase font-black text-[9px] tracking-widest">
                  {translations[currentLanguage].activeOperator}
                </span>
              </div>

              <div className="bg-[#021f14] border border-[#0d452f]/70 p-2.5 rounded-xl space-y-1">
                <span className="text-white block font-sans font-bold leading-tight truncate">{username}</span>
                <span className="text-indigo-400 block text-[10px] font-semibold">{userRole}</span>
                <span className="text-emerald-500/80 block text-[9px] truncate">{userEmail}</span>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-[#0d452f] hover:border-rose-900/60 text-emerald-400/80 hover:text-rose-400 hover:bg-rose-950/20 text-[10px] font-semibold rounded-lg font-sans smooth-hover"
                id="logout-btn"
              >
                <LogOut className="h-3.5 w-3.5" />
                {translations[currentLanguage].lockConsole}
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="p-2 border border-[#0d452f] hover:border-rose-900/60 text-emerald-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg smooth-hover"
              id="logout-btn"
              title={translations[currentLanguage].lockConsole}
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main operational view shell */}
      <main className="flex-1 flex flex-col min-w-0 font-sans relative selection:bg-indigo-500">
        
        {/* Universal ERP status banner panel */}
        <header className="h-16 border-b border-slate-200/85 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 select-none" id="erp-fluid-header">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Multi-Tenant Active Farm Indicator */}
            {userRole === 'Developer' ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider hidden sm:inline">Farm:</span>
                <select
                  value={currentFarm?.Id || ''}
                  onChange={(e) => switchFarm(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-emerald-900 focus:outline-none cursor-pointer"
                  title="Switch active tenant workspace"
                >
                  {farms.map((f) => (
                    <option key={f.Id} value={f.Id}>
                      #{f.Id} - {f.FarmName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px] sm:max-w-[220px]">
                  {currentFarm?.FarmName || 'Poultry LMS 360'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">#{currentFarm?.Id || 1}</span>
              </div>
            )}

            <span className="hidden sm:inline-block h-3 w-px bg-slate-200"></span>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium font-mono">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{currentTime || '12:00:00 PM'}</span>
            </div>
          </div>

          {/* Core metadata alerts and global language switcher */}
          <div className="flex items-center gap-2 font-sans select-none">
            <div className="flex items-center">
              <select
                value={currentLanguage}
                onChange={(e) => {
                  const newLang = e.target.value as Language;
                  setCurrentLanguage(newLang);
                  localStorage.setItem('poultry_lang', newLang);
                }}
                className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold px-2 py-1 sm:px-2.5 sm:py-1.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer text-[11px] sm:text-xs"
                id="global-header-lang-selector"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {vaccineAlertsCount > 0 && (
              <button
                onClick={() => setActiveTab('Vaccinations')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 hover:border-rose-200 rounded-xl text-xs font-bold transition-all duration-300 shadow-sm animate-pulse cursor-pointer shrink-0"
                title={`${vaccineAlertsCount} immunization alerts due! Click to inspect.`}
              >
                <ShieldAlert className="h-4 w-4 text-rose-600 animate-bounce shrink-0" />
                <span className="hidden leading-none md:inline-block">🚨 {vaccineAlertsCount} Vaccine Alert(s) Due!</span>
                <span className="inline-block md:hidden">🚨 {vaccineAlertsCount}</span>
              </button>
            )}
          </div>
        </header>

        {/* Render physical ERP sub module view */}
        <section className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8" id="erp-routing-outlet">
          {renderActiveComponent()}
        </section>
      </main>

      {/* Non-blocking Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" id="toast-notifications-stack">
        {toasts.map((toast) => {
          let bgColor = 'bg-slate-900/95 text-white';
          let borderColor = 'border-slate-800';
          let textColor = 'text-white';
          let iconColor = 'text-indigo-400';

          if (toast.type === 'success') {
            bgColor = 'bg-emerald-950/95 border-emerald-500/35';
            borderColor = 'border-emerald-500/50';
            textColor = 'text-emerald-50';
            iconColor = 'text-emerald-400';
          } else if (toast.type === 'error') {
            bgColor = 'bg-rose-950/95 border-rose-500/35';
            borderColor = 'border-rose-500/50';
            textColor = 'text-rose-50';
            iconColor = 'text-rose-400';
          } else if (toast.type === 'warning') {
            bgColor = 'bg-amber-950/95 border-amber-500/35';
            borderColor = 'border-amber-500/50';
            textColor = 'text-amber-50';
            iconColor = 'text-amber-400';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${bgColor} ${borderColor} shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100`}
              style={{ contentVisibility: 'auto' }}
            >
              <span className={`p-1 rounded-lg ${iconColor} bg-white/5 shrink-0`}>
                {toast.type === 'success' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : toast.type === 'error' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </span>
              <div className="flex-1 text-xs font-medium leading-relaxed break-words pr-2 text-slate-100">
                {toast.message}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white transition-colors p-0.5 rounded-md hover:bg-white/10 cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
