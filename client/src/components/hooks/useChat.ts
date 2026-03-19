'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ChatMessage } from '@/lib/types/chat';
import { generateId } from '@/lib/utils';
import { useChatSession } from './useChatSession';
import { parseSSEStream } from './useChatStream';

interface UseChatOptions {
  initialMessages: ChatMessage[];
  sessionId: string;
}

export interface UseChatReturn {
  // State
  messages: ChatMessage[];
  input: string;
  isSending: boolean;
  error: string | null;
  toastMessage: string | null;
  turnCount: number;
  currentSessionId: string;

  // Setters
  setInput: (value: string) => void;
  setError: (error: string | null) => void;

  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;

  // Actions
  handleSend: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useChat({ initialMessages, sessionId }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(
    Math.floor(initialMessages.filter((m) => m.role === 'user').length),
  );
  const visibleMessages = streamingMessage
    ? [...messages, streamingMessage]
    : messages;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    currentSessionId,
    sessionError,
    toastMessage,
    setSessionError,
    handleSessionExpired,
  } = useChatSession({ initialSessionId: sessionId });

  // Merge session errors into the component error state
  useEffect(() => {
    if (sessionError) {
      setError(sessionError);
      setSessionError(null);
    }
  }, [sessionError, setSessionError]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const draft = input;
    const trimmed = draft.trim();
    if (!trimmed || isSending || !currentSessionId) return;

    const committedUserMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };


    // Create a bot placeholder for streaming
    const botMessageId = generateId();
    const botMessage: ChatMessage = {
      id: botMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const rollbackTurn = (errorMessage?: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== committedUserMessage.id));
      setStreamingMessage(null);
      setInput(draft);
      if (errorMessage) {
        setError(errorMessage);
      }
    };

    setError(null);
    setIsSending(true);
    setInput('');
    setMessages((prev) => [...prev, committedUserMessage]);
    setStreamingMessage(botMessage);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      // Check for JSON error responses (session expired, validation, etc.)
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as {
          sessionExpired?: boolean;
          error?: string;
          message?: string | string[];
        };
        if (data.sessionExpired) {
          rollbackTurn();
          await handleSessionExpired();
          return;
        }
        const errMsg = Array.isArray(data.message)
          ? data.message[0]
          : (data.message ?? data.error ?? 'An error occurred');
        rollbackTurn(errMsg);
        return;
      }

      if (!res.body) {
        rollbackTurn('No response stream');
        return;
      }

      // Read SSE stream using the extracted parser
      const reader = res.body.getReader();
      let streamCompleted = false;
      let streamedTurnIndex: number | undefined;
      let streamedContent = '';

      await parseSSEStream(reader, {
        onToken: (_token, accumulated) => {
          streamedContent = accumulated;
          setStreamingMessage((current) =>
            current?.id === botMessageId
              ? { ...current, content: accumulated, isStreaming: true }
              : current,
          );
        },
        onDone: (turnIndex, finalContent) => {
          streamCompleted = true;
          streamedTurnIndex = turnIndex;
          streamedContent = finalContent;
          setStreamingMessage((current) =>
            current?.id === botMessageId
              ? {
                ...current,
                content: finalContent,
                isStreaming: false,
                timestamp: Date.now(),
              }
              : current,
          );
        },
        onError: () => { },
      });

      if (!streamCompleted) {
        throw new Error('Response stream ended unexpectedly.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          role: 'assistant',
          content: streamedContent,
          timestamp: Date.now(),
        },
      ]);
      setStreamingMessage(null);
      setTurnCount((prev) => streamedTurnIndex ?? prev + 1);
    } catch (err) {
      const fallbackMessage = 'Connection lost, please retry.';
      const errorMessage =
        err instanceof Error && err.message && err.message !== 'Failed to fetch'
          ? err.message
          : fallbackMessage;
      rollbackTurn(errorMessage);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [
    currentSessionId,
    handleSessionExpired,
    input,
    isSending,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return {
    messages: visibleMessages,
    toastMessage,
    input,
    isSending,
    error,
    turnCount,
    currentSessionId,
    setInput,
    setError,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
  };
}
