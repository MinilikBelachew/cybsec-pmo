-- Store task plan start/due as full timestamps (date + time).
ALTER TABLE "tasks"
  ALTER COLUMN "start_date" TYPE TIMESTAMPTZ
    USING CASE
      WHEN "start_date" IS NULL THEN NULL
      ELSE ("start_date"::timestamp AT TIME ZONE 'UTC')
    END;

ALTER TABLE "tasks"
  ALTER COLUMN "end_date" TYPE TIMESTAMPTZ
    USING CASE
      WHEN "end_date" IS NULL THEN NULL
      ELSE ("end_date"::timestamp AT TIME ZONE 'UTC')
    END;
