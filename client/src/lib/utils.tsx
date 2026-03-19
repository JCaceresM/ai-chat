export function generateId(): string {
    return `msg_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (diff < 60_000) return rtf.format(-Math.floor(diff / 1000), 'second');
    if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
    if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), 'hour');
    return rtf.format(-Math.floor(diff / 86_400_000), 'day');
}