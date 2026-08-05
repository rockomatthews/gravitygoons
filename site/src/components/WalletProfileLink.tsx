"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useWallet } from "@/components/WalletProvider";

export function WalletProfileLink({ className, children, ariaLabel }: { className?: string; children: ReactNode; ariaLabel?: string }) {
  const { account } = useWallet();
  const [resolved, setResolved] = useState<{ address: string; username: string | null } | null>(null);

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    fetch(`/api/profile/resolve?address=${encodeURIComponent(account)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : { username: null })
      .then((data) => setResolved({ address: account.toLowerCase(), username: typeof data.username === "string" ? data.username : null }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [account]);

  const username = account && resolved?.address === account.toLowerCase() ? resolved.username : null;
  return <Link href={username ? `/${username}` : "/profile"} className={className} aria-label={ariaLabel}>{children}</Link>;
}
