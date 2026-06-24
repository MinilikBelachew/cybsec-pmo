import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/domain/user';

export class LoginResponseDto {
  @ApiProperty({
    type: () => User,
  })
  user: User;
}
