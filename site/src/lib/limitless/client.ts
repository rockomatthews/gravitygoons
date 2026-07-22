import "server-only";

import { Client, type HMACCredentials } from "@limitless-exchange/sdk";
import { getLimitlessConfig } from "@/lib/limitless/config";

let publicClient: Client | undefined;

export function getLimitlessPublicClient(): Client {
  if (publicClient) return publicClient;
  const config = getLimitlessConfig();
  publicClient = new Client({ baseURL: config.apiBaseUrl, timeout: 10_000 });
  return publicClient;
}

export function getLimitlessPartnerClient(): Client {
  const config = getLimitlessConfig();
  if (!config.tradingEnabled || !config.apiKey || !config.apiSecret) {
    throw new Error("Limitless partner trading is not configured");
  }
  const hmacCredentials: HMACCredentials = {
    tokenId: config.apiKey,
    secret: config.apiSecret,
  };
  return new Client({
    apiKey: config.apiKey,
    baseURL: config.apiBaseUrl,
    hmacCredentials,
    timeout: 10_000,
  });
}
