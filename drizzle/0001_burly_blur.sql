ALTER TABLE "bangtek_user" ADD COLUMN "password_hash" text;--> statement-breakpoint
UPDATE "bangtek_user" AS u
SET "password_hash" = a."password"
FROM "bangtek_account" AS a
WHERE a."user_id" = u."id"
  AND a."provider_id" = 'credential'
  AND a."password" IS NOT NULL
  AND u."password_hash" IS NULL;
