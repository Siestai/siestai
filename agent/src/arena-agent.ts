import { voice } from '@livekit/agents';

interface ArenaPersona {
  name: string;
  instructions: string;
}

export interface ArenaMetadata {
  type: 'arena';
  agents: ArenaPersona[];
  mode: string;
  topic?: string;
  participationMode: string;
}

function buildArenaInstructions(metadata: ArenaMetadata): string {
  const personaList = metadata.agents
    .map((a) => `- ${a.name}${a.instructions ? `: ${a.instructions}` : ''}`)
    .join('\n');

  const lines: string[] = [
    'You are a multi-persona conversation orchestrator.',
    'You embody the following personas and speak as each of them in turn:',
    personaList,
    '',
    'CRITICAL RULES:',
    '- You MUST prefix EVERY response with [PersonaName]: where PersonaName is the exact name of the speaking persona.',
    '- Use natural spoken language — no markdown, no emojis, no formatting.',
    '- Keep each persona response concise (1-3 sentences).',
    '- Each response should be from ONE persona only.',
  ];

  if (metadata.topic) {
    lines.push(`- The discussion topic is: ${metadata.topic}`);
  }

  if (metadata.participationMode === 'agent_only') {
    lines.push(
      '',
      'MODE: Agent-only discussion.',
      '- Simulate a multi-turn conversation between the personas.',
      '- Alternate between different personas naturally.',
      '- Each persona should respond to or build upon what the previous persona said.',
      '- Drive the conversation forward with diverse perspectives.',
    );
  } else {
    lines.push(
      '',
      'MODE: Human collaboration.',
      '- When the user speaks, have the most relevant persona respond.',
      '- Different personas may chime in if their expertise is relevant.',
      '- Keep the conversation natural and engaging with the human participant.',
    );
  }

  return lines.join('\n');
}

export class ArenaAgent extends voice.Agent {
  constructor(metadata: ArenaMetadata) {
    super({ instructions: buildArenaInstructions(metadata) });
  }
}

export function buildArenaGreeting(metadata: ArenaMetadata): string {
  const firstName = metadata.agents[0]?.name ?? 'Agent';
  const topic = metadata.topic;

  if (metadata.participationMode === 'agent_only' && topic) {
    return `Begin the discussion on the topic: "${topic}". Start as [${firstName}] and introduce the topic, then continue the conversation by alternating between personas.`;
  }

  if (topic) {
    return `Greet the user as [${firstName}] and introduce the discussion topic: "${topic}". Invite the user to join the conversation.`;
  }

  return `Greet the user as [${firstName}] and ask what they would like to discuss.`;
}
