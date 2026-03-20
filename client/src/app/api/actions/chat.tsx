import { cookies } from "next/headers";
import ApiClient from "../client";
import type { ChatMessage, Turn } from "@/lib/types/chat";

const API_URL = process.env['API_URL'] ?? '';
export async function getHistory(sessionId?: string): Promise<ChatMessage[]> {
    if (!sessionId) {
        const cookieStore = await cookies();
        sessionId = cookieStore.get('sessionId')?.value ?? '';
    }
    if (!sessionId) {
        return [];
    }
    const client = new ApiClient(API_URL);
    const data = await client.request<{ turns: Turn[] }>(`/api/v1/chat/${sessionId}/history`, {
        method: 'GET',
        cache: 'no-store',
    });
    return data.turns.map((turn, i) => ({
        id: `${turn.timestamp}-${i}`,
        role: turn.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: turn.content,
        timestamp: turn.timestamp,
    }));
}
