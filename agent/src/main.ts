import { cli, defineAgent, inference, log, ServerOptions, voice } from '@livekit/agents';
import { VAD } from '@livekit/agents-plugin-silero';
import { TTS as OpenAITTS } from '@livekit/agents-plugin-openai';
import { turnDetector } from '@livekit/agents-plugin-livekit';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent.js';
import { ArenaAgent, type ArenaMetadata, buildArenaGreeting } from './arena-agent.js';
import { MultiVoiceTTS } from './multi-voice-tts.js';

dotenv.config({ path: '.env.local' });

const isDev = process.argv.includes('dev');

const getLogger = () => log();

const OPENAI_ARENA_VOICES = [
  'onyx',    // deep male
  'shimmer', // bright female
  'ash',     // male
  'nova',    // warm female
  'echo',    // male (distinct from ash)
  'coral',   // female
  'fable',   // male (British)
  'sage',    // neutral/female
  'ballad',  // male (warm, narrative)
  'alloy',   // neutral
] as const;

/**
 * Build TTS instructions from agent name and persona so gpt-4o-mini-tts
 * speaks in character with appropriate tone, pacing, and vocal quality.
 */
function buildCloudTTSInstructions(
  agentName: string,
  agentInstructions: string,
): string {
  const parts: string[] = [];
  parts.push(`Speak as ${agentName}.`);
  if (agentInstructions) {
    const trimmed = agentInstructions.slice(0, 200);
    parts.push(`Character: ${trimmed}`);
  }
  parts.push('Stay in character with appropriate tone, pacing, and vocal quality.');
  return parts.join(' ');
}

const FOLLOW_UP_TIMEOUT_MS = 5000;

interface AgentOnlyState {
  windingDown: boolean;
  windDownTurnsRemaining: number;
}

/**
 * Set up follow-up turn logic so agents respond to each other.
 *
 * In human_collab mode (default): capped at MAX_FOLLOW_UPS (3) consecutive
 * follow-up turns before waiting for the next human input.
 *
 * In agent_only mode: higher follow-up limit (10), and when reached, resets
 * and triggers a continuation prompt instead of stopping. [DONE] triggers
 * a new discussion angle after a brief pause.
 */
function setupFollowUpTurns(
  session: voice.AgentSession,
  isAgentOnly = false,
  state?: AgentOnlyState,
): void {
  const MAX_FOLLOW_UPS = isAgentOnly ? 10 : 3;
  let followUpCount = 0;
  let lastFollowUpSpeaker: string | null = null;

  const speakerTagRegex = /^\[([^\]]+)\]:\s*/;

  session.on(voice.AgentSessionEventTypes.Close, () => {
    followUpCount = 0;
    lastFollowUpSpeaker = null;
  });

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    if (ev.item.role === 'user') {
      if (!isAgentOnly) {
        followUpCount = 0;
        lastFollowUpSpeaker = null;
      }
      return;
    }

    if (ev.item.role !== 'assistant') return;

    const text = ev.item.textContent ?? '';

    // --- Wind-down branch ---
    if (state?.windingDown) {
      if (text.includes('[DONE]')) {
        followUpCount = 0;
        lastFollowUpSpeaker = null;
        getLogger().info('Wind-down complete — [DONE] received, disconnecting shortly');
        setTimeout(() => {
          session.close().catch(() => {});
        }, 3000);
        return;
      }

      state.windDownTurnsRemaining--;

      if (state.windDownTurnsRemaining > 0) {
        try {
          session.generateReply({
            userInput:
              '[System: Continue wrapping up. Another participant may give their brief final thought. If all participants have spoken their closing thoughts, respond with [DONE].]',
          });
        } catch (err) {
          getLogger().warn(
            { error: err instanceof Error ? err.message : String(err) },
            'Wind-down follow-up failed',
          );
        }
      }
      return;
    }

    // Check if conversation point is complete
    if (text.includes('[DONE]')) {
      followUpCount = 0;
      lastFollowUpSpeaker = null;

      if (isAgentOnly) {
        setTimeout(() => {
          try {
            session.generateReply({
              userInput:
                '[System: The current discussion point is complete. Bring up a new angle, ask a follow-up question, or explore a related aspect of the topic. Continue naturally.]',
            });
          } catch (err) {
            getLogger().warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Agent-only continuation after [DONE] failed',
            );
          }
        }, 2500);
      }
      return;
    }

    // Max follow-ups reached
    if (followUpCount >= MAX_FOLLOW_UPS) {
      followUpCount = 0;
      lastFollowUpSpeaker = null;

      if (isAgentOnly) {
        setTimeout(() => {
          try {
            session.generateReply({
              userInput:
                '[System: Continue the discussion. A different character should speak next with a fresh perspective.]',
            });
          } catch (err) {
            getLogger().warn(
              { error: err instanceof Error ? err.message : String(err) },
              'Agent-only continuation after max follow-ups failed',
            );
          }
        }, 2000);
      }
      return;
    }

    // Parse speaker from the response
    const match = text.match(speakerTagRegex);
    const speaker = match ? match[1] : null;

    // Avoid same agent speaking twice in a row
    if (speaker && speaker === lastFollowUpSpeaker) {
      followUpCount = 0;
      lastFollowUpSpeaker = null;
      return;
    }

    lastFollowUpSpeaker = speaker;
    followUpCount++;

    // Trigger follow-up turn
    try {
      session.generateReply({
        userInput:
          '[System: Another character may respond if they have something relevant to add. If the conversation point is complete, respond with only: [DONE]]',
      });
    } catch (err) {
      getLogger().warn(
        {
          error: err instanceof Error ? err.message : String(err),
          followUpCount,
          lastSpeaker: lastFollowUpSpeaker,
        },
        'Follow-up turn failed — continuing session',
      );
      followUpCount = 0;
      lastFollowUpSpeaker = null;
    }

    // Safety: reset follow-up state if no response arrives within timeout
    setTimeout(() => {
      if (followUpCount > MAX_FOLLOW_UPS) {
        followUpCount = 0;
        lastFollowUpSpeaker = null;
      }
    }, FOLLOW_UP_TIMEOUT_MS);
  });
}

