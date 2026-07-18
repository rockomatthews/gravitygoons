"use client";

import { useState } from "react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { collectionAbi, collectionAddress, ZERO_ADDRESS } from "@/lib/contracts";

export function OwnerControls() {
  const [reserveIds, setReserveIds] = useState("1,2,3");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");

  async function write(functionName: "setMintOpen" | "creatorMintSelected", args: readonly unknown[]) {
    if (!window.ethereum) return setStatus("Wallet not found.");
    if (collectionAddress === ZERO_ADDRESS) return setStatus("Deploy the contract and configure its address first.");
    try {
      const wallet = createWalletClient({ chain: base, transport: custom(window.ethereum) });
      const [account] = await wallet.requestAddresses();
      const hash = await wallet.writeContract({ address: collectionAddress, abi: collectionAbi, functionName, args: args as never, account });
      setStatus(`Submitted ${hash}`);
    } catch (error) { setStatus(error instanceof Error ? error.message.split("\n")[0] : "Transaction cancelled."); }
  }

  return (
    <div className="owner-grid">
      <section><span>PUBLIC SALE</span><h2>Open or close repeatedly</h2><p>Immediate metadata stays live regardless of sale state.</p><div className="owner-buttons"><button onClick={() => write("setMintOpen", [true])}>OPEN SALE</button><button onClick={() => write("setMintOpen", [false])}>CLOSE SALE</button></div></section>
      <section><span>CREATOR RESERVE</span><h2>Mint selected IDs</h2><input placeholder="Recipient 0x…" value={recipient} onChange={(event) => setRecipient(event.target.value)} /><input value={reserveIds} onChange={(event) => setReserveIds(event.target.value)} /><button onClick={() => write("creatorMintSelected", [recipient, reserveIds.split(",").map((id) => Number(id.trim()))])}>MINT RESERVE IDS</button></section>
      {status && <p className="owner-status">{status}</p>}
    </div>
  );
}
