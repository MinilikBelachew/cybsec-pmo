import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Assign MSP-style plan_row_id 1..N in outline order:
 * phases (by orderIndex) → phase twin → descendants under twin / phase → unphased tasks.
 */
export async function renumberProjectPlanRows(
  tx: Tx,
  projectId: string,
): Promise<void> {
  const phases = await tx.projectPhase.findMany({
    where: { projectId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, taskId: true },
  });

  const tasks = await tx.task.findMany({
    where: { projectId },
    select: {
      id: true,
      phaseId: true,
      parentTaskId: true,
      createdAt: true,
      planRowId: true,
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  const twinIds = new Set(
    phases.map((p) => p.taskId).filter((id): id is string => Boolean(id)),
  );
  const byParent = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const list = byParent.get(task.parentTaskId) ?? [];
    list.push(task);
    byParent.set(task.parentTaskId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const ao = a.planRowId ?? Number.MAX_SAFE_INTEGER;
      const bo = b.planRowId ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  const ordered: string[] = [];
  const visited = new Set<string>();

  const walk = (taskId: string) => {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    ordered.push(taskId);
    for (const child of byParent.get(taskId) ?? []) {
      walk(child.id);
    }
  };

  for (const phase of phases) {
    if (phase.taskId) {
      walk(phase.taskId);
    }
    // Orphan work under phase (no parent / parent not twin) still in this phase.
    const orphans = tasks
      .filter(
        (t) =>
          t.phaseId === phase.id &&
          !twinIds.has(t.id) &&
          !visited.has(t.id) &&
          (t.parentTaskId == null || !visited.has(t.parentTaskId)),
      )
      .sort((a, b) => {
        const ao = a.planRowId ?? Number.MAX_SAFE_INTEGER;
        const bo = b.planRowId ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    for (const orphan of orphans) {
      walk(orphan.id);
    }
  }

  const unphased = tasks
    .filter((t) => !t.phaseId && !visited.has(t.id))
    .sort((a, b) => {
      const ao = a.planRowId ?? Number.MAX_SAFE_INTEGER;
      const bo = b.planRowId ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  for (const task of unphased) {
    walk(task.id);
  }

  // Any remaining (cycles / odd parents)
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      walk(task.id);
    }
  }

  await Promise.all(
    ordered.map((id, index) =>
      tx.task.update({
        where: { id },
        data: { planRowId: index + 1 },
      }),
    ),
  );
}
