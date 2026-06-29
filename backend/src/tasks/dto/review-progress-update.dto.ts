import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export enum ProgressReviewDecisionEnum {
  Approve = 'approve',
  Reject = 'reject',
  Rework = 'rework',
}

export class ReviewProgressUpdateDto {
  @ApiProperty({ enum: ProgressReviewDecisionEnum })
  @IsEnum(ProgressReviewDecisionEnum)
  decision: ProgressReviewDecisionEnum;

  @ApiPropertyOptional({ description: 'Required for reject and rework' })
  @ValidateIf((dto) =>
    dto.decision === ProgressReviewDecisionEnum.Reject ||
    dto.decision === ProgressReviewDecisionEnum.Rework,
  )
  @IsString()
  @MaxLength(2000)
  reviewReason?: string;
}
