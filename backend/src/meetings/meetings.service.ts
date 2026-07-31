import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PriorityLevel } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AuditLogsService } from '../audit/audit-logs.service';
import { BrandingService } from '../branding/branding.service';
import { CaslUserContext } from '../casl/casl.types';
import { RecordScopeWhereService } from '../casl/record-scope-where.service';
import { AllConfigType } from '../config/config.type';
import { PrismaService } from '../database/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { NOTIFICATION_EVENT_TYPE } from '../notifications/notifications.constants';
import { NotificationsService } from '../notifications/notifications.service';
import {
  APPROVED_REPORT_RULES,
  addWorkingDays,
} from '../reports/templates/approved-report.rules';
import { buildMomDocx } from '../reports/templates/cybersec-format-docx';
import { buildMomPdf } from '../reports/templates/cybersec-format-pdf';
import {
  buildDocumentReference,
  buildExportFileName,
  deriveProjectRef,
  formatSignatory,
} from '../reports/templates/cybersec-format.constants';
import type {
  MomAttendeeRow,
  MomSnapshot,
} from '../reports/templates/cybersec-format.types';
import { RoleEnum } from '../roles/roles.enum';

export type MeetingInput = {
  title: string;
  meetingType?: string | null;
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

const attendeeSelect = {
  id: true,
  displayName: true,
  email: true,
  role: { select: { code: true, label: true } },
} as const;

const meetingInclude = {
  organiser: { select: attendeeSelect },
  attendees: {
    include: { user: { select: attendeeSelect } },
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
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly branding: BrandingService,
  ) {}

  async list(projectId: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    // Engineers only receive distributed MoMs they attended — not the meeting list.
    if (this.isEngineerAttendeeViewer(user)) return [];
    return this.prisma.meeting.findMany({
      where: { projectId },
      include: meetingInclude,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async get(projectId: string, id: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    if (this.isEngineerAttendeeViewer(user)) {
      throw new NotFoundException('Meeting not found');
    }
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
          meetingType: input.meetingType ?? null,
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
          ...(input.meetingType !== undefined
            ? { meetingType: input.meetingType }
            : {}),
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
    const [project, previous, actionPoints] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          kekaProjectCode: true,
          customer: { select: { displayName: true, companyName: true } },
        },
      }),
      this.prisma.momDocument.findFirst({
        where: { meetingId },
        orderBy: { version: 'desc' },
        select: { version: true },
      }),
      this.prisma.actionPoint.findMany({
        where: { sourceType: 'Meeting', sourceId: meetingId },
        orderBy: { createdAt: 'asc' },
        select: { title: true, dueDate: true, status: true, ownerId: true },
      }),
    ]);

    const version = (previous?.version ?? 0) + 1;
    const now = new Date();
    const brand = await this.branding.resolveForProject(projectId);
    const customerName =
      project?.customer?.companyName ?? project?.customer?.displayName ?? null;

    const partyOf = (roleCode?: string | null) => {
      if (roleCode === RoleEnum.client) return 'Customer';
      if (roleCode === RoleEnum.vendor) return 'Vendor';
      return 'Internal';
    };
    const organisationOf = (roleCode?: string | null) => {
      const party = partyOf(roleCode);
      if (party === 'Customer') return customerName;
      if (party === 'Vendor') return null;
      return brand.companyName;
    };

    const attendees: MomAttendeeRow[] = meeting.attendees.map((entry) => ({
      name: entry.user.displayName,
      email: entry.user.email,
      organisation: organisationOf(entry.user.role?.code),
      party: partyOf(entry.user.role?.code),
      // Teams attendance is not ingested, so presence stays unrecorded.
      attended: null,
    }));

    const keyPoints = meeting.items
      .filter((item) => item.itemType === 'Agenda')
      .map((item) => item.content);
    const decisions = meeting.items
      .filter((item) => item.itemType === 'Decision')
      .map((item) => item.content);

    const actionItems = meeting.items.filter(
      (item) => item.itemType === 'Action',
    );
    const registered = new Map(
      actionPoints.map((action) => [action.title, action]),
    );
    const fallbackDue = addWorkingDays(
      now,
      APPROVED_REPORT_RULES.defaultActionDueWorkingDays,
    );

    const snapshot: MomSnapshot = {
      docType: 'MoM',
      title: meeting.title,
      meetingType: meeting.meetingType,
      projectName: project?.name ?? 'Project',
      organisation: customerName,
      scheduledAt: meeting.scheduledAt.toISOString(),
      timeZone: 'UTC',
      version,
      generatedAt: now.toISOString(),
      brand,
      control: {
        documentRef: buildDocumentReference({
          projectRef: deriveProjectRef({
            externalCode: project?.kekaProjectCode,
            projectId,
          }),
          docType: 'MoM',
          date: meeting.scheduledAt,
          version,
        }),
        version,
        projectName: project?.name ?? 'Project',
        customer: customerName,
        deliveredBy: brand.companyName,
        reportPeriod: null,
        dateIssued: now.toISOString(),
        preparedBy: formatSignatory(
          meeting.organiser.displayName,
          meeting.organiser.role?.label,
        ),
        reviewedBy: null,
      },
      organiser: {
        name: meeting.organiser.displayName,
        email: meeting.organiser.email,
        organisation: organisationOf(meeting.organiser.role?.code),
      },
      attendees,
      keyPoints,
      decisions,
      actions: actionItems.map((item, index) => {
        const action = registered.get(item.content.slice(0, 255));
        return {
          reference: `A${String(index + 1).padStart(2, '0')}`,
          action: item.content,
          owner: item.owner?.displayName ?? null,
          dueDate: (action?.dueDate ?? fallbackDue).toISOString(),
          status: action?.status ?? 'Open',
        };
      }),
    };

    return this.prisma.momDocument.create({
      data: {
        meetingId,
        version,
        contentJson: snapshot as unknown as Prisma.InputJsonValue,
      },
      include: { acknowledgements: true },
    });
  }

  async exportMomPdf(projectId: string, momId: string, user: CaslUserContext) {
    const mom = await this.getMom(projectId, momId, user);
    return buildMomPdf(await this.asMomSnapshot(projectId, mom));
  }

  async exportMomDocx(projectId: string, momId: string, user: CaslUserContext) {
    const mom = await this.getMom(projectId, momId, user);
    return buildMomDocx(await this.asMomSnapshot(projectId, mom));
  }

  /** ProjectRef_CustomerName_ProjectName_MoM_Date_vN */
  async momExportFileName(
    projectId: string,
    momId: string,
    extension: string,
  ) {
    const [mom, project] = await Promise.all([
      this.prisma.momDocument.findUnique({
        where: { id: momId },
        select: { version: true, meeting: { select: { scheduledAt: true } } },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          kekaProjectCode: true,
          customer: { select: { displayName: true, companyName: true } },
        },
      }),
    ]);
    if (!mom) throw new NotFoundException('MoM document not found');
    return buildExportFileName({
      projectRef: deriveProjectRef({
        externalCode: project?.kekaProjectCode,
        projectId,
      }),
      customerName:
        project?.customer?.companyName ?? project?.customer?.displayName ?? null,
      projectName: project?.name ?? null,
      docType: 'MoM',
      date: mom.meeting.scheduledAt,
      version: mom.version,
      extension,
    });
  }

  private async asMomSnapshot(
    projectId: string,
    mom: {
      version: number;
      contentJson: Prisma.JsonValue | null;
      meeting?: { title?: string; scheduledAt?: Date } | null;
    },
  ): Promise<MomSnapshot> {
    const raw = (mom.contentJson ?? {}) as Partial<MomSnapshot>;
    const brand = await this.branding.resolveForProject(projectId);
    const title = raw.title ?? mom.meeting?.title ?? 'Meeting';
    const projectName = raw.projectName ?? 'Project';
    const scheduledAt =
      raw.scheduledAt ??
      mom.meeting?.scheduledAt?.toISOString() ??
      new Date().toISOString();
    const version = raw.version ?? mom.version;

    return {
      docType: 'MoM',
      title,
      meetingType: raw.meetingType ?? null,
      projectName,
      organisation: raw.organisation ?? null,
      scheduledAt,
      timeZone: raw.timeZone ?? 'UTC',
      version,
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
      brand,
      control:
        raw.control ??
        ({
          documentRef: buildDocumentReference({
            docType: 'MoM',
            date: scheduledAt,
            version,
          }),
          version,
          projectName,
          customer: raw.organisation ?? null,
          deliveredBy: brand.companyName,
          reportPeriod: null,
          dateIssued: scheduledAt,
          preparedBy: raw.organiser?.name ?? null,
          reviewedBy: null,
        } satisfies MomSnapshot['control']),
      organiser: raw.organiser ?? null,
      attendees: Array.isArray(raw.attendees) ? raw.attendees : [],
      ...this.momDiscussion(mom.contentJson),
      actions: Array.isArray(raw.actions) ? raw.actions : [],
    };
  }

  /**
   * Reads the discussion and decision lists across every shape a stored MoM
   * has taken: plain string arrays now, tagged key points before that, and
   * `{ content }` agenda/decision rows in the original snapshot.
   */
  private momDiscussion(contentJson: Prisma.JsonValue | null): {
    keyPoints: string[];
    decisions: string[];
  } {
    const raw = (contentJson ?? {}) as Record<string, unknown>;
    const asText = (value: unknown): string | null => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') {
        const row = value as Record<string, unknown>;
        const text = row.text ?? row.content;
        if (typeof text === 'string') return text;
      }
      return null;
    };
    const list = (value: unknown): string[] =>
      Array.isArray(value)
        ? value
            .map(asText)
            .filter((text): text is string => Boolean(text?.trim()))
        : [];

    const keyPoints = list(raw.keyPoints);
    const decisions = list(raw.decisions);

    // Tagged key points kept decisions inline; pull them back into their own list.
    const tagged = Array.isArray(raw.keyPoints)
      ? (raw.keyPoints as Array<Record<string, unknown>>)
      : [];
    const inlineDecisions = tagged
      .filter((point) => point?.kind === 'agreed')
      .map((point) => asText(point))
      .filter((text): text is string => Boolean(text));

    if (inlineDecisions.length > 0) {
      return {
        keyPoints: keyPoints.filter(
          (text) => !inlineDecisions.includes(text),
        ),
        decisions: decisions.length ? decisions : inlineDecisions,
      };
    }

    return {
      keyPoints: keyPoints.length ? keyPoints : list(raw.agenda),
      decisions,
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

    const pdf = await buildMomPdf(await this.asMomSnapshot(projectId, mom));
    const filename = await this.momExportFileName(projectId, momId, 'pdf');
    const momPagePath = `/dashboard/projects/${projectId}?view=meetings`;
    const frontendDomain =
      this.configService.get('app.frontendDomain', { infer: true }) ??
      'http://localhost:3000';
    const momPageUrl = `${frontendDomain.replace(/\/$/, '')}${momPagePath}`;

    await this.mailer.sendMail({
      to: recipients,
      subject: `Minutes of Meeting: ${mom.meeting.title}`,
      html: `
        <p>The minutes of your meeting are attached.</p>
        <p>Please review and acknowledge them in the PMO application:</p>
        <p><a href="${momPageUrl}">Open Minutes of Meeting</a></p>
      `,
      attachments: [
        {
          filename,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
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
        include: {
          acknowledgements: {
            include: {
              attendee: {
                select: { id: true, displayName: true, email: true },
              },
            },
          },
        },
      });
    });

    await this.notifications.notify({
      eventType: NOTIFICATION_EVENT_TYPE.MOM_ACKNOWLEDGE_REQUIRED,
      recipientUserIds: attendees.map((attendee) => attendee.id),
      title: 'Acknowledge minutes of meeting',
      body: `"${mom.meeting.title}" (v${mom.version}) has been distributed. Please acknowledge the minutes.`,
      payload: {
        projectId,
        momId,
        meetingId: mom.meetingId,
        meetingTitle: mom.meeting.title,
        link: momPagePath,
      },
      sourceObjectType: 'MomDocument',
      sourceObjectId: momId,
      actorId: userId,
      inAppOnly: true,
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
    const mom = await this.getMom(projectId, momId, user);
    if (mom.status !== 'Distributed') {
      throw new BadRequestException('Only distributed MoMs can be acknowledged');
    }
    // Recipients are fixed at distribute time via MomAcknowledgement rows.
    const existing = await this.prisma.momAcknowledgement.findUnique({
      where: { momId_attendeeId: { momId, attendeeId: userId } },
    });
    if (!existing) {
      throw new BadRequestException(
        'Only recipients of this MoM can acknowledge it',
      );
    }
    return this.prisma.momAcknowledgement.update({
      where: { id: existing.id },
      data: { acknowledged: true, ackedAt: new Date() },
    });
  }

  async listMoms(projectId: string, user: CaslUserContext) {
    await this.assertProject(projectId, user, 'read');
    return this.prisma.momDocument.findMany({
      where: {
        meeting: { projectId },
        ...this.engineerDistributedMomWhere(user),
      },
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
      where: {
        id: momId,
        meeting: { projectId },
        ...this.engineerDistributedMomWhere(user),
      },
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

  /**
   * Meeting actions land in the project register so they reach the status report
   * without being typed twice. The due date defaults to five working days out,
   * weekends and public holidays excluded, and never past the project end date.
   */
  private async createActionPoints(
    tx: Prisma.TransactionClient,
    projectId: string,
    meetingId: string,
  ) {
    const [project, meeting, items, holidays] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: { endDate: true },
      }),
      tx.meeting.findUnique({
        where: { id: meetingId },
        select: { scheduledAt: true },
      }),
      tx.meetingItem.findMany({
        where: { meetingId, itemType: 'Action', ownerId: { not: null } },
      }),
      tx.holiday.findMany({
        where: { holidayDate: { gte: new Date() } },
        select: { holidayDate: true },
      }),
    ]);
    if (!project) return;

    const dueDate = addWorkingDays(
      meeting?.scheduledAt ?? new Date(),
      APPROVED_REPORT_RULES.defaultActionDueWorkingDays,
      holidays.map((holiday) => holiday.holidayDate),
    );

    for (const item of items) {
      await tx.actionPoint.create({
        data: {
          sourceType: 'Meeting',
          sourceId: meetingId,
          projectId,
          ownerId: item.ownerId!,
          title: item.content.slice(0, 255),
          dueDate,
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

  /** Engineers may only see distributed MoMs they were sent (ack row at distribute). */
  private isEngineerAttendeeViewer(user: CaslUserContext) {
    return user.roleCode === RoleEnum.engineer;
  }

  private engineerDistributedMomWhere(user: CaslUserContext) {
    if (!this.isEngineerAttendeeViewer(user)) return {};
    return {
      status: 'Distributed' as const,
      acknowledgements: { some: { attendeeId: user.id } },
    };
  }
}
