import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  KekaDepartment,
  KekaEmployeeProfile,
  KekaLeaveRequest,
  KekaPagedResponse,
  KekaTokenResponse,
} from '../keka.types';
import { buildKekaPagedResponse, parseIsoDate } from './keka-mock.helpers';
import {
  MOCK_KEKA_DEPARTMENTS,
  MOCK_KEKA_EMPLOYEES,
  MOCK_KEKA_LEAVE_REQUESTS,
} from './keka-mock.fixtures';

@Controller()
export class KekaMockController {
  private readonly pushedTimeEntries: Array<{
    id: string;
    date: string;
    employeeId: string;
    projectId: string | null;
    taskId: string | null;
    totalMinutes: number;
    comments: string | null;
    isBillable: boolean;
  }> = [];
  private readonly pushedClients: Array<{ id: string; body: unknown }> = [];
  private readonly mockClients: Array<{
    id: string;
    name: string;
    code: string;
    description?: string | null;
    billingAddress?: Record<string, string | null> | null;
    clientContacts?: unknown[];
  }> = [
    {
      id: 'mock-client-cisco',
      name: 'Cisco',
      code: 'USBU003',
      description: null,
      billingAddress: null,
      clientContacts: [],
    },
  ];

  @Post('keka-mock/connect/token')
  @HttpCode(HttpStatus.OK)
  token(): KekaTokenResponse {
    return {
      access_token: 'mock-keka-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  @Get('keka-mock/api/v1/hris/employees')
  employees(
    @Query('pageNumber') pageNumber = '1',
    @Query('pageSize') pageSize = '100',
    @Query('employeeIds') employeeIds?: string,
  ): KekaPagedResponse<KekaEmployeeProfile> {
    let items = MOCK_KEKA_EMPLOYEES;

    if (employeeIds) {
      const ids = new Set(
        employeeIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      items = items.filter((employee) => employee.id && ids.has(employee.id));
    }

    return buildKekaPagedResponse(
      items,
      Number(pageNumber) || 1,
      Number(pageSize) || 100,
      '/keka-mock/api/v1/hris/employees',
    );
  }

  @Get('keka-mock/api/v1/hris/departments')
  departments(
    @Query('pageNumber') pageNumber = '1',
    @Query('pageSize') pageSize = '100',
    @Query('departmentIds') departmentIds?: string,
  ): KekaPagedResponse<KekaDepartment> {
    let items = MOCK_KEKA_DEPARTMENTS;

    if (departmentIds) {
      const ids = new Set(
        departmentIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      items = items.filter((department) => department.id && ids.has(department.id));
    }

    return buildKekaPagedResponse(
      items,
      Number(pageNumber) || 1,
      Number(pageSize) || 100,
      '/keka-mock/api/v1/hris/departments',
    );
  }

  @Get('keka-mock/api/v1/time/leaverequests')
  leaveRequests(
    @Query('pageNumber') pageNumber = '1',
    @Query('pageSize') pageSize = '100',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeIds') employeeIds?: string,
  ): KekaPagedResponse<KekaLeaveRequest> {
    let items = MOCK_KEKA_LEAVE_REQUESTS;

    if (employeeIds) {
      const ids = new Set(
        employeeIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      items = items.filter(
        (leave) =>
          leave.employeeIdentifier && ids.has(leave.employeeIdentifier),
      );
    }

    const fromDate = parseIsoDate(from);
    const toDate = parseIsoDate(to);

    if (fromDate || toDate) {
      items = items.filter((leave) => {
        const leaveFrom = parseIsoDate(leave.fromDate);
        const leaveTo = parseIsoDate(leave.toDate);
        if (!leaveFrom || !leaveTo) {
          return false;
        }
        if (fromDate && leaveTo < fromDate) {
          return false;
        }
        if (toDate && leaveFrom > toDate) {
          return false;
        }
        return true;
      });
    }

    return buildKekaPagedResponse(
      items,
      Number(pageNumber) || 1,
      Number(pageSize) || 100,
      '/keka-mock/api/v1/time/leaverequests',
    );
  }

  @Get('keka-mock/api/v1/psa/clients')
  clients(
    @Query('pageNumber') pageNumber = '1',
    @Query('pageSize') pageSize = '100',
  ) {
    return buildKekaPagedResponse(
      this.mockClients,
      Number(pageNumber) || 1,
      Number(pageSize) || 100,
      '/keka-mock/api/v1/psa/clients',
    );
  }

  @Post('keka-mock/api/v1/psa/clients')
  @HttpCode(HttpStatus.CREATED)
  createClient(@Body() body: { name?: string; code?: string; description?: string }) {
    const id = `mock-client-${this.pushedClients.length + 1}`;
    const entry = {
      id,
      name: body.name ?? `Client ${this.pushedClients.length + 1}`,
      code: body.code ?? `C${this.pushedClients.length + 1}`,
      description: body.description ?? null,
      billingAddress: null,
      clientContacts: [],
    };
    this.mockClients.push(entry);
    this.pushedClients.push({ id, body });
    return { succeeded: true, data: id };
  }

  @Post('keka-mock/api/v1/psa/employees/:employeeId/timeentries')
  @HttpCode(HttpStatus.CREATED)
  createTimeEntry(
    @Param('employeeId') employeeId: string,
    @Body() body: unknown,
  ): { succeeded: true; data: { id: string; employeeId: string } } {
    const rows = Array.isArray(body) ? body : [body];
    const createdIds: string[] = [];

    for (const row of rows) {
      const item = (row ?? {}) as Record<string, unknown>;
      const id = `TE-${this.pushedTimeEntries.length + 1}`;
      const minutesRaw = item.numberOfMinutes ?? item.totalMinutes ?? item.minutes;
      const totalMinutes = Number(minutesRaw ?? 0);
      this.pushedTimeEntries.push({
        id,
        date: String(item.date ?? new Date().toISOString()),
        employeeId,
        projectId: typeof item.projectId === 'string' ? item.projectId : null,
        taskId: typeof item.taskId === 'string' ? item.taskId : null,
        totalMinutes: Number.isFinite(totalMinutes) ? totalMinutes : 0,
        comments:
          typeof item.comment === 'string'
            ? item.comment
            : typeof item.comments === 'string'
              ? item.comments
              : null,
        isBillable: item.isBillable !== false,
      });
      createdIds.push(id);
    }

    const primaryId = createdIds[0] ?? `TE-${this.pushedTimeEntries.length + 1}`;
    return { succeeded: true, data: { id: primaryId, employeeId } };
  }

  @Get('keka-mock/api/v1/psa/timeentries')
  listTimeEntries(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeIds') employeeIds?: string,
    @Query('projectIds') projectIds?: string,
    @Query('pageNumber') pageNumber = '1',
    @Query('pageSize') pageSize = '100',
  ): KekaPagedResponse<{
    id: string;
    date: string;
    employeeId: string;
    projectId: string | null;
    taskId: string | null;
    totalMinutes: number;
    comments: string | null;
    isBillable: boolean;
    status: number;
  }> {
    const fromDate = from ? parseIsoDate(from) : null;
    const toDate = to ? parseIsoDate(to) : null;
    const employeeFilter = new Set(
      (employeeIds ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const projectFilter = new Set(
      (projectIds ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );

    const filtered = this.pushedTimeEntries.filter((entry) => {
      const entryDate = parseIsoDate(entry.date);
      if (fromDate && entryDate && entryDate < fromDate) return false;
      if (toDate && entryDate && entryDate > toDate) return false;
      if (employeeFilter.size > 0 && !employeeFilter.has(entry.employeeId)) {
        return false;
      }
      if (
        projectFilter.size > 0 &&
        (!entry.projectId || !projectFilter.has(entry.projectId))
      ) {
        return false;
      }
      return true;
    });

    return buildKekaPagedResponse(
      filtered.map((entry) => ({ ...entry, status: 1 })),
      Number(pageNumber) || 1,
      Number(pageSize) || 100,
      '/api/v1/psa/timeentries',
    );
  }

  private readonly pushedAllocations: unknown[] = [];

  @Post('keka-mock/api/v1/psa/employees/:employeeId/allocations')
  @HttpCode(HttpStatus.CREATED)
  createAllocation(
    @Param('employeeId') employeeId: string,
    @Body() body: unknown,
  ): { succeeded: true; data: { id: string; employeeId: string } } {
    const entry = {
      id: `AL-${this.pushedAllocations.length + 1}`,
      employeeId,
      body,
    };
    this.pushedAllocations.push(entry);
    return { succeeded: true, data: { id: entry.id, employeeId } };
  }
}
