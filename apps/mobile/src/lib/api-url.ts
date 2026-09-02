import Constants from "expo-constants";

const HTTP_PORT = 8080;

function hostFromUri(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ip = raw.match(/(\d{1,3}\.){3}\d{1,3}/);
  if (ip) return ip[0];
  try {
    const href = raw.includes("://") ? raw : `http://${raw}`;
    const { hostname } = new URL(href);
    if (
      hostname &&
      hostname !== "exp.host" &&
      hostname !== "u.expo.dev" &&
      !hostname.endsWith(".exp.direct")
    ) {
      return hostname;
    }
  } catch {
    // ignore
  }
  return null;
}

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const extra = Constants as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string };
    linkingUri?: string;
  };

  const host =
    hostFromUri(extra.expoGoConfig?.debuggerHost) ??
    hostFromUri(extra.expoConfig?.hostUri) ??
    hostFromUri(extra.linkingUri) ??
    "127.0.0.1";

  return `http://${host}:${HTTP_PORT}`;
}

export function resolveAgentUrl(): string {
  return `${resolveApiBaseUrl()}/agent`;
}
