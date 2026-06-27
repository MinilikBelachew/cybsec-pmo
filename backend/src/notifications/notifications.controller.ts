import {
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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Notifications')
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @CheckAbility('read', 'Notification')
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryNotificationsDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.notificationsService.findForUser(request.user!.id, query);
  }

  @CheckAbility('read', 'Notification')
  @Get('unread-count')
  @HttpCode(HttpStatus.OK)
  async unreadCount(@Request() request: RequestWithAbility) {
    const count = await this.notificationsService.getUnreadCount(request.user!.id);
    return { count };
  }

  @CheckAbility('manage', 'Notification')
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@Request() request: RequestWithAbility) {
    return this.notificationsService.markAllRead(request.user!.id);
  }

  @CheckAbility('manage', 'Notification')
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: NotificationDto })
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() request: RequestWithAbility,
  ) {
    return this.notificationsService.markRead(request.user!.id, id);
  }
}
