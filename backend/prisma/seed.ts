import { Prisma, PrismaClient } from '@prisma/client';
import { assertKnownRecordScopes } from '../src/casl/record-scope.validation';
import {
  ROLE_CATALOG,
  ROLE_ID_BY_CODE,
  buildPermissionCatalog,
  buildRolePermissionRows,
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

  console.log('Seeding permission catalog...');
  const catalogRows = buildPermissionCatalog();

  for (const row of catalogRows) {
    await prisma.permission.upsert({
      where: {
        module_action: {
          module: row.module,
          action: row.action,
        },
      },
      update: {},
      create: {
        module: row.module,
        action: row.action,
      },
    });
  }

  console.log(`Permission catalog seeded (${catalogRows.length} definitions).`);

  const permissionIdByKey = new Map(
    (
      await prisma.permission.findMany({
        select: { id: true, module: true, action: true },
      })
    ).map((permission) => [`${permission.module}:${permission.action}`, permission.id]),
  );

  console.log('Seeding role_permissions...');
  const rolePermissionRows = buildRolePermissionRows();
  assertKnownRecordScopes(rolePermissionRows.map((row) => row.recordScope));

  for (const row of rolePermissionRows) {
    const permissionId = permissionIdByKey.get(`${row.module}:${row.action}`);
    if (!permissionId) {
      throw new Error(`Missing catalog permission: ${row.module}.${row.action}`);
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: row.roleId,
          permissionId,
        },
      },
      update: {
        recordScope: row.recordScope,
        fieldScope: row.fieldScope
          ? (row.fieldScope as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
      create: {
        roleId: row.roleId,
        permissionId,
        recordScope: row.recordScope,
        fieldScope: row.fieldScope
          ? (row.fieldScope as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  console.log(
    `Role permissions seeded successfully (${rolePermissionRows.length} grants).`,
  );

  console.log('Removing unused auth permissions...');
  const authPermissions = await prisma.permission.findMany({
    where: { module: 'auth' },
    select: { id: true },
  });
  if (authPermissions.length > 0) {
    const authPermissionIds = authPermissions.map((permission) => permission.id);
    await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: authPermissionIds } },
    });
    await prisma.permission.deleteMany({ where: { module: 'auth' } });
  }
  console.log(`Removed ${authPermissions.length} auth permission definition(s).`);

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

  console.log('Seeding app settings...');
  await prisma.appSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  console.log('App settings seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
