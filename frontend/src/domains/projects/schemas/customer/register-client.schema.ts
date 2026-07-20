import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const registerClientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name is required")
    .max(255, "Name must be 255 characters or fewer"),
  code: optionalTrimmed,
  email: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      "Enter a valid email",
    )
    .transform((value) => (value ? value : undefined)),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^\+?[0-9\s\-().]{7,20}$/.test(value),
      "Enter a valid phone number",
    )
    .transform((value) => (value ? value : undefined)),
  website: optionalTrimmed,
  description: optionalTrimmed,
  billingCurrencyId: z.string().min(1, "Billing currency is required for Keka"),
  addressLine1: z.string().trim().min(1, "Address line 1 is required"),
  addressLine2: optionalTrimmed,
  // Keka rejects client creation without a billing country ("Billing Currency/Country is required").
  countryCode: z
    .string()
    .trim()
    .min(1, "Billing country is required for Keka")
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code, e.g. IN or US")
    .transform((value) => value.toUpperCase()),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  zip: z.string().trim().min(1, "ZIP is required"),
});

export type RegisterClientFormValues = z.input<typeof registerClientFormSchema>;
export type RegisterClientFormOutput = z.output<typeof registerClientFormSchema>;

export function toCreateCustomerPayload(values: RegisterClientFormOutput) {
  return {
    name: values.name,
    code: values.code,
    email: values.email,
    phone: values.phone,
    website: values.website,
    description: values.description,
    billingCurrencyId: values.billingCurrencyId,
    billingAddress: {
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      countryCode: values.countryCode,
      city: values.city,
      state: values.state,
      zip: values.zip,
    },
  };
}
