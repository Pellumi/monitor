import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logDirectory = path.join(repositoryRoot, 'artifacts', 'acceptance-stack');
fs.mkdirSync(logDirectory, { recursive: true });

function loadOneLineEnvironment(file) {
  if (!fs.existsSync(file)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

const localEnvironment = loadOneLineEnvironment(path.join(repositoryRoot, '.env'));
const commonEnvironment = {
  ...process.env,
  ...localEnvironment,
  NODE_ENV: 'development',
  KAFKA_ENABLED: process.env.ACCEPTANCE_KAFKA_ENABLED ?? 'false',
  CLICKHOUSE_ENABLED: process.env.ACCEPTANCE_CLICKHOUSE_ENABLED ?? 'false',
  REDIS_URL: process.env.ACCEPTANCE_REDIS_URL ?? (localEnvironment.REDIS_URL || 'redis://127.0.0.1:6379'),
  BACKGROUND_WORKERS_METRICS_PORT: '3022',
  DATABASE_URL: localEnvironment.DATABASE_URL ?? 'postgresql://sots:password@127.0.0.1:5433/sots?schema=public',
  JWT_SECRET: localEnvironment.JWT_SECRET ?? 'sots-default-jwt-secret-change-in-production',
  API_GATEWAY_INTERNAL_URL: 'http://127.0.0.1:3000',
  AUTH_API_URL: 'http://127.0.0.1:3013',
  BILLING_API_URL: 'http://127.0.0.1:3009',
  BILLING_CATALOG_ENV: 'test',
  BILLING_ENCRYPTION_KEY: localEnvironment.BILLING_ENCRYPTION_KEY || 'tellann-local-acceptance-encryption-key-do-not-use-in-production',
  BILLING_MOCK_WEBHOOK_SECRET: localEnvironment.BILLING_MOCK_WEBHOOK_SECRET || 'tellann-local-acceptance-mock-webhook-secret',
  COVERAGE_ENGINE_URL: 'http://127.0.0.1:3003',
  DEMONSTRATION_API_URL: 'http://127.0.0.1:3005',
  ENDPOINT_ENGINE_URL: 'http://127.0.0.1:3007',
  EVENT_COLLECTOR_URL: 'http://127.0.0.1:3001',
  FDRS_API_URL: 'http://127.0.0.1:3008',
  GRAPH_ENGINE_URL: 'http://127.0.0.1:3002',
  ONBOARDING_API_URL: 'http://127.0.0.1:3006',
  REPORT_ENGINE_URL: 'http://127.0.0.1:3004',
  USAGE_TRACKER_URL: 'http://127.0.0.1:3012',
  NEXT_PUBLIC_API_GATEWAY_URL: 'http://127.0.0.1:3000',
};

const services = [
  ['auth-api', 'services/auth-api/dist/index.js'],
  ['billing-api', 'services/billing-api/dist/index.js'],
  ['coverage-engine', 'services/coverage-engine/dist/index.js'],
  ['demonstration-api', 'services/demonstration-api/dist/index.js'],
  ['endpoint-engine', 'services/endpoint-engine/dist/index.js'],
  ['event-collector', 'services/event-collector/dist/index.js'],
  ['fdrs-api', 'services/fdrs-api/dist/index.js'],
  ['graph-engine', 'services/graph-engine/dist/index.js'],
  ['onboarding-api', 'services/onboarding-api/dist/index.js'],
  ['report-engine', 'services/report-engine/dist/index.js'],
  ['session-engine', 'services/session-engine/dist/index.js'],
  ['usage-tracker', 'services/usage-tracker/dist/index.js'],
  ['api-gateway', 'services/api-gateway/dist/index.js'],
];

const children = [];
const logStreams = [];
let stopping = false;

function stopAll(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
}

for (const [name, relativeEntry] of services) {
  const entry = path.join(repositoryRoot, relativeEntry);
  if (!fs.existsSync(entry)) throw new Error(`${name} is not built: ${entry}`);
  const child = spawn(process.execPath, [entry], {
    cwd: repositoryRoot,
    env: commonEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  children.push(child);
  const log = fs.createWriteStream(path.join(logDirectory, `${name}.log`), { flags: 'w' });
  logStreams.push(log);
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    console.error(`[${name}] exited code=${code ?? 'null'} signal=${signal ?? 'none'}`);
    if (!stopping && code !== 0) {
      stopAll();
      setTimeout(() => process.exit(code ?? 1), 250);
    }
  });
}

const workerName = 'background-workers';
const tsxEntry = path.join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const workerEntry = path.join(repositoryRoot, 'services', 'background-workers', 'src', 'index.ts');
if (!fs.existsSync(tsxEntry) || !fs.existsSync(workerEntry)) throw new Error('Background worker runtime is not installed');
const worker = spawn(process.execPath, [tsxEntry, workerEntry], {
  cwd: path.join(repositoryRoot, 'services', 'background-workers'),
  env: commonEnvironment,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
children.push(worker);
const workerLog = fs.createWriteStream(path.join(logDirectory, `${workerName}.log`), { flags: 'w' });
logStreams.push(workerLog);
worker.stdout.pipe(workerLog, { end: false });
worker.stderr.pipe(workerLog, { end: false });
worker.stdout.on('data', (chunk) => process.stdout.write(`[${workerName}] ${chunk}`));
worker.stderr.on('data', (chunk) => process.stderr.write(`[${workerName}] ${chunk}`));
worker.on('exit', (code, signal) => {
  console.error(`[${workerName}] exited code=${code ?? 'null'} signal=${signal ?? 'none'}`);
  if (!stopping && code !== 0) {
    stopAll();
    setTimeout(() => process.exit(code ?? 1), 250);
  }
});

const nextEntry = path.join(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const dashboard = spawn(process.execPath, [nextEntry, 'start', '-p', '3010'], {
  cwd: path.join(repositoryRoot, 'apps', 'dashboard'),
  env: commonEnvironment,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
children.push(dashboard);
const dashboardLog = fs.createWriteStream(path.join(logDirectory, 'dashboard.log'), { flags: 'w' });
logStreams.push(dashboardLog);
dashboard.stdout.pipe(dashboardLog, { end: false });
dashboard.stderr.pipe(dashboardLog, { end: false });
dashboard.stdout.on('data', (chunk) => process.stdout.write(`[dashboard] ${chunk}`));
dashboard.stderr.on('data', (chunk) => process.stderr.write(`[dashboard] ${chunk}`));
dashboard.on('exit', (code, signal) => {
  console.error(`[dashboard] exited code=${code ?? 'null'} signal=${signal ?? 'none'}`);
  if (!stopping && code !== 0) {
    stopAll();
    setTimeout(() => process.exit(code ?? 1), 250);
  }
});

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
process.on('exit', () => stopAll());

console.log(`Tellann acceptance stack started with ${children.length} processes.`);
await new Promise(() => {});
