import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SowSnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ nullable: true })
  scope: string | null;

  @ApiPropertyOptional({ nullable: true })
  deliverables: string | null;

  @ApiPropertyOptional({ nullable: true })
  exclusions: string | null;

  @ApiPropertyOptional({ nullable: true })
  assumptions: string | null;

  @ApiPropertyOptional({ nullable: true })
  value: string | null;

  @ApiPropertyOptional({ nullable: true })
  currency: string | null;

  @ApiPropertyOptional({ nullable: true })
  startDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  billingModel: string | null;

  @ApiPropertyOptional({ nullable: true })
  engagementType: string | null;

  @ApiPropertyOptional({ nullable: true })
  approverSignatureName: string | null;
}

export class SowDocumentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional({ nullable: true })
  opportunityId: string | null;

  @ApiProperty()
  creationMode: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  version: number;

  @ApiProperty({ type: SowSnapshotDto })
  snapshot: SowSnapshotDto;

  @ApiPropertyOptional({ nullable: true })
  s3FinalKey: string | null;

  @ApiPropertyOptional({ nullable: true })
  documentLink: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  crmWrittenBackAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({ nullable: true })
  projectName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  customerName?: string | null;
}

export class CreateSowDto {}

export class UpdateSowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  scope?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  deliverables?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  exclusions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  assumptions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  value?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  billingModel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  engagementType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  s3FinalKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentLink?: string | null;
}

export class ApproveSowDto {
  @ApiProperty({
    description: 'Typed full name used as approval signature',
    example: 'Jane Doe',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  signatureName: string;
}
