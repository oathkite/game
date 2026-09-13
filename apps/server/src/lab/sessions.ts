import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

export type LabSession = { readonly playerId: string; socket: WebSocket | null; disconnectedAt: number | null };
export const createLabSessions = (now = Date.now) => {
  const sessions = new Map<string, LabSession>();
  const expired = (session: LabSession) => session.disconnectedAt !== null && now() - session.disconnectedAt >= 60000;
  return {
    expiredPlayerIds: () => [...sessions.values()].filter(expired).map(s => s.playerId),
    releaseExpired: () => { for (const [token, session] of sessions) if (expired(session)) sessions.delete(token); },
    values: () => sessions.values(),
    join(socket: WebSocket, order: readonly string[], token?: string) {
      if (token) {
        const session = sessions.get(token);
        if (!session || session.socket || session.disconnectedAt === null || now() - session.disconnectedAt >= 60000) {
          return { error: "invalid-session" } as const;
        }
        session.socket = socket; session.disconnectedAt = null;
        return { token, session } as const;
      }
      const playerId = order.find(id => ![...sessions.values()].some(s => s.playerId === id));
      if (!playerId) return { error: "full" } as const;
      const issued = randomUUID(), session: LabSession = { playerId, socket, disconnectedAt: null };
      sessions.set(issued, session);
      return { token: issued, session } as const;
    },
    disconnect(session: LabSession, socket: WebSocket): void {
      if (session.socket !== socket) return;
      session.socket = null; session.disconnectedAt = now();
    },
  };
};