/**
 * Set up wind-down and hard-disconnect timers for agent-only mode.
 */
function setupAgentOnlyTimeout(
  ctx: { room: { disconnect: () => Promise<void>; once: (event: string, cb: () => void) => void } },
  session: voice.AgentSession,
  maxDurationSeconds: number,
  state: AgentOnlyState,
): void {
  const threshold = Math.min(60, Math.max(30, Math.floor(maxDurationSeconds * 0.1)));
  const windDownMs = Math.max(0, (maxDurationSeconds - threshold) * 1000);

  getLogger().info(
    { maxDurationSeconds, threshold, windDownAt: maxDurationSeconds - threshold },
    'Agent-only timeout configured',
  );

  const windDownTimer = setTimeout(() => {
    state.windingDown = true;
    state.windDownTurnsRemaining = 2;

    getLogger().info(
      { remainingSeconds: threshold },
      'Agent-only mode: wind-down phase started',
    );

    try {
      session.generateReply({
        userInput: `[System: The discussion is nearing its end. Begin wrapping up — give a brief closing thought that summarizes your perspective. Each character should give one final brief thought. When all have spoken, respond with [DONE].]`,
      });
    } catch (err) {
      getLogger().warn(
        { error: err instanceof Error ? err.message : String(err) },
        'Failed to send wind-down prompt',
      );
    }
  }, windDownMs);

  const hardTimer = setTimeout(async () => {
    getLogger().info(
      { maxDurationSeconds },
      'Agent-only mode: max duration reached, disconnecting',
    );
    try {
      await ctx.room.disconnect();
    } catch (err) {
      getLogger().warn(
        { error: err instanceof Error ? err.message : String(err) },
        'Error disconnecting after agent-only timeout',
      );
    }
  }, maxDurationSeconds * 1000);

  ctx.room.once('disconnected', () => {
    clearTimeout(windDownTimer);
    clearTimeout(hardTimer);
  });
}

