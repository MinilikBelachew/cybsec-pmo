import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateMppImportDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;
}
