CREATE TABLE "bangtek_api_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "bangtek_api_token_name_unique" UNIQUE("name"),
	CONSTRAINT "bangtek_api_token_token_hash_unique" UNIQUE("token_hash")
);
