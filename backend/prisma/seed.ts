import { Prisma, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
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

  const departmentByCode = Object.fromEntries(
    (
      await prisma.department.findMany({
        select: { id: true, code: true },
      })
    ).map((dept) => [dept.code, dept.id]),
  );

  console.log('Seeding demo team users + mock employees (Entra test accounts)...');

  type DemoStaffSeed = {
    email: string;
    displayName: string;
    roleCode: keyof typeof ROLE_ID_BY_CODE;
    kekaEmployeeId: string;
    departmentCode: keyof typeof departmentByCode;
    designation: string;
    managerKekaId?: string;
  };

  const demoStaff: DemoStaffSeed[] = [
    {
      email: 'rachelgreen@bminilik12gmail.onmicrosoft.com',
      displayName: 'Rachel Green',
      roleCode: 'team_lead',
      kekaEmployeeId: 'MOCK-KEKA-004',
      departmentCode: 'SOC',
      designation: 'Team Lead',
    },
    {
      email: 'briannguyen@bminilik12gmail.onmicrosoft.com',
      displayName: 'Brian Nguyen',
      roleCode: 'engineer',
      kekaEmployeeId: 'MOCK-KEKA-001',
      departmentCode: 'SOC',
      designation: 'Security Consultant',
      managerKekaId: 'MOCK-KEKA-004',
    },
    {
      email: 'emilydavis@bminilik12gmail.onmicrosoft.com',
      displayName: 'Emily Davis',
      roleCode: 'engineer',
      kekaEmployeeId: 'MOCK-KEKA-002',
      departmentCode: 'GRC',
      designation: 'GRC Analyst',
      managerKekaId: 'MOCK-KEKA-004',
    },
    {
      email: 'sarahjenkins@bminilik12gmail.onmicrosoft.com',
      displayName: 'Sarah Jenkins',
      roleCode: 'engineer',
      kekaEmployeeId: 'MOCK-KEKA-003',
      departmentCode: 'CLOUD',
      designation: 'Cloud Security Engineer',
      managerKekaId: 'MOCK-KEKA-004',
    },
  ];

  const employeeIdByKeka = new Map<string, string>();
  const syncedAt = new Date();

  for (const person of demoStaff) {
    const departmentId = departmentByCode[person.departmentCode];
    if (!departmentId) {
      throw new Error(`Missing department seed: ${person.departmentCode}`);
    }

    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {
        displayName: person.displayName,
        roleId: ROLE_ID_BY_CODE[person.roleCode],
        isActive: true,
        isExternal: false,
      },
      create: {
        email: person.email,
        displayName: person.displayName,
        roleId: ROLE_ID_BY_CODE[person.roleCode],
        isActive: true,
        isExternal: false,
        entraObjectId: `pending-first-login-${person.kekaEmployeeId.toLowerCase()}`,
      },
    });

    const employee = await prisma.employee.upsert({
      where: { kekaEmployeeId: person.kekaEmployeeId },
      update: {
        userId: user.id,
        name: person.displayName,
        email: person.email,
        departmentId,
        designation: person.designation,
        weeklyHours: new Prisma.Decimal(40),
        isActive: true,
        syncedAt,
      },
      create: {
        kekaEmployeeId: person.kekaEmployeeId,
        userId: user.id,
        name: person.displayName,
        email: person.email,
        departmentId,
        designation: person.designation,
        weeklyHours: new Prisma.Decimal(40),
        isActive: true,
        syncedAt,
      },
    });

    employeeIdByKeka.set(person.kekaEmployeeId, employee.id);
    console.log(`  ${person.displayName} (${person.email})`);
  }

  for (const person of demoStaff) {
    if (!person.managerKekaId) {
      continue;
    }

    const employeeId = employeeIdByKeka.get(person.kekaEmployeeId);
    const managerId = employeeIdByKeka.get(person.managerKekaId);
    if (!employeeId || !managerId) {
      continue;
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { managerId },
    });
  }

  console.log('Demo team users + mock employees seeded successfully.');

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

  console.log('Seeding currencies from SQL file...');
  const sqlPath = path.join(__dirname, 'currencies.sql');
  if (fs.existsSync(sqlPath)) {
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    // Clear currencies first to allow re-running seed safely
    await prisma.currency.deleteMany();
    await prisma.$executeRawUnsafe(sqlContent);
    console.log('Currencies table populated from SQL.');

    // Now populate symbols
    const symbols: Record<string, string> = {
      AED: 'د.إ', AFN: '؋', ALL: 'L', AMD: '֏', ANG: 'ƒ', AOA: 'Kz', ARS: '$', AUD: 'A$', AWG: 'ƒ', AZN: '₼',
      BAM: 'KM', BBD: 'Bds$', BDT: '৳', BGN: 'лв', BHD: 'BD', BIF: 'Fr', BMD: '$', BND: 'B$', BOB: 'Bs.', BOV: 'BOV',
      BRL: 'R$', BSD: 'B$', BTN: 'Nu', BWP: 'P', BYR: 'Br', BZD: 'BZ$', CAD: 'C$', CDF: 'FC', CHE: 'CHE', CHF: 'Fr',
      CHW: 'CHW', CLF: 'CLF', CLP: '$', CNY: '¥', COP: '$', COU: 'COU', CRC: '₡', CUC: '$', CUP: '$', CVE: '$',
      CZK: 'Kč', DJF: 'Fr', DKK: 'kr', DOP: 'RD$', DZD: 'دج', EGP: 'E£', ERN: 'Nfk', ETB: 'Br', EUR: '€', FJD: 'FJ$',
      FKP: '£', GBP: '£', GEL: '₾', GHS: '₵', GIP: '£', GMD: 'D', GNF: 'Fr', GTQ: 'Q', GYD: 'G$', HKD: 'HK$',
      HNL: 'L', HRK: 'kn', HTG: 'G', HUF: 'Ft', IDR: 'Rp', ILS: '₪', INR: '₹', IQD: 'ع.د', IRR: '﷼', ISK: 'kr',
      JMD: 'J$', JOD: 'JD', JPY: '¥', KES: 'KSh', KGS: 'с', KHR: '៛', KMF: 'Fr', KPW: '₩', KRW: '₩', KWD: 'KD',
      KYD: 'CI$', KZT: '₸', LAK: '₭', LBP: 'L£', LKR: 'Rs', LRD: 'L$', LSL: 'L', LTL: 'Lt', LYD: 'LD', MAD: 'MAD',
      MDL: 'L', MGA: 'Ar', MKD: 'ден', MMK: 'K', MNT: '₮', MOP: 'P', MRO: 'UM', MUR: 'Rs', MVR: 'Rf', MWK: 'MK',
      MXN: 'Mex$', MXV: 'MXV', MYR: 'RM', MZN: 'MT', NAD: 'N$', NGN: '₦', NIO: 'C$', NOK: 'kr', NPR: 'Rs',
      NZD: 'NZ$', OMR: 'ر.ع.', PAB: 'B/.', PEN: 'S/.', PGK: 'K', PHP: '₱', PKR: 'Rs', PLN: 'zł', PYG: '₲',
      QAR: 'QR', RON: 'lei', RSD: 'din', RUB: '₽', RWF: 'Fr', SAR: 'ر.س', SBD: 'SI$', SCR: 'Rs', SDG: 'ج.س.',
      SEK: 'kr', SGD: 'S$', SHP: '£', SLL: 'Le', SOS: 'Sh', SRD: '$', SSP: '£', STD: 'Db', SVC: '₡', SYP: 'S£',
      SZL: 'L', THB: '฿', TJS: 'SM', TMT: 'T', TND: 'DT', TOP: "Pa'anga", TRY: '₺', TTD: 'TT$', TWD: 'NT$',
      TZS: 'Sh', UAH: '₴', UGX: 'USh', USD: '$', USN: '$', UYI: 'UYI', UYU: '$U', UZS: 'суми', VEF: 'Bs.F',
      VND: '₫', VUV: 'Vt', WST: 'T', XAF: 'Fr', XCD: 'EC$', XDR: 'XDR', XOF: 'Fr', XPF: 'Fr', XSU: 'XSU',
      XUA: 'XUA', YER: '﷼', ZAR: 'R', ZMW: 'ZK', ZWL: 'Z$'
    };

    for (const [code, symbol] of Object.entries(symbols)) {
      await prisma.currency.updateMany({
        where: { code },
        data: { symbol },
      });
    }
    console.log('Currency symbols populated successfully.');
  } else {
    console.warn(`Warning: currencies.sql not found at ${sqlPath}`);
  }
}


main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
