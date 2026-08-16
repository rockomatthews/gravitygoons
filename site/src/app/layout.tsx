import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import { ChatDock } from "@/components/ChatDock";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import "./globals.css";
import { ResultReceiptModal } from "@/components/ResultReceiptModal";
import { MobileNav } from "@/components/MobileNav";

export const metadata: Metadata = {
  metadataBase: new URL("https://gravitygoons.com"),
  title: "Gravity Goons — Live 1v1 Trick Matches on Base",
  description: "Pick an exact-ID Gravity Goon, call the trick, and take the letters in live 1v1 competition. Player USDC challenges are live; audience betting is coming soon.",
  openGraph: {
    title: "Gravity Goons — Live 1v1 Trick Matches on Base",
    description: "Choose your exact action-sports Goon and compete live across six disciplines. Player USDC challenges are live; audience betting is coming soon.",
    url: "https://gravitygoons.com",
    siteName: "Gravity Goons",
    images: [{ url: "/og-arcade-v2.png", width: 1200, height: 630, alt: "Six Gravity Goons competing in a neon arcade — live 1v1 trick matches with player USDC challenges" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravity Goons — Live 1v1 Trick Matches",
    description: "Pick your Goon. Call your trick. Take the letters. Player USDC challenges are live; audience betting is coming soon.",
    images: ["/og-arcade-v2.png"],
  },
  other: {
    "base:app_id": "6a78436c85896ee8433316e6",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WalletProvider><AnalyticsProvider />{children}<MobileNav/><ResultReceiptModal/><ChatDock /></WalletProvider></body>
    </html>
  );
}
