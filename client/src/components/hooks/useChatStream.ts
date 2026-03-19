'use client';

import type { StreamTokenChunk } from '@/lib/types/chat';

export interface StreamCallbacks {
  onToken: (token: string, accumulated: string) => void;
  onDone: (turnIndex: number | undefined, finalContent: string) => void;
  onError: (error: string) => void;
}

/**
 * Parses an SSE (Server-Sent Events) stream from a ReadableStreamDefaultReader.
 * Processes `data:` lines, parses JSON chunks, and invokes the appropriate callbacks.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullReply = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Keep last incomplete line in buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data: ')) continue;

      const jsonStr = trimmedLine.slice(6);
      let chunk: StreamTokenChunk;
      try {
        chunk = JSON.parse(jsonStr) as StreamTokenChunk;
      } catch {
        // Skip malformed JSON
        continue;
      }

      if (chunk.error) {
        callbacks.onError(chunk.error);
        throw new Error(chunk.error);
      }

      if (chunk.token) {
        fullReply += chunk.token;
        callbacks.onToken(chunk.token, fullReply);
      }

      if (chunk.done) {
        callbacks.onDone(chunk.turnIndex, fullReply);
        return;
      }
    }
  }
}
