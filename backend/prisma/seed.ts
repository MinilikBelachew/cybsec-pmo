import { Prisma, PrismaClient } from '@prisma/client';
import {
  ROLE_CATALOG,
  ROLE_ID_BY_CODE,
  buildPermissionRows,
} from './rbac-seed-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding roles...');

  for (const role of ROLE_CATALOG) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { label: role.label, isExternal: role.isExternal },
      create: {
        id: role.id,
        code: role.code,
        label: role.label,
        isExternal: role.isExternal,
      },
    });
  }

  console.log('Roles seeded successfully.');

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT COALESCE(MAX(id), 1) FROM roles), true)`,
  );

  console.log('Seeding permissions...');
  const permissionRows = buildPermissionRows();

  for (const row of permissionRows) {
    await prisma.permission.upsert({
      where: {
        roleId_module_action: {
          roleId: row.roleId,
          module: row.module,
          action: row.action,
        },
      },
      update: {
        recordScope: row.recordScope,
        fieldScope: row.fieldScope
          ? (row.fieldScope as Prisma.InputJsonValue)
          : undefined,
      },
      create: {
        roleId: row.roleId,
        module: row.module,
        action: row.action,
        recordScope: row.recordScope,
        fieldScope: row.fieldScope
          ? (row.fieldScope as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  console.log(`Permissions seeded successfully (${permissionRows.length} rows).`);

  console.log('Seeding initial Super Admin user...');
  const adminEmail = 'bminilik12@gmail.com';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: 'roba belachew',
      roleId: ROLE_ID_BY_CODE.super_admin,
      isActive: true,
      isExternal: false,
    },
    create: {
      email: adminEmail,
      displayName: 'roba belachew',
      roleId: ROLE_ID_BY_CODE.super_admin,
      isActive: true,
      isExternal: false,
      entraObjectId: 'pending-first-login-admin',
    },
  });

  console.log(`First Super Admin user (${adminEmail}) seeded successfully.`);

  console.log('Seeding PM user...');
  const pmEmail = 'john.pm@bminilik12gmail.onmicrosoft.com';
  await prisma.user.upsert({
    where: { email: pmEmail },
    update: {
      displayName: 'John Smith',
      roleId: ROLE_ID_BY_CODE.pm,
      isActive: true,
      isExternal: false,
    },
    create: {
      email: pmEmail,
      displayName: 'John Smith',
      roleId: ROLE_ID_BY_CODE.pm,
      isActive: true,
      isExternal: false,
      entraObjectId: 'pending-first-login-pm',
    },
  });
  console.log(`PM user (${pmEmail}) seeded successfully.`);

  console.log('Seeding departments...');
  const departments = [
    { code: 'SOC', name: 'Security Operations Center' },
    { code: 'GRC', name: 'Governance, Risk & Compliance' },
    { code: 'CLOUD', name: 'Cloud Security' },
    { code: 'APPSEC', name: 'Application Security' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, isActive: true },
      create: { ...dept, isActive: true },
    });
  }
  console.log('Departments seeded successfully.');

  console.log('Seeding customers...');
  const customers = [
    {
      type: 'Company' as const,
      displayName: 'Acme Financial Services',
      companyName: 'Acme Financial Services',
      industry: 'Financial Services',
      country: 'UAE',
      primaryEmail: 'contact@acme-finance.example',
      status: 'Active',
    },
    {
      type: 'Company' as const,
      displayName: 'Globex Manufacturing',
      companyName: 'Globex Manufacturing',
      industry: 'Manufacturing',
      country: 'KSA',
      primaryEmail: 'info@globex.example',
      status: 'Active',
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { primaryEmail: customer.primaryEmail },
      update: {
        displayName: customer.displayName,
        companyName: customer.companyName,
        industry: customer.industry,
        country: customer.country,
        status: customer.status,
      },
      create: customer,
    });
  }
  console.log('Customers seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
