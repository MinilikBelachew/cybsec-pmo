import {
  BillingModel,
  EngagementType,
  PriorityLevel,
  ProjectStatus,
  type Project,
  type Department,
  type Customer,
  type User,
} from '@prisma/client';
import {
  ApiBillingModel,
  ApiEngagementType,
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../enums/project-api.enum';
import { AppAbility } from '../../casl/casl.types';
import type { PermissionRow } from '../../casl/casl.types';
import { hasModulePermission } from '../../casl/module-permission.util';

export type ProjectWithRelations = Project & {
  department?: Department;
  customer?: Customer;
  primaryPm?: Pick<User, 'id' | 'displayName' | 'email'>;
  secondaryPm?: Pick<User, 'id' | 'displayName' | 'email'> | null;
};

const ENGAGEMENT_TO_PRISMA: Record<ApiEngagementType, EngagementType> = {
  [ApiEngagementType.ManagedServices]: EngagementType.Managed_Service,
  [ApiEngagementType.StaffAugmentation]: EngagementType.Staff_Augmentation,
  [ApiEngagementType.FixedPrice]: EngagementType.Implementation,
};

const ENGAGEMENT_FROM_PRISMA: Partial<Record<EngagementType, ApiEngagementType>> = {
  [EngagementType.Managed_Service]: ApiEngagementType.ManagedServices,
  [EngagementType.Staff_Augmentation]: ApiEngagementType.StaffAugmentation,
  [EngagementType.Implementation]: ApiEngagementType.FixedPrice,
};

const BILLING_TO_PRISMA: Record<ApiBillingModel, BillingModel> = {
  [ApiBillingModel.TimeAndMaterial]: BillingModel.Time_and_Materials,
  [ApiBillingModel.FixedPrice]: BillingModel.Fixed_Price,
  [ApiBillingModel.Retainer]: BillingModel.Retainer,
};

const BILLING_FROM_PRISMA: Record<BillingModel, ApiBillingModel> = {
  [BillingModel.Time_and_Materials]: ApiBillingModel.TimeAndMaterial,
  [BillingModel.Fixed_Price]: ApiBillingModel.FixedPrice,
  [BillingModel.Retainer]: ApiBillingModel.Retainer,
  [BillingModel.SLA_Based]: ApiBillingModel.Retainer,
};

const STATUS_TO_PRISMA: Record<ApiProjectStatus, ProjectStatus> = {
  [ApiProjectStatus.Draft]: ProjectStatus.Draft,
  [ApiProjectStatus.Active]: ProjectStatus.Active,
  [ApiProjectStatus.OnHold]: ProjectStatus.On_Hold,
  [ApiProjectStatus.AtRisk]: ProjectStatus.At_Risk,
  [ApiProjectStatus.PendingClosure]: ProjectStatus.Pending_Closure,
  [ApiProjectStatus.Closed]: ProjectStatus.Closed,
  [ApiProjectStatus.Cancelled]: ProjectStatus.Cancelled,
};

export const STATUS_FROM_PRISMA: Record<ProjectStatus, ApiProjectStatus> = {
  [ProjectStatus.Draft]: ApiProjectStatus.Draft,
  [ProjectStatus.Active]: ApiProjectStatus.Active,
  [ProjectStatus.On_Hold]: ApiProjectStatus.OnHold,
  [ProjectStatus.At_Risk]: ApiProjectStatus.AtRisk,
  [ProjectStatus.Pending_Closure]: ApiProjectStatus.PendingClosure,
  [ProjectStatus.Closed]: ApiProjectStatus.Closed,
  [ProjectStatus.Cancelled]: ApiProjectStatus.Cancelled,
};

export function toPrismaEngagementType(value: ApiEngagementType): EngagementType {
  return ENGAGEMENT_TO_PRISMA[value];
}

export function toPrismaBillingModel(value: ApiBillingModel): BillingModel {
  return BILLING_TO_PRISMA[value];
}

export function toPrismaStatus(value: ApiProjectStatus): ProjectStatus {
  return STATUS_TO_PRISMA[value];
}

export function toPrismaCurrency(value: string): string {
  return value.toUpperCase();
}

export function toApiProject(
  project: ProjectWithRelations,
  options: { ability?: AppAbility | null; permissions?: PermissionRow[] } = {},
) {
  const showFinancials = options.permissions
    ? hasModulePermission(options.permissions, 'financials', 'view')
    : !options.ability ||
      options.ability.can('manage', 'Settings') ||
      options.ability.can('read', 'Financial');

  const showCommercialDetails = showFinancials
    ? true
    : options.permissions
      ? hasModulePermission(options.permissions, 'projects', 'edit')
      : Boolean(options.ability?.can('update', 'Project'));

  return {
    id: project.id,
    name: project.name,
    objective: project.objective,
    departmentId: project.departmentId,
    customerId: project.customerId,
    ...(showCommercialDetails
      ? {
          engagementType:
            ENGAGEMENT_FROM_PRISMA[project.engagementType] ??
            ApiEngagementType.ManagedServices,
          billingModel: BILLING_FROM_PRISMA[project.billingModel],
        }
      : {}),
    priority: project.priority as ApiPriorityLevel,
    startDate: project.startDate.toISOString().slice(0, 10),
    endDate: project.endDate.toISOString().slice(0, 10),
    ...(showFinancials
      ? {
          value: Number(project.value),
          currency: project.currency,
        }
      : {}),
    primaryPmId: project.primaryPmId,
    secondaryPmId: project.secondaryPmId,
    status: STATUS_FROM_PRISMA[project.status],
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    department: project.department
      ? { id: project.department.id, code: project.department.code, name: project.department.name }
      : undefined,
    customer: project.customer
      ? { id: project.customer.id, displayName: project.customer.displayName }
      : undefined,
    primaryPm: project.primaryPm
      ? {
          id: project.primaryPm.id,
          displayName: project.primaryPm.displayName,
          email: project.primaryPm.email,
        }
      : undefined,
    secondaryPm: project.secondaryPm
      ? {
          id: project.secondaryPm.id,
          displayName: project.secondaryPm.displayName,
          email: project.secondaryPm.email,
        }
      : undefined,
  };
}
