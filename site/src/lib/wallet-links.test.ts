import assert from "node:assert/strict";
import test from "node:test";
import {
  createBaseAppDappUrl,
  createMetaMaskDappUrl,
  createRainbowDappUrl,
  isBaseWalletName,
  isMobileUserAgent,
  isWalletKind,
} from "./wallet-links.ts";
import { personalSignParams } from "./wallet-signing.ts";

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

test("the MetaMask link opens the current page inside its mobile dapp browser", () => {
  assert.equal(
    createMetaMaskDappUrl("https://gravitygoons.com/#collection"),
    "https://metamask.app.link/dapp/gravitygoons.com/%23collection",
  );
});

test("the Rainbow link passes the complete page to its supported dapp route", () => {
  const current = "https://gravitygoons.com/arena?tab=live#match";
  const deepLink = new URL(createRainbowDappUrl(current));

  assert.equal(deepLink.origin + deepLink.pathname, "https://rnbwapp.com/dapp");
  assert.equal(deepLink.searchParams.get("url"), current);
});

test("wallet identities are matched using names and EIP-6963 reverse-DNS IDs", () => {
  assert.equal(isWalletKind("Browser wallet", "io.metamask", "metamask"), true);
  assert.equal(isWalletKind("Rainbow", "me.rainbow", "rainbow"), true);
  assert.equal(isWalletKind("Coinbase Wallet", "com.coinbase.wallet", "base"), true);
  assert.equal(isWalletKind("Rainbow", "me.rainbow", "metamask"), false);
});

test("personal_sign encodes SIWE text as hex for Base App providers", () => {
  const address = "0x8a0182c099a618583e9ef98716dacf739b3bd944" as const;
  const [message, signer] = personalSignParams("Sign in to Gravity Goons.", address);
  assert.equal(message, "0x5369676e20696e20746f204772617669747920476f6f6e732e");
  assert.equal(signer, address);
});
