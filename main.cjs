const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

// Force Electron to register "Poultry LMS 360" as the official name instead of "Electron"
app.name = 'Poultry LMS 360';

if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

let mainWindow;

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
    icon: path.join(__dirname, 'assets', 'icon.png'), // Bind brand icon to the main browser viewport window
    show: false, // Smoothly show window only when content is loaded
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged // Completely lock down developer inspection tools on production
    }
  });

  // Hides standard application window bars (File, Edit, etc) for production
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // Ping Express health endpoint until live, then safely display viewport
  const loadWithRetry = () => {
    http.get('http://localhost:3000/api/health', (res) => {
      if (res.statusCode === 200) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.once('ready-to-show', () => {
          mainWindow.show();
        });
      } else {
        setTimeout(loadWithRetry, 300);
      }
    }).on('error', () => {
      setTimeout(loadWithRetry, 300);
    });
  };

  loadWithRetry();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Prevent double launches to protect local SQLite database from lock conflictions
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
    // Safely load database / Express server from secure bytecode, falling back to source if needed
    try {
      const serverJscPath = path.join(__dirname, 'dist', 'server.jsc');
      const serverCjsPath = path.join(__dirname, 'dist', 'server.cjs');
      
      if (fs.existsSync(serverJscPath)) {
        try {
          require(serverJscPath);
          console.log('Backend Express server initialized successfully from bytecode.');
        } catch (jscErr) {
          console.warn('Failed to load server.jsc bytecode, trying fallback to server.cjs:', jscErr);
          require(serverCjsPath);
          console.log('Backend Express server initialized successfully from source fallback.');
        }
      } else if (fs.existsSync(serverCjsPath)) {
        require(serverCjsPath);
        console.log('Backend Express server initialized successfully from source.');
      } else {
        throw new Error('Both database server bytecode and fallback source files are missing.');
      }
    } catch (err) {
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Poultry LMS 360 - Database Boot Error',
        `Failed to launch the embedded local database server:\n\n${err.stack || err}`
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
