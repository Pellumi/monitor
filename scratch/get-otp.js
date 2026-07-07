const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const otp = await p.otpCode.findFirst({
    where: { email: 'ephilip240@gmail.com' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('OTP Code:', otp ? otp.code : 'NOT FOUND');
  console.log('Created:', otp ? otp.createdAt : '');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
