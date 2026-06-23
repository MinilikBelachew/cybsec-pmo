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
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { infinityPagination } from '../utils/infinity-pagination';

const TASK_READ_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
  RoleEnum.engineer,
  RoleEnum.finance,
  RoleEnum.sales,
  RoleEnum.client,
  RoleEnum.vendor,
];

const TASK_WRITE_ROLES = [
  RoleEnum.super_admin,
  RoleEnum.pmo_lead,
  RoleEnum.pm,
  RoleEnum.team_lead,
];

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('Tasks')
@Controller({
  path: 'tasks',
  version: '1',
})
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Roles(...TASK_WRITE_ROLES)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() request: { user: JwtPayloadType },
  ) {
    return this.tasksService.create(createTaskDto, request.user.id);
  }

  @Roles(...TASK_READ_ROLES)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryTaskDto) {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    return infinityPagination(
      await this.tasksService.findManyWithPagination({ ...query, page, limit }),
      { page, limit },
    );
  }

  @Roles(...TASK_READ_ROLES)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  findOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Roles(...TASK_READ_ROLES) // Engineers can update tasks assigned to them (status update)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: String, required: true })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() request: { user: JwtPayloadType },
  ) {
    return this.tasksService.update(id, updateTaskDto, request.user.id);
  }

  @Roles(RoleEnum.super_admin, RoleEnum.pmo_lead, RoleEnum.pm)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: String, required: true })
  remove(
    @Param('id') id: string,
    @Request() request: { user: JwtPayloadType },
  ) {
    return this.tasksService.remove(id, request.user.id);
  }

  // --- Comments Endpoints ---
  @Roles(...TASK_READ_ROLES)
  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', type: String, required: true })
  addComment(
    @Param('id') id: string,
    @Body('body') body: string,
    @Body('isInternal') isInternal = true,
    @Request() request: { user: JwtPayloadType },
  ) {
    return this.tasksService.addComment(id, body, isInternal, request.user.id);
  }
}
