import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class Role {
  @Allow()
  @ApiProperty({
    type: String,
    example: 'super_admin',
  })
  code: string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'Super Admin',
  })
  label: string;

  @Allow()
  @ApiProperty({
    type: Boolean,
    example: false,
  })
  isExternal: boolean;
}

