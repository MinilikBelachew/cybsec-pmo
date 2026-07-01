import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import { extractClientIp } from '../auth/utils/request-context.util';
import { CaslAbilityInterceptor } from '../casl/casl-ability.interceptor';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { CaslGuard, RequestWithAbility } from '../casl/casl.guard';
import { RolesService } from './roles.service';
import { GrantRolePermissionDto } from './dto/grant-role-permission.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { QueryRolePermissionsDto } from './dto/query-role-permissions.dto';
import { QueryAllPermissionsDto } from './dto/query-all-permissions.dto';
import { UpdateRolePermissionDto } from './dto/update-role-permission.dto';
import {
  PaginatedMetaDto,
  PermissionCatalogItemDto,
  PermissionListItemDto,
  PermissionMatrixResponseDto,
  PermissionWithRoleDto,
  RecordScopeOptionDto,
  RoleListItemDto,
} from './dto/role-list.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CaslGuard)
@UseInterceptors(CaslAbilityInterceptor)
@ApiTags('Roles')
@Controller({
  path: 'roles',
  version: '1',
})
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @CheckAbility('read', 'Rbac')
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/RoleListItemDto' } },
        meta: { $ref: '#/components/schemas/PaginatedMetaDto' },
      },
    },
  })
  findAll(@Query() query: QueryRolesDto): Promise<{
    data: RoleListItemDto[];
    meta: PaginatedMetaDto;
  }> {
    return this.rolesService.findRoles(query);
  }

  @CheckAbility('read', 'Rbac')
  @Get('permissions/catalog')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/PermissionCatalogItemDto' },
        },
      },
    },
  })
  findPermissionCatalog(): Promise<{ data: PermissionCatalogItemDto[] }> {
    return this.rolesService.findPermissionCatalog();
  }

  @CheckAbility('read', 'Rbac')
  @Get('record-scopes')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/RecordScopeOptionDto' },
        },
      },
    },
  })
  findRecordScopes(): Promise<{ data: RecordScopeOptionDto[] }> {
    return Promise.resolve(this.rolesService.findRecordScopeOptions());
  }

  @CheckAbility('read', 'Rbac')
  @Get('permissions/matrix')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PermissionMatrixResponseDto })
  findPermissionMatrix(): Promise<PermissionMatrixResponseDto> {
    return this.rolesService.findPermissionMatrix();
  }

  @CheckAbility('read', 'Rbac')
  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  findAllPermissions(@Query() query: QueryAllPermissionsDto): Promise<{
    data: PermissionWithRoleDto[];
    meta: PaginatedMetaDto;
  }> {
    return this.rolesService.findAllPermissions(query);
  }

  @CheckAbility('read', 'Rbac')
  @Get(':roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'roleId', type: Number })
  findPermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Query() query: QueryRolePermissionsDto,
  ) {
    return this.rolesService.findRolePermissions(roleId, query);
  }

  @CheckAbility('manage', 'Rbac')
  @Post(':roleId/permissions')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'roleId', type: Number })
  @ApiCreatedResponse({ type: PermissionListItemDto })
  grantPermission(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() dto: GrantRolePermissionDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.rolesService.grantPermission(
      roleId,
      dto,
      request.user!.id,
      extractClientIp(request as unknown as ExpressRequest),
      request.user?.isExternal === true,
    );
  }

  @CheckAbility('manage', 'Rbac')
  @Patch(':roleId/permissions/:grantId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'roleId', type: Number })
  @ApiParam({ name: 'grantId', type: String })
  @ApiOkResponse({ type: PermissionListItemDto })
  updatePermission(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @Body() dto: UpdateRolePermissionDto,
    @Request() request: RequestWithAbility,
  ) {
    return this.rolesService.updatePermissionGrant(
      roleId,
      grantId,
      dto,
      request.user!.id,
      extractClientIp(request as unknown as ExpressRequest),
      request.user?.isExternal === true,
    );
  }

  @CheckAbility('manage', 'Rbac')
  @Delete(':roleId/permissions/:grantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'roleId', type: Number })
  @ApiParam({ name: 'grantId', type: String })
  @ApiNoContentResponse()
  async revokePermission(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @Request() request: RequestWithAbility,
  ): Promise<void> {
    await this.rolesService.revokePermission(
      roleId,
      grantId,
      request.user!.id,
      extractClientIp(request as unknown as ExpressRequest),
      request.user?.isExternal === true,
    );
  }
}
