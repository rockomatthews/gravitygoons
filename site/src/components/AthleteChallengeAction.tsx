"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletProvider";

export function AthleteChallengeAction({ tokenId, discipline, eligibleTokenIds, minted, owner, locked }: {
  tokenId: number;
  discipline: string;
  eligibleTokenIds: number[];
  minted: boolean;
  owner: string | null;
  locked: boolean;
}) {
  const { account, connect } = useWallet();
  const [ownedIds, setOwnedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!account) return;
    fetch(`/api/ownership?wallet=${encodeURIComponent(account)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { tokenIds: [] })
      .then((data) => setOwnedIds(Array.isArray(data.tokenIds) ? data.tokenIds.map(Number) : []))
      .catch(() => setOwnedIds([]));
  }, [account]);

  const ownsTarget = Boolean(account && owner && account.toLowerCase() === owner.toLowerCase());
  const compatible = useMemo(() => account ? ownedIds.filter((id) => eligibleTokenIds.includes(id) && id !== tokenId) : [], [account, eligibleTokenIds, ownedIds, tokenId]);

  if (!minted) return <Link className="athlete-primary-action" href={`/collection?discipline=${encodeURIComponent(discipline)}#collection`}>MINT THIS GOON</Link>;
  if (!account) return <button className="athlete-primary-action" onClick={connect}>CONNECT TO CHALLENGE</button>;
  if (ownsTarget) return <span className="athlete-action-note">THIS GOON IS IN YOUR ROSTER</span>;
  if (locked) return <span className="athlete-action-note">GOON CURRENTLY LOCKED IN COMPETITION</span>;
  if (compatible.length) return <Link className="athlete-primary-action" href={`/collection?challengeToken=${tokenId}#collection`}>CHALLENGE THIS GOON</Link>;
  return <span className="athlete-action-note">OWN A {discipline.toUpperCase()} GOON TO CHALLENGE</span>;
}
