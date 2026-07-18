import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const collectionAddress = (process.env.NEXT_PUBLIC_COLLECTION_ADDRESS ?? ZERO_ADDRESS) as `0x${string}`;
export const registryAddress = (process.env.NEXT_PUBLIC_PROGRESS_REGISTRY_ADDRESS ?? ZERO_ADDRESS) as `0x${string}`;
export const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";

export const publicClient = createPublicClient({ chain: base, transport: http(baseRpcUrl) });

export const collectionAbi = [
  { type: "function", name: "mintOpen", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "mintSelected", stateMutability: "payable", inputs: [{ name: "tokenIds", type: "uint16[]" }], outputs: [] },
  { type: "function", name: "setMintOpen", stateMutability: "nonpayable", inputs: [{ name: "open", type: "bool" }], outputs: [] },
  { type: "function", name: "creatorMintSelected", stateMutability: "nonpayable", inputs: [{ name: "recipient", type: "address" }, { name: "tokenIds", type: "uint16[]" }], outputs: [] },
  { type: "function", name: "availabilityWord", stateMutability: "view", inputs: [{ name: "startTokenId", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

export const registryAbi = [
  {
    type: "function",
    name: "progressOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "progress", type: "tuple", components: [
      { name: "xp", type: "uint64" }, { name: "trickBitmap", type: "uint64" },
      { name: "achievementBitmap", type: "uint64" }, { name: "level", type: "uint32" },
      { name: "nonce", type: "uint32" }, { name: "catalogVersion", type: "uint16" },
    ] }],
  },
] as const;

export function ipfsToHttp(uri: string): string {
  if (!uri.startsWith("ipfs://")) return uri;
  const path = uri.slice(7);
  return `https://${path.split("/")[0]}.ipfs.dweb.link/${path.split("/").slice(1).join("/")}`;
}

