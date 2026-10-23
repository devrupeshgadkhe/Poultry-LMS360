const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Force Electron to register "Poultry LMS 360" as the official name instead of "Electron"
app.name = 'Poultry LMS 360';

if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

let mainWindow;

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
