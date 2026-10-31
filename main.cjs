const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

try {
  const WebSocket = require('ws');
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }
} catch (e) {
  // ws polyfill fallback
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

// Background auto-updater for Windows Desktop (.exe)
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
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        if (!release || !release.tag_name) return;

        const remoteTag = release.tag_name.trim().replace(/^v/, '');
        const localTag = currentVersion.trim().replace(/^v/, '');

        if (remoteTag !== localTag && release.assets && Array.isArray(release.assets)) {
          const exeAsset = release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
          if (exeAsset && exeAsset.browser_download_url) {
            console.log(`[AutoUpdate] Found new desktop version: ${release.tag_name}. Starting background download...`);

            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Poultry LMS 360 Update',
              message: `New version available (${release.tag_name})!`,
              detail: 'Poultry LMS 360 will automatically download and prepare the update.',
              buttons: ['OK']
            });

            const tempExePath = path.join(os.tmpdir(), `Poultry-LMS-360-Setup-${release.tag_name}.exe`);
            const fileStream = fs.createWriteStream(tempExePath);

            const downloadReq = (url) => {
              https.get(url, { headers: { 'User-Agent': 'PoultryLMS360-Desktop-Updater' } }, (dlRes) => {
                if (dlRes.statusCode === 302 || dlRes.statusCode === 301) {
                  return downloadReq(dlRes.headers.location);
                }
                dlRes.pipe(fileStream);
                fileStream.on('finish', () => {
                  fileStream.close();
                  console.log('[AutoUpdate] Installer download completed:', tempExePath);

                  dialog.showMessageBox(mainWindow, {
                    type: 'question',
                    title: 'Update Ready to Install',
                    message: 'The new update has been downloaded. Would you like to install and restart now?',
                    buttons: ['Install & Restart Now', 'Later'],
                    defaultId: 0
                  }).then(({ response }) => {
                    if (response === 0) {
                      exec(`"${tempExePath}"`, (err) => {
                        if (err) console.error('[AutoUpdate] Failed to run installer:', err);
                      });
                      app.quit();
                    }
                  });
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
