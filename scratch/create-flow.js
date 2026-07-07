// Get a real auth token from the auth-api via OTP, then use it to create the flow
const APP_ID = 'f45af0e1-3bfa-47c1-885d-d19622495b38';
const AUTH_API = 'http://localhost:3013';
const FDRS_API = 'http://localhost:3008';
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
  console.log('Old OTP:', oldOTP);

  // Send OTP via auth-api directly
  console.log('Sending OTP...');
  const sendRes = await fetch(`${AUTH_API}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ephilip240@gmail.com', purpose: 'LOGIN' }),
  });
  console.log('Send status:', sendRes.status);
  if (sendRes.status !== 200) {
    console.log('Send body:', await sendRes.text());
    process.exit(1);
  }

  // Wait for OTP to appear in logs
  let newOTP = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 500));
    const currentOTP = getLatestOTP();
    if (currentOTP && currentOTP !== oldOTP) {
      newOTP = currentOTP;
      break;
    }
  }

  if (!newOTP) {
    console.error('Could not get new OTP');
    process.exit(1);
  }
  console.log('New OTP:', newOTP);

  // Verify OTP
  console.log('Verifying OTP...');
  const verifyRes = await fetch(`${AUTH_API}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ephilip240@gmail.com', code: newOTP, purpose: 'LOGIN' }),
  });
  console.log('Verify status:', verifyRes.status);
  
  const setCookies = verifyRes.headers.getSetCookie ? verifyRes.headers.getSetCookie() : [];
  console.log('Set-Cookie headers:', setCookies);
  
  let accessToken = null;
  for (const cookie of setCookies) {
    const match = cookie.match(/access_token=([^;]+)/);
    if (match) accessToken = match[1];
  }

  if (!accessToken) {
    const body = await verifyRes.text();
    console.log('Verify body:', body);
    process.exit(1);
  }
  console.log('Access token (first 50):', accessToken.substring(0, 50));
  console.log('Access token length:', accessToken.length);

  // Now test against FDRS with this real token
  console.log('\n--- Test FDRS with real Bearer token ---');
  const r1 = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  console.log('Bearer status:', r1.status);
  console.log('Bearer body:', (await r1.text()).substring(0, 300));

  console.log('\n--- Test FDRS with real Cookie token ---');
  const r2 = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow`, {
    headers: { 'Cookie': `access_token=${accessToken}` },
  });
  console.log('Cookie status:', r2.status);
  const r2Body = await r2.text();
  console.log('Cookie body:', r2Body.substring(0, 300));

  if (r2.status === 200 || r1.status === 200) {
    const authHeader = r2.status === 200 
      ? { 'Cookie': `access_token=${accessToken}` }
      : { 'Authorization': `Bearer ${accessToken}` };

    const flows = JSON.parse(r2.status === 200 ? r2Body : await r1.text());
    console.log('\n=== Flows ===');
    console.log(JSON.stringify(flows?.map?.(f => ({ id: f.id, name: f.name, status: f.status })), null, 2));

    // Use this token for the full flow creation
    const headers = {
      'Content-Type': 'application/json',
      ...authHeader,
    };

    let flowId;
    const draftFlow = Array.isArray(flows) ? flows.find(f => f.status === 'DRAFT') : null;
    if (draftFlow) {
      flowId = draftFlow.id;
      console.log('\nUsing existing draft:', flowId);
    } else {
      const cr = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: 'Student Exam Flow', workflowType: 'CUSTOM' }),
      });
      const crData = await cr.json();
      flowId = crData.id;
      console.log('\nCreated flow:', flowId);
    }

    // Add states
    const stateIds = {};
    const statesToAdd = [
      { stateName: 'LANDING_PAGE', category: 'BUSINESS' },
      { stateName: 'LOGIN', category: 'BUSINESS' },
      { stateName: 'DASHBOARD', category: 'BUSINESS' },
      { stateName: 'EXAM_INSTRUCTIONS', category: 'BUSINESS' },
      { stateName: 'EXAM_IN_PROGRESS', category: 'BUSINESS' },
      { stateName: 'EXAM_SUBMITTED', category: 'BUSINESS' },
      { stateName: 'EXAM_REVIEW', category: 'BUSINESS' },
      { stateName: 'AUTH_ERROR', category: 'ERROR' },
    ];

    // First get existing states from flow details
    const detailRes = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow/${flowId}`, { headers: authHeader });
    if (detailRes.ok) {
      const detail = await detailRes.json();
      if (detail.states) {
        for (const s of detail.states) {
          stateIds[s.stateName] = s.id;
        }
      }
    }
    console.log('Existing state IDs:', stateIds);

    for (const s of statesToAdd) {
      if (stateIds[s.stateName]) {
        console.log(`  [skip] ${s.stateName}`);
        continue;
      }
      const res = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow/${flowId}/states`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...s, provenance: 'MANUAL' }),
      });
      const data = await res.json();
      stateIds[s.stateName] = data.state?.id || data.id;
      console.log(`  [add] ${s.stateName} -> ${stateIds[s.stateName]}`);
    }

    // Add transitions
    const transitions = [
      { from: 'LANDING_PAGE', to: 'LOGIN', action: 'NAVIGATE' },
      { from: 'LOGIN', to: 'DASHBOARD', action: 'AUTHENTICATE' },
      { from: 'DASHBOARD', to: 'EXAM_INSTRUCTIONS', action: 'SELECT_EXAM' },
      { from: 'EXAM_INSTRUCTIONS', to: 'EXAM_IN_PROGRESS', action: 'START_EXAM' },
      { from: 'EXAM_IN_PROGRESS', to: 'EXAM_SUBMITTED', action: 'SUBMIT' },
      { from: 'EXAM_SUBMITTED', to: 'EXAM_REVIEW', action: 'VIEW_REVIEW' },
      { from: 'LOGIN', to: 'AUTH_ERROR', action: 'INVALID_CREDENTIALS' },
    ];

    for (const t of transitions) {
      if (!stateIds[t.from] || !stateIds[t.to]) {
        console.error(`  [miss] ${t.from} -> ${t.to}`);
        continue;
      }
      const res = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow/${flowId}/transitions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          fromStateId: stateIds[t.from], toStateId: stateIds[t.to],
          action: t.action, provenance: 'MANUAL',
        }),
      });
      console.log(`  [trans] ${t.from} -> ${t.to}: ${res.status}`);
    }

    // Complete flow
    const completeRes = await fetch(`${FDRS_API}/applications/${APP_ID}/declared-flow/${flowId}/complete`, {
      method: 'POST', headers: authHeader,
    });
    console.log('\nComplete:', completeRes.status, (await completeRes.text()).substring(0, 200));
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
