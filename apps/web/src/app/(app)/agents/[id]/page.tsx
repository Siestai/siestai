"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  ChevronLeft,
  MessageSquare,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentEditor } from "@/hooks/use-agent-editor";
import { AgentHeader } from "@/components/agents/detail/agent-header";
import { InstructionsSection } from "@/components/agents/detail/instructions-section";
import { ModelSection } from "@/components/agents/detail/model-section";
import { FilesSection } from "@/components/agents/detail/files-section";
import { ToolsSection } from "@/components/agents/detail/tools-section";
import { SkillsSection } from "@/components/agents/detail/skills-section";
import { SettingsSection } from "@/components/agents/detail/settings-section";
import { AgentMemories } from "@/components/agents/agent-memories";
import { api } from "@/lib/api";
import type { AgentFile } from "@/lib/types";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { agent, loading, saveStatus, updateField, updateFields, saveNow } =
    useAgentEditor(id);
  const [files, setFiles] = useState<AgentFile[]>([]);

  useEffect(() => {
    api.listAgentFiles(id).then(setFiles).catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-medium">Agent not found</h2>
        <Button asChild variant="outline">
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push(`/arena?agent_ids=${agent.id}`)}
          >
            <Users className="h-3.5 w-3.5" />
            Arena
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() =>
              router.push(
                `/live?agent_id=${agent.id}&agent_name=${encodeURIComponent(agent.name)}`
              )
            }
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </Button>
        </div>
      </div>

      {/* Header: avatar + name + description */}
      <AgentHeader
        agent={agent}
        onUpdate={updateField}
        onUpdateMultiple={updateFields}
      />

      {/* Divider sections */}
      <div className="space-y-8 divide-y divide-border [&>*:not(:first-child)]:pt-8">
        {/* System Prompt */}
        <InstructionsSection
          instructions={agent.instructions}
          saveStatus={saveStatus}
          onUpdate={(value) => updateField("instructions", value)}
          onBlur={saveNow}
        />

        {/* Model */}
        <ModelSection
          model={agent.llmModel}
          onUpdate={(value) => updateField("llmModel", value)}
        />

        {/* Knowledge / Files */}
        <FilesSection
          agentId={agent.id}
          files={files}
          onFilesChange={setFiles}
        />

        {/* Tools */}
        <ToolsSection agentId={agent.id} />

        {/* Skills */}
        <SkillsSection
          currentInstructions={agent.instructions}
          onApply={(updates) => updateFields(updates)}
        />

        {/* Memory */}
        <AgentMemories agentId={agent.id} />

        {/* Settings + Danger Zone */}
        <SettingsSection agent={agent} onUpdate={updateField} />
      </div>
    </div>
  );
}
