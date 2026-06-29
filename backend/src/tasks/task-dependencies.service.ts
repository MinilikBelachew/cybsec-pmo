import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { AppAbility, CaslUserContext } from '../casl/casl.types';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import {
  CreateTaskDependencyDto,
  TaskDependencyType,
  ValidateTaskDependencyDto,
} from './dto/create-task-dependency.dto';
import { UpdateTaskDependencyDto } from './dto/update-task-dependency.dto';
import { QueryTaskDependencyDto } from './dto/query-task-dependency.dto';

const TASK_SUMMARY_SELECT = {
  id: true,
  title: true,
  projectId: true,
  startDate: true,
  endDate: true,
  ownerId: true,
  owner: {
    select: { id: true, displayName: true, email: true },
  },
} satisfies Prisma.TaskSelect;

type TaskSummary = Prisma.TaskGetPayload<{ select: typeof TASK_SUMMARY_SELECT }>;

type DependencyRow = Prisma.TaskDependencyGetPayload<{
  include: {
    predecessor: { select: typeof TASK_SUMMARY_SELECT };
    successor: { select: typeof TASK_SUMMARY_SELECT };
  };
}>;

const DEPENDENCY_INCLUDE = {
  predecessor: { select: TASK_SUMMARY_SELECT },
  successor: { select: TASK_SUMMARY_SELECT },
} satisfies Prisma.TaskDependencyInclude;

