import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress } from "ethers";
import "dotenv/config";

const SAFE = getAddress("0x28ed8CE998C416B456394A35f080662aDE3311Ce");
const COLLECTION = getAddress("0x0354F25c86aDb97BF12E2d8462acB6c22D9676e4");
const EXPECTED_REGISTRY = getAddress("0x1DDbe6163cEd907135B827cf2E2Be697b5DEeA04");
const EXPECTED_METADATA = "ipfs://bafybeiaz3ncdswnf7nfauqzyd7n2frzmk36ovtmvzldp2sz4vwwi2mtzqe/";
const AUTHORIZATION = "OPEN PUBLIC MINT";

if (!process.env.BASE_RPC_URL) throw new Error("BASE_RPC_URL is required in contract/.env.");
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== 8453n) throw new Error(`Refusing chain ${network.chainId}; expected Base mainnet 8453.`);

const collection = new Contract(COLLECTION, [
  "function owner() view returns (address)",
  "function progressRegistry() view returns (address)",
  "function mintOpen() view returns (bool)",
  "function creatorMinted() view returns (uint256)",
  "function publicMinted() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function availabilityWord(uint256 startTokenId) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function setMintOpen(bool open)",
], provider);
const safe = new Contract(SAFE, [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
], provider);

const [owner, registry, mintOpen, creatorMinted, publicMinted, totalMinted, owners, threshold, tokenUri, ...availabilityWords] = await Promise.all([
  collection.owner(), collection.progressRegistry(), collection.mintOpen(), collection.creatorMinted(), collection.publicMinted(), collection.totalMinted(),
  safe.getOwners(), safe.getThreshold(), collection.tokenURI(16),
  ...[1, 257, 513, 769].map((start) => collection.availabilityWord(start)),
]);
if (getAddress(owner) !== SAFE) throw new Error("Collection owner is not the production Safe.");
if (getAddress(registry) !== EXPECTED_REGISTRY) throw new Error("Collection registry does not match the production registry.");
if (mintOpen) throw new Error("Public mint is already open; refusing to create a duplicate request.");
if (creatorMinted !== 50n || publicMinted !== 0n || totalMinted !== 50n) {
  throw new Error(`Unexpected supply state: creator=${creatorMinted}, public=${publicMinted}, total=${totalMinted}.`);
}
if (Number(threshold) !== 2 || owners.length !== 3) throw new Error("Production Safe is not 2-of-3.");
if (!tokenUri.startsWith(EXPECTED_METADATA)) throw new Error("Immutable metadata base URI mismatch.");

let available = 0;
for (let index = 0; index < availabilityWords.length; index += 1) {
  const start = [1, 257, 513, 769][index];
  for (let offset = 0; offset < 256 && start + offset <= 1000; offset += 1) {
    if (((availabilityWords[index] >> BigInt(offset)) & 1n) === 1n) available += 1;
  }
}
if (available !== 950) throw new Error(`Expected 950 available IDs; found ${available}.`);

const iface = new Interface(["function setMintOpen(bool open)"]);
const data = iface.encodeFunctionData("setMintOpen", [true]);
await provider.call({ from: SAFE, to: COLLECTION, data });

const createdAt = Date.now();
const transactionBuilder = {
  version: "1.0",
  chainId: "8453",
  createdAt,
  meta: {
    name: "Gravity Goons - Open Public Mint",
    description: "Safe-authorized setMintOpen(true) after all pre-mint gates passed.",
    txBuilderVersion: "1.18.0",
    createdFromSafeAddress: SAFE,
    createdFromOwnerAddress: "",
    checksum: "",
  },
  transactions: [{
    to: COLLECTION,
    value: "0",
    data,
    contractMethod: {
      inputs: [{ internalType: "bool", name: "open", type: "bool" }],
      name: "setMintOpen",
      payable: false,
    },
    contractInputsValues: { open: "true" },
  }],
};

const reports = path.resolve(import.meta.dirname, "..", "..", "reports");
const transactionBuilderPath = path.join(reports, "base-mainnet-open-public-mint-safe.json");
const requestPath = path.join(reports, "base-mainnet-open-public-mint-request.json");
if (fs.existsSync(transactionBuilderPath) || fs.existsSync(requestPath)) {
  throw new Error("Public-mint request artifacts already exist; refusing to overwrite them.");
}
fs.writeFileSync(transactionBuilderPath, `${JSON.stringify(transactionBuilder, null, 2)}\n`, { flag: "wx" });
fs.writeFileSync(requestPath, `${JSON.stringify({
  schema: "gravity-goons-mainnet-open-public-mint-request-v1",
  prepared_at: new Date(createdAt).toISOString(),
  authorization: AUTHORIZATION,
  chain_id: 8453,
  safe: SAFE,
  collection: COLLECTION,
  method: "setMintOpen(bool)",
  arguments: { open: true },
  value_wei: "0",
  calldata: data,
  transaction_builder_file: "reports/base-mainnet-open-public-mint-safe.json",
  preflight: {
    collection_owner: getAddress(owner),
    registry: getAddress(registry),
    safe_owners: owners.map(getAddress),
    safe_threshold: Number(threshold),
    mint_open: false,
    creator_minted: Number(creatorMinted),
    public_minted: Number(publicMinted),
    total_minted: Number(totalMinted),
    available_public_ids: available,
    metadata_base_url: EXPECTED_METADATA,
    direct_rpc_simulation: "success",
  },
  expected_post_state: {
    mint_open: true,
    creator_minted: 50,
    public_minted: 0,
    total_minted: 50,
    available_public_ids: 950,
  },
  status: "awaiting_safe_approvals_and_execution",
}, null, 2)}\n`, { flag: "wx" });

console.log(JSON.stringify({
  authorization: AUTHORIZATION,
  safe: SAFE,
  collection: COLLECTION,
  data,
  available,
  simulation: "success",
  transactionBuilderPath,
  requestPath,
}, null, 2));
