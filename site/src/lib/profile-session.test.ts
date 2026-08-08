import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { createSessionToken, createSignInChallenge, readSessionAddress, signatureByteLength, verifyChallenge, verifyWithSmartAccountFallback } from "./profile-session.ts";

const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

test("wallet challenge accepts only the matching wallet signature", async () => {
  const challenge = createSignInChallenge(account.address);
  const signature = await account.signMessage({ message: challenge.message });

  assert.equal(await verifyChallenge(challenge.token, account.address, signature), account.address.toLowerCase());
  assert.equal(await verifyChallenge(`${challenge.token}tampered`, account.address, signature), null);
  assert.equal(await verifyChallenge(challenge.token, "0x0000000000000000000000000000000000000001", signature), null);
});

test("Base typed-data login accepts the issued challenge and rejects the wrong method", async () => {
  const challenge = createSignInChallenge(account.address);
  const signature = await account.signTypedData(challenge.typedData);

  assert.equal(await verifyChallenge(challenge.token, account.address, signature, "typed_data"), account.address.toLowerCase());
  assert.equal(await verifyChallenge(challenge.token, account.address, signature, "message"), null);
});

test("profile sessions are signed and reject tampering", () => {
  const session = createSessionToken(account.address);

  assert.equal(readSessionAddress(session), account.address.toLowerCase());
  assert.equal(readSessionAddress(`${session}tampered`), null);
  assert.equal(readSessionAddress(undefined), null);
});

test("wrapped smart-account signatures bypass the EOA-only verifier", async () => {
  const wrapped = `0x${"ab".repeat(180)}`;
  let eoaCalls = 0;
  let smartCalls = 0;
  const valid = await verifyWithSmartAccountFallback({
    signature: wrapped,
    verifyEoa: async () => { eoaCalls += 1; return false; },
    verifySmartAccount: async () => { smartCalls += 1; return true; },
  });
  assert.equal(signatureByteLength(wrapped), 180);
  assert.equal(valid, true);
  assert.equal(eoaCalls, 0);
  assert.equal(smartCalls, 1);
});

test("an EOA parser failure still reaches smart-account verification", async () => {
  const standard = `0x${"ab".repeat(65)}`;
  let smartCalls = 0;
  const valid = await verifyWithSmartAccountFallback({
    signature: standard,
    verifyEoa: async () => { throw new Error("invalid signature length"); },
    verifySmartAccount: async () => { smartCalls += 1; return true; },
  });
  assert.equal(valid, true);
  assert.equal(smartCalls, 1);
});

test("malformed signature responses are rejected before verification", () => {
  assert.equal(signatureByteLength("0x123"), null);
  assert.equal(signatureByteLength({ signature: "0x1234" }), null);
});
