import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { UserPrismaMapper } from '../mappers/user-prisma.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersPrismaRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: User): Promise<User> {
    const persistenceModel = UserPrismaMapper.toPersistence(data);

    const newEntity = await this.prisma.user.create({
      data: persistenceModel,
      include: {
        role: true,
      },
    });

    return UserPrismaMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (filterOptions?.roles?.length) {
      where.roleCode = {
        in: filterOptions.roles.map((role) => role.code),
      };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      sortOptions?.map((sort) => ({
        [sort.orderBy]: sort.order,
      })) ?? [];

    const entities = await this.prisma.user.findMany({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where,
      orderBy,
      include: {
        role: true,
      },
    });

    return entities.map((user) => UserPrismaMapper.toDomain(user));
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.prisma.user.findFirst({
      where: {
        id: id as string,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    return entity ? UserPrismaMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.prisma.user.findMany({
      where: {
        id: { in: ids.map((id) => id as string) },
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    return entities.map((user) => UserPrismaMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    return entity ? UserPrismaMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.prisma.user.findFirst({
      where: {
        id: id as string,
        isActive: true,
      },
      include: {
        role: true,
      },
    });

    if (!entity) {
      throw new Error('User not found');
    }

    const domainEntity = UserPrismaMapper.toDomain(entity);
    const updatedData = UserPrismaMapper.toPersistence({
      ...domainEntity,
      ...payload,
    });

    const updatedEntity = await this.prisma.user.update({
      where: { id: id as string },
      data: updatedData,
      include: {
        role: true,
      },
    });

    return UserPrismaMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.prisma.user.update({
      where: { id: id as string },
      data: { isActive: false },
    });
  }
}

