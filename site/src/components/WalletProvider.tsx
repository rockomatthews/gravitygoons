"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  createBaseAppDappUrl,
  createMetaMaskDappUrl,
  createRainbowDappUrl,
  isWalletKind,
  type MobileWalletKind,
} from "@/lib/wallet-links";
import { personalSignParams } from "@/lib/wallet-signing";

export type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  disconnect?(): Promise<void>;
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  isRainbow?: boolean;
};

type InjectedWallet = {
  id: string;
  name: string;
  icon: string;
  rdns?: string;
  provider: EthereumProvider;
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthereumProvider;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
  interface WindowEventMap { "eip6963:announceProvider": CustomEvent<Eip6963Detail> }
}

type WalletState = {
  account: `0x${string}` | null;
  provider: EthereumProvider | null;
  connecting: boolean;
  message: string;
  modalOpen: boolean;
  wallets: InjectedWallet[];
  connect: () => Promise<`0x${string}` | null>;
  connectBase: () => Promise<`0x${string}` | null>;
  connectMetaMask: () => Promise<`0x${string}` | null>;
  connectRainbow: () => Promise<`0x${string}` | null>;
  connectWalletConnect: () => Promise<`0x${string}` | null>;
  connectInjected: (walletId?: string) => Promise<`0x${string}` | null>;
  disconnect: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  signMessage: (message: string, address?: string) => Promise<`0x${string}`>;
};

const WalletContext = createContext<WalletState | null>(null);
const BASE_CHAIN_HEX = "0x2105";
const BASE_CHAIN_ID = 8453;
const STORAGE_KEY = "gravity-goons-wallet-connector";

function conciseError(error: unknown): string {
  if (typeof error === "object" && error && "code" in error && Number(error.code) === 4001) return "The request was rejected in the wallet.";
  if (error instanceof Error) return error.message.split("\n")[0];
  return "The wallet connection did not complete.";
}

function normalizeAccount(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value.toLowerCase() as `0x${string}`;
}

