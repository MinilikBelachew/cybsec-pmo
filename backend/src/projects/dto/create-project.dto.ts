import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiBillingModel,
  ApiCurrencyCode,
  ApiEngagementType,
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../enums/project-api.enum';

@ValidatorConstraint({ name: 'EndDateAfterStartDate', async: false })
export class EndDateAfterStartDateConstraint implements ValidatorConstraintInterface {
  validate(endDate: Date, args: ValidationArguments): boolean {
    const obj = args.object as { startDate?: Date };
    if (!obj.startDate || !endDate) return true;
    return endDate > obj.startDate;
  }

  defaultMessage(): string {
    return 'End date must be after the start date';
  }
}

export class CreateProjectDto {
  @ApiProperty({ example: 'SOC Transformation 2026', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Deliver a managed SOC service for the client.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  objective: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ enum: ApiEngagementType })
  @IsEnum(ApiEngagementType)
  engagementType: ApiEngagementType;

  @ApiProperty({ enum: ApiBillingModel })
  @IsEnum(ApiBillingModel)
  billingModel: ApiBillingModel;

  @ApiPropertyOptional({ enum: ApiPriorityLevel, default: ApiPriorityLevel.Medium })
  @IsOptional()
  @IsEnum(ApiPriorityLevel)
  priority?: ApiPriorityLevel = ApiPriorityLevel.Medium;

  @ApiProperty({ example: '2026-01-01' })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2026-12-31' })
  @Type(() => Date)
  @IsDate()
  @Validate(EndDateAfterStartDateConstraint)
  endDate: Date;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @IsPositive()
  value: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string = 'USD';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  primaryPmId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  secondaryPmId?: string | null;

  @ApiPropertyOptional({ enum: ApiProjectStatus, default: ApiProjectStatus.Draft })
  @IsOptional()
  @IsEnum(ApiProjectStatus)
  status?: ApiProjectStatus = ApiProjectStatus.Draft;
}
