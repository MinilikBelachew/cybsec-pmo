import { Prisma } from '@prisma/client';
import { FilterUserDto, QueryUserDto } from './dto/query-user.dto';

export const USER_SORT_FIELDS = [
  'displayName',
  'email',
  'role',
  'isActive',
  'createdAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export function buildUserWhere(
  query: Pick<QueryUserDto, 'search' | 'filters'>,
): Prisma.UserWhereInput {
  const filters: Prisma.UserWhereInput[] = [];

  const search = query.search?.trim();
  if (search) {
    filters.push({
      OR: [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { role: { code: { contains: search, mode: 'insensitive' } } },
        { role: { label: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const roleCodes =
    query.filters?.roles
      ?.map((role) => role.code)
      .filter((code): code is string => Boolean(code)) ?? [];

  if (roleCodes.length) {
    filters.push({
      role: {
        code: { in: roleCodes },
      },
    });
  }

  if (!filters.length) {
    return {};
  }

  return { AND: filters };
}

export function buildUserOrderBy(
  query: Pick<QueryUserDto, 'sortBy' | 'sortOrder' | 'sort'>,
): Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[] {
  const legacySort = query.sort?.[0];
  if (legacySort?.orderBy && legacySort?.order) {
    const order = legacySort.order === 'asc' ? 'asc' : 'desc';
    if (legacySort.orderBy === 'role') {
      return { role: { label: order } };
    }
    return { [legacySort.orderBy]: order };
  }

  const sortBy = USER_SORT_FIELDS.includes(query.sortBy as UserSortField)
    ? query.sortBy
    : 'displayName';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  if (sortBy === 'role') {
    return { role: { label: sortOrder } };
  }

  return { [sortBy ?? 'displayName']: sortOrder };
}
