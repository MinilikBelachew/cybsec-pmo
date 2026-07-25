import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';

export const PHASE_GATE_COMPLETE_STATUSES: TaskStatus[] = [
  TaskStatus.Done,
  TaskStatus.Approved,
];

type PrismaClientLike = {
  task: {
    findFirst: (args: Prisma.TaskFindFirstArgs) => Promise<{
      id: string;
      title: string;
      status: TaskStatus;
    } | null>;
  };
};

export function isPhaseGateComplete(status: TaskStatus): boolean {
  return PHASE_GATE_COMPLETE_STATUSES.includes(status);
}

/** Clear other gates on the phase, then set this task as the sole gate. */
export async function assignExclusivePhaseGate(
  tx: {
    task: {
      updateMany: (args: Prisma.TaskUpdateManyArgs) => Promise<unknown>;
      update: (args: Prisma.TaskUpdateArgs) => Promise<unknown>;
    };
  },
  phaseId: string,
  taskId: string,
): Promise<void> {
  await tx.task.updateMany({
    where: {
      phaseId,
      isPhaseGate: true,
      id: { not: taskId },
    },
    data: { isPhaseGate: false },
  });
  await tx.task.update({
    where: { id: taskId },
    data: { isPhaseGate: true, phaseId },
  });
}

export async function assertPhaseGateReadyToComplete(
  prisma: PrismaClientLike,
  phaseId: string,
): Promise<void> {
  const gate = await prisma.task.findFirst({
    where: {
      phaseId,
      isPhaseGate: true,
      parentTaskId: null,
    },
    select: { id: true, title: true, status: true },
  });

  if (!gate) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { phase: 'phaseGateTaskRequired' },
      message:
        'Add a mandatory sign-off (phase gate) task to this phase before marking it Completed.',
    });
  }

  if (!isPhaseGateComplete(gate.status)) {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { phase: 'phaseGateTaskIncomplete' },
      message: `Complete the phase sign-off task “${gate.title}” (Done or Approved) before completing this phase.`,
    });
  }
}
