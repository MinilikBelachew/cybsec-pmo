import { z } from "zod";

export const createProjectSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    objective: z.string().min(5, "Objective must be at least 5 characters"),
    departmentId: z.string().uuid("Please select a Department"),
    customerId: z.string().uuid("Please select a Customer"),
    engagementType: z.enum(["ManagedServices", "StaffAugmentation", "FixedPrice"]),
    methodology: z.enum(["Agile", "Waterfall", "Hybrid"]),
    billingModel: z.enum(["TimeAndMaterial", "FixedPrice", "Retainer"]),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    startDate: z.coerce.date({ message: "Start date is required" }),
    endDate: z.coerce.date({ message: "End date is required" }),
    value: z.coerce.number().positive("Value must be greater than zero"),
    currency: z.enum(["USD", "EUR", "AED", "SAR"]),
    primaryPmId: z.string().uuid("Please assign a primary PM"),
    secondaryPmId: z.string().uuid().nullable().optional(),
    status: z.enum(["Draft", "Active", "OnHold", "PendingClosure", "Closed"]),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

export function toCreateProjectPayload(values: CreateProjectFormValues) {
  return {
    name: values.name,
    objective: values.objective,
    departmentId: values.departmentId,
    customerId: values.customerId,
    engagementType: values.engagementType,
    methodology: values.methodology,
    billingModel: values.billingModel,
    priority: values.priority,
    startDate: values.startDate.toISOString().slice(0, 10),
    endDate: values.endDate.toISOString().slice(0, 10),
    value: values.value,
    currency: values.currency,
    primaryPmId: values.primaryPmId,
    secondaryPmId: values.secondaryPmId ?? null,
    status: values.status,
  };
}
