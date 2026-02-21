import type { ClientLoginInput, ClientLoginResult } from "./types";

export interface EdgeCallOptions {
  supabaseUrl: string;
  anonKey: string;
  accessToken?: string;
  edgeBaseUrl?: string;
}

async function callEdge<T>(
  fn: string,
  payload: unknown,
  options: EdgeCallOptions,
): Promise<T> {
  const baseUrl = options.edgeBaseUrl || `${options.supabaseUrl}/functions/v1`;
  const url = `${baseUrl.replace(/\/$/, "")}/${fn}`;
  const bearer = options.accessToken || options.anonKey;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: options.anonKey,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch (_error) {
      parsed = null;
    }
    const message =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as Record<string, unknown>).error)
        : text || `Edge function ${fn} failed`;
    const error = new Error(message) as Error & {
      status?: number;
      data?: Record<string, unknown> | null;
    };
    error.status = response.status;
    error.data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    throw error;
  }

  return (await response.json()) as T;
}

export function clientLogin(
  payload: ClientLoginInput,
  options: EdgeCallOptions,
): Promise<ClientLoginResult> {
  return callEdge<ClientLoginResult>("client-login", payload, options);
}

export const invokeClientLogin = clientLogin;

export function contractSelect(
  payload: { contract_number: string },
  options: EdgeCallOptions,
): Promise<{ contract_number: string }> {
  return callEdge<{ contract_number: string }>("contract-select", payload, options);
}

export function getSignedUrl(
  payload: { bucket: string; path: string; expiresIn?: number },
  options: EdgeCallOptions,
): Promise<{ signedUrl: string; expiresIn: number }> {
  return callEdge<{ signedUrl: string; expiresIn: number }>("signed-url", payload, options);
}

export function globalSearch(
  payload: { q: string; contract_number: string },
  options: EdgeCallOptions,
): Promise<Record<string, unknown>> {
  return callEdge<Record<string, unknown>>("global-search", payload, options);
}
