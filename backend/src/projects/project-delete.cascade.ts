import { Prisma } from '@prisma/client';

/** Deletes a project and all dependent rows in FK-safe order (no DB migration required). */
export async function deleteProjectWithDependents(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  const taskIds = (
    await tx.task.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (taskIds.length > 0) {
    await tx.taskDependency.deleteMany({
      where: {
        OR: [
          { predecessorId: { in: taskIds } },
          { successorId: { in: taskIds } },
        ],
      },
    });
    await tx.taskComment.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskChecklistItem.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.workspaceDocument.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskProgressUpdate.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.timesheet.deleteMany({
      where: {
        OR: [{ projectId }, { taskId: { in: taskIds } }],
      },
    });
    await tx.task.deleteMany({ where: { projectId } });
  } else {
    await tx.timesheet.deleteMany({ where: { projectId } });
  }

  await tx.invoice.deleteMany({ where: { projectId } });
  await tx.projectMilestone.deleteMany({ where: { projectId } });
  await tx.projectPhase.deleteMany({ where: { projectId } });
  await tx.allocation.deleteMany({ where: { projectId } });
  await tx.projectDomain.deleteMany({ where: { projectId } });
  await tx.projectBudget.deleteMany({ where: { projectId } });
  await tx.employeeCost.deleteMany({ where: { projectId } });
  await tx.risk.deleteMany({ where: { projectId } });
  await tx.issue.deleteMany({ where: { projectId } });
  await tx.customerEscalation.deleteMany({ where: { projectId } });
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
    await tx.reportScheduleRecipient.deleteMany({
      where: { scheduleId: { in: scheduleIds } },
    });
    await tx.reportSchedule.deleteMany({ where: { projectId } });
  }

  const meetingIds = (
    await tx.meeting.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((row) => row.id);

  if (meetingIds.length > 0) {
    const momIds = (
      await tx.momDocument.findMany({
        where: { meetingId: { in: meetingIds } },
        select: { id: true },
      })
    ).map((row) => row.id);

    if (momIds.length > 0) {
      await tx.momAcknowledgement.deleteMany({ where: { momId: { in: momIds } } });
      await tx.momDocument.deleteMany({ where: { id: { in: momIds } } });
    }

    await tx.meetingAttendee.deleteMany({ where: { meetingId: { in: meetingIds } } });
    await tx.meetingItem.deleteMany({ where: { meetingId: { in: meetingIds } } });
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
    await tx.workspaceThreadPost.deleteMany({ where: { threadId: { in: threadIds } } });
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
    await tx.ticketTimerEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.ticketCustomerUpdate.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await tx.slaTicket.deleteMany({ where: { projectId } });
  }

  await tx.projectVendor.deleteMany({ where: { projectId } });
  await tx.project.delete({ where: { id: projectId } });
}
