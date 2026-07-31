import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Safe from "@safe-global/protocol-kit";
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, getAddress } from "ethers";
import "dotenv/config";

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const CREATOR_ALLOCATION = 50;
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const safeRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-safe.json");
const deploymentRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-deployment.json");
const ownershipRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-registry-ownership.json");
const reservePath = path.join(repositoryRoot, "config", "creator-reserve.json");
const mintRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-creator-reserve-mint.json");
const required = [
  "BASE_RPC_URL",
  "DEPLOYER_PRIVATE_KEY",
  "TEST_SAFE_SIGNER_2_PRIVATE_KEY",
  "CREATOR_RESERVE_RECIPIENT",
];

for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) {
    throw new Error(`Set ${key} in contract/.env or the command environment`);
  }
}
if (process.env.DEPLOYMENT_STAGE !== "sepolia") {
  throw new Error("Refusing creator reserve mint unless DEPLOYMENT_STAGE=sepolia");
}
if (fs.existsSync(mintRecordPath)) {
  throw new Error(`Refusing to overwrite existing reserve mint record ${mintRecordPath}`);
}

const safeRecord = JSON.parse(fs.readFileSync(safeRecordPath, "utf8"));
const deploymentRecord = JSON.parse(fs.readFileSync(deploymentRecordPath, "utf8"));
const ownershipRecord = JSON.parse(fs.readFileSync(ownershipRecordPath, "utf8"));
const reserveBytes = fs.readFileSync(reservePath);
const reserve = JSON.parse(reserveBytes);
const tokenIds = reserve.token_ids;
if (
  reserve.schema !== "gravity-goons-creator-reserve-v1"
  || reserve.token_count !== CREATOR_ALLOCATION
  || !Array.isArray(tokenIds)
  || tokenIds.length !== CREATOR_ALLOCATION
  || new Set(tokenIds).size !== CREATOR_ALLOCATION
) {
  throw new Error("Creator reserve must contain exactly 50 unique token IDs");
}
if (tokenIds.some((tokenId) => !Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000)) {
  throw new Error("Creator reserve token IDs must be integers from 1 through 1000");
}

const safeAddress = getAddress(safeRecord.safe_address);
const collectionAddress = getAddress(deploymentRecord.collection.address);
const recipient = getAddress(process.env.CREATOR_RESERVE_RECIPIENT);
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(`Refusing creator reserve mint on chain ${network.chainId}; expected ${BASE_SEPOLIA_CHAIN_ID}`);
}
if (
  safeRecord.threshold !== 2
  || getAddress(deploymentRecord.owner) !== safeAddress
  || getAddress(ownershipRecord.final_owner) !== safeAddress
) {
  throw new Error("Safe or ownership deployment records do not agree");
}

const signer1 = new Wallet(process.env.DEPLOYER_PRIVATE_KEY);
const signer2 = new Wallet(process.env.TEST_SAFE_SIGNER_2_PRIVATE_KEY);
if (!safeRecord.owners.includes(signer1.address) || !safeRecord.owners.includes(signer2.address)) {
  throw new Error("Configured signers are not both recorded Safe owners");
}

const collection = new Contract(
  collectionAddress,
  [
    "function owner() view returns (address)",
    "function mintOpen() view returns (bool)",
    "function creatorMinted() view returns (uint256)",
    "function publicMinted() view returns (uint256)",
    "function totalMinted() view returns (uint256)",
    "function availabilityWord(uint256 startTokenId) view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
  ],
  provider,
);
if (getAddress(await collection.owner()) !== safeAddress) {
  throw new Error("Collection is not owned by the recorded Safe");
}
if (await collection.mintOpen()) {
  throw new Error("Public mint is unexpectedly open");
}
if (
  (await collection.creatorMinted()) !== 0n
  || (await collection.publicMinted()) !== 0n
  || (await collection.totalMinted()) !== 0n
) {
  throw new Error("Collection supply is not zero before the reserve rehearsal");
}
const availabilityStarts = [1, 257, 513, 769];
const availabilityWords = await Promise.all(
  availabilityStarts.map((startTokenId) => collection.availabilityWord(startTokenId)),
);
const isAvailable = (tokenId, words) => {
  const position = tokenId - 1;
  return ((words[Math.floor(position / 256)] >> BigInt(position % 256)) & 1n) === 1n;
};
const countAvailable = (words) => words.reduce(
  (total, word) => total + word.toString(2).replaceAll("0", "").length,
  0,
);
if (countAvailable(availabilityWords) !== 1000 || tokenIds.some((tokenId) => !isAvailable(tokenId, availabilityWords))) {
  throw new Error("At least one creator reserve token is already unavailable");
}