async function withConnectionTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Wallet approval timed out. Reopen the wallet app and retry.")), 90_000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [wallets, setWallets] = useState<InjectedWallet[]>([]);
  const providerRef = useRef<EthereumProvider | null>(null);

  const bindProvider = useCallback((nextProvider: EthereumProvider, connectorId: string, nextAccount: `0x${string}`) => {
    providerRef.current = nextProvider;
    setProvider(nextProvider);
    setAccount(nextAccount);
    window.localStorage.setItem(STORAGE_KEY, connectorId);
    setMessage("Connected to Base.");
    setModalOpen(false);
  }, []);

  const ensureBase = useCallback(async (nextProvider: EthereumProvider) => {
    const current = await nextProvider.request<string>({ method: "eth_chainId" }).catch(() => null);
    if (current?.toLowerCase() === BASE_CHAIN_HEX) return;
    try {
      await nextProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_CHAIN_HEX }] });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
      if (code !== 4902) throw new Error("Switch the connected wallet to Base Mainnet and try again.");
      await nextProvider.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: BASE_CHAIN_HEX, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }],
      });
    }
  }, []);

  const finishConnection = useCallback(async (nextProvider: EthereumProvider, connectorId: string, suppliedAccounts?: unknown[]) => {
    await ensureBase(nextProvider);
    const accounts = suppliedAccounts ?? await nextProvider.request<unknown[]>({ method: "eth_requestAccounts" });
    const nextAccount = normalizeAccount(accounts[0]);
    if (!nextAccount) throw new Error("The wallet did not return a Base account.");
    bindProvider(nextProvider, connectorId, nextAccount);
    return nextAccount;
  }, [bindProvider, ensureBase]);

  const findWallet = useCallback((kind: MobileWalletKind) => wallets.find((wallet) => isWalletKind(wallet.name, wallet.rdns, kind)), [wallets]);

  const connectMobileWallet = useCallback(async (
    kind: MobileWalletKind,
    label: string,
    createDappUrl: (url: string) => string,
  ) => {
    const injected = findWallet(kind);
    if (injected) {
      setConnecting(true);
      setMessage(`Waiting for ${label} approval…`);
      try { return await withConnectionTimeout(finishConnection(injected.provider, `${kind}-app`)); }
      catch (error) { setMessage(conciseError(error)); return null; }
      finally { setConnecting(false); }
    }

    setMessage(`Opening Gravity Goons in ${label}…`);
    window.location.assign(createDappUrl(window.location.href));
    return null;
  }, [findWallet, finishConnection]);

  const connectBase = useCallback(async () => {
    return connectMobileWallet("base", "Base App", createBaseAppDappUrl);
  }, [connectMobileWallet]);

  const connectMetaMask = useCallback(async () => connectMobileWallet("metamask", "MetaMask", createMetaMaskDappUrl), [connectMobileWallet]);
  const connectRainbow = useCallback(async () => connectMobileWallet("rainbow", "Rainbow", createRainbowDappUrl), [connectMobileWallet]);

  const connectWalletConnect = useCallback(async () => {
    const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();
    if (!projectId) {
      setMessage("WalletConnect is awaiting a Reown project ID. Use Sign in with Base or a detected browser wallet for now.");
      return null;
    }
    setConnecting(true);
    setMessage("Opening the wallet chooser…");
    try {
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
      const walletConnect = await EthereumProvider.init({
        projectId,
        chains: [BASE_CHAIN_ID],
        showQrModal: true,
        metadata: {
          name: "Gravity Goons",
          description: "Connect to the Gravity Goons collection and live arena.",
          url: window.location.origin,
          icons: [`${window.location.origin}/collection/gravity-goons-logo.png`],
        },
        rpcMap: { [BASE_CHAIN_ID]: process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org" },
      });
      await withConnectionTimeout(walletConnect.connect());
      return await withConnectionTimeout(finishConnection(walletConnect as EthereumProvider, "walletconnect", walletConnect.accounts));
    } catch (error) {
      setMessage(conciseError(error));
      return null;
    } finally { setConnecting(false); }
  }, [finishConnection]);

  const connectInjected = useCallback(async (walletId?: string) => {
    const selected = walletId ? wallets.find((wallet) => wallet.id === walletId)?.provider : wallets[0]?.provider ?? window.ethereum;
    if (!selected) {
      setMessage("No browser wallet was detected. Use Sign in with Base or WalletConnect.");
      return null;
    }
    setConnecting(true);
    setMessage("Waiting for wallet approval…");
    try { return await withConnectionTimeout(finishConnection(selected, walletId ? `injected:${walletId}` : "injected")); }
    catch (error) { setMessage(conciseError(error)); return null; }
    finally { setConnecting(false); }
  }, [finishConnection, wallets]);

  const connect = useCallback(async () => {
    if (account) return account;
    setModalOpen(true);
    setMessage("Choose how to connect.");
    return null;
  }, [account]);

  const disconnect = useCallback(async () => {
    try { await providerRef.current?.disconnect?.(); } catch { /* local disconnect still clears the session */ }
    providerRef.current = null;
    setProvider(null);
    setAccount(null);
    setMessage("Wallet disconnected.");
    window.localStorage.removeItem(STORAGE_KEY);
    await fetch("/api/profile/session/logout", { method: "POST" }).catch(() => undefined);
  }, []);

  const request = useCallback(async <T,>(args: { method: string; params?: unknown[] }) => {
    if (!providerRef.current) throw new Error("Connect a wallet first.");
    return providerRef.current.request<T>(args);
  }, []);

  const signMessage = useCallback(async (text: string, address?: string) => {
    const signer = normalizeAccount(address ?? account);
    if (!signer) throw new Error("Connect a wallet first.");
    try {
      return await withConnectionTimeout(request<`0x${string}`>({ method: "personal_sign", params: personalSignParams(text, signer) }));
    } catch (error) {
      throw new Error(conciseError(error));
    }
  }, [account, request]);

  useEffect(() => {
    const announced = new Map<string, InjectedWallet>();
    const announce = (event: WindowEventMap["eip6963:announceProvider"]) => {
      const { info, provider: announcedProvider } = event.detail;
      announced.set(info.uuid, { id: info.uuid, name: info.name, icon: info.icon, rdns: info.rdns, provider: announcedProvider });
      setWallets(Array.from(announced.values()));
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const legacyTimer = window.setTimeout(() => {
      if (window.ethereum) setWallets((current) => {
        if (current.length) return current;
        const legacy = window.ethereum!;
        const name = legacy.isRainbow ? "Rainbow" : legacy.isCoinbaseWallet ? "Base App" : legacy.isMetaMask ? "MetaMask" : "Browser wallet";
        return [{ id: "legacy", name, icon: "", provider: legacy }];
      });
    }, 0);
    return () => { window.clearTimeout(legacyTimer); window.removeEventListener("eip6963:announceProvider", announce); };
  }, []);

  useEffect(() => {
    const prior = window.localStorage.getItem(STORAGE_KEY);
    if (!prior || account || connecting) return;
    const reconnect = async () => {
      if (/^(base|metamask|rainbow)-app$/.test(prior)) {
        const kind = prior.replace("-app", "") as MobileWalletKind;
        const selectedProvider = findWallet(kind)?.provider;
        if (!selectedProvider) return;
        const accounts = await selectedProvider.request<unknown[]>({ method: "eth_accounts" }).catch(() => []);
        const next = normalizeAccount(accounts[0]);
        if (next) bindProvider(selectedProvider, prior, next);
      } else if (prior === "base") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else if (prior.startsWith("injected")) {
        const id = prior.split(":")[1];
        const selected = wallets.find((wallet) => wallet.id === id)?.provider ?? window.ethereum;
        if (!selected) return;
        const accounts = await selected.request<unknown[]>({ method: "eth_accounts" }).catch(() => []);
        const next = normalizeAccount(accounts[0]);
        if (next) bindProvider(selected, prior, next);
      }
    };
    void reconnect();
  }, [account, bindProvider, connecting, findWallet, wallets]);

  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (...args: unknown[]) => setAccount(normalizeAccount(((args[0] as unknown[]) ?? [])[0]));
    const chainChanged = (...args: unknown[]) => setMessage(String(args[0]).toLowerCase() === BASE_CHAIN_HEX ? "Connected to Base." : "Switch this wallet to Base Mainnet.");
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, [provider]);

  const value = useMemo<WalletState>(() => ({
    account, provider, connecting, message, modalOpen, wallets, connect, connectBase, connectMetaMask, connectRainbow, connectWalletConnect,
    connectInjected, disconnect, openModal: () => setModalOpen(true), closeModal: () => setModalOpen(false), request, signMessage,
  }), [account, provider, connecting, message, modalOpen, wallets, connect, connectBase, connectMetaMask, connectRainbow, connectWalletConnect, connectInjected, disconnect, request, signMessage]);

  return <WalletContext.Provider value={value}>
    {children}
    {modalOpen && <div className="wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
      <section className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
        <button className="wallet-modal-close" onClick={() => setModalOpen(false)} aria-label="Close wallet chooser">×</button>
        <span>BASE MAINNET // 8453</span>
        <h2 id="wallet-modal-title">Connect a wallet</h2>
        <p>Choose your wallet. On a phone, Gravity Goons reopens securely inside that wallet&apos;s app.</p>
        <div className="wallet-options">
          <button onClick={connectBase} disabled={connecting} aria-label="Open Gravity Goons in the Base App">
            <Image src="/wallets/base.svg" alt="" width={48} height={48}/><strong>Base</strong><small>OPEN APP</small>
          </button>
          <button onClick={connectMetaMask} disabled={connecting} aria-label="Open Gravity Goons in MetaMask">
            <Image src="/wallets/metamask.svg" alt="" width={48} height={48}/><strong>MetaMask</strong><small>OPEN APP</small>
          </button>
          <button onClick={connectRainbow} disabled={connecting} aria-label="Open Gravity Goons in Rainbow">
            <Image src="/wallets/rainbow.svg" alt="" width={48} height={48}/><strong>Rainbow</strong><small>OPEN APP</small>
          </button>
        </div>
        {Boolean(process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim()) && <button className="wallet-more" onClick={connectWalletConnect} disabled={connecting}>More wallets via WalletConnect</button>}
        {wallets.filter((wallet) => !(["base", "metamask", "rainbow"] as MobileWalletKind[]).some((kind) => isWalletKind(wallet.name, wallet.rdns, kind))).map((wallet) => <button className="wallet-more" key={wallet.id} onClick={() => connectInjected(wallet.id)} disabled={connecting}>
          {wallet.icon && <Image src={wallet.icon} alt="" width={24} height={24} unoptimized/>}<span>Connect {wallet.name}</span>
        </button>)}
        <div className="wallet-modal-status" aria-live="polite"><b>{connecting ? "CONNECTING" : "STATUS"}</b><span>{message || "Choose a connection method."}</span></div>
        <button className="wallet-diagnostic-copy" type="button" onClick={() => navigator.clipboard.writeText([
          `Gravity Goons wallet status: ${message || "idle"}`,
          `URL: ${window.location.href}`,
          `Base chain: ${BASE_CHAIN_ID}`,
          `Browser: ${navigator.userAgent}`,
        ].join("\n"))}>COPY DIAGNOSTICS</button>
        <small>A connection or signature cannot spend funds. Transactions always require a separate wallet confirmation.</small>
      </section>
    </div>}
  </WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
