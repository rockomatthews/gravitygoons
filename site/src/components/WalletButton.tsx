"use client";

import { useWallet } from "@/components/WalletProvider";

export function WalletButton() {
  const { account, connecting, openModal, disconnect } = useWallet();
  const label = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : connecting ? "CONNECTING…" : "CONNECT BASE WALLET";
  return <button className="wallet-button" onClick={account ? disconnect : openModal} disabled={connecting} title={account ? "Disconnect wallet" : "Connect wallet"}><span className="wallet-label-full">{label}</span><span className="wallet-label-short">{account ? `${account.slice(0, 4)}…${account.slice(-3)}` : connecting ? "WAIT…" : "CONNECT"}</span></button>;
}
