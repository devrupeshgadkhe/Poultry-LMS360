const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.clear();
console.log('================================================================');
console.log('      🥚 Poultry LMS 360 - SMART LOCAL STARTER ENGINE 🥚        ');
console.log('================================================================');

// 1. Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('\n📦 [1/2] "node_modules" folder was not found inside the workspace!');
  console.log('Installing all dependencies automatically. This might take a dynamic minute...\n');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('\n✅ Core dependencies installed successfully!');
  } catch (err) {
    console.error('\n❌ Failed to run "npm install". Please make sure Node.js and NPM are installed on your system.');
    process.exit(1);
  }
} else {
  console.log('\n📦 [1/2] Verification complete: dependencies already installed.');
}

// 2. Start the local server
console.log('\n🚀 [2/2] Launching the unified full-stack server (Vite + Express)...');
console.log('The application is starting on: http://localhost:3000');

const devProcess = spawn('npm', ['run', 'dev'], { 
  shell: true, 
  stdio: 'inherit' 
});

// 3. Automatically open the default web browser after a brief startup delay
setTimeout(() => {
  const url = 'http://localhost:3000';
  console.log(`\n🌍 Opening your default browser window to: ${url} ...`);
  const startCommand = process.platform === 'darwin' ? 'open' 
                     : process.platform === 'win32' ? 'start' 
                     : 'xdg-open';
  try {
    spawn(`${startCommand} ${url}`, { shell: true });
  } catch (e) {
    console.log(`Please manually open your browser and navigate to: ${url}`);
  }
}, 4000);

// Keep the terminal process listening to devProcess lifespan
devProcess.on('exit', (code) => {
  process.exit(code || 0);
});
