import type { RefObject } from 'react';

interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatInput({
  input,
  onChange,
  onSend,
  onKeyDown,
  disabled,
  inputRef,
}: ChatInputProps) {
  return (
    <div className="flex-shrink-0 p-4 border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
      <div className="flex gap-2 max-w-3xl mx-auto">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about a department..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200"
        />
        <button
          onClick={onSend}
          disabled={disabled}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:from-violet-500 hover:to-indigo-500 transition-all duration-200 shadow-lg shadow-violet-500/20 disabled:shadow-none"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[10px] text-slate-600 mt-2">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
