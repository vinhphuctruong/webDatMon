-- Add voucher scope (ORDER vs SHIPPING) and enforce percent voucher must have maxDiscount.

-- 1) Enum type
DO $$ BEGIN
  CREATE TYPE "VoucherScope" AS ENUM ('ORDER', 'SHIPPING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Column with default
ALTER TABLE "Voucher"
  ADD COLUMN IF NOT EXISTS "scope" "VoucherScope" NOT NULL DEFAULT 'ORDER';

-- 3) Data integrity: PERCENT requires maxDiscount (max cap)
DO $$ BEGIN
  ALTER TABLE "Voucher"
    ADD CONSTRAINT "voucher_percent_requires_max_discount"
    CHECK ("discountType" <> 'PERCENT' OR "maxDiscount" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

