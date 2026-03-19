const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'] as const;

interface EmptyStateProps {
  onSuggestionClick: (text: string) => void;
}

export default function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center border border-violet-500/10">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-violet-400"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-slate-300 font-medium text-sm">
          Welcome to Department Assistant
        </p>
        <p className="text-slate-500 text-xs mt-1 max-w-sm">
          Ask me about any company department — Engineering, Marketing, Sales, HR, or
          Finance.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            onClick={() => onSuggestionClick(`Tell me about the ${dept} department`)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-300 transition-all duration-200 hover:bg-violet-500/5"
          >
            {dept}
          </button>
        ))}
      </div>
    </div>
  );
}
