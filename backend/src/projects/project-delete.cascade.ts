import { Prisma } from '@prisma/client';

/** Stay well under Postgres' 32767 bind-variable limit. */
const IN_CHUNK_SIZE = 5_000;

function chunkIds(ids: string[], size = IN_CHUNK_SIZE): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

async function deleteManyByIdIn(
  ids: string[],
  run: (chunk: string[]) => Promise<unknown>,
): Promise<void> {
  for (const chunk of chunkIds(ids)) {
    await run(chunk);
  }
}

/** Deletes a project and all dependent rows in FK-safe order (no DB migration required). */
export async function deleteProjectWithDependents(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  // Prefer relation filters (no giant IN lists) for task-scoped rows — large
  // projects exceed Postgres' 32767 bind-variable limit otherwise.
  await tx.taskDependency.deleteMany({
    where: {
      OR: [
        { predecessor: { projectId } },
        { successor: { projectId } },
      ],
    },
  });
  await tx.taskComment.deleteMany({ where: { task: { projectId } } });
  await tx.taskChecklistItem.deleteMany({ where: { task: { projectId } } });
  await tx.workspaceDocument.deleteMany({
    where: {
      OR: [{ projectId }, { task: { projectId } }],
    },
  });
  await tx.taskProgressUpdate.deleteMany({ where: { task: { projectId } } });
  await tx.timesheet.deleteMany({ where: { projectId } });
  await tx.task.deleteMany({ where: { projectId } });

  await tx.invoice.deleteMany({ where: { projectId } });
  await tx.projectMilestone.deleteMany({ where: { projectId } });
  await tx.projectPhase.deleteMany({ where: { projectId } });
  await tx.allocation.deleteMany({ where: { projectId } });
  await tx.projectDomain.deleteMany({ where: { projectId } });
  await tx.projectBudget.deleteMany({ where: { projectId } });
  await tx.employeeCost.deleteMany({ where: { projectId } });
  await tx.risk.deleteMany({ where: { projectId } });
  await tx.issue.deleteMany({ where: { projectId } });
  await tx.actionPoint.deleteMany({ where: { projectId } });
  await tx.lessonsLearned.deleteMany({ where: { projectId } });
  await tx.kpiSnapshot.deleteMany({ where: { projectId } });
  await tx.generatedReport.deleteMany({ where: { projectId } });

  const scheduleIds = (
    await tx.reportSchedule.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (scheduleIds.length > 0) {
    await deleteManyByIdIn(scheduleIds, (chunk) =>
      tx.reportScheduleRecipient.deleteMany({
        where: { scheduleId: { in: chunk } },
      }),
    );
    await tx.reportSchedule.deleteMany({ where: { projectId } });
  }

  const meetingIds = (
    await tx.meeting.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (meetingIds.length > 0) {
    const momIds: string[] = [];
    for (const chunk of chunkIds(meetingIds)) {
      const rows = await tx.momDocument.findMany({
        where: { meetingId: { in: chunk } },
        select: { id: true },
      });
      momIds.push(...rows.map((r) => r.id));
    }

    if (momIds.length > 0) {
      await deleteManyByIdIn(momIds, (chunk) =>
        tx.momAcknowledgement.deleteMany({ where: { momId: { in: chunk } } }),
      );
      await deleteManyByIdIn(momIds, (chunk) =>
        tx.momDocument.deleteMany({ where: { id: { in: chunk } } }),
      );
    }

    await deleteManyByIdIn(meetingIds, (chunk) =>
      tx.meetingAttendee.deleteMany({ where: { meetingId: { in: chunk } } }),
    );
    await deleteManyByIdIn(meetingIds, (chunk) =>
      tx.meetingItem.deleteMany({ where: { meetingId: { in: chunk } } }),
    );
    await tx.meeting.deleteMany({ where: { projectId } });
  }

  await tx.externalAccessGrant.deleteMany({ where: { projectId } });

  const threadIds = (
    await tx.workspaceThread.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (threadIds.length > 0) {
    await deleteManyByIdIn(threadIds, (chunk) =>
      tx.workspaceThreadPost.deleteMany({ where: { threadId: { in: chunk } } }),
    );
    await tx.workspaceThread.deleteMany({ where: { projectId } });
  }

  await tx.workspaceDocument.deleteMany({ where: { projectId } });
  await tx.projectCharter.deleteMany({ where: { projectId } });
  await tx.sowDocument.deleteMany({ where: { projectId } });

  const checklist = await tx.closureChecklist.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (checklist) {
    await tx.checklistItem.deleteMany({ where: { checklistId: checklist.id } });
    await tx.closureChecklist.delete({ where: { projectId } });
  }

  const ticketIds = (
    await tx.slaTicket.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (ticketIds.length > 0) {
    await deleteManyByIdIn(ticketIds, (chunk) =>
      tx.ticketTimerEvent.deleteMany({ where: { ticketId: { in: chunk } } }),
    );
    await deleteManyByIdIn(ticketIds, (chunk) =>
      tx.ticketCustomerUpdate.deleteMany({ where: { ticketId: { in: chunk } } }),
    );
    await tx.slaTicket.deleteMany({ where: { projectId } });
  }

  await tx.projectVendor.deleteMany({ where: { projectId } });
  await tx.project.delete({ where: { id: projectId } });
}
