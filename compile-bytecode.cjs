const { app } = require('electron');
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
  console.clear();
  console.log('================================================================');
  console.log('       🔧 Poultry LMS 360 - ELECTRON BYTECODE COMPILER 🔧        ');
  console.log('================================================================');

  try {
    const serverJs = path.join(__dirname, 'dist', 'server.cjs');
    const serverJsc = path.join(__dirname, 'dist', 'server.jsc');
    const mainJs = path.join(__dirname, 'main.cjs');
    const mainJsc = path.join(__dirname, 'main.jsc');

    // 1. Compile server bundle
    console.log('\n⏳ [1/2] Compiling backend Express server to secure bytecode...');
    if (fs.existsSync(serverJs)) {
      bytenode.compileFile({
        filename: serverJs,
        output: serverJsc
      });
      console.log(`   ✓ Created encrypted binary: ${serverJsc}`);
    } else {
      console.error(`   ❌ Error: Source file not found: ${serverJs}`);
      process.exitCode = 1;
    }

    // 2. Compile desktop window controller code
    console.log('\n⏳ [2/2] Compiling Desktop Interface Controller to secure bytecode...');
    if (fs.existsSync(mainJs)) {
      bytenode.compileFile({
        filename: mainJs,
        output: mainJsc
      });
      console.log(`   ✓ Created encrypted binary: ${mainJsc}`);
    } else {
      console.error(`   ❌ Error: Source file not found: ${mainJs}`);
      process.exitCode = 1;
    }

    console.log('\n🎉 Bytecode generated successfully inside target workspaces.');
  } catch (err) {
    console.error('\n❌ Fatal error compiling bytecode binary:', err);
    process.exitCode = 1;
  } finally {
    console.log('👋 Finished bytecode build. Exiting terminal compiler safely...');
    app.quit();
  }
});
