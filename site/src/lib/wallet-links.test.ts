import assert from "node:assert/strict";
import test from "node:test";
import { createBaseAppDappUrl, isBaseWalletName, isMobileUserAgent } from "./wallet-links.ts";

test("the Base App link preserves the complete Gravity Goons return URL", () => {
  const current = "https://gravitygoons.com/#collection";
  const deepLink = new URL(createBaseAppDappUrl(current));

  assert.equal(deepLink.origin + deepLink.pathname, "https://go.cb-w.com/dapp");
  assert.equal(deepLink.searchParams.get("cb_url"), current);
});

test("the reported iPhone DuckDuckGo browser is treated as mobile", () => {
  const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1 Ddg/26.6";
  assert.equal(isMobileUserAgent(userAgent), true);
});

test("Base and Coinbase injected providers are recognized", () => {
  assert.equal(isBaseWalletName("Base App"), true);
  assert.equal(isBaseWalletName("Coinbase Wallet"), true);
  assert.equal(isBaseWalletName("MetaMask"), false);
});
