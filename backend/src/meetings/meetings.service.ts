import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PriorityLevel } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogsService } from '../audit/audit-logs.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { PrismaService } from '../database/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { buildMomDocx } from '../reports/templates/cybersec-sample-docx';
import {
  buildMomPdf,
  type MomSnapshot,
} from '../reports/templates/cybersec-sample-pdf';

export type MeetingInput = {
  title: string;
  scheduledAt: string | Date;
  teamsMeetingId?: string | null;
  teamsJoinUrl?: string | null;
  status?: string;
  attendeeIds?: string[];
  items?: Array<{
    itemType: 'Agenda' | 'Decision' | 'Action';
    content: string;
    ownerId?: string;
  }>;
};

const meetingInclude = {
  organiser: { select: { id: true, displayName: true, email: true } },
  attendees: {
    include: { user: { select: { id: true, displayName: true, email: true } } },
  },
  items: {
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recordScopeWhere: RecordScopeWhereService,
    private readonly mailer: MailerService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(projectId: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    return this.prisma.meeting.findMany({
      where: { projectId },
      include: meetingInclude,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async get(projectId: string, id: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, projectId },
      include: meetingInclude,
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async create(
    projectId: string,
    input: MeetingInput,
    organiserId: string,
    user: CaslUserContext,
  ) {
    await this.assertProject(projectId, user, 'update');
    const meeting = await this.prisma.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          projectId,
          title: input.title,
          scheduledAt: new Date(input.scheduledAt),
          teamsMeetingId: input.teamsMeetingId,
          teamsJoinUrl: input.teamsJoinUrl,
          organiserId,
          status: input.status ?? 'Scheduled',
          attendees: {
            create: [...new Set(input.attendeeIds ?? [])].map((userId) => ({
              userId,
            })),
          },
          items: {
            create: (input.items ?? []).map((item) => ({
              itemType: item.itemType,
              content: item.content,
              ownerId: item.ownerId,
            })),
          },
        },
        include: meetingInclude,
      });
      await this.createActionPoints(tx, projectId, created.id);
      return created;
    });
    return this.get(projectId, meeting.id, user);
  }

  async update(
    projectId: string,
    id: string,
    input: Partial<MeetingInput>,
    user: CaslUserContext,
  ) {
    await this.get(projectId, id, user);
    await this.assertProject(projectId, user, 'update');
    await this.prisma.$transaction(async (tx) => {
      if (input.attendeeIds) {
        await tx.meetingAttendee.deleteMany({ where: { meetingId: id } });
      }
      if (input.items) {
        await tx.actionPoint.deleteMany({
          where: { sourceType: 'Meeting', sourceId: id },
        });
        await tx.meetingItem.deleteMany({ where: { meetingId: id } });
      }
      await tx.meeting.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.scheduledAt !== undefined
            ? { scheduledAt: new Date(input.scheduledAt) }
            : {}),
          ...(input.teamsMeetingId !== undefined
            ? { teamsMeetingId: input.teamsMeetingId }
            : {}),
          ...(input.teamsJoinUrl !== undefined
            ? { teamsJoinUrl: input.teamsJoinUrl }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.attendeeIds
            ? {
                attendees: {
                  create: [...new Set(input.attendeeIds)].map((userId) => ({
                    userId,
                  })),
                },
              }
            : {}),
          ...(input.items
            ? {
                items: {
                  create: input.items.map((item) => ({
                    itemType: item.itemType,
                    content: item.content,
                    ownerId: item.ownerId,
                  })),
                },
              }
            : {}),
        },
      });
      if (input.items) await this.createActionPoints(tx, projectId, id);
    });
    return this.get(projectId, id, user);
  }

  async remove(projectId: string, id: string, user: CaslUserContext) {
    await this.get(projectId, id, user);
    await this.assertProject(projectId, user, 'update');
    await this.prisma.$transaction([
      this.prisma.actionPoint.deleteMany({
        where: { sourceType: 'Meeting', sourceId: id },
      }),
      this.prisma.momAcknowledgement.deleteMany({
        where: { mom: { meetingId: id } },
      }),
      this.prisma.momDocument.deleteMany({ where: { meetingId: id } }),
      this.prisma.meetingItem.deleteMany({ where: { meetingId: id } }),
      this.prisma.meetingAttendee.deleteMany({ where: { meetingId: id } }),
      this.prisma.meeting.delete({ where: { id } }),
    ]);
  }

  async generateMom(
    projectId: string,
    meetingId: string,
    user: CaslUserContext,
  ) {
    const meeting = await this.get(projectId, meetingId, user);
    await this.assertProject(projectId, user, 'update');
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    const previous = await this.prisma.momDocument.findFirst({
      where: { meetingId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (previous?.version ?? 0) + 1;
    return this.prisma.momDocument.create({
      data: {
        meetingId,
        version,
        contentJson: {
          title: meeting.title,
          scheduledAt: meeting.scheduledAt.toISOString(),
          projectName: project?.name,
          organiser: meeting.organiser,
          attendees: meeting.attendees.map((entry) => entry.user),
          agenda: meeting.items.filter((item) => item.itemType === 'Agenda'),
          decisions: meeting.items.filter(
            (item) => item.itemType === 'Decision',
          ),
          actions: meeting.items.filter((item) => item.itemType === 'Action'),
          version,
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
      include: { acknowledgements: true },
    });
  }

  async exportMomPdf(projectId: string, momId: string, user: CaslUserContext) {
    const mom = await this.getMom(projectId, momId, user);
    const buffer = await buildMomPdf(this.asMomSnapshot(mom));
    return buffer;
  }

  async exportMomDocx(projectId: string, momId: string, user: CaslUserContext) {
    const mom = await this.getMom(projectId, momId, user);
    const buffer = await buildMomDocx(this.asMomSnapshot(mom));
    return buffer;
  }

  private asMomSnapshot(mom: {
    version: number;
    contentJson: Prisma.JsonValue | null;
    meeting?: { title?: string; scheduledAt?: Date } | null;
  }): MomSnapshot {
    const raw = (mom.contentJson ?? {}) as Partial<MomSnapshot>;
    return {
      title: raw.title ?? mom.meeting?.title ?? 'Meeting',
      scheduledAt:
        raw.scheduledAt ??
        mom.meeting?.scheduledAt?.toISOString() ??
        new Date().toISOString(),
      projectName: raw.projectName,
      organiser: raw.organiser,
      attendees: raw.attendees ?? [],
      agenda: raw.agenda ?? [],
      decisions: raw.decisions ?? [],
      actions: raw.actions ?? [],
      version: raw.version ?? mom.version,
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
    };
  }

  async reviewMom(
    projectId: string,
    momId: string,
    userId: string,
    user: CaslUserContext,
  ) {
    await this.getMom(projectId, momId, user);
    await this.assertProject(projectId, user, 'update');
    return this.prisma.momDocument.update({
      where: { id: momId },
      data: { status: 'Reviewed', reviewedBy: userId, reviewedAt: new Date() },
    });
  }

  async distributeMom(
    projectId: string,
    momId: string,
    userId: string,
    user: CaslUserContext,
  ) {
    const mom = await this.getMom(projectId, momId, user);
    await this.assertProject(projectId, user, 'update');
    if (mom.status !== 'Reviewed') {
      throw new BadRequestException('MoM must be reviewed before distribution');
    }
    const attendees = mom.meeting.attendees.map((entry) => entry.user);
    const recipients = [
      ...new Set(
        attendees
          .map((attendee) => attendee.email)
          .filter((email): email is string => Boolean(email)),
      ),
    ];
    if (recipients.length === 0) {
      throw new BadRequestException('MoM has no attendees to notify');
    }
    await this.mailer.sendMail({
      to: recipients,
      subject: `Minutes of Meeting: ${mom.meeting.title}`,
      html: '<p>The minutes of your meeting are available. Please review and acknowledge them in the PMO application.</p>',
      templatePath: '',
      context: {},
    });
    const distributed = await this.prisma.$transaction(async (tx) => {
      for (const attendee of attendees) {
        await tx.momAcknowledgement.upsert({
          where: {
            momId_attendeeId: { momId, attendeeId: attendee.id },
          },
          update: { acknowledged: false, ackedAt: null },
          create: {
            momId,
            attendeeId: attendee.id,
            acknowledged: false,
          },
        });
      }
      return tx.momDocument.update({
        where: { id: momId },
        data: { status: 'Distributed' },
        include: { acknowledgements: true },
      });
    });
    await this.auditLogs.create({
      action: 'MOM_DISTRIBUTED',
      objectType: 'MomDocument',
      objectId: momId,
      newValue: { recipients, projectId },
      user: { connect: { id: userId } },
    });
    return distributed;
  }

  async acknowledgeMom(
    projectId: string,
    momId: string,
    userId: string,
    user: CaslUserContext,
  ) {
    await this.getMom(projectId, momId, user);
    return this.prisma.momAcknowledgement.upsert({
      where: { momId_attendeeId: { momId, attendeeId: userId } },
      update: { acknowledged: true, ackedAt: new Date() },
      create: {
        momId,
        attendeeId: userId,
        acknowledged: true,
        ackedAt: new Date(),
      },
    });
  }

  async listMoms(projectId: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    return this.prisma.momDocument.findMany({
      where: { meeting: { projectId } },
      include: {
        meeting: { select: { id: true, title: true, scheduledAt: true } },
        acknowledgements: {
          include: {
            attendee: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMom(projectId: string, momId: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    const mom = await this.prisma.momDocument.findFirst({
      where: { id: momId, meeting: { projectId } },
      include: {
        meeting: { include: meetingInclude },
        acknowledgements: {
          include: {
            attendee: { select: { id: true, displayName: true, email: true } },
          },
        },
      },
    });
    if (!mom) throw new NotFoundException('MoM document not found');
    return mom;
  }

  async removeMom(projectId: string, momId: string, user: CaslUserContext) {
    const mom = await this.getMom(projectId, momId, user);
    await this.assertProject(projectId, user, 'update');
    await this.prisma.$transaction([
      this.prisma.momAcknowledgement.deleteMany({ where: { momId } }),
      this.prisma.momDocument.delete({ where: { id: momId } }),
    ]);
    await Promise.allSettled(
      [mom.s3PdfKey, mom.s3DocxKey, mom.s3Key]
        .filter((key): key is string => Boolean(key))
        .map((key) => fs.unlink(path.resolve(process.cwd(), key))),
    );
  }

  private async createActionPoints(
    tx: Prisma.TransactionClient,
    projectId: string,
    meetingId: string,
  ) {
    const [project, items] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: { endDate: true },
      }),
      tx.meetingItem.findMany({
        where: { meetingId, itemType: 'Action', ownerId: { not: null } },
      }),
    ]);
    if (!project) return;
    for (const item of items) {
      await tx.actionPoint.create({
        data: {
          sourceType: 'Meeting',
          sourceId: meetingId,
          projectId,
          ownerId: item.ownerId!,
          title: item.content.slice(0, 255),
          dueDate: project.endDate,
          priority: PriorityLevel.Medium,
          status: 'Open',
        },
      });
    }
  }

  private async assertProject(
    projectId: string,
    user: CaslUserContext,
    action: 'read' | 'update',
  ) {
    const scope = this.recordScopeWhere.projectWhere(user, action);
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id: projectId }, scope] },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException('Project not found or inaccessible');
  }
}
