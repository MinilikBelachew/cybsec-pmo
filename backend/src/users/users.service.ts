import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeepPartial } from '../utils/types/deep-partial.type';


@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const userObject = await this.usersRepository.findByEmail(
      createUserDto.email,
    );
    if (userObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailAlreadyExists',
        },
      });
    }

    return this.usersRepository.create({
      entraObjectId: createUserDto.entraObjectId,
      email: createUserDto.email,
      displayName: createUserDto.displayName,
      roleId: createUserDto.role.id,
      isActive: createUserDto.isActive ?? true,
      isExternal: createUserDto.isExternal ?? false,
      lastLogin: null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    const userObject = await this.usersRepository.findById(id);

    if (!userObject) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotExists',
        },
      });
    }

    if (updateUserDto.email && updateUserDto.email !== userObject.email) {
      const emailExists = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (emailExists && emailExists.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
    }

    const updatePayload: Partial<User> = {};
    if (updateUserDto.entraObjectId !== undefined) updatePayload.entraObjectId = updateUserDto.entraObjectId;
    if (updateUserDto.email !== undefined) updatePayload.email = updateUserDto.email;
    if (updateUserDto.displayName !== undefined) updatePayload.displayName = updateUserDto.displayName;
    if (updateUserDto.role?.id !== undefined) updatePayload.roleId = updateUserDto.role.id;
    if (updateUserDto.isActive !== undefined) updatePayload.isActive = updateUserDto.isActive;
    if (updateUserDto.isExternal !== undefined) updatePayload.isExternal = updateUserDto.isExternal;

    return this.usersRepository.update(id, updatePayload);
  }

  async updateInternal(
    id: User['id'],
    payload: DeepPartial<User>,
  ): Promise<User | null> {
    return this.usersRepository.update(id, payload);
  }

  async remove(id: User['id']): Promise<void> {

    await this.usersRepository.remove(id);
  }
}

