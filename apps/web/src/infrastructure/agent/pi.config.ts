/**
 * Pi SDK configuration.
 *
 * The SDK internally resolves API keys via AuthStorage (set at runtime) or
 * the XIAOMI_API_KEY environment variable. This module reads MIMO_API_KEY as
 * a convenience alias and passes it to the gateway's in-memory AuthStorage.
 */
export const apiKey = process.env.MIMO_API_KEY ?? "";

export const piConfig = {
  model: process.env.MIMO_MODEL ?? "mimo-v2.5-pro",
  baseUrl: process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1",
  apiKey,
  /** Environment variable the Pi SDK checks for xiaomi provider auth. */
  envKeyVar: "XIAOMI_API_KEY",
};
