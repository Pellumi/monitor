const { execSync } = require('child_process');
const os = require('os');

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

function runInherit(command) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
  }
}

console.log('\n==================================');
console.log('   Stopping Tellann Services   ');
console.log('==================================\n');

console.log('[1/3] Finding local Node/Turbo services...');
let hasLocalServices = false;
const scriptPid = process.pid;

if (os.platform() === 'win32') {
  const psCmd = `Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='turbo.exe'" | Where-Object { $_.CommandLine -match 'monitor' -and $_.ProcessId -ne ${scriptPid} } | Select-Object -Property ProcessId, Name, CommandLine`;
  const output = run(`powershell -NoProfile -Command "${psCmd} | Format-Table -AutoSize"`);
  
  if (output && output.trim()) {
    console.log(output);
    hasLocalServices = true;
  } else {
    console.log('  No local services found.');
  }
} else {
  const output = run(`ps -ef | grep -E "node|turbo" | grep monitor | grep -v grep | grep -v ${scriptPid}`);
  if (output && output.trim()) {
    console.log(output);
    hasLocalServices = true;
  } else {
    console.log('  No local services found.');
  }
}

console.log('\n[2/3] Checking Docker services...');
const dockerPs = run('docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}"');
let hasDocker = false;
if (dockerPs && dockerPs.split('\n').length > 1) {
  console.log(dockerPs);
  hasDocker = true;
} else {
  console.log('  No docker services running.');
}

console.log('\n[3/3] Closing services...');

if (hasDocker) {
  console.log('  -> Stopping Docker containers...');
  runInherit('docker compose down');
  runInherit('docker compose --profile tunnel down');
} else {
  console.log('  -> No Docker containers to stop.');
}

if (hasLocalServices) {
  console.log('  -> Stopping Node/Turbo processes...');
  if (os.platform() === 'win32') {
    const killCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe' OR Name='turbo.exe'\\" | Where-Object { $_.CommandLine -match 'monitor' -and $_.ProcessId -ne ${scriptPid} } | Stop-Process -Force"`;
    run(killCmd);
  } else {
    run(`pkill -f "node.*monitor"`);
    run(`pkill -f "turbo.*monitor"`);
  }
  console.log('  Local services stopped.');
} else {
  console.log('  -> No local services to stop.');
}

console.log('\nDone.\n');
