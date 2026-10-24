// Register bytenode bytecode extension
const { app, dialog } = require('electron');

if (app && app.isPackaged) {
  process.env.NODE_ENV = 'production';
}

const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

// Global uncaught handler to catch asynchronous startup or runtime errors
process.on('uncaughtException', (err) => {
  const errorMsg = err && err.stack ? err.stack : String(err);
  try {
    dialog.showErrorBox('Poultry LMS 360 - Critical Startup Exception', errorMsg);
  } catch (e) {
    console.error('Uncaught Exception:', errorMsg);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const errorMsg = reason && reason.stack ? reason.stack : String(reason);
  try {
    dialog.showErrorBox('Poultry LMS 360 - Critical Unhandled Rejection', errorMsg);
  } catch (e) {
    console.error('Unhandled Rejection:', errorMsg);
  }
  process.exit(1);
});

try {
  // Load the compiled bytenode application logic binary
  const binaryPath = path.join(__dirname, 'main.jsc');
  if (fs.existsSync(binaryPath)) {
    try {
      require(binaryPath);
    } catch (jscErr) {
      console.warn('Failed to load main.jsc bytecode, trying fallback to main.cjs:', jscErr);
      require(path.join(__dirname, 'main.cjs'));
    }
  } else {
    // If .jsc doesn't exist, gracefully fall back to the source .cjs file
    require(path.join(__dirname, 'main.cjs'));
  }
} catch (err) {
  const errorMsg = err && err.stack ? err.stack : String(err);
  dialog.showErrorBox('Poultry LMS 360 - Loader Error', `Failed to load application binary:\n\n${errorMsg}`);
  process.exit(1);
}

