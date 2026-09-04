import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logDirectory = path.join(root, 'artifacts', 'desktop-intent-stack');
fs.mkdirSync(logDirectory, { recursive: true });

function loadEnvironment(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) return [];
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[key, value]];
  }));
}

function requirePort(name, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const fail = () => reject(new Error(`${name} is unavailable on 127.0.0.1:${port}. Start it with: docker compose up -d postgres redis`));
    socket.setTimeout(2_000);
    socket.once('connect', () => { socket.destroy(); resolve(); });
    socket.once('timeout', fail);
    socket.once('error', fail);
  });
}

async function waitFor(url, name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${name} did not become healthy at ${url}`);
}

await Promise.all([
  requirePort('PostgreSQL', 5433),
  requirePort('Redis', 6379),
  requirePort('Neo4j', 7474),
]);

const local = loadEnvironment(path.join(root, '.env'));
const env = {
  ...process.env, ...local, NODE_ENV: 'development',
  DATABASE_URL: local.DATABASE_URL ?? 'postgresql://tellann:password@127.0.0.1:5433/tellann?schema=public',
  REDIS_URL: local.REDIS_URL ?? 'redis://127.0.0.1:6379',
  NEO4J_URL: 'http://127.0.0.1:7474', NEO4J_USERNAME: 'neo4j',
  NEO4J_PASSWORD: local.NEO4J_PASSWORD ?? 'tellann-local-graph',
  JWT_SECRET: local.JWT_SECRET ?? 'tellann-default-jwt-secret-change-in-production',
  AUTH_API_URL: 'http://127.0.0.1:3013', ONBOARDING_API_URL: 'http://127.0.0.1:3006',
  FDRS_API_URL: 'http://127.0.0.1:3008', API_GATEWAY_INTERNAL_URL: 'http://127.0.0.1:3000',
  TELLANN_API_URL: 'http://127.0.0.1:3000', TELLANN_AUTH_URL: 'http://127.0.0.1:3000',
  NEXT_PUBLIC_APP_URL: local.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3010',
  BACKGROUND_WORKERS_METRICS_PORT: '3022', KAFKA_ENABLED: 'false', CLICKHOUSE_ENABLED: 'false',
  // Deep-analysis archives remain on this machine during local development.
  STORAGE_S3_ENDPOINT: '', STORAGE_S3_BUCKET: '', STORAGE_S3_ACCESS_KEY_ID: '', STORAGE_S3_SECRET_ACCESS_KEY: '',
  STORAGE_FIREBASE_SERVICE_ACCOUNT_JSON: '', STORAGE_FIREBASE_BUCKET: '',
};
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const services = [
  ['auth-api', '@tellann/auth-api'], ['onboarding-api', '@tellann/onboarding-api'],
  ['fdrs-api', '@tellann/fdrs-api'], ['api-gateway', '@tellann/api-gateway'],
  ['background-workers', '@tellann/background-workers'], ['code-intelligence-worker', '@tellann/code-intelligence-worker'], ['desktop', '@tellann/desktop'],
];
const children = [];
let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const [name, filter] of services) {
  const child = spawn(command, ['--filter', filter, 'dev'], {
    cwd: root,
    env,
    windowsHide: true,
    // Windows command shims are batch files and must be launched through the
    // command processor. Service names and arguments are fixed above rather
    // than derived from user input.
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const log = fs.createWriteStream(path.join(logDirectory, `${name}.log`), { flags: 'w' });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code) => { if (!stopping && code) { stopAll(); process.exitCode = code; } });
}
process.once('SIGINT', stopAll); process.once('SIGTERM', stopAll); process.once('exit', stopAll);
await Promise.all([
  waitFor('http://127.0.0.1:3013/health', 'auth-api'),
  waitFor('http://127.0.0.1:3006/health', 'onboarding-api'),
  waitFor('http://127.0.0.1:3008/health', 'fdrs-api'),
  waitFor('http://127.0.0.1:3000/health', 'api-gateway'),
  waitFor('http://127.0.0.1:3022/health', 'background-workers'),
]);
console.log('\n[desktop-intent] Services are healthy. Sign in to Tellann and open Intent → Upload and generate.');
await new Promise(() => {});
