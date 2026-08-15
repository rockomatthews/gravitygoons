const BASE_APP_DAPP_URL = "https://go.cb-w.com/dapp";
const METAMASK_DAPP_URL = "https://metamask.app.link/dapp";
const RAINBOW_DAPP_URL = "https://rnbwapp.com/dapp";

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

export type MobileWalletKind = "base" | "metamask" | "rainbow";

export function isWalletKind(name: string, rdns: string | undefined, kind: MobileWalletKind): boolean {
  const identity = `${name} ${rdns ?? ""}`;
  if (kind === "base") return /base|coinbase|com\.coinbase/i.test(identity);
  if (kind === "metamask") return /metamask|io\.metamask/i.test(identity);
  return /rainbow|me\.rainbow/i.test(identity);
}

export function isBaseWalletName(name: string): boolean {
  return isWalletKind(name, undefined, "base");
}

export function createBaseAppDappUrl(dappUrl: string): string {
  const url = new URL(BASE_APP_DAPP_URL);
  url.searchParams.set("cb_url", dappUrl);
  return url.toString();
}

export function createMetaMaskDappUrl(dappUrl: string): string {
  const destination = new URL(dappUrl);
  const path = `${destination.host}${destination.pathname}${encodeURIComponent(`${destination.search}${destination.hash}`)}`;
  return `${METAMASK_DAPP_URL}/${path}`;
}

export function createRainbowDappUrl(dappUrl: string): string {
  const url = new URL(RAINBOW_DAPP_URL);
  url.searchParams.set("url", dappUrl);
  return url.toString();
}
