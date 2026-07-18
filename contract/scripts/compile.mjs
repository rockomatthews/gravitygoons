import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = path.resolve(import.meta.dirname, "..");
const sources = {};
for (const file of ["GravityGoons.sol", "GravityGoonsProgressRegistry.sol"]) {
  sources[`src/${file}`] = { content: fs.readFileSync(path.join(root, "src", file), "utf8") };
}

function findImports(importPath) {
  const candidates = [path.join(root, importPath), path.join(root, "node_modules", importPath)];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { contents: fs.readFileSync(candidate, "utf8") };
  }
  return { error: `Import not found: ${importPath}` };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    evmVersion: "shanghai",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
for (const error of output.errors ?? []) {
  console[error.severity === "error" ? "error" : "warn"](error.formattedMessage);
}
if ((output.errors ?? []).some((error) => error.severity === "error")) process.exit(1);
fs.rmSync(path.join(root, "artifacts"), { recursive: true, force: true });
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
for (const [source, contracts] of Object.entries(output.contracts)) {
  if (!source.startsWith("src/")) continue;
  for (const [name, artifact] of Object.entries(contracts)) {
    fs.writeFileSync(path.join(root, "artifacts", `${name}.json`), JSON.stringify({
      contractName: name,
      sourceName: source,
      abi: artifact.abi,
      bytecode: `0x${artifact.evm.bytecode.object}`,
      deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`,
    }, null, 2));
  }
}
console.log("Compiled Gravity Goons contracts.");
