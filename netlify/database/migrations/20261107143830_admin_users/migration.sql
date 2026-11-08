CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"last_login_at" text
);
