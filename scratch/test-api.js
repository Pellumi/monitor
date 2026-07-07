// Diagnostic: test each endpoint separately
const APP_ID = 'f45af0e1-3bfa-47c1-885d-d19622495b38';
const GATEWAY = 'http://localhost:3000';
const jwt = require('C:\\Users\\pellu\\dev\\monitor\\node_modules\\.pnpm\\node_modules\\jsonwebtoken');
const { PrismaClient } = require('C:\\Users\\pellu\\dev\\monitor\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client');
const JWT_SECRET = 'sots-default-jwt-secret-change-in-production';

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email: 'ephilip240@gmail.com' } });
  console.log('User:', user?.id);
  
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  
  // Test 1: Check auth/me to validate token
  console.log('\n--- Test auth/me ---');
  const meRes = await fetch('http://localhost:3013/auth/me', {
    headers: { 'Cookie': `access_token=${token}` },
  });
  console.log('Me status:', meRes.status);
  console.log('Me body:', (await meRes.text()).substring(0, 200));

  // Test 2: Create flow via FDRS directly
  console.log('\n--- Test create flow via FDRS directly ---');
  const flowRes = await fetch(`http://localhost:3008/applications/${APP_ID}/declared-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Flow', workflowType: 'CUSTOM' }),
  });
  console.log('FDRS create flow status:', flowRes.status);
  const flowText = await flowRes.text();
  console.log('FDRS create flow body:', flowText.substring(0, 300));

  // Test 3: List flows via FDRS directly
  console.log('\n--- Test list flows via FDRS ---');
  const listRes = await fetch(`http://localhost:3008/applications/${APP_ID}/declared-flow`);
  console.log('FDRS list status:', listRes.status);
  const listText = await listRes.text();
  console.log('FDRS list body:', listText.substring(0, 300));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
