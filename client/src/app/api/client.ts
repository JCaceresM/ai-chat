export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

class ApiClient {
    constructor(private readonly baseUrl: string) { }

    async requestRaw(url: string, options?: RequestInit): Promise<Response> {
        return fetch(`${this.baseUrl}${url}`, options);
    }

    async request<T>(url: string, options?: RequestInit): Promise<T> {
        const res = await this.requestRaw(url, options);
        if (!res.ok) {
            let message = 'Failed to fetch';
            try {
                const data = await res.json();
                message = data.message || message;
            } catch {
                // ignore
            }
            throw new ApiError(res.status, message);
        }

        // Handle 204 No Content
        if (res.status === 204) {
            return undefined as unknown as T;
        }

        return res.json();
    }
}

export default ApiClient;