import fs from "node:fs";
import path from "node:path";
import { Interface, getAddress } from "ethers";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const deployment = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "reports/base-mainnet-match-escrow-v2-deployment.json"), "utf8"));
const escrow = getAddress(deployment.address);
const safe = getAddress(deployment.owner);
if (deployment.chain_id !== 8453 || deployment.paused !== true || deployment.houseFeeBps !== 0 || deployment.disputeWindowSeconds !== 600) {
  throw new Error("Refusing to build V2 Safe actions from an unverified deployment record");
}

const iface = new Interface([
  "function setFeeConfiguration(address recipient,uint16 feeBps)",
  "function unpause()",
]);
const base = {
  version: "1.0",
  chainId: "8453",
};
const write = (name, meta, transaction) => fs.writeFileSync(
  path.join(repositoryRoot, "reports", name),
  `${JSON.stringify({ ...base, createdAt: Date.now(), meta: { ...meta, txBuilderVersion: "1.18.0", createdFromSafeAddress: safe, createdFromOwnerAddress: "", checksum: "" }, transactions: [transaction] }, null, 2)}\n`,
);

write("base-mainnet-set-match-escrow-v2-fee-2pct-safe.json", {
  name: "Gravity Goons - Set Escrow V2 House Fee to 2%",
  description: `Sets GoonMatchEscrowV2 at ${escrow} to a 2% fee paid to the Gravity Goons Safe. Refunds and voids remain fee-free.`,
}, {
  to: escrow,
  value: "0",
  data: iface.encodeFunctionData("setFeeConfiguration", [safe, 200]),
  contractMethod: { inputs: [{ internalType: "address", name: "recipient", type: "address" }, { internalType: "uint16", name: "feeBps", type: "uint16" }], name: "setFeeConfiguration", payable: false },
  contractInputsValues: { recipient: safe, feeBps: "200" },
});

write("base-mainnet-unpause-match-escrow-v2-safe.json", {
  name: "Gravity Goons - Enable Escrow V2 for Production Test",
  description: `Unpauses GoonMatchEscrowV2 at ${escrow}. Execute only after the 2% fee transaction and constructor verification.`,
}, {
  to: escrow,
  value: "0",
  data: iface.encodeFunctionData("unpause"),
  contractMethod: { inputs: [], name: "unpause", payable: false },
  contractInputsValues: {},
});

console.log("Built V2 Safe fee and unpause transaction files.");
