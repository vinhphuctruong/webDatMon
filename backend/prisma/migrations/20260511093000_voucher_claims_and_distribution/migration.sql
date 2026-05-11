-- Voucher claim / hunt system:
-- - Customers must "save/claim" a voucher before they can use it.
-- - Limited quantity is based on number of claims (maxClaimTotal).
-- - Supports auto-grant vouchers on customer registration.

-- 1) Enum: claim source
DO $$ BEGIN
  CREATE TYPE "VoucherClaimSource" AS ENUM ('MARKET', 'ADMIN', 'AUTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Voucher distribution fields
ALTER TABLE "Voucher"
  ADD COLUMN IF NOT EXISTS "isClaimable" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "maxClaimTotal" INTEGER,
  ADD COLUMN IF NOT EXISTS "claimedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "autoGrantOnRegister" BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) Claim table
CREATE TABLE IF NOT EXISTS "VoucherClaim" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "VoucherClaimSource" NOT NULL DEFAULT 'MARKET',
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoucherClaim_pkey" PRIMARY KEY ("id")
);

-- Uniqueness: 1 user can claim 1 voucher once
DO $$ BEGIN
  ALTER TABLE "VoucherClaim"
    ADD CONSTRAINT "VoucherClaim_voucherId_userId_key" UNIQUE ("voucherId","userId");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "VoucherClaim"
    ADD CONSTRAINT "VoucherClaim_voucherId_fkey"
      FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "VoucherClaim"
    ADD CONSTRAINT "VoucherClaim_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "VoucherClaim_userId_claimedAt_idx" ON "VoucherClaim"("userId","claimedAt");
CREATE INDEX IF NOT EXISTS "VoucherClaim_voucherId_claimedAt_idx" ON "VoucherClaim"("voucherId","claimedAt");

