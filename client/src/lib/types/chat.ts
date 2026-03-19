export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  timestamp: number;
}

export interface BotMessage {
  id: string;
  role: 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export type ChatMessage = UserMessage | BotMessage;

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionResponse {
  sessionId: string;
}

export interface HistoryResponse {
  sessionId: string;
  turns: Turn[];
}

export interface StreamTokenChunk {
  token?: string;
  done?: boolean;
  turnIndex?: number;
  error?: string;
}

export interface StreamErrorResponse {
  sessionExpired?: boolean;
  error?: string;
}