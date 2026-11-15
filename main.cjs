const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

// Safe WebSocket polyfill
class SafeWebSocketStub {
  constructor(url) { this.url = url; this.readyState = 3; }
  close() {} send() {} addEventListener() {} removeEventListener() {} dispatchEvent() { return true; }
}
SafeWebSocketStub.CONNECTING = 0; SafeWebSocketStub.OPEN = 1; SafeWebSocketStub.CLOSING = 2; SafeWebSocketStub.CLOSED = 3;

try {
  const wsPkg = require('ws');
  const wsImpl = wsPkg.default || wsPkg || SafeWebSocketStub;
  if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = wsImpl;
  if (typeof global.WebSocket === 'undefined') global.WebSocket = wsImpl;
} catch (e) {
  if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = SafeWebSocketStub;
  if (typeof global.WebSocket === 'undefined') global.WebSocket = SafeWebSocketStub;
}

try {
  require('bytenode');
} catch (e) {
  // bytenode is optional for bytecode runtime
}

// Set official application name and environment
app.name = 'Poultry LMS 360';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

let mainWindow = null;

const { spawn } = require('child_process');

let pendingDesktopInstallerPath = null;
let desktopUpdateApplied = false;

function isNewerSemver(remoteVer, localVer) {
  const cleanRemote = String(remoteVer || '').replace(/^v/i, '').split('-')[0];
  const cleanLocal = String(localVer || '').replace(/^v/i, '').split('-')[0];
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

function launchSilentInstallerAndRelaunch(installerPath, relaunchAfter) {
  if (!installerPath || !fs.existsSync(installerPath) || desktopUpdateApplied) return;
  desktopUpdateApplied = true;
  try {
    const helperBat = path.join(os.tmpdir(), 'poultry-lms-autoupdate.bat');
    const currentExe = process.execPath;
    const lines = [
      '@echo off',
      'timeout /t 2 /nobreak >nul',
      `start /wait "" "${installerPath}" /S`,
      relaunchAfter ? `if exist "${currentExe}" start "" "${currentExe}"` : '',
      `del "${installerPath}" >nul 2>&1`,
      'del "%~f0" >nul 2>&1'
    ].filter(Boolean);
    fs.writeFileSync(helperBat, lines.join('\r\n'), 'utf8');
    const child = spawn('cmd.exe', ['/c', helperBat], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch (err) {
    console.error('[AutoUpdate] Failed to schedule silent installer:', err);
  }
}

app.on('before-quit', () => {
  if (pendingDesktopInstallerPath && fs.existsSync(pendingDesktopInstallerPath) && !desktopUpdateApplied) {
    launchSilentInstallerAndRelaunch(pendingDesktopInstallerPath, false);
  }
});

// Background silent auto-updater for Windows Desktop (.exe)
function checkWindowsAutoUpdate() {
  if (!app.isPackaged) return;

  const currentVersion = app.getVersion();
  const options = {
    hostname: 'api.github.com',
    path: '/repos/devrupeshgadkhe/Poultry-LMS360/releases/latest',
    headers: {
      'User-Agent': 'PoultryLMS360-Desktop-Updater'
    }
  };

  https.get(options, (res) => {
    if (res.statusCode !== 200) return;
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        if (!release || !release.tag_name) return;

        const remoteTag = release.tag_name.trim().replace(/^v/i, '');
        const localTag = currentVersion.trim().replace(/^v/i, '');

        if (isNewerSemver(remoteTag, localTag) && release.assets && Array.isArray(release.assets)) {
          const exeAsset = release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
          if (exeAsset && exeAsset.browser_download_url) {
            console.log(`[AutoUpdate] Found newer desktop version v${remoteTag}. Silently downloading in background...`);

            const finalExePath = path.join(os.tmpdir(), `Poultry-LMS-360-Setup-${remoteTag}.exe`);
            const partialExePath = `${finalExePath}.part`;

            // Clean up stale partial download
            try { if (fs.existsSync(partialExePath)) fs.unlinkSync(partialExePath); } catch {}

            const downloadReq = (url, redirects = 0) => {
              if (redirects > 5) return;
              https.get(url, { headers: { 'User-Agent': 'PoultryLMS360-Desktop-Updater' } }, (dlRes) => {
                if (dlRes.statusCode >= 300 && dlRes.statusCode < 400 && dlRes.headers.location) {
                  dlRes.resume();
                  return downloadReq(dlRes.headers.location, redirects + 1);
                }
                if (dlRes.statusCode !== 200) {
                  dlRes.resume();
                  return;
                }

                const fileStream = fs.createWriteStream(partialExePath);
                dlRes.pipe(fileStream);

                fileStream.on('finish', () => {
                  fileStream.close(() => {
                    try {
                      const stats = fs.statSync(partialExePath);
                      // Verify valid installer (> 10MB)
                      if (stats.size > 10 * 1024 * 1024) {
                        if (fs.existsSync(finalExePath)) fs.unlinkSync(finalExePath);
                        fs.renameSync(partialExePath, finalExePath);
                        pendingDesktopInstallerPath = finalExePath;
                        console.log('[AutoUpdate] Installer verified and staged:', finalExePath);

                        if (mainWindow && !mainWindow.isDestroyed()) {
                          dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Update Ready',
                            message: `Poultry LMS 360 v${remoteTag} is downloaded and ready.`,
                            detail: 'Click "Restart & Update" to apply automatically, or continue working (it will auto-install when you close the app).',
                            buttons: ['Restart & Update Now', 'Install on Exit'],
                            defaultId: 0
                          }).then(({ response }) => {
                            if (response === 0) {
                              launchSilentInstallerAndRelaunch(finalExePath, true);
                              app.quit();
                            }
                          });
                        }
                      } else {
                        fs.unlinkSync(partialExePath);
                      }
                    } catch (verifyErr) {
                      console.warn('[AutoUpdate] Verification error:', verifyErr);
                    }
                  });
                });

                fileStream.on('error', () => {
                  try { fs.unlinkSync(partialExePath); } catch {}
                });
              }).on('error', (err) => {
                console.warn('[AutoUpdate] Download error:', err);
              });
            };

            downloadReq(exeAsset.browser_download_url);
          }
        }
      } catch (e) {
        console.warn('[AutoUpdate] Parse error:', e.message);
      }
    });
  }).on('error', (e) => {
    console.warn('[AutoUpdate] Check error:', e.message);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Poultry LMS 360',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  });

  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  const targetUrl = 'http://127.0.0.1:3000';
  let retries = 0;
  const maxRetries = 60; // 30 seconds

  const scheduleRetry = () => {
    retries++;
    if (retries > maxRetries) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
        mainWindow.show();
      }
      return;
    }
    setTimeout(loadWithRetry, 500);
  };

  // Ping Express health endpoint using IPv4 localhost, then safely display viewport
  const loadWithRetry = () => {
    http.get(`${targetUrl}/api/health`, (res) => {
      if (res.statusCode === 200) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(targetUrl);
          mainWindow.once('ready-to-show', () => {
            mainWindow.show();
          });
        }
      } else {
        scheduleRetry();
      }
    }).on('error', () => {
      scheduleRetry();
    });
  };

  // Inject native desktop version so renderer does not show duplicate web update prompts
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const appVer = JSON.stringify(app.getVersion());
      mainWindow.webContents.executeJavaScript(
        `window.poultryDesktopVersion = ${appVer}; window.poultryDesktopHandledUpdate = true;`
      ).catch(() => {});
    }
  });

  // Auto-recovery if initial render receives a temporary network connection error
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Electron] Page failed to load (${errorCode}: ${errorDescription}), retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, 1000);
  });

  loadWithRetry();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock to prevent duplicate conflicting processes
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      const serverJscPath = path.join(__dirname, 'dist', 'server.jsc');
      const serverCjsPath = path.join(__dirname, 'dist', 'server.cjs');
      
      let serverLoaded = false;
      if (fs.existsSync(serverJscPath)) {
        try {
          require('bytenode');
          require(serverJscPath);
          serverLoaded = true;
          console.log('Backend Express server initialized from bytecode.');
        } catch (jscErr) {
          console.warn('Failed to load server.jsc bytecode, falling back to server.cjs:', jscErr);
        }
      }

      if (!serverLoaded && fs.existsSync(serverCjsPath)) {
        require(serverCjsPath);
        serverLoaded = true;
        console.log('Backend Express server initialized from source.');
      }

      if (!serverLoaded) {
        throw new Error('Application server files are missing (dist/server.cjs).');
      }
    } catch (err) {
      dialog.showErrorBox(
        'Poultry LMS 360 - Startup Error',
        `Failed to launch the application backend server:\n\n${err.stack || err}`
      );
      process.exit(1);
    }

    createMainWindow();
    
    // Check for newer Windows .exe releases on GitHub
    setTimeout(checkWindowsAutoUpdate, 3000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
