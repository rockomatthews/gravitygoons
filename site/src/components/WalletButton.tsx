"use client";

import { useWallet } from "@/components/WalletProvider";

export function WalletButton() {
  const { account, connecting, connect } = useWallet();
  const label = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : connecting ? "CONNECTING…" : "CONNECT BASE WALLET";
  return <button className="wallet-button" onClick={connect} disabled={connecting}><span className="wallet-label-full">{label}</span><span className="wallet-label-short">{account ? `${account.slice(0, 4)}…${account.slice(-3)}` : connecting ? "WAIT…" : "CONNECT"}</span></button>;
}
