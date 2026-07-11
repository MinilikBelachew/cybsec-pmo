import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppAbility, CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';

@Injectable()
export class FileAccessAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
  ) {}

  async assertCanAccessStorageKey(
    storageKey: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ): Promise<void> {
    const canReadTask = ability.can('read', 'Task');
    const canReadProject = ability.can('read', 'Project');
    if (!canReadTask && !canReadProject) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileAccessDenied' },
      });
    }

    const normalizedKey = storageKey.trim();
    if (!normalizedKey) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { file: 'fileNotFound' },
      });
    }

    const document = await this.prisma.workspaceDocument.findFirst({
      where: { s3Key: normalizedKey },
      select: { projectId: true, taskId: true },
    });
    if (document) {
      if (document.taskId) {
        await this.assertTaskReadable(document.taskId, caslUser);
      } else {
        await this.assertProjectReadable(document.projectId, caslUser);
      }
      return;
    }

    const progressTaskId = await this.findProgressTaskIdForKey(normalizedKey);
    if (progressTaskId) {
      await this.assertTaskReadable(progressTaskId, caslUser);
      return;
    }

    throw new NotFoundException({
      status: HttpStatus.NOT_FOUND,
      errors: { file: 'fileNotFound' },
    });
  }

  private async findProgressTaskIdForKey(storageKey: string): Promise<string | null> {
    const legacy = await this.prisma.taskProgressUpdate.findFirst({
      where: { s3EvidenceKey: storageKey },
      select: { taskId: true },
    });
    if (legacy) return legacy.taskId;

    const rows = await this.prisma.$queryRaw<{ taskId: string }[]>`
      SELECT task_id AS "taskId"
      FROM task_progress_updates
      WHERE evidence_files @> ${JSON.stringify([{ storageKey }])}::jsonb
      LIMIT 1
    `;

    return rows[0]?.taskId ?? null;
  }

  private async assertTaskReadable(
    taskId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: {
        AND: [{ id: taskId }, this.recordScopeWhere.taskWhere(caslUser, 'read')],
      },
      select: { id: true },
    });

    if (!task) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileAccessDenied' },
      });
    }
  }

  private async assertProjectReadable(
    projectId: string,
    caslUser: CaslUserContext,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        AND: [
          { id: projectId },
          this.recordScopeWhere.projectWhere(caslUser, 'read'),
        ],
      },
      select: { id: true },
    });

    if (!project) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        errors: { file: 'fileAccessDenied' },
      });
    }
  }
}
