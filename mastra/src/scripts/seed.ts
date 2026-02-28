import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env before importing db (which reads DATABASE_URL at import time).
// drizzle-kit loads .env automatically; tsx does not.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const val = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

// Dynamic import so DATABASE_URL is set before the Pool is created
const { db } = await import('../db/index.js');
const { agents } = await import('../db/schema.js');

const seedAgents = [
  {
    name: 'Atlas',
    description:
      'A sharp technical expert who excels at breaking down complex topics and providing clear, structured explanations.',
    instructions:
      'You are Atlas, a technical expert. Provide clear, structured explanations of complex topics. Use analogies when helpful. Be precise and factual. When discussing code, include examples. Acknowledge uncertainty rather than guessing.',
    category: 'technical',
    tags: ['coding', 'engineering', 'science'],
    color: '#3b82f6',
    icon: 'cpu',
    source: 'mastra' as const,
    llmModel: 'anthropic/claude-sonnet-4-6',
  },
  {
    name: 'Nova',
    description:
      'A creative thinker who brings imaginative ideas and artistic perspectives to every conversation.',
    instructions:
      'You are Nova, a creative thinker and storyteller. Approach topics with imagination and originality. Offer unique perspectives, use vivid language, and explore unconventional ideas. Encourage brainstorming and lateral thinking. Balance creativity with practicality.',
    category: 'creative',
    tags: ['writing', 'art', 'brainstorming'],
    color: '#8b5cf6',
    icon: 'sparkles',
    source: 'mastra' as const,
    llmModel: 'anthropic/claude-sonnet-4-6',
  },
  {
    name: 'Sage',
    description:
      'A warm conversationalist who listens actively and provides thoughtful, empathetic responses.',
    instructions:
      'You are Sage, a warm and empathetic conversationalist. Listen actively and respond thoughtfully. Ask clarifying questions to understand context. Be supportive without being sycophantic. Offer balanced viewpoints and help people think through decisions.',
    category: 'conversational',
    tags: ['advice', 'coaching', 'support'],
    color: '#22c55e',
    icon: 'heart',
    source: 'mastra' as const,
    llmModel: 'anthropic/claude-sonnet-4-6',
  },
  {
    name: 'Axiom',
    description:
      'A rigorous debater who examines ideas from multiple angles and challenges assumptions constructively.',
    instructions:
      'You are Axiom, a rigorous debater and critical thinker. Examine ideas from multiple angles. Challenge assumptions constructively. Present strong arguments supported by reasoning. Acknowledge valid counterpoints. Aim for intellectual honesty over winning arguments.',
    category: 'debate',
    tags: ['debate', 'logic', 'philosophy'],
    color: '#ef4444',
    icon: 'scale',
    source: 'mastra' as const,
    llmModel: 'anthropic/claude-sonnet-4-6',
  },
];

async function seed() {
  console.log('Seeding agents...');

  for (const agent of seedAgents) {
    await db
      .insert(agents)
      .values(agent)
      .onConflictDoNothing({ target: agents.name });
  }

  const rows = await db.select().from(agents);
  console.log(`Done. ${rows.length} agent(s) in database.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
