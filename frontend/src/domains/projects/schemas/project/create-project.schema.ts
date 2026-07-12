import { z } from "zod";

function preprocessDate(val: unknown): Date | undefined {
  if (val === "" || val === null || val === undefined) return undefined;
  const date = val instanceof Date ? val : new Date(String(val));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Required calendar date — empty values must fail (DEF-P1-004). */
const requiredDate = (message: string) =>
  z.preprocess(
    preprocessDate,
    z.coerce.date({ message }),
  );

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
    methodology: z.enum(["Agile", "Waterfall", "Hybrid"]),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    startDate: requiredDate("Start date is required"),
    endDate: requiredDate("End date is required"),
    value: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.coerce
        .number({ message: "Budget value is required" })
        .min(0, "Value cannot be negative")
        .positive("Value must be greater than zero")
        .max(100000000, "Value exceeds maximum project boundary limit"),
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
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.endDate > data.startDate;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  )
  .refine((data) => !data.secondaryPmId || data.secondaryPmId !== data.primaryPmId, {
    message: "Secondary PM must differ from Primary PM",
    path: ["secondaryPmId"],
  });

export const createProjectFormSchema = baseProjectSchema.refine(
  (data) => {
    if (!data.startDate) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);
    return start >= today;
  },
  {
    message: "Start date cannot be in the past",
    path: ["startDate"],
  },
);

export const editProjectFormSchema = baseProjectSchema;

/** Alias for new-project forms */
export const createProjectSchema = createProjectFormSchema;

export type CreateProjectFormValues = z.infer<typeof baseProjectSchema>;

export function toCreateProjectPayload(values: CreateProjectFormValues) {
  if (!values.startDate || !values.endDate) {
    throw new Error("Project dates are required");
  }

  const toYmd = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    name: values.name,
    objective: values.objective,
    departmentId: values.departmentId,
    customerId: values.customerId,
    engagementType: values.engagementType,
    billingModel: values.billingModel,
    methodology: values.methodology,
    priority: values.priority,
    startDate: toYmd(values.startDate),
    endDate: toYmd(values.endDate),
    value: values.value,
    currency: values.currency,
    primaryPmId: values.primaryPmId,
    secondaryPmId:
      values.secondaryPmId && values.secondaryPmId !== ""
        ? values.secondaryPmId
        : null,
    status: values.status,
  };
}
