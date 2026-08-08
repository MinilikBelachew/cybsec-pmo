-- Branding profiles: the PMO loads each brand once in settings, then picks it
-- on the project, so the report templates stay unchanged.
CREATE TABLE "branding_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "company_name" VARCHAR(255) NOT NULL,
  "document_owner" VARCHAR(255) NOT NULL,
  "logo_data" BYTEA,
  "logo_mime_type" VARCHAR(100),
  "logo_file_name" VARCHAR(255),
  "primary_color" VARCHAR(9) NOT NULL DEFAULT '#0B3D5C',
  "accent_color" VARCHAR(9) NOT NULL DEFAULT '#C45C26',
  "muted_color" VARCHAR(9) NOT NULL DEFAULT '#5A6A75',
  "line_color" VARCHAR(9) NOT NULL DEFAULT '#D7DEE5',
  "sender_email" VARCHAR(255),
  "sender_name" VARCHAR(255),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_by_id" UUID,
  CONSTRAINT "branding_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branding_profiles_name_key" ON "branding_profiles"("name");
CREATE INDEX "idx_branding_profiles_default" ON "branding_profiles"("is_default");
CREATE INDEX "idx_branding_profiles_active" ON "branding_profiles"("is_active");

ALTER TABLE "projects" ADD COLUMN "branding_profile_id" UUID;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_branding_profile_id_fkey"
  FOREIGN KEY ("branding_profile_id") REFERENCES "branding_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
