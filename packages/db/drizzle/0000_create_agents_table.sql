CREATE TYPE "public"."agent_source" AS ENUM('mastra', 'livekit', 'external');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '',
	"instructions" text NOT NULL,
	"category" varchar(50) DEFAULT 'conversational',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"color" varchar(7) DEFAULT '#3b82f6',
	"icon" varchar(50) DEFAULT 'bot',
	"source" "agent_source" DEFAULT 'mastra',
	"llm_model" varchar(100),
	"is_online" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agents_name_unique" UNIQUE("name")
);
