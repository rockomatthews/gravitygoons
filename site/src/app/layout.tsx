import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import { ChatDock } from "@/components/ChatDock";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gravitygoons.com"),
  title: "Gravity Goons — Built to Break Gravity",
  description: "Pick an exact-ID Gravity Goon on Base, call the trick, challenge a same-discipline rival, and take the letters in live 1v1 competition.",
  openGraph: {
    title: "Gravity Goons — Built to Break Gravity",
    description: "Choose your exact action-sports Goon, call the trick, and compete live across six disciplines on Base.",
    url: "https://gravitygoons.com",
    siteName: "Gravity Goons",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Gravity Goons — Built to Break Gravity" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravity Goons — Built to Break Gravity",
    description: "Pick your Goon. Call your trick. Take the letters.",
    images: ["/og.png"],
  },
  other: {
    "base:app_id": "6a78436c85896ee8433316e6",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WalletProvider><AnalyticsProvider />{children}<ChatDock /></WalletProvider></body>
    </html>
  );
}
