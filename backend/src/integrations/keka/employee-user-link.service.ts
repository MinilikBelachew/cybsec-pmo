import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EmployeeUserLinkService {
  private readonly logger = new Logger(EmployeeUserLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Links an employee row to the authenticated user when emails match.
   * Prefers the Keka employee name on the user after link (or when already linked).
   * Skips when another user is already linked or this user is linked elsewhere.
   */
  async linkUserToEmployeeByEmail(userId: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      await this.syncDisplayNameForLinkedUser(userId);
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        displayName: true,
      },
    });

    if (!employee) {
      await this.syncDisplayNameForLinkedUser(userId);
      return;
    }

    if (employee.userId === userId) {
      await this.applyKekaNameToUser(userId, employee);
      return;
    }

    if (employee.userId) {
      this.logger.warn(
        `Skipped employee link for ${normalizedEmail}: employee already linked to another user`,
      );
      return;
    }

    const employeeForUser = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true, email: true, name: true, displayName: true },
    });

    if (employeeForUser && employeeForUser.id !== employee.id) {
      this.logger.warn(
        `Skipped employee link for user ${userId}: user already linked to employee ${employeeForUser.email}`,
      );
      await this.applyKekaNameToUser(userId, employeeForUser);
      return;
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { userId },
    });

    await this.applyKekaNameToUser(userId, employee);

    this.logger.log(
      `Linked user ${userId} to employee ${employee.id} (${normalizedEmail})`,
    );
  }

  /** Prefer Keka employee name on the linked user profile. */
  async syncDisplayNameForLinkedUser(userId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      select: { id: true, name: true, displayName: true },
    });
    if (!employee) {
      return;
    }
    await this.applyKekaNameToUser(userId, employee);
  }

  private async applyKekaNameToUser(
    userId: string,
    employee: { name: string; displayName: string | null },
  ): Promise<void> {
    const preferred =
      employee.displayName?.trim() || employee.name?.trim() || null;
    if (!preferred) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    if (!user || user.displayName === preferred) {
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: preferred },
    });

    this.logger.log(
      `Updated user ${userId} displayName from Keka employee name to "${preferred}"`,
    );
  }
}
