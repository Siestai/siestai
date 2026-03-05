import { Injectable, Logger } from '@nestjs/common';
import { MdFilesService } from './md-files.service';
import { MemoryService } from './memory.service';
import { DailyFileService } from './daily-file.service';

interface AssembleContextOptions {
  teamId?: string;
  sessionTopic?: string;
  tokenBudget?: number;
}

@Injectable()
export class ContextAssemblyService {
  private readonly logger = new Logger(ContextAssemblyService.name);

  constructor(
    private readonly mdFiles: MdFilesService,
    private readonly memory: MemoryService,
    private readonly dailyFiles: DailyFileService,
  ) {}

  async assembleContext(
    agentId: string,
    options: AssembleContextOptions = {},
  ): Promise<string> {
    const { teamId, sessionTopic, tokenBudget = 16000 } = options;
    const sections: string[] = [];
    let usedTokens = 0;

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    const addSection = (label: string, content: string, maxTokens?: number) => {
      if (!content.trim()) return;
      let text = content;
      const remaining = tokenBudget - usedTokens;
      if (remaining <= 0) return;
      const effectiveMax = maxTokens ? Math.min(maxTokens, remaining) : remaining;
      if (estimateTokens(text) > effectiveMax) {
        const maxChars = effectiveMax * 4;
        text = text.slice(0, maxChars) + '\n... [truncated]';
      }
      sections.push(`## ${label}\n${text}`);
      usedTokens += estimateTokens(text);
    };

    // Layer 1: IDENTITY.md + INSTRUCTIONS.md (never truncated)
    await this.mdFiles.ensureAgentMdFiles(agentId);
    const identity = await this.mdFiles.getAgentMdFile(agentId, 'IDENTITY');
    const instructions = await this.mdFiles.getAgentMdFile(agentId, 'INSTRUCTIONS');

    if (identity?.content) {
      addSection('Identity', identity.content);
    }
    if (instructions?.content) {
      addSection('Instructions', instructions.content);
    }

    // Layer 2: Team MD files (if in team context)
    if (teamId) {
      const teamGoals = await this.mdFiles.getTeamMdFile(teamId, 'GOALS');
      const teamContext = await this.mdFiles.getTeamMdFile(teamId, 'CONTEXT');
      const teamRules = await this.mdFiles.getTeamMdFile(teamId, 'RULES');

      if (teamGoals?.content) addSection('Team Goals', teamGoals.content);
      if (teamContext?.content) addSection('Team Context', teamContext.content);
      if (teamRules?.content) addSection('Team Rules', teamRules.content);
    }

    // Layer 3: Last 7 days daily files (~3000 tokens)
    const dailyScope = teamId ? 'team' : 'agent';
    const dailyScopeId = teamId ?? agentId;
    const recentDaily = await this.dailyFiles.getActiveDailyFiles(
      dailyScope as 'agent' | 'team',
      dailyScopeId,
      7,
    );

    if (recentDaily.length > 0) {
      const dailyContent = recentDaily
        .map((d) => `### ${d.date}\n${d.content}`)
        .join('\n\n');
      addSection('Recent Activity', dailyContent, 3000);
    }

    // Layer 4: Top-K team memories (~2000 tokens)
    if (teamId && sessionTopic) {
      try {
        const teamMems = await this.memory.searchTeamMemories(
          teamId,
          sessionTopic,
          5,
        );
        if (teamMems.length > 0) {
          const memContent = teamMems
            .map((m: any) => `- [${m.memory_type}] ${m.content}`)
            .join('\n');
          addSection('Team Knowledge', memContent, 2000);
        }
      } catch (err) {
        this.logger.warn(`Failed to search team memories: ${err}`);
      }
    }

    // Layer 5: Top-K agent memories (~1000 tokens)
    if (sessionTopic) {
      try {
        const agentMems = await this.memory.searchAgentMemories(
          agentId,
          sessionTopic,
          5,
        );
        if (agentMems.length > 0) {
          const memContent = agentMems
            .map((m: any) => `- [${m.memory_type}] ${m.content}`)
            .join('\n');
          addSection('Personal Memories', memContent, 1000);
        }
      } catch (err) {
        this.logger.warn(`Failed to search agent memories: ${err}`);
      }
    }

    // Layer 7: KNOWLEDGE.md (~2000 tokens)
    const knowledge = await this.mdFiles.getAgentMdFile(agentId, 'KNOWLEDGE');
    if (knowledge?.content) {
      addSection('Knowledge Base', knowledge.content, 2000);
    }

    return sections.join('\n\n');
  }
}
