import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { createSessionToken, createSignInChallenge, readSessionAddress, verifyChallenge } from "./profile-session.ts";

const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");

test("wallet challenge accepts only the matching wallet signature", async () => {
  const challenge = createSignInChallenge(account.address);
  const signature = await account.signMessage({ message: challenge.message });

  assert.equal(await verifyChallenge(challenge.token, account.address, signature), account.address.toLowerCase());
  assert.equal(await verifyChallenge(`${challenge.token}tampered`, account.address, signature), null);
  assert.equal(await verifyChallenge(challenge.token, "0x0000000000000000000000000000000000000001", signature), null);
});

test("profile sessions are signed and reject tampering", () => {
  const session = createSessionToken(account.address);

  assert.equal(readSessionAddress(session), account.address.toLowerCase());
  assert.equal(readSessionAddress(`${session}tampered`), null);
  assert.equal(readSessionAddress(undefined), null);
});
