const { PrismaClient } = require('../packages/db/dist/index.js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sots-default-jwt-secret-change-in-production';

async function main() {
  const prisma = new PrismaClient();
  
  // Find first membership or create one
  let membership = await prisma.organizationMembership.findFirst({
    include: {
      user: true,
      organization: true
    }
  });
  
  if (!membership) {
    console.log('No membership found. Creating a test organization, user, and membership...');
    
    // Create org
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org E2E'
      }
    });
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'billing-e2e-user@example.com',
        displayName: 'Billing E2E User',
        preferredAuthMode: 'OTP'
      }
    });
    
    // Link user to org
    membership = await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER'
      },
      include: {
        user: true,
        organization: true
      }
    });
  }
  
  const org = membership.organization;
  const user = membership.user;
  
  console.log(`Found User: ${user.email} (${user.id})`);
  console.log(`Found Org: ${org.name} (${org.id})`);
  
  // Sign JWT token
  const token = jwt.sign(
    { sub: user.id, email: user.email, isSystemAdmin: false },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  console.log('\n--- BASH ENVIRONMENT VARIABLES ---');
  console.log(`export TEST_ORG_A_ID="${org.id}"`);
  console.log(`export TEST_ORG_A_TOKEN="${token}"`);
  
  console.log('\n--- POWERSHELL ENVIRONMENT VARIABLES ---');
  console.log(`$env:TEST_ORG_A_ID="${org.id}"`);
  console.log(`$env:TEST_ORG_A_TOKEN="${token}"`);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
