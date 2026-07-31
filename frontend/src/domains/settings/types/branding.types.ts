export type BrandingProfile = {
  id: string;
  name: string;
  companyName: string;
  documentOwner: string;
  logoFileName: string | null;
  logoMimeType: string | null;
  hasLogo: boolean;
  primaryColor: string;
  accentColor: string;
  mutedColor: string;
  lineColor: string;
  isDefault: boolean;
  /** Projects issued under this brand today. */
  projectCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BrandingProfileOption = {
  id: string;
  name: string;
  companyName: string;
  isDefault: boolean;
};

export type BrandingProfileInput = {
  name: string;
  companyName: string;
  documentOwner: string;
  primaryColor?: string;
  accentColor?: string;
  mutedColor?: string;
  lineColor?: string;
  isDefault?: boolean;
};
