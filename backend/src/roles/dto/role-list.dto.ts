import { ApiProperty } from '@nestjs/swagger';

export class RoleListItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  isExternal: boolean;

  @ApiProperty()
  permissionCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class PermissionListItemDto {
  @ApiProperty({ description: 'Role-permission grant id (join row)' })
  id: string;

  @ApiProperty({ description: 'Canonical permission catalog id' })
  permissionId: string;

  @ApiProperty()
  roleId: number;

  @ApiProperty()
  module: string;

  @ApiProperty()
  action: string;

  @ApiProperty({ nullable: true })
  recordScope: string | null;

  @ApiProperty({ nullable: true })
  fieldScope: Record<string, unknown> | null;
}

export class PermissionWithRoleDto extends PermissionListItemDto {
  @ApiProperty()
  roleCode: string;

  @ApiProperty()
  roleLabel: string;
}

export class PaginatedMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPrevPage: boolean;
}

export class PermissionCatalogItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  module: string;

  @ApiProperty()
  action: string;
}

export class RecordScopeOptionDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  label: string;
}
