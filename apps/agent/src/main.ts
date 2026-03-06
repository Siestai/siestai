import { cli, defineAgent, log, ServerOptions, voice } from '@livekit/agents';
import { Room, RoomEvent, DataPacketKind, RemoteParticipant } from '@livekit/rtc-node';
import { VAD } from '@livekit/agents-plugin-silero';
import { LLM as OpenAILLM, STT as OpenAISTT, TTS as OpenAITTS } from '@livekit/agents-plugin-openai';
import { turnDetector } from '@livekit/agents-plugin-livekit';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent.js';
import { ArenaAgent, type ArenaMetadata, buildArenaGreeting } from './arena-agent.js';
import { MultiVoiceTTS } from './multi-voice-tts.js';
import { DIRECT_PROVIDER_CONFIG } from './provider-config.js';
import { ToolExecutor } from './tool-executor.js';

dotenv.config({ path: '.env.local' });

const isLocalLivekit = process.env.LIVEKIT_ENVIRONMENT === 'local';
if (isLocalLivekit) {
  process.env.LIVEKIT_URL = 'ws://localhost:7880';
  process.env.LIVEKIT_API_KEY = 'devkey';
  process.env.LIVEKIT_API_SECRET = 'secret';
}

const isDev = process.argv.includes('dev');

const getLogger = () => log();

process.on('uncaughtException', (err) => {
  getLogger().error({ err }, 'Uncaught exception in agent process');
});
process.on('unhandledRejection', (reason) => {
  getLogger().error({ reason }, 'Unhandled promise rejection in agent process');
});

const REQUIRED_ENV = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'OPENAI_API_KEY'] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const logger = getLogger();
    logger.error(
      { missing },
      `Missing required environment variables — agent will not function correctly`,
    );
  }
}

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

/**
 * Post an assistant transcript to the backend so it can be broadcast to WS clients.
 * Failures are logged and swallowed — never disrupts voice flow.
 */