@Injectable()
export class TaskDependenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findMany(
    query: QueryTaskDependencyDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    if (!query.projectId && !query.taskId) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { query: 'projectIdOrTaskIdRequired' },
      });
    }

    const taskScope = this.recordScopeWhere.taskWhere(caslUser, 'read');
    const filters: Prisma.TaskDependencyWhereInput[] = [];

    if (query.projectId) {
      filters.push({
        predecessor: {
          AND: [{ projectId: query.projectId }, taskScope],
        },
      });
    }

    if (query.taskId) {
      filters.push({
        OR: [{ predecessorId: query.taskId }, { successorId: query.taskId }],
        predecessor: { AND: [taskScope] },
      });
    }

    const rows = await this.prisma.taskDependency.findMany({
      where: { AND: filters },
      include: DEPENDENCY_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => this.formatDependency(row));
  }

  async validate(
    dto: ValidateTaskDependencyDto,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const { predecessor, successor } = await this.loadTaskPair(
      dto.predecessorId,
      dto.successorId,
      caslUser,
      'update',
    );

    this.assertSameProject(predecessor, successor);
    this.assertNotSelfLink(dto.predecessorId, dto.successorId);

    const wouldCycle = await this.detectCycle(
      dto.predecessorId,
      dto.successorId,
    );

    return {
      valid: !wouldCycle,
      cyclic: wouldCycle,
      predecessor: { id: predecessor.id, title: predecessor.title },
      successor: { id: successor.id, title: successor.title },
    };
  }

  /**
   * Validate a batch of dependency adds/removes as one atomic change.
   * Each add is checked against the graph after prior adds in the batch are applied.
   */
  async validateBundleChanges(
    adds: CreateTaskDependencyDto[],
    removeIds: string[],
    caslUser: CaslUserContext,
    ability: AppAbility,
  ): Promise<void> {
    for (const dep of adds) {
      const { predecessor, successor } = await this.loadTaskPair(
        dep.predecessorId,
        dep.successorId,
        caslUser,
        'update',
      );
      this.assertSameProject(predecessor, successor);
      this.assertNotSelfLink(dep.predecessorId, dep.successorId);
    }

    const removed = removeIds.length
      ? await this.prisma.taskDependency.findMany({
          where: { id: { in: removeIds } },
          select: { predecessorId: true, successorId: true },
        })
      : [];

    const removedPairs = new Set(
      removed.map((edge) => `${edge.predecessorId}:${edge.successorId}`),
    );

    const existing = await this.prisma.taskDependency.findMany({
      select: { predecessorId: true, successorId: true },
    });

    const adjacency = this.buildAdjacency(
      existing.filter(
        (edge) =>
          !removedPairs.has(`${edge.predecessorId}:${edge.successorId}`),
      ),
    );

    const seenAdds = new Set<string>();
    for (const dep of adds) {
      const pairKey = `${dep.predecessorId}:${dep.successorId}`;
      if (seenAdds.has(pairKey)) {
        continue;
      }
      seenAdds.add(pairKey);

      if (
        this.wouldCycleInGraph(
          adjacency,
          dep.predecessorId,
          dep.successorId,
        )
      ) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { dependency: 'cyclicDependency' },
        });
      }

      const list = adjacency.get(dep.predecessorId) ?? [];
      list.push(dep.successorId);
      adjacency.set(dep.predecessorId, list);
    }
  }

  async create(
    dto: CreateTaskDependencyDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const { predecessor, successor } = await this.loadTaskPair(
      dto.predecessorId,
      dto.successorId,
      caslUser,
      'update',
    );

    this.assertSameProject(predecessor, successor);
    this.assertNotSelfLink(dto.predecessorId, dto.successorId);

    if (await this.detectCycle(dto.predecessorId, dto.successorId)) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { dependency: 'cyclicDependency' },
      });
    }

    const depType = dto.depType ?? 'FS';
    const lagDays = dto.lagDays ?? 0;

    let created: DependencyRow;
    try {
      created = await this.prisma.taskDependency.create({
        data: {
          predecessorId: dto.predecessorId,
          successorId: dto.successorId,
          depType,
          lagDays,
        },
        include: DEPENDENCY_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { dependency: 'dependencyAlreadyExists' },
        });
      }
      throw error;
    }

    const impacted = await this.finalizeProjectSchedule(
      successor.projectId,
      [successor.id],
      {
        actorId,
        trigger: 'dependency_created',
        predecessorTitle: predecessor.title,
        successorTitle: successor.title,
      },
    );

    return this.formatDependency(created);
  }

  async update(
    id: string,
    dto: UpdateTaskDependencyDto,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const existing = await this.loadDependencyInScope(id, caslUser, 'update');

    const updated = await this.prisma.taskDependency.update({
      where: { id },
      data: {
        ...(dto.depType !== undefined ? { depType: dto.depType } : {}),
        ...(dto.lagDays !== undefined ? { lagDays: dto.lagDays } : {}),
      },
      include: DEPENDENCY_INCLUDE,
    });

    await this.finalizeProjectSchedule(updated.successor.projectId, [updated.successorId], {
      actorId,
      trigger: 'dependency_updated',
      predecessorTitle: updated.predecessor.title,
      successorTitle: updated.successor.title,
    });

    return this.formatDependency(updated);
  }

  async remove(
    id: string,
    actorId: string,
    caslUser: CaslUserContext,
    ability: AppAbility,
  ) {
    const existing = await this.loadDependencyInScope(id, caslUser, 'update');
    const projectId = existing.successor.projectId;

    await this.prisma.taskDependency.delete({ where: { id } });
    await this.updateCriticalPathFlags(projectId);

    return { success: true, id: existing.id };
  }

  async recalculateFromTaskDateChange(
    projectId: string,
    taskId: string,
    actorId: string,
    taskTitle: string,
  ): Promise<void> {
    const dependencyCount = await this.prisma.taskDependency.count({
      where: {
        OR: [{ predecessorId: taskId }, { successorId: taskId }],
      },
    });

    if (dependencyCount === 0) {
      return;
    }

    await this.finalizeProjectSchedule(projectId, [taskId], {
      actorId,
      trigger: 'task_dates_updated',
      predecessorTitle: taskTitle,
      successorTitle: '',
    });
  }

  private async finalizeProjectSchedule(
    projectId: string,
    seedTaskIds: string[],
    notify?: {
      actorId: string;
      trigger: 'dependency_created' | 'dependency_updated' | 'task_dates_updated';
      predecessorTitle: string;
      successorTitle: string;
    },
  ) {
    const impacted = await this.recalculateScheduleFrom(projectId, seedTaskIds);
    await this.updateCriticalPathFlags(projectId);

    if (notify && (notify.trigger !== 'task_dates_updated' || impacted.length > 0)) {
      await this.notifyScheduleImpact({
        projectId,
        ...notify,
        impacted,
      });
    }

    return impacted;
  }

  private async loadDependencyInScope(
    id: string,
    caslUser: CaslUserContext,
    action: 'read' | 'update',
  ): Promise<DependencyRow> {
    const row = await this.prisma.taskDependency.findFirst({
      where: {
        id,
        predecessor: {
          AND: [this.recordScopeWhere.taskWhere(caslUser, action)],
        },
      },
      include: DEPENDENCY_INCLUDE,
    });

    if (!row) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { dependency: 'dependencyNotFound' },
      });
    }

    return row;
  }

  private async loadTaskPair(
    predecessorId: string,
    successorId: string,
    caslUser: CaslUserContext,
    action: 'read' | 'update',
  ): Promise<{ predecessor: TaskSummary; successor: TaskSummary }> {
    const scope = this.recordScopeWhere.taskWhere(caslUser, action);
    const [predecessor, successor] = await Promise.all([
      this.prisma.task.findFirst({
        where: { AND: [{ id: predecessorId }, scope] },
        select: TASK_SUMMARY_SELECT,
      }),
      this.prisma.task.findFirst({
        where: { AND: [{ id: successorId }, scope] },
        select: TASK_SUMMARY_SELECT,
      }),
    ]);

    if (!predecessor || !successor) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { task: 'taskNotFound' },
      });
    }

    return { predecessor, successor };
  }

  private assertSameProject(predecessor: TaskSummary, successor: TaskSummary) {
    if (predecessor.projectId !== successor.projectId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { dependency: 'crossProjectDependencyNotAllowed' },
      });
    }
  }

  private assertNotSelfLink(predecessorId: string, successorId: string) {
    if (predecessorId === successorId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { dependency: 'selfDependencyNotAllowed' },
      });
    }
  }

  /** Returns true if adding predecessorId → successorId would create a cycle. */
  private async detectCycle(
    predecessorId: string,
    successorId: string,
  ): Promise<boolean> {
    const edges = await this.prisma.taskDependency.findMany({
      select: { predecessorId: true, successorId: true },
    });

    return this.wouldCycleInGraph(
      this.buildAdjacency(edges),
      predecessorId,
      successorId,
    );
  }

  private buildAdjacency(
    edges: Array<{ predecessorId: string; successorId: string }>,
  ): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const list = adjacency.get(edge.predecessorId) ?? [];
      list.push(edge.successorId);
      adjacency.set(edge.predecessorId, list);
    }
    return adjacency;
  }

  private wouldCycleInGraph(
    adjacency: Map<string, string[]>,
    predecessorId: string,
    successorId: string,
  ): boolean {
    const proposed = [...(adjacency.get(predecessorId) ?? [])];
    if (!proposed.includes(successorId)) {
      proposed.push(successorId);
    }

    const walkFrom = new Map(adjacency);
    walkFrom.set(predecessorId, proposed);

    const visited = new Set<string>();
    const stack = [successorId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === predecessorId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      for (const next of walkFrom.get(current) ?? []) {
        stack.push(next);
      }
    }

    return false;
  }

  private async recalculateScheduleFrom(
    projectId: string,
    seedTaskIds: string[],
  ): Promise<Array<{ taskId: string; ownerId: string | null; title: string }>> {
    const [tasks, dependencies] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          ownerId: true,
          startDate: true,
          endDate: true,
        },
      }),
      this.prisma.taskDependency.findMany({
        where: {
          predecessor: { projectId },
        },
      }),
    ]);

    const taskMap = new Map(tasks.map((task) => [task.id, { ...task }]));
    const incoming = new Map<string, typeof dependencies>();
    for (const dep of dependencies) {
      const list = incoming.get(dep.successorId) ?? [];
      list.push(dep);
      incoming.set(dep.successorId, list);
    }

    const outgoing = new Map<string, string[]>();
    for (const dep of dependencies) {
      const list = outgoing.get(dep.predecessorId) ?? [];
      list.push(dep.successorId);
      outgoing.set(dep.predecessorId, list);
    }

    const queue = [...new Set(seedTaskIds)];
    const visited = new Set<string>();
    const impacted: Array<{ taskId: string; ownerId: string | null; title: string }> = [];

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      if (visited.has(taskId)) {
        continue;
      }
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) {
        continue;
      }

      const deps = incoming.get(taskId) ?? [];
      if (deps.length === 0) {
        for (const next of outgoing.get(taskId) ?? []) {
          queue.push(next);
        }
        continue;
      }

      const beforeStart = task.startDate?.getTime() ?? null;
      const beforeEnd = task.endDate?.getTime() ?? null;
      const merged = this.mergeConstraints(task, deps, taskMap);

      if (merged.startDate) {
        task.startDate = merged.startDate;
      }
      if (merged.endDate) {
        task.endDate = merged.endDate;
      }

      const changed =
        (task.startDate?.getTime() ?? null) !== beforeStart ||
        (task.endDate?.getTime() ?? null) !== beforeEnd;

      if (changed && (task.startDate || task.endDate)) {
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            startDate: task.startDate,
            endDate: task.endDate,
          },
        });

        impacted.push({
          taskId: task.id,
          ownerId: task.ownerId,
          title: task.title,
        });
      }

      for (const next of outgoing.get(taskId) ?? []) {
        queue.push(next);
      }
    }

    return impacted;
  }

  private mergeConstraints(
    successor: Pick<Task, 'startDate' | 'endDate'>,
    deps: Array<{
      depType: string;
      lagDays: number;
      predecessorId: string;
    }>,
    taskMap: Map<
      string,
      Pick<Task, 'id' | 'startDate' | 'endDate' | 'title' | 'ownerId'>
    >,
  ): { startDate?: Date; endDate?: Date } {
    let requiredStart: Date | null = null;
    let requiredEnd: Date | null = null;
    const durationDays = this.taskDurationDays(successor);

    for (const dep of deps) {
      const predecessor = taskMap.get(dep.predecessorId);
      if (!predecessor) {
        continue;
      }

      const constraint = this.constraintFromDependency(
        predecessor,
        dep.depType as TaskDependencyType,
        dep.lagDays,
        durationDays,
      );

      if (constraint.startDate) {
        if (!requiredStart || constraint.startDate.getTime() > requiredStart.getTime()) {
          requiredStart = constraint.startDate;
        }
      }
      if (constraint.endDate) {
        if (!requiredEnd || constraint.endDate.getTime() > requiredEnd.getTime()) {
          requiredEnd = constraint.endDate;
        }
      }
    }

    const result: { startDate?: Date; endDate?: Date } = {};

    if (requiredStart) {
      result.startDate = requiredStart;
      if (durationDays > 0) {
        result.endDate = this.addDays(requiredStart, durationDays);
      } else if (requiredEnd) {
        result.endDate = requiredEnd;
      }
    } else if (requiredEnd) {
      result.endDate = requiredEnd;
      if (durationDays > 0) {
        result.startDate = this.addDays(requiredEnd, -durationDays);
      }
    }

    return result;
  }

  private constraintFromDependency(
    predecessor: Pick<Task, 'startDate' | 'endDate'>,
    depType: TaskDependencyType,
    lagDays: number,
    successorDurationDays: number,
  ): { startDate?: Date; endDate?: Date } {
    const lag = lagDays ?? 0;
    const preStart = predecessor.startDate;
    const preEnd = predecessor.endDate ?? predecessor.startDate;

    switch (depType) {
      case 'FS':
        if (!preEnd) return {};
        return { startDate: this.addDays(preEnd, lag + 1) };
      case 'SS':
        if (!preStart) return {};
        return { startDate: this.addDays(preStart, lag) };
      case 'FF':
        if (!preEnd) return {};
        return { endDate: this.addDays(preEnd, lag) };
      case 'SF':
        if (!preStart) return {};
        return { endDate: this.addDays(preStart, lag) };
      default:
        return {};
    }
  }

  private taskDurationDays(task: Pick<Task, 'startDate' | 'endDate'>): number {
    if (!task.startDate || !task.endDate) {
      return 0;
    }
    const ms = task.endDate.getTime() - task.startDate.getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private dayIndex(date: Date | null | undefined): number | null {
    if (!date) {
      return null;
    }
    return Math.floor(date.getTime() / 86_400_000);
  }

  private durationDaysFromDates(
    startDate: Date | null | undefined,
    endDate: Date | null | undefined,
  ): number {
    const start = this.dayIndex(startDate);
    const end = this.dayIndex(endDate ?? startDate);
    if (start == null && end == null) {
      return 1;
    }
    if (start != null && end != null) {
      return Math.max(1, end - start + 1);
    }
    return 1;
  }

  private computeConstraintDayIndex(
    predStart: number | null,
    predEnd: number | null,
    depType: TaskDependencyType,
    lagDays: number,
  ): { es?: number; ef?: number } {
    const lag = lagDays ?? 0;
    switch (depType) {
      case 'FS':
        if (predEnd == null) return {};
        return { es: predEnd + lag + 1 };
      case 'SS':
        if (predStart == null) return {};
        return { es: predStart + lag };
      case 'FF':
        if (predEnd == null) return {};
        return { ef: predEnd + lag };
      case 'SF':
        if (predStart == null) return {};
        return { ef: predStart + lag };
      default:
        return {};
    }
  }

  private backwardLatestFinish(
    depType: TaskDependencyType,
    lagDays: number,
    succLs: number,
    succLf: number,
    predDuration: number,
  ): number {
    const lag = lagDays ?? 0;
    switch (depType) {
      case 'FS':
        return succLs - lag - 1;
      case 'SS':
        return succLs - lag + predDuration - 1;
      case 'FF':
      case 'SF':
        return succLf - lag;
      default:
        return succLf;
    }
  }

  private async updateCriticalPathFlags(projectId: string): Promise<void> {
    const [tasks, dependencies] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId },
        select: { id: true, startDate: true, endDate: true },
      }),
      this.prisma.taskDependency.findMany({
        where: { predecessor: { projectId } },
      }),
    ]);

    if (dependencies.length === 0) {
      await this.prisma.task.updateMany({
        where: { projectId, isOnCriticalPath: true },
        data: { isOnCriticalPath: false },
      });
      return;
    }

    const graphIds = new Set<string>();
    for (const dep of dependencies) {
      graphIds.add(dep.predecessorId);
      graphIds.add(dep.successorId);
    }

    const incoming = new Map<string, typeof dependencies>();
    const outgoing = new Map<string, string[]>();
    for (const dep of dependencies) {
      const inList = incoming.get(dep.successorId) ?? [];
      inList.push(dep);
      incoming.set(dep.successorId, inList);

      const outList = outgoing.get(dep.predecessorId) ?? [];
      outList.push(dep.successorId);
      outgoing.set(dep.predecessorId, outList);
    }

    const indegree = new Map<string, number>();
    for (const id of graphIds) {
      indegree.set(id, 0);
    }
    for (const dep of dependencies) {
      indegree.set(dep.successorId, (indegree.get(dep.successorId) ?? 0) + 1);
    }

    const queue = [...graphIds].filter((id) => (indegree.get(id) ?? 0) === 0);
    const topo: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      topo.push(id);
      for (const next of outgoing.get(id) ?? []) {
        const nextDeg = (indegree.get(next) ?? 1) - 1;
        indegree.set(next, nextDeg);
        if (nextDeg === 0) {
          queue.push(next);
        }
      }
    }

    if (topo.length !== graphIds.size) {
      await this.prisma.task.updateMany({
        where: { projectId },
        data: { isOnCriticalPath: false },
      });
      return;
    }

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const ES = new Map<string, number>();
    const EF = new Map<string, number>();

    for (const id of topo) {
      const task = taskById.get(id);
      const duration = task
        ? this.durationDaysFromDates(task.startDate, task.endDate)
        : 1;
      let es = this.dayIndex(task?.startDate) ?? 0;
      let efConstraint: number | null = null;

      for (const dep of incoming.get(id) ?? []) {
        const pred = taskById.get(dep.predecessorId);
        const predEs = ES.get(dep.predecessorId) ?? this.dayIndex(pred?.startDate);
        const predEf =
          EF.get(dep.predecessorId) ??
          this.dayIndex(pred?.endDate ?? pred?.startDate);
        const constraint = this.computeConstraintDayIndex(
          predEs,
          predEf,
          dep.depType as TaskDependencyType,
          dep.lagDays,
        );
        if (constraint.es != null) {
          es = Math.max(es, constraint.es);
        }
        if (constraint.ef != null) {
          efConstraint =
            efConstraint == null
              ? constraint.ef
              : Math.max(efConstraint, constraint.ef);
        }
      }

      if (efConstraint != null) {
        es = Math.max(es, efConstraint - duration + 1);
      }

      ES.set(id, es);
      EF.set(id, es + duration - 1);
    }

    const projectEnd = Math.max(...[...EF.values()]);
    const LS = new Map<string, number>();
    const LF = new Map<string, number>();

    for (const id of [...topo].reverse()) {
      const task = taskById.get(id);
      const duration = task
        ? this.durationDaysFromDates(task.startDate, task.endDate)
        : 1;
      const succs = outgoing.get(id) ?? [];

      let lf = EF.get(id) ?? projectEnd;
      if (succs.length > 0) {
        lf = Math.min(
          ...succs.map((succId) => {
            const dep = dependencies.find(
              (row) => row.predecessorId === id && row.successorId === succId,
            );
            if (!dep) {
              return LF.get(succId) ?? projectEnd;
            }
            return this.backwardLatestFinish(
              dep.depType as TaskDependencyType,
              dep.lagDays,
              LS.get(succId) ?? ES.get(succId) ?? projectEnd,
              LF.get(succId) ?? EF.get(succId) ?? projectEnd,
              duration,
            );
          }),
        );
      }

      LF.set(id, lf);
      LS.set(id, lf - duration + 1);
    }

    const criticalIds = new Set<string>();
    for (const id of graphIds) {
      const es = ES.get(id);
      const ls = LS.get(id);
      if (es != null && ls != null && es === ls) {
        criticalIds.add(id);
      }
    }

    await this.prisma.$transaction(
      tasks.map((task) =>
        this.prisma.task.update({
          where: { id: task.id },
          data: { isOnCriticalPath: criticalIds.has(task.id) },
        }),
      ),
    );
  }

  private async notifyScheduleImpact(params: {
    projectId: string;
    actorId: string;
    trigger: 'dependency_created' | 'dependency_updated' | 'task_dates_updated';
    predecessorTitle: string;
    successorTitle: string;
    impacted: Array<{ taskId: string; ownerId: string | null; title: string }>;
  }) {
    const ownerIds = params.impacted
      .map((row) => row.ownerId)
      .filter((id): id is string => Boolean(id));
    const pmIds = await this.notificationsService.resolveProjectPmUserIds(
      params.projectId,
    );
    const recipientUserIds = [...new Set([...ownerIds, ...pmIds])];

    const body =
      params.trigger === 'dependency_created'
        ? `Link added: "${params.predecessorTitle}" → "${params.successorTitle}".${
            params.impacted.length > 0
              ? ` ${params.impacted.length} task date(s) adjusted.`
              : ''
          }`
        : params.trigger === 'dependency_updated'
          ? `Dependency updated between "${params.predecessorTitle}" and "${params.successorTitle}".${
              params.impacted.length > 0
                ? ` ${params.impacted.length} task date(s) adjusted.`
                : ''
            }`
          : `Dates changed on "${params.predecessorTitle}".${
              params.impacted.length > 0
                ? ` ${params.impacted.length} dependent task date(s) adjusted.`
                : ''
            }`;

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.DEPENDENCY_SCHEDULE_IMPACT,
      recipientUserIds,
      title: 'Task schedule updated',
      body,
      payload: {
        projectId: params.projectId,
        link: `/dashboard/projects/${params.projectId}`,
        impactedTaskIds: params.impacted.map((row) => row.taskId),
      },
      sourceObjectType: 'TaskDependency',
      actorId: params.actorId,
    });
  }

  private formatDependency(row: DependencyRow) {
    return {
      id: row.id,
      predecessorId: row.predecessorId,
      successorId: row.successorId,
      depType: row.depType,
      lagDays: row.lagDays,
      createdAt: row.createdAt.toISOString(),
      predecessor: {
        id: row.predecessor.id,
        title: row.predecessor.title,
        projectId: row.predecessor.projectId,
        startDate: row.predecessor.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: row.predecessor.endDate?.toISOString().slice(0, 10) ?? null,
        ownerId: row.predecessor.ownerId,
        owner: row.predecessor.owner,
      },
      successor: {
        id: row.successor.id,
        title: row.successor.title,
        projectId: row.successor.projectId,
        startDate: row.successor.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: row.successor.endDate?.toISOString().slice(0, 10) ?? null,
        ownerId: row.successor.ownerId,
        owner: row.successor.owner,
      },
    };
  }
}
