import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AuthEmergencyLoginDto {
  @ApiProperty({ example: 'admin@cybsec.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Offline vault emergency secret' })
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty({ example: 'Microsoft Entra ID unavailable — emergency access' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
