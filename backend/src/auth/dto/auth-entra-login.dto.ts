import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthEntraLoginDto {
  @ApiProperty({ example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6...' })
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
