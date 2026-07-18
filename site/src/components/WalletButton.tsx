"use client";

import { useWallet } from "@/components/WalletProvider";

export function WalletButton() {
  const { account, connecting, connect } = useWallet();
  return <button className="wallet-button" onClick={connect} disabled={connecting}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : connecting ? "CONNECTING…" : "CONNECT BASE WALLET"}</button>;
}

