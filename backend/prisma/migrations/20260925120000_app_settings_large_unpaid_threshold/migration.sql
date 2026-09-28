-- M5.4-06: Finance large unpaid balance threshold (editable in Settings).
ALTER TABLE "app_settings"
ADD COLUMN "large_unpaid_balance_threshold" DECIMAL(18, 2) NOT NULL DEFAULT 10000;
