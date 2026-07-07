// Debug JWT token verification
const jwt = require('C:\\Users\\pellu\\dev\\monitor\\node_modules\\.pnpm\\node_modules\\jsonwebtoken');
const { PrismaClient } = require('C:\\Users\\pellu\\dev\\monitor\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client');
const JWT_SECRET = 'sots-default-jwt-secret-change-in-production';

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email: 'ephilip240@gmail.com' } });
  console.log('User ID:', user.id);
  
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  console.log('Token:', token);
  
  // Verify locally
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Local verify OK:', decoded);
  } catch (e) {
    console.error('Local verify FAILED:', e.message);
  }
  
  // Test directly against FDRS health endpoint (no auth needed)
  const healthRes = await fetch('http://localhost:3008/health');
  console.log('\nFDRS health:', healthRes.status, await healthRes.text());
  
  // Test FDRS with Bearer token
  console.log('\n--- FDRS with Bearer ---');
  const r1 = await fetch('http://localhost:3008/applications/f45af0e1-3bfa-47c1-885d-d19622495b38/declared-flow', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('Status:', r1.status);
  console.log('Body:', (await r1.text()).substring(0, 200));
  
  // Test FDRS with Cookie
  console.log('\n--- FDRS with Cookie ---');
  const r2 = await fetch('http://localhost:3008/applications/f45af0e1-3bfa-47c1-885d-d19622495b38/declared-flow', {
    headers: { 'Cookie': `access_token=${token}` },
  });
  console.log('Status:', r2.status);
  console.log('Body:', (await r2.text()).substring(0, 200));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
