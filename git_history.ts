import { execSync } from 'child_process';

try {
  console.log('--- Git status ---');
  console.log(execSync('git status').toString());
  
  console.log('--- Git log ---');
  console.log(execSync('git log --oneline -n 10').toString());
} catch (err: any) {
  console.error('Git execution failed:', err.message);
}
