"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { TeamFolder } from "@/components/teams/team-folder";
import { TeamFolderExpanded } from "@/components/teams/team-folder-expanded";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import type { Team, TeamAgent } from "@/lib/types";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamAgentsMap, setTeamAgentsMap] = useState<Record<string, TeamAgent[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      const data = await api.listTeams();
      setTeams(data);
      if (data.length > 0) {
        setLoadingAgents(true);
        const results = await Promise.all(
          data.map((t) => api.getTeamAgents(t.id))
        );
        const map: Record<string, TeamAgent[]> = {};
        data.forEach((t, i) => {
          map[t.id] = results[i];
        });
        setTeamAgentsMap(map);
        setLoadingAgents(false);
      }
    } catch (err) {
      console.error("Failed to load teams:", err);
    } finally {
      setLoading(false);
    }
  }

  const expandedTeam = teams.find((t) => t.id === expandedTeamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Persistent groups of agents with shared memory and goals
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No teams yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1 mb-4">
            Create a team to group agents with shared memory
          </p>
          <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Create Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 justify-items-center">
          {teams.map((team) => (
            <TeamFolder
              key={team.id}
              team={team}
              agents={teamAgentsMap[team.id] || []}
              loading={loadingAgents}
              onClick={() => setExpandedTeamId(team.id)}
            />
          ))}
        </div>
      )}

      {expandedTeam && (
        <TeamFolderExpanded
          team={expandedTeam}
          agents={teamAgentsMap[expandedTeam.id] || []}
          onClose={() => setExpandedTeamId(null)}
        />
      )}

      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadTeams}
      />
    </div>
  );
}
