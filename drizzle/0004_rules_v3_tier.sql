ALTER TABLE "events" ADD COLUMN "tier" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rank_score" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rank_why" jsonb;