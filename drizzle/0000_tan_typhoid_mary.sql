CREATE TABLE "bangtek_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangtek_admin_access" (
	"user_id" text PRIMARY KEY NOT NULL,
	"approved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangtek_owner" (
	"id" integer PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangtek_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "bangtek_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "bangtek_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "bangtek_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "bangtek_sprint" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bangtek_sprint_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "bangtek_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"sprint_id" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"blocker" text DEFAULT '' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangtek_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bangtek_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bangtek_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bangtek_account" ADD CONSTRAINT "bangtek_account_user_id_bangtek_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bangtek_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangtek_admin_access" ADD CONSTRAINT "bangtek_admin_access_user_id_bangtek_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bangtek_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangtek_owner" ADD CONSTRAINT "bangtek_owner_user_id_bangtek_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bangtek_user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangtek_session" ADD CONSTRAINT "bangtek_session_user_id_bangtek_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bangtek_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangtek_task" ADD CONSTRAINT "bangtek_task_sprint_id_bangtek_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."bangtek_sprint"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bangtek_account_user_idx" ON "bangtek_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bangtek_session_user_idx" ON "bangtek_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bangtek_one_active_sprint" ON "bangtek_sprint" USING btree ("status") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "bangtek_task_sprint_idx" ON "bangtek_task" USING btree ("sprint_id");