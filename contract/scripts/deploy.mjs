import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Contract, ContractFactory, JsonRpcProvider, NonceManager, Wallet, getAddress } from "ethers";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(root, "..");
const required = [
  "BASE_RPC_URL",
  "DEPLOYER_PRIVATE_KEY",
  "OWNER_ADDRESS",
  "GAME_SIGNER_ADDRESS",
  "METADATA_BASE_URL",
  "DEPLOYMENT_STAGE",
];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) throw new Error(`Set ${key} in contract/.env`);
}

const stage = process.env.DEPLOYMENT_STAGE;
if (stage !== "sepolia" && stage !== "mainnet") {
  throw new Error("DEPLOYMENT_STAGE must be sepolia or mainnet");
}
if (!process.env.METADATA_BASE_URL.startsWith("ipfs://") || !process.env.METADATA_BASE_URL.endsWith("/")) {
  throw new Error("METADATA_BASE_URL must be the immutable ipfs:// metadata directory CID ending in /");
}

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const deploymentSigner = new NonceManager(deployer);
const owner = getAddress(process.env.OWNER_ADDRESS);
const gameSigner = getAddress(process.env.GAME_SIGNER_ADDRESS);
const network = await provider.getNetwork();
const expectedChainId = stage === "mainnet" ? 8453n : 84532n;
if (network.chainId !== expectedChainId) {
  throw new Error(`Refusing ${stage} deployment on chain ${network.chainId}; expected ${expectedChainId}`);
}
if (stage === "sepolia" && process.env.ALLOW_NON_BASE !== "true") {
  throw new Error("Set ALLOW_NON_BASE=true for the deliberate Base Sepolia test deployment");
}
if (stage === "mainnet") {
  if (process.env.ALLOW_MAINNET_DEPLOY !== "true") {
    throw new Error("Set ALLOW_MAINNET_DEPLOY=true only for the reviewed Base mainnet deployment");
  }
  if (!process.env.SAFE_ADDRESS || getAddress(process.env.SAFE_ADDRESS) !== owner) {
    throw new Error("SAFE_ADDRESS must be set and match OWNER_ADDRESS for mainnet");
  }
}
if ((await provider.getBalance(deployer.address)) === 0n) {
  throw new Error(`Deployer ${deployer.address} has no native gas token on chain ${network.chainId}`);
}

function artifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "artifacts", `${name}.json`), "utf8"));
}

const registryArtifact = artifact("GravityGoonsProgressRegistry");
const collectionArtifact = artifact("GravityGoons");
const disciplineWords = JSON.parse(fs.readFileSync(path.join(root, "config", "discipline-words.json"), "utf8"));
const rarityWords = JSON.parse(fs.readFileSync(path.join(root, "config", "rarity-words.json"), "utf8"));

console.log(`Deploying from ${deployer.address} on chain ${network.chainId} (${stage})...`);
let registry;
let registryAddress;
let registryDeploymentHash;
let registryDeploymentBlock;
const recoveringRegistry = Boolean(process.env.RECOVER_REGISTRY_ADDRESS || process.env.RECOVER_REGISTRY_TRANSACTION_HASH);
if (recoveringRegistry) {
  if (!process.env.RECOVER_REGISTRY_ADDRESS || !process.env.RECOVER_REGISTRY_TRANSACTION_HASH) {
    throw new Error("Set both RECOVER_REGISTRY_ADDRESS and RECOVER_REGISTRY_TRANSACTION_HASH");
  }
  registryAddress = getAddress(process.env.RECOVER_REGISTRY_ADDRESS);
  const priorTransaction = await provider.getTransaction(process.env.RECOVER_REGISTRY_TRANSACTION_HASH);
  const priorReceipt = await provider.getTransactionReceipt(process.env.RECOVER_REGISTRY_TRANSACTION_HASH);
  if (
    !priorTransaction
    || !priorReceipt
    || priorReceipt.status !== 1
    || getAddress(priorTransaction.from) !== deployer.address
    || (await provider.getCode(registryAddress)) === "0x"
  ) {
    throw new Error("Recovered registry transaction or bytecode verification failed");
  }
  registry = new Contract(registryAddress, registryArtifact.abi, deploymentSigner);
  if (getAddress(await registry.owner()) !== deployer.address) {
    throw new Error("Recovered registry is not owned by the expected deployer");
  }
  if (getAddress(await registry.gameSigner()) !== gameSigner) {
    throw new Error("Recovered registry game signer does not match configuration");
  }
  if (getAddress(await registry.collection()) !== "0x0000000000000000000000000000000000000000") {
    throw new Error("Recovered registry is already linked to a collection");
  }
  registryDeploymentHash = priorTransaction.hash;
  registryDeploymentBlock = priorReceipt.blockNumber;
  console.log(`Recovered GravityGoonsProgressRegistry: ${registryAddress}`);
} else {
  registry = await new ContractFactory(registryArtifact.abi, registryArtifact.bytecode, deploymentSigner).deploy(
    deployer.address,
    gameSigner,
  );
  const registryDeployment = registry.deploymentTransaction();
  await registry.waitForDeployment();
  registryAddress = await registry.getAddress();
  registryDeploymentHash = registryDeployment?.hash ?? null;
  registryDeploymentBlock = (await registryDeployment?.wait())?.blockNumber ?? null;
  console.log(`GravityGoonsProgressRegistry: ${registryAddress}`);
}

