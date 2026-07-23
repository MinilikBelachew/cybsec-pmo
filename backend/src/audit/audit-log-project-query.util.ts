import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type PrismaLike = Pick<
  PrismaService,
  | 'task'
  | 'projectPhase'
  | 'projectMilestone'
  | 'allocation'
  | 'actionPoint'
  | 'taskComment'
  | 'workspaceDocument'
  | 'taskProgressUpdate'
  | 'taskDependency'
>;

/**
 * Build a Prisma filter that matches every audit row tied to a project:
 *
 * 1. Direct project updates (objectType=Project, objectId=projectId)
 * 2. Any row whose objectId is a related entity ID (tasks, phases, milestones,
 *    team allocations, action points, comments, attachments, progress updates, dependencies)
 * 3. Rows whose JSON payload references projectId (imports, nested creates, etc.)
 */
export async function buildProjectAuditLogWhere(
  prisma: PrismaLike,
  projectId: string,
): Promise<Prisma.AuditLogWhereInput> {
  const [
    tasks,
    phases,
    milestones,
    allocations,
    actionPoints,
    comments,
    attachments,
    progressUpdates,
    dependencies,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.projectPhase.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.projectMilestone.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.allocation.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.actionPoint.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.taskComment.findMany({
      where: { task: { projectId } },
      select: { id: true },
    }),
    prisma.workspaceDocument.findMany({
      where: { projectId },
      select: { id: true },
    }),
    prisma.taskProgressUpdate.findMany({
      where: { task: { projectId } },
      select: { id: true },
    }),
    prisma.taskDependency.findMany({
      where: {
        OR: [
          { predecessor: { projectId } },
          { successor: { projectId } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const relatedObjectIds = [
    projectId,
    ...tasks.map((row) => row.id),
    ...phases.map((row) => row.id),
    ...milestones.map((row) => row.id),
    ...allocations.map((row) => row.id),
    ...actionPoints.map((row) => row.id),
    ...comments.map((row) => row.id),
    ...attachments.map((row) => row.id),
    ...progressUpdates.map((row) => row.id),
    ...dependencies.map((row) => row.id),
  ];

  const orConditions: Prisma.AuditLogWhereInput[] = [
    {
      objectType: { equals: 'Project', mode: 'insensitive' },
      objectId: projectId,
    },
    {
      OR: [
        { newValue: { path: ['projectId'], equals: projectId } },
        { oldValue: { path: ['projectId'], equals: projectId } },
      ],
    },
  ];

  if (relatedObjectIds.length > 0) {
    orConditions.push({ objectId: { in: relatedObjectIds } });
  }

  return { OR: orConditions };
}
