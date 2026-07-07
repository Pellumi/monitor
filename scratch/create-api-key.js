// Create API key via the correct endpoint: POST /environments/:envId/api-keys
const APP_ID = 'f45af0e1-3bfa-47c1-885d-d19622495b38';
const AUTH_API = 'http://localhost:3013';
const ONBOARDING_API = 'http://localhost:3006';
const fs = require('fs');

const LOG_FILE = 'C:\\Users\\pellu\\.gemini\\antigravity-ide\\brain\\af05ff08-9c55-49b9-9e9d-bb1e95b69454\\.system_generated\\tasks\\task-329.log';

function getLatestOTP() {
  const logContent = fs.readFileSync(LOG_FILE, 'utf8');
  const matches = logContent.match(/Sent OTP: (\d{6}) to email: ephilip240@gmail.com/g);
  if (!matches) return null;
  return matches[matches.length - 1].match(/Sent OTP: (\d{6})/)[1];
}

async function main() {
  const oldOTP = getLatestOTP();
  console.log('Sending OTP...');
  await fetch(`${AUTH_API}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ephilip240@gmail.com', purpose: 'LOGIN' }),
  });

  let newOTP = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 500));
    const currentOTP = getLatestOTP();
    if (currentOTP && currentOTP !== oldOTP) { newOTP = currentOTP; break; }
  }
  console.log('OTP:', newOTP);

  const verifyRes = await fetch(`${AUTH_API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ephilip240@gmail.com', code: newOTP, purpose: 'LOGIN' }),
  });
  
  const setCookies = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie() : [];
  let accessToken = null;
  for (const cookie of setCookies) {
    const match = cookie.match(/access_token=([^;]+)/);
    if (match) accessToken = match[1];
  }
  const cookie = `access_token=${accessToken}`;
  console.log('Logged in');

  // List environments via /applications/:id - the app has environments included
  const appRes = await fetch(`${ONBOARDING_API}/applications/${APP_ID}`, {
    headers: { 'Cookie': cookie },
  });
  console.log('App status:', appRes.status);
  const appData = await appRes.json();
  console.log('App:', appData.name);
  console.log('Environments:', appData.environments?.map?.(e => `${e.name} ${e.type} (${e.id})`));

  const devEnv = appData.environments?.find(e => e.type === 'DEVELOPMENT');
  if (!devEnv) {
    console.error('No dev environment found');
    process.exit(1);
  }
  
  // Create API key at POST /environments/:envId/api-keys
  console.log('\nCreating API key for env:', devEnv.id);
  const createRes = await fetch(`${ONBOARDING_API}/environments/${devEnv.id}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ label: 'AcadAI Frontend Dev Key' }),
  });
  
  console.log('Create status:', createRes.status);
  const keyData = await createRes.json();
  
  if (keyData.rawKey) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  API KEY CREATED (save this, shown once only!)  ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Key:    sots_${keyData.rawKey}`);
    console.log(`║  Prefix: ${keyData.keyPrefix}`);
    console.log(`║  App ID: ${APP_ID}`);
    console.log('╚══════════════════════════════════════════════════╝');
  } else {
    console.log('Response:', JSON.stringify(keyData, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
