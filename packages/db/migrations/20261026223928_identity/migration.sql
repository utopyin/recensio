CREATE TABLE "rec_auth_credentials" (
	"credential_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"revision" text NOT NULL,
	"active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_auth_emailCredentials" (
	"module_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"identifier_namespace" text NOT NULL,
	"identifier_value" text NOT NULL,
	"credential_revision" text NOT NULL,
	"active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_auth_identifiers" (
	"namespace" text NOT NULL,
	"value" text NOT NULL,
	"module_id" text,
	"credential_id" text,
	"subject_id" text NOT NULL,
	"revision" text NOT NULL,
	"verified_at" bigint,
	"active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_auth_pending" (
	"module_id" text NOT NULL,
	"kind" text NOT NULL,
	"digest" text NOT NULL,
	"version" text NOT NULL,
	"flow_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"binding_digest" text NOT NULL,
	"snapshot" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"attempt_limit" bigint NOT NULL,
	"failed_attempts" bigint NOT NULL,
	"consumed" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_auth_proofs" (
	"module_id" text NOT NULL,
	"purpose" text NOT NULL,
	"series_key" text NOT NULL,
	"proof_id" text NOT NULL,
	"binding" text NOT NULL,
	"verifier_key_id" text NOT NULL,
	"verifier_digest" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"failed_attempts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_auth_sessions" (
	"session_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"digest" text NOT NULL,
	"security_revision" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"absolute_expires_at" bigint NOT NULL,
	"record" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rec_users" (
	"id" text PRIMARY KEY,
	"enabled" boolean DEFAULT true NOT NULL,
	"security_revision" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_credentials_key_0" ON "rec_auth_credentials" ("credential_id");--> statement-breakpoint
CREATE INDEX "rec_auth_credentials_index_0" ON "rec_auth_credentials" ("subject_id","active","credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_emailCredentials_key_0" ON "rec_auth_emailCredentials" ("module_id","credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_emailCredentials_key_1" ON "rec_auth_emailCredentials" ("module_id","identifier_namespace","identifier_value");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_identifiers_key_0" ON "rec_auth_identifiers" ("namespace","value");--> statement-breakpoint
CREATE INDEX "rec_auth_identifiers_index_0" ON "rec_auth_identifiers" ("subject_id","namespace","value");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_pending_key_0" ON "rec_auth_pending" ("digest");--> statement-breakpoint
CREATE INDEX "rec_auth_pending_index_0" ON "rec_auth_pending" ("module_id","expires_at","digest");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_proofs_key_0" ON "rec_auth_proofs" ("module_id","purpose","series_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_proofs_key_1" ON "rec_auth_proofs" ("module_id","proof_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_sessions_key_0" ON "rec_auth_sessions" ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rec_auth_sessions_key_1" ON "rec_auth_sessions" ("digest");--> statement-breakpoint
CREATE INDEX "rec_auth_sessions_index_0" ON "rec_auth_sessions" ("subject_id","security_revision","session_id");