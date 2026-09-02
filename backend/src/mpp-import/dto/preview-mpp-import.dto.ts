import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PreviewMppImportDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'IANA time zone for previewing MPP wall-clock Start/Finish.',
  })
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
