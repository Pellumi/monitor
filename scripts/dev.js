const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const verbose = process.env.DEV_VERBOSE === 'true';
const startupGraceMs = Number(process.env.DEV_STARTUP_GRACE_MS || 60_000);
const startupStartedAt = Date.now();
const colours = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code, value) => colours ? `\u001b[${code}m${value}\u001b[0m` : value;
const status = {
  info: (value) => paint('36', value),
  ready: (value) => paint('32', value),
  warn: (value) => paint('33', value),
  error: (value) => paint('31', value),
};

const readyPattern = /(?:running|listening|http api) on port\b|\bstarted consuming\b|\bconsuming\.\.\.|\bready in\b|\blocal:\s/i;
const errorPattern = /(?:\berror\b|exception|failed|failure|fatal|eaddrinuse|unhandled|command exited|ELIFECYCLE|ERR_PNPM)/i;
const warningPattern = /(?:\bwarn(?:ing)?\b|disabled|credentials? (?:not found|missing)|not configured)/i;
const ignorablePattern = /^(?:\s*$|cache (?:hit|miss)|executing|\$ |>|• turbo|• packages in scope|• running|remote caching|tasks:|cached:|time:)/i;
const ansiPattern = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const generatedSourcePattern = /(?:\bfunction\s+[A-Za-z_$][\w$]*\([^)]*\)\{|\bvar\s+[A-Za-z_$][\w$]*=|=>\{|;function\s)/;
const shutdownArtifactPattern = /(?:\bwrite EPIPE\b|\bChannel closed\b)/i;
const startupConnectionPattern = /(?:ECONNREFUSED|fetch failed: (?:other side closed|connect ECONNREFUSED))/i;
const kafkaPartitionerWarningPattern = /KafkaJS v2\.0\.0 switched default partitioner/i;
const readyServices = new Set();
const reportedMessages = new Set();
const partialLines = new Map();

function clean(value) {
  return value.replace(ansiPattern, '').replace(/^\s*[│└├─•]+\s*/, '').trim();
}

function parseTurboLine(value) {
  const line = clean(value);
  const match = line.match(/^([^\s]+):(dev|build):\s?(.*)$/);
  if (!match) return { service: 'dev', task: '', message: line };
  return { service: match[1].replace(/^@tellann\//, ''), task: match[2], message: match[3] };
}

function summarizeStructuredLog(message) {
  if (!message.startsWith('{')) return null;
  try {
    const entry = JSON.parse(message);
    if (typeof entry !== 'object' || entry === null) return null;
    const summary = entry.err?.message || entry.error?.message || entry.msg || entry.message;
    if (!summary) return null;
    const context = entry.req?.method && entry.req?.url
      ? `${entry.req.method} ${entry.req.url} — `
      : '';
    return {
      severity: Number(entry.level) >= 50 ? 'error' : Number(entry.level) >= 40 ? 'warn' : 'info',
      message: `${context}${summary}`,
    };
  } catch {
    return null;
  }
}

function concise(message, limit = 360) {
  const singleLine = message.replace(/\\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return singleLine.length > limit ? `${singleLine.slice(0, limit - 1)}…` : singleLine;
}

function printCompactLine(rawLine, stream = process.stdout) {
  const { service, task, message } = parseTurboLine(rawLine);
  if (ignorablePattern.test(message)) return;
  if (kafkaPartitionerWarningPattern.test(message)) return;
  if (shutdownArtifactPattern.test(message)) return;
  if (Date.now() - startupStartedAt < startupGraceMs && startupConnectionPattern.test(message)) return;

  const structured = summarizeStructuredLog(message);
  if (structured?.severity === 'error') {
    const summary = concise(structured.message);
    if (Date.now() - startupStartedAt < startupGraceMs && startupConnectionPattern.test(summary)) return;
    const fingerprint = `error:${service}:${summary}`;
    if (reportedMessages.has(fingerprint)) return;
    reportedMessages.add(fingerprint);
    stream.write(`${status.error('✗')} ${status.error(service)} — ${summary}\n`);
    return;
  }
  if (structured?.severity === 'warn') {
    const summary = concise(structured.message);
    const fingerprint = `warn:${service}:${summary}`;
    if (reportedMessages.has(fingerprint)) return;
    reportedMessages.add(fingerprint);
    stream.write(`${status.warn('!')} ${status.warn(service)} — ${summary}\n`);
    return;
  }

  // Node stack traces sometimes include an entire line from a minified bundle.
  // It can be hundreds of kilobytes long and contain words such as "Error"
  // without being the exception itself. The useful exception follows on its
  // own line, so omit only the generated source excerpt.
  if (message.length > 600 && generatedSourcePattern.test(message)) return;

  if (task === 'dev' && readyPattern.test(message)) {
    if (!readyServices.has(service)) {
      readyServices.add(service);
      stream.write(`${status.ready('✓')} ${status.ready(service)} — ${message}\n`);
    }
    return;
  }

  if (errorPattern.test(message)) {
    stream.write(`${status.error('✗')} ${status.error(service)} — ${concise(message)}\n`);
    return;
  }

  if (warningPattern.test(message)) {
    stream.write(`${status.warn('!')} ${status.warn(service)} — ${concise(message)}\n`);
  }
}

function filterOutput(source, stream) {
  source.on('data', (chunk) => {
    const previous = partialLines.get(source) || '';
    const lines = `${previous}${chunk}`.split(/\r?\n/);
    partialLines.set(source, lines.pop() || '');
    for (const line of lines) printCompactLine(line, stream);
  });
  source.on('end', () => {
    const remainder = partialLines.get(source);
    if (remainder) printCompactLine(remainder, stream);
    partialLines.delete(source);
  });
}

// Load .env file at root
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log(`${status.ready('✓')} environment — loaded root .env`);
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
  console.warn(`${status.warn('!')} environment — root .env file not found`);
}

// Port 3020 belongs to the marketing app. Keep worker health independently
// addressable so a port collision cannot silently strand queued desktop jobs.
process.env.BACKGROUND_WORKERS_METRICS_PORT = '3022';

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'pnpm.cmd' : 'pnpm';
const args = ['exec', 'turbo', 'run', 'dev', '--concurrency=50', '--env-mode=loose', '--log-prefix=task'];
if (process.env.DEV_EXCLUDE_DESKTOP === 'true') {
  args.push('--filter=!@tellann/desktop');
}

console.log(`${status.info('…')} services — starting (set DEV_VERBOSE=true for full logs)`);
const child = spawn(cmd, args, {
  stdio: verbose ? 'inherit' : ['inherit', 'pipe', 'pipe'],
  shell: isWindows,
});

if (!verbose) {
  filterOutput(child.stdout, process.stdout);
  filterOutput(child.stderr, process.stderr);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('close', (code) => {
  if (code && code !== 130) {
    console.error(`${status.error('✗')} services — dev process exited with code ${code}`);
  } else if (!code) {
    console.log(`${status.info('■')} services — stopped`);
  }
  process.exit(code || 0);
});
