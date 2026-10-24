CREATE TABLE "event_narratives" (
	"event_id" text PRIMARY KEY NOT NULL,
	"business_exposure" text,
	"why_act" text,
	"fix" text,
	"ask_your_team" text,
	"roles" jsonb DEFAULT '{"ciso":[],"cio":[],"ceo":[],"board":[]}'::jsonb NOT NULL,
	"claim_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'human' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_narratives" ADD CONSTRAINT "event_narratives_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;