const collection = await new ContractFactory(collectionArtifact.abi, collectionArtifact.bytecode, deploymentSigner).deploy(
  owner,
  registryAddress,
  process.env.METADATA_BASE_URL,
  disciplineWords,
  rarityWords,
);
const collectionDeployment = collection.deploymentTransaction();
await collection.waitForDeployment();
const collectionAddress = await collection.getAddress();
console.log(`GravityGoons: ${collectionAddress}`);

const link = await registry.setCollectionOnce(collectionAddress);
const linkReceipt = await link.wait();
let ownershipTransferHash = null;
let ownershipTransferBlock = null;
if (owner !== deployer.address) {
  const transfer = await registry.transferOwnership(owner);
  const transferReceipt = await transfer.wait();
  ownershipTransferHash = transfer.hash;
  ownershipTransferBlock = transferReceipt.blockNumber;
  console.log(`Registry ownership transfer proposed to ${owner}; that account must call acceptOwnership().`);
}

const registryOwner = getAddress(await registry.owner());
const registryPendingOwner = getAddress(await registry.pendingOwner());
const collectionOwner = getAddress(await collection.owner());
const mintOpen = await collection.mintOpen();
if (getAddress(await registry.collection()) !== collectionAddress) throw new Error("Registry collection link verification failed");
if (collectionOwner !== owner) throw new Error("Collection owner verification failed");
if (mintOpen) throw new Error("Deployment unexpectedly opened public minting");
if (owner !== deployer.address && registryPendingOwner !== owner) throw new Error("Registry pending owner verification failed");

const defaultRecord = path.join(repositoryRoot, "reports", `base-${stage}-deployment.json`);
const recordPath = process.env.DEPLOYMENT_RECORD_OUTPUT
  ? path.resolve(process.cwd(), process.env.DEPLOYMENT_RECORD_OUTPUT)
  : defaultRecord;
if (fs.existsSync(recordPath) && process.env.ALLOW_DEPLOYMENT_RECORD_OVERWRITE !== "true") {
  throw new Error(`Refusing to overwrite deployment record ${recordPath}`);
}
fs.mkdirSync(path.dirname(recordPath), { recursive: true });
const record = {
  schema: "gravity-goons-contract-deployment-v1",
  created_at: new Date().toISOString(),
  stage,
  chain_id: Number(network.chainId),
  rpc_host: new URL(process.env.BASE_RPC_URL).host,
  deployer: deployer.address,
  owner,
  safe_address: stage === "mainnet" ? owner : null,
  game_signer: gameSigner,
  metadata_base_url: process.env.METADATA_BASE_URL,
  registry: {
    address: registryAddress,
    deployment_transaction: registryDeploymentHash,
    deployment_block: registryDeploymentBlock,
    owner: registryOwner,
    pending_owner: registryPendingOwner,
    ownership_transfer_transaction: ownershipTransferHash,
    ownership_transfer_block: ownershipTransferBlock,
    collection: collectionAddress,
  },
  collection: {
    address: collectionAddress,
    deployment_transaction: collectionDeployment?.hash ?? null,
    deployment_block: (await collectionDeployment?.wait())?.blockNumber ?? null,
    owner: collectionOwner,
    link_transaction: link.hash,
    link_block: linkReceipt.blockNumber,
    mint_open: false,
    creator_minted: Number(await collection.creatorMinted()),
    public_minted: Number(await collection.publicMinted()),
  },
  public_mint_open: false,
};
fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Deployment record: ${recordPath}`);
console.log("Registry linked. Public minting remains closed.");
