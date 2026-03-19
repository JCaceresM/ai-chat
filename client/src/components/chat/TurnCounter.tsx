interface TurnCounterProps {
  turnCount: number;
  sessionId: string;
}

export default function TurnCounter({ turnCount, sessionId }: TurnCounterProps) {
  return (
    <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between">
      <span className="text-xs text-slate-500">
        {turnCount > 0
          ? `${turnCount} turn${turnCount !== 1 ? 's' : ''}`
          : 'New conversation'}
      </span>
      {sessionId && (
        <span
          className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]"
          title={sessionId}
        >
          {sessionId.slice(0, 8)}…
        </span>
      )}
    </div>
  );
}
