import { privateKeyToAccount } from "viem/accounts";

export async function POST(request: Request) {
  if (process.env.DEMO_PROGRESS_ENABLED !== "true") return new Response(null, { status: 404 });
  if (!process.env.DEMO_PROGRESS_SECRET || request.headers.get("x-demo-secret") !== process.env.DEMO_PROGRESS_SECRET) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const privateKey = process.env.DEMO_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
  const registry = process.env.NEXT_PUBLIC_PROGRESS_REGISTRY_ADDRESS as `0x${string}` | undefined;
  if (!privateKey || !registry) return Response.json({ error: "Demo signer is not configured" }, { status: 503 });
  const input = await request.json() as { tokenId: number; xp: number; level: number; trickBitmap: string; achievementBitmap?: string; catalogVersion: number; discipline: number; nonce: number };
  if (!Number.isInteger(input.tokenId) || input.tokenId < 1 || input.tokenId > 1000) return Response.json({ error: "Invalid token" }, { status: 400 });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
  const claim = { tokenId: BigInt(input.tokenId), xp: BigInt(input.xp), level: input.level, trickBitmap: BigInt(input.trickBitmap), achievementBitmap: BigInt(input.achievementBitmap ?? "0"), catalogVersion: input.catalogVersion, discipline: input.discipline, nonce: input.nonce, deadline };
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: { name: "Impact Club Progress", version: "1", chainId: 8453, verifyingContract: registry },
    types: { ProgressClaim: [
      { name: "tokenId", type: "uint256" }, { name: "xp", type: "uint64" }, { name: "level", type: "uint32" },
      { name: "trickBitmap", type: "uint64" }, { name: "achievementBitmap", type: "uint64" },
      { name: "catalogVersion", type: "uint16" }, { name: "discipline", type: "uint8" },
      { name: "nonce", type: "uint32" }, { name: "deadline", type: "uint64" },
    ] },
    primaryType: "ProgressClaim",
    message: claim,
  });
  return Response.json({ claim: { ...claim, tokenId: claim.tokenId.toString(), xp: claim.xp.toString(), trickBitmap: claim.trickBitmap.toString(), achievementBitmap: claim.achievementBitmap.toString(), deadline: claim.deadline.toString() }, signature });
}

