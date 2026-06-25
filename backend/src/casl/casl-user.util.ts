import { PrismaService } from '../database/prisma.service';
import { CaslUserContext } from './casl.types';
import { RequestWithAbility } from './casl.guard';

export async function resolveCaslUser(
  prisma: PrismaService,
  request: RequestWithAbility,
): Promise<CaslUserContext> {
  const jwtUser = request.user;
  if (!jwtUser?.id) {
    throw new Error('Missing authenticated user');
  }

  const roleId = jwtUser.roleId ?? jwtUser.role?.id;
  const roleCode = jwtUser.roleCode ?? jwtUser.role?.code;

  if (!roleId || !roleCode) {
    const user = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      include: {
        role: true,
        employees: { select: { departmentId: true } },
      },
    });

    if (!user?.role) {
      throw new Error('User role not found');
    }

    return {
      id: user.id,
      roleId: user.roleId,
      roleCode: user.role.code,
      departmentId: user.employees?.departmentId ?? null,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: jwtUser.id },
    select: { departmentId: true },
  });

  return {
    id: jwtUser.id,
    roleId,
    roleCode,
    departmentId: employee?.departmentId ?? null,
  };
}
