CREATE TABLE "arena_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text,
	"mode" varchar(50) NOT NULL,
	"participation_mode" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"room_name" varchar(255),
	"created_by" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arena_session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"agent_id" uuid,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"instructions" text,
	"color" varchar(7) DEFAULT '#3b82f6',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arena_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"speaker_name" varchar(100) NOT NULL,
	"speaker_type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"source" varchar(10) NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"category" varchar(30) NOT NULL,
	"content" text NOT NULL,
	"confidence" varchar(10) DEFAULT 'medium',
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "arena_session_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"decisions" jsonb DEFAULT '[]'::jsonb,
	"action_items" jsonb DEFAULT '[]'::jsonb,
	"unresolved" jsonb DEFAULT '[]'::jsonb,
	"next_session_questions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "arena_session_briefs_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "arena_sessions" ADD CONSTRAINT "arena_sessions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_session_participants" ADD CONSTRAINT "arena_session_participants_session_id_arena_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."arena_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_session_participants" ADD CONSTRAINT "arena_session_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_transcripts" ADD CONSTRAINT "arena_transcripts_session_id_arena_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."arena_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_session_id_arena_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."arena_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_session_briefs" ADD CONSTRAINT "arena_session_briefs_session_id_arena_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."arena_sessions"("id") ON DELETE cascade ON UPDATE no action;
