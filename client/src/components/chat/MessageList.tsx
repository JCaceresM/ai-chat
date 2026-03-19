import type { RefObject } from 'react';
import type { ChatMessage } from '@/lib/types/chat';
import MessageBubble from './MessageBubble';
import EmptyState from './EmptyState';

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSuggestionClick: (text: string) => void;
}

export default function MessageList({
  messages,
  messagesEndRef,
  onSuggestionClick,
}: MessageListProps) {
  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
      id="messages-container"
    >
      {messages.length === 0 && (
        <EmptyState onSuggestionClick={onSuggestionClick} />
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
