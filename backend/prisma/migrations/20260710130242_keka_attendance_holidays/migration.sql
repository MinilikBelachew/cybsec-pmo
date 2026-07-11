-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "keka_attendance_id" VARCHAR(100),
    "keka_employee_id" VARCHAR(100) NOT NULL,
    "employee_number" VARCHAR(50),
    "attendance_date" DATE NOT NULL,
    "day_type" INTEGER,
    "shift_start_time" TIMESTAMPTZ,
    "shift_end_time" TIMESTAMPTZ,
    "shift_duration" DECIMAL(8,2),
    "shift_break_duration" DECIMAL(8,2),
    "shift_effective_duration" DECIMAL(8,2),
    "total_gross_hours" DECIMAL(8,2),
    "total_effective_hours" DECIMAL(8,2),
    "total_break_duration" DECIMAL(8,2),
    "total_effective_overtime_duration" DECIMAL(8,2),
    "total_gross_overtime_duration" DECIMAL(8,2),
    "first_in_at" TIMESTAMPTZ,
    "last_out_at" TIMESTAMPTZ,
    "first_in_payload" JSONB,
    "last_out_payload" JSONB,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keka_calendar_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID NOT NULL,
    "keka_holiday_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "holiday_date" DATE NOT NULL,
    "is_floater" BOOLEAN NOT NULL DEFAULT false,
    "calendar_year" INTEGER,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_keka_attendance_id_key" ON "attendance_records"("keka_attendance_id");

-- CreateIndex
CREATE INDEX "idx_attendance_employee" ON "attendance_records"("employee_id");

-- CreateIndex
CREATE INDEX "idx_attendance_keka_employee" ON "attendance_records"("keka_employee_id");

-- CreateIndex
CREATE INDEX "idx_attendance_date" ON "attendance_records"("attendance_date");

-- CreateIndex
CREATE INDEX "idx_attendance_day_type" ON "attendance_records"("day_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_attendance_employee_date" ON "attendance_records"("employee_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendars_keka_calendar_id_key" ON "holiday_calendars"("keka_calendar_id");

-- CreateIndex
CREATE INDEX "idx_holiday_calendars_name" ON "holiday_calendars"("name");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_keka_holiday_id_key" ON "holidays"("keka_holiday_id");

-- CreateIndex
CREATE INDEX "idx_holidays_calendar" ON "holidays"("calendar_id");

-- CreateIndex
CREATE INDEX "idx_holidays_date" ON "holidays"("holiday_date");

-- CreateIndex
CREATE INDEX "idx_holidays_year" ON "holidays"("calendar_year");

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "holiday_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
