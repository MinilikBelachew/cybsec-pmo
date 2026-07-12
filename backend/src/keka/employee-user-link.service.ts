import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EmployeeUserLinkService {
  private readonly logger = new Logger(EmployeeUserLinkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Links an employee row to the authenticated user when emails match.
   * Skips when another user is already linked or this user is linked elsewhere.
   */
  async linkUserToEmployeeByEmail(userId: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, userId: true, email: true },
    });

    if (!employee) {
      return;
    }

    if (employee.userId === userId) {
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
      select: { id: true, email: true },
    });

    if (employeeForUser && employeeForUser.id !== employee.id) {
      this.logger.warn(
        `Skipped employee link for user ${userId}: user already linked to employee ${employeeForUser.email}`,
      );
      return;
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { userId },
    });

    this.logger.log(`Linked user ${userId} to employee ${employee.id} (${normalizedEmail})`);
  }
}
