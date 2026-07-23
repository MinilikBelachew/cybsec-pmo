ALTER TABLE "app_settings"
  ADD COLUMN "session_idle_timeout_sec" INTEGER NOT NULL DEFAULT 900,
  ADD COLUMN "session_warning_before_sec" INTEGER NOT NULL DEFAULT 300;
