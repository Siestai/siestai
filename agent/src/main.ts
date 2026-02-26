import { cli, defineAgent, inference, log, ServerOptions, voice } from '@livekit/agents';
import { VAD } from '@livekit/agents-plugin-silero';
import { turnDetector } from '@livekit/agents-plugin-livekit';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent.js';

dotenv.config({ path: '.env.local' });

const isDev = process.argv.includes('dev');

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await VAD.load();
  },
  entry: async (ctx) => {
    const logger = log();
    const roomName = ctx.room.name;
    const participantIdentity = ctx.room.localParticipant?.identity ?? 'unknown';

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
        agent: new Agent(),
        room: ctx.room,
        inputOptions: { noiseCancellation: BackgroundVoiceCancellation() },
      });

      await ctx.connect();
    } catch (error) {
      logger.error(
        `Failed to start agent session [room=${roomName}, participant=${participantIdentity}]: ${error}`,
      );
      throw error;
    }

    session.generateReply({ instructions: 'Greet the user and offer your assistance.' });
  },
});

// SIGINT and SIGTERM are handled by cli.runApp — it drains connections in production
// and closes immediately in dev mode. Double Ctrl+C forces an immediate exit.
cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'siestai-agent' }));
