-- Phase 1: Memory Architecture Migration
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Rename old agent_memories to legacy
ALTER TABLE IF EXISTS "agent_memories" RENAME TO "agent_memories_legacy";

-- Teams
CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "description" text DEFAULT '',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "role" varchar(50) DEFAULT 'member',
  "joined_at" timestamp DEFAULT now(),
  CONSTRAINT "team_agents_team_agent_unique" UNIQUE("team_id", "agent_id")
);

-- MD Files
CREATE TABLE IF NOT EXISTS "agent_md_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "file_key" varchar(20) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp DEFAULT now(),
  "updated_by" varchar(10) DEFAULT 'system',
  CONSTRAINT "agent_md_files_agent_key_unique" UNIQUE("agent_id", "file_key")
);

CREATE TABLE IF NOT EXISTS "team_md_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "file_key" varchar(20) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp DEFAULT now(),
  "updated_by" varchar(10) DEFAULT 'system',
  CONSTRAINT "team_md_files_team_key_unique" UNIQUE("team_id", "file_key")
);

-- Add teamId to arena_sessions
ALTER TABLE "arena_sessions" ADD COLUMN IF NOT EXISTS "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL;

-- New agent_memories (vector-backed)
CREATE TABLE IF NOT EXISTS "agent_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "memory_type" varchar(30) NOT NULL,
  "source_session_id" uuid REFERENCES "arena_sessions"("id") ON DELETE SET NULL,
  "importance" real DEFAULT 0.5,
  "created_at" timestamp DEFAULT now(),
  "last_accessed_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_memories_agent_id_idx" ON "agent_memories" ("agent_id");

-- Team memories
CREATE TABLE IF NOT EXISTS "team_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "memory_type" varchar(30) NOT NULL,
  "source_session_id" uuid REFERENCES "arena_sessions"("id") ON DELETE SET NULL,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "importance" real DEFAULT 0.5,
  "created_at" timestamp DEFAULT now(),
  "last_accessed_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "team_memories_team_id_idx" ON "team_memories" ("team_id");

-- Ad-hoc memories
CREATE TABLE IF NOT EXISTS "adhoc_memories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "memory_type" varchar(30) NOT NULL,
  "source_session_id" uuid REFERENCES "arena_sessions"("id") ON DELETE SET NULL,
  "participant_agent_ids" jsonb DEFAULT '[]',
  "importance" real DEFAULT 0.5,
  "created_at" timestamp DEFAULT now(),
  "last_accessed_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "adhoc_memories_user_id_idx" ON "adhoc_memories" ("user_id");

-- Daily memory files
CREATE TABLE IF NOT EXISTS "daily_memory_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" varchar(10) NOT NULL,
  "scope_id" uuid NOT NULL,
  "date" date NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "embedding" vector(1536),
  "status" varchar(10) NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "daily_memory_files_scope_date_unique" UNIQUE("scope_type", "scope_id", "date")
);

CREATE INDEX IF NOT EXISTS "daily_memory_files_scope_idx" ON "daily_memory_files" ("scope_type", "scope_id");

-- Arena session briefs
CREATE TABLE IF NOT EXISTS "arena_session_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "arena_sessions"("id") ON DELETE CASCADE,
  "decisions" jsonb DEFAULT '[]',
  "action_items" jsonb DEFAULT '[]',
  "unresolved" jsonb DEFAULT '[]',
  "next_session_questions" jsonb DEFAULT '[]',
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "arena_session_briefs_session_id_unique" UNIQUE("session_id")
);

-- HNSW indexes for vector similarity search
CREATE INDEX IF NOT EXISTS "agent_memories_embedding_idx" ON "agent_memories" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "team_memories_embedding_idx" ON "team_memories" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "adhoc_memories_embedding_idx" ON "adhoc_memories" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "daily_memory_files_embedding_idx" ON "daily_memory_files" USING hnsw ("embedding" vector_cosine_ops);
