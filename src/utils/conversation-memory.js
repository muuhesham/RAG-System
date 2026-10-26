import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 1000;

const historySessions = new Map();

function removeExpiredSessions() {
  const now = Date.now();

  for (const [sessionId, session] of historySessions) {
    if (now - session.lastAccessedAt >= SESSION_TTL_MS) {
      historySessions.delete(sessionId);
    }
  }
}

export function getSessionHistory(sessionId) {
  removeExpiredSessions();

  let session = historySessions.get(sessionId);
  if (!session) {
    session = {
      history: new InMemoryChatMessageHistory(),
      lastAccessedAt: Date.now(),
    };
  }

  session.lastAccessedAt = Date.now();
  historySessions.delete(sessionId);
  historySessions.set(sessionId, session);

  while (historySessions.size > MAX_SESSIONS) {
    historySessions.delete(historySessions.keys().next().value);
  }

  return session.history;
}

export function deleteSessionHistory(sessionId) {
  return historySessions.delete(sessionId);
}