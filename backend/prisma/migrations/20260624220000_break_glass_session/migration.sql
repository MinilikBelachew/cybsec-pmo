ALTER TABLE "sessions"
  ADD COLUMN "is_break_glass" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "break_glass_reason" VARCHAR(500);
