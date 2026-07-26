export interface GraphClientOptions {
  endpoint: string;
  apiKey?: string;
  apiKeyHeader?: string;
  timeoutMs?: number;
  allowPartialErrors?: boolean;
  fetchImpl?: typeof fetch;
}

interface GraphResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export class GraphClient {
  constructor(private readonly options: GraphClientOptions) {}

  async query<T>(query: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.options.apiKey) {
      const header = this.options.apiKeyHeader ?? "authorization";
      headers[header] = header.toLowerCase() === "authorization"
        ? `Bearer ${this.options.apiKey}` : this.options.apiKey;
    }
    try {
      const response = await (this.options.fetchImpl ?? fetch)(this.options.endpoint, {
        method: "POST", headers, body: JSON.stringify({ query }), signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Graph request failed with HTTP ${response.status}`);
      const payload = await response.json() as GraphResponse<T>;
      if (payload.errors?.length && (!this.options.allowPartialErrors || !payload.data)) {
        const messages = payload.errors.map((error) => error.message ?? "unknown error").join("; ");
        throw new Error(`GraphQL returned errors: ${messages}`);
      }
      if (!payload.data) throw new Error("GraphQL response did not contain data");
      return payload.data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Graph request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function endpointIdentifier(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, "[redacted]");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 2) parts[parts.length - 1] = "[redacted]";
    url.pathname = `/${parts.join("/")}`;
    return url.toString();
  } catch {
    return "[invalid endpoint]";
  }
}
