import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Contract, JsonRpcProvider, getAddress } from "ethers";
import "dotenv/config";

if (!process.env.BASE_RPC_URL || !process.env.SAFE_ADDRESS || !process.env.EXPECTED_SAFE_OWNERS) {
  throw new Error("Set BASE_RPC_URL, SAFE_ADDRESS, and EXPECTED_SAFE_OWNERS (three comma-separated addresses).");
}
const provider = new JsonRpcProvider(process.env.BASE_RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== 8453n) throw new Error(`Refusing non-mainnet Safe verification on chain ${network.chainId}.`);
const safeAddress = getAddress(process.env.SAFE_ADDRESS);
const expectedOwners = process.env.EXPECTED_SAFE_OWNERS.split(",").map((value) => getAddress(value.trim()));
if (expectedOwners.length !== 3 || new Set(expectedOwners).size !== 3) throw new Error("Exactly three independent Safe owners are required.");
if ((await provider.getCode(safeAddress)) === "0x") throw new Error("No Safe bytecode found.");
const safe = new Contract(safeAddress, [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
], provider);
const owners = (await safe.getOwners()).map(getAddress);
const threshold = Number(await safe.getThreshold());
if (threshold !== 2 || owners.length !== 3 || !expectedOwners.every((owner) => owners.includes(owner))) {
  throw new Error("Safe owners or 2-of-3 threshold do not match the expected production custody.");
}
const output = path.resolve(import.meta.dirname, "..", "..", "reports", "base-mainnet-safe.json");
if (fs.existsSync(output) && process.env.ALLOW_SAFE_REPORT_OVERWRITE !== "true") throw new Error(`Refusing to overwrite ${output}.`);
const report = {
  schema: "gravity-goons-mainnet-safe-verification-v1",
  verified_at: new Date().toISOString(),
  chain_id: 8453,
  safe_address: safeAddress,
  threshold,
  owners,
  verified_onchain: true,
  signer_storage_attested: false,
  note: "On-chain structure verified. Independent backup and hardware custody are a human launch attestation.",
};
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: process.env.ALLOW_SAFE_REPORT_OVERWRITE === "true" ? "w" : "wx" });
console.log(JSON.stringify(report, null, 2));
