'use client';

import type { ChatMessage } from '@/lib/types/chat';
import { useChat } from '@/components/hooks/useChat';
import TurnCounter from './chat/TurnCounter';
import MessageList from './chat/MessageList';
import ErrorBanner from './chat/ErrorBanner';
import ChatInput from './chat/ChatInput';
import Toast from './chat/Toast';

interface ChatBoxProps {
  initialMessages: ChatMessage[];
  sessionId: string;
}

export default function ChatBox({ initialMessages, sessionId }: ChatBoxProps) {
  const {
    messages,
    input,
    isSending,
    error,
    toastMessage,
    turnCount,
    currentSessionId,
    setInput,
    setError,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
  } = useChat({ initialMessages, sessionId });

  return (
    <>
      {toastMessage && <Toast message={toastMessage} />}

      <div className="flex flex-col flex-1 min-h-0 max-w-3xl mx-auto w-full">
        <TurnCounter turnCount={turnCount} sessionId={currentSessionId} />

        <MessageList
          messages={messages}
          messagesEndRef={messagesEndRef}
          onSuggestionClick={(text) => {
            setInput(text);
            inputRef.current?.focus();
          }}
        />

        {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

        <ChatInput
          input={input}
          onChange={setInput}
          onSend={() => void handleSend()}
          onKeyDown={handleKeyDown}
          disabled={!input.trim() || isSending || !currentSessionId}
          inputRef={inputRef}
        />
      </div>
    </>
  );
}
