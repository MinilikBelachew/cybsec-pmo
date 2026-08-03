import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAlertRuleDto {
  @ApiProperty({ example: 'RISK_SCORE_BREACHED' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventType: string;

  @ApiProperty({
    example: { scoreGte: 12 },
    description: 'JSON threshold configuration',
  })
  @IsObject()
  thresholdConfig: Record<string, unknown>;

  @ApiProperty({ example: ['in_app', 'email'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @ApiPropertyOptional({ example: 24, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reminderCadenceHrs?: number = 24;

  @ApiPropertyOptional({ example: 48, default: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  escalationDelayHrs?: number = 48;

  @ApiProperty({ example: 'pmo_lead' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  escalationRole: string;

  @ApiPropertyOptional({ type: [Number], description: 'Role IDs as recipients' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  recipientRoleIds?: number[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateAlertRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  thresholdConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reminderCadenceHrs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  escalationDelayHrs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  escalationRole?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  recipientRoleIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AcknowledgeAlertEventDto {
  @ApiPropertyOptional({ description: 'Optional acknowledgement note' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AlertRuleRecipientDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  roleId: number;

  @ApiPropertyOptional()
  roleCode?: string;

  @ApiPropertyOptional()
  roleName?: string;
}

export class AlertRuleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  thresholdConfig: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  channels: string[];

  @ApiProperty()
  reminderCadenceHrs: number;

  @ApiProperty()
  escalationDelayHrs: number;

  @ApiProperty()
  escalationRole: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [AlertRuleRecipientDto] })
  recipients: AlertRuleRecipientDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class AlertEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruleId: string;

  @ApiPropertyOptional()
  eventType?: string;

  @ApiProperty()
  objectType: string;

  @ApiPropertyOptional({ nullable: true })
  objectId: string | null;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  deliveryStatus: string;

  @ApiPropertyOptional({ nullable: true })
  acknowledgedBy: string | null;

  @ApiProperty()
  escalationLevel: number;

  @ApiProperty()
  firedAt: string;

  @ApiPropertyOptional({ nullable: true })
  ackedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  nextReminderAt: string | null;
}
