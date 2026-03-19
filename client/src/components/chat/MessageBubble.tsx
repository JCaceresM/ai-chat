import type { ChatMessage } from '@/lib/types/chat';
import { formatRelativeTime } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md shadow-lg shadow-violet-500/10'
            : 'bg-slate-800/80 text-slate-200 rounded-bl-md border border-slate-700/50'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {!isUser && 'isStreaming' in message && message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-middle animate-blink" />
          )}
        </p>
        <p
          className={`text-[10px] mt-1.5 ${
            isUser ? 'text-violet-200/50' : 'text-slate-500'
          }`}
        >
          {formatRelativeTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
