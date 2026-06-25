import { Prisma } from '@prisma/client';
import {
  AUDIT_SORT_FIELDS,
  QueryAuditDto,
} from './dto/query-audit.dto';

export function buildAuditLogWhere(
  query: QueryAuditDto,
): Prisma.AuditLogWhereInput {
  const filters: Prisma.AuditLogWhereInput[] = [];

  if (query.objectType?.trim()) {
    filters.push({
      objectType: { equals: query.objectType.trim(), mode: 'insensitive' },
    });
  }

  if (query.objectId?.trim()) {
    filters.push({ objectId: query.objectId.trim() });
  }

  if (query.action?.trim()) {
    filters.push({
      action: { contains: query.action.trim(), mode: 'insensitive' },
    });
  }

  if (query.breakGlassOnly === true) {
    filters.push({ breakGlassAction: true });
  }

  const search = query.search?.trim();
  if (search) {
    const searchOr: Prisma.AuditLogWhereInput[] = [
      { action: { contains: search, mode: 'insensitive' } },
      { objectType: { contains: search, mode: 'insensitive' } },
      { source: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search, mode: 'insensitive' } },
      {
        user: {
          is: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      },
      {
        user: {
          is: {
            displayName: { contains: search, mode: 'insensitive' },
          },
        },
      },
    ];

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(search)) {
      searchOr.push({ objectId: search });
      searchOr.push({ actorId: search });
    }

    filters.push({ OR: searchOr });
  }

  if (filters.length === 0) {
    return {};
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

export function buildAuditLogOrderBy(
  query: QueryAuditDto,
): Prisma.AuditLogOrderByWithRelationInput {
  const sortBy = AUDIT_SORT_FIELDS.includes(
    query.sortBy as (typeof AUDIT_SORT_FIELDS)[number],
  )
    ? query.sortBy
    : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return { [sortBy ?? 'createdAt']: sortOrder };
}
