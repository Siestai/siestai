CREATE TABLE "tool_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"scope" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tool_credentials_tool_id_user_id_unique" UNIQUE("tool_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "type" varchar(20) DEFAULT 'builtin' NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "slug" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "oauth_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "required_scopes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tool_credentials" ADD CONSTRAINT "tool_credentials_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_credentials" ADD CONSTRAINT "tool_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_slug_unique" UNIQUE("slug");
