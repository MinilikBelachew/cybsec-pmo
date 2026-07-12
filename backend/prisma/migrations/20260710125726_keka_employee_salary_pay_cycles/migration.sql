-- CreateTable
CREATE TABLE "employee_salaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "keka_salary_id" VARCHAR(100) NOT NULL,
    "keka_employee_id" VARCHAR(100) NOT NULL,
    "keka_pay_group_id" VARCHAR(100),
    "ctc" DECIMAL(15,2) NOT NULL,
    "gross" DECIMAL(15,2) NOT NULL,
    "net_pay" DECIMAL(15,2) NOT NULL,
    "remuneration_type" INTEGER,
    "effective_from" DATE NOT NULL,
    "rate_per_hour" DECIMAL(12,4),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "earnings" JSONB,
    "contributions" JSONB,
    "deductions" JSONB,
    "variables" JSONB,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keka_pay_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "keka_identifier" VARCHAR(100) NOT NULL,
    "keka_pay_group_id" VARCHAR(100),
    "month_label" VARCHAR(50),
    "period_year" INTEGER,
    "period_month" INTEGER,
    "start_date" DATE,
    "end_date" DATE,
    "run_status" INTEGER,
    "synced_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keka_pay_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_salaries_keka_salary_id_key" ON "employee_salaries"("keka_salary_id");

-- CreateIndex
CREATE INDEX "idx_employee_salaries_employee" ON "employee_salaries"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employee_salaries_keka_employee" ON "employee_salaries"("keka_employee_id");

-- CreateIndex
CREATE INDEX "idx_employee_salaries_effective" ON "employee_salaries"("effective_from");

-- CreateIndex
CREATE INDEX "idx_employee_salaries_current" ON "employee_salaries"("is_current");

-- CreateIndex
CREATE INDEX "idx_employee_salaries_pay_group" ON "employee_salaries"("keka_pay_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "keka_pay_cycles_keka_identifier_key" ON "keka_pay_cycles"("keka_identifier");

-- CreateIndex
CREATE INDEX "idx_keka_pay_cycles_pay_group" ON "keka_pay_cycles"("keka_pay_group_id");

-- CreateIndex
CREATE INDEX "idx_keka_pay_cycles_period" ON "keka_pay_cycles"("period_year", "period_month");

-- CreateIndex
CREATE INDEX "idx_keka_pay_cycles_run_status" ON "keka_pay_cycles"("run_status");

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
