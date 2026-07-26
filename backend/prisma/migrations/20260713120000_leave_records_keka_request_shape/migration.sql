-- Convert leave_records from one-row-per-day to one-row-per-Keka-leave-request.

CREATE TABLE "leave_records_new" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "keka_ref" VARCHAR(100) NOT NULL,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "from_session" INTEGER,
    "to_session" INTEGER,
    "leave_type" VARCHAR(50) NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "keka_status" INTEGER,
    "note" TEXT,
    "requested_on" TIMESTAMPTZ,
    "cancel_reject_reason" TEXT,
    "last_action_taken_on" TIMESTAMPTZ,
    "selection" JSONB,
    "synced_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leave_records_new_pkey" PRIMARY KEY ("id")
);

-- Collapse expanded daily rows that share a Keka leave id.
INSERT INTO "leave_records_new" (
    "id",
    "employee_id",
    "keka_ref",
    "from_date",
    "to_date",
    "from_session",
    "to_session",
    "leave_type",
    "is_approved",
    "keka_status",
    "synced_at"
)
SELECT
    (array_agg("id" ORDER BY "leave_date" ASC))[1],
    "employee_id",
    "keka_ref",
    MIN("leave_date"),
    MAX("leave_date"),
    (array_agg("from_session" ORDER BY "leave_date" ASC))[1],
    (array_agg("to_session" ORDER BY "leave_date" DESC))[1],
    (array_agg("leave_type" ORDER BY "leave_date" ASC))[1],
    BOOL_OR("is_approved"),
    (array_agg("keka_status" ORDER BY "leave_date" DESC))[1],
    MAX("synced_at")
FROM "leave_records"
WHERE "keka_ref" IS NOT NULL AND BTRIM("keka_ref") <> ''
GROUP BY "employee_id", "keka_ref";

-- Legacy rows without keka_ref become single-day requests.
INSERT INTO "leave_records_new" (
    "id",
    "employee_id",
    "keka_ref",
    "from_date",
    "to_date",
    "from_session",
    "to_session",
    "leave_type",
    "is_approved",
    "keka_status",
    "synced_at"
)
SELECT
    "id",
    "employee_id",
    'legacy-' || "id"::text,
    "leave_date",
    "leave_date",
    "from_session",
    "to_session",
    "leave_type",
    "is_approved",
    "keka_status",
    "synced_at"
FROM "leave_records"
WHERE "keka_ref" IS NULL OR BTRIM("keka_ref") = '';

ALTER TABLE "leave_records" DROP CONSTRAINT "leave_records_employee_id_fkey";

DROP TABLE "leave_records";

ALTER TABLE "leave_records_new" RENAME TO "leave_records";

ALTER TABLE "leave_records" RENAME CONSTRAINT "leave_records_new_pkey" TO "leave_records_pkey";

CREATE UNIQUE INDEX "leave_records_keka_ref_key" ON "leave_records"("keka_ref");

CREATE INDEX "idx_leave_employee" ON "leave_records"("employee_id");

CREATE INDEX "idx_leave_date_range" ON "leave_records"("from_date", "to_date");

ALTER TABLE "leave_records"
ADD CONSTRAINT "leave_records_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
