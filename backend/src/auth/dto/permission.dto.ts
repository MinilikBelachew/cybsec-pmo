import { ApiProperty } from '@nestjs/swagger';

export class PermissionDto {
  @ApiProperty()
  module: string;

  @ApiProperty()
  action: string;

  @ApiProperty({ nullable: true })
  recordScope: string | null;

  @ApiProperty({ nullable: true })
  fieldScope: Record<string, unknown> | null;
}
