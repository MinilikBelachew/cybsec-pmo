import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateCustomerBillingAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'IN' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  zip?: string;
}

export class CreateCustomerDto {
  @ApiProperty({ example: 'Cisco' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  /** Keka PSA client code (required by Keka). Auto-generated if omitted. */
  @ApiPropertyOptional({ example: 'USBU003' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  /**
   * Keka currency id from GET /hris/currencies.
   * Required when creating the client in Keka PSA.
   */
  @ApiProperty({
    example: '8275e02f-89fe-4a5d-82b3-eef4a1b2c3d4',
    description: 'Keka billingCurrencyId (from /hris/currencies)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  billingCurrencyId: string;

  @ApiPropertyOptional({ type: CreateCustomerBillingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomerBillingAddressDto)
  billingAddress?: CreateCustomerBillingAddressDto;
}