const protocolKit1 = await Safe.init({
  provider: process.env.BASE_RPC_URL,
  signer: process.env.DEPLOYER_PRIVATE_KEY,
  safeAddress,
});
const mintData = new Interface([
  "function creatorMintSelected(address recipient,uint16[] tokenIds)",
]).encodeFunctionData("creatorMintSelected", [recipient, tokenIds]);
const safeTransaction = await protocolKit1.createTransaction({
  transactions: [{
    to: collectionAddress,
    value: "0",
    data: mintData,
    operation: 0,
  }],
  onlyCalls: true,
});
const signedBy1 = await protocolKit1.signTransaction(safeTransaction);
const protocolKit2 = await Safe.init({
  provider: process.env.BASE_RPC_URL,
  signer: process.env.TEST_SAFE_SIGNER_2_PRIVATE_KEY,
  safeAddress,
});
const signedBy2 = await protocolKit2.signTransaction(signedBy1);
if (signedBy2.signatures.size !== 2) {
  throw new Error(`Expected two Safe signatures, found ${signedBy2.signatures.size}`);
}

console.log(`Prepared creator reserve mint of ${tokenIds.length} exact IDs to ${recipient}`);
console.log(`Collection: ${collectionAddress}`);
console.log(`Safe: ${safeAddress}`);
console.log(`Reserve SHA-256: ${crypto.createHash("sha256").update(reserveBytes).digest("hex")}`);
if (process.env.SAFE_EXECUTE_DRY_RUN === "true") {
  console.log("Dry run complete; no transaction was sent.");
  process.exit(0);
}

const execution = await protocolKit1.executeTransaction(signedBy2);
const receipt = await provider.waitForTransaction(execution.hash);
if (!receipt || receipt.status !== 1) {
  throw new Error(`Safe creator reserve mint failed: ${execution.hash}`);
}

const [mintOpen, creatorMinted, publicMinted, totalMinted, recipientBalance] = await Promise.all([
  collection.mintOpen(),
  collection.creatorMinted(),
  collection.publicMinted(),
  collection.totalMinted(),
  collection.balanceOf(recipient),
]);
if (
  mintOpen
  || creatorMinted !== 50n
  || publicMinted !== 0n
  || totalMinted !== 50n
  || recipientBalance !== 50n
) {
  throw new Error("Post-mint supply, recipient balance, or public mint state verification failed");
}
const transferIds = receipt.logs
  .filter((log) => getAddress(log.address) === collectionAddress)
  .map((log) => {
    try {
      return collection.interface.parseLog(log);
    } catch {
      return null;
    }
  })
  .filter((event) => event?.name === "Transfer")
  .filter((event) => getAddress(event.args.from) === ZeroAddress && getAddress(event.args.to) === recipient)
  .map((event) => Number(event.args.tokenId));
if (
  transferIds.length !== tokenIds.length
  || new Set(transferIds).size !== tokenIds.length
  || tokenIds.some((tokenId) => !transferIds.includes(tokenId))
) {
  throw new Error("Mint receipt does not contain the exact 50 expected transfers to the recipient");
}
const finalAvailabilityWords = await Promise.all(
  availabilityStarts.map((startTokenId) => collection.availabilityWord(startTokenId)),
);
if (
  countAvailable(finalAvailabilityWords) !== 950
  || tokenIds.some((tokenId) => isAvailable(tokenId, finalAvailabilityWords))
) {
  throw new Error("Post-mint availability bitmap does not match the exact 50-token reserve");
}
const metadataSampleIds = [tokenIds[0], tokenIds[Math.floor(tokenIds.length / 2)], tokenIds.at(-1)];
const tokenUris = await Promise.all(metadataSampleIds.map((tokenId) => collection.tokenURI(tokenId)));
if (tokenUris.some((uri, index) => !uri.endsWith(`/${String(metadataSampleIds[index]).padStart(4, "0")}.json`))) {
  throw new Error("A sampled reserved token has an unexpected metadata URI");
}

const record = {
  schema: "gravity-goons-creator-reserve-mint-v1",
  created_at: new Date().toISOString(),
  stage: "sepolia",
  chain_id: Number(network.chainId),
  rpc_host: new URL(process.env.BASE_RPC_URL).host,
  safe_address: safeAddress,
  threshold: safeRecord.threshold,
  signing_owners: [signer1.address, signer2.address],
  collection_address: collectionAddress,
  recipient,
  reserve_file: path.relative(repositoryRoot, reservePath),
  reserve_sha256: crypto.createHash("sha256").update(reserveBytes).digest("hex"),
  token_count: tokenIds.length,
  token_ids: tokenIds,
  transaction: execution.hash,
  block: receipt.blockNumber,
  public_mint_open: mintOpen,
  creator_minted: Number(creatorMinted),
  public_minted: Number(publicMinted),
  total_minted: Number(totalMinted),
  recipient_balance: Number(recipientBalance),
  transfer_ids_verified: transferIds.length,
  availability_slots_verified: 1000,
  metadata_uri_sample_ids: metadataSampleIds,
  test_only: true,
};
fs.writeFileSync(mintRecordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });

console.log(`Creator reserve minted by Safe in ${execution.hash}`);
console.log(`Mint record: ${mintRecordPath}`);
console.log("All 50 exact transfer IDs and sampled metadata URIs verified. Public mint remains closed.");
