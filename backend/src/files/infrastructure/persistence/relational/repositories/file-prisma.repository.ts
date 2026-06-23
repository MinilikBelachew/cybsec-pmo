import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { FileRepository } from '../../file.repository';
import { FilePrismaMapper } from '../mappers/file-prisma.mapper';
import { FileType } from '../../../../domain/file';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class FilePrismaRepository implements FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Omit<FileType, 'id'>): Promise<FileType> {
    const entity = await this.prisma.file.create({
      data: {
        path: data.path,
      },
    });

    return FilePrismaMapper.toDomain(entity);
  }

  async findById(id: FileType['id']): Promise<NullableType<FileType>> {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return null;
    }

    const entity = await this.prisma.file.findUnique({
      where: {
        id: id,
      },
    });

    return entity ? FilePrismaMapper.toDomain(entity) : null;
  }

  async findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validIds = ids.filter((id) => uuidRegex.test(id));

    if (validIds.length === 0) {
      return [];
    }

    const entities = await this.prisma.file.findMany({
      where: {
        id: { in: validIds },
      },
    });

    return entities.map((entity) => FilePrismaMapper.toDomain(entity));
  }
}
