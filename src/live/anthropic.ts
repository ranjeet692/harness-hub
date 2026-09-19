import type { ModelClient, ModelRequest, ModelResponse } from "./types";

export const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheapest)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "claude-opus-5", label: "Claude Opus 5" },
];

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/**
 * Calls the Anthropic Messages API straight from the browser with the user's own key.
 * The key goes only to api.anthropic.com. Rate limits and overloads (429, 529) are retried
 * with backoff here, below the harness, the same way a production client would.
 */
export function anthropicClient(apiKey: string): ModelClient {
  return {
    async create(req: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
      for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
          res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            signal,
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify(req),
          });
        } catch (e) {
          if (signal?.aborted) throw e;
          throw new ApiError(0, "Couldn't reach api.anthropic.com. Check your internet connection. A firewall, VPN or ad blocker may be blocking it.");
        }
        if (res.status === 401) throw new ApiError(401, "The API key was rejected. Check that it's correct and still active.");
        if (res.ok) return (await res.json()) as ModelResponse;
        const body = await res.text();
        let message = body;
        try { message = JSON.parse(body).error?.message ?? body; } catch { /* keep raw text */ }
        if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        throw new ApiError(res.status, message);
      }
    },
  };
}
