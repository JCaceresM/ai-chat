import { cookies } from 'next/headers';
import ChatBox from '@/components/ChatBox';
import { getHistory } from './api/actions/chat';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value ?? '';

  const initialMessages = await getHistory(sessionId);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="flex-shrink-0 border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Department Assistant</h1>
            <p className="text-xs text-slate-400">Ask about any company department</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        <ChatBox
          initialMessages={initialMessages}
          sessionId={sessionId}
        />
      </main>
    </div>
  );
}
