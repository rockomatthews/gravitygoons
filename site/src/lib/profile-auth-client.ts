type ConnectWallet = () => Promise<`0x${string}` | null>;
type SignWalletMessage = (message: string, address?: string) => Promise<`0x${string}`>;

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The profile server did not respond. Check your connection and try again.");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function authenticateProfileSession({
  account,
  connect,
  signMessage,
  onStatus,
}: {
  account: `0x${string}` | null;
  connect: ConnectWallet;
  signMessage: SignWalletMessage;
  onStatus: (status: string) => void;
}) {
  const address = account ?? await connect();
  if (!address) throw new Error("Choose the player wallet, then press PLAYER CHECK-IN again.");
  onStatus("Preparing a secure wallet sign-in…");
  const challengeResponse = await fetchWithTimeout("/api/profile/session/nonce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const challenge = await challengeResponse.json();
  if (!challengeResponse.ok) throw new Error(challenge.error);
  onStatus("Approve the free sign-in message in your wallet…");
  const signature = await signMessage(challenge.message, address);
  onStatus("Signature received. Verifying your wallet…");
  const verifyResponse = await fetchWithTimeout("/api/profile/session/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });
  const verified = await verifyResponse.json();
  if (!verifyResponse.ok) throw new Error(verified.error);
  return verified;
}
