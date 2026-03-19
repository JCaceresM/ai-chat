interface ToastProps {
  message: string;
}

export default function Toast({ message }: ToastProps) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50">
      <div
        className="rounded-xl border border-amber-400/30 bg-slate-950/95 px-4 py-3 text-sm text-amber-100 shadow-2xl shadow-black/30 backdrop-blur"
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}
