import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EscalationSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum EscalationCommChannel {
  Call = 'Call',
  Email = 'Email',
  Meeting = 'Meeting',
  Chat = 'Chat',
  Other = 'Other',
}

export class CreateEscalationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ enum: EscalationSeverity })
  @IsEnum(EscalationSeverity)
  severity: EscalationSeverity;

  @ApiProperty({ example: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slaTargetHrs: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional({ example: 'Initial customer call logged' })
  @IsOptional()
  @IsString()
  initialCommunication?: string;

  @ApiPropertyOptional({
    enum: EscalationCommChannel,
    default: EscalationCommChannel.Email,
  })
  @IsOptional()
  @IsEnum(EscalationCommChannel)
  initialChannel?: EscalationCommChannel;
}

export class AddEscalationCommunicationDto {
  @ApiProperty({ enum: EscalationCommChannel })
  @IsEnum(EscalationCommChannel)
  channel: EscalationCommChannel;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CloseEscalationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionSummary: string;
}

export class EscalationUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class EscalationCommunicationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  loggedBy: string;

  @ApiPropertyOptional({ type: EscalationUserDto })
  logger?: EscalationUserDto;

  @ApiProperty()
  createdAt: string;
}

export class EscalationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customerId: string;

  @ApiPropertyOptional()
  customerName?: string;

  @ApiProperty()
  severity: string;

  @ApiProperty()
  slaTargetHrs: number;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional({ type: EscalationUserDto })
  owner?: EscalationUserDto;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  resolutionSummary: string | null;

  @ApiProperty()
  slaBreached: boolean;

  @ApiPropertyOptional({ nullable: true })
  closedAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ type: [EscalationCommunicationDto] })
  communications: EscalationCommunicationDto[];

  @ApiProperty({
    description: 'True when open and past SLA target hours from createdAt',
  })
  isOverdue: boolean;
}
