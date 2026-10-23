const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('<input')) {
      // Find the tag (could span multiple lines, let's print a few lines starting here)
      const chunk = lines.slice(idx, idx + 8).join('\n');
      console.log(`File: ${file}:${idx + 1}`);
      console.log(chunk);
      console.log('='.repeat(40));
    }
  });
});
