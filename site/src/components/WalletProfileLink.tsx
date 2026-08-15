import Link from "next/link";
import type { ReactNode } from "react";

export function WalletProfileLink({ className, children, ariaLabel }: { className?: string; children: ReactNode; ariaLabel?: string }) {
  return <Link href="/profile" className={className} aria-label={ariaLabel}>{children}</Link>;
}
