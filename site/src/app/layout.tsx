import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gravitygoons.com"),
  title: "Gravity Goons — Built to Break Gravity",
  description: "Choose one of 1,000 action-sports athletes designed for discipline-matched, stat-driven trick battles.",
  openGraph: {
    title: "Gravity Goons — Built to Break Gravity",
    description: "Choose your exact action-sports Goon, call the trick, and play the odds in future discipline-matched battles.",
    url: "https://gravitygoons.com",
    siteName: "Gravity Goons",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Gravity Goons — Built to Break Gravity" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gravity Goons — Built to Break Gravity",
    description: "Choose your Goon. Call the trick. Play the odds.",
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
