const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load .env file at root
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log('[DevLauncher] Loading env vars from root .env...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      // Remove surrounding quotes if any
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
} else {
  console.warn('[DevLauncher] Root .env file not found.');
}

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';
const args = ['turbo', 'run', 'dev', '--concurrency=50', '--env-mode=loose'];

console.log('[DevLauncher] Starting Turborepo dev server...');
const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

child.on('close', (code) => {
  process.exit(code || 0);
});
