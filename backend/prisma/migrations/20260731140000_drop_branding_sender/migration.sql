-- Remove unused sender mailbox fields from branding profiles.
-- Letterhead branding no longer carries a per-profile outgoing address.
ALTER TABLE "branding_profiles" DROP COLUMN IF EXISTS "sender_email";
ALTER TABLE "branding_profiles" DROP COLUMN IF EXISTS "sender_name";
