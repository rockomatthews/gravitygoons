import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Safe from "@safe-global/protocol-kit";
import { Contract, Interface, JsonRpcProvider, Wallet, ZeroAddress, getAddress } from "ethers";
import "dotenv/config";

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const safeRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-safe.json");
const deploymentRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-deployment.json");
const acceptanceRecordPath = path.join(repositoryRoot, "reports", "base-sepolia-registry-ownership.json");
const required = ["BASE_RPC_URL", "DEPLOYER_PRIVATE_KEY", "TEST_SAFE_SIGNER_2_PRIVATE_KEY"];

for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) {
    throw new Error(`Set ${key} in contract/.env`);
  }
}
if (process.env.DEPLOYMENT_STAGE !== "sepolia") {
  throw new Error("Refusing Safe execution unless DEPLOYMENT_STAGE=sepolia");
}
if (fs.existsSync(acceptanceRecordPath)) {
  throw new Error(`Refusing to overwrite existing ownership record ${acceptanceRecordPath}`);
}

const safeRecord = JSON.parse(fs.readFileSync(safeRecordPath, "utf8"));
const deploymentRecord = JSON.parse(fs.readFileSync(deploymentRecordPath, "utf8"));
const safeAddress = getAddress(safeRecord.safe_address);
const registryAddress = getAddress(deploymentRecord.registry.address);
const collectionAddress = getAddress(deploymentRecord.collection.address);
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(`Refusing Safe execution on chain ${network.chainId}; expected ${BASE_SEPOLIA_CHAIN_ID}`);
}

const signer1 = new Wallet(process.env.DEPLOYER_PRIVATE_KEY);
const signer2 = new Wallet(process.env.TEST_SAFE_SIGNER_2_PRIVATE_KEY);
if (!safeRecord.owners.includes(signer1.address) || !safeRecord.owners.includes(signer2.address)) {
  throw new Error("Configured signers are not both recorded Safe owners");
}
if (safeRecord.threshold !== 2) {
  throw new Error(`Expected Safe threshold 2, found ${safeRecord.threshold}`);
}

const registry = new Contract(
  registryAddress,
  [
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
    "function acceptOwnership()",
  ],
  provider,
);
const collection = new Contract(
  collectionAddress,
  [
    "function owner() view returns (address)",
    "function mintOpen() view returns (bool)",
    "function creatorMinted() view returns (uint256)",
    "function publicMinted() view returns (uint256)",
  ],
  provider,
);
if (getAddress(await registry.owner()) !== signer1.address) {
  throw new Error("Registry current owner is not the expected deployer");
}
if (getAddress(await registry.pendingOwner()) !== safeAddress) {
  throw new Error("Registry pending owner is not the recorded Safe");
}
if (getAddress(await collection.owner()) !== safeAddress) {
  throw new Error("Collection is not owned by the recorded Safe");
}
if (await collection.mintOpen()) {
  throw new Error("Public mint is unexpectedly open");
}
if ((await collection.creatorMinted()) !== 0n || (await collection.publicMinted()) !== 0n) {
  throw new Error("Collection supply changed before ownership acceptance");
}

const protocolKit1 = await Safe.init({
  provider: process.env.BASE_RPC_URL,
  signer: process.env.DEPLOYER_PRIVATE_KEY,
  safeAddress,
});
const acceptData = new Interface(["function acceptOwnership()"]).encodeFunctionData("acceptOwnership");
const safeTransaction = await protocolKit1.createTransaction({
  transactions: [{
    to: registryAddress,
    value: "0",
    data: acceptData,
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

console.log(`Prepared 2-of-3 Safe acceptance for registry ${registryAddress}`);
console.log(`Safe: ${safeAddress}`);
console.log(`Signers: ${signer1.address}, ${signer2.address}`);
if (process.env.SAFE_EXECUTE_DRY_RUN === "true") {
  console.log("Dry run complete; no transaction was sent.");
  process.exit(0);
}

const execution = await protocolKit1.executeTransaction(signedBy2);
const receipt = await provider.waitForTransaction(execution.hash);
if (!receipt || receipt.status !== 1) {
  throw new Error(`Safe ownership acceptance failed: ${execution.hash}`);
}

const finalOwner = getAddress(await registry.owner());
const finalPendingOwner = getAddress(await registry.pendingOwner());
const mintOpen = await collection.mintOpen();
const creatorMinted = Number(await collection.creatorMinted());
const publicMinted = Number(await collection.publicMinted());
if (finalOwner !== safeAddress || finalPendingOwner !== ZeroAddress) {
  throw new Error("Registry ownership did not finalize to the Safe");
}
if (mintOpen || creatorMinted !== 0 || publicMinted !== 0) {
  throw new Error("Collection mint state changed during registry ownership acceptance");
}

const record = {
  schema: "gravity-goons-registry-ownership-v1",
  created_at: new Date().toISOString(),
  stage: "sepolia",
  chain_id: Number(network.chainId),
  rpc_host: new URL(process.env.BASE_RPC_URL).host,
  safe_address: safeAddress,
  threshold: safeRecord.threshold,
  signing_owners: [signer1.address, signer2.address],
  registry_address: registryAddress,
  previous_owner: signer1.address,
  final_owner: finalOwner,
  final_pending_owner: finalPendingOwner,
  transaction: execution.hash,
  block: receipt.blockNumber,
  collection_address: collectionAddress,
  public_mint_open: mintOpen,
  creator_minted: creatorMinted,
  public_minted: publicMinted,
  test_only: true,
};
fs.writeFileSync(acceptanceRecordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });

console.log(`Registry ownership accepted by Safe in ${execution.hash}`);
console.log(`Ownership record: ${acceptanceRecordPath}`);
console.log("Public mint remains closed and total minted supply remains zero.");
