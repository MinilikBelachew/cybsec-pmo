/**
 * Remove mock Keka sync data from the local database before a real Keka sync.
 *
 * Usage:
 *   cd backend && npx ts-node -r tsconfig-paths/register scripts/purge-mock-keka-data.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  KEKA_MOCK_DEPARTMENTS,
  KEKA_MOCK_EMPLOYEE_IDS,
} from '../src/keka/mock/keka-mock.ids';

const prisma = new PrismaClient();

const MOCK_EMPLOYEE_KEKA_IDS = Object.values(KEKA_MOCK_EMPLOYEE_IDS);
const MOCK_DEPARTMENT_KEKA_IDS = KEKA_MOCK_DEPARTMENTS.map((d) => d.id);

async function main(): Promise<void> {
  const mockEmployees = await prisma.employee.findMany({
    where: { kekaEmployeeId: { in: MOCK_EMPLOYEE_KEKA_IDS } },
    select: { id: true, kekaEmployeeId: true, name: true },
  });
  const mockEmployeeIds = mockEmployees.map((e) => e.id);

  console.log(`Found ${mockEmployees.length} mock employees to remove.`);

  if (mockEmployeeIds.length > 0) {
    const leaveDeleted = await prisma.leaveRecord.deleteMany({
      where: { employeeId: { in: mockEmployeeIds } },
    });
    console.log(`Deleted ${leaveDeleted.count} leave records.`);

    const timesheetsDeleted = await prisma.timesheet.deleteMany({
      where: { employeeId: { in: mockEmployeeIds } },
    });
    console.log(`Deleted ${timesheetsDeleted.count} timesheets.`);

    const costsDeleted = await prisma.employeeCost.deleteMany({
      where: { employeeId: { in: mockEmployeeIds } },
    });
    console.log(`Deleted ${costsDeleted.count} employee cost rows.`);

    const allocationsDeleted = await prisma.allocation.deleteMany({
      where: {
        OR: [
          { employeeId: { in: mockEmployeeIds } },
          { backupEmployeeId: { in: mockEmployeeIds } },
        ],
      },
    });
    console.log(`Deleted ${allocationsDeleted.count} allocations.`);

    await prisma.employee.updateMany({
      where: { managerId: { in: mockEmployeeIds } },
      data: { managerId: null, reportsToKekaId: null },
    });

    await prisma.employee.updateMany({
      where: { id: { in: mockEmployeeIds } },
      data: { userId: null, managerId: null },
    });

    const employeesDeleted = await prisma.employee.deleteMany({
      where: { id: { in: mockEmployeeIds } },
    });
    console.log(`Deleted ${employeesDeleted.count} employees.`);
  }

  const departmentsReset = await prisma.department.updateMany({
    where: { kekaDepartmentId: { in: MOCK_DEPARTMENT_KEKA_IDS } },
    data: { kekaDepartmentId: null },
  });
  console.log(`Cleared keka_department_id on ${departmentsReset.count} departments.`);

  const logsDeleted = await prisma.kekaSyncLog.deleteMany();
  console.log(`Deleted ${logsDeleted.count} keka_sync_log rows.`);

  const failedDeleted = await prisma.failedSyncRecord.deleteMany({
    where: { integration: 'keka' },
  });
  console.log(`Deleted ${failedDeleted.count} failed_sync_records (keka).`);

  console.log('Mock Keka data purge complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
