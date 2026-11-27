import { env } from "@/config/env.config";
import type {
  EntraConnectionView,
  EntraTestResult,
  KekaConnectionView,
  KekaTestResult,
  MailConnectionView,
  MailTestResult,
  SaveSetupEntraPayload,
  SetupConfig,
  SetupStatus,
  SetupSuperAdminSummary,
  TestMailConnectionPayload,
  UpdateEntraConnectionPayload,
  UpdateKekaConnectionPayload,
  UpdateMailConnectionPayload,
} from "../types/setup.types";

async function setupFetch<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errObj = parsed as {
      message?: string | string[];
      error?: string;
    } | null;
    const message = Array.isArray(errObj?.message)
      ? errObj.message.join("; ")
      : errObj?.message || errObj?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return parsed as T;
}

export const setupClient = {
  getStatus: () => setupFetch<SetupStatus>("/setup/status"),

  unlock: (setupKey: string) =>
    setupFetch<{ setupToken: string; expiresInSeconds: number }>("/setup/unlock", {
      method: "POST",
      body: { setupKey },
    }),

  getConfig: (token: string) =>
    setupFetch<SetupConfig>("/setup/config", { token }),

  saveEntra: (token: string, body: SaveSetupEntraPayload) =>
    setupFetch<{
      entra: EntraConnectionView;
      superAdmin: SetupSuperAdminSummary | null;
    }>("/setup/entra", {
      method: "PUT",
      token,
      body,
    }),

  testEntra: (token: string, body?: UpdateEntraConnectionPayload) =>
    setupFetch<EntraTestResult>("/setup/entra/test", {
      method: "POST",
      token,
      body: body ?? {},
    }),

  saveMail: (token: string, body: UpdateMailConnectionPayload) =>
    setupFetch<MailConnectionView>("/setup/mail", {
      method: "PUT",
      token,
      body,
    }),

  testMail: (token: string, body: TestMailConnectionPayload) =>
    setupFetch<MailTestResult>("/setup/mail/test", {
      method: "POST",
      token,
      body,
    }),

  saveKeka: (token: string, body: UpdateKekaConnectionPayload) =>
    setupFetch<KekaConnectionView>("/setup/keka", {
      method: "PUT",
      token,
      body,
    }),

  testKeka: (token: string, body?: UpdateKekaConnectionPayload) =>
    setupFetch<KekaTestResult>("/setup/keka/test", {
      method: "POST",
      token,
      body: body ?? {},
    }),

  complete: (token: string) =>
    setupFetch<SetupStatus>("/setup/complete", {
      method: "POST",
      token,
    }),
};
