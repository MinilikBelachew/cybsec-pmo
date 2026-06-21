import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles...');

  const roles = [
    { code: 'super_admin', label: 'Super Admin', isExternal: false },
    { code: 'it_admin', label: 'IT Admin', isExternal: false },
    { code: 'pmo_lead', label: 'PMO Lead', isExternal: false },
    { code: 'pm', label: 'PM', isExternal: false },
    { code: 'team_lead', label: 'Team Lead', isExternal: false },
    { code: 'engineer', label: 'Engineer', isExternal: false },
    { code: 'finance', label: 'Finance', isExternal: false },
    { code: 'hr', label: 'HR', isExternal: false },
    { code: 'sales', label: 'Sales', isExternal: false },
    { code: 'client', label: 'Client', isExternal: true },
    { code: 'vendor', label: 'Vendor', isExternal: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { label: role.label, isExternal: role.isExternal },
      create: role,
    });
  }

  console.log('Roles seeded successfully.');

  console.log('Seeding initial Super Admin user...');
  const adminEmail = 'bminilik12@gmail.com';

  // Seed user matching Microsoft Entra identity
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: 'roba belachew',
      roleCode: 'super_admin',
      isActive: true,
      isExternal: false,
    },
    create: {
      email: adminEmail,
      displayName: 'roba belachew',
      roleCode: 'super_admin',
      isActive: true,
      isExternal: false,
      entraObjectId: 'pending-first-login', // Will be updated on first login
    },
  });

  console.log(`First Super Admin user (${adminEmail}) seeded successfully.`);

  console.log('Seeding PM user...');
  const pmEmail = 'john.pm@bminilik12gmail.onmicrosoft.com';
  await prisma.user.upsert({
    where: { email: pmEmail },
    update: {
      displayName: 'John Smith',
      roleCode: 'pm',
      isActive: true,
      isExternal: false,
    },
    create: {
      email: pmEmail,
      displayName: 'John Smith',
      roleCode: 'pm',
      isActive: true,
      isExternal: false,
      entraObjectId: 'pending-first-login',
    },
  });
  console.log(`PM user (${pmEmail}) seeded successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
