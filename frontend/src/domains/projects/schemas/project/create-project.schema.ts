import { z } from "zod";

function preprocessDate(val: unknown): Date | undefined {
  if (val === "" || val === null || val === undefined) return undefined;
  const date = val instanceof Date ? val : new Date(String(val));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const dateField = z.preprocess(preprocessDate, z.date().optional());

const baseProjectSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    objective: z
      .string()
      .min(5, "Objective must be at least 5 characters")
      .max(2000, "Description must be 2000 characters or fewer"),
    departmentId: z.string().uuid("Please select a Department"),
    customerId: z.string().uuid("Please select a Customer"),
    engagementType: z.enum(["ManagedServices", "StaffAugmentation", "FixedPrice"]),
    billingModel: z.enum(["TimeAndMaterial", "FixedPrice", "Retainer"]),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    startDate: dateField,
    endDate: dateField,
    value: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.coerce
        .number({ message: "Budget value is required" })
        .min(0, "Value cannot be negative")
        .positive("Value must be greater than zero"),
    ),
    currency: z.string().min(2).max(4).toUpperCase(),
    primaryPmId: z.string().uuid("Please assign a primary PM"),
    secondaryPmId: z.string().uuid().or(z.literal("")).nullable().optional(),
    status: z.enum([
      "Draft",
      "Active",
      "OnHold",
      "AtRisk",
      "PendingClosure",
      "Closed",
      "Cancelled",
    ]),
  })
  .refine((data) => Boolean(data.startDate), {
    message: "Start date is required",
    path: ["startDate"],
  })
  .refine((data) => Boolean(data.endDate), {
    message: "End date is required",
    path: ["endDate"],
  })
  .refine((data) => {
    if (!data.startDate || !data.endDate) return true;
    return data.endDate > data.startDate;
  }, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine((data) => !data.secondaryPmId || data.secondaryPmId !== data.primaryPmId, {
    message: "Secondary PM must differ from Primary PM",
    path: ["secondaryPmId"],
  });

export const createProjectFormSchema = baseProjectSchema.refine((data) => {
  if (!data.startDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(data.startDate);
  start.setHours(0, 0, 0, 0);
  return start >= today;
}, {
  message: "Start date cannot be in the past",
  path: ["startDate"],
});

export const editProjectFormSchema = baseProjectSchema;

/** Alias for new-project forms */
export const createProjectSchema = createProjectFormSchema;

export type CreateProjectFormValues = z.infer<typeof baseProjectSchema>;

export function toCreateProjectPayload(values: CreateProjectFormValues) {
  if (!values.startDate || !values.endDate) {
    throw new Error("Project dates are required");
  }

  return {
    name: values.name,
    objective: values.objective,
    departmentId: values.departmentId,
    customerId: values.customerId,
    engagementType: values.engagementType,
    billingModel: values.billingModel,
    priority: values.priority,
    startDate: values.startDate.toISOString().slice(0, 10),
    endDate: values.endDate.toISOString().slice(0, 10),
    value: values.value,
    currency: values.currency,
    primaryPmId: values.primaryPmId,
    secondaryPmId: values.secondaryPmId && values.secondaryPmId !== "" ? values.secondaryPmId : null,
    status: values.status,
  };
}
