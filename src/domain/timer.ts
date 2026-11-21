import type { ActiveSession } from './types';

/** Se o último sinal de vida for mais antigo que isso, o app foi fechado com o cronômetro rodando. */
export const STALE_HEARTBEAT_MS = 60_000;
/** Intervalo recomendado para gravar o sinal de vida. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

export function elapsedMs(session: ActiveSession, now: number): number {
  if (session.status === 'running' && session.lastResumedAt !== null) {
    return session.accumulatedMs + Math.max(0, now - session.lastResumedAt);
  }
  return session.accumulatedMs;
}

export function pauseTimer(session: ActiveSession, now: number): ActiveSession {
  if (session.status !== 'running') return session;
  return {
    ...session,
    status: 'paused',
    accumulatedMs: elapsedMs(session, now),
    lastResumedAt: null,
    lastHeartbeatAt: null,
  };
}

export function resumeTimer(session: ActiveSession, now: number): ActiveSession {
  if (session.status === 'running') return session;
  return {
    ...session,
    status: 'running',
    lastResumedAt: now,
    lastHeartbeatAt: now,
  };
}

export function heartbeat(session: ActiveSession, now: number): ActiveSession {
  if (session.status !== 'running') return session;
  return { ...session, lastHeartbeatAt: now };
}

export interface RestoreResult {
  session: ActiveSession;
  recovered: boolean;
  uncountedMs: number;
}

export function restoreSession(
  session: ActiveSession,
  now: number,
): RestoreResult {
  if (session.status !== 'running' || session.lastResumedAt === null) {
    return { session, recovered: false, uncountedMs: 0 };
  }
  const beat = session.lastHeartbeatAt ?? session.lastResumedAt;
  if (now - beat <= STALE_HEARTBEAT_MS) {
    return { session, recovered: false, uncountedMs: 0 };
  }
  const countedUntil = Math.max(session.lastResumedAt, beat);
  return {
    session: {
      ...session,
      status: 'paused',
      accumulatedMs:
        session.accumulatedMs + (countedUntil - session.lastResumedAt),
      lastResumedAt: null,
      lastHeartbeatAt: null,
    },
    recovered: true,
    uncountedMs: now - countedUntil,
  };
}