async function postTranscript(
  backendUrl: string,
  sessionId: string,
  speaker: string,
  text: string,
): Promise<void> {
  try {
    const res = await fetch(`${backendUrl}/arena/sessions/${sessionId}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speaker, text, timestamp: Date.now() }),
    });
    if (!res.ok) {
      log().warn(
        { status: res.status, sessionId },
        'Transcript POST returned non-OK status',
      );
    }
  } catch (err) {
    log().warn(
      { error: err instanceof Error ? err.message : String(err), sessionId },
      'Failed to post transcript to backend — continuing',
    );
  }
}

/**
 * Subscribe to assistant ConversationItemAdded events and POST transcripts
 * to the backend for bridging to WS clients.
 */
function setupTranscriptPosting(
  session: voice.AgentSession,
  backendUrl: string,
  sessionId: string,
): void {
  const speakerTagRegex = /^\[([^\]]+)\]:\s*/;

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    const text = ev.item.textContent ?? '';
    if (!text) return;

    // Capture human (user) speech from STT
    if (ev.item.role === 'user') {
      // Skip system injections (follow-up prompts, external agent bridging, etc.)
      if (text.startsWith('[System:') || text.startsWith('[External agent') || text.startsWith('[TOOL_RESULT]')) return;
      postTranscript(backendUrl, sessionId, 'You', text);
      return;
    }

    if (ev.item.role !== 'assistant') return;
    if (text.includes('[DONE]')) return;

    // Parse speaker from [Name]: text format
    const match = text.match(speakerTagRegex);
    const speaker = match ? match[1] : 'Agent';
    const cleanText = match ? text.slice(match[0].length) : text;

    // Fire-and-forget — never await in an event handler
    postTranscript(backendUrl, sessionId, speaker, cleanText);
  });
}

/**
 * Listen for LiveKit data channel messages from external agents and inject
 * them into the LLM conversation. Includes a 1-second cooldown to avoid
 * flooding the model with rapid-fire external messages.
 */
function setupDataChannelListener(
  room: Room,
  session: voice.AgentSession,
): void {
  let lastInjectionTime = 0;
  const COOLDOWN_MS = 1000;

  room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant?: RemoteParticipant, _kind?: DataPacketKind, topic?: string) => {
    if (topic !== 'external-agent-msg') return;

    let msg: { type?: string; speaker?: string; text?: string };
    try {
      const raw = new TextDecoder().decode(payload);
      msg = JSON.parse(raw);
    } catch {
      log().debug('Ignoring unparseable data channel message');
      return;
    }

    if (msg.type !== 'external_agent_message' || !msg.speaker || !msg.text) {
      return;
    }

    const now = Date.now();
    if (now - lastInjectionTime < COOLDOWN_MS) {
      log().debug(
        { speaker: msg.speaker },
        'External agent message throttled by cooldown',
      );
      return;
    }
    lastInjectionTime = now;

    log().debug(
      { speaker: msg.speaker, textLength: msg.text.length },
      'Injecting external agent message into conversation',
    );

    try {
      session.generateReply({
        userInput: `[External agent ${msg.speaker} says]: ${msg.text}`,
      });
    } catch (err) {
      log().warn(
        { error: err instanceof Error ? err.message : String(err), speaker: msg.speaker },
        'Failed to inject external agent message',
      );
    }
  });
}

/**
 * Detect [TOOL_CALL] patterns in assistant output, execute the tool
 * via the backend HTTP proxy, and inject the result back into the conversation.
 *
 * Pattern: [TOOL_CALL] slug: <slug>, action: <action>, params: <json>
 */
function setupToolCallHandler(
  session: voice.AgentSession,
  toolExecutor: ToolExecutor,
): void {
  const toolCallRegex =
    /\[TOOL_CALL\]\s*slug:\s*(\S+),\s*action:\s*(\S+),\s*params:\s*(\{.*\})/;

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    if (ev.item.role !== 'assistant') return;

    const text = ev.item.textContent ?? '';
    const match = text.match(toolCallRegex);
    if (!match) return;

    const slug = match[1];
    const action = match[2];
    let params: Record<string, unknown>;
    try {
      params = JSON.parse(match[3]);
    } catch {
      log().warn(
        { slug, action, raw: match[3] },
        'Failed to parse tool call params as JSON',
      );
      return;
    }

    log().info({ slug, action }, 'Detected tool call in assistant output — executing');

    // Fire-and-forget: execute tool and inject result
    toolExecutor
      .execute(slug, action, params)
      .then((result) => {
        try {
          session.generateReply({
            userInput: `[TOOL_RESULT] Tool: ${slug}, Result: ${result}`,
          });
        } catch (err) {
          log().warn(
            { error: err instanceof Error ? err.message : String(err), slug },
            'Failed to inject tool result into conversation',
          );
        }
      })
      .catch((err) => {
        log().warn(
          { error: err instanceof Error ? err.message : String(err), slug },
          'Tool execution promise rejected',
        );
      });
  });
}

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
    getLogger().debug({ parsedType: parsed?.type }, 'Room metadata present but not arena type');
  } catch (err) {
    getLogger().warn(
      { error: err instanceof Error ? err.message : String(err), metadataLength: raw.length },
      'Failed to parse room metadata as JSON — falling back to default agent',
    );
  }
  return null;
}

export default defineAgent({
  prewarm: async (proc) => {
    validateEnv();
    proc.userData.vad = await VAD.load();
  },
  entry: async (ctx) => {
    const logger = log();
    const roomName = ctx.room.name;
    const participantIdentity = ctx.room.localParticipant?.identity ?? 'unknown';

    // Connect first: required to read room.metadata (arena) and for session.start()
    await ctx.connect();

    const arenaMetadata = parseArenaMetadata(ctx.room.metadata);
    logger.info(
      {
        room: roomName,
        hasArenaMetadata: Boolean(arenaMetadata),
        metadataBytes: Buffer.byteLength(ctx.room.metadata ?? '', 'utf8'),
      },
      'Connected to room',
    );

    // ── Non-arena (single agent) flow ──────────────────────────────
    if (!arenaMetadata) {
      const agent = new Agent();
      const session = new voice.AgentSession({
        stt: new OpenAISTT({
          model: DIRECT_PROVIDER_CONFIG.sttModel,
          detectLanguage: true,
        }),
        llm: new OpenAILLM({ model: DIRECT_PROVIDER_CONFIG.llmModel }),
        tts: new OpenAITTS({
          model: DIRECT_PROVIDER_CONFIG.ttsModel,
          voice: DIRECT_PROVIDER_CONFIG.singleAgentVoice,
        }),
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
        model: DIRECT_PROVIDER_CONFIG.ttsModel,
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
      stt: new OpenAISTT({
        model: DIRECT_PROVIDER_CONFIG.sttModel,
        detectLanguage: true,
      }),
      llm: new OpenAILLM({ model: DIRECT_PROVIDER_CONFIG.llmModel }),
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

    // Bridge: post assistant transcripts to backend for WS clients (LiveKit → WS)
    if (arenaMetadata.sessionId && arenaMetadata.backendUrl) {
      setupTranscriptPosting(session, arenaMetadata.backendUrl, arenaMetadata.sessionId);
      logger.info(
        { sessionId: arenaMetadata.sessionId, backendUrl: arenaMetadata.backendUrl },
        'Transcript posting bridge enabled',
      );
    } else {
      logger.warn('Missing sessionId or backendUrl in metadata — transcript posting disabled');
    }

    // Bridge: listen for external agent messages via data channel (WS → LiveKit)
    setupDataChannelListener(ctx.room, session);
    logger.info('Data channel listener for external agents enabled');

    // Tool execution: detect [TOOL_CALL] in assistant output and proxy to backend
    const hasTools = arenaMetadata.agents.some((a) => a.tools && a.tools.length > 0);
    if (hasTools && arenaMetadata.backendUrl && arenaMetadata.toolSecret) {
      const toolExecutor = new ToolExecutor(
        arenaMetadata.backendUrl,
        arenaMetadata.toolSecret,
      );
      setupToolCallHandler(session, toolExecutor);
      logger.info(
        { toolCount: arenaMetadata.agents.reduce((n, a) => n + (a.tools?.length ?? 0), 0) },
        'Tool call handler enabled',
      );
    } else if (hasTools) {
      logger.warn('Agents have tools but missing backendUrl or toolSecret — tool execution disabled');
    }

    // Agent-only mode: wait for participant then kick off conversation
    if (isAgentOnly) {
      // waitForParticipant can stall when observer was already present before dispatch;
      // use a timeout fallback so agent-only sessions always start.
      const participantOrTimeout = await Promise.race([
        ctx.waitForParticipant(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);
      if (participantOrTimeout) {
        logger.info(
          { identity: participantOrTimeout.identity },
          'Arena observer joined — starting agent-only conversation',
        );
      } else {
        logger.info(
          { room: roomName },
          'No new observer join event within timeout — starting agent-only conversation anyway',
        );
      }

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
cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'siestai-agent',
  numIdleProcesses: 2,
  jobMemoryWarnMB: 400,
  jobMemoryLimitMB: 600,
}));
