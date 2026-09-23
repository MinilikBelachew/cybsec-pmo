import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMppImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    description: 'IANA time zone for MPP wall-clock Start/Finish.',
  })
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
