/**
 * Phase Detection Plugin for opencode
 *
 * Detects phase transitions by scanning assistant message text for
 * [PHASE: X] and [MODE: X] headers. This is the only reliable phase
 * signal -- opencode session metadata does not carry phase information.
 *
 * Other plugins subscribe to phase changes via getCurrentPhase().
 */

interface PhaseState {
  current: string;
  mode: string;
  lastProcessedMessageCount: number;
}

const phaseStates = new Map<string, PhaseState>();

const PHASE_RE = /^\[PHASE:\s*([A-Z_]+)\]/;
const MODE_RE = /^\[MODE:\s*(DIRECT|AUTO|STRUCTURED)\]/;

function detectPhaseAndMode(text: string): { phase?: string; mode?: string } {
  const result: { phase?: string; mode?: string } = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const phaseMatch = line.match(PHASE_RE);
    if (phaseMatch) {
      result.phase = phaseMatch[1];
      break;
    }
    const modeMatch = line.match(MODE_RE);
    if (modeMatch) {
      result.mode = modeMatch[1];
    }
  }
  return result;
}

export function getCurrentPhase(sessionId: string): string | undefined {
  return phaseStates.get(sessionId)?.current;
}

export function onPhaseChange(
  sessionId: string,
  fn: (phase: string, previous: string) => void,
): () => void {
  let lastKnown = phaseStates.get(sessionId)?.current;
  return () => {
    const current = phaseStates.get(sessionId)?.current;
    if (current && current !== lastKnown) {
      const previous = lastKnown;
      lastKnown = current;
      fn(current, previous ?? "STARTUP");
    }
  };
}

export default async ({ directory, worktree }: {
  client: any;
  $: any;
  project: any;
  directory: string;
  worktree: string;
}) => {
  return {
    event: async ({ event }: { event: any }) => {
      const sessionId = event.properties?.sessionID;
      if (!sessionId) return;

      if (event.type === "session.created") {
        phaseStates.set(sessionId, {
          current: "STARTUP",
          mode: "AUTO",
          lastProcessedMessageCount: 0,
        });
        return;
      }

      if (event.type === "session.deleted") {
        phaseStates.delete(sessionId);
        return;
      }
    },

    "experimental.chat.messages.transform": async ({
      output,
    }: {
      output: { messages: { info: any; parts: any[] }[] };
    }) => {
      const messages = output.messages;
      const totalCount = messages.length;
      if (totalCount === 0) return;

      const sessionId = messages[0]?.info?.sessionID;
      if (!sessionId) return;

      const state = phaseStates.get(sessionId);
      if (!state) return;

      if (totalCount <= state.lastProcessedMessageCount) return;

      let changed = false;
      for (let i = state.lastProcessedMessageCount; i < totalCount; i++) {
        const message = messages[i];
        if (!message.parts) continue;
        for (const part of message.parts) {
          if (part.type !== "text" || !part.text) continue;
          const detected = detectPhaseAndMode(part.text);
          if (detected.phase) {
            state.current = detected.phase;
            changed = true;
          }
          if (detected.mode) {
            state.mode = detected.mode;
          }
        }
      }

      state.lastProcessedMessageCount = totalCount;

      if (changed) {
        console.log(`[phase-detect] Session ${sessionId} phase: ${state.current}`);
      }
    },
  };
};
