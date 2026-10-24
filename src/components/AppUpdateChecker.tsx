import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, X, Sparkles, Smartphone, Monitor } from 'lucide-react';

interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  apkDownloadUrl?: string;
  exeDownloadUrl?: string;
  htmlUrl: string;
}

export const CURRENT_APP_VERSION = 'v1.0.0';

export const AppUpdateChecker: React.FC = () => {
  const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState<boolean>(false);

  useEffect(() => {
    // Detect if running on Android or mobile
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isAndroid = /android/i.test(userAgent);
    setIsAndroidDevice(isAndroid);

    // Initial check for updates
    checkForUpdates();

    // Check periodically every 2 hours
    const interval = setInterval(checkForUpdates, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForUpdates = async () => {
    try {
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
      const current = CURRENT_APP_VERSION.replace(/^v/, '');
      const remote = remoteTag.replace(/^v/, '');

      // Find APK and EXE assets
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

      // Compare versions (if remote is different / higher)
      if (remote !== current && remoteTag !== CURRENT_APP_VERSION) {
        setHasUpdate(true);
      }
    } catch (err) {
      console.warn('[UpdateChecker] Could not fetch latest release info:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdateClick = () => {
    if (isAndroidDevice) {
      // Show permission explanation before downloading APK
      setShowPermissionModal(true);
    } else {
      // Directly download or trigger update
      executeDownload();
    }
  };

  const executeDownload = () => {
    setShowPermissionModal(false);
    setIsDownloading(true);
    setDownloadProgress(10);

    // Determine target URL based on device
    let downloadUrl = '';
    if (isAndroidDevice && latestRelease?.apkDownloadUrl) {
      downloadUrl = latestRelease.apkDownloadUrl;
    } else if (latestRelease?.exeDownloadUrl) {
      downloadUrl = latestRelease.exeDownloadUrl;
    } else if (latestRelease?.apkDownloadUrl) {
      downloadUrl = latestRelease.apkDownloadUrl;
    } else {
      downloadUrl = latestRelease?.htmlUrl || 'https://github.com/devrupeshgadkhe/Poultry-LMS360/releases/latest';
    }

    // Simulate progress and trigger download
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

      // Open download link
      window.location.href = downloadUrl;
    }, 1200);
  };

  if (!hasUpdate || isDismissed || !latestRelease) {
    return null;
  }

  return (
    <>
      {/* Floating Top Banner Notification */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[94%] bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white shadow-2xl rounded-2xl p-3 px-4 border border-teal-400/30 backdrop-blur-md transition-all animate-bounce-short">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-amber-400/90 text-slate-900 px-2 py-0.5 rounded-full">
                  नवीन अपडेट
                </span>
                <span className="text-xs text-teal-100 font-mono">
                  {latestRelease.tagName}
                </span>
              </div>
              <p className="text-sm font-medium text-white truncate mt-0.5">
                नवीन सुधारणा व फीचर्स उपलब्ध आहेत!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs md:text-sm px-3.5 py-1.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>अपडेट करा</span>
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-teal-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="रद्द करा"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Update Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
                    <span>सध्याची आवृत्ती: <strong className="text-slate-300 font-mono">{CURRENT_APP_VERSION}</strong></span>
                    <span>•</span>
                    <span>नवीन आवृत्ती: <strong className="text-emerald-400 font-mono">{latestRelease.tagName}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Release notes */}
            <div className="mt-5 bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 max-h-48 overflow-y-auto text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">
              <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                नवीन आवृत्तीमधील महत्त्वाच्या सुधारणा:
              </h4>
              {latestRelease.body || `• ऑटो-अपडेट आणि परफॉर्मन्स सुधारणा\n• क्लाउड डेटाबेस रिअल-टाइम सिंक वाढवले\n• रिपोर्टिंग आणि ग्राफिक्स गती वाढवली`}
            </div>

            {/* Target platform badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {latestRelease.apkDownloadUrl && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-lg">
                  <Smartphone className="w-3.5 h-3.5" /> Android APK उपलब्ध
                </span>
              )}
              {latestRelease.exeDownloadUrl && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 rounded-lg">
                  <Monitor className="w-3.5 h-3.5" /> Windows .EXE उपलब्ध
                </span>
              )}
            </div>

            {/* Progress bar if downloading */}
            {isDownloading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>डाऊनलोड सुरू आहे...</span>
                  <span>{downloadProgress}%</span>
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
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                नंतर आठवण करा
              </button>
              <button
                type="button"
                disabled={isDownloading}
                onClick={handleUpdateClick}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>डाऊनलोड होत आहे...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{isAndroidDevice ? 'APK डाऊनलोड करा' : 'अपडेट डाऊनलोड करा'}</span>
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
          <div className="bg-slate-900 border border-teal-500/40 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
            </div>

            <h3 className="text-lg font-bold text-white">
              डिव्हाइस परवानग्या आवश्यक (Device Permissions)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              नवीन APK अपडेट सुरक्षितपणे सेव्ह करून इन्स्टॉल करण्यासाठी खालील परवानग्या आवश्यक आहेत:
            </p>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-slate-200 block">स्टोरेज ॲक्सेस (Storage Permission)</strong>
                  <span className="text-slate-400">नवीन APK फाईल डाऊनलोड फोल्डरमध्ये सुरक्षितपणे सेव्ह करण्यासाठी.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-slate-200 block">ॲप इन्स्टॉलेशन (Install Permission)</strong>
                  <span className="text-slate-400">नवीन व्हर्जन डाऊनलोड झाल्यावर थेट ॲप अपडेट करण्याची परवानगी.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-slate-200 block">नोटिफिकेशन्स (Notification Permission)</strong>
                  <span className="text-slate-400">अपडेट डाऊनलोडची प्रगती आणि यश संदेश मिळवण्यासाठी.</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-medium"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={executeDownload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>परवानगी द्या व डाऊनलोड करा</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
