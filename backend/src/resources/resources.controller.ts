import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { AllocationApprovalService } from './allocation-approval.service';
import {
  AllocationApprovalDecisionDto,
  AllocationApprovalListResponseDto,
  QueryAllocationApprovalsDto,
  RejectAllocationApprovalDto,
} from './dto/allocation-approval.dto';
import { QueryTeamDirectoryDto } from './dto/query-team-directory.dto';
import { QueryTeamLeaveDto } from './dto/query-team-leave.dto';
import { QueryEmployeeAttendanceDto } from './dto/query-employee-attendance.dto';
import {
  AllocationPolicyDto,
  DesignationOptionsDto,
  EmployeeAttendanceListResponseDto,
  TeamDirectoryResponseDto,
  TeamLeaveListResponseDto,
} from './dto/team-directory.dto';
import { TeamDirectoryService } from './team-directory.service';
import { LeaveBackupService } from './leave-backup.service';
import {
  LeaveImpactListResponseDto,
  QueryLeaveImpactsDto,
} from './dto/leave-impact.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Resources')
@Controller({
  path: 'resources',
  version: '1',
})
export class ResourcesController {
  constructor(
    private readonly teamDirectoryService: TeamDirectoryService,
    private readonly allocationApprovalService: AllocationApprovalService,
    private readonly leaveBackupService: LeaveBackupService,
  ) {}

  @CheckAbility('read', 'Team')
  @Get('team')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TeamDirectoryResponseDto })
  findTeamDirectory(
    @Query() query: QueryTeamDirectoryDto,
    @Request() request: RequestWithAbility,
  ): Promise<TeamDirectoryResponseDto> {
    return this.teamDirectoryService.findDirectory(query, request.caslUser!);
  }

  @CheckAbility('read', 'Team')
  @Get('team/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TeamLeaveListResponseDto })
  findTeamLeave(
    @Query() query: QueryTeamLeaveDto,
    @Request() request: RequestWithAbility,
  ): Promise<TeamLeaveListResponseDto> {
    return this.teamDirectoryService.findLeave(query, request.caslUser!);
  }

  @CheckAbility('read', 'Team')
  @Get('team/:employeeId/attendance')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EmployeeAttendanceListResponseDto })
  findEmployeeAttendance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: QueryEmployeeAttendanceDto,
    @Request() request: RequestWithAbility,
  ): Promise<EmployeeAttendanceListResponseDto> {
    return this.teamDirectoryService.findEmployeeAttendance(
      employeeId,
      query,
      request.caslUser!,
    );
  }

  @CheckAbility('approve', 'Team')
  @Get('allocation-approvals')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationApprovalListResponseDto })
  findAllocationApprovals(
    @Query() query: QueryAllocationApprovalsDto,
    @Request() request: RequestWithAbility,
  ): Promise<AllocationApprovalListResponseDto> {
    return this.allocationApprovalService.findPending(
      query,
      request.caslUser!,
    );
  }

  @CheckAbility('approve', 'Team')
  @Patch('allocation-approvals/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationApprovalDecisionDto })
  approveAllocation(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<AllocationApprovalDecisionDto> {
    return this.allocationApprovalService.approve(
      id,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('approve', 'Team')
  @Patch('allocation-approvals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationApprovalDecisionDto })
  rejectAllocation(
    @Param('id') id: string,
    @Body() dto: RejectAllocationApprovalDto,
    @Request() request: RequestWithAbility,
  ): Promise<AllocationApprovalDecisionDto> {
    return this.allocationApprovalService.reject(
      id,
      request.user!.id,
      request.caslUser!,
      dto,
    );
  }

  @CheckAbility('read', 'Team')
  @Get('allocation-policy')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AllocationPolicyDto })
  getAllocationPolicy(): Promise<AllocationPolicyDto> {
    return this.teamDirectoryService.getAllocationPolicy();
  }

  @CheckAbility('read', 'Team')
  @Get('meta/designations')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DesignationOptionsDto })
  getDesignationOptions(
    @Request() request: RequestWithAbility,
  ): Promise<DesignationOptionsDto> {
    return this.teamDirectoryService.getDesignationOptions(request.caslUser!);
  }

  @CheckAbility('read', 'Team')
  @Get('leave-impacts')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LeaveImpactListResponseDto })
  listLeaveImpacts(
    @Query() query: QueryLeaveImpactsDto,
    @Request() request: RequestWithAbility,
  ): Promise<LeaveImpactListResponseDto> {
    return this.leaveBackupService.listImpacts(query, request.caslUser!);
  }
}
