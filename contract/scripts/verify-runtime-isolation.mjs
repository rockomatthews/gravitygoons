const forbidden = ["ganache", "mocha", "solc"];
const installed = [];

for (const packageName of forbidden) {
  try {
    import.meta.resolve(packageName);
    installed.push(packageName);
  } catch {
    // Expected in the production deployment runtime.
  }
}

if (installed.length) {
  throw new Error(`Development packages remain installed: ${installed.join(", ")}. Run npm prune --omit=dev before loading the deployer key.`);
}

console.log("Runtime isolation verified: no Ganache, Mocha, or solc package is installed.");
