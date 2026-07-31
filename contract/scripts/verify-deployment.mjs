import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Contract, JsonRpcProvider, ZeroAddress, getAddress, parseEther } from "ethers";
import "dotenv/config";

const [reportArgument, reserveArgument, recipientArgument] = process.argv.slice(2);
if (!reportArgument || !reserveArgument || !recipientArgument || !process.env.BASE_RPC_URL) {
  throw new Error(
    "Usage: npm run verify:deployment -- DEPLOYMENT_JSON RESERVE_JSON RESERVE_RECIPIENT (with BASE_RPC_URL set)",
  );
}

const root = path.resolve(import.meta.dirname, "..");
const reportPath = path.resolve(process.cwd(), reportArgument);
const reservePath = path.resolve(process.cwd(), reserveArgument);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const reserve = JSON.parse(fs.readFileSync(reservePath, "utf8"));
const reserveIds = reserve.token_ids;
if (!Array.isArray(reserveIds) || reserveIds.length !== 50 || new Set(reserveIds).size !== 50) {
  throw new Error("Reserve file must contain exactly 50 unique token IDs");
}

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const network = await provider.getNetwork();
if (Number(network.chainId) !== report.chain_id) {
  throw new Error(`RPC chain ${network.chainId} does not match deployment report chain ${report.chain_id}`);
}

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`), "utf8"));
}

const collectionAddress = getAddress(report.collection.address);
const registryAddress = getAddress(report.registry.address);
const expectedOwner = getAddress(report.owner);
const recipient = getAddress(recipientArgument);
const collection = new Contract(collectionAddress, artifact("GravityGoons").abi, provider);
const registry = new Contract(registryAddress, artifact("GravityGoonsProgressRegistry").abi, provider);

const [
  collectionOwner,
  registryOwner,
  registryPendingOwner,
  linkedCollection,
  mintOpen,
  creatorMinted,
  publicMinted,
  totalMinted,
] = await Promise.all([
  collection.owner(),
  registry.owner(),
  registry.pendingOwner(),
  registry.collection(),
  collection.mintOpen(),
  collection.creatorMinted(),
  collection.publicMinted(),
  collection.totalMinted(),
]);

if (getAddress(collectionOwner) !== expectedOwner) throw new Error("Collection is not owned by the recorded Safe");
if (getAddress(registryOwner) !== expectedOwner) throw new Error("Registry ownership has not been accepted by the recorded Safe");
if (getAddress(registryPendingOwner) !== ZeroAddress) throw new Error("Registry still has a pending ownership transfer");
if (getAddress(linkedCollection) !== collectionAddress) throw new Error("Registry is linked to the wrong collection");
if (mintOpen) throw new Error("Public mint is open; verification requires it to remain closed");
if (creatorMinted !== 50n || publicMinted !== 0n || totalMinted !== 50n) {
  throw new Error(`Unexpected mint counts: creator=${creatorMinted} public=${publicMinted} total=${totalMinted}`);
}

const reserveOwners = await Promise.all(reserveIds.map((tokenId) => collection.ownerOf(tokenId)));
if (reserveOwners.some((owner) => getAddress(owner) !== recipient)) {
  throw new Error("At least one creator reserve token is not owned by the expected recipient");
}

const starts = [1, 257, 513, 769];
const words = await Promise.all(starts.map((start) => collection.availabilityWord(start)));
const available = new Set();
for (let index = 0; index < starts.length; index += 1) {
  for (let offset = 0; offset < 256; offset += 1) {
    const tokenId = starts[index] + offset;
    if (tokenId <= 1000 && ((words[index] >> BigInt(offset)) & 1n) === 1n) available.add(tokenId);
  }
}
if (available.size !== 950 || reserveIds.some((tokenId) => available.has(tokenId))) {
  throw new Error("Exact-ID availability does not equal the 950-token public allocation");
}

const [royaltyRecipient, royaltyAmount] = await collection.royaltyInfo(reserveIds[0], parseEther("1"));
if (getAddress(royaltyRecipient) !== expectedOwner || royaltyAmount !== parseEther("0.05")) {
  throw new Error("ERC-2981 royalty verification failed");
}
const tokenUri = await collection.tokenURI(reserveIds[0]);
if (!tokenUri.startsWith(report.metadata_base_url)) throw new Error("Token URI does not use the recorded metadata base URI");

report.registry.owner = getAddress(registryOwner);
report.registry.pending_owner = getAddress(registryPendingOwner);
report.collection.owner = getAddress(collectionOwner);
report.collection.mint_open = false;
report.collection.creator_minted = Number(creatorMinted);
report.collection.public_minted = Number(publicMinted);
report.collection.total_minted = Number(totalMinted);
report.reserve = {
  recipient,
  token_count: reserveIds.length,
  token_ids_verified: true,
  remaining_public_ids: available.size,
};
report.royalty = {
  recipient: getAddress(royaltyRecipient),
  basis_points: 500,
};
report.public_mint_open = false;
report.post_safe_verification_complete = true;
report.verified_at = new Date().toISOString();
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  report: reportPath,
  chain_id: Number(network.chainId),
  creator_minted: Number(creatorMinted),
  public_available: available.size,
  reserve_recipient: recipient,
  mint_open: false,
}, null, 2));
