"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
}

type WalletState = {
  account: `0x${string}` | null;
  connecting: boolean;
  message: string;
  connect: () => Promise<`0x${string}` | null>;
};

const WalletContext = createContext<WalletState | null>(null);
const BASE_CHAIN_HEX = "0x2105";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState("");

  const ensureBase = useCallback(async () => {
    if (!window.ethereum) throw new Error("Open this site inside a Base-compatible wallet.");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_HEX }] });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
      if (code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: BASE_CHAIN_HEX, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }],
      });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setMessage("No wallet detected. Install Coinbase Wallet, MetaMask, or another Base wallet.");
      return null;
    }
    setConnecting(true);
    setMessage("Connecting to Base…");
    try {
      await ensureBase();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as `0x${string}`[];
      const next = accounts[0] ?? null;
      setAccount(next);
      setMessage(next ? "Connected to Base" : "Wallet connection cancelled.");
      return next;
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "Wallet connection cancelled.");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [ensureBase]);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      const first = (accounts as `0x${string}`[])[0];
      if (first) setAccount(first);
    }).catch(() => undefined);
    const handleAccounts = (...args: unknown[]) => setAccount(((args[0] as `0x${string}`[]) ?? [])[0] ?? null);
    window.ethereum.on?.("accountsChanged", handleAccounts);
    return () => window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
  }, []);

  const value = useMemo(() => ({ account, connecting, message, connect }), [account, connecting, message, connect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
