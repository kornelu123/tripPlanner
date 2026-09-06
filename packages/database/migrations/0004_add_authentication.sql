CREATE TABLE "passkey_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "public_key" bytea NOT NULL,
  "counter" integer DEFAULT 0 NOT NULL,
  "transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "device_type" varchar(32) NOT NULL,
  "backed_up" boolean DEFAULT false NOT NULL,
  "name" varchar(100) NOT NULL,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "passkeys_user_id_idx" ON "passkey_credentials" ("user_id");
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(32) NOT NULL,
  "challenge_hash" varchar(64) NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(320),
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL,
  "user_agent" varchar(500),
  "ip_address" varchar(64),
  "expires_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" ("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "apple_accounts" (
  "subject" varchar(255) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar(320),
  "is_private_relay" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "apple_accounts_user_id_idx" ON "apple_accounts" ("user_id");
