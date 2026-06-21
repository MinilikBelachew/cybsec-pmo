import { Exclude, Expose } from 'class-transformer';
import { Role } from '../../roles/domain/role';
import { ApiProperty } from '@nestjs/swagger';

export class User {
  @ApiProperty({
    type: String,
    example: 'd0b8f103-68d8-4f28-a6b1-3e4b77f98d78',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'fed-id-12345',
  })
  @Expose({ groups: ['me', 'admin'] })
  entraObjectId: string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
  })
  @Expose({ groups: ['me', 'admin'] })
  email: string;

  @ApiProperty({
    type: String,
    example: 'John Doe',
  })
  displayName: string;

  @ApiProperty({
    type: String,
    example: 'super_admin',
  })
  roleCode: string;

  @ApiProperty({
    type: Boolean,
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    type: Boolean,
    example: false,
  })
  isExternal: boolean;

  @ApiProperty({
    type: Date,
    nullable: true,
  })
  lastLogin: Date | null;

  @ApiProperty({
    type: () => Role,
  })
  role?: Role | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

