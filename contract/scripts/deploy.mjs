import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const required = ["BASE_RPC_URL", "DEPLOYER_PRIVATE_KEY", "OWNER_ADDRESS", "GAME_SIGNER_ADDRESS", "METADATA_BASE_URL"];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) throw new Error(`Set ${key} in contract/.env`);
}
if (!process.env.METADATA_BASE_URL.startsWith("https://") || !process.env.METADATA_BASE_URL.endsWith("/")) {
  throw new Error("METADATA_BASE_URL must be a stable HTTPS URL ending in /");
}

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const owner = getAddress(process.env.OWNER_ADDRESS);
const gameSigner = getAddress(process.env.GAME_SIGNER_ADDRESS);
const network = await provider.getNetwork();
if (network.chainId !== 8453n && process.env.ALLOW_NON_BASE !== "true") {
  throw new Error(`Refusing chain ${network.chainId}. Set ALLOW_NON_BASE=true only for a deliberate test deployment.`);
}

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`), "utf8"));
}

const registryArtifact = artifact("GravityGoonsProgressRegistry");
const collectionArtifact = artifact("GravityGoons");
const words = JSON.parse(fs.readFileSync(path.join(root, "config", "discipline-words.json"), "utf8"));

console.log(`Deploying from ${deployer.address} on chain ${network.chainId}...`);
const registry = await new ContractFactory(registryArtifact.abi, registryArtifact.bytecode, deployer).deploy(deployer.address, gameSigner);
await registry.waitForDeployment();
console.log(`GravityGoonsProgressRegistry: ${await registry.getAddress()}`);

const collection = await new ContractFactory(collectionArtifact.abi, collectionArtifact.bytecode, deployer).deploy(
  owner,
  await registry.getAddress(),
  process.env.METADATA_BASE_URL,
  words,
);
await collection.waitForDeployment();
console.log(`GravityGoons: ${await collection.getAddress()}`);

const link = await registry.setCollectionOnce(await collection.getAddress());
await link.wait();
if (owner !== deployer.address) {
  const transfer = await registry.transferOwnership(owner);
  await transfer.wait();
  console.log(`Registry ownership transfer proposed to ${owner}; that wallet must call acceptOwnership().`);
}
console.log("Registry linked. Minting remains closed until the owner calls setMintOpen(true).");
