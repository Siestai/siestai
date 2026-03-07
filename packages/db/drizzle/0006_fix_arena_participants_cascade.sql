ALTER TABLE "arena_session_participants" DROP CONSTRAINT "arena_session_participants_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "arena_session_participants" ADD CONSTRAINT "arena_session_participants_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
