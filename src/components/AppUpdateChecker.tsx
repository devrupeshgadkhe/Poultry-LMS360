import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, X, ArrowUpCircle, Smartphone, Monitor } from 'lucide-react';

interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  apkDownloadUrl?: string;
  exeDownloadUrl?: string;
  htmlUrl: string;
}

function getInstalledAppVersion(): { version: string; hasNativeBridge: boolean } {
  const win = window as any;
  if (win.PoultryAndroid && typeof win.PoultryAndroid.getAppVersion === 'function') {
    try {
      const nativeVer = String(win.PoultryAndroid.getAppVersion() || '').trim();
      if (nativeVer) {
        return {
          version: nativeVer.startsWith('v') ? nativeVer : `v${nativeVer}`,
          hasNativeBridge: true
        };
      }
    } catch {
      // Fallback
    }
  }

  if (win.poultryDesktopVersion) {
    const desktopVer = String(win.poultryDesktopVersion).trim();
    if (desktopVer) {
      return {
        version: desktopVer.startsWith('v') ? desktopVer : `v${desktopVer}`,
        hasNativeBridge: true
      };
    }
  }

  const envVer = (import.meta as any).env?.VITE_APP_VERSION;
  if (envVer) {
    const s = String(envVer).trim();
    return { version: s.startsWith('v') ? s : `v${s}`, hasNativeBridge: false };
  }

  return { version: 'v1.0.10', hasNativeBridge: false };
}

export const CURRENT_APP_VERSION = getInstalledAppVersion().version;

