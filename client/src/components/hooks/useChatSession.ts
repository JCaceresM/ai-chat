'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseChatSessionOptions {
  initialSessionId: string;
}

interface UseChatSessionReturn {
  currentSessionId: string;
  sessionError: string | null;
  toastMessage: string | null;
  setSessionError: (error: string | null) => void;
  handleSessionExpired: () => Promise<void>;
}

export function useChatSession({
  initialSessionId,
}: UseChatSessionOptions): UseChatSessionReturn {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bootstrap session if none exists (e.g. first visit, no cookie)
  useEffect(() => {
    if (currentSessionId || isResettingSession) return;

    let cancelled = false;

    async function createSession() {
      try {
        const res = await fetch('/api/session', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to create session');
        const data = (await res.json()) as { sessionId: string };
        if (!cancelled) {
          setCurrentSessionId(data.sessionId);
        }
      } catch {
        if (!cancelled) {
          setSessionError('Failed to start session. Please refresh.');
        }
      }
    }

    void createSession();
    return () => {
      cancelled = true;
    };
  }, [currentSessionId, isResettingSession]);

  const handleSessionExpired = useCallback(async () => {
    setIsResettingSession(true);
    setCurrentSessionId('');
    setToastMessage('Session expired');

    try {
      await fetch('/api/session', { method: 'DELETE' });
    } catch {
      // The next full-page reload will still re-bootstrap the session.
    }
    window.setTimeout(() => {
      window.location.reload();
    }, 800);
  }, []);

  return {
    currentSessionId,
    sessionError,
    toastMessage,
    setSessionError,
    handleSessionExpired,
  };
}
