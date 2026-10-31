// Poultry LMS 360 - Safe Electron Bootstrap Loader
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

try {
  const WebSocket = require('ws');
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }
} catch (e) {}

// Global uncaught handler to catch asynchronous startup errors
process.on('uncaughtException', (err) => {
  const errorMsg = err && err.stack ? err.stack : String(err);
  try {
    dialog.showErrorBox('Poultry LMS 360 - Startup Exception', errorMsg);
  } catch (e) {
    console.error('Uncaught Exception:', errorMsg);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const errorMsg = reason && reason.stack ? reason.stack : String(reason);
  console.warn('[Process] Unhandled Rejection:', errorMsg);
});

let loaded = false;

// 1. Try bytecode binary if available and bytenode is operational
try {
  const binaryPath = path.join(__dirname, 'main.jsc');
  if (fs.existsSync(binaryPath)) {
    try {
      require('bytenode');
      require(binaryPath);
      loaded = true;
    } catch (jscErr) {
      console.warn('Failed to load main.jsc bytecode, falling back to main.cjs:', jscErr);
    }
  }
} catch (e) {
  console.warn('Bytecode loader initialization warning:', e);
}

// 2. Fall back to standard CommonJS main script
if (!loaded) {
  try {
    const mainScriptPath = path.join(__dirname, 'main.cjs');
    if (fs.existsSync(mainScriptPath)) {
      require(mainScriptPath);
      loaded = true;
    } else {
      throw new Error('Application entry file (main.cjs) not found.');
    }
  } catch (err) {
    const errorMsg = err && err.stack ? err.stack : String(err);
    dialog.showErrorBox('Poultry LMS 360 - Loader Error', `Failed to load application:\n\n${errorMsg}`);
    process.exit(1);
  }
}
