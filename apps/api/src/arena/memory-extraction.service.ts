import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { ArenaTranscriptRow } from '@siestai/db';

interface ExtractedMemory {
  category: 'decision' | 'position' | 'task' | 'open_question' | 'learning';
  content: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ExtractedBrief {
  decisions: { text: string; confidence: string }[];
  actionItems: { owner: string; task: string; deadline?: string }[];
  unresolved: { topic: string; positions: string[] }[];
  nextSessionQuestions: string[];
}

const EXTRACTION_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class MemoryExtractionService {
  private readonly logger = new Logger(MemoryExtractionService.name);
  private readonly client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  formatTranscriptForExtraction(transcripts: ArenaTranscriptRow[]): string {
    return transcripts
      .map((t) => {
        const ts = t.timestamp
          ? new Date(t.timestamp).toISOString().slice(11, 19)
          : '??:??:??';
        return `[${ts}] ${t.speakerName} (${t.speakerType}): ${t.content}`;
      })
      .join('\n');
  }

  async extractAgentMemories(
    agentName: string,
    transcriptText: string,
  ): Promise<ExtractedMemory[]> {
    const response = await this.client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: `You extract structured episodic memories for an AI agent from a conversation transcript. Return ONLY a JSON array of memory objects. Each object has:
- "category": one of "decision", "position", "task", "open_question", "learning"
- "content": a concise statement (1-2 sentences) of what this agent should remember
- "confidence": "high", "medium", or "low"

Focus on what is most relevant for agent "${agentName}" to recall in future sessions. Extract 3-8 memories maximum. If the transcript is too short or contains no meaningful content for this agent, return an empty array [].`,
      messages: [
        {
          role: 'user',
          content: `Extract episodic memories for agent "${agentName}" from this transcript:\n\n${transcriptText}`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJsonArray<ExtractedMemory>(text);
  }

  async extractSessionBrief(
    transcriptText: string,
    agentNames: string[],
  ): Promise<ExtractedBrief> {
    const response = await this.client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: `You extract a structured session brief from a conversation transcript. Return ONLY a JSON object with these fields:
- "decisions": array of { "text": string, "confidence": "high"|"medium"|"low" } — key decisions made
- "actionItems": array of { "owner": string, "task": string, "deadline"?: string } — assigned tasks (owner should be an agent name or "human")
- "unresolved": array of { "topic": string, "positions": string[] } — unresolved topics with different viewpoints
- "nextSessionQuestions": string[] — questions to address in the next session

Participants: ${agentNames.join(', ')}. If the transcript is too short, return empty arrays for all fields.`,
      messages: [
        {
          role: 'user',
          content: `Extract a structured session brief from this transcript:\n\n${transcriptText}`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return this.parseJsonObject<ExtractedBrief>(text, {
      decisions: [],
      actionItems: [],
      unresolved: [],
      nextSessionQuestions: [],
    });
  }

  private parseJsonArray<T>(text: string): T[] {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]);
    } catch (e) {
      this.logger.warn(`Failed to parse JSON array from LLM response: ${e}`);
      return [];
    }
  }

  private parseJsonObject<T>(text: string, fallback: T): T {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      return JSON.parse(match[0]);
    } catch (e) {
      this.logger.warn(`Failed to parse JSON object from LLM response: ${e}`);
      return fallback;
    }
  }
}
