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
  private readonly pushedTimeEntries: unknown[] = [];

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

  @Post('keka-mock/api/v1/psa/employees/:employeeId/timeentries')
  @HttpCode(HttpStatus.CREATED)
  createTimeEntry(
    @Param('employeeId') employeeId: string,
    @Body() body: unknown,
  ): { succeeded: true; data: { id: string; employeeId: string } } {
    const entry = {
      id: `TE-${this.pushedTimeEntries.length + 1}`,
      employeeId,
      body,
    };
    this.pushedTimeEntries.push(entry);
    return { succeeded: true, data: { id: entry.id, employeeId } };
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
