import {
  BillingModel,
  CurrencyCode,
  EngagementType,
  Methodology,
  PriorityLevel,
  ProjectStatus,
  type Project,
  type Department,
  type Customer,
  type User,
} from '@prisma/client';
import {
  ApiBillingModel,
  ApiCurrencyCode,
  ApiEngagementType,
  ApiMethodology,
  ApiPriorityLevel,
  ApiProjectStatus,
} from '../enums/project-api.enum';

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
  [ApiProjectStatus.PendingClosure]: ProjectStatus.Pending_Closure,
  [ApiProjectStatus.Closed]: ProjectStatus.Closed,
};

const STATUS_FROM_PRISMA: Record<ProjectStatus, ApiProjectStatus> = {
  [ProjectStatus.Draft]: ApiProjectStatus.Draft,
  [ProjectStatus.Active]: ApiProjectStatus.Active,
  [ProjectStatus.On_Hold]: ApiProjectStatus.OnHold,
  [ProjectStatus.Pending_Closure]: ApiProjectStatus.PendingClosure,
  [ProjectStatus.Closed]: ApiProjectStatus.Closed,
};

const CURRENCY_TO_PRISMA: Record<ApiCurrencyCode, CurrencyCode> = {
  [ApiCurrencyCode.USD]: CurrencyCode.USD,
  [ApiCurrencyCode.EUR]: CurrencyCode.EUR,
  [ApiCurrencyCode.AED]: CurrencyCode.AED,
  [ApiCurrencyCode.SAR]: CurrencyCode.AED,
};

const CURRENCY_FROM_PRISMA: Record<CurrencyCode, ApiCurrencyCode> = {
  [CurrencyCode.USD]: ApiCurrencyCode.USD,
  [CurrencyCode.EUR]: ApiCurrencyCode.EUR,
  [CurrencyCode.AED]: ApiCurrencyCode.AED,
  [CurrencyCode.GBP]: ApiCurrencyCode.USD,
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

export function toPrismaCurrency(value: ApiCurrencyCode): CurrencyCode {
  return CURRENCY_TO_PRISMA[value];
}

export function toApiProject(project: ProjectWithRelations) {
  return {
    id: project.id,
    name: project.name,
    objective: project.objective,
    departmentId: project.departmentId,
    customerId: project.customerId,
    engagementType:
      ENGAGEMENT_FROM_PRISMA[project.engagementType] ?? ApiEngagementType.ManagedServices,
    methodology: project.methodology as ApiMethodology,
    billingModel: BILLING_FROM_PRISMA[project.billingModel],
    priority: project.priority as ApiPriorityLevel,
    startDate: project.startDate.toISOString().slice(0, 10),
    endDate: project.endDate.toISOString().slice(0, 10),
    value: Number(project.value),
    currency: CURRENCY_FROM_PRISMA[project.currency],
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
