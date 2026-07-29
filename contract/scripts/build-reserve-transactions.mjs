import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Interface, getAddress } from "ethers";

const [reserveFile, collectionInput, registryInput, recipientInput, outputInput = "safe-reserve-transactions.json"] = process.argv.slice(2);
if (!reserveFile || !collectionInput || !registryInput || !recipientInput) {
  throw new Error("Usage: npm run build:reserve-transactions -- RESERVE_JSON COLLECTION REGISTRY RECIPIENT [OUTPUT_JSON]");
}

const collection = getAddress(collectionInput);
const registry = getAddress(registryInput);
const recipient = getAddress(recipientInput);
const reserve = JSON.parse(fs.readFileSync(path.resolve(reserveFile), "utf8"));
const tokenIds = reserve.token_ids;
if (!Array.isArray(tokenIds) || tokenIds.length !== 50 || new Set(tokenIds).size !== 50) {
  throw new Error("The creator reserve must contain exactly 50 unique token_ids");
}
if (tokenIds.some((tokenId) => !Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000)) {
  throw new Error("Every creator-reserve token ID must be an integer from 1 through 1000");
}

const registryInterface = new Interface(["function acceptOwnership()"]);
const collectionInterface = new Interface(["function creatorMintSelected(address recipient,uint16[] tokenIds)"]);
const transactions = [
  {
    purpose: "Accept two-step ownership of the progression registry",
    to: registry,
    value: "0",
    data: registryInterface.encodeFunctionData("acceptOwnership"),
    operation: 0,
  },
  {
    purpose: "Mint the exact 50-token creator reserve to the hardware-backed owner wallet",
    to: collection,
    value: "0",
    data: collectionInterface.encodeFunctionData("creatorMintSelected", [recipient, tokenIds]),
    operation: 0,
  },
];
const output = {
  schema: "gravity-goons-safe-reserve-transactions-v1",
  chain_id: Number(process.env.CHAIN_ID || 8453),
  reserve_schema: reserve.schema,
  reserve_file: path.resolve(reserveFile),
  reserve_sha256: (await import("node:crypto")).createHash("sha256").update(fs.readFileSync(path.resolve(reserveFile))).digest("hex"),
  collection,
  registry,
  recipient,
  token_count: tokenIds.length,
  token_ids: tokenIds,
  transactions,
  note: "Review both calls in Safe before signing. This file contains calldata only and no private keys.",
};
fs.writeFileSync(path.resolve(outputInput), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: path.resolve(outputInput), token_count: tokenIds.length, recipient, transactions: transactions.length }, null, 2));
