import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
export const apiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);
export const appVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "local-dev";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}

export async function apiRequest<T>(
  session: Session,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = payload?.detail ?? response.statusText;
    throw new Error(formatApiError(path, response.status, detail));
  }
  return payload as T;
}

export async function apiFormRequest<T>(
  session: Session,
  path: string,
  body: FormData,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = payload?.detail ?? response.statusText;
    throw new Error(formatApiError(path, response.status, detail));
  }
  return payload as T;
}

function formatApiError(path: string, status: number, detail: unknown): string {
  if (path.includes("/onboarding/join")) {
    if (status === 404) return "Invite code not found";
    if (status === 409) return "Invite already used";
    if (status === 410) return "Invite expired";
  }
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail);
}
