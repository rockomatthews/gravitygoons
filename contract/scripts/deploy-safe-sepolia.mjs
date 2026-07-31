import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Safe from "@safe-global/protocol-kit";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import "dotenv/config";

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const SAFE_THRESHOLD = 2;
const required = [
  "BASE_RPC_URL",
  "DEPLOYER_PRIVATE_KEY",
  "TEST_SAFE_SIGNER_2_PRIVATE_KEY",
  "TEST_SAFE_SIGNER_3_PRIVATE_KEY",
  "DEPLOYMENT_STAGE",
];

for (const key of required) {
  if (!process.env[key] || process.env[key].includes("REPLACE")) {
    throw new Error(`Set ${key} in contract/.env`);
  }
}
if (process.env.DEPLOYMENT_STAGE !== "sepolia") {
  throw new Error("Refusing Safe deployment unless DEPLOYMENT_STAGE=sepolia");
}

const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const deployer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const signer2 = new Wallet(process.env.TEST_SAFE_SIGNER_2_PRIVATE_KEY);
const signer3 = new Wallet(process.env.TEST_SAFE_SIGNER_3_PRIVATE_KEY);
const owners = [deployer.address, signer2.address, signer3.address].map(getAddress);
const network = await provider.getNetwork();

if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
  throw new Error(`Refusing Safe deployment on chain ${network.chainId}; expected ${BASE_SEPOLIA_CHAIN_ID}`);
}
if (new Set(owners).size !== owners.length) {
  throw new Error("Safe owners must be three distinct addresses");
}
if ((await provider.getBalance(deployer.address)) === 0n) {
  throw new Error(`Deployer ${deployer.address} has no Base Sepolia ETH`);
}

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const recordPath = path.join(repositoryRoot, "reports", "base-sepolia-safe.json");
if (fs.existsSync(recordPath)) {
  throw new Error(`Refusing to overwrite existing Safe record ${recordPath}`);
}

const predictedSafe = {
  safeAccountConfig: {
    owners,
    threshold: SAFE_THRESHOLD,
  },
};
const protocolKit = await Safe.init({
  provider: process.env.BASE_RPC_URL,
  signer: process.env.DEPLOYER_PRIVATE_KEY,
  predictedSafe,
});
const safeAddress = getAddress(await protocolKit.getAddress());
const alreadyDeployed = await protocolKit.isSafeDeployed();
let transactionHash;
let receipt;

if (alreadyDeployed) {
  transactionHash = process.env.SAFE_DEPLOYMENT_TRANSACTION_HASH;
  if (!transactionHash) {
    throw new Error(
      `Predicted Safe ${safeAddress} is already deployed. `
      + "Set SAFE_DEPLOYMENT_TRANSACTION_HASH to recover and verify its deployment record.",
    );
  }
  const priorTransaction = await provider.getTransaction(transactionHash);
  receipt = await provider.getTransactionReceipt(transactionHash);
  if (
    !priorTransaction
    || !receipt
    || receipt.status !== 1
    || getAddress(priorTransaction.from) !== deployer.address
  ) {
    throw new Error("Recovery transaction is missing, failed, or was not sent by the expected deployer");
  }
  console.log(`Recovering verified record for already-deployed Safe ${safeAddress}...`);
} else {
  const deployment = await protocolKit.createSafeDeploymentTransaction();
  console.log(`Deploying temporary 2-of-3 Safe ${safeAddress} on Base Sepolia...`);
  console.log(`Owners: ${owners.join(", ")}`);
  const estimatedGas = await provider.estimateGas({
    from: deployer.address,
    to: deployment.to,
    data: deployment.data,
    value: BigInt(deployment.value),
  });
  console.log(`Estimated deployment gas: ${estimatedGas}`);
  if (process.env.SAFE_DEPLOY_DRY_RUN === "true") {
    console.log("Dry run complete; no transaction was sent.");
    process.exit(0);
  }

  // QuickNode's entry plan limits burst traffic. Protocol Kit performs several
  // read calls while preparing the deployment, so let that window clear before
  // broadcasting the one state-changing request.
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  if (await protocolKit.isSafeDeployed()) {
    throw new Error(`Safe ${safeAddress} became deployed before broadcast; refusing to send`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const transaction = await deployer.sendTransaction({
    to: deployment.to,
    data: deployment.data,
    value: BigInt(deployment.value),
  });
  transactionHash = transaction.hash;
  receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Safe deployment transaction failed: ${transactionHash}`);
  }
}

// Keep post-confirmation verification in a separate QuickNode rate window from
// Protocol Kit initialization and transaction recovery.
await new Promise((resolve) => setTimeout(resolve, 1_500));
if ((await provider.getCode(safeAddress)) === "0x") {
  throw new Error("Safe bytecode was not found after the deployment transaction confirmed");
}
await new Promise((resolve) => setTimeout(resolve, 500));
const safeContract = new Contract(
  safeAddress,
  [
    "function getOwners() view returns (address[])",
    "function getThreshold() view returns (uint256)",
  ],
  provider,
);
const verifiedOwners = (await safeContract.getOwners()).map(getAddress);
await new Promise((resolve) => setTimeout(resolve, 500));
const verifiedThreshold = Number(await safeContract.getThreshold());
if (
  verifiedThreshold !== SAFE_THRESHOLD
  || verifiedOwners.length !== owners.length
  || !owners.every((owner) => verifiedOwners.includes(owner))
) {
  throw new Error("Deployed Safe owner or threshold verification failed");
}

const record = {
  schema: "gravity-goons-safe-deployment-v1",
  created_at: new Date().toISOString(),
  stage: "sepolia",
  chain_id: Number(network.chainId),
  rpc_host: new URL(process.env.BASE_RPC_URL).host,
  safe_address: safeAddress,
  threshold: verifiedThreshold,
  owners: verifiedOwners,
  deployer: deployer.address,
  deployment_transaction: transactionHash,
  deployment_block: receipt.blockNumber,
  test_only: true,
};
fs.mkdirSync(path.dirname(recordPath), { recursive: true });
fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });

console.log(`Safe deployed and verified at ${safeAddress}`);
console.log(`Deployment transaction: ${transactionHash}`);
console.log(`Deployment record: ${recordPath}`);
console.log("This Safe is a Base Sepolia rehearsal only; do not reuse these signers on mainnet.");
