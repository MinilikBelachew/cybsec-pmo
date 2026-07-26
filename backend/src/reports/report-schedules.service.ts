import { InjectQueue } from '@nestjs/bull';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bull';
import { CronTime } from 'cron';
import { PrismaService } from '../database/prisma.service';
import {
  GENERATE_SCHEDULED_REPORT_JOB,
  REPORTS_QUEUE,
} from './reports.constants';

export type ReportScheduleInput = {
  reportType: 'WSR' | 'MSR';
  cronExpression: string;
  projectId?: string | null;
  isActive?: boolean;
  recipients?: Array<{ roleId?: number; contactId?: string }>;
};

@Injectable()
export class ReportSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  list() {
    return this.prisma.reportSchedule.findMany({
      include: {
        project: { select: { id: true, name: true } },
        recipients: {
          include: {
            role: { select: { id: true, code: true, label: true } },
            contact: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!schedule) throw new NotFoundException('Report schedule not found');
    return schedule;
  }

  create(input: ReportScheduleInput, userId: string) {
    return this.prisma.reportSchedule.create({
      data: {
        reportType: input.reportType,
        cronExpression: input.cronExpression,
        projectId: input.projectId ?? null,
        isActive: input.isActive ?? true,
        createdBy: userId,
        nextRun: this.nextOccurrence(input.cronExpression),
        recipients: {
          create: (input.recipients ?? []).map((recipient) => ({
            roleId: recipient.roleId,
            contactId: recipient.contactId,
          })),
        },
      },
      include: { recipients: true },
    });
  }

  async update(id: string, input: Partial<ReportScheduleInput>) {
    await this.get(id);
    return this.prisma.$transaction(async (tx) => {
      if (input.recipients) {
        await tx.reportScheduleRecipient.deleteMany({
          where: { scheduleId: id },
        });
      }
      return tx.reportSchedule.update({
        where: { id },
        data: {
          ...(input.reportType ? { reportType: input.reportType } : {}),
          ...(input.cronExpression
            ? {
                cronExpression: input.cronExpression,
                nextRun: this.nextOccurrence(input.cronExpression),
              }
            : {}),
          ...(input.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.recipients
            ? {
                recipients: {
                  create: input.recipients.map((recipient) => ({
                    roleId: recipient.roleId,
                    contactId: recipient.contactId,
                  })),
                },
              }
            : {}),
        },
        include: { recipients: true },
      });
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.reportScheduleRecipient.deleteMany({
      where: { scheduleId: id },
    });
    return this.prisma.reportSchedule.delete({ where: { id } });
  }

  @Cron('*/15 * * * *')
  async runDueSchedules() {
    const due = await this.prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        OR: [{ nextRun: null }, { nextRun: { lte: new Date() } }],
      },
      select: { id: true, cronExpression: true },
    });
    for (const schedule of due) {
      await this.queue.add(
        GENERATE_SCHEDULED_REPORT_JOB,
        { scheduleId: schedule.id },
        { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
      );
      await this.prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { nextRun: this.nextOccurrence(schedule.cronExpression) },
      });
    }
  }

  private nextOccurrence(expression: string): Date {
    return new CronTime(expression).sendAt().toJSDate();
  }
}
