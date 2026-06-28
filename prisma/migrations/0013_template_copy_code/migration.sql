-- Coupon-code templates: track whether a template has a COPY_CODE button so the
-- broadcast knows to ask for a coupon code.
ALTER TABLE "Template" ADD COLUMN "copyCode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Broadcast" ADD COLUMN "couponCode" TEXT;