function parseArenaMetadata(raw: string | undefined): ArenaMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'arena' && Array.isArray(parsed.agents)) {
      return parsed as ArenaMetadata;
    }
  } catch {
    // Not JSON or not arena metadata — fall through to default agent
  }
  return null;
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await VAD.load();
  },
  entry: async (ctx) => {
    const logger = log();
    const roomName = ctx.room.name;
    const participantIdentity = ctx.room.localParticipant?.identity ?? 'unknown';

    // Connect first: required to read room.metadata (arena) and for session.start()
    await ctx.connect();

    const arenaMetadata = parseArenaMetadata(ctx.room.metadata);

    // ── Non-arena (single agent) flow ──────────────────────────────
    if (!arenaMetadata) {
      const agent = new Agent();
      const session = new voice.AgentSession({
        stt: new inference.STT({ model: 'deepgram/nova-3', language: 'multi' }),
        llm: new inference.LLM({ model: 'openai/gpt-4.1-mini' }),
        tts: new inference.TTS({ model: 'cartesia/sonic-3', voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc' }),
        vad: ctx.proc.userData.vad as VAD,
        turnDetection: new turnDetector.MultilingualModel(),
        voiceOptions: {
          allowInterruptions: true,
          minInterruptionDuration: 300,
          minEndpointingDelay: 300,
          maxEndpointingDelay: 3000,
        },
      });

      session.on(voice.AgentSessionEventTypes.Close, (ev) => {
        logger.info(
          `Session closed [room=${roomName}, participant=${participantIdentity}, reason=${ev.reason}]`,
        );
      });

      if (isDev) {
        session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
          logger.debug(`Agent state: ${ev.oldState} → ${ev.newState} [room=${roomName}]`);
        });
      }

      try {
        await session.start({
          agent,
          room: ctx.room,
          inputOptions: { noiseCancellation: BackgroundVoiceCancellation() },
        });
      } catch (error) {
        logger.error(
          `Failed to start agent session [room=${roomName}, participant=${participantIdentity}]: ${error}`,
        );
        throw error;
      }

      // Do not block on waitForParticipant() here; dispatch can happen after
      // the user already joined, which would deadlock the opening turn.
      setTimeout(() => {
        try {
          session.generateReply({
            userInput: '[System: Greet the user and offer your assistance.]',
          });
        } catch (err) {
          logger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            'Failed to send initial greeting',
          );
        }
      }, 500);
      return;
    }

    // ── Arena flow ─────────────────────────────────────────────────
    logger.info(
      `Arena session [room=${roomName}, personas=${arenaMetadata.agents.map((a) => a.name).join(',')}]`,
    );

    const agent = new ArenaAgent(arenaMetadata);

    // Build MultiVoiceTTS with OpenAI gpt-4o-mini-tts voices per agent
    const multiVoiceTTS = new MultiVoiceTTS();
    for (let i = 0; i < arenaMetadata.agents.length; i++) {
      const persona = arenaMetadata.agents[i];
      const voiceName = OPENAI_ARENA_VOICES[i % OPENAI_ARENA_VOICES.length];
      const cloudTTS = new OpenAITTS({
        model: 'gpt-4o-mini-tts',
        voice: voiceName,
        instructions: buildCloudTTSInstructions(persona.name, persona.instructions),
      });
      multiVoiceTTS.addVoice(persona.name, cloudTTS);
    }

    logger.info(
      { agentCount: arenaMetadata.agents.length, provider: 'openai' },
      'Arena cloud TTS voices configured',
    );

    const session = new voice.AgentSession({
      stt: new inference.STT({ model: 'deepgram/nova-3', language: 'multi' }),
      llm: new inference.LLM({ model: 'openai/gpt-4.1-mini' }),
      tts: multiVoiceTTS,
      vad: ctx.proc.userData.vad as VAD,
      turnDetection: new turnDetector.MultilingualModel(),
      voiceOptions: {
        allowInterruptions: true,
        minInterruptionDuration: 300,
        minEndpointingDelay: 300,
        maxEndpointingDelay: 3000,
      },
    });

    session.on(voice.AgentSessionEventTypes.Close, (ev) => {
      logger.info(
        `Session closed [room=${roomName}, participant=${participantIdentity}, reason=${ev.reason}]`,
      );
    });

    if (isDev) {
      session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
        logger.debug(`Agent state: ${ev.oldState} → ${ev.newState} [room=${roomName}]`);
      });
    }

    try {
      await session.start({
        agent,
        room: ctx.room,
        inputOptions: { noiseCancellation: BackgroundVoiceCancellation() },
      });
    } catch (error) {
      logger.error(
        `Failed to start arena session [room=${roomName}, participant=${participantIdentity}]: ${error}`,
      );
      throw error;
    }

    // Set up follow-up turns so agents respond to each other
    const isAgentOnly = arenaMetadata.participationMode === 'agent_only';
    const agentOnlyState: AgentOnlyState | undefined = isAgentOnly
      ? { windingDown: false, windDownTurnsRemaining: 0 }
      : undefined;

    setupFollowUpTurns(session, isAgentOnly, agentOnlyState);

    // Agent-only mode: wait for participant then kick off conversation
    if (isAgentOnly) {
      const participant = await ctx.waitForParticipant();
      logger.info(
        { identity: participant.identity },
        'Arena observer joined — starting agent-only conversation',
      );

      // Small delay to let the room settle
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        session.generateReply({
          userInput: `[System: Begin the discussion. The topic is: ${arenaMetadata.topic ?? 'general conversation'}. Start naturally as one of the characters. Keep your response conversational and brief (1-3 sentences).]`,
        });
      } catch (err) {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          'Failed to kick off agent-only conversation',
        );
      }
    } else {
      // Do not block on waitForParticipant() here; the participant may
      // already be in-room before this worker starts.
      const greeting = buildArenaGreeting(arenaMetadata);
      setTimeout(() => {
        try {
          session.generateReply({
            userInput: `[System: ${greeting} Keep it brief (1-2 sentences).]`,
          });
        } catch (err) {
          logger.warn(
            { error: err instanceof Error ? err.message : String(err) },
            'Failed to send arena opening turn',
          );
        }
      }, 500);
    }
  },
});

// SIGINT and SIGTERM are handled by cli.runApp — it drains connections in production
// and closes immediately in dev mode. Double Ctrl+C forces an immediate exit.
cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'siestai-agent' }));
