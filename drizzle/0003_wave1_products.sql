ALTER TABLE "events" ADD COLUMN "affected_products" jsonb;--> statement-breakpoint
ALTER TABLE "vulnerabilities" ADD COLUMN "cpes" jsonb;