import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import {
  CreateTimesheetEntryDto,
  QueryTimesheetContextDto,
  QueryTimesheetWeekDto,
  SubmitTimesheetWeekDto,
  UpdateTimesheetEntryDto,
} from './dto/timesheet-mutation.dto';
import {
  QueryTimesheetApprovalsDto,
  ApproveTimesheetSubmissionDto,
  RejectTimesheetSubmissionDto,
  TimesheetApprovalDecisionDto,
  TimesheetApprovalListResponseDto,
  RetryTimesheetSyncDto,
  RetryTimesheetSyncResultDto,
  TimesheetSyncFailureDto,
} from './dto/timesheet-approval.dto';
import {
  SubmitTimesheetWeekResultDto,
  TimesheetContextDto,
  TimesheetEntryDto,
  TimesheetWeekResponseDto,
} from './dto/timesheet-response.dto';
import { TimesheetApprovalService } from './timesheet-approval.service';
import { TimesheetsService } from './timesheets.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Timesheets')
@Controller({
  path: 'timesheets',
  version: '1',
})
export class TimesheetsController {
  constructor(
    private readonly timesheetsService: TimesheetsService,
    private readonly timesheetApprovalService: TimesheetApprovalService,
  ) {}

  @CheckAbility('update', 'Timesheet')
  @Get('context')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetContextDto })
  getContext(
    @Query() query: QueryTimesheetContextDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetContextDto> {
    return this.timesheetsService.getContext(request.user!.id, query.asOf);
  }

  @CheckAbility('update', 'Timesheet')
  @Get('week')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetWeekResponseDto })
  getWeek(
    @Query() query: QueryTimesheetWeekDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetWeekResponseDto> {
    return this.timesheetsService.getWeek(request.user!.id, query.weekStart);
  }

  @CheckAbility('update', 'Timesheet')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOkResponse({ type: TimesheetEntryDto })
  createEntry(
    @Body() dto: CreateTimesheetEntryDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetEntryDto> {
    return this.timesheetsService.createEntry(request.user!.id, dto);
  }

  @CheckAbility('update', 'Timesheet')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetEntryDto })
  updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateTimesheetEntryDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetEntryDto> {
    return this.timesheetsService.updateEntry(request.user!.id, id, dto);
  }

  @CheckAbility('update', 'Timesheet')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEntry(
    @Param('id') id: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    return this.timesheetsService.deleteEntry(request.user!.id, id);
  }

  @CheckAbility('update', 'Timesheet')
  @Post('submit-week')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SubmitTimesheetWeekResultDto })
  submitWeek(
    @Body() dto: SubmitTimesheetWeekDto,
    @Request() request: RequestWithAbility,
  ): Promise<SubmitTimesheetWeekResultDto> {
    return this.timesheetsService.submitWeek(request.user!.id, dto.weekStart);
  }

  @CheckAbility('update', 'Timesheet')
  @Post('resubmit-week')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SubmitTimesheetWeekResultDto })
  resubmitWeek(
    @Body() dto: SubmitTimesheetWeekDto,
    @Request() request: RequestWithAbility,
  ): Promise<SubmitTimesheetWeekResultDto> {
    return this.timesheetsService.resubmitWeek(request.user!.id, dto.weekStart);
  }

  @CheckAbility('approve', 'Timesheet')
  @Get('keka-sync/failures')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: [TimesheetSyncFailureDto] })
  listSyncFailures(): Promise<TimesheetSyncFailureDto[]> {
    return this.timesheetApprovalService.listSyncFailures();
  }

  @CheckAbility('approve', 'Timesheet')
  @Post('keka-sync/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: RetryTimesheetSyncResultDto })
  retrySync(
    @Body() dto: RetryTimesheetSyncDto,
    @Request() request: RequestWithAbility,
  ): Promise<RetryTimesheetSyncResultDto> {
    return this.timesheetApprovalService.retrySync(
      dto.timesheetId,
      request.user!.id,
    );
  }

  @CheckAbility('approve', 'Timesheet')
  @Get('pending-approvals')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetApprovalListResponseDto })
  findPendingApprovals(
    @Query() query: QueryTimesheetApprovalsDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetApprovalListResponseDto> {
    return this.timesheetApprovalService.findSubmissions(
      query,
      request.caslUser!,
    );
  }

  @CheckAbility('approve', 'Timesheet')
  @Patch('submissions/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetApprovalDecisionDto })
  approveSubmission(
    @Body() dto: ApproveTimesheetSubmissionDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetApprovalDecisionDto> {
    return this.timesheetApprovalService.approveSubmission(
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }

  @CheckAbility('approve', 'Timesheet')
  @Patch('submissions/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TimesheetApprovalDecisionDto })
  rejectSubmission(
    @Body() dto: RejectTimesheetSubmissionDto,
    @Request() request: RequestWithAbility,
  ): Promise<TimesheetApprovalDecisionDto> {
    return this.timesheetApprovalService.rejectSubmission(
      dto,
      request.user!.id,
      request.caslUser!,
    );
  }
}
