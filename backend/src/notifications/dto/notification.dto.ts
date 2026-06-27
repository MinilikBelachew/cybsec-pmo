import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: Object })
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ nullable: true })
  sourceObjectType: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceObjectId: string | null;

  @ApiPropertyOptional({ nullable: true })
  readAt: string | null;

  @ApiProperty()
  createdAt: string;
}
