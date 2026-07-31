import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #0B3D5C");

const logoFileSchema = z
  .custom<File | null>((value) => value == null || value instanceof File, {
    message: "Select an image file",
  })
  .refine(
    (file) =>
      !file ||
      ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"].includes(
        file.type,
      ),
    "Logo must be a PNG, JPEG, GIF or WebP image",
  )
  .refine(
    (file) => !file || file.size <= 2 * 1024 * 1024,
    "Logo must be 2 MB or smaller",
  );

export const brandingProfileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name must be 120 characters or fewer"),
  companyName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(255, "Company name must be 255 characters or fewer"),
  documentOwner: z
    .string()
    .trim()
    .min(2, "Document owner must be at least 2 characters")
    .max(255, "Document owner must be 255 characters or fewer"),
  primaryColor: hexColor,
  accentColor: hexColor,
  lineColor: hexColor,
  isDefault: z.boolean(),
  logoFile: logoFileSchema,
  removeLogo: z.boolean(),
});

export type BrandingProfileFormValues = z.infer<
  typeof brandingProfileFormSchema
>;

/** Secondary text colour is fixed by the approved format, so it is not editable. */
export const DEFAULT_MUTED_COLOR = "#5A6A75";

export const emptyBrandingProfileFormValues: BrandingProfileFormValues = {
  name: "",
  companyName: "CyberSec",
  documentOwner: "CyberSec PMO",
  primaryColor: "#0B3D5C",
  accentColor: "#C45C26",
  lineColor: "#D7DEE5",
  isDefault: false,
  logoFile: null,
  removeLogo: false,
};
