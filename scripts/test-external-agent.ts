// Resolve 'ws' from backend/node_modules since this script runs from project root
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws') as typeof import('ws').default;

// --- CLI argument parsing ---
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const baseUrl = getArg('url', 'http://localhost:4200');
const agentName = getArg('name', 'TestBot');
const sessionIdArg = getArg('session-id', '');

const TIMEOUT_MS = 60_000;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${msg}`);
}

/**
 * Extract invite token from either a raw token string or a full invite URL.
 * Accepts: full URL (http://localhost:3000/arena/join?t=xxx) or bare token (eyJ...)
 */
function extractToken(input: string): string {
  try {
    const url = new URL(input);
    const t = url.searchParams.get('t');
    if (t) {
      log(`Extracted token from invite URL`);
      return t;
    }
  } catch {
    // Not a URL — treat as raw token
  }
  return input;
}

async function createSession(): Promise<{ sessionId: string; token: string; inviteUrl: string }> {
  log('Creating new arena session...');
  const res = await fetch(`${baseUrl}/arena/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'Test session for external agent',
      mode: 'group',
      participationMode: 'human_collab',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const sessionId = data.session.id;
  const token = data.invite.token;
  const inviteUrl = data.invite.url;
  log(`Session created: ${sessionId}`);
  log(`Invite URL: ${inviteUrl}`);
  return { sessionId, token, inviteUrl };
}

async function joinArena(token: string): Promise<{ sessionId: string; wsUrl: string }> {
  log(`Joining arena as "${agentName}"...`);
  const res = await fetch(`${baseUrl}/arena/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      agentName,
      platform: 'test-script',
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to join arena: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  log(`Joined session ${data.sessionId} as participant ${data.participant.id}`);
  return { sessionId: data.sessionId, wsUrl: data.wsUrl };
}

function connectWebSocket(token: string) {
  const wsBase = baseUrl.replace(/^http/, 'ws');
  const wsUrl = `${wsBase}/arena/ws?token=${token}`;
  log(`Connecting WebSocket to ${wsUrl}`);

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    log('WebSocket connected');
    const identify = JSON.stringify({
      type: 'identify',
      name: agentName,
      platform: 'test-script',
    });
    ws.send(identify);
    log(`Sent identify: ${identify}`);
  });

  ws.on('message', (raw: Buffer | string) => {
    const text = typeof raw === 'string' ? raw : raw.toString();
    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(text);
    } catch {
      log(`Received non-JSON: ${text}`);
      return;
    }

    switch (msg.type) {
      case 'welcome':
        log(`Welcome! Session: ${msg.sessionId}, Participants: ${(msg.participants as unknown[]).length}`);
        break;
      case 'transcript':
        log(`[${msg.speaker}] (transcript): ${msg.text}`);
        scheduleResponse(ws, String(msg.text));
        break;
      case 'agent_message':
        log(`[${msg.speaker}] (agent): ${msg.text}`);
        scheduleResponse(ws, String(msg.text));
        break;
      case 'system':
        log(`System: ${msg.event} — ${JSON.stringify(msg.participant)}`);
        break;
      case 'session_ended':
        log('Session ended. Disconnecting.');
        ws.close();
        process.exit(0);
        break;
      case 'error':
        log(`Error from server: ${msg.message}`);
        break;
      default:
        log(`Unknown message type: ${text}`);
    }
  });

  ws.on('close', () => {
    log('WebSocket closed');
    process.exit(0);
  });

  ws.on('error', (err: Error) => {
    log(`WebSocket error: ${err.message}`);
    process.exit(1);
  });

  return ws;
}

function scheduleResponse(ws: InstanceType<typeof WebSocket>, receivedText: string) {
  const preview = receivedText.slice(0, 50);
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const response = JSON.stringify({
        type: 'message',
        text: `${agentName} responding to: ${preview}`,
      });
      ws.send(response);
      log(`Sent response: ${response}`);
    }
  }, 2000);
}

async function main() {
  let token: string;

  if (sessionIdArg) {
    // Accept either a full invite URL or a bare token
    token = extractToken(sessionIdArg);
    log(`Using provided invite token (first 20 chars): ${token.slice(0, 20)}...`);
  } else {
    const result = await createSession();
    token = result.token;
  }

  await joinArena(token);
  connectWebSocket(token);

  // Auto-disconnect after timeout
  setTimeout(() => {
    log(`Timeout reached (${TIMEOUT_MS / 1000}s). Disconnecting.`);
    process.exit(0);
  }, TIMEOUT_MS);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
