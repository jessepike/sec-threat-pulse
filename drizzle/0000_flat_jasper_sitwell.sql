CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text,
	"text" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_cves" (
	"event_id" text NOT NULL,
	"cve_id" text NOT NULL,
	CONSTRAINT "event_cves_event_id_cve_id_pk" PRIMARY KEY("event_id","cve_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"kind" text DEFAULT 'vulnerability' NOT NULL,
	"vendor" text,
	"product" text,
	"ladder" jsonb NOT NULL,
	"exploit_maturity" text DEFAULT 'none' NOT NULL,
	"verdict" text DEFAULT 'low' NOT NULL,
	"verdict_reason" text,
	"rules_version" text NOT NULL,
	"override_verdict" text,
	"override_reason" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"run_id" integer,
	"dedupe_key" text NOT NULL,
	"kind" text NOT NULL,
	"strength" text NOT NULL,
	"cve_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vendor" text,
	"product" text,
	"org_name" text,
	"event_id" text,
	"title" text NOT NULL,
	"summary" text,
	"url" text NOT NULL,
	"published_at" timestamp with time zone,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "observations_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"items_fetched" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"payload_sha256" text,
	"raw_object_key" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"homepage" text NOT NULL,
	"terms_status" text DEFAULT 'unclear' NOT NULL,
	"attribution" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"interval_minutes" integer DEFAULT 120 NOT NULL,
	"cursor" text,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "verdict_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"verdict" text NOT NULL,
	"ladder" jsonb NOT NULL,
	"rules_version" text NOT NULL,
	"reason" text,
	"actor" text DEFAULT 'rules' NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vulnerabilities" (
	"cve_id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"vendor" text,
	"product" text,
	"cvss_score" real,
	"cwe" jsonb,
	"published_at" timestamp with time zone,
	"epss" real,
	"epss_percentile" real,
	"epss_date" text,
	"kev_cisa_date_added" text,
	"kev_cisa_ransomware" boolean,
	"kev_vulncheck_date_added" text,
	"exploit_maturity" text DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_cves" ADD CONSTRAINT "event_cves_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_run_id_source_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."source_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verdict_history" ADD CONSTRAINT "verdict_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_updated_idx" ON "events" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "observations_event_idx" ON "observations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "observations_observed_idx" ON "observations" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "observations_cve_ids_idx" ON "observations" USING gin ("cve_ids");--> statement-breakpoint
CREATE INDEX "source_runs_source_idx" ON "source_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "vulnerabilities_kev_cisa_idx" ON "vulnerabilities" USING btree ("kev_cisa_date_added");--> statement-breakpoint
CREATE INDEX "vulnerabilities_kev_vulncheck_idx" ON "vulnerabilities" USING btree ("kev_vulncheck_date_added");