function isStrictlyNewerVersion(remoteVer: string, localVer: string): boolean {
  const cleanRemote = remoteVer.replace(/^v/i, '').split('-')[0];
  const cleanLocal = localVer.replace(/^v/i, '').split('-')[0];
  const rParts = cleanRemote.split('.').map(n => parseInt(n, 10) || 0);
  const lParts = cleanLocal.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(rParts.length, lParts.length, 3);

  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export const AppUpdateChecker: React.FC = () => {
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>(() => getInstalledAppVersion().version);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatusText, setDownloadStatusText] = useState<string>('Downloading package...');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState<boolean>(false);

  const checkForUpdates = useCallback(async () => {
    try {
      const win = window as any;
      // Desktop native silent auto-updater handles Windows .exe updates directly without duplicate web banner
      if (win.poultryDesktopHandledUpdate) {
        setHasUpdate(false);
        return;
      }

      const detected = getInstalledAppVersion();
      setCurrentVersion(detected.version);

      setIsChecking(true);
      const res = await fetch('https://api.github.com/repos/devrupeshgadkhe/Poultry-LMS360/releases/latest', {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!data || !data.tag_name) return;

      const remoteTag = data.tag_name.trim();
      const dismissedTag = sessionStorage.getItem('poultry_dismissed_update_tag');
      if (dismissedTag === remoteTag) {
        setHasUpdate(false);
        return;
      }

      if (!detected.hasNativeBridge) {
        const legacyInstalled = localStorage.getItem('poultry_installed_version');
        if (legacyInstalled === remoteTag) {
          setHasUpdate(false);
          return;
        }
      }

      let apkUrl = '';
      let exeUrl = '';

      if (Array.isArray(data.assets)) {
        for (const asset of data.assets) {
          const name = (asset.name || '').toLowerCase();
          if (name.endsWith('.apk')) {
            apkUrl = asset.browser_download_url;
          } else if (name.endsWith('.exe')) {
            exeUrl = asset.browser_download_url;
          }
        }
      }

      const release: ReleaseInfo = {
        tagName: remoteTag,
        name: data.name || remoteTag,
        body: data.body || '',
        publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString() : '',
        apkDownloadUrl: apkUrl,
        exeDownloadUrl: exeUrl,
        htmlUrl: data.html_url
      };

      setLatestRelease(release);

      if (isStrictlyNewerVersion(remoteTag, detected.version)) {
        // Only show Android update banner if APK exists (and on desktop only if EXE exists)
        const userAgent = navigator.userAgent || '';
        const onAndroid = /android/i.test(userAgent) || Boolean(win.PoultryAndroid);
        if (onAndroid && apkUrl) {
          setHasUpdate(true);
        } else if (!onAndroid && exeUrl && (win.navigator?.userAgent?.includes('Electron') || win.poultryDesktopVersion)) {
          setHasUpdate(true);
        } else {
          setHasUpdate(false);
        }
      } else {
        setHasUpdate(false);
      }
    } catch (err) {
      console.warn('[UpdateChecker] Could not fetch latest release info:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const win = window as any;
    const userAgent = navigator.userAgent || navigator.vendor || win.opera || '';
    const isAndroid = /android/i.test(userAgent) || Boolean(win.PoultryAndroid);
    setIsAndroidDevice(isAndroid);

    // Expose live progress callback for Android DownloadManager
    win.onAndroidUpdateProgress = (pct: number, status: string, message: string) => {
      setDownloadProgress(Math.max(0, Math.min(100, Number(pct) || 0)));
      if (message) setDownloadStatusText(message);

      if (status === 'downloading') {
        setIsDownloading(true);
        setDownloadError(null);
      } else if (status === 'completed') {
        setIsDownloading(false);
        setShowModal(false);
        setHasUpdate(false);
      } else if (status === 'failed') {
        setIsDownloading(false);
        setDownloadError(message || 'Update download failed. Please try again.');
      }
    };

    checkForUpdates();

    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (win.onAndroidUpdateProgress) {
        delete win.onAndroidUpdateProgress;
      }
    };
  }, [checkForUpdates]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setHasUpdate(false);
    setShowModal(false);
    if (latestRelease?.tagName) {
      sessionStorage.setItem('poultry_dismissed_update_tag', latestRelease.tagName);
    }
  };

  const handleMarkAsUpdated = () => {
    if (latestRelease?.tagName) {
      localStorage.setItem('poultry_installed_version', latestRelease.tagName);
      sessionStorage.setItem('poultry_dismissed_update_tag', latestRelease.tagName);
    }
    setIsDismissed(true);
    setHasUpdate(false);
    setShowModal(false);
  };

  const handleUpdateClick = () => {
    const win = window as any;
    setDownloadError(null);

    if (isAndroidDevice && win.PoultryAndroid) {
      // Only ask permission explanation if Install Unknown Apps is not yet allowed
      try {
        if (typeof win.PoultryAndroid.canRequestPackageInstalls === 'function' && !win.PoultryAndroid.canRequestPackageInstalls()) {
          setShowPermissionModal(true);
          return;
        }
      } catch {
        // Proceed cleanly
      }
      executeDownload();
      return;
    }

    if (isAndroidDevice) {
      setShowPermissionModal(true);
    } else {
      executeDownload();
    }
  };

  const executeDownload = () => {
    const win = window as any;
    setShowPermissionModal(false);
    setDownloadError(null);
    setIsDownloading(true);
    setDownloadProgress(5);
    setDownloadStatusText('Preparing download...');

    let downloadUrl = '';
    if (isAndroidDevice && latestRelease?.apkDownloadUrl) {
      downloadUrl = latestRelease.apkDownloadUrl;
    } else if (latestRelease?.exeDownloadUrl) {
      downloadUrl = latestRelease.exeDownloadUrl;
    } else if (latestRelease?.apkDownloadUrl) {
      downloadUrl = latestRelease.apkDownloadUrl;
    } else {
      downloadUrl = latestRelease?.htmlUrl || '';
    }

    if (!downloadUrl) {
      setIsDownloading(false);
      setDownloadError('Update package URL not available for this device.');
      return;
    }

    // Use native Android bridge for reliable in-app DownloadManager + installer launch
    if (isAndroidDevice && win.PoultryAndroid && typeof win.PoultryAndroid.downloadAndInstallUpdate === 'function') {
      try {
        win.PoultryAndroid.downloadAndInstallUpdate(downloadUrl, latestRelease?.tagName || 'latest');
        return;
      } catch (e: any) {
        console.warn('[UpdateChecker] Native Android bridge fallback:', e);
      }
    }

    // Legacy / Browser fallback
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 20;
      });
    }, 250);

    setTimeout(() => {
      clearInterval(interval);
      setDownloadProgress(100);
      setIsDownloading(false);
      setShowModal(false);
      window.location.href = downloadUrl;
    }, 900);
  };

  if (!hasUpdate || isDismissed || !latestRelease || isChecking) {
    return null;
  }

  return (
    <>
      {/* Floating Top Banner Notification */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[94%] bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white shadow-2xl rounded-2xl p-3 px-4 border border-teal-400/30 backdrop-blur-md transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <ArrowUpCircle className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-amber-400/90 text-slate-900 px-2 py-0.5 rounded-full">
                  Update Available
                </span>
                <span className="text-xs text-teal-100 font-mono">
                  {latestRelease.tagName}
                </span>
              </div>
              <p className="text-sm font-medium text-white truncate mt-0.5">
                New features, stability fixes, and enhancements are ready to install.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs md:text-sm px-3.5 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Update Now</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-teal-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Update Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                  {isAndroidDevice ? (
                    <Smartphone className="w-6 h-6 text-teal-400" />
                  ) : (
                    <Monitor className="w-6 h-6 text-teal-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Poultry LMS 360 Update
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span>Current Version: <strong className="text-slate-300 font-mono">{currentVersion}</strong></span>
                    <span>•</span>
                    <span>Latest Version: <strong className="text-emerald-400 font-mono">{latestRelease.tagName}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Release notes */}
            <div className="mt-5 bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 max-h-48 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
              <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Release Highlights:
              </h4>
              {latestRelease.body || `• Automated multi-platform update support\n• Real-time cloud synchronization\n• Performance optimizations and stability improvements`}
            </div>

            {/* Error display if download failed */}
            {downloadError && (
              <div className="mt-4 p-3 bg-rose-950/70 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}

            {/* Progress bar if downloading */}
            {isDownloading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{downloadStatusText}</span>
                  <span className="font-mono font-bold text-emerald-400">{downloadProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              {!getInstalledAppVersion().hasNativeBridge && (
                <button
                  type="button"
                  onClick={handleMarkAsUpdated}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-teal-600/50 bg-teal-950/40 text-teal-300 hover:bg-teal-900/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>Already Updated</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Later
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleUpdateClick}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating ({downloadProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{isAndroidDevice ? 'Install Update' : 'Download Update'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android Device Permission Request Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-teal-500/40 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              App Update Permission Required
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              To install the update smoothly inside the app, Android requires allowing app installs from Poultry LMS 360.
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-slate-200 block">Automatic Download & Install</strong>
                  <span className="text-slate-400">The update downloads in background and opens the installer automatically.</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDownload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download & Install</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
