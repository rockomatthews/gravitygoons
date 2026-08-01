const BASE_APP_DAPP_URL = "https://go.cb-w.com/dapp";

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export function isBaseWalletName(name: string): boolean {
  return /base|coinbase/i.test(name);
}

export function createBaseAppDappUrl(dappUrl: string): string {
  const url = new URL(BASE_APP_DAPP_URL);
  url.searchParams.set("cb_url", dappUrl);
  return url.toString();
}
