import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { TaskPriorityEnum, TaskStatusEnum } from './create-task.dto';

@ValidatorConstraint({ name: 'BulkTasksHasAction', async: false })
export class BulkTasksHasActionConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as BulkTasksDto;
    return (
      obj.delete === true ||
      obj.status !== undefined ||
      obj.ownerId !== undefined ||
      obj.priority !== undefined
    );
  }

  defaultMessage(): string {
    return 'Provide at least one bulk action: ownerId, status, priority, or delete';
  }
}

export class BulkTasksDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Validate(BulkTasksHasActionConstraint)
  taskIds: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Set assignee for all selected tasks (null to unassign)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional({ enum: TaskStatusEnum })
  @IsOptional()
  @IsEnum(TaskStatusEnum)
  status?: TaskStatusEnum;

  @ApiPropertyOptional({ enum: TaskPriorityEnum })
  @IsOptional()
  @IsEnum(TaskPriorityEnum)
  priority?: TaskPriorityEnum;

  @ApiPropertyOptional({
    description: 'When true, deletes all selected tasks (ignores ownerId/status)',
  })
  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}
