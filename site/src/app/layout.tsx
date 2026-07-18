import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gravitygoons.com"),
  title: "Gravity Goons — Built to Break Gravity",
  description: "Choose one of 1,000 selectable action-sports athletes built to learn tricks.",
  openGraph: {
    title: "Gravity Goons — Built to Break Gravity",
    description: "Choose your exact full-body action-sports Goon on Base. No blind box. No reveal.",
    url: "https://gravitygoons.com",
    siteName: "Gravity Goons",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Gravity Goons — Built to Break Gravity" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravity Goons — Built to Break Gravity",
    description: "Choose your exact action-sports Goon on Base.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WalletProvider>{children}</WalletProvider></body>
    </html>
  );
}
