import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";
import "dotenv/config";

const root = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(root, "..");
const required = [
  "BASE_RPC_URL", "DEPLOYER_PRIVATE_KEY", "DEPLOYMENT_STAGE", "SAFE_ADDRESS",
  "COLLECTION_ADDRESS", "MATCH_USDC_ADDRESS", "MATCH_SETTLEMENT_SIGNER_ADDRESS",
];
for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) throw new Error(`Set ${key} in contract/.env`);
}

const stage = process.env.DEPLOYMENT_STAGE;
if (stage !== "sepolia" && stage !== "mainnet") throw new Error("DEPLOYMENT_STAGE must be sepolia or mainnet");
if (process.env.ALLOW_MATCH_ESCROW_V2_DEPLOY !== "true") throw new Error("Set ALLOW_MATCH_ESCROW_V2_DEPLOY=true only for the separately authorized V2 deployment checkpoint");

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const safe = getAddress(process.env.SAFE_ADDRESS);
const collection = getAddress(process.env.COLLECTION_ADDRESS);
const usdc = getAddress(process.env.MATCH_USDC_ADDRESS);
const settlementSigner = getAddress(process.env.MATCH_SETTLEMENT_SIGNER_ADDRESS);
const network = await provider.getNetwork();
const expectedChainId = stage === "mainnet" ? 8453n : 84532n;
if (network.chainId !== expectedChainId) throw new Error(`Refusing ${stage} deployment on chain ${network.chainId}; expected ${expectedChainId}`);
if (stage === "mainnet") {
  if (process.env.ALLOW_MAINNET_MATCH_ESCROW_V2_DEPLOY !== "true") throw new Error("Set ALLOW_MAINNET_MATCH_ESCROW_V2_DEPLOY=true only for the reviewed mainnet V2 checkpoint");
  if (usdc !== getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")) throw new Error("Mainnet match escrow must use native Base USDC");
}
if ((await provider.getCode(collection)) === "0x") throw new Error("COLLECTION_ADDRESS has no deployed bytecode");
if ((await provider.getBalance(deployer.address)) === 0n) throw new Error(`Deployer ${deployer.address} has no Base gas`);

const recordPath = path.join(repositoryRoot, "reports", `base-${stage}-match-escrow-v2-deployment.json`);
if (fs.existsSync(recordPath)) throw new Error(`Refusing to overwrite ${recordPath}`);

const artifact = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "GoonMatchEscrowV2.json"), "utf8"));
const escrow = await new ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(safe, usdc, collection, settlementSigner, safe);
const transaction = escrow.deploymentTransaction();
await escrow.waitForDeployment();
const address = await escrow.getAddress();
const receipt = await transaction.wait();

const verified = {
  owner: getAddress(await escrow.owner()),
  usdc: getAddress(await escrow.usdc()),
  collection: getAddress(await escrow.collection()),
  settlementSigner: getAddress(await escrow.settlementSigner()),
  feeRecipient: getAddress(await escrow.feeRecipient()),
  houseFeeBps: Number(await escrow.houseFeeBps()),
  disputeWindowSeconds: Number(await escrow.DISPUTE_WINDOW()),
  paused: await escrow.paused(),
};
if (verified.owner !== safe || verified.feeRecipient !== safe || verified.usdc !== usdc || verified.collection !== collection || verified.settlementSigner !== settlementSigner) throw new Error("Escrow V2 constructor verification failed");
if (!verified.paused || verified.houseFeeBps !== 0 || verified.disputeWindowSeconds !== 600) throw new Error("Escrow V2 must deploy paused with zero fee and a 600-second correction window");

const record = {
  schema: "gravity-goons-match-escrow-deployment-v2",
  created_at: new Date().toISOString(), stage, chain_id: Number(network.chainId),
  rpc_host: new URL(process.env.BASE_RPC_URL).host,
  deployer: deployer.address, address, deployment_transaction: transaction.hash,
  deployment_block: receipt.blockNumber, ...verified,
};
fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`GoonMatchEscrowV2: ${address}`);
console.log(`Deployment record: ${recordPath}`);
console.log("V2 is PAUSED with fee 0. The Safe must configure the reviewed fee and explicitly unpause it before any USDC can move.");
